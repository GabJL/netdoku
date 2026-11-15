# Versiones de Netdoku

## 0.1 (15 de noviembre de 2026)

Primera versión jugable. Los niveles usan conceptos de redes (redes, equipos, servidores, routers), pero sus pistas no exigen conocimientos de la asignatura: basta con leer el tablero, así que cualquiera puede jugarlos.

### Juego

- Tablero de 6×6 dividido en redes de colores, con equipos (clientes y servidores con su servicio) en algunas casillas y routers en las fronteras entre redes.
- Seis paquetes que hay que colocar a partir de las pistas. Regla básica: como mucho un paquete por fila y por columna, y uno por casilla; los paquetes solo van en casillas vacías.
- Objetivo: la víctima (marcada en su ficha) comparte red con un único paquete más, el atacante. Al colocar el último paquete el nivel se resuelve y se muestra el atacante, sin pregunta final.
- Se arrastran los paquetes a su casilla con ratón o con el dedo. Si la casilla es la correcta, el paquete queda fijo; si no, vuelve al panel y se pierde una de las tres vidas.

### Interfaz

- Tres columnas: ayuda del nivel y leyenda de redes, tablero, y fichas de paquetes. En pantallas medianas la ayuda pasa debajo; en el móvil, todo en una columna.
- Barra superior compacta: selector de nivel con flechas de anterior y siguiente (marca ✓ los resueltos), reiniciar, tema y botón + de apariencia, y vidas.
- Notas del jugador: interruptor Colocar / Anotar (también con la tecla A) para marcar candidatos en las casillas, y ✕ con clic derecho o pulsación larga. Nunca se ponen notas automáticamente.
- Fichas de paquete con sus pistas, que se pueden tachar. Al colocar un paquete su ficha se compacta y muestra su posición; sus pistas se pueden volver a desplegar.
- Ayuda que no estorba: etiquetas agrupadas por categoría (cómo jugar, reglas, pistas de este nivel, iconos) que abren una ficha con un mini tablero de ejemplo, y botón ? con la página de ayuda completa.
- Apariencia configurable: modo automático, claro u oscuro; paleta de redes (pastel, intensos, apta para daltonismo, grises); fondo de las casillas (liso, puntos, rayas, baldosas o una textura por red); equipos como dibujos, texto o ambos; números de fila y columna y nombres de red opcionales. Cada combinación se guarda como tema con nombre; hay cuatro de serie.
- El progreso de cada nivel (paquetes colocados, vidas, notas, pistas tachadas) se guarda en el navegador hasta pulsar reiniciar.
- Sin dependencias ni compilación: HTML, CSS y JavaScript servidos con cualquier servidor web.

### Generador

- Programa en Python 3.10+ sin dependencias (`generator/generate.py`) que escribe niveles en JSON y el índice que lee el motor.
- Tablero de 6×6 con 4 redes de al menos 6 casillas, creadas por crecimiento de regiones; prefijos IP por red; routers de grado 2 sobre un árbol generador más un ciclo opcional; de 1 a 3 equipos por red.
- Seis paquetes, uno por fila y columna; la víctima está en la única red con exactamente dos paquetes.
- Pistas (subtipos del catálogo `implementation/netdoku_catalogo_reglas.md`):
  - `network.in_network`: el paquete estaba en la red X.
  - `node.adjacent_to_node`: el paquete estaba junto a un equipo concreto.
  - `node.unique_adjacent_to_node`: el paquete estaba junto a un equipo y ningún otro paquete lo estaba.
  - `router.adjacent_to_router`: el paquete estaba junto al router que une dos redes.
  - `spatial.in_row` y `spatial.in_column`: el paquete estaba en una fila o columna (con poco peso y como mucho una por paquete).
- Selección voraz de pistas con varias ejecuciones; se queda con la que usa menos pistas espaciales y quita las redundantes. La víctima no recibe pistas: se localiza por descarte de filas y columnas.
- Validación de cada nivel: solución única por fuerza bruta y propagación (colocación directa, filas y columnas obligadas, reservas de casillas, filas y columnas) hasta la solución generada.
