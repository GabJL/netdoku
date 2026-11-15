"""Resolución: dominios, propagación como la haría el jugador y recuento de soluciones."""

from itertools import combinations
from math import log2


def initial_domains(free_cells, packet_ids, clues):
    domains = {p: set(free_cells) for p in packet_ids}
    for clue in clues:
        domains[clue.packet] &= clue.domain
        if clue.excluded:
            for q in packet_ids:
                if q != clue.packet:
                    domains[q] -= clue.excluded
    return domains


def propagate(domains, max_subset=4, exclude_from_subsets=()):
    """Aplica las deducciones del jugador hasta que no haya cambios.

    1. Colocación directa: si |D(p)| = 1, esa casilla sale del dominio de los demás.
    2. Reserva (subconjunto desnudo): si N paquetes solo caben en N casillas,
       esas casillas salen del dominio de los demás.

    Devuelve (dominios, tamaño máximo de reserva usado) o (None, _) si hay
    contradicción. Los paquetes de `exclude_from_subsets` (la víctima) no forman
    parte de reservas.
    """
    domains = {p: set(d) for p, d in domains.items()}
    max_used = 0
    changed = True
    while changed:
        changed = False
        for p, d in domains.items():
            if not d:
                return None, max_used
            if len(d) == 1:
                cell = next(iter(d))
                for q, e in domains.items():
                    if q != p and cell in e:
                        e.discard(cell)
                        changed = True
        if changed:
            continue
        pending = [p for p, d in domains.items() if len(d) > 1 and p not in exclude_from_subsets]
        for k in range(2, max_subset + 1):
            for combo in combinations(pending, k):
                union = set().union(*(domains[p] for p in combo))
                if len(union) < k:
                    return None, max_used
                if len(union) == k:
                    for q, e in domains.items():
                        if q not in combo and e & union:
                            e -= union
                            changed = True
                    if changed:
                        max_used = max(max_used, k)
                        break
            if changed:
                break
    return domains, max_used


def uncertainty(domains, packets):
    return sum(log2(len(domains[p])) for p in packets if domains[p])


def count_solutions(domains, limit=2):
    """Número de asignaciones con un paquete por casilla, hasta `limit`."""
    order = sorted(domains, key=lambda p: len(domains[p]))
    used = set()
    count = 0

    def search(i):
        nonlocal count
        if count >= limit:
            return
        if i == len(order):
            count += 1
            return
        for cell in domains[order[i]]:
            if cell not in used:
                used.add(cell)
                search(i + 1)
                used.discard(cell)

    search(0)
    return count
