"""Generación completa de un nivel y exportación a JSON (formato de levels/*.yaml)."""

import random
from dataclasses import replace

from .addressing import PLANS, PRIVACY_PLANS, Addressing
from .board import generate_board
from .content import join_names, place_nodes, place_packets
from .difficulty import evaluate
from .naming import (CATEGORIES, READING_TIERS, SIZE_FORMS, SIZE_NOTE, Namer, category_of, global_level,
                     max_topic, reading_level, topic_index)
from .routes import Route, assign_routes, choose_hidden, choose_transit
from .rules import HIDDEN_TYPES, KNOWLEDGE, ROUTE_FAMILIES, SUBTYPES, Context, generate_instances, uncalculated
from .tables import Tables
from .selection import Selector
from .solver import Relation, Rules, count_solutions, initial_domains, propagate, relations_of, solved
from .switches import features_of, forms_of, subtypes_of

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
    "disabled": (),                # claves desactivadas (levels/disabled.txt, véase switches.py)
    # Tabla de enrutamiento (v0.5): rutas por tablas de encaminamiento.
    "tables": False,
    "cycles": None,                # topology.cycles: (mínimo, máximo) de routers de más
    "tableStyle": "auto",          # routes.tables.style
    "nextHop": "auto",             # routes.tables.nextHop
    "maxTableEntries": 6,          # routes.tables.maxEntries
    "minTableRoutes": 0,           # routes.tables.minRequiredRoutes
    "tableRouteWeight": 4,         # routes.tables.requiredRouteWeight
}

# Valores que cambia cada categoría (categoryProfiles en la configuración global).
# `networks` puede ser una lista: se elige una en cada intento.
CATEGORY_PROFILES = {
    "direccionamiento": {"maxTopic": "T3.nat", "privacyProbability": 0.7},
    "encaminamiento": {"height": 7, "width": 7, "networks": [5, 6], "packets": 7, "routes": True,
                       "categoryMinClues": 3, "cornerRouters": 2, "hiddenProbability": 0.5},
    "enrutamiento": {"height": 7, "width": 7, "networks": 6, "packets": 7, "routes": True,
                     "categoryMinClues": 3, "cornerRouters": 2, "hiddenProbability": 0.5,
                     "tables": True, "cycles": (2, 3), "minTableRoutes": 2, "maxTopic": "T3.encaminamiento"},
}

# Tabla de enrutamiento: estilo de las tablas, forma del siguiente salto y planes de direcciones
# según la interpretación buscada (véase game_round_generation.md, v0.5).
TABLES_FOR_READING = {
    1: [("full", "name")],
    2: [("full", "ip"), ("default", "name"), ("default", "ip")],
    3: [("default", "ip"), ("summary", "ip")],
    4: [("summary", "ip")],
    5: [("summary", "ip")],
}
TABLE_PLANS = {
    1: {"distinct": 1, "octet_subnets": 1},
    2: {"distinct": 1, "octet_subnets": 1},
    3: {"octet_zones": 1},
    4: {"octet_zones": 1, "bit_zones": 1},
    5: {"bit_zones": 1},
}


def table_options(reading, disabled=()):
    """(estilo, siguiente salto) posibles para esa interpretación con las particularidades activas."""
    features = features_of(disabled)
    options = TABLES_FOR_READING[reading]
    if "tableDefault" in features:
        options = [o for o in options if o[0] == "full"]
    if "tableSummary" in features:
        options = [o for o in options if o[0] != "summary"]
    if "nextHopIp" in features:
        options = [(style, "name") for style, _ in options]
    return sorted(set(options))

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
    cfg = apply_disabled({**DEFAULTS, **CATEGORY_PROFILES.get(category, {}), **config})
    if cfg["tables"]:
        if "routingTables" in features_of(cfg["disabled"]):
            raise ValueError("La categoría Tabla de enrutamiento está desactivada (feature:routingTables)")
        readings = [cfg["reading"]] if cfg["reading"] else list(READING_FOR_TARGET.get(cfg["target"], {1: 1}))
        if not any(table_options(r, cfg["disabled"]) for r in readings):
            raise ValueError("Con las particularidades desactivadas no se puede buscar esa interpretación")
    rng = random.Random(seed)
    last_error = None
    for attempt in range(1, max_attempts + 1):
        try:
            return _attempt(rng, seed, cfg, attempt)
        except RuntimeError as e:
            last_error = e
    raise RuntimeError(f"No se ha generado ningún nivel en {max_attempts} intentos: {last_error}")


