# Versiones de Netdoku

## 0.3.2 (16 de noviembre de 2026)

Sugerencias durante la partida y niveles de Direccionamiento cuya dificultad de interpretación solo cuenta cálculos imprescindibles.

- Sugerencias: si te atascas, el botón Sugerencia explica la siguiente deducción que puedes hacer, paso a paso y con sus casillas resaltadas, sin decir la casilla final. Si alguna ✕ tuya tapa un paquete, te lo avisa. Cuesta una vida (y una estrella), pide confirmación y no se puede usar con la última vida. Se calcula desde tu partida, sea cual sea el orden en que hayas colocado los paquetes, y deja la víctima para el final. Las estrellas son tres menos una por fallo o sugerencia.
- Las pistas de los niveles guardan sus casillas posibles (`domain`) y las que anulan (`excluded`), que usa el motor para las sugerencias. Se han añadido a los 500 niveles de los lotes sin cambiar nada más.
- Las pistas solo exigen cálculos imprescindibles. Antes, al nombrar un equipo por su dirección o un router por sus interfaces, a veces el resto de pistas ya dejaba claro a cuál se refería y el cálculo se podía saltar: el nivel era más fácil de lo que indicaba su dificultad. El generador comprueba ahora cada pista sustituyéndola por lo que dice sin calcular («junto a algún servidor DNS») y, si el nivel sigue saliendo igual, la nombra sin dirección. Se han sustituido los 58 niveles de Direccionamiento que tenían algún cálculo esquivable (10 de dificultad 2, 16 de 3, 14 de 4 y 18 de 5); en 35 de ellos la dificultad real era menor que la indicada.
- `generate.py --retire` quita niveles de los lotes. Los nombres retirados se apuntan en `levels/retired.txt` y no se reutilizan, para que el progreso guardado de un jugador nunca se aplique a un nivel distinto.

## 0.3.1 (16 de noviembre de 2026)

Mejoras de textos y de presentación, sin cambios en los niveles ni en el generador.

- Textos con historia: administras unas redes, alguien ha manipulado un paquete (la víctima) y hay que descubrir al atacante antes de que el ataque se extienda. Aparece en la pantalla inicial, en «Cómo se juega», en el objetivo de cada nivel y en los mensajes de nivel resuelto («¡Atrapado!») y perdido («el atacante ha escapado»).
- Las URL de los scripts y del CSS llevan la versión publicada, para que tras una actualización el navegador no mezcle ficheros nuevos y viejos de su caché.
- Botón de volver centrado (dibujado en SVG en lugar de con un carácter).
- Fichas de ayuda con ejemplo: el mini tablero flota a la derecha y el texto que queda por debajo ocupa todo el ancho.
- Tarjetas de categoría con el botón «Teoría y reglas» alineado abajo. La descripción de Inicial dice «No requiere conocimiento de redes».
- Teoría de cada categoría más completa y autocontenida: palabras clave en negrita, ejemplos cotidianos (la red de casa, el router de casa) y, en Direccionamiento, ejemplos calculados de máscara, pertenencia de una dirección a una red y subredes.
- «Sobre el juego» y el README indican la autoría (Gabriel Luque, con la ayuda de Claude), la licencia y el enlace al repositorio. «Sobre el juego» muestra el logotipo oficial de la Universidad de Málaga (versión positiva o negativa según el tema claro u oscuro), enlazado a su web; el README aclara que el logotipo no está bajo la licencia MIT y que Netdoku no es una aplicación oficial de la universidad.

## 0.3 (15 de noviembre de 2026)

Primera categoría con conocimientos de la asignatura: Direccionamiento. Las mismas pistas pueden nombrar redes, equipos y routers por su prefijo, por una dirección IP o por su tamaño, y eso da una dificultad de interpretación independiente de la lógica. El juego pasa a tener menú, progresión por categoría y dificultad, y versión en inglés.

