"""Rutas, orígenes, destinos y TTL de los paquetes (categoría Encaminamiento, v0.4).

Véanse «Implementación prevista en la v0.4» en implementation/game_round_generation.md
y «Encaminamiento: rutas y TTL» en implementation/netdoku_catalogo_reglas.md.

Primero se colocan los paquetes y después se elige para cada uno un origen y
un destino cuya ruta pase por su red. Solo valen pares con un único camino
mínimo en el grafo Red↔Router, para que el jugador pueda trazar la ruta sin
tablas de encaminamiento.

v0.4.5: los routers pueden unir tres o cuatro redes, y un paquete puede tener
oculto su origen o su destino (`choose_hidden`): su ruta depende entonces de
la red de ese extremo, que el jugador tiene que deducir.

v0.5 (Tabla de enrutamiento): las rutas salen de las tablas (`tables.Tables`),
que se pasan como `paths`, y se prefieren los pares cuya ruta exige las tablas
(`prefer`).
"""

from collections import deque
from dataclasses import dataclass

# routes.finalPositionWeights: papel de la red del paquete en su ruta.
ROLE_WEIGHTS = {"origin": 0.15, "intermediate": 0.60, "destination": 0.25}
TTL_VALUES = {2: 0.15, 3: 0.25, 4: 0.25, 5: 0.20, 6: 0.15}
# Nombre de la red de tránsito (clave de idioma `networks.backbone` en el motor).
TRANSIT_NAME = ("backbone", "Troncal")


@dataclass
class Route:
    origin: str               # id del equipo de origen
    destination: str | None   # id del equipo de destino (None si es de difusión)
    broadcast: str | None     # dirección de difusión, si el destino es la difusión de su red
    networks: list            # r0, …, rL
    routers: list             # R1, …, RL (Ri une r(i-1) y ri)
    crossed: int              # k: routers atravesados
    ttl: int                  # TTL inicial

    @property
    def length(self):
        """L: routers del camino."""
        return len(self.routers)

    @property
    def last_reachable(self):
        """K = min(L, TTL inicial − 1): hasta qué red de la ruta puede llegar vivo."""
        return min(self.length, self.ttl - 1)

    @property
    def reaches_destination(self):
        return self.length <= self.ttl - 1

    @property
    def current_ttl(self):
        return self.ttl - self.crossed

    def reachable_networks(self):
        return self.networks[:self.last_reachable + 1]


def network_graph(board):
    """Red -> lista de (red vecina, router que las une). Un router de tres o cuatro redes une cada par."""
    adj = {n.id: [] for n in board.networks}
    for r in board.routers:
        for a in r.networks:
            for b in r.networks:
                if a != b:
                    adj[a].append((b, r.id))
    return adj


def unique_shortest_paths(board):
    """(origen, destino) -> (redes, routers) del camino mínimo, solo si es único."""
    adj = network_graph(board)
    paths = {}
    for s in adj:
        dist, ways, parent = {s: 0}, {s: 1}, {s: None}
        queue = deque([s])
        while queue:
            x = queue.popleft()
            for y, router in adj[x]:
                if y not in dist:
                    dist[y], ways[y], parent[y] = dist[x] + 1, ways[x], (x, router)
                    queue.append(y)
                elif dist[y] == dist[x] + 1:
                    ways[y] += ways[x]
        for t in dist:
            if t == s or ways[t] != 1:
                continue
            nets, routers, x = [t], [], t
            while parent[x]:
                x, router = parent[x]
                nets.append(x)
                routers.append(router)
            paths[(s, t)] = (nets[::-1], routers[::-1])
    return paths


def choose_transit(rng, board, probability=0.5):
    """Una red de tránsito (sin equipos), o None. Debe unir al menos dos routers."""
    degree = {n.id: 0 for n in board.networks}
    for r in board.routers:
        for net in r.networks:
            degree[net] += 1
    candidates = [n for n, d in degree.items() if d >= 2]
    if not candidates or rng.random() >= probability:
        return None
    transit = rng.choice(candidates)
    net = board.network(transit)
    net.name_key, net.name = TRANSIT_NAME
    return transit


def identifiable(nodes, net_id):
    """Equipos de la red con una etiqueta única en ella (se pueden nombrar en la ficha)."""
    here = [n for n in nodes if n.network == net_id]
    return [n for n in here if sum(1 for m in here if m.label == n.label) == 1]


def _ttl(rng, crossed, length, short):
    """TTL inicial que mantiene vivo al paquete con `crossed` routers atravesados.

    Corto: no le alcanza para llegar a su destino (TTL − 1 < L).
    """
    low = max(2, crossed + 1)
    if short:
        options = [t for t in TTL_VALUES if low <= t <= length]
    else:
        options = [t for t in TTL_VALUES if t >= max(low, length + 1)]
    if not options:
        return None
    return rng.choices(options, weights=[TTL_VALUES[t] for t in options])[0]