def apply_disabled(cfg):
    """Quita de la configuración lo que esté desactivado (levels/disabled.txt): las
    particularidades del tablero se anulan aquí; los subtipos y las formas, al elegir pistas."""
    disabled = set(cfg.get("disabled") or ())
    features = features_of(disabled)
    cfg = dict(cfg)
    if "cornerRouter" in features:
        cfg["cornerRouters"] = 0
    if "hiddenEndpoint" in features:
        cfg["hiddenProbability"] = 0.0
    if "transit" in features:
        cfg["transitProbability"] = 0.0
    if "broadcast" in features:
        cfg["broadcastProbability"] = 0.0
    if {"privacy", "label_privacy"} <= forms_of(disabled):
        cfg["privacyProbability"] = 0.0
    return cfg


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
    style = next_hop = None
    if cfg["tables"]:
        options = table_options(reading, cfg["disabled"])
        if not options:
            raise RuntimeError(f"Ningún estilo de tabla da la interpretación {reading}")
        style, next_hop = rng.choice(options)
        style = cfg["tableStyle"] if cfg["tableStyle"] != "auto" else style
        next_hop = cfg["nextHop"] if cfg["nextHop"] != "auto" else next_hop
        plans = TABLE_PLANS[reading]
        if style != "summary":
            plans = {k: v for k, v in plans.items() if not k.endswith("_zones")} or TABLE_PLANS[2]
        plan = cfg["plan"] if cfg["plan"] != "auto" else rng.choices(list(plans), weights=list(plans.values()))[0]
    else:
        plan = _choose_plan(rng, cfg, reading)
    networks = cfg["networks"]
    if isinstance(networks, (list, tuple)):
        networks = rng.choice(networks)
    privacy_mix = plan in PRIVACY_PLANS and bool(cfg["privacyProbability"]) and rng.random() < cfg["privacyProbability"]
    board = generate_board(rng, cfg["height"], cfg["width"], networks, cfg["minNetworkSize"], plan,
                           cfg["degreeWeights"], cfg["cornerRouters"], privacy_mix, cfg["cycles"])
    addressing = Addressing(plan, board.prefixes, cfg["nearBoundaryDistance"])
    transit = choose_transit(rng, board, cfg["transitProbability"]) if cfg["routes"] else None
    tables = paths = None
    prefer = set()
    if cfg["tables"]:
        # Las tablas se escriben antes de colocar los paquetes: así se sabe qué cuesta cada ruta.
        # En las interpretaciones 4 y 5 hacen falta rutas cuya consulta decisiva cueste 2 o 3
        # (coincidencia más larga o máscaras que no acaban en un octeto); si no hay, otras tablas.
        least = {4: 2, 5: 3}.get(reading, 0)
        for _ in range(20):
            tables = Tables(rng, board, transit)
            tables.write(style, next_hop, board.zones)
            if tables.max_entries() > cfg["maxTableEntries"]:
                continue
            paths = tables.routes()
            costs = {pair: tables.route_cost(nets, routers, 99) for pair, (nets, routers) in paths.items()}
            # Pares cuya ruta exige las tablas con TTL de sobra: se prefieren al elegir origen y destino.
            prefer = {pair for pair, c in costs.items() if c is not None and c >= least}
            if len(prefer) >= (1 if least else cfg["minTableRoutes"]):
                break
        else:
            raise RuntimeError("Ninguna tabla da rutas con la consulta que hace falta")
    nodes = place_nodes(rng, board, empty={transit} if transit else ())
    packets, victim_net = place_packets(rng, board, nodes, cfg["packets"])
    routes, hidden = None, {}
    if cfg["routes"]:
        victim_id = next(p.id for p in packets if p.role == "victim")
        routes = assign_routes(rng, board, nodes, packets, victim_id, transit, cfg["broadcastProbability"],
                               cfg["shortRatio"], paths, prefer, cfg["tableRouteWeight"], cfg["minTableRoutes"])
        hidden = choose_hidden(rng, board, nodes, routes, victim_id, transit, cfg["hiddenProbability"],
                               cfg["hiddenMax"], paths)
    route_costs = {}
    if tables:
        for pid, rt in routes.items():
            if pid not in hidden and not rt.broadcast:
                cost = tables.route_cost(rt.networks, rt.routers, rt.ttl)
                if cost is not None:
                    route_costs[pid] = cost
        if len(route_costs) < cfg["minTableRoutes"]:
            raise RuntimeError("Pocas rutas que exijan las tablas")
        # Las rutas dan por sí solas la interpretación buscada o un punto menos.
        if not reading - 1 <= reading_level(list(route_costs.values())) <= reading:
            raise RuntimeError(f"Las tablas no dan la interpretación {reading}")
        # Direcciones que se ven sin pistas: interfaces de los routers (siguiente salto por IP)
        # y equipos de destino (ficha del paquete).
        for r in board.routers:
            for net in r.networks:
                addressing.assign(rng, ("router", r.id, net), net)
        for rt in routes.values():
            if rt.destination:
                addressing.assign(rng, ("node", rt.destination), next(n.network for n in nodes if n.id == rt.destination))
    ctx = Context(board, nodes, packets, addressing, routes, transit, hidden)
    ctx.tables = tables
    # Las pistas cuya única forma cuesta 1 o más no caben en Inicial ni en interpretación 1.
    disabled = subtypes_of(cfg["disabled"])
    if category == "inicial" or reading == 1:
        disabled |= {"network.prefix_length", "relation.more_addresses_network", "relation.higher_ttl"}
    pool = generate_instances(ctx, cfg["enabledRuleSubtypes"], disabled)
    victim = next(p for p in packets if p.role == "victim")
    attacker = next(p for p in packets if p.role == "attacker")
    rules = Rules(board.height, board.width, len(packets), cfg["maxSubset"])
    # Con redes públicas y privadas, se favorecen las pistas que nombran la única de su clase (forma privacy).
    boost = {n.id for n in board.networks if privacy_mix and addressing.privacy_rank(n.id)}
    selector = Selector(rng, ctx, pool, victim.id, rules, cfg["maxRelations"], boost, route_costs)
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
    if tables and not tables_needed(ctx, clues, rules, ids, victim.id, report["logic"], route_costs):
        raise RuntimeError("Las tablas no hacen falta para resolver el nivel")

    # Formas de nombrar: después de la lógica, porque no cambian D ni A.
    # Los equipos de destino ya tienen su IP en la ficha: no se nombran por ella.
    shown = {rt.destination for pid, rt in (routes or {}).items() if tables and rt.destination and pid not in hidden}
    namer = Namer(rng, board, nodes, addressing, cfg["maxTopic"], forms_of(cfg["disabled"]), tables, shown)
    if category == "inicial":
        clues = namer.apply(clues, namer.plain(clues), {})
    else:
        ratio = cfg["categoryFormRatio"]
        if ratio == "auto":
            ratio = rng.uniform(0.2, 0.5) if cfg["routes"] else rng.uniform(0.3, 0.7)
        ratio = float(ratio)
        needed = needed_calculations(ctx, clues, rules, ids, victim.id, report["logic"])
        assigned = namer.assign(clues, reading, ratio, needed, require_category=not cfg["routes"],
                                fixed_costs=list(route_costs.values()))
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
    if tables:
        novelties.append("routingTables")
        topics.append("T3.encaminamiento")
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
    if tables:
        report["routeCosts"] = route_costs
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


