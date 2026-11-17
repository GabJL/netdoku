"""Genera los ejercicios de entrenamiento (v0.4.8).

    python generator/train.py                 # completa 3 ejercicios por variante
    python generator/train.py --count 5       # hasta 5 por variante
    python generator/train.py --variant inicial.row --replace
    python generator/train.py --list          # variantes y sus claves
    python generator/train.py --index         # solo regenera levels/train/index.json

Cada ejercicio va en levels/train/<variante>/<variante>-<semilla>.json y la
lista en levels/train/index.json, por categoría y ficha de ayuda. Las variantes
que usan algo desactivado en levels/disabled.txt no se generan ni salen en el
índice (sus ficheros se conservan). Las semillas de cada variante empiezan en
5 000 000 + 1 000 · su posición en la lista.
"""

import argparse
import json
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from netdoku_gen.switches import read_disabled  # noqa: E402
from netdoku_gen.training import VARIANTS, build_exercise, variant  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
TRAIN_DIR = ROOT / "levels" / "train"
DISABLED = ROOT / "levels" / "disabled.txt"
SEED_BASE = 5_000_000
CATEGORY_ORDER = ("rules", "inicial", "direccionamiento", "encaminamiento", "enrutamiento")


def seed_base(v):
    return SEED_BASE + 1_000 * VARIANTS.index(v)


def active(v, disabled):
    return not (set(v.keys) & disabled)


def _job(args):
    variant_id, seed, disabled = args
    try:
        return seed, build_exercise(variant(variant_id), seed, disabled), None
    except RuntimeError as e:
        return seed, None, str(e)


def fill(v, count, disabled, workers, replace=False):
    folder = TRAIN_DIR / v.id
    folder.mkdir(parents=True, exist_ok=True)
    if replace:
        for f in folder.glob("*.json"):
            f.unlink()
    have = sorted(folder.glob("*.json"))
    missing = count - len(have)
    if missing <= 0:
        return
    used = {int(f.stem.rsplit("-", 1)[1]) for f in have}
    seeds = [s for s in range(seed_base(v), seed_base(v) + 1_000) if s not in used][:missing]
    jobs = [(v.id, s, tuple(sorted(disabled))) for s in seeds]
    with ProcessPoolExecutor(max_workers=workers) as pool:
        for seed, exercise, error in pool.map(_job, jobs):
            if error:
                print(f"  {v.id} {seed}: {error}")
                continue
            path = folder / f"{v.id}-{seed}.json"
            path.write_text(json.dumps(exercise, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
            print(f"  {path.name}: {len(exercise['training']['steps'])} paso(s), "
                  f"{len(exercise['training']['steps'][0]['answer'])} casillas", flush=True)


def update_index(disabled):
    """levels/train/index.json: categorías → fichas de ayuda → variantes con sus ejercicios."""
    categories = {c: {} for c in CATEGORY_ORDER}
    for v in VARIANTS:
        folder = TRAIN_DIR / v.id
        files = sorted(folder.glob("*.json")) if folder.exists() else []
        if not files or not active(v, disabled):
            continue
        categories[v.category].setdefault(v.group, []).append(
            {"id": v.id, "keys": v.keys, "files": [f.relative_to(ROOT / "levels").as_posix() for f in files]})
    index = {"categories": [{"id": c, "groups": [{"id": g, "variants": vs} for g, vs in groups.items()]}
                            for c, groups in categories.items() if groups]}
    (TRAIN_DIR / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--count", type=int, default=3, help="ejercicios por variante")
    parser.add_argument("--variant", help="variantes separadas por comas (por defecto, todas)")
    parser.add_argument("--replace", action="store_true", help="borra antes los ejercicios de esas variantes")
    parser.add_argument("--workers", type=int, default=6)
    parser.add_argument("--list", action="store_true", help="muestra las variantes y sus claves")
    parser.add_argument("--index", action="store_true", help="solo regenera el índice")
    args = parser.parse_args()
    disabled = read_disabled(DISABLED)
    if args.list:
        for v in VARIANTS:
            mark = "" if active(v, disabled) else "  (desactivada)"
            print(f"{v.category:17} {v.group:18} {v.id:28} {', '.join(v.keys)}{mark}")
        return
    if not args.index:
        chosen = [variant(x) for x in args.variant.split(",")] if args.variant else VARIANTS
        for v in chosen:
            if not active(v, disabled):
                print(f"{v.id}: desactivada")
                continue
            print(v.id, flush=True)
            fill(v, args.count, disabled, args.workers, args.replace)
    update_index(disabled)


if __name__ == "__main__":
    main()
