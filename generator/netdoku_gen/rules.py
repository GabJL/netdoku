"""Subtipos de pista (véase implementation/netdoku_catalogo_reglas.md).

Cada pista lleva una plantilla con huecos (`slots`) para los elementos que
nombra (red, equipo, router, longitud de prefijo). Su texto inicial usa las
formas de la categoría Inicial; naming.py puede cambiarlo después sin tocar
`D` ni `A`.

Casi todas las pistas son unarias: cada una fija un conjunto de casillas
permitidas `D` para su paquete y, en el caso de `unique_adjacent_to_node`, un
conjunto de casillas anuladas `A` para los demás paquetes. Las pistas entre
dos paquetes (`relation.*`, v0.4.5) no tienen `D`: dan un valor a cada
posibilidad de cada paquete y los pares de valores permitidos (`Relation`).

En la categoría Encaminamiento cada paquete parte además de las casillas de
su ruta a las que le llega el TTL (`Context.base`, regla `packetOnRoute`), y
hay pistas de ruta y TTL (`endpoint.*`, `route.*`, `ttl.*`). Sus formas
(`ip_view`/`mac_view`, `count`/`ttl_value`) cambian toda la frase, así que su
`template` es un diccionario forma -> plantilla.

Con un extremo oculto (v0.4.5), las posibilidades de un paquete son estados
`(f, c, red del extremo)` y la ruta depende de esa red (`Context.alternatives`).
Las pistas de ruta y TTL se evalúan con la ruta de cada estado, y las demás se
elevan a estados (`Context.lift`).
"""

from collections import deque
from dataclasses import dataclass, field, replace

from .board import side_neighbors
from .content import class_label, class_members, count_text, join_names, network_counts, node_classes
from .routes import network_graph
from .solver import Relation, cell_of

TOPIC = "T3.dispositivos"
KNOWLEDGE = "basic"
ROUTE_FAMILIES = ("endpoint", "route", "ttl")
NUMBER_WORDS = {1: "un", 2: "dos", 3: "tres", 4: "cuatro", 5: "cinco"}


def routers_text(n):
    """«un router», «dos routers»…"""
    return f"{NUMBER_WORDS[n]} router" + ("" if n == 1 else "s")


@dataclass
class Clue:
    packet: str
    type: str
    params: dict
    text: str
    domain: frozenset                      # D: casillas permitidas para `packet`
    excluded: frozenset = frozenset()      # A: casillas prohibidas para los demás
    id: str = ""
    topic: str = TOPIC
    knowledge: str = KNOWLEDGE
    template: str = ""                     # texto con huecos {nombre}
    slots: dict = field(default_factory=dict)   # nombre -> (tipo, valor)
    naming: dict = field(default_factory=dict)  # nombre -> forma elegida
    slot_data: dict = field(default_factory=dict)  # nombre -> {kind, ref, form, value}: lo que usa el motor
    reading_cost: int = 0
    other: str = ""                        # segundo paquete de una pista entre dos paquetes
    relation: Relation = None              # sus valores y pares permitidos

    def key(self):
        """Dos pistas con la misma clave dicen lo mismo a efectos lógicos.

        Las de ruta y TTL incluyen su subtipo: varias dicen a menudo lo mismo
        («había atravesado un router», «el último router que había atravesado
        era…») y conviene que todas puedan salir.
        """
        if self.other:
            return (self.type, self.packet, self.other, tuple(sorted(self.params.items())))
        if self.type.split(".")[0] in ROUTE_FAMILIES:
            return (self.packet, self.domain, self.excluded, self.type)
        return (self.packet, self.domain, self.excluded)