def _clue_ident(c):
    return (c.type, c.packet, c.other, repr(sorted(c.params.items())), repr(sorted(c.slots.items())))


def tables_needed(ctx, clues, rules, ids, victim, logic, required):
    """Las tablas son imprescindibles (Tabla de enrutamiento).

    Quien no mira las tablas solo sabe que cada paquete va por algún camino mínimo
    entre su red de origen y la de destino. A los paquetes cuya ruta exige las
    tablas se les permiten las casillas de cualquiera de esos caminos (a las que
    llegue el TTL), y cada pista suya vale en las casillas en las que es verdadera
    con alguno de ellos. Si así el nivel se resuelve con la misma lógica o con una
    más sencilla, las tablas no hacían falta.

    Para recalcular las pistas, cada camino es una hipótesis (un estado `(f, c, "pN")`,
    como con un extremo oculto; la ruta verdadera es "route"); después se pasa a casillas.
    """
    tables = ctx.tables
    # Los extremos ocultos del nivel siguen igual; las rutas que exigen las tablas pasan a hipótesis.
    hypotheses = {pid: (ctx.hidden[pid], ctx.alternatives[pid]) for pid in ctx.hidden}
    for pid in required:
        rt = ctx.routes[pid]
        alts = {"route": rt}
        for i, (nets, routers) in enumerate(tables.shortest_paths(rt.networks[0], rt.networks[-1])):
            if (nets, routers) != (rt.networks, rt.routers):
                alts[f"p{i}"] = Route(rt.origin, rt.destination, None, list(nets), list(routers), -1, rt.ttl)
        hypotheses[pid] = ("path", alts)
    loose = Context(ctx.board, ctx.nodes, ctx.packets, ctx.addressing, ctx.routes, ctx.transit, hypotheses)
    loose.tables = tables

    def to_cells(pid, states):
        return frozenset(x[:2] for x in states) if pid in required else frozenset(states)

    def project(rel_values, pid):
        """Valores de una pista entre dos paquetes por casilla (None si dependen del camino)."""
        if pid not in required:
            return rel_values
        result = {}
        for x, v in rel_values.items():
            if result.setdefault(x[:2], v) != v:
                return None
        return result

    base = {pid: to_cells(pid, loose.base[pid]) for pid in ids}
    packets = {p.id: p for p in ctx.packets}
    trial = []
    for c in clues:
        # La misma pista recalculada con todas las hipótesis (sin quitar duplicados).
        ident = _clue_ident(c)
        twin = next((x for x in SUBTYPES[c.type](loose, packets[c.packet])
                     if x.type == c.type and _clue_ident(x) == ident), None)
        if c.other:
            if twin is None:
                if not any(pid in required for pid in (c.packet, c.other)):
                    trial.append(c)
                continue   # no se puede recalcular: se quita (el nivel sin ella no es más fácil)
            first, second = project(twin.relation.first, c.packet), project(twin.relation.second, c.other)
            if first is None or second is None:
                continue   # su valor depende del camino: sin las tablas no dice nada seguro
            trial.append(replace(twin, relation=Relation(first, second, twin.relation.allowed)))
            continue
        if twin is None:
            twin = replace(c, domain=loose.lift(c.packet, c.domain))
        else:
            twin = replace(twin, domain=loose.lift(c.packet, twin.domain))
        trial.append(replace(twin, domain=to_cells(c.packet, twin.domain)))
    final, _ = propagate(initial_domains(base, ids, trial), rules, exclude_from_subsets={victim},
                         relations=relations_of(trial))
    if not solved(final, ids):
        return True
    try:
        return evaluate(base, ids, trial, rules, victim)["logic"] > logic
    except RuntimeError:
        return True


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
    if ctx.tables and route.destination:
        # Tabla de enrutamiento: la ficha muestra la IP de destino, la que buscan los routers.
        destination["ip"] = str(ctx.addressing.assigned[("node", route.destination)])
    origin = {"node": route.origin}
    hidden = ctx.hidden.get(p.id)
    if hidden == "origin":
        origin = {"hidden": True}
    elif hidden == "destination":
        destination = {"hidden": True}
    route_dict = {"networks": route.networks, "routers": route.routers}
    if ctx.tables and not route.broadcast and p.id not in ctx.hidden:
        # Consultas que deciden un empate en la parte alcanzable ("gateway" o routers).
        route_dict["tableDecisions"] = ctx.tables.decisions(route.networks, route.routers, route.ttl)
    return {"origin": origin, "destination": destination, "ttl": {"initial": route.ttl},
            "route": route_dict,
            # Casillas de su ruta a las que le llega el TTL (regla packetOnRoute): las usan las sugerencias.
            "domain": sorted(one_based(x) for x in ctx.base[p.id])}


