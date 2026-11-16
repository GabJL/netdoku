"""Evaluación de la dificultad lógica de un nivel.

Se simula a un jugador que, en cada paso, busca todas las deducciones que le
hacen avanzar y aplica una de la técnica más sencilla. Como las deducciones
son monótonas (aplicar una nunca impide otra), este orden «la más sencilla
primero» es la secuencia válida más sencilla (`easiest_valid_order`): la
técnica más difícil que aparece en él no se puede evitar con otro orden.

Técnicas, de más sencilla a más difícil (su nivel es el número):

1. Colocación directa: un paquete solo cabe en una casilla; se coloca y su
   fila y su columna quedan descartadas para los demás.
2. Fila o columna obligada: solo un paquete puede ir en una fila (o columna)
   que debe tener uno.
2. Anulación: una pista del tipo «… y ningún otro paquete lo estaba» descarta
   casillas para los demás paquetes.
1. Relación con un valor fijo: a un paquete de una pista entre dos paquetes
   le queda un solo valor (está colocado o todas sus casillas dan el mismo),
   y la pista se usa como una unaria para el otro.
3. Relación entre valores abiertos: la pista descarta casillas de un paquete
   teniendo en cuenta todos los valores que le quedan al otro.
3. Reserva de 2: dos paquetes solo caben en dos casillas, filas o columnas.
4. Reserva de 3.
5. Reserva de 4.

Además de la técnica más difícil se mide cuántas deducciones tenía disponibles
el jugador en cada paso: si en algún momento solo hay un camino y no es una
colocación directa, el nivel se atasca ahí (cuello de botella).

Con un extremo oculto, un paquete se coloca cuando todos sus estados están en
la misma casilla; la resolución acaba cuando a cada paquete le queda uno solo.
"""

from dataclasses import dataclass
from itertools import combinations

from .solver import cell_of, placed_cell, start_cells

TECHNIQUES = {
    "single": ("Colocación directa", 1),
    "line": ("Fila o columna obligada", 2),
    "annul": ("Anulación", 2),
    "relfixed": ("Relación con un valor fijo", 1),
    "relopen": ("Relación entre valores abiertos", 3),
    "subset2": ("Reserva de 2", 3),
    "subset3": ("Reserva de 3", 4),
    "subset4": ("Reserva de 4", 5),
}

TIERS = {1: "Muy fácil", 2: "Fácil", 3: "Media", 4: "Difícil", 5: "Muy difícil"}


@dataclass
class Step:
    technique: str
    level: int
    options: int        # deducciones disponibles en este paso (de cualquier técnica)
    cheapest: int       # cuántas había de la técnica más sencilla
    placed: int         # paquetes colocados tras el paso


def _options(domains, placed, applied_annuls, clues, rules, victim):
    """Todas las deducciones que hacen avanzar, como (técnica, aplicar)."""
    found = []

    # 1. Colocaciones directas.
    for p, d in domains.items():
        if p not in placed and placed_cell(d):
            def place(p=p):
                r, c = placed_cell(domains[p])
                placed.add(p)
                for q, dq in domains.items():
                    if q != p:
                        dq -= {x for x in dq if x[0] == r or x[1] == c}
            found.append(("single", place))

    # 2. Filas y columnas obligadas.
    for axis, full, size in ((0, rules.full_rows, rules.height), (1, rules.full_columns, rules.width)):
        if not full:
            continue
        for line in range(size):
            holders = [p for p, d in domains.items() if any(x[axis] == line for x in d)]
            if len(holders) == 1 and any(x[axis] != line for x in domains[holders[0]]):
                def force(p=holders[0], axis=axis, line=line):
                    domains[p] -= {x for x in domains[p] if x[axis] != line}
                found.append(("line", force))

    # 2. Anulaciones de las pistas «ningún otro paquete».
    for clue in clues:
        if not clue.excluded or clue.id in applied_annuls:
            continue
        if any(q != clue.packet and any(cell_of(x) in clue.excluded for x in d) for q, d in domains.items()):
            def annul(clue=clue):
                applied_annuls.add(clue.id)
                for q, d in domains.items():
                    if q != clue.packet:
                        d -= {x for x in d if cell_of(x) in clue.excluded}
            found.append(("annul", annul))
        else:
            applied_annuls.add(clue.id)

    # 1 y 3. Pistas entre dos paquetes, en cada sentido.
    for clue in clues:
        if not clue.other:
            continue
        for target, source, first in ((clue.packet, clue.other, True), (clue.other, clue.packet, False)):
            drop, values = clue.relation.drop(domains[target], domains[source], first)
            if drop:
                def relate(target=target, drop=drop):
                    domains[target] -= drop
                found.append(("relfixed" if values == 1 else "relopen", relate))

    # 3-5. Reservas de casillas, filas y columnas (sin la víctima, como en el solver).
    pending = [p for p, d in domains.items() if placed_cell(d) is None and p != victim]
    for k in range(2, rules.max_subset + 1):
        for combo in combinations(pending, k):
            cells = set().union(*(domains[p] for p in combo))
            for key in (cell_of, lambda x: x[0], lambda x: x[1]):
                used = {key(x) for x in cells}
                if len(used) != k:
                    continue
                if any(q not in combo and any(key(x) in used for x in d) for q, d in domains.items()):
                    def reserve(combo=combo, key=key, used=used):
                        for q, d in domains.items():
                            if q not in combo:
                                d -= {x for x in d if key(x) in used}
                    found.append((f"subset{k}", reserve))
    return found


def evaluate(base, packet_ids, clues, rules, victim):
    """Recorre la resolución más sencilla y devuelve el informe de dificultad."""
    domains = {p: set(start_cells(base, p)) for p in packet_ids}
    for clue in clues:
        if not clue.other:
            domains[clue.packet] &= clue.domain
    placed, applied_annuls = set(), set()
    steps = []
    while len(placed) < len(packet_ids) or any(len(d) > 1 for d in domains.values()):
        options = _options(domains, placed, applied_annuls, clues, rules, victim)
        if not options:
            raise RuntimeError("La resolución se atasca: el nivel necesita una técnica no modelada")
        level = min(TECHNIQUES[t][1] for t, _ in options)
        cheapest = [(t, f) for t, f in options if TECHNIQUES[t][1] == level]
        technique, apply = cheapest[0]
        apply()
        steps.append(Step(technique, level, len(options), len(cheapest), len(placed)))
    return summarize(steps)


def summarize(steps):
    max_level = max(s.level for s in steps)
    counts = {}
    for s in steps:
        counts[s.technique] = counts.get(s.technique, 0) + 1
    # Cuello de botella: un único camino posible y no es una colocación directa.
    bottlenecks = sum(1 for s in steps if s.options == 1 and s.level > 1)
    advanced = sum(1 for s in steps if s.level > 1)
    logic = min(5, max_level + (1 if bottlenecks >= 2 or (bottlenecks and advanced >= 4) else 0))
    return {
        "logic": logic,
        "tier": TIERS[logic],
        "hardestTechnique": TECHNIQUES[max(steps, key=lambda s: s.level).technique][0],
        "steps": len(steps),
        "advancedSteps": advanced,
        "bottlenecks": bottlenecks,
        "techniqueCounts": counts,
        "minOptions": min(s.options for s in steps),
        "trace": [[s.technique, s.options] for s in steps],
    }
