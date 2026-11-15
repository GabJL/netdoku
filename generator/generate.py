"""Genera niveles de Netdoku en JSON.

Uso:
    python generator/generate.py                 # un nivel con semilla aleatoria
    python generator/generate.py --seed 7 -n 5   # semillas 7, 8, 9, 10 y 11
    python generator/generate.py --print         # muestra el tablero en texto
    python generator/generate.py --stats -n 100  # reparto de dificultad, sin guardar
    python generator/generate.py --seeds 3,8,21  # semillas concretas

Los niveles se guardan en levels/generated/ junto con index.json, que es la
lista que lee el motor.
"""

import argparse
import collections
import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from netdoku_gen import build  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "levels" / "generated"


def ascii_board(level):
    h, w = level["board"]["height"], level["board"]["width"]
    grid = [[level["board"]["networkGrid"][r][c][-1] for c in range(w)] for r in range(h)]
    marks = [["." for _ in range(w)] for _ in range(h)]
    for n in level["nodes"]:
        r, c = n["position"]
        marks[r - 1][c - 1] = "#"
    for p in level["packets"]["items"]:
        r, c = p["solution"]["position"]
        marks[r - 1][c - 1] = p["id"]
    lines = ["    " + " ".join(f"{c + 1:>3}" for c in range(w))]
    for r in range(h):
        lines.append(f"{r + 1:>3} " + " ".join(f"{grid[r][c]}{marks[r][c]:>2}" for c in range(w)))
    return "\n".join(lines)


def update_index():
    levels = []
    for f in OUT_DIR.glob("netdoku-gen-*.json"):
        data = json.loads(f.read_text(encoding="utf-8"))
        difficulty = data["level"].get("difficulty") or {}
        levels.append({"file": f.name, "id": data["level"]["id"], "name": data["level"]["name"],
                       "clues": data["generation"]["clueCount"],
                       "logic": difficulty.get("logic"), "tier": difficulty.get("tier")})
    # Orden por dificultad y luego por semilla (numérica: gen-2 antes que gen-10).
    # El motor numera los niveles por su posición en el índice.
    levels.sort(key=lambda x: (x["logic"] or 0, int(x["id"].rsplit("-", 1)[1])))
    (OUT_DIR / "index.json").write_text(json.dumps({"levels": levels}, ensure_ascii=False, indent=2),
                                        encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="Generador de niveles de Netdoku (v0)")
    parser.add_argument("--seed", type=int, default=None)
    parser.add_argument("-n", "--count", type=int, default=1)
    parser.add_argument("--seeds", help="lista de semillas separadas por comas (en lugar de --seed y -n)")
    parser.add_argument("--packets", type=int, default=6)
    parser.add_argument("--networks", type=int, default=4)
    parser.add_argument("--print", action="store_true", help="muestra la solución en texto")
    parser.add_argument("--stats", action="store_true",
                        help="genera sin guardar y muestra el reparto de dificultad")
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    first = args.seed if args.seed is not None else random.randrange(1, 100000)
    reports = []
    seeds = [int(x) for x in args.seeds.split(",")] if args.seeds else range(first, first + args.count)
    for seed in seeds:
        level = build(seed, {"packets": args.packets, "networks": args.networks})
        g = level["generation"]
        d = g["difficulty"]
        reports.append(d)
        summary = (f"{g['clueCount']} pistas, dificultad {d['logic']} ({d['tier']}: {d['hardestTechnique']}, "
                   f"{d['bottlenecks']} cuellos de botella), intento {g['attempt']}")
        if args.stats:
            print(f"semilla {seed}: {summary}")
            continue
        path = OUT_DIR / f"{level['level']['id']}.json"
        path.write_text(json.dumps(level, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"{path.relative_to(ROOT)}: {summary}")
        if args.print:
            print(ascii_board(level))
            for c in level["clues"]:
                print(f"  {c['id']}: {c['text']}")
            print(f"  Víctima: {level['packets']['victimId']}  Atacante: {level['packets']['attackerId']}")
            print("  Resolución más sencilla: " + ", ".join(f"{t} ({n})" for t, n in d["trace"]))
    if args.stats:
        print_stats(reports)
    else:
        update_index()


def print_stats(reports):
    n = len(reports)
    print(f"\nReparto de dificultad en {n} niveles:")
    for logic, count in sorted(collections.Counter(r["logic"] for r in reports).items()):
        tier = next(r["tier"] for r in reports if r["logic"] == logic)
        print(f"  {logic} {tier:<12} {count:>4}  ({100 * count / n:.0f} %)")
    print("Técnica más difícil necesaria:")
    for name, count in collections.Counter(r["hardestTechnique"] for r in reports).most_common():
        print(f"  {name:<26} {count:>4}")


if __name__ == "__main__":
    main()
