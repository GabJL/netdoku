"""Selección de pistas (versión voraz de la v0).

1. Se eligen pistas de los paquetes que no son la víctima hasta que la
   propagación los coloca a todos. La víctima no interviene: su dominio son
   todas las casillas libres.
2. Si la víctima no queda ya determinada por descarte (con tantos paquetes
   como filas, le queda la única fila y columna libres), se añaden pistas suyas
   hasta que lo esté. Se prefieren pistas que, por sí solas, no la coloquen:
   así la víctima se resuelve al final.
3. Se quitan las pistas redundantes, manteniendo que los demás paquetes se
   resuelvan sin las pistas de la víctima.

Las pistas entre dos paquetes no tienen un `D` fijo: lo que quitan se mide
propagando desde el estado actual. Un nivel lleva como mucho `max_relations`.
Con un extremo oculto, un paquete está resuelto cuando le queda un solo estado.
"""

from dataclasses import replace

from .rules import ROUTE_FAMILIES
from .solver import initial_domains, propagate, relations_of, solved, uncertainty

# Peso relativo de cada subtipo al elegir. Las pistas de fila y columna son
# fáciles de usar, así que se prefieren las de red y nodos.
SUBTYPE_WEIGHTS = {
    "network.in_network": 1.0,
    "network.prefix_length": 2.0,  # solo existe con longitudes repetidas pero no todas iguales
    # Las negativas y las disyuntivas tienen muchas instancias: pesan menos.
    "network.not_in_network": 0.9,
    "network.in_either_network": 0.5,
    "network.node_count": 1.0,
    "node.adjacent_to_node": 1.0,
    "node.unique_adjacent_to_node": 1.2,
    "node.not_adjacent_to_node": 0.45,
    "router.adjacent_to_router": 1.0,
    # Encaminamiento: pesan más que las demás para que la categoría se note.
    "endpoint.in_origin_network": 1.6,
    "endpoint.in_destination_network": 1.6,
    "route.in_transit_network": 2.0,
    "route.last_router": 1.8,
    "route.next_router": 1.8,
    "ttl.routers_crossed": 1.6,
    "ttl.routers_left": 1.4,
    "ttl.routers_crossed_range": 1.6,
    "spatial.in_row": 0.45,
    "spatial.in_column": 0.45,
    # Extremos ocultos (v0.4.5).
    "endpoint.origin": 1.6,
    "endpoint.destination": 1.6,
    "endpoint.origin_class": 1.4,
    "endpoint.destination_class": 1.4,
    "route.first_router": 1.8,
    "route.final_router": 1.8,
    # Entre dos paquetes (v0.4.5).
    "relation.same_network": 1.4,
    "relation.routers_between": 1.4,
    "relation.more_addresses_network": 1.6,
    "relation.more_routers_crossed": 1.4,
    "relation.higher_ttl": 1.4,
    "relation.closer_to_destination": 1.2,
    "relation.same_origin": 1.6,
    "relation.same_destination": 1.6,
    # Tabla de enrutamiento (v0.5).
    "route.crossed_router": 1.4,
    "route.last_entry": 1.6,
    "route.next_entry": 1.6,
    "relation.same_next_hop": 1.4,
}


# Pistas candidatas que se evalúan en cada elección.
MAX_CANDIDATES = 40


