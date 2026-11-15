"""Nodos (equipos) y paquetes."""

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


def place_nodes(rng, board, min_free_ratio=0.4, client_prob=0.35):
    """Coloca entre 1 y 3 nodos por red.

    Restricciones: dos nodos no comparten lado; ningún nodo ocupa una casilla de
    apoyo de un router; las casillas libres de cada red siguen siendo conexas;
    cada nodo tiene al menos una casilla libre de su red al lado; y queda al
    menos `min_free_ratio` de casillas libres en cada red.
    """
    router_cells = {cell for r in board.routers for cell in r.between}
    nodes = []
    occupied = set()
    for net in board.networks:
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


def _weighted_sample(rng, cells, weights, k):
    cells, weights, chosen = list(cells), list(weights), []
    for _ in range(k):
        i = rng.choices(range(len(cells)), weights=weights)[0]
        chosen.append(cells.pop(i))
        weights.pop(i)
    return chosen


def place_packets(rng, board, nodes, count=6, near_node_weight=4.0):
    """Escenario same_network_attacker: la red de la víctima tiene exactamente
    dos paquetes (víctima y atacante); los demás van a otras redes.

    Las casillas junto a un nodo de su red pesan más, para que haya pistas de
    nodos con las que localizar los paquetes.
    """
    node_cells = {n.cell for n in nodes}
    near = {x for n in nodes for x in side_neighbors(n.cell, board.height, board.width)
            if board.network_of(x) == n.network and x not in node_cells}
    near |= {x for r in board.routers for x in r.between if x not in node_cells}

    def weight(cell):
        return near_node_weight if cell in near else 1.0

    free = {net.id: [c for c in net.cells if c not in node_cells] for net in board.networks}
    victim_net = rng.choice([nid for nid, cells in free.items() if len(cells) >= 2])
    victim_cell, attacker_cell = _weighted_sample(rng, free[victim_net],
                                                  [weight(c) for c in free[victim_net]], 2)
    others_pool = [c for nid, cells in free.items() if nid != victim_net for c in cells]
    if len(others_pool) < count - 2:
        raise RuntimeError("No hay casillas suficientes para los paquetes")
    other_cells = _weighted_sample(rng, others_pool, [weight(c) for c in others_pool], count - 2)

    roles = ["victim", "attacker"] + ["other"] * (count - 2)
    cells = [victim_cell, attacker_cell] + other_cells
    order = list(range(count))
    rng.shuffle(order)
    colors = rng.sample(PACKET_COLORS, count)
    packets = []
    for k, i in enumerate(order):
        name, hex_color = colors[k]
        packets.append(Packet(id=chr(ord("A") + k), color_name=name, color=hex_color,
                              cell=cells[i], role=roles[i]))
    return packets, victim_net
