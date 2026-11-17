# Versiones de Netdoku

## Sin publicar

Versión 0.4.8: modo Entrenar y reglas que se pueden desactivar.

- Entrenar, nueva opción del menú: ejercicios cortos para aprender cada pista y cada regla, ordenados por categoría (Reglas del juego, Inicial, Direccionamiento, Encaminamiento), ficha de ayuda y variante (69 variantes, 3 ejercicios de cada una). Cada uno es un tablero pequeño con un paquete por decidir y, si hacen falta, otros ya colocados. Según lo que importe en cada pista, hay que marcar las casillas donde puede estar el paquete, las que no (si son más de la mitad) o las que anula una pista que ya lo coloca («junto al servidor web, y ningún otro paquete lo estaba»: su fila, su columna y las casillas junto al servidor). Si una casilla no vale, el juego dice por qué; los fallos no cuentan. Se puede ver la explicación (la ruta y el TTL de cada paquete, el valor de cada red en las pistas que comparan dos paquetes, la red de cada dirección…) o la solución. Las reglas implícitas también tienen ejercicios: un paquete por fila y columna, filas y columnas libres, la última casilla y la fila o columna obligada. Las variantes resueltas se marcan con ✓ y cada ficha de la ayuda enlaza a sus ejercicios («Practicar»).
- Los ejercicios no se pueden resolver sin aplicar la pista. La red que nombra no es la única distinta de las demás a simple vista (la única que no empieza por 10, la única /24…), y el total de «Llevas X de Y» no delata a qué se refiere: si la pista nombrara otra red, otro servidor web u otra red de la ruta, alguna tendría el mismo número de casillas. Los de redes privadas y públicas mezclan bloques y longitudes y usan redes públicas que parecen privadas (172.40.0.0/16, 192.169.3.0/24).
- Reglas desactivables: cualquier pista, forma de nombrar o particularidad del tablero (routers de esquina, extremos ocultos, redes de tránsito, difusión) se puede desactivar en `levels/disabled.txt`. El generador deja de usarla, los niveles y ejercicios que ya la usan salen del juego sin borrarse y su ficha de ayuda desaparece. Por ahora no hay ninguna desactivada.
- Generador: `generator/train.py` y los módulos `training.py` y `switches.py`; `level.py` exporta por partes para reutilizarlas.
- Corregido: la pista «en la misma fila (o columna) que el equipo de usuario de la red Aulas» podía nombrar un equipo que no era el único de su clase en esa red, así que no se sabía cuál era. Pasaba en 54 de los 1500 niveles; en 53 la pista dice ahora «en la fila N» (mismo coste, misma solución, el progreso guardado sigue valiendo) y el otro (direccionamiento-2010086), que se quedaba sin ninguna pista de direcciones, se ha retirado y sustituido por uno nuevo. El generador ya no nombra así esos equipos. En Entrenar, el motivo de una casilla en otra fila dice dónde está el equipo o el router que nombra la pista.
- Sugerencias en Encaminamiento: cuando la deducción necesita la ruta o el TTL de un paquete, la sugerencia lo dice en un paso propio y resalta las casillas que descarta. La ruta: «El paquete A va por el camino con menos routers: Laboratorio → Biblioteca → Troncal → Secretaría. Solo puede estar en una red de su ruta, y no pasa por Desarrollo». El TTL: «El TTL inicial del paquete E es 4. Cada router le resta 1, y el que lo deja a 0 lo descarta: como mucho ha atravesado tres routers de su ruta, así que no llega a Investigación». Antes todo quedaba dentro de «con su ruta, su TTL, sus pistas y las filas y columnas…», sin decir qué casillas quitaba cada cosa. Sigue así con la víctima y con los paquetes de origen o destino oculto.
- La pista que compara el TTL de dos paquetes dice ahora «En ese momento, el paquete G llevaba más TTL que el paquete D»: compara el TTL actual (inicial menos routers atravesados), no el inicial, y antes no quedaba claro.
- En pantallas anchas, el tablero se queda a la vista al bajar por la lista de paquetes (en 7×7 son más y sus fichas más largas) y nunca es más alto que la ventana. En móvil no cambia: el tablero va encima de los paquetes y los taparía.

