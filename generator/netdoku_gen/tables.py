"""Tablas de encaminamiento (categoría Tabla de enrutamiento, v0.5).

Véanse «Tabla de enrutamiento (v0.5)» en implementation/netdoku_catalogo_reglas.md
y «Implementación en la v0.5» en implementation/game_round_generation.md.

Cada red con equipos tiene una puerta de enlace (uno de sus routers). Cada
router tiene un siguiente salto hacia cada red, calculado por número de
routers (como RIP), con los empates decididos una sola vez por router y red
de destino. La ruta de un paquete es la puerta de enlace de su red de origen
y, desde ella, los siguientes saltos; nunca pasa dos veces por la misma red.

Una ruta exige las tablas si, en la parte a la que le llega el TTL, no es el
único camino mínimo del mapa. Las consultas que deciden un empate (la puerta
de enlace o la tabla de un router) dan su coste de interpretación.

Las tablas se escriben después en uno de tres estilos (`full`, `default`,
`summary`), que dan el mismo siguiente salto a cada red del nivel.
"""

import ipaddress
from collections import Counter, deque

from .routes import network_graph

DEFAULT = ipaddress.IPv4Network("0.0.0.0/0")
STYLES = ("full", "default", "summary")


class Tables:
    def __init__(self, rng, board, transit=None):
        self.rng = rng
        self.board = board
        self.routers = {r.id: r for r in board.routers}
        self.nets = [n.id for n in board.networks]
        self.graph = network_graph(board)
        # Routers vecinos (comparten una red; nunca más de una) y la red que comparten.
        self.shared = {}
        self.neighbors = {r: [] for r in self.routers}
        for a in board.routers:
            for b in board.routers:
                common = set(a.networks) & set(b.networks)
                if a.id != b.id and common:
                    if len(common) > 1:
                        raise RuntimeError("Dos routers comparten dos redes")
                    self.shared[(a.id, b.id)] = common.pop()
                    self.neighbors[a.id].append(b.id)
        # Puerta de enlace de cada red con equipos.
        self.gateways = {}
        for n in self.nets:
            here = sorted(r.id for r in board.routers if n in r.networks)
            if n != transit and here:
                self.gateways[n] = rng.choice(here)
        # Distancia en routers de cada router a cada red y siguiente salto (None: entrega directa).
        self.dist, self.options, self.next_hop = {}, {}, {}
        for x in self.nets:
            dist = {r: 0 for r, router in self.routers.items() if x in router.networks}
            queue = deque(dist)
            while queue:
                r = queue.popleft()
                for s in self.neighbors[r]:
                    if s not in dist:
                        dist[s] = dist[r] + 1
                        queue.append(s)
            for r in self.routers:
                self.dist[(r, x)] = dist[r]
                if dist[r] == 0:
                    self.next_hop[(r, x)] = None
                    continue
                opts = sorted(s for s in self.neighbors[r] if dist[s] == dist[r] - 1)
                self.options[(r, x)] = opts
                self.next_hop[(r, x)] = rng.choice(opts)
        self.entries = {}
        self.style = "full"
        self.next_hop_form = "name"

    # ---- rutas ----

    def route(self, a, b):
        """(redes, routers) de la ruta de la red `a` a la red `b`, o None si no vale (misma red,
        red sin puerta de enlace o ruta que pasa dos veces por una red)."""
        if a == b or a not in self.gateways:
            return None
        nets, routers = [a], []
        r = self.gateways[a]
        while True:
            routers.append(r)
            if b in self.routers[r].networks:
                nets.append(b)
                return nets, routers
            s = self.next_hop[(r, b)]
            net = self.shared[(r, s)]
            if net in nets:
                return None
            nets.append(net)
            r = s

    def routes(self):
        """{(a, b): (redes, routers)} de todos los pares válidos."""
        result = {}
        for a in self.gateways:
            for b in self.gateways:
                found = self.route(a, b)
                if found:
                    result[(a, b)] = found
        return result

    def shortest_paths(self, a, b):
        """Todos los caminos mínimos del mapa de `a` a `b`: [(redes, routers)]."""
        dist = {b: 0}
        queue = deque([b])
        while queue:
            x = queue.popleft()
            for y, _ in self.graph[x]:
                if y not in dist:
                    dist[y] = dist[x] + 1
                    queue.append(y)
        result = []

        def walk(nets, routers):
            x = nets[-1]
            if x == b:
                result.append((list(nets), list(routers)))
                return
            for y, r in self.graph[x]:
                if dist.get(y) == dist[x] - 1:
                    walk(nets + [y], routers + [r])
        walk([a], [])
        return result

    @staticmethod
    def _reach(nets, routers, ttl):
        return tuple(nets[:min(len(routers), ttl - 1) + 1])

    def requires(self, nets, routers, ttl):
        """La parte alcanzable de la ruta no es la de todos los caminos mínimos del mapa."""
        reach = self._reach(nets, routers, ttl)
        return any(self._reach(n, r, ttl) != reach for n, r in self.shortest_paths(nets[0], nets[-1]))

    def loose_networks(self, nets, routers, ttl):
        """Redes alcanzables de la ruta y de cualquier camino mínimo (para comprobar si las
        tablas son imprescindibles)."""
        result = set(self._reach(nets, routers, ttl))
        for n, r in self.shortest_paths(nets[0], nets[-1]):
            result.update(self._reach(n, r, ttl))
        return result

    def decisions(self, nets, routers, ttl):
        """Consultas que deciden un empate en la parte alcanzable: "gateway" o routers."""
        if not self.requires(nets, routers, ttl):
            return []
        a, b = nets[0], nets[-1]
        reach = self._reach(nets, routers, ttl)
        k = len(reach) - 1
        result = []
        here = [r for r in self.routers.values() if a in r.networks]
        if len(here) > 1 and any(self._reach(n, r, ttl) != reach and r[0] != routers[0]
                                 for n, r in self.shortest_paths(a, b)):
            result.append("gateway")
        for i in range(min(k, len(routers) - 1)):
            r = routers[i]
            for s in self.options.get((r, b), []):
                if s != routers[i + 1] and tuple(self._follow(nets[:i + 1], r, s, b, k + 1)) != reach:
                    result.append(r)
                    break
        return result

    def _follow(self, nets, r, s, b, limit):
        """Redes si `r` enviara el paquete a `s` y después se siguieran las tablas."""
        nets = list(nets)
        while len(nets) < limit:
            nets.append(self.shared[(r, s)])
            r = s
            if len(nets) >= limit:
                break
            if b in self.routers[r].networks:
                nets.append(b)
                break
            s = self.next_hop[(r, b)]
        return nets[:limit]

    # ---- escritura de las tablas ----

    def write(self, style, next_hop_form="name", zones=None):
        """Entradas de la tabla de cada router en ese estilo: [(prefijo, siguiente salto o None)]."""
        self.style, self.next_hop_form = style, next_hop_form
        prefixes = self.board.prefixes
        for r, router in self.routers.items():
            own = list(router.networks)
            entries = [(prefixes[n], None) for n in own]
            others = {x: self.next_hop[(r, x)] for x in self.nets if x not in own}
            if style == "full" or not others:
                entries += [(prefixes[x], h) for x, h in others.items()]
            else:
                # `summary`: cada zona con al menos dos redes que van por el mismo siguiente salto
                # tiene su resumen; las redes de la zona que van por otro sitio, su propia entrada.
                covered, summaries = {}, []
                if style == "summary":
                    for block, members in zones or []:
                        mine = [x for x in members if x in others]
                        if len(mine) < 2:
                            continue
                        counts = Counter(others[x] for x in mine)
                        top = max(counts.values())
                        if top < 2:
                            continue
                        h = self.rng.choice(sorted(v for v, c in counts.items() if c == top))
                        summaries.append((block, h))
                        covered.update((x, h) for x in mine)
                # La ruta por defecto va al siguiente salto más usado entre las redes que quedan.
                rest = Counter(h for x, h in others.items() if x not in covered)
                default = None
                if rest:
                    top = max(rest.values())
                    default = self.rng.choice(sorted(h for h, c in rest.items() if c == top))
                entries += [(prefixes[x], h) for x, h in others.items() if covered.get(x, default) != h]
                entries += summaries + ([(DEFAULT, default)] if default else [])
            entries.sort(key=lambda e: (e[0] == DEFAULT, int(e[0].network_address), e[0].prefixlen))
            self.entries[r] = entries
            for x in self.nets:
                assert self.lookup(r, prefixes[x])[1] == self.next_hop[(r, x)], (r, x, entries)

    def lookup(self, r, prefix):
        """(entradas que coinciden sin contar la ruta por defecto, siguiente salto que gana)."""
        matches = [e for e in self.entries[r] if e[0] != DEFAULT and prefix.subnet_of(e[0])]
        if matches:
            return matches, max(matches, key=lambda e: e[0].prefixlen)[1]
        return [], next((h for p, h in self.entries[r] if p == DEFAULT), None)

    def entry_class(self, r, net_id):
        """Clase de entrada con la que `r` envía lo que va a `net_id`: "direct", "own" (su propia
        entrada), "summary" (una que agrupa varias redes) o "default"."""
        if net_id in self.routers[r].networks:
            return "direct"
        prefix = self.board.prefixes[net_id]
        matches, _ = self.lookup(r, prefix)
        if not matches:
            return "default"
        best = max(matches, key=lambda e: e[0].prefixlen)[0]
        return "own" if best == prefix else "summary"

    def match_cost(self, r, net_id):
        """Coste de encontrar la entrada que gana (sin reconocer el siguiente salto)."""
        prefix = self.board.prefixes[net_id]
        matches, _ = self.lookup(r, prefix)
        if net_id in self.routers[r].networks:
            return 0
        if not matches:
            return 1
        if len(matches) == 1:
            p = matches[0][0]
            return 0 if p == prefix else (1 if p.prefixlen % 8 == 0 else 2)
        return 2 if all(p.prefixlen % 8 == 0 for p, _ in matches) else 3

    def lookup_cost(self, r, net_id):
        """Coste de interpretación de buscar la red `net_id` en la tabla de `r`."""
        cost = self.match_cost(r, net_id)
        if self.next_hop[(r, net_id)] is not None and self.next_hop_form == "ip":
            cost = max(cost, 1)
        return cost

    def gateway_cost(self):
        return 1 if self.next_hop_form == "ip" else 0

    def route_cost(self, nets, routers, ttl):
        """Coste de la ruta: el de su consulta más cara entre las que deciden un empate (None si
        la ruta no exige las tablas)."""
        decisions = self.decisions(nets, routers, ttl)
        if not decisions:
            return None
        return max(self.gateway_cost() if d == "gateway" else self.lookup_cost(d, nets[-1]) for d in decisions)

    def max_entries(self):
        return max(len(e) for e in self.entries.values())

    def to_dict(self):
        """Bloque `routing` del nivel. Con siguiente salto por IP, `via` sigue siendo el router: el
        motor escribe la IP de su interfaz en la red compartida (routers[].interfaces)."""
        return {"tableStyle": self.style, "nextHop": self.next_hop_form,
                "gateways": dict(sorted(self.gateways.items())),
                "tables": {r: [{"prefix": str(p), **({"direct": True} if h is None else {"via": h})}
                               for p, h in self.entries[r]] for r in self.routers}}

    def interface_toward(self, r, s):
        """Red por la que `r` envía a su vecino `s`."""
        return self.shared[(r, s)]
