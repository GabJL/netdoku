"""Generación completa de un nivel y exportación a JSON (formato de levels/*.yaml)."""

import random
from dataclasses import replace

from .addressing import PLANS, PRIVACY_PLANS, Addressing
from .board import generate_board
from .content import join_names, place_nodes, place_packets
from .difficulty import evaluate
from .naming import (CATEGORIES, READING_TIERS, SIZE_FORMS, SIZE_NOTE, Namer, category_of, global_level,
                     max_topic, topic_index)
from .routes import assign_routes, choose_hidden, choose_transit
from .rules import HIDDEN_TYPES, KNOWLEDGE, ROUTE_FAMILIES, Context, generate_instances, uncalculated
from .selection import Selector
from .solver import Rules, count_solutions, initial_domains, propagate, relations_of, solved

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
    "routes": False,               # features.routes/ttl: origen, destino, ruta y TTL de cada paquete
    "transitProbability": 0.5,     # probabilidad de una red de tránsito (nodes.emptyNetworks.max = 1)
    "broadcastProbability": 0.3,   # endpoints.broadcastPackets.probability
    "shortRatio": None,            # ttl.shortRatio; None = auto (0,15-0,3)
    "categoryMinClues": 0,         # clues.categoryMinClues
    "maxRelations": 2,             # clues.relations.max
    "cornerRouters": 0,            # routers.cornerRouters.max (0 = solo routers de dos redes)
    "degreeWeights": {2: 0.75, 3: 0.20, 4: 0.05},   # routers.degree.weights
    "hiddenProbability": 0.0,      # endpoints.hidden.probability
    "hiddenMax": 2,                # endpoints.hidden.max
    "privacyProbability": 0.0,     # addressing.privacyMix.probability
    "novelties": False,            # --novelties: al menos una novedad de la v0.4.5 de su categoría
}

