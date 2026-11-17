"""Ejercicios de entrenamiento (v0.4.8): una pista o una regla en un tablero pequeño.

Cada variante enseña un subtipo de pista con una forma de nombrar, o una regla
del juego (un paquete por fila y columna, fila obligada, ruta y TTL). Un
ejercicio es un tablero pequeño con un paquete por decidir y, si hacen falta,
otros ya colocados, y uno o dos pasos:

- `possible`: el jugador marca las casillas donde puede estar el paquete.
- `impossible`: marca con ✕ las casillas donde no puede estar (cuando las
  posibles son más de la mitad, para no marcar casi todo el tablero).
- `annul`: marca las casillas que quedan descartadas para los demás paquetes
  (las posibles del paquete se muestran como notas). Sale cuando la pista anula
  casillas («…y ningún otro paquete lo estaba») o cuando todas las casillas
  posibles están en una fila o una columna, que pasa a ser del paquete.

Cada paso lleva la respuesta (`answer`), las casillas que también son
correctas aunque no se piden (`extra`), el motivo de cada casilla incorrecta
(`reasons`, clave y parámetros), el de cada casilla de la respuesta cuando
hace falta (`why`, en `impossible`) y la explicación (`explain`, una lista de
hechos). El motor compone los textos en cada idioma; los parámetros nombran
redes, equipos y routers por su identificador.

Las respuestas salen de las mismas pistas que el juego (`rules.py`), así que
el entrenamiento nunca contradice a los niveles.
"""

import ipaddress
import random
from dataclasses import dataclass, field, replace

from .addressing import PRIVACY_PLANS, Addressing
from .board import generate_board, side_neighbors
from .content import PACKET_COLORS, Packet, class_members, place_nodes
from .level import (SCHEMA_VERSION, board_dict, clue_dict, networks_list, nodes_list, one_based, packet_item,
                    router_dict, topology_dict)
from .naming import Namer
from .routes import Route, assign_routes, choose_transit, unique_shortest_paths
from .rules import ROUTE_FAMILIES, Context, generate_instances, uncalculated
from .solver import cell_of
from .switches import features_of, forms_of


class Retry(Exception):
    """El intento no sirve: se prueba con otro tablero."""


# ---------- Catálogo de variantes ----------

# Tableros: lado, redes posibles, tamaño mínimo de red, planes de direcciones y rutas.
PROFILES = {
    "basic": {"size": 5, "networks": [3], "min_size": 5, "plans": ["distinct", "octet_subnets"], "routes": False},
    "addr": {"size": 5, "networks": [3, 4], "min_size": 4, "plans": ["octet_subnets", "bit_subnets", "vlsm"],
             "routes": False},
    "corner": {"size": 5, "networks": [4], "min_size": 4, "plans": ["octet_subnets"], "routes": False, "corner": True},
    "route": {"size": 6, "networks": [4, 5], "min_size": 5, "plans": ["octet_subnets"], "routes": True},
}
# Categoría de juego con la que se escriben las pistas de cada categoría de entrenamiento.
GAME_CATEGORY = {"rules": "inicial", "inicial": "inicial", "direccionamiento": "direccionamiento",
                 "encaminamiento": "encaminamiento"}


@dataclass
class Variant:
    id: str
    category: str                 # rules | inicial | direccionamiento | encaminamiento
    group: str                    # ficha de ayuda que explica la variante
    profile: str
    subtype: str = None
    forms: dict = field(default_factory=dict)   # hueco -> forma pedida
    accept: object = None         # (ctx, pista) -> bool
    special: str = None           # ejercicios sin pista propia (reglas, rutas)
    partner: bool = False         # pista entre dos paquetes: el otro va colocado
    plans: tuple = None
    privacy: bool = False
    transit: bool = None
    hidden: str = None            # extremo oculto del paquete: origin | destination
    route: object = None          # condición sobre la ruta del paquete
    min_answer: int = 2
    features: tuple = ()          # particularidades que usa (para desactivarla)
    needs: tuple = ()             # otros subtipos que usa (pistas de los demás paquetes)

    @property
    def keys(self):
        """Claves de levels/disabled.txt que ocultan la variante."""
        keys = [self.subtype] if self.subtype else []
        keys += list(self.needs)
        keys += [f"form:{f}" for f in self.forms.values() if f not in PLAIN_FORMS]
        keys += [f"feature:{f}" for f in self.features]
        return keys


# Formas sencillas (sin coste ni categoría): no se cuentan como claves propias de la variante.
PLAIN_FORMS = {"name", "label", "label_network", "networks", "number", "ip_view", "count"}


def _has(param, value=True):
    return lambda ctx, c: (param in c.params) == value


def _adjacent_border(ctx, c):
    """Junto a un equipo concreto que tiene al lado una casilla libre de otra red (el borde importa)."""
    if "nodeId" not in c.params:
        return False
    n = ctx.node(c.params["nodeId"])
    return any(x in ctx.free_cells and ctx.board.network_of(x) != n.network
               for x in side_neighbors(n.cell, ctx.board.height, ctx.board.width))


def _class_only(ctx, c):
    return "nodeId" not in c.params and "service" not in c.params


def _router_kind(corner):
    return lambda ctx, c: ctx.router(c.params["routerId"]).corner == corner


def _long_route(r):
    return not r.broadcast and r.length >= 2


def _reaching(r):
    return _long_route(r) and r.reaches_destination