def _grouped(values):
    """{valor: [posibilidades]} de una pista entre dos paquetes, con los valores como cadenas."""
    groups = {}
    for x, v in values.items():
        groups.setdefault(str(v), []).append(one_based(x))
    return {v: sorted(xs) for v, xs in sorted(groups.items())}


def clue_dict(c):
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


def router_dict(board, addressing, r):
    position = ({"kind": "corner", "cells": [one_based(c) for c in r.between]} if r.corner
                else {"kind": "edge", "between": [one_based(c) for c in r.between]})
    return {"id": r.id, "name": "Router de " + join_names(board.network(n).name for n in r.networks),
            "connectedNetworks": list(r.networks), "degree": len(r.networks),
            "interfaces": {net: str(addressing.assigned[("router", r.id, net)]) for net in r.networks},
            "position": position,
            **({} if r.corner else {"orientation": "vertical" if r.between[0][0] == r.between[1][0] else "horizontal"})}


def board_dict(board):
    return {
        "width": board.width,
        "height": board.height,
        "coordinateSystem": {"origin": "top-left", "rowIndexStartsAt": 1, "columnIndexStartsAt": 1},
        "networkGrid": board.grid,
    }


def networks_list(board, addressing, ctx):
    return [
        {"id": n.id, "name": n.name, "nameKey": n.name_key, "prefix": n.prefix,
         "addresses": addressing.size(n.id),
         **({"transit": True} if n.id == ctx.transit else {}),
         "cellCount": len(n.cells), "cells": [one_based(c) for c in n.cells]}
        for n in board.networks
    ]