class Context:
    """Datos del nivel que necesitan las pistas."""

    def __init__(self, board, nodes, packets, addressing=None, routes=None, transit=None, hidden=None):
        self.board = board
        self.addressing = addressing
        self.nodes = nodes
        self.packets = packets
        node_cells = {n.cell for n in nodes}
        self.free_cells = frozenset((r, c) for r in range(board.height) for c in range(board.width)
                                    if (r, c) not in node_cells)
        self.adj = {n.id: frozenset(x for x in side_neighbors(n.cell, board.height, board.width)
                                    if x in self.free_cells and board.network_of(x) == n.network)
                    for n in nodes}
        self.classes = node_classes(nodes)
        # Encaminamiento: ruta de cada paquete y casillas de partida (las de su ruta a las que llega).
        self.routes = routes or {}
        self.transit = transit
        # Extremos ocultos: paquete -> "origin" | "destination", y la ruta con cada red posible del extremo.
        # "path" (solo al comprobar si las tablas son imprescindibles): cada camino mínimo es una
        # hipótesis, y la ruta verdadera lleva la etiqueta "route".
        self.hidden = {pid: kind for pid, (kind, _) in (hidden or {}).items()}
        self.alternatives = {pid: alts for pid, (_, alts) in (hidden or {}).items()}
        self.base = {}
        for p in packets:
            if p.id in self.alternatives:
                self.base[p.id] = frozenset((r, c, tag) for tag, rt in self.alternatives[p.id].items()
                                            for r, c in self.network_cells(*rt.reachable_networks()))
            elif p.id in self.routes:
                self.base[p.id] = self.network_cells(*self.routes[p.id].reachable_networks())
            else:
                self.base[p.id] = self.free_cells
        self.distance = _network_distances(board)
        self.tables = None   # Tabla de enrutamiento (v0.5): tables.Tables

    def node(self, node_id):
        return next(n for n in self.nodes if n.id == node_id)

    def router(self, router_id):
        return next(r for r in self.board.routers if r.id == router_id)

    def router_words(self, router):
        """«que une Aulas y Servicios», «que une Aulas, Servicios y Troncal»."""
        return "que une " + join_names(self.board.network(n).name for n in router.networks)

    def true_state(self, p):
        """La posibilidad verdadera de un paquete: su casilla o, con un extremo oculto, su estado."""
        kind = self.hidden.get(p.id)
        if not kind:
            return p.cell
        if kind == "path":
            return (*p.cell, "route")
        route = self.routes[p.id]
        return (*p.cell, route.networks[0] if kind == "origin" else route.networks[-1])

    def lift(self, pid, domain):
        """`D` en las posibilidades del paquete: con un extremo oculto, los estados de sus casillas."""
        if pid not in self.alternatives:
            return domain
        return frozenset(x for x in self.base[pid] if x in domain or x[:2] in domain)

    def route_at(self, pid, x):
        """Ruta del paquete en la posibilidad `x` y routers atravesados en ella."""
        route = self.alternatives[pid][x[2]] if pid in self.alternatives else self.routes[pid]
        return route, route.networks.index(self.board.network_of(cell_of(x)))

    def network_cells(self, *net_ids):
        return frozenset(c for i in net_ids for c in self.board.network(i).cells if c in self.free_cells)

    def class_adjacent(self, params):
        """Casillas junto a algún nodo de la clase."""
        return frozenset().union(*(self.adj[m.id] for m in class_members(self.nodes, params)))

    def node_reference(self, node):
        """Cómo nombrar un nodo concreto sin ambigüedad, o None si no se puede."""
        same_label = [n for n in self.nodes if n.label == node.label]
        if len(same_label) == 1:
            return f"al {node.label}"
        if sum(1 for n in same_label if n.network == node.network) == 1:
            return f"al {node.label} de la red {self.board.network(node.network).name}"
        return None


def _in_network(ctx, p):
    net = ctx.board.network(ctx.board.network_of(p.cell))
    cells = frozenset(c for c in net.cells if c in ctx.free_cells)
    yield Clue(p.id, "network.in_network", {"networkId": net.id},
               f"El paquete {p.id} estaba en la red {net.name} ({net.prefix}).", cells,
               template=f"El paquete {p.id} estaba en la red {{net}}.", slots={"net": ("network", net.id)})


def _not_in_network(ctx, p):
    own = ctx.board.network_of(p.cell)
    for net in ctx.board.networks:
        if net.id != own:
            yield Clue(p.id, "network.not_in_network", {"networkId": net.id},
                       f"El paquete {p.id} no estaba en la red {net.name} ({net.prefix}).",
                       ctx.free_cells - ctx.network_cells(net.id),
                       template=f"El paquete {p.id} no estaba en la red {{net}}.", slots={"net": ("network", net.id)})


def _in_either_network(ctx, p):
    own = ctx.board.network_of(p.cell)
    for net in ctx.board.networks:
        if net.id == own:
            continue
        a, b = sorted([own, net.id])   # la verdadera puede ser la primera o la segunda
        na, nb = ctx.board.network(a), ctx.board.network(b)
        yield Clue(p.id, "network.in_either_network", {"networkIds": [a, b]},
                   f"El paquete {p.id} estaba en la red {na.name} ({na.prefix}) o en la red {nb.name} ({nb.prefix}).",
                   ctx.network_cells(a, b),
                   template=f"El paquete {p.id} estaba en la red {{net1}} o en la red {{net2}}.",
                   slots={"net1": ("network", a), "net2": ("network", b)})


def _node_count(ctx, p):
    own = ctx.board.network_of(p.cell)
    for params in ctx.classes:
        counts = network_counts(ctx.nodes, ctx.board.networks, params)
        count = counts[own]
        nets = [n for n, k in counts.items() if k == count]
        # Con una sola red es la forma `contents` de esa red; con todas, no dice nada.
        if count > 3 or len(nets) < 2 or len(nets) == len(counts):
            continue
        yield Clue(p.id, "network.node_count", {**params, "count": count},
                   f"El paquete {p.id} estaba en una red {count_text(params, count)}.", ctx.network_cells(*nets))


def _prefix_length(ctx, p):
    if ctx.addressing is None:
        return
    prefixes = ctx.addressing.prefixes
    mine = prefixes[ctx.board.network_of(p.cell)].prefixlen
    nets = [n for n in ctx.board.networks if prefixes[n.id].prefixlen == mine]
    if len(nets) < 2:
        return  # sería network.in_network dicha de otra forma
    cells = frozenset(c for n in nets for c in n.cells if c in ctx.free_cells)
    yield Clue(p.id, "network.prefix_length", {"prefixLength": mine},
               f"El paquete {p.id} estaba en una red /{mine}.", cells, topic="T3.ip",
               template=f"El paquete {p.id} estaba en una red {{len}}.", slots={"len": ("length", mine)})