V = Variant
VARIANTS = [
    # Reglas del juego.
    V("rules.row_column.annul", "rules", "row_column", "basic", special="row_annul"),
    V("rules.row_column.free", "rules", "row_column", "basic", special="free_lines"),
    V("rules.row_column.last", "rules", "row_column", "basic", special="last_cell", min_answer=1),
    V("rules.row_column.forced", "rules", "row_column", "basic", special="forced_line", min_answer=1,
      needs=("network.in_network",)),
    V("rules.adjacent", "rules", "adjacent", "basic", "node.adjacent_to_node", accept=_adjacent_border),
    # Inicial.
    V("inicial.in_network", "inicial", "in_network", "basic", "network.in_network", {"net": "name"}),
    V("inicial.not_in_network", "inicial", "negative", "basic", "network.not_in_network", {"net": "name"}),
    V("inicial.not_adjacent.node", "inicial", "negative", "basic", "node.not_adjacent_to_node", accept=_has("nodeId")),
    V("inicial.not_adjacent.class", "inicial", "negative", "basic", "node.not_adjacent_to_node",
      accept=_has("nodeId", False)),
    V("inicial.either", "inicial", "either", "basic", "network.in_either_network", {"net1": "name", "net2": "name"}),
    V("inicial.node_count", "inicial", "node_count", "basic", "network.node_count"),
    V("inicial.contents", "inicial", "node_count", "basic", "network.in_network", {"net": "contents"}),
    V("inicial.adjacent.node", "inicial", "adjacent_to_node", "basic", "node.adjacent_to_node", accept=_has("nodeId")),
    V("inicial.adjacent.service", "inicial", "adjacent_to_node", "basic", "node.adjacent_to_node",
      accept=_has("service")),
    V("inicial.adjacent.class", "inicial", "adjacent_to_node", "basic", "node.adjacent_to_node", accept=_class_only),
    V("inicial.unique_adjacent", "inicial", "unique_adjacent", "basic", "node.unique_adjacent_to_node"),
    V("inicial.router", "inicial", "router", "basic", "router.adjacent_to_router", {"router": "networks"},
      accept=_router_kind(False)),
    V("inicial.row", "inicial", "spatial", "basic", "spatial.in_row", {"row": "number"}),
    V("inicial.column", "inicial", "spatial", "basic", "spatial.in_column", {"column": "number"}),
    V("inicial.aligned_node", "inicial", "spatial", "basic", "spatial.in_row", {"row": "aligned_node"}),
    V("inicial.aligned_router", "inicial", "spatial", "basic", "spatial.in_column", {"column": "aligned_router"}),
    V("inicial.same_network", "inicial", "relation", "basic", "relation.same_network", partner=True),
    V("inicial.routers_between", "inicial", "relation", "basic", "relation.routers_between", partner=True),
    # Direccionamiento.
    V("dir.prefix", "direccionamiento", "named_by_address", "addr", "network.in_network", {"net": "prefix"}),
    V("dir.label_prefix", "direccionamiento", "named_by_address", "addr", "node.adjacent_to_node",
      {"node": "label_prefix"}),
    V("dir.networks_prefix", "direccionamiento", "named_by_address", "addr", "router.adjacent_to_router",
      {"router": "networks_prefix"}, accept=_router_kind(False)),
    V("dir.size_rank", "direccionamiento", "network_size", "addr", "network.in_network", {"net": "size_rank"},
      plans=("vlsm", "distinct")),
    V("dir.address_count", "direccionamiento", "network_size", "addr", "network.in_network",
      {"net": "address_count"}, plans=("vlsm", "distinct")),
    V("dir.mask", "direccionamiento", "network_size", "addr", "network.in_network", {"net": "mask"},
      plans=("vlsm", "distinct")),
    V("dir.prefix_length", "direccionamiento", "prefix_length", "addr", "network.prefix_length",
      {"len": "prefix_length"}, plans=("vlsm",)),
    V("dir.length_count", "direccionamiento", "prefix_length", "addr", "network.prefix_length",
      {"len": "address_count"}, plans=("vlsm",)),
    V("dir.length_usable", "direccionamiento", "prefix_length", "addr", "network.prefix_length",
      {"len": "usable_count"}, plans=("vlsm",)),
    V("dir.length_mask", "direccionamiento", "prefix_length", "addr", "network.prefix_length", {"len": "mask"},
      plans=("vlsm",)),
    V("dir.ip_member", "direccionamiento", "ip_network", "addr", "network.in_network", {"net": "ip_member"},
      plans=("bit_subnets", "vlsm")),
    V("dir.node_ip", "direccionamiento", "ip_network", "addr", "node.adjacent_to_node", {"node": "ip"},
      plans=("bit_subnets", "vlsm", "octet_subnets")),
    V("dir.interfaces", "direccionamiento", "ip_network", "addr", "router.adjacent_to_router",
      {"router": "interfaces"}, accept=_router_kind(False), plans=("bit_subnets", "vlsm", "octet_subnets")),
    V("dir.first_host", "direccionamiento", "special_addresses", "addr", "network.in_network",
      {"net": "first_host"}),
    V("dir.last_host", "direccionamiento", "special_addresses", "addr", "network.in_network", {"net": "last_host"}),
    V("dir.broadcast", "direccionamiento", "special_addresses", "addr", "network.in_network", {"net": "broadcast"}),
    V("dir.usable_count", "direccionamiento", "special_addresses", "addr", "network.in_network",
      {"net": "usable_count"}, plans=("vlsm", "distinct")),
    V("dir.privacy", "direccionamiento", "privacy", "addr", "network.in_network", {"net": "privacy"},
      plans=PRIVACY_PLANS, privacy=True),
    V("dir.label_privacy", "direccionamiento", "privacy", "addr", "node.adjacent_to_node", {"node": "label_privacy"},
      plans=PRIVACY_PLANS, privacy=True),
    V("dir.more_addresses", "direccionamiento", "relation", "addr", "relation.more_addresses_network",
      {"compare": "size_compare"}, partner=True, plans=("vlsm", "distinct")),
    # Encaminamiento.
    V("enc.route", "encaminamiento", "route_trace", "route", special="route_base", route=_reaching),
    V("enc.short_ttl", "encaminamiento", "ttl", "route", special="route_short",
      route=lambda r: _long_route(r) and not r.reaches_destination),
    V("enc.broadcast", "encaminamiento", "route_trace", "route", special="route_broadcast",
      route=lambda r: bool(r.broadcast), features=("broadcast",)),
    V("enc.in_origin", "encaminamiento", "route_position", "route", "endpoint.in_origin_network",
      {"view": "ip_view"}, route=_long_route),
    V("enc.in_destination", "encaminamiento", "route_position", "route", "endpoint.in_destination_network",
      {"view": "ip_view"}, route=_long_route),
    V("enc.in_transit", "encaminamiento", "route_position", "route", "route.in_transit_network",
      route=_long_route, transit=True, features=("transit",)),
    V("enc.last_router", "encaminamiento", "route_router", "route", "route.last_router",
      {"view": "ip_view", "router": "networks"}, route=_long_route),
    V("enc.next_router", "encaminamiento", "route_router", "route", "route.next_router",
      {"view": "ip_view", "router": "networks"}, route=_long_route),
    V("enc.mac_origin", "encaminamiento", "frames", "route", "endpoint.in_origin_network", {"view": "mac_view"},
      route=_long_route),
    V("enc.mac_last", "encaminamiento", "frames", "route", "route.last_router",
      {"view": "mac_view", "router": "networks"}, route=_long_route),
    V("enc.mac_next", "encaminamiento", "frames", "route", "route.next_router",
      {"view": "mac_view", "router": "networks"}, route=_long_route),
    V("enc.mac_destination", "encaminamiento", "frames", "route", "endpoint.in_destination_network",
      {"view": "mac_view"}, route=_long_route),
    V("enc.crossed", "encaminamiento", "ttl_count", "route", "ttl.routers_crossed", {"ttl": "count"},
      route=_long_route),
    V("enc.ttl_value", "encaminamiento", "ttl_count", "route", "ttl.routers_crossed", {"ttl": "ttl_value"},
      route=_long_route),
    V("enc.left", "encaminamiento", "ttl_count", "route", "ttl.routers_left", route=_long_route),
    V("enc.range_min", "encaminamiento", "ttl_count", "route", "ttl.routers_crossed_range", {"ttl": "count"},
      accept=_has("min"), route=_long_route),
    V("enc.range_max", "encaminamiento", "ttl_count", "route", "ttl.routers_crossed_range", {"ttl": "count"},
      accept=_has("max"), route=_long_route),
    V("enc.range_ttl", "encaminamiento", "ttl_count", "route", "ttl.routers_crossed_range", {"ttl": "ttl_value"},
      route=_long_route),
    V("enc.corner", "encaminamiento", "corner_router", "corner", "router.adjacent_to_router",
      {"router": "networks"}, accept=_router_kind(True), features=("cornerRouter",)),
    V("enc.hidden_origin", "encaminamiento", "hidden_endpoint", "route", "endpoint.origin", hidden="origin",
      features=("hiddenEndpoint",)),
    V("enc.hidden_class", "encaminamiento", "hidden_endpoint", "route", "endpoint.destination_class",
      hidden="destination", features=("hiddenEndpoint",)),
    V("enc.first_router", "encaminamiento", "hidden_endpoint", "route", "route.first_router",
      {"view": "ip_view", "router": "networks"}, hidden="origin", features=("hiddenEndpoint",)),
    V("enc.final_router", "encaminamiento", "hidden_endpoint", "route", "route.final_router",
      {"view": "ip_view", "router": "networks"}, hidden="destination", features=("hiddenEndpoint",)),
    V("enc.more_routers", "encaminamiento", "route_relation", "route", "relation.more_routers_crossed",
      partner=True, route=_long_route),
    V("enc.higher_ttl", "encaminamiento", "route_relation", "route", "relation.higher_ttl",
      {"compare": "ttl_compare"}, partner=True, route=_long_route),
    V("enc.closer", "encaminamiento", "route_relation", "route", "relation.closer_to_destination",
      partner=True, route=_reaching),
]
SPECIAL_PACKETS = {"row_annul": 1, "free_lines": 5, "last_cell": 5, "forced_line": 5}
IN_NETWORK = Variant("_", "rules", "", "basic", "network.in_network", {"net": "name"})