## 0.4.5 (16 de noviembre de 2026)

Lo que se dejó fuera de la v0.4: pistas entre dos paquetes, routers de tres o cuatro redes, orígenes y destinos ocultos, y redes privadas y públicas. Los lotes pasan de 75 a 100 niveles por dificultad (375 niveles nuevos); los 25 nuevos de cada una tienen al menos una novedad, y el juego los saca antes a quien ya haya jugado los anteriores.

- Pistas entre dos paquetes, que aparecen en la ficha de los dos: «Los paquetes A y B estaban en la misma red», «Las redes de los paquetes A y B eran vecinas: las unía un router», «Para ir de la red del paquete A a la del paquete B había que atravesar como mínimo dos routers» y, en Direccionamiento, «El paquete A estaba en una red con más direcciones que la del paquete B». En Encaminamiento, además: «había atravesado más routers que…», «llevaba más TTL que…», «le quedaban menos routers que… para llegar a la red de su destino», «habían salido de la misma red» e «iban a la misma red». Un nivel lleva como mucho dos, y nunca hablan de la víctima. Están en todos los niveles nuevos de Inicial y Direccionamiento y en 49 de los 125 de Encaminamiento.
- Encaminamiento: routers que unen tres o cuatro redes, dibujados en la esquina donde se juntan (como mucho dos por nivel; en 84 de los niveles nuevos).
- Encaminamiento: la ficha de un paquete puede no decir su origen o su destino («desconocido»); hay que deducirlo con pistas como «El paquete A lo había enviado el servidor web de la red Aulas», «La IP de origen del paquete A era…», «lo había enviado un servidor DNS», «El primer router de la ruta del paquete A era…, la puerta de enlace de su equipo de origen» o «El último router de su ruta era…». Cada red posible da una ruta distinta. Al resolver el nivel, la ficha muestra el equipo. Están en 81 de los niveles nuevos.
- Direccionamiento: algunos niveles mezclan redes privadas (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16) y públicas, y una red, un equipo o un router se pueden nombrar por ser la única pública o privada («la red pública», «el servidor web de la red pública», «el router de la red pública»). Coste de interpretación 1, o 2 si hay que mirar el rango 172.16.0.0/12. La categoría llega así hasta el bloque de NAT del temario. Por ahora sale poco (4 de los 125 niveles nuevos).
- Dificultad lógica: dos técnicas nuevas, «relación con un valor fijo» (nivel 1: el otro paquete ya tiene un solo valor) y «relación entre valores abiertos» (nivel 3). Las sugerencias las usan y explican qué casillas descarta la pista.
- Fichas de ayuda nuevas: «Entre dos paquetes», «Rutas de dos paquetes», «Origen o destino oculto», «Router en una esquina» y «Privadas y públicas», y teoría ampliada (redes privadas y NAT en Direccionamiento; routers de varias redes y puerta de enlace en Encaminamiento).
- Generador: posibilidades por estado (casilla y red del extremo oculto) en el solver, la dificultad y las sugerencias; `generate.py --novelties` exige alguna novedad, y `--print` muestra los extremos ocultos y los routers de esquina. Un nivel de Encaminamiento tarda unos 26 s (antes, 20).
- Vista de pruebas: conserva los 19 niveles anteriores y añade 23 para cubrir las pistas y novedades nuevas (42 en total).

## 0.4 (16 de noviembre de 2026)

Categoría nueva, Encaminamiento: rutas y TTL. 375 niveles nuevos (75 por dificultad), en tableros de 7×7 con 7 paquetes y 5 o 6 redes.

