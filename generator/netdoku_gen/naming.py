"""Formas de nombrar y dificultad de interpretación (véase netdoku_catalogo_reglas.md).

Las pistas se eligen por su efecto lógico (`D` y `A`); después se decide cómo
nombra cada una sus elementos (`slots`). La forma no cambia lo que deduce la
pista, solo el trabajo de pasar del texto a las casillas: su coste de interpretación
(0 a 3), su bloque temático y si es propia de la categoría Direccionamiento.
"""

import itertools
from dataclasses import replace

from .content import and_word, count_text, network_counts, node_classes

TOPICS = ["T3.dispositivos", "T3.vlan", "T3.ip", "T3.fragmentacion", "T3.subredes", "T3.vlsm",
          "T3.encaminamiento", "T3.nat", "T4.udp", "T4.tcp", "T5.dns", "T5.web",
          "T5.ficheros_correo", "T6"]
CATEGORIES = {"inicial": "Inicial", "direccionamiento": "Direccionamiento", "encaminamiento": "Encaminamiento"}
READING_TIERS = {1: "Muy fácil", 2: "Fácil", 3: "Media", 4: "Difícil", 5: "Muy difícil"}
# Formas que hablan del tamaño de las redes: exigen la aclaración sobre las casillas.
SIZE_FORMS = {"size_rank", "prefix_length", "address_count", "usable_count", "mask"}
# Peso al elegir entre formas posibles: las de tamaño solo existen en algunos
# planes (longitudes distintas), así que se favorecen cuando se pueden usar.
# `contents` pesa menos para que el nombre siga siendo lo habitual.
FORM_WEIGHTS = {"size_rank": 4.0, "prefix_length": 2.0, "address_count": 2.0, "usable_count": 3.0, "mask": 2.0,
                "broadcast": 1.5, "first_host": 2.5, "last_host": 1.5, "contents": 0.4}
# Las formas que cuentan direcciones solo se usan hasta 65 536 direcciones (/16).
MIN_COUNT_LENGTH = 16
SIZE_NOTE ="Las casillas no indican el tamaño de una red: su tamaño es su número de direcciones."


def topic_index(topic):
    return TOPICS.index(topic)


def max_topic(topics):
    return max(topics, key=topic_index)


def category_of(topic):
    return "inicial" if topic_index(topic) < topic_index("T3.ip") else "direccionamiento"


def reading_level(costs):
    """Dificultad de interpretación 1-5 a partir del coste de cada pista."""
    n3 = sum(1 for c in costs if c >= 3)
    n2 = sum(1 for c in costs if c == 2)
    if n3 >= 2:
        return 5
    if n3 == 1 or n2 >= 3:
        return 4
    if n2:
        return 3
    if any(c == 1 for c in costs):
        return 2
    return 1


def global_level(logic, reading):
    return min(5, max(logic, reading) + (1 if logic >= 3 and reading >= 3 else 0))


class Option:
    """Una forma concreta para un elemento: texto, coste, bloque y si es de la categoría."""

    def __init__(self, form, text, cost, topic, category, address=None, key=None, value=None):
        self.form, self.text, self.cost, self.topic, self.category = form, text, cost, topic, category
        self.address = address      # dirección que hay que fijar al usarla (equipos y routers)
        self.key = key
        self.value = value          # dato que necesita el motor para escribir la forma (dirección, rango)