def variant(variant_id):
    return next(v for v in VARIANTS if v.id == variant_id)


# ---------- Construcción ----------

def build_exercise(v, seed, disabled=(), max_attempts=600):
    """Un ejercicio de la variante `v` (diccionario listo para guardar en JSON)."""
    rng = random.Random(seed)
    last = None
    for attempt in range(1, max_attempts + 1):
        try:
            return _attempt(v, rng, seed, attempt, set(disabled))
        except (Retry, RuntimeError) as e:
            last = e
    raise RuntimeError(f"{v.id}: ningún ejercicio en {max_attempts} intentos ({last})")


def _attempt(v, rng, seed, attempt, disabled):
    prof = PROFILES[v.profile]
    features = features_of(disabled)
    size = prof["size"]
    plan = rng.choice(list(v.plans or prof["plans"]))
    privacy_mix = v.privacy and plan in PRIVACY_PLANS
    if prof.get("corner"):
        weights, corner = {3: 1.0}, 2
    else:
        weights = {2: 0.75, 3: 0.20, 4: 0.05}
        corner = 1 if prof["routes"] and "cornerRouter" not in features else 0
    board = generate_board(rng, size, size, rng.choice(prof["networks"]), prof["min_size"], plan, weights, corner,
                           privacy_mix)
    if prof.get("corner") and not any(r.corner for r in board.routers):
        raise Retry("sin router de esquina")
    addressing = Addressing(plan, board.prefixes)
    transit = None
    if prof["routes"]:
        prob = 1.0 if v.transit else 0.0 if (v.transit is False or "transit" in features) else 0.4
        transit = choose_transit(rng, board, prob)
        if v.transit and not transit:
            raise Retry("sin red de tránsito")
    nodes = place_nodes(rng, board, empty={transit} if transit else ())
    count = SPECIAL_PACKETS.get(v.special, 2 if v.partner else 1)
    packets = _place_packets(rng, board, nodes, count)
    target = packets[0]
    routes, hidden = {}, {}
    if prof["routes"]:
        broadcast = 1.0 if v.special == "route_broadcast" else 0.0
        short = 1.0 if v.special == "route_short" else 0.0 if v.special == "route_base" else 0.25
        routes = assign_routes(rng, board, nodes, packets, "", transit, broadcast, short)
        if v.route and not v.route(routes[target.id]):
            raise Retry("ruta sin interés")
        if v.partner and routes[packets[1].id].broadcast:
            raise Retry("el otro paquete es de difusión")
        if v.hidden:
            hidden = _hide(board, nodes, routes, target.id, v.hidden, transit)
    ctx = Context(board, nodes, packets, addressing, routes, transit, hidden)
    namer = Namer(rng, board, nodes, addressing, "T3.nat", forms_of(disabled))

    placed = {}
    if v.special in ("row_annul", "free_lines", "last_cell", "forced_line"):
        clues, steps, placed = _rules_exercise(v, ctx, namer, packets, rng)
    elif v.special:
        clues, steps = [], [_route_step(v, ctx, target)]
    else:
        partner = packets[1] if v.partner else None
        if partner:
            placed = {partner.id: partner.cell}
        clue = _pick_clue(v, ctx, namer, target, partner, rng)
        clues, steps = [clue], _clue_steps(v, ctx, clue, target, partner)
    _check(v, ctx, steps, placed)
    namer.assign_remaining(nodes, board.routers)
    clues = [replace(c, id=f"c{i + 1}") for i, c in enumerate(clues)]
    return _export(v, seed, attempt, ctx, clues, steps, placed)