def _adjacent_to_node(ctx, p):
    neighbors = [n for n in ctx.nodes if p.cell in ctx.adj[n.id]]
    for n in neighbors:
        ref = ctx.node_reference(n)
        if ref:
            yield Clue(p.id, "node.adjacent_to_node", {"nodeId": n.id},
                       f"El paquete {p.id} estaba junto {ref}.", ctx.adj[n.id],
                       template=f"El paquete {p.id} estaba junto {{node}}.", slots={"node": ("node", n.id)})
        classes = [({"nodeType": n.type}, "un servidor" if n.type == "server" else f"un {n.label}")]
        if n.type == "server":
            classes.append(({"nodeType": "server", "service": n.services[0]}, f"un {n.label}"))
        for params, words in classes:
            members = [m for m in ctx.nodes if m.type == params["nodeType"]
                       and ("service" not in params or params["service"] in m.services)]
            domain = frozenset().union(*(ctx.adj[m.id] for m in members))
            yield Clue(p.id, "node.adjacent_to_node", params,
                       f"El paquete {p.id} estaba junto a {words}.", domain)


def _not_adjacent_to_node(ctx, p):
    for n in ctx.nodes:
        if p.cell in ctx.adj[n.id] or not ctx.adj[n.id]:
            continue
        ref = ctx.node_reference(n)
        if ref:
            yield Clue(p.id, "node.not_adjacent_to_node", {"nodeId": n.id},
                       f"El paquete {p.id} no estaba junto {ref}.", ctx.free_cells - ctx.adj[n.id],
                       template=f"El paquete {p.id} no estaba junto {{node}}.", slots={"node": ("node", n.id)})
    for params in ctx.classes:
        near = ctx.class_adjacent(params)
        if near and p.cell not in near:
            yield Clue(p.id, "node.not_adjacent_to_node", dict(params),
                       f"El paquete {p.id} no estaba junto a ningún {class_label(params)}.", ctx.free_cells - near)


def _unique_adjacent_to_node(ctx, p):
    for n in ctx.nodes:
        if p.cell not in ctx.adj[n.id]:
            continue
        others = [q for q in ctx.packets if q.id != p.id and q.cell in ctx.adj[n.id]]
        ref = ctx.node_reference(n)
        if not others and ref:
            yield Clue(p.id, "node.unique_adjacent_to_node", {"nodeId": n.id},
                       f"El paquete {p.id} estaba junto {ref}, y ningún otro paquete lo estaba.",
                       ctx.adj[n.id], excluded=ctx.adj[n.id],
                       template=f"El paquete {p.id} estaba junto {{node}}, y ningún otro paquete lo estaba.",
                       slots={"node": ("node", n.id)})


def _network_distances(board):
    """Routers que hay que atravesar, como mínimo, entre cada par de redes."""
    adj = network_graph(board)
    dist = {}
    for s in adj:
        seen, queue = {s: 0}, deque([s])
        while queue:
            x = queue.popleft()
            for y, _ in adj[x]:
                if y not in seen:
                    seen[y] = seen[x] + 1
                    queue.append(y)
        for t, d in seen.items():
            dist[(s, t)] = d
    return dist


def _adjacent_to_router(ctx, p):
    for r in ctx.board.routers:
        cells = frozenset(c for c in r.between if c in ctx.free_cells)
        if p.cell in cells:
            yield Clue(p.id, "router.adjacent_to_router", {"routerId": r.id},
                       f"El paquete {p.id} estaba junto al router {ctx.router_words(r)}.", cells,
                       template=f"El paquete {p.id} estaba junto al router {{router}}.",
                       slots={"router": ("router", r.id)})


def _in_row(ctx, p):
    r = p.cell[0]
    yield Clue(p.id, "spatial.in_row", {"row": r + 1},
               f"El paquete {p.id} estaba en la fila {r + 1}.",
               frozenset(c for c in ctx.free_cells if c[0] == r),
               template=f"El paquete {p.id} estaba {{row}}.", slots={"row": ("row", r + 1)})


def _in_column(ctx, p):
    col = p.cell[1]
    yield Clue(p.id, "spatial.in_column", {"column": col + 1},
               f"El paquete {p.id} estaba en la columna {col + 1}.",
               frozenset(c for c in ctx.free_cells if c[1] == col),
               template=f"El paquete {p.id} estaba {{column}}.", slots={"column": ("column", col + 1)})


# ---------- Rutas y TTL (categoría Encaminamiento) ----------

ROUTE_TOPIC = "T3.ip"


def _route_cells(ctx, pid, fn):
    """`D` de una pista de ruta: `fn(ruta)` da las casillas en las que es verdadera con esa ruta.
    Con un extremo oculto se aplica a la ruta de cada estado."""
    alts = ctx.alternatives.get(pid)
    if not alts:
        return fn(ctx.routes[pid])
    result = set()
    for tag, rt in alts.items():
        cells = fn(rt)
        result.update(x for x in ctx.base[pid] if x[2] == tag and x[:2] in cells)
    return frozenset(result)


def _nets(ctx, rt, indexes):
    """Casillas libres de las redes de la ruta en esas posiciones (las que existan)."""
    return ctx.network_cells(*(rt.networks[i] for i in indexes if 0 <= i < len(rt.networks)))


