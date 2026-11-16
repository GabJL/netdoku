"""Resolución: dominios, propagación como la haría el jugador y recuento de soluciones.

Reglas globales: una casilla, un paquete, y como mucho un paquete por fila y por
columna. Si hay tantos paquetes como filas (o columnas), cada fila (o columna)
tiene exactamente uno.

Las posibilidades de un paquete son casillas `(f, c)` o, si su origen o su
destino está oculto (Encaminamiento), estados `(f, c, red)`: la casilla y la
red del extremo oculto, de la que depende su ruta. Un paquete está colocado
cuando todas sus posibilidades están en la misma casilla, y resuelto cuando le
queda una sola. Las pistas entre dos paquetes (`Relation`) dan un valor a cada
posibilidad de cada paquete y los pares de valores que las hacen verdaderas.
"""

from dataclasses import dataclass
from itertools import combinations
from math import log2


@dataclass(frozen=True)
class Rules:
    height: int
    width: int
    packets: int
    max_subset: int = 4

    @property
    def full_rows(self):
        return self.packets == self.height

    @property
    def full_columns(self):
        return self.packets == self.width


@dataclass(frozen=True, eq=False)
class Relation:
    """Pista entre dos paquetes: valor de cada posibilidad y pares permitidos."""
    first: dict          # posibilidad del primer paquete -> valor
    second: dict         # posibilidad del segundo paquete -> valor
    allowed: frozenset   # pares (valor del primero, valor del segundo) que hacen verdadera la pista

    def drop(self, target, source, target_first):
        """Posibilidades de `target` sin pareja entre las de `source`, y cuántos valores tiene `source`."""
        if target_first:
            values = {self.second[y] for y in source}
            ok = {a for a, b in self.allowed if b in values}
            return {x for x in target if self.first[x] not in ok}, len(values)
        values = {self.first[y] for y in source}
        ok = {b for a, b in self.allowed if a in values}
        return {x for x in target if self.second[x] not in ok}, len(values)


def cell_of(x):
    """Casilla de una posibilidad (una casilla o un estado)."""
    return x if len(x) == 2 else x[:2]


def placed_cell(d):
    """La casilla del paquete si todas sus posibilidades están en ella; si no, None."""
    if not d:
        return None
    it = iter(d)
    first = next(it)
    r, c = first[0], first[1]
    for x in it:
        if x[0] != r or x[1] != c:
            return None
    return (r, c)


def relations_of(clues):
    """(primer paquete, segundo paquete, relación) de las pistas entre dos paquetes."""
    return [(c.packet, c.other, c.relation) for c in clues if c.other]


def start_cells(base, p):
    """Posibilidades de partida de un paquete: `base` es un conjunto común o un diccionario por paquete
    (en Encaminamiento, las casillas de su ruta a las que le llega el TTL)."""
    return base[p] if isinstance(base, dict) else base


def drop_cells(d, cells):
    """Quita de `d` las posibilidades que están en alguna de las casillas `cells`."""
    d -= {x for x in d if cell_of(x) in cells}


def initial_domains(base, packet_ids, clues):
    domains = {p: set(start_cells(base, p)) for p in packet_ids}
    for clue in clues:
        if clue.other:
            continue   # las pistas entre dos paquetes se aplican al propagar
        domains[clue.packet] &= clue.domain
        if clue.excluded:
            for q in packet_ids:
                if q != clue.packet:
                    drop_cells(domains[q], clue.excluded)
    return domains


def _remove(domains, keep, predicate):
    """Quita de los dominios de los paquetes que no están en `keep` las posibilidades
    que cumplen `predicate`. Devuelve True si cambia algo."""
    changed = False
    for q, d in domains.items():
        if q in keep:
            continue
        drop = {c for c in d if predicate(c)}
        if drop:
            d -= drop
            changed = True
    return changed


KEYS = (cell_of, lambda x: x[0], lambda x: x[1])


