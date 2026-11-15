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

El motor es una página web sin dependencias (`engine/`). Como carga los niveles con `fetch`, hay que servir la carpeta del proyecto con un servidor web; abriendo `index.html` directamente solo se puede jugar arrastrando un fichero de nivel JSON a la página.

```
python -m http.server 8000
```

Después, abrir <http://localhost:8000/engine/> en el navegador. Con `?level=netdoku-gen-3.json` se abre un nivel concreto.

Mecánica: como mucho un paquete por fila y por columna. Arrastra cada paquete a su casilla (o selecciónalo y pulsa la casilla). Si aciertas, queda fijo; si fallas, vuelve al panel y pierdes una vida. Al colocar el último paquete, el nivel queda resuelto y se muestra el atacante: el único otro paquete en la red de la víctima.

Un interruptor (o la tecla A) cambia entre **Colocar** paquetes y **Anotar**, que marca con un circulito del color del paquete las casillas donde el jugador cree que puede ir (como los candidatos del Sudoku; el juego nunca los rellena solo). En modo anotar, el tablero se rodea de un borde naranja. El clic derecho (o una pulsación larga en táctil) marca una casilla como descartada con ✕ y borra sus notas; anotar en una casilla descartada quita la ✕. Al colocar bien un paquete se borran sus notas y las de esa casilla.

A la izquierda del tablero está la ayuda del nivel, agrupada por colores (cómo jugar, reglas, pistas de este nivel e iconos), y la leyenda de redes; al pulsar una etiqueta se abre su explicación con un ejemplo. En la barra superior se elige el tema, y el botón «⚙ Apariencia» abre una ventana para combinar opciones independientes: modo (automático, claro u oscuro), colores de las redes (pastel, intensos, aptos para daltonismo, grises), fondo de las casillas (liso, puntos, rayas, baldosas o una textura por red), estilo de los equipos (dibujos, texto o ambos) y si se muestran los números de fila y columna y los nombres de las redes. Cada combinación se puede guardar como tema con nombre; se guardan en el navegador. El botón «Ayuda» abre en otra pestaña la página con todas (`engine/ayuda.html`).

El progreso de cada nivel (paquetes colocados, vidas, marcas y si está resuelto) se guarda en el navegador y se recupera al volver a abrirlo; «Reiniciar» lo borra. Los niveles resueltos aparecen con ✓ en la lista.

## Alcance de la v0

- Tablero 6×6 con 4 redes, routers de grado 2 en las fronteras, clientes y servidores con etiqueta.
- Pistas: `network.in_network`, `node.adjacent_to_node`, `node.unique_adjacent_to_node`, `router.adjacent_to_router`, `spatial.in_row` y `spatial.in_column` (véase `implementation/netdoku_catalogo_reglas.md`).
- Regla básica: como mucho un paquete por fila y por columna. Con 6 paquetes en un 6×6, la víctima se localiza por descarte, sin pistas propias.
- Selección de pistas voraz con colocación directa y reservas; se comprueba por fuerza bruta que la solución es única. Aún no hay protocolos, rutas, TTL ni evaluación de dificultad.