def _in_origin_network(ctx, p):
    route = ctx.routes.get(p.id)
    if not route or route.crossed != 0 or route.last_reachable == 0:
        return
    ip = f"El paquete {p.id} aún no había salido de la red de su origen."
    yield Clue(p.id, "endpoint.in_origin_network", {}, ip, _route_cells(ctx, p.id, lambda rt: _nets(ctx, rt, [0])),
               topic=ROUTE_TOPIC,
               template={"ip_view": ip,
                         "mac_view": f"La trama que llevaba el paquete {p.id} la había enviado su propio equipo de origen."},
               slots={"view": ("view", None)})


def _in_destination_network(ctx, p):
    route = ctx.routes.get(p.id)
    if not route or route.length == 0 or route.crossed != route.length:
        return
    ip = f"El paquete {p.id} ya había llegado a la red de su destino."
    yield Clue(p.id, "endpoint.in_destination_network", {}, ip,
               _route_cells(ctx, p.id, lambda rt: _nets(ctx, rt, [len(rt.networks) - 1])), topic=ROUTE_TOPIC,
               template={"ip_view": ip,
                         "mac_view": f"La trama que llevaba el paquete {p.id} iba dirigida directamente a su equipo de destino."},
               slots={"view": ("view", None)})


def _in_transit_network(ctx, p):
    route = ctx.routes.get(p.id)
    if not route or route.networks[route.crossed] != ctx.transit:
        return
    yield Clue(p.id, "route.in_transit_network", {}, f"El paquete {p.id} estaba pasando por una red de tránsito.",
               ctx.network_cells(ctx.transit), topic=ROUTE_TOPIC)


def _router_clue(ctx, p, kind, router_id):
    words = ctx.router_words(ctx.router(router_id))

    def cells(rt):
        return _nets(ctx, rt, [i + 1 if kind == "last" else i for i, r in enumerate(rt.routers) if r == router_id])
    if kind == "last":
        ip = f"El último router que había atravesado el paquete {p.id} era el router {{router}}."
        mac = f"La trama que llevaba el paquete {p.id} la había enviado el router {{router}}."
    else:
        ip = f"El siguiente router que iba a atravesar el paquete {p.id} era el router {{router}}."
        mac = f"La trama que llevaba el paquete {p.id} iba dirigida al router {{router}}."
    yield Clue(p.id, f"route.{kind}_router", {"routerId": router_id}, ip.format(router=words),
               _route_cells(ctx, p.id, cells), topic=ROUTE_TOPIC,
               template={"ip_view": ip, "mac_view": mac},
               slots={"view": ("view", None), "router": ("router", router_id)})


def _last_router(ctx, p):
    route = ctx.routes.get(p.id)
    if route and route.crossed >= 1:
        yield from _router_clue(ctx, p, "last", route.routers[route.crossed - 1])


def _next_router(ctx, p):
    route = ctx.routes.get(p.id)
    if route and route.crossed < route.length:
        yield from _router_clue(ctx, p, "next", route.routers[route.crossed])


def _crossed_count(p, n):
    if n == 0:
        return f"El paquete {p.id} no había atravesado ningún router."
    return f"El paquete {p.id} había atravesado exactamente {routers_text(n)}."


def _routers_crossed(ctx, p):
    route = ctx.routes.get(p.id)
    if not route or route.last_reachable == 0:
        return
    n = route.crossed
    count = _crossed_count(p, n)
    yield Clue(p.id, "ttl.routers_crossed", {"count": n}, count,
               _route_cells(ctx, p.id, lambda rt: _nets(ctx, rt, [n])), topic=ROUTE_TOPIC,
               template={"count": count, "ttl_value": f"El paquete {p.id} llevaba TTL {route.ttl - n}."},
               slots={"ttl": ("ttl", None)})


def _routers_left(ctx, p):
    route = ctx.routes.get(p.id)
    if not route or route.crossed >= route.length or not route.reaches_destination:
        return
    n = route.length - route.crossed
    verb = "quedaba" if n == 1 else "quedaban"
    yield Clue(p.id, "ttl.routers_left", {"count": n},
               f"Al paquete {p.id} le {verb} {routers_text(n)} para llegar a la red de su destino.",
               _route_cells(ctx, p.id, lambda rt: _nets(ctx, rt, [rt.length - n])), topic=ROUTE_TOPIC)


def _routers_crossed_range(ctx, p):
    """«Al menos n» o «como mucho n» routers: deja dos redes alcanzables como mínimo y quita alguna."""
    route = ctx.routes.get(p.id)
    if not route:
        return
    k, top, ttl = route.crossed, route.last_reachable, route.ttl
    for n in range(1, k + 1):            # al menos n
        if n > top - 1:
            break
        if n == 1:
            count = f"El paquete {p.id} ya había atravesado algún router."
            value = f"El TTL del paquete {p.id} ya era menor que el inicial."
        else:
            count = f"El paquete {p.id} había atravesado al menos {routers_text(n)}."
            value = f"El TTL del paquete {p.id} era como mucho {ttl - n}."
        yield Clue(p.id, "ttl.routers_crossed_range", {"min": n}, count,
                   _route_cells(ctx, p.id, lambda rt, n=n: _nets(ctx, rt, range(n, rt.last_reachable + 1))),
                   topic=ROUTE_TOPIC,
                   template={"count": count, "ttl_value": value}, slots={"ttl": ("ttl", None)})
    for n in range(max(1, k), top):      # como mucho n
        count = f"El paquete {p.id} había atravesado como mucho {routers_text(n)}."
        value = f"El TTL del paquete {p.id} era al menos {ttl - n}."
        yield Clue(p.id, "ttl.routers_crossed_range", {"max": n}, count,
                   _route_cells(ctx, p.id, lambda rt, n=n: _nets(ctx, rt, range(n + 1))), topic=ROUTE_TOPIC,
                   template={"count": count, "ttl_value": value}, slots={"ttl": ("ttl", None)})