# Valores que cambia cada categoría (categoryProfiles en la configuración global).
# `networks` puede ser una lista: se elige una en cada intento.
CATEGORY_PROFILES = {
    "direccionamiento": {"maxTopic": "T3.nat", "privacyProbability": 0.7},
    "encaminamiento": {"height": 7, "width": 7, "networks": [5, 6], "packets": 7, "routes": True,
                       "categoryMinClues": 3, "cornerRouters": 2, "hiddenProbability": 0.5},
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


def one_based(x):
    """Casilla (o estado, con la red del extremo oculto) con índices desde 1."""
    return [x[0] + 1, x[1] + 1, *x[2:]]


def build(seed, config=None, max_attempts=200):
    config = {k: v for k, v in (config or {}).items() if v is not None}
    category = config.get("category", DEFAULTS["category"])
    if category not in CATEGORIES:
        raise ValueError(f"Categoría desconocida: {category}")
    cfg = {**DEFAULTS, **CATEGORY_PROFILES.get(category, {}), **config}
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
    networks = cfg["networks"]
    if isinstance(networks, (list, tuple)):
        networks = rng.choice(networks)
    privacy_mix = plan in PRIVACY_PLANS and bool(cfg["privacyProbability"]) and rng.random() < cfg["privacyProbability"]
    board = generate_board(rng, cfg["height"], cfg["width"], networks, cfg["minNetworkSize"], plan,
                           cfg["degreeWeights"], cfg["cornerRouters"], privacy_mix)
    addressing = Addressing(plan, board.prefixes, cfg["nearBoundaryDistance"])
    transit = choose_transit(rng, board, cfg["transitProbability"]) if cfg["routes"] else None
    nodes = place_nodes(rng, board, empty={transit} if transit else ())
    packets, victim_net = place_packets(rng, board, nodes, cfg["packets"])
    routes, hidden = None, {}
    if cfg["routes"]:
        victim_id = next(p.id for p in packets if p.role == "victim")
        routes = assign_routes(rng, board, nodes, packets, victim_id, transit, cfg["broadcastProbability"],
                               cfg["shortRatio"])
        hidden = choose_hidden(rng, board, nodes, routes, victim_id, transit, cfg["hiddenProbability"],
                               cfg["hiddenMax"])
    ctx = Context(board, nodes, packets, addressing, routes, transit, hidden)
    # Las pistas cuya única forma cuesta 1 o más no caben en Inicial ni en interpretación 1.
    disabled = set()
    if category == "inicial" or reading == 1:
        disabled = {"network.prefix_length", "relation.more_addresses_network", "relation.higher_ttl"}
    pool = generate_instances(ctx, cfg["enabledRuleSubtypes"], disabled)
    victim = next(p for p in packets if p.role == "victim")
    attacker = next(p for p in packets if p.role == "attacker")
    rules = Rules(board.height, board.width, len(packets), cfg["maxSubset"])
    # Con redes públicas y privadas, se favorecen las pistas que nombran la única de su clase (forma privacy).
    boost = {n.id for n in board.networks if privacy_mix and addressing.privacy_rank(n.id)}
    selector = Selector(rng, ctx, pool, victim.id, rules, cfg["maxRelations"], boost)
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
    if cfg["categoryMinClues"]:
        candidates = [c for c in candidates
                      if sum(1 for x in c if x.type.split(".")[0] in ROUTE_FAMILIES) >= cfg["categoryMinClues"]]
    if ctx.hidden:
        # Cada paquete con un extremo oculto tiene alguna pista que hable de ese extremo.
        candidates = [c for c in candidates
                      if all(any(x.type in HIDDEN_TYPES and pid in (x.packet, x.other) for x in c) for pid in ctx.hidden)]
    if cfg["novelties"] and not (ctx.hidden or any(r.corner for r in board.routers)):
        with_relations = [c for c in candidates if any(x.other for x in c)]
        # En Direccionamiento, la novedad puede ser también la forma privacy (se ve al nombrar).
        if with_relations or not privacy_mix:
            candidates = with_relations
    if not candidates:
        raise RuntimeError("Las pistas disponibles no bastan para resolver el nivel")
    ids = [p.id for p in packets]
    if target:
        # Solo valen las selecciones cuya dificultad lógica da, con esta interpretación, la global buscada.
        fitting = [c for c in candidates
                   if global_level(evaluate(ctx.base, ids, c, rules, victim.id)["logic"], reading) == target]
        if not fitting:
            raise RuntimeError(f"Ninguna selección de pistas tiene la dificultad {target}")
        candidates = fitting
    clues = min(candidates, key=_spatial_score)

    # Validación independiente: una única solución y que sea la generada (con el extremo oculto).
    relations = relations_of(clues)
    domains = initial_domains(ctx.base, ids, clues)
    if count_solutions(domains, limit=2, relations=relations) != 1:
        raise RuntimeError("El nivel no tiene solución única")
    final, max_subset = propagate(domains, rules, exclude_from_subsets={victim.id}, relations=relations)
    if any(final[p.id] != {ctx.true_state(p)} for p in packets):
        raise RuntimeError("La propagación no llega a la solución generada")
    in_victim_net = [p for p in packets if board.network_of(p.cell) == victim_net]
    if sorted(p.id for p in in_victim_net) != sorted([victim.id, attacker.id]):
        raise RuntimeError("La red de la víctima no tiene exactamente dos paquetes")

    report = evaluate(ctx.base, ids, clues, rules, victim.id)

    # Formas de nombrar: después de la lógica, porque no cambian D ni A.
    namer = Namer(rng, board, nodes, addressing, cfg["maxTopic"])
    if category == "inicial":
        clues = namer.apply(clues, namer.plain(clues), {})
    else:
        ratio = cfg["categoryFormRatio"]
        if ratio == "auto":
            ratio = rng.uniform(0.2, 0.5) if cfg["routes"] else rng.uniform(0.3, 0.7)
        ratio = float(ratio)
        needed = needed_calculations(ctx, clues, rules, ids, victim.id, report["logic"])
        assigned = namer.assign(clues, reading, ratio, needed, require_category=not cfg["routes"])
        if assigned is None:
            raise RuntimeError(f"No se pueden nombrar las pistas con dificultad de interpretación {reading}")
        clues = namer.apply(clues, *assigned)
        if any(c.reading_cost and c.id not in needed for c in clues):
            raise RuntimeError("Una pista con coste de interpretación se resuelve sin hacer su cálculo")
    namer.assign_remaining(nodes, board.routers)
    novelties = sorted({"relation"} if any(c.other for c in clues) else set())
    if any(r.corner for r in board.routers):
        novelties.append("cornerRouter")
    if ctx.hidden:
        novelties.append("hiddenEndpoint")
    if any(form in ("privacy", "label_privacy") for c in clues for form in c.naming.values()):
        novelties.append("privacy")
    if cfg["novelties"] and not novelties:
        raise RuntimeError("El nivel no tiene ninguna novedad de la v0.4.5")
    topics = [c.topic for c in clues]
    if routes:
        # Origen, destino y TTL en la ficha (T3.ip); un destino de difusión, T3.subredes.
        topics.append("T3.ip")
        if any(r.broadcast for r in routes.values()):
            topics.append("T3.subredes")
    topic = max_topic(topics)
    if not cfg["routes"] and category_of(topic) != category:
        raise RuntimeError("Las pistas no corresponden a la categoría pedida")
    report["reading"] = reading
    report["readingCosts"] = [c.reading_cost for c in clues]
    report["global"] = global_level(report["logic"], reading)
    return to_dict(seed, attempt, board, nodes, packets, clues, victim, attacker, victim_net, max_subset, report,
                   addressing, category, topic, ctx, novelties)


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
        result = uncalculated(ctx, clue)
        if result is None:
            trial = clues[:i] + clues[i + 1:]   # sin su cálculo no dice nada
        else:
            domain, excluded = result
            if (domain, excluded) == (clue.domain, clue.excluded):
                continue   # sin formas con coste (filas y columnas)
            trial = clues[:i] + [replace(clue, domain=domain, excluded=excluded)] + clues[i + 1:]
        final, _ = propagate(initial_domains(ctx.base, ids, trial), rules, exclude_from_subsets={victim},
                             relations=relations_of(trial))
        if not solved(final, ids):
            needed.add(clue.id)
            continue
        try:
            if evaluate(ctx.base, ids, trial, rules, victim)["logic"] > logic:
                needed.add(clue.id)
        except RuntimeError:
            needed.add(clue.id)
    return needed


def _spatial_score(clues):
    spatial = [c.packet for c in clues if c.type.startswith("spatial.")]
    coordinates = len(spatial) - len(set(spatial))
    return len(spatial) + 4 * coordinates + 0.2 * len(clues)


def _route_fields(ctx, p):
    """Origen, destino, TTL inicial, ruta y casillas de partida de un paquete (Encaminamiento).

    Un extremo oculto se exporta como {"hidden": true}; su equipo va en `solution`.
    Con un extremo oculto, `domain` son estados [f, c, red del extremo].
    """
    route = ctx.routes.get(p.id)
    if route is None:
        return {}
    destination = ({"broadcast": route.broadcast, "network": route.networks[0]} if route.broadcast
                   else {"node": route.destination})
    origin = {"node": route.origin}
    hidden = ctx.hidden.get(p.id)
    if hidden == "origin":
        origin = {"hidden": True}
    elif hidden == "destination":
        destination = {"hidden": True}
    return {"origin": origin, "destination": destination, "ttl": {"initial": route.ttl},
            "route": {"networks": route.networks, "routers": route.routers},
            # Casillas de su ruta a las que le llega el TTL (regla packetOnRoute): las usan las sugerencias.
            "domain": sorted(one_based(x) for x in ctx.base[p.id])}


def _grouped(values):
    """{valor: [posibilidades]} de una pista entre dos paquetes, con los valores como cadenas."""
    groups = {}
    for x, v in values.items():
        groups.setdefault(str(v), []).append(one_based(x))
    return {v: sorted(xs) for v, xs in sorted(groups.items())}


def _clue_dict(c):
    # `text` es el texto en español; el motor lo compone en cada idioma a partir
    # de `type`, `parameters` y `slots` (cómo se nombra cada elemento).
    # `domain` (D) y `excluded` (A, si la pista anula casillas) los usa el motor
    # para las sugerencias; las pistas entre dos paquetes llevan en su lugar
    # `packets` y `relation` (valores de cada posibilidad y pares permitidos).
    d = {"id": c.id, "packet": c.packet, "type": c.type, "text": c.text, "parameters": c.params,
         "slots": c.slot_data, "naming": c.naming, "readingCost": c.reading_cost, "topic": c.topic}
    if c.other:
        d["packets"] = [c.packet, c.other]
        d["relation"] = {"values": {c.packet: _grouped(c.relation.first), c.other: _grouped(c.relation.second)},
                         "allowed": sorted([str(a), str(b)] for a, b in c.relation.allowed)}
        return d
    d["domain"] = sorted(one_based(x) for x in c.domain)
    if c.excluded:
        d["excluded"] = sorted(one_based(x) for x in c.excluded)
    return d


def _router_dict(board, addressing, r):
    position = ({"kind": "corner", "cells": [one_based(c) for c in r.between]} if r.corner
                else {"kind": "edge", "between": [one_based(c) for c in r.between]})
    return {"id": r.id, "name": "Router de " + join_names(board.network(n).name for n in r.networks),
            "connectedNetworks": list(r.networks), "degree": len(r.networks),
            "interfaces": {net: str(addressing.assigned[("router", r.id, net)]) for net in r.networks},
            "position": position,
            **({} if r.corner else {"orientation": "vertical" if r.between[0][0] == r.between[1][0] else "horizontal"})}


def to_dict(seed, attempt, board, nodes, packets, clues, victim, attacker, victim_net, max_subset, report,
            addressing, category, topic, ctx, novelties=()):
    level_id = f"{category}-{seed}"
    routes = ctx.routes
    by_type = {}
    for c in clues:
        by_type[c.type] = by_type.get(c.type, 0) + 1
    objective = ("Coloca los paquetes para descubrir al atacante. En cada fila y en cada columna hay "
                 f"como mucho un paquete. La víctima es el paquete {victim.id}: en su red solo había "
                 "otro paquete, el atacante.")
    if routes:
        objective += (" La ficha de cada paquete dice su origen, su destino y su TTL inicial: estaba en una red"
                      " de su ruta a la que le llegaba el TTL.")
    if ctx.hidden:
        objective += (" Si la ficha no dice el origen o el destino de un paquete, hay que deducirlo con las pistas:"
                      " cada red posible da una ruta distinta.")
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
        "rules": {"onePacketPerCell": True, "onePacketPerRow": True, "onePacketPerColumn": True,
                  **({"packetOnRoute": True} if routes else {})},
        "networks": [
            {"id": n.id, "name": n.name, "nameKey": n.name_key, "prefix": n.prefix,
             "addresses": addressing.size(n.id),
             **({"transit": True} if n.id == ctx.transit else {}),
             "cellCount": len(n.cells), "cells": [one_based(c) for c in n.cells]}
            for n in board.networks
        ],
        "routers": [_router_dict(board, addressing, r) for r in board.routers],
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
                 **_route_fields(ctx, p),
                 "solution": {"position": one_based(p.cell), "network": board.network_of(p.cell),
                              **({"routersCrossed": routes[p.id].crossed, "ttl": routes[p.id].current_ttl}
                                 if routes else {}),
                              # El extremo oculto: se muestra en la ficha al resolver el nivel.
                              **({ctx.hidden[p.id]: getattr(routes[p.id], ctx.hidden[p.id])}
                                 if p.id in ctx.hidden else {})}}
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
        "clues": [_clue_dict(c) for c in clues],
        "solution": {
            "placements": {p.id: one_based(p.cell) for p in packets},
            "victimNetwork": victim_net,
            "attackerPacketId": attacker.id,
        },
        "generation": {
            "generator": "netdoku_gen v0.4.5",
            # Novedades de la v0.4.5 que usa el nivel (relation, cornerRouter, hiddenEndpoint, privacy).
            "novelties": list(novelties),
            "attempt": attempt,
            "clueCount": len(clues),
            "cluesByType": by_type,
            "maxReservationSize": max_subset,
            "difficulty": report,
        },
    }