def _place_packets(rng, board, nodes, count):
    """Paquetes en casillas libres, como mucho uno por fila y por columna; los primeros, cerca de
    equipos y routers para que haya pistas de adyacencia."""
    node_cells = {n.cell for n in nodes}
    near = {x for n in nodes for x in side_neighbors(n.cell, board.height, board.width)
            if board.network_of(x) == n.network and x not in node_cells}
    near |= {x for r in board.routers for x in r.between if x not in node_cells}
    for _ in range(300):
        rows = rng.sample(range(board.height), count)
        used, chosen = set(), []
        for r in rows:
            options = [(r, c) for c in range(board.width) if c not in used and (r, c) not in node_cells]
            if not options:
                break
            cell = rng.choices(options, weights=[4.0 if x in near else 1.0 for x in options])[0]
            chosen.append(cell)
            used.add(cell[1])
        if len(chosen) == count:
            colors = rng.sample(PACKET_COLORS, count)
            return [Packet(id=chr(ord("A") + i), color_name=colors[i][0], color=colors[i][1], cell=chosen[i])
                    for i in range(count)]
    raise Retry("no caben los paquetes")


def _hide(board, nodes, routes, pid, kind, transit):
    """Oculta el extremo `kind` del paquete (como routes.choose_hidden, pero de un paquete concreto)."""
    route = routes[pid]
    if route.broadcast or not route.routers:
        raise Retry("no se puede ocultar el extremo")
    paths = unique_shortest_paths(board)
    with_nodes = [n.id for n in board.networks if n.id != transit and any(x.network == n.id for x in nodes)]
    fixed = route.networks[-1] if kind == "origin" else route.networks[0]
    alternatives = {}
    for net in with_nodes:
        if net == fixed:
            continue
        key = (net, fixed) if kind == "origin" else (fixed, net)
        if key not in paths:
            raise Retry("camino mínimo no único")
        nets, routers = paths[key]
        alternatives[net] = Route(None, None, None, list(nets), list(routers), -1, route.ttl)
    if len(alternatives) < 2:
        raise Retry("una sola red posible")
    return {pid: (kind, alternatives)}


def _pick_clue(v, ctx, namer, target, partner, rng):
    """Una pista del subtipo de la variante sobre el paquete (y su pareja), con las formas pedidas."""
    pool = []
    for c in generate_instances(ctx, {v.subtype}):
        if partner:
            if not c.other or {c.packet, c.other} != {target.id, partner.id}:
                continue
        elif c.other or c.packet != target.id:
            continue
        if v.accept and not v.accept(ctx, c):
            continue
        pool.append(c)
    rng.shuffle(pool)
    for clue in pool:
        options = []
        for cost, slots in namer.clue_options(clue):
            if any(name not in slots or slots[name].form != form for name, form in v.forms.items()):
                continue
            # Los huecos que la variante no fija se nombran de la forma más sencilla.
            if any(o.cost or o.category for name, o in slots.items() if name not in v.forms):
                continue
            options.append((cost, slots))
        if not options:
            continue
        cost, slots = rng.choice(options)
        fixed = {}
        for o in slots.values():
            if o.key is None:
                continue
            keys = o.key if isinstance(o.key, list) else [o.key]
            addresses = o.address if isinstance(o.address, list) else [o.address]
            fixed.update(zip(keys, addresses))
        named = namer.apply([clue], [(cost, slots)], fixed)[0]
        if cost and not named.other and uncalculated(ctx, named) == (named.domain, named.excluded):
            continue   # el cálculo no hace falta: no enseña la forma
        return named
    raise Retry("ninguna pista con esa forma")


# ---------- Respuestas, motivos y explicaciones ----------

def _cells(xs):
    return {cell_of(x) for x in xs}


def _key(x):
    return f"{x[0] + 1},{x[1] + 1}"


def _blocked(placed):
    """Casillas descartadas por los paquetes colocados: su fila y su columna."""
    def reason(x):
        for pid, (r, c) in placed.items():
            if x[0] == r:
                return {"key": "rowTaken", "r": r + 1, "packet": pid}
            if x[1] == c:
                return {"key": "columnTaken", "c": c + 1, "packet": pid}
        return None
    return reason