# ---------- Extremos ocultos (categoría Encaminamiento, v0.4.5) ----------

def _hidden_states(ctx, p, tags):
    return frozenset(x for x in ctx.base[p.id] if x[2] in tags)


def _hidden_node(ctx, p):
    kind = ctx.hidden.get(p.id)
    route = ctx.routes[p.id]
    return kind, ctx.node(route.origin if kind == "origin" else route.destination)


def _endpoint_node(ctx, p):
    """«El paquete A lo había enviado el servidor web de Aulas» / «La IP de origen del paquete A era …»."""
    if p.id not in ctx.hidden:
        return
    kind, node = _hidden_node(ctx, p)
    ref = ctx.node_reference(node)
    if not ref:
        return
    if kind == "origin":
        template = {"default": f"El paquete {p.id} lo había enviado {{node_el}}.",
                    "ip": f"La IP de origen del paquete {p.id} era {{node_value}}."}
        text = f"El paquete {p.id} lo había enviado el {ref[3:]}."
    else:
        template = {"default": f"El paquete {p.id} iba dirigido {{node}}.",
                    "ip": f"La IP de destino del paquete {p.id} era {{node_value}}."}
        text = f"El paquete {p.id} iba dirigido {ref}."
    yield Clue(p.id, f"endpoint.{kind}", {"nodeId": node.id}, text, _hidden_states(ctx, p, {node.network}),
               topic=ROUTE_TOPIC, template=template, slots={"node": ("node", node.id)})


def _endpoint_class(ctx, p):
    """«El paquete A lo había enviado un servidor DNS» / «… iba dirigido a un equipo de usuario»."""
    if p.id not in ctx.hidden:
        return
    kind, node = _hidden_node(ctx, p)
    tags = set(ctx.alternatives[p.id])
    classes = [{"nodeType": node.type}]
    if node.type == "server":
        classes.append({"nodeType": "server", "service": node.services[0]})
    for params in classes:
        nets = {m.network for m in class_members(ctx.nodes, params)} & tags
        if len(nets) < 2 or nets == tags:
            continue
        words = class_label(params)
        text = (f"El paquete {p.id} lo había enviado un {words}." if kind == "origin"
                else f"El paquete {p.id} iba dirigido a un {words}.")
        yield Clue(p.id, f"endpoint.{kind}_class", dict(params), text, _hidden_states(ctx, p, nets), topic=ROUTE_TOPIC)


def _end_router(ctx, p):
    """Primer router de la ruta (la puerta de enlace del origen) o último (el que lo entrega)."""
    route = ctx.routes.get(p.id)
    kind = ctx.hidden.get(p.id)
    if not kind or not route.routers:
        return
    pick = (lambda rt: rt.routers[0]) if kind == "origin" else (lambda rt: rt.routers[-1])
    router_id = pick(route)
    tags = {t for t, rt in ctx.alternatives[p.id].items() if rt.routers and pick(rt) == router_id}
    if kind == "origin":
        name = "route.first_router"
        ip = (f"El primer router de la ruta del paquete {p.id} era el router {{router}}, "
              f"la puerta de enlace de su equipo de origen.")
        mac = f"Al salir de su equipo de origen, la trama que llevaba el paquete {p.id} iba dirigida al router {{router}}."
    else:
        name = "route.final_router"
        ip = f"El último router de la ruta del paquete {p.id} era el router {{router}}."
        mac = f"En la red de su destino, el paquete {p.id} llegaba en una trama enviada por el router {{router}}."
    yield Clue(p.id, name, {"routerId": router_id}, ip.format(router=ctx.router_words(ctx.router(router_id))),
               _hidden_states(ctx, p, tags), topic=ROUTE_TOPIC, template={"ip_view": ip, "mac_view": mac},
               slots={"view": ("view", None), "router": ("router", router_id)})


# ---------- Pistas entre dos paquetes (v0.4.5) ----------

def _partners(ctx, p, symmetric):
    """Paquetes con los que `p` puede tener una pista: nunca la víctima; las simétricas, una vez por pareja."""
    if p.role == "victim":
        return
    for q in ctx.packets:
        if q.id != p.id and q.role != "victim" and not (symmetric and q.id < p.id):
            yield q


def _relation(ctx, name, m, n, value, test, text, params=None, **extra):
    """Pista entre `m` y `n`: `value(paquete, posibilidad)` y `test(valor de m, valor de n)`.

    No se genera si algún valor no existe (None) o si la pista no descarta ningún par.
    """
    first = {x: value(m.id, x) for x in ctx.base[m.id]}
    second = {y: value(n.id, y) for y in ctx.base[n.id]}
    if None in first.values() or None in second.values():
        return None
    a_values, b_values = set(first.values()), set(second.values())
    allowed = frozenset((a, b) for a in a_values for b in b_values if test(a, b))
    if len(allowed) == len(a_values) * len(b_values):
        return None
    rel = Relation(first, second, allowed)
    assert (first[ctx.true_state(m)], second[ctx.true_state(n)]) in allowed, (name, m.id, n.id)
    return Clue(m.id, name, params or {}, text, None, other=n.id, relation=rel, **extra)


