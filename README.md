# Netdoku

Juego de deducción lógica inspirado en Murdoku para la asignatura Redes y Servicios de la Universidad de Málaga. Se juega en <https://gabjl.github.io/netdoku/>. El diseño está en `description.md` y en `implementation/`.

Desarrollado por Gabriel Luque con la ayuda de Claude (Anthropic). Código abierto con licencia MIT (`LICENSE`), salvo el logotipo de la Universidad de Málaga (`engine/img/uma-*.png`), que es marca de la universidad, se ha tomado de su web oficial y no está cubierto por esa licencia. Netdoku es un proyecto docente de la asignatura, no una aplicación oficial de la universidad.

## Jugar

El juego es una página web sin dependencias (`engine/`), en español e inglés. Como carga los niveles con `fetch`, hay que servir la carpeta del proyecto con un servidor web; abriendo `index.html` directamente solo se puede jugar arrastrando un fichero de nivel JSON a la página.

```
python -m http.server 8000
```

Después, abrir <http://localhost:8000/engine/> en el navegador. El repositorio también se publica en GitHub Pages con cada push a `master` (`.github/workflows/pages.yml`, que publica solo `engine/` y `levels/`).

La pantalla inicial tiene cinco apartados: Cómo se juega, Jugar, Estadísticas, Ayuda y Sobre el juego. En «Jugar» se elige una categoría (cada una corresponde a un bloque de la asignatura) y una de sus cinco dificultades. Cada vez que se juega una dificultad sale un nivel distinto de su lote (100), y ↺ da otro. Para abrir una dificultad hay que superar la anterior; las categorías están todas abiertas. De cada dificultad se guarda el mejor resultado: tres estrellas menos una por fallo, que nunca se pierden.

Mecánica: como mucho un paquete por fila y por columna. Arrastra cada paquete a su casilla (o selecciónalo y pulsa la casilla). Si aciertas, queda fijo; si fallas, vuelve al panel y pierdes una vida. Al colocar el último paquete, el nivel queda resuelto y se muestra el atacante: el único otro paquete en la red de la víctima. Si te atascas, el botón Sugerencia explica la siguiente deducción (sin decir la casilla) a cambio de una vida.

Un interruptor (o la tecla A) cambia entre **Colocar** paquetes y **Anotar**, que marca con un circulito del color del paquete las casillas donde el jugador cree que puede ir (como los candidatos del Sudoku; el juego nunca los rellena solo). El clic derecho (o una pulsación larga en táctil) marca una casilla como descartada con ✕ y borra sus notas.

A la izquierda del tablero están la ayuda del nivel (cómo jugar, reglas, pistas de este nivel e iconos) y la leyenda de redes; el botón «i» de la barra superior muestra la teoría y las reglas nuevas de la categoría. La apariencia (modo claro u oscuro, colores, texturas, estilo de los equipos…) se configura con el botón + y se puede guardar como tema. El progreso se guarda en el navegador.

## Generar niveles

Requiere Python 3.10 o superior, sin dependencias externas.

```
python generator/generate.py --pool 100                      # lotes del juego: 100 niveles por categoría y dificultad
python generator/generate.py --pool 100 --difficulties 5     # solo la dificultad 5
python generator/generate.py --pool 100 --novelties          # los niveles que falten, con novedades de la v0.4.5
python generator/generate.py --retire direccionamiento-2020005   # quita un nivel de los lotes
python generator/generate.py --seed 7 --print                # nivel suelto en levels/extra/, con solución y pistas
python generator/generate.py --stats -n 100                  # reparto de dificultad, sin guardar niveles
```

Los lotes se guardan en `levels/<categoría>/<dificultad>/` como JSON, junto con `levels/index.json`, que es la lista que lee el juego. Los niveles retirados se apuntan en `levels/retired.txt` y sus nombres no se reutilizan.

## Alcance actual

- Tablero 6×6 con 4 redes, routers de dos redes en las fronteras, clientes y servidores.
- Categorías: Inicial (no requiere conocimiento de redes), Direccionamiento (prefijos, máscaras, pertenencia de una dirección a una red, VLSM, redes privadas y públicas) y Encaminamiento (rutas y TTL: cada paquete tiene origen, destino y TTL inicial y está en una red de su ruta; tablero 7×7 con 7 paquetes, routers de tres o cuatro redes en las esquinas y orígenes o destinos ocultos que hay que deducir).
- Pistas: `network.in_network`, `network.prefix_length`, `network.not_in_network`, `network.in_either_network`, `network.node_count`, `node.adjacent_to_node`, `node.unique_adjacent_to_node`, `node.not_adjacent_to_node`, `router.adjacent_to_router`, `spatial.in_row` y `spatial.in_column`, y en Encaminamiento `endpoint.in_origin_network`, `endpoint.in_destination_network`, `route.in_transit_network`, `route.last_router`, `route.next_router`, `ttl.routers_crossed`, `ttl.routers_left` y `ttl.routers_crossed_range`, y para los extremos ocultos `endpoint.origin`, `endpoint.destination`, sus variantes `_class`, `route.first_router` y `route.final_router`. Pistas entre dos paquetes: `relation.same_network`, `relation.routers_between`, `relation.more_addresses_network` y, en Encaminamiento, `relation.more_routers_crossed`, `relation.higher_ttl`, `relation.closer_to_destination`, `relation.same_origin` y `relation.same_destination` (véase `implementation/netdoku_catalogo_reglas.md`). Hay varias formas de nombrar redes (por nombre, prefijo, equipos que contiene, tamaño, máscara, una dirección, su difusión, su primera o última dirección asignable, o por ser la única pública o privada), equipos, routers, filas y columnas.
- Dificultad lógica y de interpretación (1 a 5) y dificultad global. Solución única comprobada por fuerza bruta.