def _clue_steps(v, ctx, clue, target, partner):
    placed = {partner.id: partner.cell} if partner else {}
    taken = _blocked(placed)
    base = _cells(ctx.base[target.id])
    if clue.other:
        rel = clue.relation
        first = clue.packet == target.id
        mine = rel.first if first else rel.second
        theirs = (rel.second if first else rel.first)[ctx.true_state(partner)]
        pairs = rel.allowed if first else {(b, a) for a, b in rel.allowed}
        domain = {x for x in ctx.base[target.id] if (mine[x], theirs) in pairs}
    else:
        domain = clue.domain
    allowed = _cells(domain)
    answer = {x for x in allowed & base if not taken(x)}
    reasons = {}
    for x in ctx.free_cells - answer:
        if x in placed.values():
            continue
        why = taken(x)
        if why is None and x not in base:
            why = _off_base(ctx, target, x)
        if why is None:
            why = _clue_reason(ctx, clue, target, partner, x)
        reasons[_key(x)] = why
    explain = _route_facts(ctx, target)
    if partner:
        explain += _route_facts(ctx, partner)
    explain += _clue_facts(ctx, clue, target, partner)
    nets = sorted({ctx.board.network_of(x) for x in answer})
    if answer and answer == {x for x in ctx.network_cells(*nets) if x in base and not taken(x)}:
        explain.append({"key": "nets", "packet": target.id, "nets": nets})
    if partner:
        r, c = partner.cell
        explain.append({"key": "lines", "packet": target.id, "other": partner.id, "r": r + 1, "c": c + 1})
    candidates = ctx.free_cells - set(placed.values())
    steps = [_ask_cells(target.id, answer, reasons, explain, candidates)]
    annul = _annul_step(ctx, clue, target, answer) if not clue.other else None
    if annul:
        steps.append(annul)
    return steps


def _step(ask, packet, answer, reasons, explain, given=(), extra=(), why=None):
    return {"ask": ask, "packet": packet,
            "answer": sorted(one_based(x) for x in answer),
            **({"extra": sorted(one_based(x) for x in extra)} if extra else {}),
            **({"given": sorted(one_based(x) for x in given)} if given else {}),
            "reasons": dict(sorted(reasons.items())),
            **({"why": dict(sorted(why.items()))} if why else {}),
            "explain": explain}


def _ask_cells(packet, answer, reasons, explain, candidates):
    """Paso con las casillas posibles del paquete o, si son más de la mitad, con las imposibles.

    `reasons` da el motivo de cada casilla de `candidates` que no está en `answer`."""
    if 2 * len(answer) <= len(candidates):
        return _step("possible", packet, answer, reasons, explain)
    impossible = candidates - answer
    wrong = {_key(x): {"key": "canBe", "packet": packet} for x in answer}
    return _step("impossible", packet, impossible, wrong, explain, why={_key(x): reasons[_key(x)] for x in impossible})


def _split(step):
    """(casillas posibles, motivo de cada imposible) de un paso `possible` o `impossible`."""
    if step["ask"] == "impossible":
        return list(step["reasons"]), step.get("why", {})
    return step["answer"], step["reasons"]


def _annul_step(ctx, clue, target, possible):
    """Casillas descartadas para los demás: las que anula la pista y, si todas las posibles del
    paquete están en una fila o columna, esa fila o columna."""
    if len(possible) < 2:
        return None
    free = ctx.free_cells
    annul = set(_cells(clue.excluded)) & free
    facts = []
    if clue.excluded:
        node = clue.params.get("nodeId")
        facts.append({"key": "annulUnique", "packet": target.id, "node": node})
    rows = {x[0] for x in possible}
    cols = {x[1] for x in possible}
    if len(rows) == 1:
        (r,) = rows
        annul |= {x for x in free if x[0] == r}
        facts.append({"key": "annulLine", "packet": target.id, "axis": "row", "line": r + 1})
    if len(cols) == 1:
        (c,) = cols
        annul |= {x for x in free if x[1] == c}
        facts.append({"key": "annulLine", "packet": target.id, "axis": "column", "line": c + 1})
    if not facts or (not clue.excluded and annul <= possible):
        return None
    # También descartadas, aunque no se piden: las que comparten fila con unas posibilidades y
    # columna con las demás.
    common = set(free)
    for x in possible:
        common &= {y for y in free if y[0] == x[0] or y[1] == x[1] or y == x}
    extra = common - annul
    reasons = {_key(x): {"key": "open", "packet": target.id} for x in free - annul - extra}
    return _step("annul", target.id, annul, reasons, facts, given=possible, extra=extra)


def _off_base(ctx, p, x):
    """Por qué una casilla no es de la ruta del paquete o no le llega el TTL."""
    net = ctx.board.network_of(x)
    if p.id in ctx.alternatives:
        return {"key": "hiddenOff", "packet": p.id, "net": net, "end": ctx.hidden[p.id]}
    route = ctx.routes.get(p.id)
    if route is None:
        return None
    if net not in route.networks:
        return {"key": "offRoute", "packet": p.id, "net": net}
    return {"key": "noTtl", "packet": p.id, "net": net, "k": route.networks.index(net), "ttl": route.ttl}


def _cls(params):
    return {"nodeType": params["nodeType"], **({"service": params["service"]} if "service" in params else {})}


