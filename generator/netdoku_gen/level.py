"""Generación completa de un nivel y exportación a JSON (formato de levels/*.yaml)."""

import random
from dataclasses import replace

from .addressing import PLANS, Addressing
from .board import generate_board
from .content import and_word, place_nodes, place_packets
from .difficulty import evaluate
from .naming import (CATEGORIES, READING_TIERS, SIZE_FORMS, SIZE_NOTE, Namer, category_of, global_level,
                     max_topic, topic_index)
from .rules import KNOWLEDGE, Context, generate_instances, uncalculated
from .selection import Selector
from .solver import Rules, count_solutions, initial_domains, propagate

SCHEMA_VERSION = "0.2"
DEFAULTS = {
    "height": 6,
    "width": 6,
    "networks": 4,
    "minNetworkSize": 6,
    "packets": 6,
    "maxSubset": 4,
    "selectionRuns": 12,
    "enabledRuleSubtypes": None,   # None = todos
    "category": "inicial",         # inicial | direccionamiento
    "reading": None,               # dificultad de interpretación buscada (1-5); None = al azar
    "plan": "auto",                # addressing.plan
    "categoryFormRatio": "auto",   # clues.naming.categoryFormRatio
    "maxTopic": "T3.vlsm",         # level.maxTopic
    "nearBoundaryDistance": 4,     # addressing.nearBoundaryDistance
    "target": None,                # dificultad global buscada (1-5); None = la que salga
    "maxSpatial": None,            # máximo de pistas de fila o columna; None = sin límite
}

# Dificultad de interpretación con la que se busca cada dificultad global en
# Direccionamiento (peso de cada interpretación). La lógica se ajusta después eligiendo,
# entre varias selecciones de pistas, una cuya dificultad lógica encaje.
READING_FOR_TARGET = {
    1: {1: 1},
    2: {1: 1, 2: 2},
    3: {1: 0.5, 2: 1, 3: 2},
    4: {2: 0.5, 3: 1, 4: 2},
    5: {3: 0.5, 4: 1, 5: 2},
}

# Plan de direcciones según la dificultad de interpretación buscada (addressing.plan: auto).
AUTO_PLANS = {
    1: {"distinct": 1, "octet_subnets": 1, "bit_subnets": 1, "vlsm": 1},
    2: {"distinct": 1, "octet_subnets": 2},
    3: {"octet_subnets": 1, "bit_subnets": 3},
    4: {"bit_subnets": 1, "vlsm": 1},
    5: {"bit_subnets": 2, "vlsm": 3},
}


def one_based(cell):
    return [cell[0] + 1, cell[1] + 1]


def build(seed, config=None, max_attempts=200):
    cfg = {**DEFAULTS, **(config or {})}
    if cfg["category"] not in CATEGORIES:
        raise ValueError(f"Categoría desconocida: {cfg['category']}")
    rng = random.Random(seed)
    last_error = None
    for attempt in range(1, max_attempts + 1):
        try:
            return _attempt(rng, seed, cfg, attempt)
        except RuntimeError as e:
            last_error = e
    raise RuntimeError(f"No se ha generado ningún nivel en {max_attempts} intentos: {last_error}")


def _choose_plan(rng, cfg, reading):
    if cfg["plan"] != "auto":
        return cfg["plan"]
    if cfg["category"] == "inicial":
        weights = {p: 1 for p in PLANS}
    else:
        weights = dict(AUTO_PLANS[reading])
    if topic_index(cfg["maxTopic"]) < topic_index("T3.vlsm") and len(weights) > 1:
        weights.pop("vlsm", None)
    plans = list(weights)
    return rng.choices(plans, weights=[weights[p] for p in plans])[0]