def _network_value(ctx):
    return lambda pid, x: ctx.board.network_of(cell_of(x))


def _same_network(ctx, p):
    for q in _partners(ctx, p, True):
        if ctx.board.network_of(p.cell) == ctx.board.network_of(q.cell):
            clue = _relation(ctx, "relation.same_network", p, q, _network_value(ctx), lambda a, b: a == b,
                             f"Los paquetes {p.id} y {q.id} estaban en la misma red.")
            if clue:
                yield clue


def _routers_between(ctx, p):
    for q in _partners(ctx, p, True):
        k = ctx.distance[(ctx.board.network_of(p.cell), ctx.board.network_of(q.cell))]
        if k == 0:
            continue
        if k == 1:
            text = f"Las redes de los paquetes {p.id} y {q.id} eran vecinas: las unía un router."
        else:
            text = (f"Para ir de la red del paquete {p.id} a la del paquete {q.id} había que atravesar "
                    f"como mínimo {routers_text(k)}.")
        clue = _relation(ctx, "relation.routers_between", p, q, _network_value(ctx),
                         lambda a, b, k=k: ctx.distance[(a, b)] == k, text, {"count": k})
        if clue:
            yield clue


def _more_addresses(ctx, p):
    if ctx.addressing is None:
        return
    size = lambda pid, x: ctx.addressing.size(ctx.board.network_of(cell_of(x)))  # noqa: E731
    for q in _partners(ctx, p, False):
        if size(p.id, p.cell) > size(q.id, q.cell):
            text = f"El paquete {p.id} estaba en una red con más direcciones que la del paquete {q.id}."
            clue = _relation(ctx, "relation.more_addresses_network", p, q, size, lambda a, b: a > b, text,
                             topic="T3.subredes", template={"size_compare": text}, slots={"compare": ("compare", "size")})
            if clue:
                yield clue


def _route_relation(ctx, p, name, value, test, text, **extra):
    """Pista de ruta entre `p` y otro paquete con ruta, si es verdadera."""
    if p.id not in ctx.routes:
        return
    for q in _partners(ctx, p, False):
        if q.id not in ctx.routes:
            continue
        mine, theirs = value(p.id, ctx.true_state(p)), value(q.id, ctx.true_state(q))
        if mine is None or theirs is None or not test(mine, theirs):
            continue
        clue = _relation(ctx, name, p, q, value, test, text(p, q), topic=ROUTE_TOPIC, **extra)
        if clue:
            yield clue


def _crossed(ctx):
    return lambda pid, x: ctx.route_at(pid, x)[1]


def _more_routers_crossed(ctx, p):
    yield from _route_relation(ctx, p, "relation.more_routers_crossed", _crossed(ctx), lambda a, b: a > b,
                               lambda m, n: f"El paquete {m.id} había atravesado más routers que el paquete {n.id}.")


def _higher_ttl(ctx, p):
    def ttl(pid, x):
        route, k = ctx.route_at(pid, x)
        return route.ttl - k

    def text(m, n):
        return f"En ese momento, el paquete {m.id} llevaba más TTL que el paquete {n.id}."
    if p.id not in ctx.routes:
        return
    for clue in _route_relation(ctx, p, "relation.higher_ttl", ttl, lambda a, b: a > b, text):
        yield replace(clue, template={"ttl_compare": clue.text}, slots={"compare": ("compare", "ttl")})


def _closer_to_destination(ctx, p):
    def left(pid, x):
        route, k = ctx.route_at(pid, x)
        if route.broadcast or not route.reaches_destination:
            return None
        return route.length - k
    yield from _route_relation(ctx, p, "relation.closer_to_destination", left, lambda a, b: a < b,
                               lambda m, n: f"Al paquete {m.id} le quedaban menos routers que al paquete {n.id} "
                                            f"para llegar a la red de su destino.")


def _same_end(ctx, p, kind):
    """Mismo origen o mismo destino: solo si alguno de los dos tiene oculto ese extremo."""
    if p.id not in ctx.routes:
        return

    def end(pid, x):
        route = ctx.routes[pid]
        if route.broadcast and kind == "destination":
            return None
        if ctx.hidden.get(pid) == kind:
            return x[2]
        return route.networks[0] if kind == "origin" else route.networks[-1]

    for q in _partners(ctx, p, True):
        if q.id not in ctx.routes or kind not in (ctx.hidden.get(p.id), ctx.hidden.get(q.id)):
            continue
        if end(p.id, ctx.true_state(p)) != end(q.id, ctx.true_state(q)):
            continue
        text = (f"Los paquetes {p.id} y {q.id} habían salido de la misma red." if kind == "origin"
                else f"Los paquetes {p.id} y {q.id} iban a la misma red.")
        clue = _relation(ctx, f"relation.same_{kind}", p, q, end, lambda a, b: a == b, text, topic=ROUTE_TOPIC)
        if clue:
            yield clue


