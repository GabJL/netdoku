"""Genera niveles de Netdoku en JSON.

Lotes del juego (lo que usa el motor):
    python generator/generate.py --pool 50                       # todas las categorías y dificultades
    python generator/generate.py --pool 50 --category inicial --difficulties 4,5
    python generator/generate.py --pool 100 --novelties               # solo niveles con novedades de la v0.4.5

Cada lote se guarda en levels/<categoría>/<dificultad>/ y levels/index.json
lista los ficheros de cada uno. Los lotes existentes se completan hasta el
tamaño pedido (no se borran niveles); --replace los vacía antes.

Reglas desactivadas (levels/disabled.txt, véase netdoku_gen/switches.py): los
niveles nuevos no las usan, los lotes se rellenan contando solo los niveles que
no las usan, y el índice deja fuera los que sí (sin borrarlos). Tras editar el
fichero basta con regenerar los índices (el de los niveles y el de los
ejercicios de entrenamiento, levels/train/index.json):
    python generator/generate.py --index

Para quitar niveles de los lotes:
    python generator/generate.py --retire direccionamiento-2020005,direccionamiento-2020011
Los nombres retirados (y los que borra --replace) se apuntan en
levels/retired.txt y no se vuelven a usar: si un jugador tenía uno a medias,
el juego le da otro en lugar de aplicar su progreso a un nivel distinto.

Niveles sueltos, para probar (se guardan en levels/extra/, que el motor no lee;
se pueden arrastrar a la página del juego):
    python generator/generate.py --seed 7 -n 5 --print
    python generator/generate.py --category direccionamiento --target 3 --print
    python generator/generate.py --stats -n 100 --category direccionamiento
"""

import argparse
import collections
import json
import multiprocessing
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from netdoku_gen import build  # noqa: E402
from netdoku_gen.addressing import PLANS  # noqa: E402
from netdoku_gen.naming import CATEGORIES  # noqa: E402
from netdoku_gen.switches import is_active, read_disabled  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
LEVELS_DIR = ROOT / "levels"
EXTRA_DIR = LEVELS_DIR / "extra"
RETIRED = LEVELS_DIR / "retired.txt"
DISABLED = LEVELS_DIR / "disabled.txt"
DIFFICULTIES = range(1, 6)
# Primera semilla de cada lote: categoría y dificultad no comparten semillas.
SEED_BASE = {"inicial": 1_000_000, "direccionamiento": 2_000_000, "encaminamiento": 3_000_000,
             "enrutamiento": 4_000_000}
# Filtros de los lotes: como mucho una pista de fila o columna por nivel.
POOL_CONFIG = {"maxSpatial": 1}


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


def summary(level):
    g = level["generation"]
    d = g["difficulty"]
    return (f"{g['clueCount']} pistas, dificultad {d['global']} (lógica {d['logic']}: "
            f"{d['hardestTechnique']}, {d['bottlenecks']} cuellos de botella; interpretación {d['reading']}, "
            f"plan {level['addressing']['plan']}), intento {g['attempt']}"
            + (f", novedades {'+'.join(g['novelties'])}" if g.get("novelties") else ""))


# ---------- Lotes ----------

def read_level(path):
    return json.loads(path.read_text(encoding="utf-8"))


def active_files(folder, disabled):
    """Niveles de un lote que no usan nada desactivado."""
    files = sorted(folder.glob("*.json")) if folder.exists() else []
    if not disabled:
        return files
    return [f for f in files if is_active(read_level(f), disabled)]


