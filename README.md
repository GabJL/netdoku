# Netdoku

Juego de deducción lógica inspirado en Murdoku para la asignatura Redes y Servicios (UMA). El diseño está en `description.md` y en `implementation/`.

## Generar niveles (v0)

Requiere Python 3.10 o superior, sin dependencias externas.

```
python generator/generate.py --seed 1 -n 10     # niveles con semillas 1 a 10
python generator/generate.py --seed 7 --print   # muestra además la solución y las pistas
```

Los niveles se guardan en `levels/generated/` como JSON, junto con `index.json`, que es la lista que lee el motor. Opciones: `--packets` (6 por defecto) y `--networks` (4 por defecto).

## Jugar

El motor es una página web sin dependencias (`engine/`). Como carga los niveles con `fetch`, hay que servir la carpeta del proyecto con un servidor web; abriendo `index.html` directamente solo funciona el botón «Abrir nivel…».

```
python -m http.server 8000
```

Después, abrir <http://localhost:8000/engine/> en el navegador. Con `?level=netdoku-gen-3.json` se abre un nivel concreto.

Mecánica: arrastra cada paquete a su casilla (o selecciónalo y pulsa la casilla). Si aciertas, queda fijo; si fallas, vuelve al panel y pierdes una vida. Con todos colocados, identifica al atacante: el único otro paquete en la red de la víctima.

## Alcance de la v0

- Tablero 6×6 con 4 redes, routers de grado 2 en las fronteras, clientes y servidores con etiqueta.
- Pistas: `network.in_network`, `node.adjacent_to_node`, `node.unique_adjacent_to_node`, `router.adjacent_to_router`, `spatial.in_row` y `spatial.in_column` (véase `implementation/netdoku_catalogo_reglas.md`).
- La víctima tiene pistas, pero solo se resuelve después de los demás paquetes.
- Selección de pistas voraz con colocación directa y reservas; se comprueba por fuerza bruta que la solución es única. Aún no hay protocolos, rutas, TTL ni evaluación de dificultad.