- Categorías de niveles: Inicial (sin conocimientos previos) y Direccionamiento (prefijos, máscaras, pertenencia de una dirección a una red, VLSM).
- Planes de direcciones (`addressing.plan`): redes que se distinguen por el primer octeto, subredes de octeto completo, subredes con la misma máscara dentro de un octeto, y VLSM. Las redes nunca se solapan. Los equipos y los routers tienen dirección (no se muestra en el tablero).
- Formas de nombrar con coste de interpretación: nombre o prefijo (0); la red con más o menos direcciones y «una red /26» (1); número de direcciones y máscara (2); la red de una dirección, el equipo de una dirección y el router de dos interfaces (de 1 a 3 según el plan y si la dirección está cerca del límite con otra red).
- Pista nueva `network.prefix_length`: «estaba en una red /26» (o de 64 direcciones, o con máscara 255.255.255.192), cuando varias redes comparten esa longitud.
- Dificultad de interpretación (1 a 5) y dificultad global (la mayor de la lógica y la de interpretación, más un punto si ambas son 3 o más). En los niveles de Direccionamiento, una parte variable de las pistas usa formas de la categoría aunque cuesten 0 (`clues.naming.categoryFormRatio`).
- Las direcciones, máscaras y longitudes de las pistas se muestran sin el color de su red, para no adelantar el cálculo. Los niveles que hablan de tamaños recuerdan que las casillas no indican el tamaño de una red.
- Ayuda: fichas sobre prefijos, máscaras y tamaño de una red, sobre cómo saber a qué red pertenece una dirección y sobre la pista de longitud de prefijo.
- Lotes de niveles: `generate.py --pool 50` genera en paralelo 50 niveles por categoría y dificultad global en `levels/<categoría>/<dificultad>/` y su índice `levels/index.json`. Los niveles sueltos de prueba van a `levels/extra/`. Sustituyen a la colección elegida a mano de `levels/generated/`.
- Pantalla inicial con menú: Cómo se juega, Jugar, Estadísticas, Ayuda y Sobre el juego. Todo en una sola página (`ayuda.html` redirige a la ayuda).
- Progresión: cada categoría muestra cinco dificultades y cada una saca al azar un nivel de su lote, sin repetir hasta haberlos visto casi todos; ↺ da otro nivel de la misma dificultad. Se guarda el mejor resultado de cada dificultad (las estrellas nunca se pierden) y, para abrir una dificultad, hay que superar la anterior. Las categorías están todas abiertas; las completadas se distinguen por el color.
- Estadísticas: tabla de categorías y dificultades con el mejor resultado.
- En cada nivel, el botón «i» muestra la teoría de su categoría (resumen corto) y las reglas nuevas que introduce.
- Idiomas: español e inglés, con selector en la barra superior. Los textos de la interfaz, de la ayuda y de las pistas están en `engine/lang/`; el motor compone el texto de cada pista a partir de sus datos, así que los niveles sirven para cualquier idioma.
- Publicación en GitHub Pages con un workflow que publica el motor y los niveles. Licencia MIT.

## 0.2 (15 de noviembre de 2026)

Dificultad medida y niveles organizados por ella, puntuación con estrellas y pistas más legibles. Las pistas siguen siendo las de la 0.1 (sin conocimientos de la asignatura). En el diseño quedan definidas las formas de nombrar, la dificultad de lectura y la organización categoría → dificultad → nivel, que se implementarán con las categorías de redes.

- Documentación: formas de nombrar de redes y equipos en el catálogo de reglas, parámetro `difficulty.reading` y método de la dificultad lógica en `game_round_generation.md`.
- Dificultad lógica de cada nivel (1 a 5, de Muy fácil a Muy difícil), calculada simulando la resolución más sencilla: técnica más difícil necesaria (colocación directa, fila o columna obligada, anulación, reservas de 2, 3 o 4) y cuellos de botella. Se guarda en el nivel y en el índice.
- El selector de niveles los agrupa por dificultad, y el panel de ayuda muestra la del nivel.
- `generate.py --stats` genera niveles sin guardarlos y muestra el reparto de dificultad.
- Estrellas: al resolver un nivel por primera vez se obtienen tres menos una por fallo, contando los fallos de los intentos anteriores (reiniciar no los borra). Después quedan fijas, para que repetir el nivel con la solución ya vista no las mejore. La lista de niveles las muestra.
- En el texto de las pistas, los nombres de red aparecen resaltados con el color de su red, y el equipo nombrado con el color de su red y un punto del color de su servicio.
- Página de ayuda con dos fichas por fila, texto a la izquierda y mini tablero a la derecha.
- `generate.py --seeds` genera semillas concretas, y el índice ordena los niveles por dificultad.
- Nueva colección de niveles elegida de un lote de 700: tres por dificultad de la 1 a la 4 (con 5, 6 y 7 pistas o similar) y tres de la 5, que es muy rara con las pistas actuales (5 niveles en 2700 semillas).

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