# ---------- Tabla de enrutamiento (v0.5) ----------

TABLE_TOPIC = "T3.encaminamiento"


def _crossed_router(ctx, p):
    """«El paquete A ya había pasado por el router R3» / «… aún no había llegado al router R3»."""
    route = ctx.routes.get(p.id)
    if not ctx.tables or not route or route.broadcast:
        return
    k, top = route.crossed, route.last_reachable
    for i, router_id in enumerate(route.routers, start=1):
        crossed = i <= k
        keep = [j for j in range(top + 1) if (j >= i if crossed else j < i)]
        if len(keep) < 2 or len(keep) == top + 1:
            continue

        def cells(rt, router_id=router_id, crossed=crossed):
            if router_id not in rt.routers:
                return frozenset()
            i = rt.routers.index(router_id) + 1
            return _nets(ctx, rt, [j for j in range(rt.last_reachable + 1) if (j >= i if crossed else j < i)])
        if crossed:
            template = f"El paquete {p.id} ya había pasado por el router {{router}}."
        else:
            template = f"El paquete {p.id} aún no había llegado al router {{router}}."
        yield Clue(p.id, "route.crossed_router", {"routerId": router_id, "crossed": crossed},
                   template.format(router=router_id), _route_cells(ctx, p.id, cells), topic=TABLE_TOPIC,
                   template=template, slots={"router": ("router", router_id)})


def _entry_clue(ctx, p, kind):
    """Clase de entrada que usó el último router atravesado o que usará el siguiente."""
    route = ctx.routes.get(p.id)
    tables = ctx.tables
    if not tables or not route:
        return
    k = route.crossed
    if (kind == "last" and k < 1) or (kind == "next" and k >= route.length):
        return
    dest = route.networks[-1]
    router_id = route.routers[k - 1] if kind == "last" else route.routers[k]
    entry = tables.entry_class(router_id, dest)
    if entry not in ("default", "summary", "direct") or (kind == "last" and entry == "direct"):
        return

    def cells(rt):
        d = rt.networks[-1]
        if kind == "last":
            idx = [j for j in range(1, rt.last_reachable + 1) if tables.entry_class(rt.routers[j - 1], d) == entry]
        else:
            idx = [j for j in range(min(rt.last_reachable, rt.length - 1) + 1)
                   if tables.entry_class(rt.routers[j], d) == entry]
        return _nets(ctx, rt, idx)
    who = (f"El último router que había atravesado el paquete {p.id} lo había reenviado" if kind == "last"
           else f"El siguiente router que iba a atravesar el paquete {p.id} lo reenviaría")
    text = {"default": f"{who} por su ruta por defecto.",
            "summary": f"{who} por una entrada que agrupa varias redes.",
            "direct": f"El siguiente router que iba a atravesar el paquete {p.id} lo entregaría directamente "
                      f"a su destino."}[entry]
    # Coste: el de la consulta más cara de los routers de la ruta que hay que mirar.
    cost = 0
    for rt in (ctx.alternatives.get(p.id) or {"": route}).values():
        last = rt.last_reachable if kind == "last" else min(rt.last_reachable + 1, rt.length)
        cost = max([cost] + [tables.match_cost(r, rt.networks[-1]) for r in rt.routers[:last]])
    yield Clue(p.id, f"route.{kind}_entry", {"entry": entry}, text, _route_cells(ctx, p.id, cells),
               topic=TABLE_TOPIC, template=text, slots={"entry": ("entry", cost)})


def _same_next_hop(ctx, p):
    """«El siguiente salto de los paquetes A y B era el mismo router»."""
    if not ctx.tables or p.id not in ctx.routes:
        return

    def value(pid, x):
        route, k = ctx.route_at(pid, x)
        return route.routers[k] if k < route.length else f"-{pid}"   # en la red del destino, ninguno
    for q in _partners(ctx, p, True):
        if q.id not in ctx.routes:
            continue
        mine, theirs = value(p.id, ctx.true_state(p)), value(q.id, ctx.true_state(q))
        if mine != theirs:
            continue
        clue = _relation(ctx, "relation.same_next_hop", p, q, value, lambda a, b: a == b,
                         f"El siguiente salto de los paquetes {p.id} y {q.id} era el mismo router.",
                         topic=TABLE_TOPIC)
        if clue:
            yield clue