class Selector:
    def __init__(self, rng, ctx, pool, victim_id, rules, max_relations=2, boost_networks=(), boost_packets=()):
        self.rng = rng
        self.max_relations = max_relations
        self.boost_networks = set(boost_networks)
        # Tabla de enrutamiento: paquetes cuya ruta exige las tablas; sus pistas de ruta pesan más.
        self.boost_packets = set(boost_packets)
        self.ctx = ctx
        self.pool = pool
        self.victim = victim_id
        self.packet_ids = [p.id for p in ctx.packets]
        self.others = [p for p in self.packet_ids if p != victim_id]
        self.rules = rules

    def solve(self, clues, victim_route=True):
        base = self.ctx.base
        if not victim_route:
            base = {**base, self.victim: self.ctx.free_cells}
        d = initial_domains(base, self.packet_ids, clues)
        return propagate(d, self.rules, exclude_from_subsets={self.victim}, relations=relations_of(clues))

    def others_solved(self, clues):
        # Sin nada de la víctima (ni sus pistas ni su ruta): se deduce al final.
        d, _ = self.solve([c for c in clues if c.packet != self.victim], victim_route=False)
        return solved(d, self.others)

    def all_solved(self, clues):
        d, _ = self.solve(clues)
        return solved(d)

    def _names_boosted(self, c):
        """La pista nombra una red de `boost_networks` o un equipo de ella."""
        for kind, ref in c.slots.values():
            if kind == "network" and ref in self.boost_networks:
                return True
            if kind == "node" and next(n.network for n in self.ctx.nodes if n.id == ref) in self.boost_networks:
                return True
            if kind == "router" and set(self.ctx.router(ref).networks) & self.boost_networks:
                return True
        return False

    def _useful(self, c, d):
        """Si no quita nada a su paquete (o, entre dos paquetes, a ninguno), la propagación daría lo mismo."""
        if d is None:
            return True
        if c.other:
            return bool(c.relation.drop(d[c.packet], d[c.other], True)[0]
                        or c.relation.drop(d[c.other], d[c.packet], False)[0])
        return bool(c.excluded) or not d[c.packet] <= c.domain

    def _pick(self, clues, candidates, targets):
        # Fila + columna del mismo paquete equivale a dar sus coordenadas: solo
        # se permite si no queda ninguna otra pista útil.
        return (self._pick_from(clues, candidates, targets, allow_coordinates=False)
                or self._pick_from(clues, candidates, targets, allow_coordinates=True))

    def _pick_from(self, clues, candidates, targets, allow_coordinates):
        # Mientras se eligen pistas de los demás, la ruta de la víctima no cuenta.
        with_victim = self.victim in targets
        d, _ = self.solve(clues, with_victim)
        base = uncertainty(d, targets)
        with_spatial = {c.packet for c in clues if c.type.startswith("spatial.")}
        relations_left = self.max_relations - sum(1 for c in clues if c.other)
        useful = [c for c in candidates
                  if (allow_coordinates or not c.type.startswith("spatial.") or c.packet not in with_spatial)
                  and (relations_left > 0 or not c.other)
                  and self._useful(c, d)]
        # Se evalúa una muestra al azar (propagar cada candidata es lo que más
        # tarda); si en ella no hay ninguna que sirva, el resto.
        self.rng.shuffle(useful)
        for chunk in (useful[:MAX_CANDIDATES], useful[MAX_CANDIDATES:]):
            options = []
            for c in chunk:
                d2, _ = self.solve(clues + [c], with_victim)
                gain = base - uncertainty(d2, targets)
                if gain > 1e-9:
                    # Ganancias moderadas: evita que cada pista coloque un paquete.
                    weight = SUBTYPE_WEIGHTS.get(c.type, 1.0) * min(gain, 2.5) ** 0.5
                    if self.boost_networks and self._names_boosted(c):
                        weight *= 4
                    if (self.boost_packets and c.type.split(".")[0] in ROUTE_FAMILIES
                            and ({c.packet, c.other} & self.boost_packets)):
                        weight *= 3
                    options.append((c, weight))
            if options:
                return self.rng.choices([o[0] for o in options], weights=[o[1] for o in options])[0]
        return None

    def select(self):
        clues = []
        others_pool = [c for c in self.pool if c.packet != self.victim]
        while not self.others_solved(clues):
            c = self._pick(clues, [x for x in others_pool if x not in clues], self.others)
            if c is None:
                raise RuntimeError("Las pistas disponibles no bastan para resolver el nivel")
            clues.append(c)

        victim_pool = [c for c in self.pool if c.packet == self.victim]
        # Preferir pistas de la víctima que por sí solas no la colocan.
        late = [c for c in victim_pool if len(c.domain) > 1]
        while not self.all_solved(clues):
            pool = [x for x in (late or victim_pool) if x not in clues]
            c = self._pick(clues, pool, [self.victim])
            if c is None and late:
                late = []
                continue
            if c is None:
                raise RuntimeError("No se puede determinar la casilla de la víctima")
            clues.append(c)

        # Quitar redundancias.
        order = clues[:]
        self.rng.shuffle(order)
        # Primero se intentan quitar las espaciales y, en Encaminamiento, antes las demás que las de ruta y TTL.
        order.sort(key=lambda c: (not c.type.startswith("spatial."), c.type.split(".")[0] in ROUTE_FAMILIES))
        for c in order:
            trial = [x for x in clues if x is not c]
            if self.all_solved(trial) and self.others_solved(trial):
                clues = trial

        # Orden de presentación: por paquete y, dentro de cada uno, como se eligieron.
        # Se devuelven copias numeradas: las pistas del pool se comparten entre
        # varias selecciones y no deben modificarse.
        clues.sort(key=lambda c: self.packet_ids.index(c.packet))
        return [replace(c, id=f"C{i}") for i, c in enumerate(clues, 1)]