def update_index():
    """levels/index.json: categorías en orden y, en cada una, los ficheros de cada dificultad.

    Deja fuera los niveles que usan algo desactivado y copia la lista de
    desactivados para que el motor oculte también sus fichas y ejercicios.
    """
    disabled = read_disabled(DISABLED)
    categories = []
    hidden = 0
    for cat in CATEGORIES:
        difficulties = {}
        for d in DIFFICULTIES:
            folder = LEVELS_DIR / cat / str(d)
            files = active_files(folder, disabled)
            hidden += len(list(folder.glob("*.json"))) - len(files) if folder.exists() else 0
            if files:
                difficulties[str(d)] = [f.relative_to(LEVELS_DIR).as_posix() for f in files]
        if difficulties:
            categories.append({"id": cat, "difficulties": difficulties})
    index = {"categories": categories, "disabled": sorted(disabled)}
    (LEVELS_DIR / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")
    if disabled:
        print(f"Reglas desactivadas: {', '.join(sorted(disabled))}; {hidden} niveles fuera del índice")
    if (LEVELS_DIR / "train").exists():   # los ejercicios de entrenamiento siguen la misma lista
        import train
        train.update_index(disabled)


def read_retired():
    if not RETIRED.exists():
        return set()
    return {line.strip() for line in RETIRED.read_text(encoding="utf-8").splitlines()
            if line.strip() and not line.startswith("#")}


def record_retired(names):
    """Apunta nombres de nivel que no deben reutilizarse."""
    names = read_retired() | set(names)
    header = "# Niveles retirados de los lotes: generate.py no vuelve a usar estos nombres.\n"
    RETIRED.write_text(header + "".join(f"{n}\n" for n in sorted(names)), encoding="utf-8", newline="\n")


def retire(names):
    """Borra niveles de los lotes y apunta sus nombres como retirados."""
    removed = []
    for name in names:
        found = list(LEVELS_DIR.glob(f"*/*/{name}.json"))
        if not found:
            print(f"{name}: no está en ningún lote")
        for f in found:
            f.unlink()
            removed.append(name)
            print(f"retirado {f.relative_to(ROOT).as_posix()}")
    record_retired(removed)
    update_index()


def _pool_job(args):
    seed, category, target, novelties, disabled = args
    config = {**POOL_CONFIG, "category": category, "target": target, "novelties": novelties, "disabled": disabled,
              "selectionRuns": 40 if category == "inicial" and target == 5 else 12}
    try:
        return seed, build(seed, config, max_attempts=100)
    except RuntimeError:
        return seed, None


def fill_pool(category, target, size, workers, replace, novelties=False):
    folder = LEVELS_DIR / category / str(target)
    folder.mkdir(parents=True, exist_ok=True)
    if replace:
        removed = [f.stem for f in folder.glob("*.json")]
        for f in folder.glob("*.json"):
            f.unlink()
        record_retired(removed)
    disabled = read_disabled(DISABLED)
    existing = {f.stem for f in folder.glob("*.json")}
    have = {f.stem for f in active_files(folder, disabled)}   # los que usan algo desactivado no cuentan
    retired = read_retired()
    missing = size - len(have)
    if missing <= 0:
        print(f"{category} {target}: ya tiene {len(have)} niveles")
        return
    base = SEED_BASE[category] + 10_000 * target
    # Se sigue tras la semilla más alta del lote (o retirada): las que faltan por debajo
    # fallaron o se cortaron en una tanda anterior, y repetirlas solo gasta tiempo.
    used = [int(n.rsplit("-", 1)[1]) for n in existing | retired if n.startswith(f"{category}-")]
    start = max((s for s in used if base <= s < base + 10_000), default=base - 1) + 1
    seeds = (s for s in range(start, base + 10_000)
             if f"{category}-{s}" not in existing and f"{category}-{s}" not in retired)
    jobs = ((s, category, target, novelties, tuple(sorted(disabled))) for s in seeds)
    made = 0
    with multiprocessing.Pool(workers) as pool:
        for seed, level in pool.imap_unordered(_pool_job, jobs):
            if level is None:
                continue
            path = folder / f"{level['level']['id']}.json"
            path.write_text(json.dumps(level, ensure_ascii=False, indent=1), encoding="utf-8")
            made += 1
            print(f"{category} {target} [{len(have) + made}/{size}] {path.name}: {summary(level)}", flush=True)
            if made >= missing:
                pool.terminate()
                break


# ---------- Niveles sueltos ----------

def print_stats(reports):
    n = len(reports)
    for key, title in (("global", "global"), ("logic", "lógica"), ("reading", "de interpretación")):
        print(f"\nReparto de la dificultad {title} en {n} niveles:")
        for value, count in sorted(collections.Counter(r[key] for r in reports).items()):
            print(f"  {value} {count:>4}  ({100 * count / n:.0f} %)")
    print("Técnica más difícil necesaria:")
    for name, count in collections.Counter(r["hardestTechnique"] for r in reports).most_common():
        print(f"  {name:<26} {count:>4}")


def main():
    parser = argparse.ArgumentParser(description="Generador de niveles de Netdoku")
    parser.add_argument("--pool", type=int, metavar="N", help="rellena los lotes del juego hasta N niveles")
    parser.add_argument("--difficulties", help="dificultades de los lotes, separadas por comas (por defecto, 1-5)")
    parser.add_argument("--workers", type=int, default=max(1, (multiprocessing.cpu_count() or 2) - 1))
    parser.add_argument("--replace", action="store_true", help="vacía los lotes antes de rellenarlos")
    parser.add_argument("--index", action="store_true", help="solo regenera levels/index.json")
    parser.add_argument("--retire", metavar="NOMBRES",
                        help="quita de los lotes estos niveles (separados por comas) y no reutiliza sus nombres")
    parser.add_argument("--seed", type=int, default=None)
    parser.add_argument("-n", "--count", type=int, default=1)
    parser.add_argument("--seeds", help="lista de semillas separadas por comas (en lugar de --seed y -n)")
    parser.add_argument("--packets", type=int, help="paquetes (por defecto, los de la categoría)")
    parser.add_argument("--networks", type=int, help="redes (por defecto, las de la categoría)")
    parser.add_argument("--category", choices=list(CATEGORIES),
                        help="categoría (por defecto: todas con --pool, inicial sin él)")
    parser.add_argument("--target", type=int, choices=DIFFICULTIES, help="dificultad global buscada")
    parser.add_argument("--reading", type=int, choices=DIFFICULTIES,
                        help="dificultad de interpretación buscada (Direccionamiento, sin --target); por defecto, al azar")
    parser.add_argument("--plan", choices=("auto",) + PLANS, default="auto", help="plan de direcciones")
    parser.add_argument("--novelties", action="store_true",
                        help="solo niveles con alguna novedad de la v0.4.5 (pistas entre dos paquetes, routers de "
                             "esquina, extremos ocultos o redes privadas y públicas)")
    parser.add_argument("--print", action="store_true", help="muestra la solución en texto")
    parser.add_argument("--stats", action="store_true",
                        help="genera sin guardar y muestra el reparto de dificultad")
    args = parser.parse_args()

    if args.index:
        update_index()
        return
    if args.retire:
        retire([x.strip() for x in args.retire.split(",") if x.strip()])
        return
    if args.pool:
        categories = [args.category] if args.category else list(CATEGORIES)
        targets = [int(x) for x in args.difficulties.split(",")] if args.difficulties else list(DIFFICULTIES)
        for category in categories:
            for target in targets:
                fill_pool(category, target, args.pool, args.workers, args.replace, args.novelties)
        update_index()
        return

    EXTRA_DIR.mkdir(parents=True, exist_ok=True)
    first = args.seed if args.seed is not None else random.randrange(1, 100000)
    reports = []
    seeds = [int(x) for x in args.seeds.split(",")] if args.seeds else range(first, first + args.count)
    for seed in seeds:
        level = build(seed, {"packets": args.packets, "networks": args.networks,
                             "category": args.category or "inicial", "target": args.target,
                             "reading": args.reading, "plan": args.plan, "novelties": args.novelties,
                             "disabled": read_disabled(DISABLED)})
        d = level["generation"]["difficulty"]
        reports.append(d)
        if args.stats:
            print(f"semilla {seed}: {summary(level)}")
            continue
        path = EXTRA_DIR / f"{level['level']['id']}.json"
        path.write_text(json.dumps(level, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"{path.relative_to(ROOT)}: {summary(level)}")
        if args.print:
            print(ascii_board(level))
            for p in level["packets"]["items"]:
                if "route" in p:
                    # Un extremo oculto se muestra entre paréntesis (su equipo está en la solución).
                    end = lambda k: (f"(oculto: {p['solution'][k]})" if p[k].get("hidden")  # noqa: E731
                                     else p[k].get("node") or f"difusión {p[k]['broadcast']}")
                    print(f"  {p['id']}: {end('origin')} -> {end('destination')}, TTL {p['ttl']['initial']}, "
                          f"ruta {'-'.join(p['route']['networks'])}, atravesados {p['solution']['routersCrossed']}")
            for c in level["clues"]:
                print(f"  {c['id']} [{c['readingCost']}]: {c['text']}")
            print(f"  Víctima: {level['packets']['victimId']}  Atacante: {level['packets']['attackerId']}")
            print("  Resolución más sencilla: " + ", ".join(f"{t} ({n})" for t, n in d["trace"]))
            print("  Redes: " + ", ".join(f"{n['name']} {n['prefix']}" for n in level["networks"]))
            corners = [r["name"] for r in level["routers"] if r["position"]["kind"] == "corner"]
            if corners:
                print("  Routers de esquina: " + "; ".join(corners))
            routing = level.get("routing")
            if routing:
                costs = d.get("routeCosts", {})
                print(f"  Tablas {routing['tableStyle']}, siguiente salto por {routing['nextHop']}; "
                      f"rutas que exigen las tablas (coste): "
                      + ", ".join(f"{pid} ({c})" for pid, c in sorted(costs.items())))
                for p in level["packets"]["items"]:
                    decisions = p.get("route", {}).get("tableDecisions")
                    if decisions:
                        print(f"    {p['id']}: decide {', '.join(decisions)}")
                print("  Puertas de enlace: " + ", ".join(f"{n} {r}" for n, r in routing["gateways"].items()))
                for r in level["routers"]:
                    nets = "+".join(r["connectedNetworks"])
                    entries = ", ".join(f"{e['prefix']} -> {'directa' if e.get('direct') else e['via']}"
                                        for e in routing["tables"][r["id"]])
                    print(f"    {r['id']} ({nets}): {entries}")
    if args.stats:
        print_stats(reports)


if __name__ == "__main__":
    main()