def propagate(domains, rules, exclude_from_subsets=(), relations=()):
    """Aplica las deducciones del jugador hasta que no haya cambios.

    1. Colocación directa: si un paquete solo cabe en una casilla, esa casilla,
       su fila y su columna salen del dominio de los demás.
    2. Fila o columna obligada: si cada fila debe tener un paquete y solo uno
       puede ir en ella, ese paquete está en esa fila (ídem columnas).
    3. Pistas entre dos paquetes: se quitan las posibilidades de cada uno cuyo
       valor no casa con ninguno de los que le quedan al otro.
    4. Reservas (subconjuntos desnudos): si N paquetes solo caben en N casillas,
       N filas o N columnas, esas casillas, filas o columnas salen del dominio
       de los demás.

    Devuelve (dominios, tamaño máximo de reserva usado) o (None, _) si hay
    contradicción. Los paquetes de `exclude_from_subsets` (la víctima) no
    forman parte de reservas.
    """
    domains = {p: set(d) for p, d in domains.items()}
    max_used = 0
    while True:
        if any(not d for d in domains.values()):
            return None, max_used

        # 1. Colocaciones directas.
        changed = False
        for p, d in domains.items():
            cell = placed_cell(d)
            if cell:
                r, c = cell
                changed |= _remove(domains, {p}, lambda x: x[0] == r or x[1] == c)
        if changed:
            continue

        # 2. Filas y columnas obligadas.
        for axis, full, size in ((0, rules.full_rows, rules.height), (1, rules.full_columns, rules.width)):
            if not full:
                continue
            for line in range(size):
                holders = [p for p, d in domains.items() if any(x[axis] == line for x in d)]
                if not holders:
                    return None, max_used
                if len(holders) == 1:
                    d = domains[holders[0]]
                    if any(x[axis] != line for x in d):
                        domains[holders[0]] = {x for x in d if x[axis] == line}
                        changed = True
        if changed:
            continue

        # 3. Pistas entre dos paquetes.
        for m, n, rel in relations:
            drop_m, _ = rel.drop(domains[m], domains[n], True)
            drop_n, _ = rel.drop(domains[n], domains[m], False)
            if drop_m or drop_n:
                domains[m] -= drop_m
                domains[n] -= drop_n
                changed = True
        if changed:
            continue

        # 4. Reservas de casillas, filas y columnas.
        pending = [p for p, d in domains.items() if placed_cell(d) is None and p not in exclude_from_subsets]
        for k in range(2, rules.max_subset + 1):
            for combo in combinations(pending, k):
                cells = set().union(*(domains[p] for p in combo))
                for key in KEYS:
                    used = {key(x) for x in cells}
                    if len(used) < k:
                        return None, max_used
                    if len(used) == k and _remove(domains, set(combo), lambda x: key(x) in used):
                        changed = True
                        max_used = max(max_used, k)
                        break
                if changed:
                    break
            if changed:
                break
        if not changed:
            return domains, max_used


def solved(domains, packets=None):
    """Cada paquete (de `packets`, o todos) tiene una sola posibilidad."""
    return domains is not None and all(len(domains[p]) == 1 for p in (packets or domains))


def uncertainty(domains, packets):
    return sum(log2(len(domains[p])) for p in packets if domains[p])


def count_solutions(domains, limit=2, relations=()):
    """Asignaciones con un paquete por casilla, fila y columna que cumplen las pistas entre
    dos paquetes, hasta `limit`. Dos estados de la misma casilla son soluciones distintas."""
    order = sorted(domains, key=lambda p: len(domains[p]))
    links = {p: [] for p in domains}
    for m, n, rel in relations:
        links[m].append((n, rel, True))
        links[n].append((m, rel, False))
    rows, cols, chosen = set(), set(), {}
    count = 0

    def fits(p, x):
        for q, rel, first in links[p]:
            if q in chosen:
                pair = (rel.first[x], rel.second[chosen[q]]) if first else (rel.first[chosen[q]], rel.second[x])
                if pair not in rel.allowed:
                    return False
        return True

    def search(i):
        nonlocal count
        if count >= limit:
            return
        if i == len(order):
            count += 1
            return
        p = order[i]
        for x in domains[p]:
            r, c = x[0], x[1]
            if r in rows or c in cols or not fits(p, x):
                continue
            rows.add(r)
            cols.add(c)
            chosen[p] = x
            search(i + 1)
            del chosen[p]
            rows.discard(r)
            cols.discard(c)

    search(0)
    return count
