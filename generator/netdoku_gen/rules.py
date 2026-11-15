"""Subtipos de pista (véase implementation/netdoku_catalogo_reglas.md).

Cada pista lleva una plantilla con huecos (`slots`) para los elementos que
nombra (red, equipo, router, longitud de prefijo). Su texto inicial usa las
formas de la categoría Tablero; naming.py puede cambiarlo después sin tocar
`D` ni `A`.

Todas las pistas son unarias: cada una fija un conjunto de casillas
permitidas `D` para su paquete y, en el caso de `unique_adjacent_to_node`, un
conjunto de casillas anuladas `A` para los demás paquetes. La interacción entre
paquetes la pone solo la regla «una casilla, un paquete».
"""

from dataclasses import dataclass, field

from .board import side_neighbors

TOPIC = "T3.dispositivos"
KNOWLEDGE = "basic"


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

    def key(self):
        """Dos pistas con la misma clave dicen lo mismo a efectos lógicos."""
        return (self.packet, self.domain, self.excluded)


class Context:
    """Datos del nivel que necesitan las pistas."""

    def __init__(self, board, nodes, packets, addressing=None):
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


def _adjacent_to_router(ctx, p):
    for r in ctx.board.routers:
        cells = frozenset(c for c in r.between if c in ctx.free_cells)
        if p.cell in cells:
            a, b = (ctx.board.network(n).name for n in r.networks)
            yield Clue(p.id, "router.adjacent_to_router", {"routerId": r.id},
                       f"El paquete {p.id} estaba junto al router que une {a} y {b}.", cells,
                       template=f"El paquete {p.id} estaba junto al router {{router}}.",
                       slots={"router": ("router", r.id)})


def _in_row(ctx, p):
    r = p.cell[0]
    yield Clue(p.id, "spatial.in_row", {"row": r + 1},
               f"El paquete {p.id} estaba en la fila {r + 1}.",
               frozenset(c for c in ctx.free_cells if c[0] == r))


def _in_column(ctx, p):
    col = p.cell[1]
    yield Clue(p.id, "spatial.in_column", {"column": col + 1},
               f"El paquete {p.id} estaba en la columna {col + 1}.",
               frozenset(c for c in ctx.free_cells if c[1] == col))


SUBTYPES = {
    "network.in_network": _in_network,
    "network.prefix_length": _prefix_length,
    "node.adjacent_to_node": _adjacent_to_node,
    "node.unique_adjacent_to_node": _unique_adjacent_to_node,
    "router.adjacent_to_router": _adjacent_to_router,
    "spatial.in_row": _in_row,
    "spatial.in_column": _in_column,
}


def generate_instances(ctx, enabled=None, disabled=()):
    """Todas las pistas verdaderas de los subtipos activos, sin duplicados lógicos."""
    seen, result = set(), []
    for name, gen in SUBTYPES.items():
        if (enabled is not None and name not in enabled) or name in disabled:
            continue
        for p in ctx.packets:
            for clue in gen(ctx, p):
                assert p.cell in clue.domain, clue
                if clue.key() not in seen:
                    seen.add(clue.key())
                    result.append(clue)
    return result