def _clue_reason(ctx, clue, target, partner, x):
    """Por qué la pista descarta la casilla `x` para el paquete."""
    board = ctx.board
    net = board.network_of(x)
    t, params = clue.type, clue.params
    if clue.other:
        return _relation_reason(ctx, clue, target, partner, x)
    if t in ("node.adjacent_to_node", "node.unique_adjacent_to_node"):
        if "nodeId" not in params:
            return {"key": "notNextClass", "cls": _cls(params)}
        node = ctx.node(params["nodeId"])
        if x in side_neighbors(node.cell, board.height, board.width):
            return {"key": "notNextBorder", "node": node.id, "net": net}
        return {"key": "notNext", "node": node.id}
    if t == "node.not_adjacent_to_node":
        if "nodeId" in params:
            return {"key": "next", "node": params["nodeId"]}
        near = next(m for m in class_members(ctx.nodes, params) if x in ctx.adj[m.id])
        return {"key": "nextClass", "cls": _cls(params), "node": near.id}
    if t == "router.adjacent_to_router":
        return {"key": "notRouter", "router": params["routerId"]}
    if t == "spatial.in_row":
        return {"key": "row", "r": x[0] + 1}
    if t == "spatial.in_column":
        return {"key": "column", "c": x[1] + 1}
    if t.split(".")[0] in ROUTE_FAMILIES:
        if target.id in ctx.alternatives:
            # Con las redes del extremo que deja la pista, la ruta no pasa por aquí o no llega el TTL.
            return {"key": "hiddenNo", "packet": target.id, "net": net, "end": ctx.hidden[target.id],
                    "tags": sorted({y[2] for y in clue.domain})}
        route = ctx.routes[target.id]
        k = route.networks.index(net)
        if t == "ttl.routers_left":
            return {"key": "routeLeft", "packet": target.id, "net": net, "left": route.length - k}
        if t == "route.last_router":
            return {"key": "routeLast", "packet": target.id, "net": net, "k": k,
                    "router": route.routers[k - 1] if k else None}
        if t == "route.next_router":
            return {"key": "routeNext", "packet": target.id, "net": net,
                    "router": route.routers[k] if k < route.length else None}
        return {"key": "routeAt", "packet": target.id, "net": net, "k": k, "ttl": route.ttl - k}
    if t == "network.node_count":
        cls = {k: v for k, v in params.items() if k != "count"}
        count = sum(1 for m in class_members(ctx.nodes, cls) if m.network == net)
        return {"key": "netCount", "net": net, "cls": _cls(cls), "count": count}
    prefix = ctx.addressing.prefixes[net]
    if t == "network.prefix_length":
        return {"key": "netLength", "net": net, "prefix": str(prefix), "len": prefix.prefixlen}
    return {"key": "net", "net": net, "prefix": str(prefix)}


def _relation_reason(ctx, clue, target, partner, x):
    first = clue.packet == target.id
    rel = clue.relation
    mine = (rel.first if first else rel.second)[x]
    theirs = (rel.second if first else rel.first)[ctx.true_state(partner)]
    t = clue.type
    net = ctx.board.network_of(x)
    other_net = ctx.board.network_of(partner.cell)
    base = {"packet": target.id, "other": partner.id}
    if t == "relation.same_network":
        return {"key": "relNet", **base, "net": net, "otherNet": other_net}
    if t == "relation.routers_between":
        return {"key": "relDistance", **base, "net": net, "otherNet": other_net, "d": ctx.distance[(net, other_net)]}
    if t == "relation.more_addresses_network":
        return {"key": "relSize", **base, "net": net, "size": mine, "otherNet": other_net, "otherSize": theirs}
    if t == "relation.more_routers_crossed":
        return {"key": "relCrossed", **base, "net": net, "k": mine, "otherK": theirs}
    if t == "relation.higher_ttl":
        return {"key": "relTtl", **base, "net": net, "ttl": mine, "otherTtl": theirs}
    return {"key": "relLeft", **base, "net": net, "l": mine, "otherL": theirs}


def _route_facts(ctx, p):
    """Ruta y alcance del TTL de un paquete (o las rutas posibles, con un extremo oculto)."""
    route = ctx.routes.get(p.id)
    if route is None:
        return []
    if p.id in ctx.alternatives:
        kind = ctx.hidden[p.id]
        return [{"key": "hiddenAlt", "packet": p.id, "end": kind, "net": tag, "route": rt.networks,
                 "reach": rt.networks[rt.last_reachable], "full": rt.reaches_destination, "ttl": rt.ttl}
                for tag, rt in sorted(ctx.alternatives[p.id].items())]
    if route.broadcast:
        return [{"key": "broadcastRoute", "packet": p.id, "net": route.networks[0], "address": route.broadcast}]
    return [{"key": "route", "packet": p.id, "route": route.networks, "ttl": route.ttl,
             "reach": route.networks[route.last_reachable], "full": route.reaches_destination}]


def _clue_facts(ctx, clue, target, partner):
    """Cómo se lee la pista: las formas de nombrar con cálculo y lo que dice de las casillas."""
    facts = []
    for name, data in clue.slot_data.items():
        facts += _form_facts(ctx, clue, data)
    t, params = clue.type, clue.params
    if t in ("node.adjacent_to_node", "node.unique_adjacent_to_node", "node.not_adjacent_to_node"):
        facts.append({"key": "adjacentRule"})
    elif t == "router.adjacent_to_router":
        facts.append({"key": "routerRule", "router": params["routerId"],
                      "corner": ctx.router(params["routerId"]).corner})
    elif t == "route.in_transit_network":
        facts.append({"key": "transit", "net": ctx.transit})
    elif t in ("endpoint.origin", "endpoint.destination"):
        facts.append({"key": "endpointNode", "packet": target.id, "end": t.split(".")[1], "node": params["nodeId"],
                      "net": ctx.node(params["nodeId"]).network})
    elif t in ("endpoint.origin_class", "endpoint.destination_class"):
        nets = sorted({m.network for m in class_members(ctx.nodes, params)} & set(ctx.alternatives[target.id]))
        facts.append({"key": "endpointClass", "packet": target.id, "end": t.split(".")[1].split("_")[0],
                      "cls": _cls(params), "nets": nets})
    elif t in ("route.first_router", "route.final_router"):
        router = ctx.router(params["routerId"])
        facts.append({"key": "endRouter", "packet": target.id, "end": "origin" if "first" in t else "destination",
                      "router": router.id, "tags": sorted({y[2] for y in clue.domain})})
    elif clue.other:
        facts.append(_partner_fact(ctx, clue, partner))
        values = _relation_values(ctx, clue, target, partner)
        if values:
            facts.append(values)
    return facts


