"""Generación completa de un nivel y exportación a JSON (formato de levels/*.yaml)."""

import random

from .board import generate_board
from .content import place_nodes, place_packets
from .rules import KNOWLEDGE, TOPIC, Context, generate_instances
from .selection import Selector
from .solver import count_solutions, initial_domains, propagate

SCHEMA_VERSION = "0.1"
DEFAULTS = {
    "height": 6,
    "width": 6,
    "networks": 4,
    "minNetworkSize": 6,
    "packets": 6,
    "maxSubset": 4,
    "selectionRuns": 12,
    "enabledRuleSubtypes": None,   # None = todos los de la v0
}


def one_based(cell):
    return [cell[0] + 1, cell[1] + 1]


def build(seed, config=None, max_attempts=200):
    cfg = {**DEFAULTS, **(config or {})}
    rng = random.Random(seed)
    last_error = None
    for attempt in range(1, max_attempts + 1):
        try:
            return _attempt(rng, seed, cfg, attempt)
        except RuntimeError as e:
            last_error = e
    raise RuntimeError(f"No se ha generado ningún nivel en {max_attempts} intentos: {last_error}")


def _attempt(rng, seed, cfg, attempt):
    board = generate_board(rng, cfg["height"], cfg["width"], cfg["networks"], cfg["minNetworkSize"])
    nodes = place_nodes(rng, board)
    packets, victim_net = place_packets(rng, board, nodes, cfg["packets"])
    ctx = Context(board, nodes, packets)
    pool = generate_instances(ctx, cfg["enabledRuleSubtypes"])
    victim = next(p for p in packets if p.role == "victim")
    attacker = next(p for p in packets if p.role == "attacker")
    selector = Selector(rng, ctx, pool, victim.id, cfg["maxSubset"])
    # Varias selecciones sobre el mismo tablero; se queda la que menos se apoya
    # en filas y columnas (y, sobre todo, en dar coordenadas).
    candidates = []
    for _ in range(cfg["selectionRuns"]):
        try:
            candidates.append(selector.select())
        except RuntimeError:
            pass
    if not candidates:
        raise RuntimeError("Las pistas disponibles no bastan para resolver el nivel")
    clues = min(candidates, key=_spatial_score)

    # Validación independiente: una única solución y que sea la generada.
    ids = [p.id for p in packets]
    domains = initial_domains(ctx.free_cells, ids, clues)
    if count_solutions(domains, limit=2) != 1:
        raise RuntimeError("El nivel no tiene solución única")
    solved, max_subset = propagate(domains, cfg["maxSubset"], exclude_from_subsets={victim.id})
    if any(solved[p.id] != {p.cell} for p in packets):
        raise RuntimeError("La propagación no llega a la solución generada")
    in_victim_net = [p for p in packets if board.network_of(p.cell) == victim_net]
    if sorted(p.id for p in in_victim_net) != sorted([victim.id, attacker.id]):
        raise RuntimeError("La red de la víctima no tiene exactamente dos paquetes")

    return to_dict(seed, attempt, board, nodes, packets, clues, victim, attacker, victim_net, max_subset)


def _spatial_score(clues):
    spatial = [c.packet for c in clues if c.type.startswith("spatial.")]
    coordinates = len(spatial) - len(set(spatial))
    return len(spatial) + 4 * coordinates + 0.2 * len(clues)


def to_dict(seed, attempt, board, nodes, packets, clues, victim, attacker, victim_net, max_subset):
    level_id = f"netdoku-gen-{seed}"
    by_type = {}
    for c in clues:
        by_type[c.type] = by_type.get(c.type, 0) + 1
    return {
        "schemaVersion": SCHEMA_VERSION,
        "level": {
            "id": level_id,
            "name": f"Nivel generado {seed}",
            "language": "es",
            "difficulty": None,
            "scenario": "same_network_attacker",
            "seed": seed,
        },
        "requirements": {"topic": TOPIC, "knowledge": KNOWLEDGE},
        "board": {
            "width": board.width,
            "height": board.height,
            "coordinateSystem": {"origin": "top-left", "rowIndexStartsAt": 1, "columnIndexStartsAt": 1},
            "networkGrid": board.grid,
        },
        "networks": [
            {"id": n.id, "name": n.name, "prefix": n.prefix,
             "cellCount": len(n.cells), "cells": [one_based(c) for c in n.cells]}
            for n in board.networks
        ],
        "routers": [
            {"id": r.id,
             "name": f"Router de {board.network(r.networks[0]).name} y {board.network(r.networks[1]).name}",
             "connectedNetworks": list(r.networks), "degree": 2,
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
             "label": n.label[0].upper() + n.label[1:], "network": n.network, "position": one_based(n.cell)}
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
            "text": (f"Coloca los paquetes e identifica al atacante. La víctima es el paquete {victim.id}: "
                     "en su red solo había otro paquete, el atacante."),
            "victimPacketId": victim.id,
            "packetsInVictimNetwork": 2,
            "observableAnswer": {"attackerPacketId": attacker.id},
        },
        "clues": [
            {"id": c.id, "packet": c.packet, "type": c.type, "text": c.text, "parameters": c.params}
            for c in clues
        ],
        "solution": {
            "placements": {p.id: one_based(p.cell) for p in packets},
            "victimNetwork": victim_net,
            "attackerPacketId": attacker.id,
        },
        "generation": {
            "generator": "netdoku_gen v0",
            "attempt": attempt,
            "clueCount": len(clues),
            "cluesByType": by_type,
            "maxReservationSize": max_subset,
        },
    }
