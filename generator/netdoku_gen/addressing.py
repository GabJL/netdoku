"""Planes de direcciones: prefijos de las redes y direcciones de equipos y routers.

Véanse `addressing.plan` en implementation/netdoku_parametros_configuracion.md y
el coste C en implementation/netdoku_catalogo_reglas.md. Las redes de un nivel
nunca se solapan y todos los prefijos están alineados con su máscara.

Con `privacy_mix` (addressing.privacyMix, v0.4.5), los planes `distinct` (de
redes públicas) y `octet_subnets` (de subredes privadas) cambian una red por
otra de la clase contraria y la misma máscara, para la forma `privacy`.
"""

import ipaddress

PLANS = ("distinct", "octet_subnets", "bit_subnets", "vlsm")
# Planes por zonas (v0.5, Tabla de enrutamiento): cada zona conexa del mapa tiene un bloque.
ZONE_PLANS = ("octet_zones", "bit_zones")
PLAN_COST = {"distinct": 1, "octet_subnets": 1, "bit_subnets": 2, "vlsm": 3, "octet_zones": 1, "bit_zones": 2}
PRIVATE_RANGES = [ipaddress.IPv4Network(x) for x in ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16")]
PRIVACY_PLANS = ("distinct", "octet_subnets")
# addressing.privacyMix.public172Ratio: redes públicas añadidas que empiezan por 172 (fuera de 172.16.0.0/12).
PUBLIC_172_RATIO = 0.5


def is_private(net):
    return any(net.subnet_of(r) for r in PRIVATE_RANGES)


def _net(text):
    return ipaddress.IPv4Network(text)


def _allocate(rng, block, lengths):
    """Subredes alineadas y disjuntas de `block` con las longitudes dadas (o None)."""
    chosen = []
    for length in sorted(lengths):              # primero las grandes
        options = [s for s in block.subnets(new_prefix=length)
                   if not any(s.overlaps(c) for c in chosen)]
        if not options:
            return None
        chosen.append(rng.choice(options))
    rng.shuffle(chosen)
    return chosen


def _distinct(rng, count):
    firsts = rng.sample([x for x in range(11, 224) if x not in (127, 169, 172, 192)], count)
    result = []
    for first in firsts:
        length = rng.choice([8, 16, 16, 24])
        second, third = rng.randrange(256), rng.randrange(256)
        address = {8: f"{first}.0.0.0", 16: f"{first}.{second}.0.0", 24: f"{first}.{second}.{third}.0"}[length]
        result.append(_net(f"{address}/{length}"))
    return result


def _octet_subnets(rng, count):
    if rng.random() < 0.5:
        # /16 y /24 dentro de 10.0.0.0/8.
        lengths = [rng.choice([16, 24]) for _ in range(count)]
        return _allocate(rng, _net("10.0.0.0/8"), lengths)
    block = rng.choice(["192.168.0.0/16", f"172.{rng.randrange(16, 32)}.0.0/16",
                        f"10.{rng.randrange(256)}.0.0/16"])
    return _allocate(rng, _net(block), [24] * count)


def _bit_subnets(rng, count):
    # Misma máscara, que no acaba en un octeto: /25 en un /23, /26 en un /24, /27 en un /24.
    length, block_length = rng.choice([(25, 23), (26, 24), (26, 24), (27, 24)])
    return _allocate(rng, _random_block(rng, block_length), [length] * count)


def _vlsm(rng, count):
    for _ in range(50):
        block_length = rng.choice([23, 24, 24])
        lengths = [rng.choice(range(block_length + 1, block_length + 5)) for _ in range(count)]
        if len(set(lengths)) < 2 or all(x % 8 == 0 for x in lengths):
            continue
        result = _allocate(rng, _random_block(rng, block_length), lengths)
        if result:
            return result
    return None


def _random_block(rng, length):
    family = rng.choice(["192.168", "172", "10"])
    if family == "192.168":
        third = rng.randrange(0, 256, 2 ** (24 - length))
        return _net(f"192.168.{third}.0/{length}")
    if family == "172":
        third = rng.randrange(0, 256, 2 ** (24 - length))
        return _net(f"172.{rng.randrange(16, 32)}.{third}.0/{length}")
    third = rng.randrange(0, 256, 2 ** (24 - length))
    return _net(f"10.{rng.randrange(256)}.{third}.0/{length}")


def _private_like(rng, length):
    """Una red privada con esa longitud (8, 16 o 24), para el plan `distinct`."""
    if length == 8:
        return _net("10.0.0.0/8")
    if length == 16:
        return _net(rng.choice([f"172.{rng.randrange(16, 32)}.0.0/16", "192.168.0.0/16", f"10.{rng.randrange(256)}.0.0/16"]))
    return _net(rng.choice([f"192.168.{rng.randrange(256)}.0/24", f"172.{rng.randrange(16, 32)}.{rng.randrange(256)}.0/24",
                            f"10.{rng.randrange(256)}.{rng.randrange(256)}.0/24"]))


def _public_like(rng, length):
    """Una red pública con esa longitud; a veces empieza por 172, fuera de 172.16.0.0/12."""
    if rng.random() < PUBLIC_172_RATIO:
        first, second = 172, rng.choice([x for x in range(256) if not 16 <= x <= 31])
    else:
        first, second = rng.choice([x for x in range(11, 224) if x not in (127, 169, 172, 192)]), rng.randrange(256)
    value = (first << 24) | (second << 16) | (rng.randrange(256) << 8)
    return ipaddress.IPv4Network((value, length), strict=False)


def _mix_privacy(rng, prefixes, plan):
    """Cambia una red por otra de la clase contraria (pública o privada) con la misma máscara."""
    result = list(prefixes)
    i = rng.randrange(len(result))
    length = result[i].prefixlen
    result[i] = _private_like(rng, length) if plan == "distinct" else _public_like(rng, length)
    return result


def make_prefixes(rng, count, plan, privacy_mix=False):
    maker = {"distinct": _distinct, "octet_subnets": _octet_subnets,
             "bit_subnets": _bit_subnets, "vlsm": _vlsm}[plan]
    for _ in range(100):
        result = maker(rng, count)
        if result and privacy_mix and plan in PRIVACY_PLANS:
            result = _mix_privacy(rng, result, plan)
        if result and all(not a.overlaps(b) for i, a in enumerate(result) for b in result[i + 1:]):
            return result
    raise RuntimeError(f"No se ha podido crear el plan de direcciones {plan}")


def _zones(rng, adjacency, count):
    """Reparte las redes en `count` grupos conexos de al menos dos redes."""
    nets = sorted(adjacency)
    for _ in range(100):
        zone = {s: i for i, s in enumerate(rng.sample(nets, count))}
        while len(zone) < len(nets):
            x, y = rng.choice(sorted((x, y) for x in zone for y in adjacency[x] if y not in zone))
            zone[y] = zone[x]
        groups = [[n for n in nets if zone[n] == i] for i in range(count)]
        if all(len(g) >= 2 for g in groups):
            return groups
    return None


def make_zone_prefixes(rng, adjacency, plan, counts=(2, 3)):
    """Prefijos de un plan por zonas: {red: prefijo} y [(bloque de la zona, [redes])].

    `octet_zones`: bloques /16 de 10.0.0.0/8 con redes /24. `bit_zones`: bloques cuya máscara no
    acaba en un octeto (/20 con redes /24, /25 con redes /27 o /26 con redes /28)."""
    options = [c for c in counts if 2 * c <= len(adjacency)]
    for _ in range(50):
        groups = _zones(rng, adjacency, rng.choice(options))
        if groups is None:
            continue
        if plan == "octet_zones":
            zone_len, net_len, parent = 16, 24, _net("10.0.0.0/8")
        else:
            zone_len, net_len = rng.choice([(20, 24), (25, 27), (26, 28)])
            if zone_len == 20:
                parent = _net(rng.choice([f"172.{rng.randrange(16, 32)}.0.0/16", f"10.{rng.randrange(256)}.0.0/16"]))
            elif zone_len == 25:
                parent = _net(rng.choice([f"192.168.{rng.randrange(0, 256, 2)}.0/23",
                                          f"10.{rng.randrange(256)}.{rng.randrange(0, 256, 2)}.0/23"]))
            else:
                parent = _net(rng.choice([f"192.168.{rng.randrange(256)}.0/24",
                                          f"10.{rng.randrange(256)}.{rng.randrange(256)}.0/24"]))
        blocks = rng.sample(list(parent.subnets(new_prefix=zone_len)), len(groups))
        if any(2 ** (net_len - zone_len) < len(g) for g in groups):
            continue
        prefixes, zones = {}, []
        for block, group in sorted(zip(blocks, groups)):
            for net, sub in zip(group, rng.sample(list(block.subnets(new_prefix=net_len)), len(group))):
                prefixes[net] = sub
            zones.append((block, group))
        return prefixes, zones
    raise RuntimeError(f"No se ha podido crear el plan de direcciones {plan}")


class Addressing:
    """Prefijos de un nivel, direcciones asignadas y coste de calcular su red."""

    def __init__(self, plan, prefixes, near_distance=4):
        self.plan = plan
        self.prefixes = prefixes            # id de red -> IPv4Network
        self.near_distance = near_distance
        self.used = set()                   # direcciones ya asignadas a equipos o routers
        self.assigned = {}                  # clave ("node", id) o ("router", id, red) -> IPv4Address

    def size(self, net_id):
        return self.prefixes[net_id].num_addresses

    def size_rank(self, net_id):
        """'most' o 'fewest' si la red es la única con más (o menos) direcciones."""
        sizes = {n: self.size(n) for n in self.prefixes}
        mine = sizes[net_id]
        if mine == max(sizes.values()) and list(sizes.values()).count(mine) == 1:
            return "most"
        if mine == min(sizes.values()) and list(sizes.values()).count(mine) == 1:
            return "fewest"
        return None

    def privacy_rank(self, net_id):
        """'public' o 'private' si la red es la única de su clase en el nivel."""
        private = {n: is_private(x) for n, x in self.prefixes.items()}
        mine = private[net_id]
        if list(private.values()).count(mine) == 1 and len(private) > 1:
            return "private" if mine else "public"
        return None

    def privacy_cost(self):
        """Coste de distinguir redes privadas y públicas: 2 si hay que mirar el rango 172.16.0.0/12."""
        return 2 if any(str(x).startswith("172.") for x in self.prefixes.values()) else 1

    def near_boundary(self, address, net_id):
        """La dirección está cerca del límite con otra red del nivel, y ese límite no se
        distingue comparando octetos enteros (alguna de las dos máscaras no acaba en un octeto)."""
        if not self.near_distance:
            return False
        net = self.prefixes[net_id]
        a = int(address)
        start, end = int(net.network_address), int(net.broadcast_address)

        def hard_neighbor(value):
            for n, o in self.prefixes.items():
                if n != net_id and int(o.network_address) <= value <= int(o.broadcast_address):
                    return net.prefixlen % 8 != 0 or o.prefixlen % 8 != 0
            return False

        return ((a - start <= self.near_distance and hard_neighbor(start - 1))
                or (end - a <= self.near_distance and hard_neighbor(end + 1)))

    def cost(self, address, net_id):
        """Coste C de calcular la red de una dirección."""
        c = PLAN_COST[self.plan]
        if self.near_boundary(address, net_id):
            c += 1
        return min(3, c)

    def _hosts(self, net_id):
        net = self.prefixes[net_id]
        first, last = int(net.network_address) + 1, int(net.broadcast_address) - 1
        return first, last

    def pick_address(self, rng, net_id, near=None, reserve=False):
        """Una dirección de host libre de la red; `near` pide que esté (o no) cerca de un límite."""
        first, last = self._hosts(net_id)
        candidates = []
        if near:
            d = self.near_distance
            candidates = list(range(first, min(last, first + d) + 1)) + list(range(max(first, last - d), last + 1))
        if not candidates:
            for _ in range(200):
                candidates.append(rng.randint(first, last))
        rng.shuffle(candidates)
        for value in candidates:
            address = ipaddress.IPv4Address(value)
            if address in self.used:
                continue
            if near is not None and self.near_boundary(address, net_id) != near:
                continue
            if reserve:
                self.used.add(address)
            return address
        return None

    def assign(self, rng, key, net_id, near=None):
        """Dirección fija de un equipo o de una interfaz de router."""
        if key in self.assigned:
            return self.assigned[key]
        address = self.pick_address(rng, net_id, near, reserve=True)
        if address is None:
            address = self.pick_address(rng, net_id, None, reserve=True)
        self.assigned[key] = address
        return address