def _relation_values(ctx, clue, target, partner):
    """Lo que hay que comparar en una pista entre dos paquetes: el valor del paquete en cada
    red (direcciones, routers atravesados, TTL o routers que le quedan) o, en la de routers
    entre redes, las redes a esa distancia de la del otro paquete."""
    t = clue.type
    rel = clue.relation
    mine = rel.first if clue.packet == target.id else rel.second
    by_net = {}
    for x, value in mine.items():
        by_net.setdefault(ctx.board.network_of(cell_of(x)), value)
    if t == "relation.routers_between":
        d = clue.params["count"]
        other = ctx.board.network_of(partner.cell)
        nets = sorted(n for n in by_net if ctx.distance[(n, other)] == d)
        return {"key": "relAt", "other": partner.id, "otherNet": other, "d": d, "nets": nets}
    what = {"relation.more_addresses_network": "size", "relation.more_routers_crossed": "crossed",
            "relation.higher_ttl": "ttl", "relation.closer_to_destination": "left"}.get(t)
    if not what:
        return None
    route = ctx.routes.get(target.id)
    nets = [n for n in route.networks if n in by_net] if route else sorted(by_net)
    return {"key": "relValues", "packet": target.id, "what": what, "nets": nets, "values": [by_net[n] for n in nets]}


def _partner_fact(ctx, clue, partner):
    t = clue.type
    net = ctx.board.network_of(partner.cell)
    base = {"other": partner.id, "net": net}
    route = ctx.routes.get(partner.id)
    if t == "relation.same_network":
        return {"key": "pNet", **base}
    if t == "relation.routers_between":
        return {"key": "pDistance", **base, "d": clue.params["count"]}
    if t == "relation.more_addresses_network":
        prefix = ctx.addressing.prefixes[net]
        return {"key": "pSize", **base, "size": prefix.num_addresses, "prefix": str(prefix)}
    if t == "relation.more_routers_crossed":
        return {"key": "pCrossed", **base, "k": route.crossed}
    if t == "relation.higher_ttl":
        return {"key": "pTtl", **base, "ttl0": route.ttl, "k": route.crossed, "ttl": route.current_ttl}
    return {"key": "pLeft", **base, "left": route.length - route.crossed}


def _mask(length):
    return str(ipaddress.IPv4Network(f"0.0.0.0/{length}").netmask)


def _form_facts(ctx, clue, data):
    kind, ref, form, value = data["kind"], data["ref"], data["form"], data.get("value")
    addr = ctx.addressing
    if kind == "network":
        prefix = addr.prefixes[ref]
        common = {"net": ref, "prefix": str(prefix), "len": prefix.prefixlen, "size": prefix.num_addresses}
        simple = {"prefix": "fPrefix", "size_rank": "fSizeRank", "address_count": "fAddressCount",
                  "usable_count": "fUsableCount", "mask": "fMask", "privacy": "fPrivacy"}
        if form in simple:
            return [{"key": simple[form], **common, "mask": _mask(prefix.prefixlen), "value": value}]
        if form == "contents":
            return [{"key": "fContents", **common, "cls": _cls(value), "count": value["count"]}]
        if form in ("first_host", "last_host", "broadcast", "ip_member"):
            key = {"first_host": "fFirstHost", "last_host": "fLastHost", "broadcast": "fBroadcast",
                   "ip_member": "fIpMember"}[form]
            return [{"key": key, **common, "address": value, "id": str(prefix.network_address),
                     "broadcast": str(prefix.broadcast_address), "mask": _mask(prefix.prefixlen)}]
        return []
    if kind == "node":
        node = ctx.node(ref)
        prefix = addr.prefixes[node.network]
        common = {"node": ref, "net": node.network, "prefix": str(prefix)}
        if form == "label_prefix":
            return [{"key": "fNodePrefix", **common}]
        if form == "ip":
            return [{"key": "fNodeIp", **common, "address": value, "id": str(prefix.network_address),
                     "broadcast": str(prefix.broadcast_address)}]
        if form == "label_privacy":
            return [{"key": "fNodePrivacy", **common, "value": value}]
        return []
    if kind == "router":
        router = ctx.router(ref)
        nets = list(router.networks)
        if form == "networks_prefix":
            return [{"key": "fRouterPrefixes", "router": ref, "nets": nets,
                     "prefixes": [str(addr.prefixes[n]) for n in nets]}]
        if form == "interfaces":
            return [{"key": "fRouterIps", "router": ref, "nets": nets, "addresses": value,
                     "prefixes": [str(addr.prefixes[n]) for n in nets]}]
        if form == "privacy":
            net = next(n for n in nets if addr.privacy_rank(n) == value)
            return [{"key": "fRouterPrivacy", "router": ref, "net": net, "prefix": str(addr.prefixes[net]),
                     "value": value}]
        return []
    if kind == "length" and form in ("prefix_length", "address_count", "usable_count", "mask"):
        nets = sorted(n for n, p in addr.prefixes.items() if p.prefixlen == ref)
        return [{"key": "fLength", "form": form, "len": ref, "size": 2 ** (32 - ref), "mask": _mask(ref),
                 "nets": nets}]
    if kind in ("row", "column") and form in ("aligned_node", "aligned_router"):
        fact = {"key": "fAligned", "axis": kind, "line": ref}
        return [{**fact, "node": value["node"]} if form == "aligned_node" else {**fact, "router": value["router"]}]
    if kind == "view" and form == "mac_view":
        return [{"key": "fMac", "type": clue.type, "packet": clue.packet}]
    if kind == "ttl" and form == "ttl_value":
        ttl0 = ctx.routes[clue.packet].ttl
        params = clue.params
        if "count" in params:
            return [{"key": "fTtlValue", "packet": clue.packet, "ttl0": ttl0, "ttl": ttl0 - params["count"],
                     "k": params["count"]}]
        if "min" in params:
            return [{"key": "fTtlMax", "packet": clue.packet, "ttl0": ttl0, "bound": ttl0 - params["min"],
                     "k": params["min"]}]
        return [{"key": "fTtlMin", "packet": clue.packet, "ttl0": ttl0, "bound": ttl0 - params["max"],
                 "k": params["max"]}]
    return []