# Orden: si dos pistas dicen lo mismo (mismas D y A), se queda la primera. El
# recuento va antes que la disyuntiva y la negativa porque, con pocas redes,
# suele coincidir con alguna de ellas.
SUBTYPES = {
    "endpoint.origin": _endpoint_node,
    "endpoint.destination": _endpoint_node,
    "endpoint.origin_class": _endpoint_class,
    "endpoint.destination_class": _endpoint_class,
    "route.first_router": _end_router,
    "route.final_router": _end_router,
    "endpoint.in_origin_network": _in_origin_network,
    "endpoint.in_destination_network": _in_destination_network,
    "route.in_transit_network": _in_transit_network,
    "route.last_router": _last_router,
    "route.next_router": _next_router,
    "route.crossed_router": _crossed_router,
    "route.last_entry": lambda ctx, p: _entry_clue(ctx, p, "last"),
    "route.next_entry": lambda ctx, p: _entry_clue(ctx, p, "next"),
    "ttl.routers_crossed": _routers_crossed,
    "ttl.routers_left": _routers_left,
    "ttl.routers_crossed_range": _routers_crossed_range,
    "network.in_network": _in_network,
    "network.prefix_length": _prefix_length,
    "network.node_count": _node_count,
    "network.not_in_network": _not_in_network,
    "network.in_either_network": _in_either_network,
    "node.adjacent_to_node": _adjacent_to_node,
    "node.unique_adjacent_to_node": _unique_adjacent_to_node,
    "node.not_adjacent_to_node": _not_adjacent_to_node,
    "router.adjacent_to_router": _adjacent_to_router,
    "spatial.in_row": _in_row,
    "spatial.in_column": _in_column,
    "relation.same_network": _same_network,
    "relation.routers_between": _routers_between,
    "relation.more_addresses_network": _more_addresses,
    "relation.more_routers_crossed": _more_routers_crossed,
    "relation.higher_ttl": _higher_ttl,
    "relation.closer_to_destination": _closer_to_destination,
    "relation.same_origin": lambda ctx, p: _same_end(ctx, p, "origin"),
    "relation.same_destination": lambda ctx, p: _same_end(ctx, p, "destination"),
    "relation.same_next_hop": _same_next_hop,
}
# Subtipos que solo genera un extremo oculto de cierto tipo (los demás generadores no los distinguen).
HIDDEN_KIND = {"endpoint.origin": "origin", "endpoint.destination": "destination",
               "endpoint.origin_class": "origin", "endpoint.destination_class": "destination",
               "route.first_router": "origin", "route.final_router": "destination"}
# Pistas que hablan del extremo oculto de su paquete (cada paquete con uno lleva al menos una).
HIDDEN_TYPES = set(HIDDEN_KIND) | {"relation.same_origin", "relation.same_destination"}


def uncalculated(ctx, clue):
    """`D` y `A` de la pista para quien no hace el cálculo de una forma con coste.

    Sin calcular, de «junto al servidor web 10.0.3.7» queda «junto a algún
    servidor web»; de «no estaba junto al servidor web 10.0.3.7», que no está
    junto a alguno de ellos (solo descarta las casillas junto a todos); de
    «junto al router con las interfaces …», «junto a algún router»; de una red
    o una longitud nombradas por dirección, máscara o tamaño, nada. Las filas y
    columnas no tienen formas con coste.

    En las pistas de ruta y TTL, sin entender la trama (`mac_view`) ni restar
    el TTL (`ttl_value`) no queda nada; de un router nombrado por sus
    interfaces queda que el paquete había atravesado alguno (`last_router`) o
    que le quedaba alguno por atravesar (`next_router`). De una IP de origen o
    de destino sin calcular su red, nada.

    Las pistas entre dos paquetes con coste (`size_compare`, `ttl_compare`) no
    dicen nada sin su cálculo: devuelve None.
    """
    if clue.other:
        return None
    domain, excluded = _uncalculated(ctx, clue)
    return ctx.lift(clue.packet, domain), excluded


def _uncalculated(ctx, clue):
    family = clue.type.split(".")[0]
    if family in ROUTE_FAMILIES:
        if clue.type in ("route.last_router", "route.next_router"):
            if clue.type == "route.last_router":
                fn = lambda rt: _nets(ctx, rt, range(1, rt.last_reachable + 1))  # noqa: E731
            else:
                fn = lambda rt: _nets(ctx, rt, range(min(rt.last_reachable, rt.length - 1) + 1))  # noqa: E731
            return _route_cells(ctx, clue.packet, fn), frozenset()
        if clue.slots:
            return ctx.free_cells, frozenset()
        return clue.domain, clue.excluded
    kinds = {kind for kind, _ in clue.slots.values()}
    if kinds & {"network", "length"}:
        return ctx.free_cells, frozenset()
    if "node" in kinds:
        node_id = next(ref for kind, ref in clue.slots.values() if kind == "node")
        label = next(n.label for n in ctx.nodes if n.id == node_id)
        candidates = [ctx.adj[n.id] for n in ctx.nodes if n.label == label]
        if clue.type == "node.not_adjacent_to_node":
            return ctx.free_cells - frozenset.intersection(*candidates), frozenset()
        excluded = frozenset.intersection(*candidates) if clue.excluded else frozenset()
        return frozenset().union(*candidates), excluded
    if "router" in kinds:
        return frozenset(c for r in ctx.board.routers for c in r.between if c in ctx.free_cells), frozenset()
    return clue.domain, clue.excluded


def generate_instances(ctx, enabled=None, disabled=()):
    """Todas las pistas verdaderas de los subtipos activos, sin duplicados lógicos."""
    seen, result = set(), []
    for name, gen in SUBTYPES.items():
        if (enabled is not None and name not in enabled) or name in disabled:
            continue
        for p in ctx.packets:
            if name in HIDDEN_KIND and ctx.hidden.get(p.id) != HIDDEN_KIND[name]:
                continue
            for clue in gen(ctx, p):
                if clue.type != name:
                    continue
                if not clue.other:
                    clue = replace(clue, domain=ctx.lift(p.id, clue.domain))
                    assert ctx.true_state(p) in clue.domain, clue
                if clue.key() not in seen:
                    seen.add(clue.key())
                    result.append(clue)
    return result