- La ficha de cada paquete muestra su origen, su destino y su TTL inicial (de 2 a 6). El paquete está en una red de su ruta, el camino con menos routers entre su origen y su destino, a la que le llega el TTL: con TTL inicial 3 solo puede haber atravesado dos routers, como en el ejercicio «No time to die». Al pasar el ratón por la ficha, o con el paquete seleccionado, el tablero marca su equipo de origen y el de destino.
- Redes de tránsito (Troncal), sin equipos, que solo unen routers, y paquetes de difusión, que no salen de la red de su origen.
- Pistas nuevas: «aún no había salido de la red de su origen», «ya había llegado a la red de su destino», «estaba pasando por una red de tránsito», «el último router que había atravesado era…», «el siguiente router que iba a atravesar era…», «había atravesado exactamente dos routers», «le quedaba un router para llegar a la red de su destino» y «ya había atravesado algún router» (o «al menos», «como mucho»). Cada nivel tiene al menos tres.
- Formas con coste de interpretación 1: la de la trama («la trama que lo llevaba iba dirigida al router…»: la MAC es la del siguiente salto, mientras que la IP de destino no cambia) y la del TTL actual («llevaba TTL 2», que hay que restar del inicial). Las redes, los equipos y los routers se pueden nombrar como en Direccionamiento.
- Fichas de ayuda nuevas (Rutas, TTL, Tramas y MAC, y las de las pistas nuevas) y teoría de la categoría. Las sugerencias tienen en cuenta la ruta y el TTL de cada paquete.
- Generador: módulo `routes.py`, perfil de categoría (`categoryProfiles` en la configuración) y `--category encaminamiento`; `--packets` y `--networks` toman por defecto los de la categoría.
- Vista de pruebas temporal (botón «Pruebas» del menú, con clave): una veintena de niveles fijos de los lotes, con su semilla, elegidos para que cada subtipo de pista salga en tres tableros, y cada forma de nombrar y cada plan de direcciones en uno (`generator/test_set.py`). Se juegan sin puntuar y se marcan como validados.

## 0.3.5 (16 de noviembre de 2026)

Pistas nuevas para Inicial y Direccionamiento. Los lotes pasan de 50 a 75 niveles por dificultad: los 25 nuevos de cada una usan las pistas nuevas, y el juego los saca antes a quien ya haya jugado los anteriores, porque elige entre los niveles que aún no ha visto.

- Pistas negativas: «El paquete A no estaba en la red Aulas», «no estaba junto al servidor web», «no estaba junto a ningún servidor». Obligan a razonar descartando.
- Pistas disyuntivas: «estaba en la red Aulas o en la red Servicios».
- Recuento de equipos: «estaba en una red sin servidores», «… con un solo servidor web», «… con exactamente dos equipos de usuario». Si solo una red cumple la descripción, sirve para nombrarla: «la red sin servidores».
- Filas y columnas nombradas por lo que hay en ellas: «en la misma fila que el servidor DNS», «en la misma columna que el router que une Aulas y Servicios».
- Direccionamiento: redes nombradas por su dirección de difusión, por su primera o su última dirección asignable, por su número de direcciones asignables («62 direcciones asignables») y, si es la única con esa longitud de prefijo, por su número de direcciones o su máscara. Costes de interpretación: la primera asignable, 1 (restando 1 sale el identificador, que está en la leyenda); las asignables, el tamaño y la máscara, 2; la difusión y la última asignable, como la red de una dirección (de 1 a 3 según el plan, con el punto de más por estar en el límite entre redes).
- Fichas de ayuda nuevas («No estaba…», «Una red u otra», «Recuento de equipos», «Difusión y asignables») y teoría de Direccionamiento ampliada con las direcciones asignables y el cálculo de la difusión.
- En Inicial, cada pista elige al azar cómo nombrar sus redes y filas entre las formas sin cálculo, para que los textos varíen.
- «y» pasa a «e» ante nombres que empiezan por «I» también en el texto que guarda el generador, como ya hacía el juego.
- Generador: en cada elección de pista se saltan las candidatas que no quitan ninguna casilla a su paquete y solo se propagan 40 al azar, para que los subtipos nuevos, con muchas instancias, no lo hagan más lento.

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