# ---------- Reglas del juego y rutas sin pista ----------

def _route_step(v, ctx, target):
    """Dónde puede estar el paquete solo con su ruta y su TTL."""
    base = _cells(ctx.base[target.id])
    reasons = {_key(x): _off_base(ctx, target, x) for x in ctx.free_cells - base}
    return _ask_cells(target.id, base, reasons, _route_facts(ctx, target), ctx.free_cells)


def _rules_exercise(v, ctx, namer, packets, rng):
    board, free = ctx.board, ctx.free_cells
    if v.special == "row_annul":
        a = packets[0]
        r, c = a.cell
        answer = {x for x in free if (x[0] == r or x[1] == c) and x != a.cell}
        reasons = {_key(x): {"key": "notLine", "packet": a.id, "r": r + 1, "c": c + 1}
                   for x in free - answer - {a.cell}}
        explain = [{"key": "rowColumn", "packet": a.id, "r": r + 1, "c": c + 1}]
        return [], [_step("annul", a.id, answer, reasons, explain)], {a.id: a.cell}

    a = packets[0]
    if v.special == "free_lines":
        placed = {p.id: p.cell for p in packets[1:4]}
    elif v.special == "last_cell":
        placed = {p.id: p.cell for p in packets[1:]}
    else:
        placed = {p.id: p.cell for p in packets[2:]}
    taken = _blocked(placed)
    rows = sorted({r for r in range(board.height)} - {x[0] for x in placed.values()})
    cols = sorted({c for c in range(board.width)} - {x[1] for x in placed.values()})
    open_cells = {x for x in free if x[0] in rows and x[1] in cols}
    explain = [{"key": "freeLines", "packet": a.id, "rows": [r + 1 for r in rows], "cols": [c + 1 for c in cols]}]
    clues = []
    answer = set(open_cells)
    forced = None
    if v.special == "forced_line":
        # B solo puede ir en una de las dos filas (o columnas) libres: A se queda con la otra.
        b = packets[1]
        clue = _pick_clue(IN_NETWORK, ctx, namer, b, None, rng)
        b_cells = _cells(clue.domain) & open_cells
        confined = [axis for axis in (0, 1) if {x[axis] for x in b_cells} == {b.cell[axis]}]
        if len(confined) != 1 or len(b_cells) < 2:
            raise Retry("ninguna fila ni columna obligada")
        (axis,) = confined
        forced = {"packet": a.id, "other": b.id, "axis": "row" if axis == 0 else "column",
                  "line": a.cell[axis] + 1, "otherLine": b.cell[axis] + 1}
        answer = {x for x in open_cells if x[axis] != b.cell[axis]}
        clues = [clue]
        explain.append({"key": "forcedLine", **forced})
    reasons = {}
    for x in free - answer:
        if x in placed.values():
            continue
        reasons[_key(x)] = taken(x) or {"key": "forced", **forced}
    return clues, [_ask_cells(a.id, answer, reasons, explain, free - set(placed.values()))], placed


# ---------- Validación y exportación ----------

def _check(v, ctx, steps, placed):
    first = steps[0]
    if first["ask"] == "annul":
        possible, impossible = first["answer"], first["reasons"]
    else:
        possible, impossible = _split(first)
    if len(possible) < v.min_answer:
        raise Retry("respuesta demasiado pequeña")
    if len(impossible) < 3:
        raise Retry("casi todas las casillas valen")
    if v.profile == "route" and not v.special:
        # La pista tiene que descartar algo dentro de la ruta (no basta con la ruta y el TTL).
        target = first["packet"]
        base = _cells(ctx.base[target])
        inside = [k for k, why in impossible.items()
                  if why and why["key"] not in ("offRoute", "noTtl", "hiddenOff", "rowTaken", "columnTaken")
                  and tuple(int(n) - 1 for n in k.split(",")) in base]
        if len(inside) < 2:
            raise Retry("la pista apenas descarta nada dentro de la ruta")
    for s in steps:
        if any(why is None for why in [*s["reasons"].values(), *s.get("why", {}).values()]):
            raise RuntimeError(f"{v.id}: casilla sin motivo")


def _export(v, seed, attempt, ctx, clues, steps, placed):
    board, addressing = ctx.board, ctx.addressing
    category = GAME_CATEGORY[v.category]
    return {
        "schemaVersion": SCHEMA_VERSION,
        "level": {"id": f"train-{v.id}-{seed}", "name": f"Entrenamiento {v.id}", "language": "es",
                  "category": category, "seed": seed},
        "addressing": {"plan": addressing.plan},
        "board": board_dict(board),
        "rules": {"onePacketPerCell": True, "onePacketPerRow": True, "onePacketPerColumn": True,
                  **({"packetOnRoute": True} if ctx.routes else {})},
        "networks": networks_list(board, addressing, ctx),
        "routers": [router_dict(board, addressing, r) for r in board.routers],
        "topology": topology_dict(board),
        "nodes": nodes_list(ctx.nodes, addressing),
        "packets": {"items": [packet_item(ctx, p) for p in ctx.packets]},
        "objective": {"type": "training"},
        "clues": [clue_dict(c) for c in clues],
        "solution": {"placements": {p.id: one_based(p.cell) for p in ctx.packets}},
        "training": {
            "variant": v.id,
            "category": v.category,
            "group": v.group,
            "keys": v.keys,
            "placed": {pid: one_based(cell) for pid, cell in placed.items()},
            "steps": steps,
        },
        "generation": {"generator": "netdoku_gen v0.4.8 (entrenamiento)", "attempt": attempt},
    }
