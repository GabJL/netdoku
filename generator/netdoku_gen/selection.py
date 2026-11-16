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
"""

from dataclasses import replace

from .solver import initial_domains, propagate, uncertainty

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
    "spatial.in_row": 0.45,
    "spatial.in_column": 0.45,
}


# Pistas candidatas que se evalúan en cada elección.
MAX_CANDIDATES = 40


class Selector:
    def __init__(self, rng, ctx, pool, victim_id, rules):
        self.rng = rng
        self.ctx = ctx
        self.pool = pool
        self.victim = victim_id
        self.packet_ids = [p.id for p in ctx.packets]
        self.others = [p for p in self.packet_ids if p != victim_id]
        self.rules = rules

    def solve(self, clues):
        d = initial_domains(self.ctx.free_cells, self.packet_ids, clues)
        return propagate(d, self.rules, exclude_from_subsets={self.victim})

    def others_solved(self, clues):
        d, _ = self.solve([c for c in clues if c.packet != self.victim])
        return d is not None and all(len(d[p]) == 1 for p in self.others)

    def all_solved(self, clues):
        d, _ = self.solve(clues)
        return d is not None and all(len(d[p]) == 1 for p in self.packet_ids)

    def _pick(self, clues, candidates, targets):
        # Fila + columna del mismo paquete equivale a dar sus coordenadas: solo
        # se permite si no queda ninguna otra pista útil.
        return (self._pick_from(clues, candidates, targets, allow_coordinates=False)
                or self._pick_from(clues, candidates, targets, allow_coordinates=True))

    def _pick_from(self, clues, candidates, targets, allow_coordinates):
        d, _ = self.solve(clues)
        base = uncertainty(d, targets)
        with_spatial = {c.packet for c in clues if c.type.startswith("spatial.")}
        useful = [c for c in candidates
                  if (allow_coordinates or not c.type.startswith("spatial.") or c.packet not in with_spatial)
                  # Si no quita nada a su paquete, la propagación daría lo mismo.
                  and (d is None or c.excluded or not d[c.packet] <= c.domain)]
        # Se evalúa una muestra al azar (propagar cada candidata es lo que más
        # tarda); si en ella no hay ninguna que sirva, el resto.
        self.rng.shuffle(useful)
        for chunk in (useful[:MAX_CANDIDATES], useful[MAX_CANDIDATES:]):
            options = []
            for c in chunk:
                d2, _ = self.solve(clues + [c])
                gain = base - uncertainty(d2, targets)
                if gain > 1e-9:
                    # Ganancias moderadas: evita que cada pista coloque un paquete.
                    weight = SUBTYPE_WEIGHTS.get(c.type, 1.0) * min(gain, 2.5) ** 0.5
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
        order.sort(key=lambda c: not c.type.startswith("spatial."))  # espaciales primero
        for c in order:
            trial = [x for x in clues if x is not c]
            if self.all_solved(trial) and self.others_solved(trial):
                clues = trial

        # Orden de presentación: por paquete y, dentro de cada uno, como se eligieron.
        # Se devuelven copias numeradas: las pistas del pool se comparten entre
        # varias selecciones y no deben modificarse.
        clues.sort(key=lambda c: self.packet_ids.index(c.packet))
        return [replace(c, id=f"C{i}") for i, c in enumerate(clues, 1)]