def topology_dict(board):
    return {
        "bipartite": True,
        "connected": True,
        "networkNodes": [n.id for n in board.networks],
        "routerNodes": [r.id for r in board.routers],
        "edges": [[net, r.id] for r in board.routers for net in r.networks],
    }


def nodes_list(nodes, addressing):
    return [
        {"id": n.id, "type": n.type, **({"services": n.services} if n.services else {}),
         "label": n.label[0].upper() + n.label[1:], "network": n.network, "position": one_based(n.cell),
         "ip": str(addressing.assigned[("node", n.id)])}
        for n in nodes
    ]


def packet_item(ctx, p):
    """Ficha de un paquete con su solución (y, en Encaminamiento, su ruta)."""
    board, routes = ctx.board, ctx.routes
    return {"id": p.id, "color": p.color, "colorName": p.color_name,
            **({"role": p.role} if p.role != "other" else {}),
            **_route_fields(ctx, p),
            "solution": {"position": one_based(p.cell), "network": board.network_of(p.cell),
                         **({"routersCrossed": routes[p.id].crossed, "ttl": routes[p.id].current_ttl}
                            if p.id in routes else {}),
                         # El extremo oculto: se muestra en la ficha al resolver el nivel.
                         **({ctx.hidden[p.id]: getattr(routes[p.id], ctx.hidden[p.id])}
                            if p.id in ctx.hidden else {})}}


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
    if ctx.tables:
        objective += (" La ruta la deciden las tablas de encaminamiento: el equipo envía el paquete a la puerta de"
                      " enlace de su red y cada router lo envía al siguiente salto que dice su tabla.")
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
        "board": board_dict(board),
        "rules": {"onePacketPerCell": True, "onePacketPerRow": True, "onePacketPerColumn": True,
                  **({"packetOnRoute": True} if routes else {}),
                  **({"routingTables": True} if ctx.tables else {})},
        "networks": networks_list(board, addressing, ctx),
        "routers": [router_dict(board, addressing, r) for r in board.routers],
        "topology": topology_dict(board),
        **({"routing": ctx.tables.to_dict()} if ctx.tables else {}),
        "nodes": nodes_list(nodes, addressing),
        "packets": {
            "victimId": victim.id,
            "attackerId": attacker.id,
            "items": [packet_item(ctx, p) for p in packets],
        },
        "objective": {
            "type": "identify_attacker",
            "text": objective,
            "victimPacketId": victim.id,
            "packetsInVictimNetwork": 2,
            "observableAnswer": {"attackerPacketId": attacker.id},
        },
        "clues": [clue_dict(c) for c in clues],
        "solution": {
            "placements": {p.id: one_based(p.cell) for p in packets},
            "victimNetwork": victim_net,
            "attackerPacketId": attacker.id,
        },
        "generation": {
            "generator": "netdoku_gen v0.5" if ctx.tables else "netdoku_gen v0.4.5",
            # Novedades de la v0.4.5 que usa el nivel (relation, cornerRouter, hiddenEndpoint, privacy).
            "novelties": list(novelties),
            "attempt": attempt,
            "clueCount": len(clues),
            "cluesByType": by_type,
            "maxReservationSize": max_subset,
            "difficulty": report,
        },
    }