class Namer:
    def __init__(self, rng, board, nodes, addressing, max_topic_allowed="T3.vlsm"):
        self.rng = rng
        self.board = board
        self.nodes = {n.id: n for n in nodes}
        self.all_nodes = nodes
        self.addr = addressing
        self.max_topic = max_topic_allowed

    def _ip_topic(self):
        return "T3.vlsm" if self.addr.plan == "vlsm" else "T3.subredes"

    def _allowed(self, opt):
        return topic_index(opt.topic) <= topic_index(self.max_topic)

    # ---- opciones por elemento ----

    def _ip_variants(self, net_id, key=None):
        """(dirección, coste) cerca y lejos de un límite, si se puede."""
        result = []
        if key is not None and key in self.addr.assigned:
            a = self.addr.assigned[key]
            return [(a, self.addr.cost(a, net_id))]
        for near in (False, True):
            a = self.addr.pick_address(self.rng, net_id, near=near)
            if a is not None:
                result.append((a, self.addr.cost(a, net_id)))
        return result

    def network_options(self, net_id):
        net = self.board.network(net_id)
        prefix = self.addr.prefixes[net_id]
        opts = [Option("name", f"{net.name} ({net.prefix})", 0, "T3.dispositivos", False),
                Option("prefix", net.prefix, 0, "T3.ip", True)]
        opts += self._contents_options(net_id)
        rank = self.addr.size_rank(net_id)
        if rank:
            words = "con más direcciones" if rank == "most" else "con menos direcciones"
            opts.append(Option("size_rank", words, 1, "T3.subredes", True, value=rank))
        # Por su longitud, si ninguna otra red la tiene.
        length = prefix.prefixlen
        if sum(1 for x in self.addr.prefixes.values() if x.prefixlen == length) == 1:
            opts += [o for o in self.length_options(length) if o.form == "mask"
                     or (o.form != "prefix_length" and length >= MIN_COUNT_LENGTH)]
        # Identificador, difusión y direcciones asignables.
        broadcast = prefix.broadcast_address
        first, last = prefix.network_address + 1, broadcast - 1
        opts += [Option("first_host", f"cuya primera dirección asignable es {first}", 1, "T3.subredes", True,
                        value=str(first)),
                 Option("broadcast", f"cuya dirección de difusión es {broadcast}", self.addr.cost(broadcast, net_id),
                        self._ip_topic(), True, value=str(broadcast)),
                 Option("last_host", f"cuya última dirección asignable es {last}", self.addr.cost(last, net_id),
                        self._ip_topic(), True, value=str(last))]
        for a, cost in self._ip_variants(net_id):
            opts.append(Option("ip_member", f"de la dirección {a}", cost, self._ip_topic(), True, value=str(a)))
        return opts

    def _contents_options(self, net_id):
        """La red descrita por el número de equipos de una clase, si ninguna otra red lo comparte."""
        opts = []
        for params in node_classes(self.all_nodes):
            counts = network_counts(self.all_nodes, self.board.networks, params)
            count = counts[net_id]
            if count <= 3 and list(counts.values()).count(count) == 1:
                opts.append(Option("contents", count_text(params, count), 0, "T3.dispositivos", False,
                                   value={**params, "count": count}))
        return opts

    def node_options(self, node_id):
        node = self.nodes[node_id]
        net = self.board.network(node.network)
        same_label = [n for n in self.all_nodes if n.label == node.label]
        if len(same_label) == 1:
            # Único en el tablero: nombrar su red o su dirección no aportaría nada.
            return [Option("label", f"al {node.label}", 0, "T3.dispositivos", False)]
        opts = [Option("label_network", f"al {node.label} de la red {net.name}", 0, "T3.dispositivos", False),
                Option("label_prefix", f"al {node.label} de la red {net.prefix}", 0, "T3.ip", True)]
        key = ("node", node_id)
        for a, cost in self._ip_variants(node.network, key):
            opts.append(Option("ip", f"al {node.label} {a}", cost, self._ip_topic(), True, address=a, key=key,
                               value=str(a)))
        return opts

    def router_options(self, router_id):
        r = next(x for x in self.board.routers if x.id == router_id)
        a, b = (self.board.network(n) for n in r.networks)
        opts = [Option("networks", f"que une {a.name} {and_word(b.name)} {b.name}", 0, "T3.dispositivos", False),
                Option("networks_prefix", f"que une {a.prefix} y {b.prefix}", 0, "T3.ip", True)]
        variants = [self._ip_variants(n, ("router", router_id, n)) for n in r.networks]
        for va, vb in itertools.product(*variants):
            cost = max(va[1], vb[1])
            opts.append(Option("interfaces", f"con las interfaces {va[0]} y {vb[0]}", cost, self._ip_topic(), True,
                               address=[va[0], vb[0]], value=[str(va[0]), str(vb[0])],
                               key=[("router", router_id, n) for n in r.networks]))
        return opts

    def length_options(self, length):
        mask = str(self._mask(length))
        count = 2 ** (32 - length)
        opts = [Option("prefix_length", f"/{length}", 1, "T3.ip", True),
                Option("address_count", f"de {count} direcciones", 2, "T3.subredes", True)]
        if length >= MIN_COUNT_LENGTH:
            opts.append(Option("usable_count", f"con {count - 2} direcciones asignables", 2, "T3.subredes", True))
        opts.append(Option("mask", f"con máscara {mask}", 2, "T3.subredes", True))
        return opts

    def line_options(self, axis, line):
        """Una fila o columna (desde 1) por su número o por un equipo o un router que esté en ella."""
        k = 0 if axis == "row" else 1
        word = "fila" if axis == "row" else "columna"
        opts = [Option("number", f"en la {word} {line}", 0, "T3.dispositivos", False)]
        for n in self.all_nodes:
            if n.cell[k] != line - 1:
                continue
            for o in self.node_options(n.id):
                if o.cost == 0:   # «al servidor…» pasa a «el servidor…»
                    opts.append(Option("aligned_node", f"en la misma {word} que el {o.text[3:]}", 0, o.topic,
                                       o.category, value={"node": n.id, "form": o.form}))
        for r in self.board.routers:
            (a, b) = r.between
            if a[k] == b[k] == line - 1:
                for o in self.router_options(r.id):
                    if o.cost == 0:
                        opts.append(Option("aligned_router", f"en la misma {word} que el router {o.text}", 0, o.topic,
                                           o.category, value={"router": r.id, "form": o.form}))
        return opts

    @staticmethod
    def _mask(length):
        import ipaddress
        return ipaddress.IPv4Network(f"0.0.0.0/{length}").netmask

    @staticmethod
    def view_options(_):
        """Pistas de ruta: desde la capa de red (la IP no cambia) o desde la trama (MAC del siguiente salto)."""
        return [Option("ip_view", "", 0, "T3.ip", False), Option("mac_view", "", 1, "T3.subredes", True)]

    @staticmethod
    def ttl_options(_):
        """Pistas de TTL: routers atravesados o TTL actual (hay que restarlo del inicial)."""
        return [Option("count", "", 0, "T3.ip", False), Option("ttl_value", "", 1, "T3.ip", True)]

    def slot_options(self, kind, value):
        maker = {"network": self.network_options, "node": self.node_options,
                 "router": self.router_options, "length": self.length_options,
                 "row": lambda v: self.line_options("row", v),
                 "column": lambda v: self.line_options("column", v),
                 "view": self.view_options, "ttl": self.ttl_options}[kind]
        return [o for o in maker(value) if self._allowed(o)]

    def plain(self, clues):
        """Formas de la categoría Inicial: al azar entre las de coste 0 que no son de otra categoría."""
        chosen = []
        for clue in clues:
            slots = {}
            for name, (kind, value) in clue.slots.items():
                opts = [o for o in self.slot_options(kind, value) if o.cost == 0 and not o.category]
                slots[name] = self.rng.choices(opts, weights=[FORM_WEIGHTS.get(o.form, 1.0) for o in opts])[0]
            chosen.append((0, slots))
        return chosen

    # ---- elección para todo el nivel ----

    def clue_options(self, clue, needed=True):
        """Combinaciones de formas de una pista: lista de (coste, opciones por hueco).

        Si su cálculo no es imprescindible (`needed` falso), solo formas de coste 0.
        """
        if not clue.slots:
            return [(0, {})]
        names = list(clue.slots)
        per_slot = [self.slot_options(*clue.slots[n]) for n in names]
        if not needed:
            per_slot = [[o for o in opts if o.cost == 0] for opts in per_slot]
        combos = []
        for choice in itertools.product(*per_slot):
            combos.append((max(o.cost for o in choice), dict(zip(names, choice))))
        return combos

    def assign(self, clues, reading, ratio, needed=None, tries=30, require_category=True):
        """Elige formas para obtener la dificultad de interpretación `reading` (o None si no se puede).

        `needed`: ids de las pistas cuyo cálculo es imprescindible (None = todas);
        las demás solo pueden usar formas de coste 0. `require_category`: al
        menos una forma de la categoría (en Encaminamiento no hace falta: la
        categoría la dan las pistas de ruta y TTL).
        """
        for _ in range(tries):
            result = self._try_assign(clues, reading, ratio, needed, require_category)
            if result is not None:
                return result
        return None

    def _try_assign(self, clues, reading, ratio, needed, require_category=True):
        rng = self.rng
        options = [self.clue_options(c, needed is None or c.id in needed) for c in clues]
        chosen = [None] * len(clues)

        def pick(i, predicate):
            fits = [o for o in options[i] if predicate(o)]
            if not fits:
                return None
            weights = [max(FORM_WEIGHTS.get(x.form, 1.0) for x in o[1].values()) if o[1] else 1.0 for o in fits]
            return rng.choices(fits, weights=weights)[0]

        def is_cat(o):
            return any(x.category for x in o[1].values())

        order = list(range(len(clues)))
        rng.shuffle(order)
        # Pistas caras que fijan la dificultad de interpretación.
        if reading == 5:
            needs = [(3, rng.choice([2, 2, 3]))]
        elif reading == 4:
            needs = [(3, 1)] if rng.random() < 0.6 else [(2, 3)]
        elif reading == 3:
            needs = [(2, rng.choice([1, 2]))]
        elif reading == 2:
            needs = [(1, rng.choice([1, 1, 2]))]
        else:
            needs = []
        for cost, count in needs:
            for i in order:
                if count == 0:
                    break
                if chosen[i] is None:
                    o = pick(i, lambda o, cost=cost: o[0] == cost)
                    if o:
                        chosen[i] = o
                        count -= 1
            if count:
                return None
        low_cap = {1: 0, 2: 1, 3: 1, 4: 2, 5: 2}[reading]
        namable = [i for i in range(len(clues)) if any(is_cat(o) for o in options[i])]
        wanted = max(1 if require_category else 0, round(ratio * len(namable)))
        have = sum(1 for o in chosen if o is not None and is_cat(o))
        for i in order:
            if chosen[i] is not None:
                continue
            if have < wanted and i in namable:
                o = pick(i, lambda o: is_cat(o) and o[0] <= low_cap)
                if o:
                    chosen[i] = o
                    have += 1
                    continue
            chosen[i] = pick(i, lambda o: not is_cat(o) and o[0] == 0) or pick(i, lambda o: o[0] <= low_cap)
            if chosen[i] is None:
                return None
        if (require_category and have < 1) or reading_level([o[0] for o in chosen]) != reading:
            return None
        # Los equipos y routers nombrados por dirección deben ser coherentes entre pistas.
        fixed = {}
        for _, slots in chosen:
            for o in slots.values():
                if o.key is None:
                    continue
                keys = o.key if isinstance(o.key, list) else [o.key]
                addrs = o.address if isinstance(o.address, list) else [o.address]
                for k, a in zip(keys, addrs):
                    if fixed.setdefault(k, a) != a:
                        return None
        return chosen, fixed

    def apply(self, clues, chosen, fixed):
        """Copias de las pistas con el texto, las formas, el coste y el bloque elegidos."""
        for key, a in fixed.items():
            self.addr.assigned[key] = a
            self.addr.used.add(a)
        result = []
        for clue, (cost, slots) in zip(clues, chosen):
            texts = {n: o.text for n, o in slots.items()}
            template = clue.template
            if isinstance(template, dict):
                # Pistas de ruta y TTL: la forma de toda la pista elige la frase.
                whole = slots.get("view") or slots.get("ttl")
                template = template[whole.form]
            topics = [clue.topic] + [o.topic for o in slots.values()]
            data = {}
            for n, o in slots.items():
                kind, ref = clue.slots[n]
                data[n] = {"kind": kind, "ref": ref, "form": o.form, **({"value": o.value} if o.value else {})}
            result.append(replace(clue, text=template.format(**texts) if slots else clue.text,
                                  naming={n: o.form for n, o in slots.items()}, slot_data=data,
                                  reading_cost=cost, topic=max_topic(topics)))
        return result

    def assign_remaining(self, nodes, routers):
        """Direcciones de los equipos y routers que no nombra ninguna pista."""
        for n in nodes:
            self.addr.assign(self.rng, ("node", n.id), n.network)
        for r in routers:
            for net in r.networks:
                self.addr.assign(self.rng, ("router", r.id, net), net)