def _attempt(rng, seed, cfg, attempt):
    category = cfg["category"]
    target = cfg["target"]
    if category == "inicial":
        reading = 1
    elif target:
        options = READING_FOR_TARGET[target]
        reading = rng.choices(list(options), weights=list(options.values()))[0]
    else:
        reading = cfg["reading"] or rng.choice([1, 2, 3, 4, 5])
    plan = _choose_plan(rng, cfg, reading)
    board = generate_board(rng, cfg["height"], cfg["width"], cfg["networks"], cfg["minNetworkSize"], plan)
    addressing = Addressing(plan, board.prefixes, cfg["nearBoundaryDistance"])
    nodes = place_nodes(rng, board)
    packets, victim_net = place_packets(rng, board, nodes, cfg["packets"])
    ctx = Context(board, nodes, packets, addressing)
    # network.prefix_length cuesta como mínimo 1: no cabe en Inicial ni en interpretación 1.
    disabled = {"network.prefix_length"} if category == "inicial" or reading == 1 else set()
    pool = generate_instances(ctx, cfg["enabledRuleSubtypes"], disabled)
    victim = next(p for p in packets if p.role == "victim")
    attacker = next(p for p in packets if p.role == "attacker")
    rules = Rules(board.height, board.width, len(packets), cfg["maxSubset"])
    selector = Selector(rng, ctx, pool, victim.id, rules)
    # Varias selecciones sobre el mismo tablero; se queda la que menos se apoya
    # en filas y columnas (y, sobre todo, en dar coordenadas).
    candidates = []
    for _ in range(cfg["selectionRuns"]):
        try:
            candidates.append(selector.select())
        except RuntimeError:
            pass
    if cfg["maxSpatial"] is not None:
        candidates = [c for c in candidates
                      if sum(1 for x in c if x.type.startswith("spatial.")) <= cfg["maxSpatial"]]
    if not candidates:
        raise RuntimeError("Las pistas disponibles no bastan para resolver el nivel")
    ids = [p.id for p in packets]
    if target:
        # Solo valen las selecciones cuya dificultad lógica da, con esta interpretación, la global buscada.
        fitting = [c for c in candidates
                   if global_level(evaluate(ctx.free_cells, ids, c, rules, victim.id)["logic"], reading) == target]
        if not fitting:
            raise RuntimeError(f"Ninguna selección de pistas tiene la dificultad {target}")
        candidates = fitting
    clues = min(candidates, key=_spatial_score)

    # Validación independiente: una única solución y que sea la generada.
    domains = initial_domains(ctx.free_cells, ids, clues)
    if count_solutions(domains, limit=2) != 1:
        raise RuntimeError("El nivel no tiene solución única")
    solved, max_subset = propagate(domains, rules, exclude_from_subsets={victim.id})
    if any(solved[p.id] != {p.cell} for p in packets):
        raise RuntimeError("La propagación no llega a la solución generada")
    in_victim_net = [p for p in packets if board.network_of(p.cell) == victim_net]
    if sorted(p.id for p in in_victim_net) != sorted([victim.id, attacker.id]):
        raise RuntimeError("La red de la víctima no tiene exactamente dos paquetes")

    report = evaluate(ctx.free_cells, ids, clues, rules, victim.id)

    # Formas de nombrar: después de la lógica, porque no cambian D ni A.
    namer = Namer(rng, board, nodes, addressing, cfg["maxTopic"])
    if category == "inicial":
        clues = namer.apply(clues, namer.plain(clues), {})
    else:
        ratio = cfg["categoryFormRatio"]
        ratio = rng.uniform(0.3, 0.7) if ratio == "auto" else float(ratio)
        needed = needed_calculations(ctx, clues, rules, ids, victim.id, report["logic"])
        assigned = namer.assign(clues, reading, ratio, needed)
        if assigned is None:
            raise RuntimeError(f"No se pueden nombrar las pistas con dificultad de interpretación {reading}")
        clues = namer.apply(clues, *assigned)
        if any(c.reading_cost and c.id not in needed for c in clues):
            raise RuntimeError("Una pista con coste de interpretación se resuelve sin hacer su cálculo")
    namer.assign_remaining(nodes, board.routers)
    topic = max_topic([c.topic for c in clues])
    if category_of(topic) != category:
        raise RuntimeError("Las pistas no corresponden a la categoría pedida")
    report["reading"] = reading
    report["readingCosts"] = [c.reading_cost for c in clues]
    report["global"] = global_level(report["logic"], reading)
    return to_dict(seed, attempt, board, nodes, packets, clues, victim, attacker, victim_net, max_subset, report,
                   addressing, category, topic)


def needed_calculations(ctx, clues, rules, ids, victim, logic):
    """Ids de las pistas cuyo cálculo es imprescindible.

    Se sustituye cada pista por lo que dice sin calcular (rules.uncalculated):
    si el nivel sigue resolviéndose con la misma lógica o una más sencilla, el
    cálculo es esquivable y la pista solo puede usar formas de coste 0.
    """
    needed = set()
    for i, clue in enumerate(clues):
        if not clue.slots:
            continue
        domain, excluded = uncalculated(ctx, clue)
        if (domain, excluded) == (clue.domain, clue.excluded):
            continue   # sin formas con coste (filas y columnas)
        trial = clues[:i] + [replace(clue, domain=domain, excluded=excluded)] + clues[i + 1:]
        solved, _ = propagate(initial_domains(ctx.free_cells, ids, trial), rules, exclude_from_subsets={victim})
        if solved is None or any(len(solved[p]) != 1 for p in ids):
            needed.add(clue.id)
            continue
        try:
            if evaluate(ctx.free_cells, ids, trial, rules, victim)["logic"] > logic:
                needed.add(clue.id)
        except RuntimeError:
            needed.add(clue.id)
    return needed


def _spatial_score(clues):
    spatial = [c.packet for c in clues if c.type.startswith("spatial.")]
    coordinates = len(spatial) - len(set(spatial))
    return len(spatial) + 4 * coordinates + 0.2 * len(clues)