def assign_routes(rng, board, nodes, packets, victim_id, transit=None, broadcast_probability=0.3,
                  short_ratio=None, paths=None, prefer=(), prefer_weight=4, prefer_min=0):
    """Origen, destino, ruta y TTL inicial de cada paquete, coherentes con su posición.

    `paths`: {(red de origen, red de destino): (redes, routers)}; por defecto, los caminos
    mínimos únicos. `prefer`: pares que pesan `prefer_weight` veces más mientras no se hayan
    elegido `prefer_min` (rutas que exigen las tablas, routes.tables.requiredRouteWeight).
    """
    if paths is None:
        paths = unique_shortest_paths(board)
    preferred = 0
    endpoints = {n.id: identifiable(nodes, n.id) for n in board.networks if n.id != transit}
    endpoints = {k: v for k, v in endpoints.items() if v}
    if short_ratio is None:
        short_ratio = rng.uniform(0.15, 0.3)
    routes = {}
    used = {}   # (red de origen, red de destino) -> veces usado: se prefieren rutas distintas

    # Como mucho un paquete de difusión: no sale de la red de su origen.
    broadcasters = [p for p in packets if p.id != victim_id and board.network_of(p.cell) in endpoints]
    if broadcasters and rng.random() < broadcast_probability:
        p = rng.choice(broadcasters)
        net = board.network_of(p.cell)
        address = str(board.prefixes[net].broadcast_address)
        ttl = rng.choices(list(TTL_VALUES), weights=list(TTL_VALUES.values()))[0]
        routes[p.id] = Route(rng.choice(endpoints[net]).id, None, address, [net], [], 0, ttl)

    for p in packets:
        if p.id in routes:
            continue
        here = board.network_of(p.cell)
        by_role = {role: [] for role in ROLE_WEIGHTS}
        for (a, b), (nets, routers) in paths.items():
            if a not in endpoints or b not in endpoints or here not in nets:
                continue
            k = nets.index(here)
            role = "origin" if k == 0 else "destination" if k == len(routers) else "intermediate"
            by_role[role].append((nets, routers, k))
        roles = [r for r in ROLE_WEIGHTS if by_role[r]]
        if not roles:
            raise RuntimeError(f"Ninguna ruta pasa por la red de {p.id}")
        role = rng.choices(roles, weights=[ROLE_WEIGHTS[r] for r in roles])[0]
        options = by_role[role]
        # Se prefieren las rutas largas, que dan más juego, y las que no lleva otro paquete.
        weights = [len(o[1]) / (1 + 4 * used.get((o[0][0], o[0][-1]), 0))
                   * (prefer_weight if preferred < prefer_min and (o[0][0], o[0][-1]) in prefer else 1)
                   for o in options]
        nets, routers, k = rng.choices(options, weights=weights)[0]
        used[(nets[0], nets[-1])] = used.get((nets[0], nets[-1]), 0) + 1
        preferred += (nets[0], nets[-1]) in prefer
        ttl = None
        if k < len(routers) and rng.random() < short_ratio:
            ttl = _ttl(rng, k, len(routers), short=True)
        if ttl is None:
            ttl = _ttl(rng, k, len(routers), short=False)
        if ttl is None:
            raise RuntimeError(f"Ningún TTL inicial vale para {p.id}")
        taken = {(r.origin, r.destination) for r in routes.values()}
        pairs = [(a.id, b.id) for a in endpoints[nets[0]] for b in endpoints[nets[-1]]]
        origin, destination = rng.choice([x for x in pairs if x not in taken] or pairs)
        routes[p.id] = Route(origin, destination, None, list(nets), list(routers), k, ttl)
    return routes


def choose_hidden(rng, board, nodes, routes, victim_id, transit=None, probability=0.0, max_count=2, paths=None):
    """Paquetes con el origen o el destino oculto: paquete -> (extremo, {red posible: ruta}).

    Las redes posibles del extremo son todas las que tienen equipos, salvo la del
    otro extremo. Solo se oculta si desde todas ellas el camino mínimo es único
    (el jugador traza la ruta de cada hipótesis) y hay al menos dos. Nunca la
    víctima ni un paquete de difusión.
    """
    if not probability or rng.random() >= probability:
        return {}
    if paths is None:
        paths = unique_shortest_paths(board)
    with_nodes = [n.id for n in board.networks if n.id != transit and any(x.network == n.id for x in nodes)]
    options = []
    for pid, route in routes.items():
        if pid == victim_id or route.broadcast or not route.routers:
            continue
        for kind in ("origin", "destination"):
            fixed = route.networks[-1] if kind == "origin" else route.networks[0]
            alternatives = {}
            for net in with_nodes:
                if net == fixed:
                    continue
                key = (net, fixed) if kind == "origin" else (fixed, net)
                if key not in paths:
                    alternatives = None
                    break
                nets, routers = paths[key]
                alternatives[net] = Route(None, None, None, list(nets), list(routers), -1, route.ttl)
            if alternatives and len(alternatives) >= 2:
                options.append((pid, kind, alternatives))
    chosen = {}
    count = rng.randint(1, max_count)
    rng.shuffle(options)
    for pid, kind, alternatives in options:
        if pid not in chosen and len(chosen) < count:
            chosen[pid] = (kind, alternatives)
    return chosen
