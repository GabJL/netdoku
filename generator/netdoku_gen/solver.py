"""Resolución: dominios, propagación como la haría el jugador y recuento de soluciones.

Reglas globales: una casilla, un paquete, y como mucho un paquete por fila y por
columna. Si hay tantos paquetes como filas (o columnas), cada fila (o columna)
tiene exactamente uno.
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


def initial_domains(free_cells, packet_ids, clues):
    domains = {p: set(free_cells) for p in packet_ids}
    for clue in clues:
        domains[clue.packet] &= clue.domain
        if clue.excluded:
            for q in packet_ids:
                if q != clue.packet:
                    domains[q] -= clue.excluded
    return domains


def _remove(domains, keep, predicate):
    """Quita de los dominios de los paquetes que no están en `keep` las casillas
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


def propagate(domains, rules, exclude_from_subsets=()):
    """Aplica las deducciones del jugador hasta que no haya cambios.

    1. Colocación directa: si |D(p)| = 1, su casilla, su fila y su columna
       salen del dominio de los demás.
    2. Fila o columna obligada: si cada fila debe tener un paquete y solo uno
       puede ir en ella, ese paquete está en esa fila (ídem columnas).
    3. Reservas (subconjuntos desnudos): si N paquetes solo caben en N casillas,
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
            if len(d) == 1:
                (r, c), = d
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

        # 3. Reservas de casillas, filas y columnas.
        pending = [p for p, d in domains.items() if len(d) > 1 and p not in exclude_from_subsets]
        for k in range(2, rules.max_subset + 1):
            for combo in combinations(pending, k):
                cells = set().union(*(domains[p] for p in combo))
                for key in (lambda x: x, lambda x: x[0], lambda x: x[1]):
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


def uncertainty(domains, packets):
    return sum(log2(len(domains[p])) for p in packets if domains[p])


def count_solutions(domains, limit=2):
    """Asignaciones con un paquete por casilla, fila y columna, hasta `limit`."""
    order = sorted(domains, key=lambda p: len(domains[p]))
    rows, cols = set(), set()
    count = 0

    def search(i):
        nonlocal count
        if count >= limit:
            return
        if i == len(order):
            count += 1
            return
        for r, c in domains[order[i]]:
            if r not in rows and c not in cols:
                rows.add(r)
                cols.add(c)
                search(i + 1)
                rows.discard(r)
                cols.discard(c)

    search(0)
    return count
