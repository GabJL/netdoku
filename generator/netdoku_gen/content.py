"""Nodos (equipos) y paquetes."""

import re
from collections import deque
from dataclasses import dataclass

from .board import side_neighbors

SERVICE_LABELS = {
    "web": "servidor web",
    "dns": "servidor DNS",
    "mail": "servidor de correo",
    "storage": "servidor de ficheros",
}
CLIENT_LABEL = "equipo de usuario"

PACKET_COLORS = [
    ("rojo", "#d64545"), ("azul", "#3b6fd6"), ("verde", "#2e9e5b"),
    ("naranja", "#e08a1e"), ("morado", "#8a4fd0"), ("rosa", "#d6519b"),
    ("turquesa", "#1fa3a3"), ("marrón", "#8a5a33"),
]


@dataclass
class Node:
    id: str
    type: str          # client | server
    services: list
    network: str
    cell: tuple

    @property
    def label(self):
        return CLIENT_LABEL if self.type == "client" else SERVICE_LABELS[self.services[0]]


COUNT_WORDS = {2: "dos", 3: "tres"}


def and_word(following):
    """«y» pasa a «e» ante el sonido «i» (Aulas e Investigación), como en el motor."""
    return "e" if re.match(r"h?[iíIÍ](?![aeiouáéó])", following) else "y"


def join_names(names):
    """«Aulas y Servicios», «Aulas, Servicios e Investigación»."""
    names = list(names)
    if len(names) == 1:
        return names[0]
    return ", ".join(names[:-1]) + f" {and_word(names[-1])} {names[-1]}"


def node_classes(nodes):
    """Clases de equipo del nivel: equipos de usuario, servidores y servidores de cada servicio."""
    classes = []
    if any(n.type == "client" for n in nodes):
        classes.append({"nodeType": "client"})
    if any(n.type == "server" for n in nodes):
        classes.append({"nodeType": "server"})
    for service in SERVICE_LABELS:
        if any(service in n.services for n in nodes):
            classes.append({"nodeType": "server", "service": service})
    return classes


def class_members(nodes, params):
    return [n for n in nodes if n.type == params["nodeType"]
            and ("service" not in params or params["service"] in n.services)]


def class_label(params, plural=False):
    """«equipo de usuario», «servidor», «servidor web»… (o su plural)."""
    if params["nodeType"] == "client":
        return "equipos de usuario" if plural else CLIENT_LABEL
    label = SERVICE_LABELS[params["service"]] if "service" in params else "servidor"
    return label.replace("servidor", "servidores", 1) if plural else label


def count_text(params, count):
    """Cómo describe una red el número exacto de equipos de una clase (de 0 a 3)."""
    if count == 0:
        return f"sin {class_label(params, True)}"
    if count == 1:
        return f"con un solo {class_label(params)}"
    return f"con exactamente {COUNT_WORDS[count]} {class_label(params, True)}"


def network_counts(nodes, networks, params):
    """Número de equipos de la clase en cada red."""
    members = class_members(nodes, params)
    return {net.id: sum(1 for n in members if n.network == net.id) for net in networks}


@dataclass
class Packet:
    id: str
    color_name: str
    color: str
    cell: tuple
    role: str = "other"   # victim | attacker | other


def _connected(cells):
    cells = set(cells)
    if not cells:
        return True
    start = next(iter(cells))
    seen, queue = {start}, deque([start])
    while queue:
        r, c = queue.popleft()
        for n in ((r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)):
            if n in cells and n not in seen:
                seen.add(n)
                queue.append(n)
    return len(seen) == len(cells)