def to_dict(seed, attempt, board, nodes, packets, clues, victim, attacker, victim_net, max_subset, report,
            addressing, category, topic):
    level_id = f"{category}-{seed}"
    by_type = {}
    for c in clues:
        by_type[c.type] = by_type.get(c.type, 0) + 1
    objective = ("Coloca los paquetes para descubrir al atacante. En cada fila y en cada columna hay "
                 f"como mucho un paquete. La víctima es el paquete {victim.id}: en su red solo había "
                 "otro paquete, el atacante.")
    if any(form in SIZE_FORMS for c in clues for form in c.naming.values()):
        objective += " " + SIZE_NOTE
    g = report["global"]
    return {
        "schemaVersion": SCHEMA_VERSION,
        "level": {
            "id": level_id,
            "name": f"Nivel generado {seed}",
            "language": "es",
            "category": category,
            "categoryName": CATEGORIES[category],
            "difficulty": {"global": g, "tier": READING_TIERS[g], "logic": report["logic"],
                           "reading": report["reading"], "knowledge": KNOWLEDGE},
            "scenario": "same_network_attacker",
            "seed": seed,
        },
        "requirements": {"topic": topic, "knowledge": KNOWLEDGE},
        "addressing": {"plan": addressing.plan},
        "board": {
            "width": board.width,
            "height": board.height,
            "coordinateSystem": {"origin": "top-left", "rowIndexStartsAt": 1, "columnIndexStartsAt": 1},
            "networkGrid": board.grid,
        },
        "rules": {"onePacketPerCell": True, "onePacketPerRow": True, "onePacketPerColumn": True},
        "networks": [
            {"id": n.id, "name": n.name, "nameKey": n.name_key, "prefix": n.prefix,
             "addresses": addressing.size(n.id),
             "cellCount": len(n.cells), "cells": [one_based(c) for c in n.cells]}
            for n in board.networks
        ],
        "routers": [
            {"id": r.id,
             "name": "Router de {} {} {}".format(board.network(r.networks[0]).name,
                                                 and_word(board.network(r.networks[1]).name),
                                                 board.network(r.networks[1]).name),
             "connectedNetworks": list(r.networks), "degree": 2,
             "interfaces": {net: str(addressing.assigned[("router", r.id, net)]) for net in r.networks},
             "position": {"kind": "edge", "between": [one_based(c) for c in r.between]},
             "orientation": "vertical" if r.between[0][0] == r.between[1][0] else "horizontal"}
            for r in board.routers
        ],
        "topology": {
            "bipartite": True,
            "connected": True,
            "networkNodes": [n.id for n in board.networks],
            "routerNodes": [r.id for r in board.routers],
            "edges": [[net, r.id] for r in board.routers for net in r.networks],
        },
        "nodes": [
            {"id": n.id, "type": n.type, **({"services": n.services} if n.services else {}),
             "label": n.label[0].upper() + n.label[1:], "network": n.network, "position": one_based(n.cell),
             "ip": str(addressing.assigned[("node", n.id)])}
            for n in nodes
        ],
        "packets": {
            "victimId": victim.id,
            "attackerId": attacker.id,
            "items": [
                {"id": p.id, "color": p.color, "colorName": p.color_name,
                 **({"role": p.role} if p.role != "other" else {}),
                 "solution": {"position": one_based(p.cell), "network": board.network_of(p.cell)}}
                for p in packets
            ],
        },
        "objective": {
            "type": "identify_attacker",
            "text": objective,
            "victimPacketId": victim.id,
            "packetsInVictimNetwork": 2,
            "observableAnswer": {"attackerPacketId": attacker.id},
        },
        "clues": [
            # `text` es el texto en español; el motor lo compone en cada idioma a partir
            # de `type`, `parameters` y `slots` (cómo se nombra cada elemento).
            # `domain` (D) y `excluded` (A, si la pista anula casillas) los usa el motor
            # para las sugerencias.
            {"id": c.id, "packet": c.packet, "type": c.type, "text": c.text, "parameters": c.params,
             "slots": c.slot_data, "naming": c.naming, "readingCost": c.reading_cost, "topic": c.topic,
             "domain": sorted(one_based(x) for x in c.domain),
             **({"excluded": sorted(one_based(x) for x in c.excluded)} if c.excluded else {})}
            for c in clues
        ],
        "solution": {
            "placements": {p.id: one_based(p.cell) for p in packets},
            "victimNetwork": victim_net,
            "attackerPacketId": attacker.id,
        },
        "generation": {
            "generator": "netdoku_gen v0.3.5",
            "attempt": attempt,
            "clueCount": len(clues),
            "cluesByType": by_type,
            "maxReservationSize": max_subset,
            "difficulty": report,
        },
    }
