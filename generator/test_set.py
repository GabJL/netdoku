"""Temporal: elige los niveles de la vista de pruebas del motor (#test) entre los
lotes del juego, para validar reglas y textos con pocos tableros.

Selección voraz que cubre cada subtipo de pista en 3 tableros; cada forma de
nombrar y cada plan de direcciones de Direccionamiento y de Tabla de
enrutamiento, en 1; cada particularidad de Encaminamiento (difusión, red de
tránsito, TTL que no llega al destino, router de esquina, origen o destino
oculto) y de Tabla de enrutamiento (estilo de tabla, siguiente salto con su IP),
en 2, y en cada categoría, una dificultad de 1-2, una de 3 y una de 4-5.
Prefiere los niveles fáciles, que se juegan antes.

Uso: python generator/test_set.py [--write] [--fresh] [subtype=N form=N ...]
Sin --write solo muestra la selección; con --write escribe levels/test.json.
Conserva los niveles que ya hay en levels/test.json (el jugador puede haberlos
validado) y solo añade los que faltan; con --fresh elige la lista desde cero.
"""
import collections
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent / "levels"
CATEGORIES = ["inicial", "direccionamiento", "encaminamiento", "enrutamiento"]
DEMAND = {"subtype": 3, "form": 1, "plan": 1, "feature": 2, "tier": 0}
for arg in sys.argv[1:]:
    if "=" in arg:
        k, v = arg.split("=")
        DEMAND[k] = int(v)


def features(d):
    out = set()
    items = d["packets"]["items"]
    if any("broadcast" in (p.get("destination") or {}) for p in items):
        out.add("broadcast")
    if any(n.get("transit") for n in d["networks"]):
        out.add("transit")
    if any(p.get("route") and len(p["route"]["routers"]) > p["ttl"]["initial"] - 1 for p in items):
        out.add("shortTtl")
    # Novedades de la v0.4.5 que no son un subtipo ni una forma.
    novelties = d.get("generation", {}).get("novelties", [])
    out |= {x for x in novelties if x in ("cornerRouter", "hiddenEndpoint")}
    # Tabla de enrutamiento (v0.5): estilo de las tablas y siguiente salto escrito con su IP.
    routing = d.get("routing")
    if routing:
        out.add(f"table:{routing['tableStyle']}")
        if routing["nextHop"] == "ip":
            out.add("nextHopIp")
    return out


def describe(path):
    d = json.loads(path.read_text(encoding="utf-8"))
    lv = d["level"]
    cat = lv["category"]
    subtypes = sorted({c["type"] for c in d["clues"]})
    forms = sorted({f for c in d["clues"] for f in (c.get("naming") or {}).values()})
    plan = d.get("addressing", {}).get("plan") if cat != "inicial" else None
    plan_item = plan if cat in ("direccionamiento", "enrutamiento") else None
    feats = sorted(features(d))
    items = {("subtype", s) for s in subtypes} | {("form", f) for f in forms} | {("feature", f) for f in feats}
    if plan_item:
        items.add(("plan", f"{cat}:{plan}"))
    items.add(("tier", f"{cat}:{lv['difficulty']['global']}"))
    return {
        "file": path.relative_to(ROOT).as_posix(),
        "seed": lv["seed"],
        "category": cat,
        "difficulty": {k: lv["difficulty"][k] for k in ("global", "logic", "reading")},
        "plan": plan,
        "clues": len(d["clues"]),
        "subtypes": subtypes,
        "forms": forms,
        "features": feats,
        "_items": items,
    }


def main():
    write = "--write" in sys.argv
    demand = dict(DEMAND)
    demand["tier"] = 0
    pool = [describe(p) for cat in CATEGORIES for p in sorted((ROOT / cat).glob("*/*.json"))]
    need = collections.Counter()
    for lv in pool:
        for kind, value in lv["_items"]:
            need[(kind, value)] = demand[kind]
    # En cada categoría, al menos una de 1-2, una de 3 y una de 4-5.
    for cat in CATEGORIES:
        for band in ("1-2", "3", "4-5"):
            need[("band", f"{cat}:{band}")] = 1
    for lv in pool:
        g = lv["difficulty"]["global"]
        band = "1-2" if g <= 2 else "3" if g == 3 else "4-5"
        lv["_items"].add(("band", f"{lv['category']}:{band}"))
    chosen = []
    # Los niveles de la lista actual se quedan: sus semillas pueden estar ya validadas.
    current = ROOT / "test.json"
    if current.exists() and "--fresh" not in sys.argv:
        keep = {x["file"] for x in json.loads(current.read_text(encoding="utf-8"))["levels"]}
        for lv in pool:
            if lv["file"] in keep:
                chosen.append(lv)
                for it in lv["_items"]:
                    need[it] -= 1
    while any(v > 0 for v in need.values()):
        def gain(lv):
            return sum(1 for it in lv["_items"] if need[it] > 0) / (1 + 0.2 * (lv["difficulty"]["global"] - 1))
        best = max((lv for lv in pool if lv not in chosen), key=lambda lv: (gain(lv), -lv["seed"]))
        if gain(best) == 0:
            break
        chosen.append(best)
        for it in best["_items"]:
            need[it] -= 1
    missing = [k for k, v in need.items() if v > 0]
    chosen.sort(key=lambda lv: (CATEGORIES.index(lv["category"]), lv["difficulty"]["global"], lv["seed"]))
    print(f"{len(chosen)} niveles de {len(pool)}; sin cubrir del todo: {missing}")
    for lv in chosen:
        print(f"  {lv['seed']} {lv['category'][:6]} d{lv['difficulty']['global']} "
              f"(l{lv['difficulty']['logic']} i{lv['difficulty']['reading']}) {lv['plan'] or ''} "
              f"{len(lv['subtypes'])} subtipos, {len(lv['forms'])} formas {', '.join(lv['features'])}")
    count = collections.Counter(it for lv in chosen for it in lv["_items"] if it[0] in ("subtype", "form"))
    print("veces:", ", ".join(f"{v}×{n}" for (k, v), n in sorted(count.items())))
    if write:
        out = [{k: v for k, v in lv.items() if not k.startswith("_")} for lv in chosen]
        (ROOT / "test.json").write_text(json.dumps({"levels": out}, ensure_ascii=False, indent=1) + "\n",
                                        encoding="utf-8", newline="\n")
        print("escrito levels/test.json")


if __name__ == "__main__":
    main()
