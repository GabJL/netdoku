"""Tablero: redes (regiones conexas de casillas) y routers en sus fronteras.

Coordenadas internas (fila, columna) con origen 0; se pasan a base 1 al exportar.
"""

from dataclasses import dataclass, field

from .addressing import make_prefixes

# Clave de cada nombre de red (la usa el motor para traducirlo) y nombre en español.
NETWORK_NAMES = {
    "admin": "Administración", "services": "Servicios", "lab": "Laboratorio", "dev": "Desarrollo",
    "management": "Dirección", "classrooms": "Aulas", "library": "Biblioteca", "guests": "Invitados",
    "office": "Secretaría", "research": "Investigación",
}


def side_neighbors(cell, height, width):
    r, c = cell
    for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        nr, nc = r + dr, c + dc
        if 0 <= nr < height and 0 <= nc < width:
            yield (nr, nc)


@dataclass
class Network:
    id: str
    name: str
    prefix: str
    cells: list
    name_key: str = ""


@dataclass
class Router:
    id: str
    networks: tuple  # identificadores de las redes que une
    between: tuple   # dos casillas, una de cada red, que comparten lado


@dataclass
class Board:
    height: int
    width: int
    grid: list                       # grid[r][c] -> id de red
    networks: list
    routers: list = field(default_factory=list)

    def network_of(self, cell):
        return self.grid[cell[0]][cell[1]]

    def network(self, net_id):
        return next(n for n in self.networks if n.id == net_id)


def grow_regions(rng, height, width, count, min_size, max_tries=500):
    """Reparte el tablero en `count` regiones conexas de al menos `min_size` casillas.

    Cada región crece desde una semilla. En cada paso crece una de las regiones
    más pequeñas (con algo de azar) y prefiere casillas con más vecinos de la
    propia región, para que las formas salgan compactas.
    """
    all_cells = [(r, c) for r in range(height) for c in range(width)]
    for _ in range(max_tries):
        grid = [[None] * width for _ in range(height)]
        seeds = rng.sample(all_cells, count)
        if any(abs(a[0] - b[0]) + abs(a[1] - b[1]) < 3
               for i, a in enumerate(seeds) for b in seeds[i + 1:]):
            continue
        regions = [[s] for s in seeds]
        for i, (r, c) in enumerate(seeds):
            grid[r][c] = i
        remaining = height * width - count
        stuck = False
        while remaining:
            order = sorted(range(count), key=lambda i: len(regions[i]) + rng.random() * 3)
            for i in order:
                frontier = {}
                for cell in regions[i]:
                    for n in side_neighbors(cell, height, width):
                        if grid[n[0]][n[1]] is None:
                            same = sum(1 for m in side_neighbors(n, height, width)
                                       if grid[m[0]][m[1]] == i)
                            frontier[n] = same
                if frontier:
                    break
            else:
                stuck = True
                break
            cells = list(frontier)
            weights = [frontier[x] ** 2 for x in cells]
            cell = rng.choices(cells, weights=weights)[0]
            grid[cell[0]][cell[1]] = i
            regions[i].append(cell)
            remaining -= 1
        if stuck or any(len(r) < min_size for r in regions):
            continue
        return grid, regions
    raise RuntimeError("No se ha podido repartir el tablero en redes válidas")


def place_routers(rng, board, extra_router_prob=0.3):
    """Routers de grado 2 sobre la frontera entre dos redes vecinas.

    Primero un árbol generador aleatorio (conexidad garantizada) y después, con
    cierta probabilidad, un router más que cierra un ciclo. Dos routers no
    comparten casilla de apoyo.
    """
    h, w = board.height, board.width
    boundary = {}  # (redA, redB) -> lista de (casillaA, casillaB)
    for r in range(h):
        for c in range(w):
            for n in ((r, c + 1), (r + 1, c)):
                if n[0] < h and n[1] < w:
                    a, b = board.grid[r][c], board.grid[n[0]][n[1]]
                    if a != b:
                        key = tuple(sorted((a, b)))
                        pair = ((r, c), n) if a == key[0] else (n, (r, c))
                        boundary.setdefault(key, []).append(pair)

    pairs = list(boundary)
    rng.shuffle(pairs)
    parent = {n.id: n.id for n in board.networks}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    chosen = []
    for a, b in pairs:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb
            chosen.append((a, b))
    leftovers = [p for p in pairs if p not in chosen]
    if leftovers and rng.random() < extra_router_prob:
        chosen.append(rng.choice(leftovers))

    used_cells = set()
    routers = []
    for a, b in chosen:
        options = [e for e in boundary[(a, b)] if not (set(e) & used_cells)]
        if not options:
            raise RuntimeError("No hay sitio para un router")
        edge = rng.choice(options)
        used_cells.update(edge)
        routers.append(Router(id=f"R{len(routers) + 1}", networks=(a, b), between=edge))
    return routers


def generate_board(rng, height=6, width=6, network_count=4, min_size=6, plan="octet_subnets"):
    """Tablero con sus redes y routers. `board.prefixes` guarda los prefijos como IPv4Network."""
    grid_idx, regions = grow_regions(rng, height, width, network_count, min_size)
    keys = rng.sample(list(NETWORK_NAMES), network_count)
    prefixes = make_prefixes(rng, network_count, plan)
    # Identificadores por orden de lectura para que sean predecibles en el tablero.
    order = sorted(range(network_count), key=lambda i: min(regions[i]))
    ids = {old: f"net{new + 1}" for new, old in enumerate(order)}
    networks = [Network(id=ids[i], name=NETWORK_NAMES[keys[k]], prefix=str(prefixes[k]), cells=sorted(regions[i]),
                        name_key=keys[k])
                for k, i in enumerate(order)]
    grid = [[ids[v] for v in row] for row in grid_idx]
    board = Board(height=height, width=width, grid=grid, networks=networks)
    board.prefixes = {ids[i]: prefixes[k] for k, i in enumerate(order)}
    board.routers = place_routers(rng, board)
    return board
