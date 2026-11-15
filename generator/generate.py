"""Genera niveles de Netdoku en JSON.

Uso:
    python generator/generate.py                 # un nivel con semilla aleatoria
    python generator/generate.py --seed 7 -n 5   # semillas 7, 8, 9, 10 y 11
    python generator/generate.py --print         # muestra el tablero en texto

Los niveles se guardan en levels/generated/ junto con index.json, que es la
lista que lee el motor.
"""

import argparse
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
    # Orden numérico (gen-2 antes que gen-10): el motor numera los niveles por su posición.
    for f in sorted(OUT_DIR.glob("netdoku-gen-*.json"), key=lambda f: int(f.stem.rsplit("-", 1)[1])):
        data = json.loads(f.read_text(encoding="utf-8"))
        levels.append({"file": f.name, "id": data["level"]["id"], "name": data["level"]["name"],
                       "clues": data["generation"]["clueCount"]})
    (OUT_DIR / "index.json").write_text(json.dumps({"levels": levels}, ensure_ascii=False, indent=2),
                                        encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="Generador de niveles de Netdoku (v0)")
    parser.add_argument("--seed", type=int, default=None)
    parser.add_argument("-n", "--count", type=int, default=1)
    parser.add_argument("--packets", type=int, default=6)
    parser.add_argument("--networks", type=int, default=4)
    parser.add_argument("--print", action="store_true", help="muestra la solución en texto")
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    first = args.seed if args.seed is not None else random.randrange(1, 100000)
    for seed in range(first, first + args.count):
        level = build(seed, {"packets": args.packets, "networks": args.networks})
        path = OUT_DIR / f"{level['level']['id']}.json"
        path.write_text(json.dumps(level, ensure_ascii=False, indent=2), encoding="utf-8")
        g = level["generation"]
        print(f"{path.relative_to(ROOT)}: {g['clueCount']} pistas, reserva máx. {g['maxReservationSize']}, "
              f"intento {g['attempt']}")
        if args.print:
            print(ascii_board(level))
            for c in level["clues"]:
                print(f"  {c['id']}: {c['text']}")
            print(f"  Víctima: {level['packets']['victimId']}  Atacante: {level['packets']['attackerId']}")
    update_index()


if __name__ == "__main__":
    main()