def place_nodes(rng, board, min_free_ratio=0.4, client_prob=0.35, empty=()):
    """Coloca entre 1 y 3 nodos por red (ninguno en las redes de `empty`, las de tránsito).

    Restricciones: dos nodos no comparten lado; ningún nodo ocupa una casilla de
    apoyo de un router; las casillas libres de cada red siguen siendo conexas;
    cada nodo tiene al menos una casilla libre de su red al lado; y queda al
    menos `min_free_ratio` de casillas libres en cada red.
    """
    router_cells = {cell for r in board.routers for cell in r.between}
    nodes = []
    occupied = set()
    for net in board.networks:
        if net.id in empty:
            continue
        size = len(net.cells)
        wanted = rng.randint(min(2, max(1, size // 4)), max(1, min(3, size // 4)))
        placed = 0
        candidates = [c for c in net.cells if c not in router_cells]
        rng.shuffle(candidates)
        for cell in candidates:
            if placed == wanted:
                break
            if any(n in occupied for n in side_neighbors(cell, board.height, board.width)):
                continue
            free = [c for c in net.cells if c not in occupied and c != cell]
            if len(free) < min_free_ratio * size or not _connected(free):
                continue
            net_nodes = [n.cell for n in nodes if n.network == net.id] + [cell]
            free_set = set(free)
            if not all(any(m in free_set for m in side_neighbors(x, board.height, board.width))
                       for x in net_nodes):
                continue
            if rng.random() < client_prob:
                node = Node(id="", type="client", services=[], network=net.id, cell=cell)
            else:
                service = rng.choice(list(SERVICE_LABELS))
                node = Node(id="", type="server", services=[service], network=net.id, cell=cell)
            nodes.append(node)
            occupied.add(cell)
            placed += 1
        if placed == 0:
            raise RuntimeError(f"No se ha podido colocar ningún nodo en {net.id}")
    nodes.sort(key=lambda n: n.cell)
    for i, n in enumerate(nodes, 1):
        n.id = f"N{i}"
    return nodes


def place_packets(rng, board, nodes, count=6, near_node_weight=4.0):
    """Coloca los paquetes con como mucho uno por fila y por columna.

    Escenario same_network_attacker: la víctima está en una red con
    exactamente dos paquetes (víctima y atacante).

    Las casillas junto a un nodo de su red pesan más, para que haya pistas de
    nodos con las que localizar los paquetes.
    """
    node_cells = {n.cell for n in nodes}
    near = {x for n in nodes for x in side_neighbors(n.cell, board.height, board.width)
            if board.network_of(x) == n.network and x not in node_cells}
    near |= {x for r in board.routers for x in r.between if x not in node_cells}

    def weight(cell):
        return near_node_weight if cell in near else 1.0

    if count > min(board.height, board.width):
        raise ValueError("Con un paquete por fila y columna no caben tantos paquetes")
    cells = None
    for _ in range(500):
        # Un paquete por fila y por columna: se recorren filas al azar y se
        # elige una columna libre en cada una.
        rows = rng.sample(range(board.height), count)
        used_cols, chosen = set(), []
        for r in rows:
            options = [(r, c) for c in range(board.width) if c not in used_cols and (r, c) not in node_cells]
            if not options:
                break
            cell = rng.choices(options, weights=[weight(x) for x in options])[0]
            chosen.append(cell)
            used_cols.add(cell[1])
        if len(chosen) != count:
            continue
        per_net = {}
        for cell in chosen:
            per_net.setdefault(board.network_of(cell), []).append(cell)
        pairs = [nid for nid, cs in per_net.items() if len(cs) == 2]
        if pairs:
            victim_net = rng.choice(pairs)
            victim_cell, attacker_cell = rng.sample(per_net[victim_net], 2)
            other_cells = [c for c in chosen if c not in (victim_cell, attacker_cell)]
            cells = [victim_cell, attacker_cell] + other_cells
            break
    if cells is None:
        raise RuntimeError("No se han podido colocar los paquetes")

    roles = ["victim", "attacker"] + ["other"] * (count - 2)
    order = list(range(count))
    rng.shuffle(order)
    colors = rng.sample(PACKET_COLORS, count)
    packets = []
    for k, i in enumerate(order):
        name, hex_color = colors[k]
        packets.append(Packet(id=chr(ord("A") + k), color_name=name, color=hex_color,
                              cell=cells[i], role=roles[i]))
    return packets, victim_net
