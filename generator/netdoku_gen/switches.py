"""Reglas activables: qué se puede desactivar en todo el juego y qué usa cada nivel.

Las reglas desactivadas se apuntan en levels/disabled.txt, una clave por línea:

- un subtipo de pista (`network.in_network`, `relation.higher_ttl`…);
- una forma de nombrar (`form:mask`, `form:ip_member`…);
- una particularidad del tablero (`feature:cornerRouter`, `feature:hiddenEndpoint`,
  `feature:transit`, `feature:broadcast`).

El generador no las usa al crear niveles ni ejercicios de entrenamiento;
`generate.py --index` deja fuera de levels/index.json los niveles que usan
alguna y copia la lista en el índice, para que el motor oculte también sus
fichas de ayuda y sus ejercicios. Los niveles no se borran: al reactivar la
regla y regenerar el índice vuelven a salir.

Las reglas básicas (un paquete por casilla, por fila y por columna) no se
pueden desactivar.
"""

from pathlib import Path

FEATURES = ("cornerRouter", "hiddenEndpoint", "transit", "broadcast")


def read_disabled(path):
    """Claves desactivadas en `path` (las líneas vacías y las que empiezan por # no cuentan)."""
    path = Path(path)
    if not path.exists():
        return set()
    return {line.split("#")[0].strip() for line in path.read_text(encoding="utf-8").splitlines()
            if line.split("#")[0].strip()}


def subtypes_of(disabled):
    return {k for k in disabled if ":" not in k}


def forms_of(disabled):
    return {k[5:] for k in disabled if k.startswith("form:")}


def features_of(disabled):
    return {k[8:] for k in disabled if k.startswith("feature:")}


def level_uses(level):
    """Claves de todo lo que usa un nivel exportado (subtipos, formas y particularidades)."""
    uses = set()
    for clue in level.get("clues", []):
        uses.add(clue["type"])
        uses.update(f"form:{form}" for form in (clue.get("naming") or {}).values())
    if any(r.get("position", {}).get("kind") == "corner" for r in level.get("routers", [])):
        uses.add("feature:cornerRouter")
    items = level.get("packets", {}).get("items", [])
    if any((p.get("origin") or {}).get("hidden") or (p.get("destination") or {}).get("hidden") for p in items):
        uses.add("feature:hiddenEndpoint")
    if any("broadcast" in (p.get("destination") or {}) for p in items):
        uses.add("feature:broadcast")
    if any(n.get("transit") for n in level.get("networks", [])):
        uses.add("feature:transit")
    return uses


def is_active(level, disabled):
    return not (level_uses(level) & set(disabled))
