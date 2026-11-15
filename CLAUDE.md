# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Estado del proyecto

Netdoku es un juego de deducción lógica inspirado en **Murdoku** para enseñar Redes de Computadores (asignatura Redes y Servicios, UMA). El diseño está en Markdown y YAML (`description.md`, `implementation/`). Hay una **v0** jugable que se desarrolla de forma iterativa: un generador sencillo en Python y un motor web; cada iteración añade pistas y elementos a ambos. La documentación está en español y el código debe mantener la terminología de esos documentos.

## Comandos

- Generar niveles: `python generator/generate.py --seed 1 -n 10` (añadir `--print` para ver solución y pistas). Escribe JSON en `levels/generated/` y regenera `levels/generated/index.json`. Python 3.10+, sin dependencias.
- Jugar: `python -m http.server 8000` en la raíz y abrir `http://localhost:8000/engine/` (el motor usa `fetch`, así que no funciona con `file://` salvo con «Abrir nivel…»).
- Comprobar la sintaxis del motor: `node --check engine/netdoku.js`. No hay tests todavía; el generador valida cada nivel (solución única por fuerza bruta y propagación hasta la solución generada).

## Código (v0)

- `generator/netdoku_gen/`: `board.py` (redes por crecimiento de regiones, prefijos, routers de grado 2 sobre un árbol generador + ciclo opcional), `content.py` (nodos y paquetes), `rules.py` (subtipos de pista: cada uno genera instancias con `domain` = D y `excluded` = A), `solver.py` (dominios, propagación con colocación directa y reservas, recuento de soluciones), `selection.py` (selección voraz: primero los demás paquetes, luego la víctima, después quita redundancias), `level.py` (orquesta, valida y exporta).
- `engine/`: `index.html`, `netdoku.js`, `netdoku.css`, `help.js` (fichas de ayuda con mini tablero de ejemplo, compartidas por la banda de reglas de cada nivel y por `ayuda.html`). Dibuja el tablero en SVG (nombres de red en la cuadrícula, iconos de cliente/servidor con insignia de servicio, routers en las fronteras), arrastre con eventos de puntero (vale para ratón y táctil), interruptor Colocar / Anotar (notas del jugador, nunca automáticas), ✕ con clic derecho o pulsación larga, vidas y resultado final (al colocar el último paquete se muestra el atacante, sin preguntar). El progreso de cada nivel se guarda en `localStorage` (clave `netdoku:progress:<id de nivel>`) hasta pulsar «Reiniciar».
- Al añadir un subtipo de pista: definirlo en `netdoku_catalogo_reglas.md`, implementarlo en `rules.py` y registrarlo en `SUBTYPES` (y su peso en `selection.SUBTYPE_WEIGHTS`), y añadir su ficha en `engine/help.js` (`ENTRIES` y `TYPE_TO_ENTRY`). La ayuda no debe estorbar al juego: solo se abre a petición.

**Terminología fija por nivel:** trama (2), **paquete** (3), segmento TCP / datagrama UDP (4), mensaje (5). Las piezas del tablero son paquetes (`packet`/`packets` en ficheros y código); no se les llama «mensaje» ni «datagrama».

## Mapa de documentos

- `description.md`: concepto del juego (tablero, paquetes, objetivo final, catálogo de tipos de pistas).
- `implementation/game.md`: arquitectura propuesta (aplicación web, integrable en Moodle), formato de partida e interfaz.
- `implementation/game_round_generation.md`: algoritmo del generador de niveles. Es el documento técnico central.
- `implementation/netdoku_parametros_configuracion.md`: especificación de todos los parámetros del generador (dominio, valor por defecto, obligatoriedad).
- `implementation/netdoku_configuracion_global.yaml`: valores por defecto de esos parámetros. **Debe mantenerse sincronizado** con el documento de parámetros: al añadir, renombrar o cambiar un parámetro, actualizar ambos.
- `implementation/netdoku_catalogo_reglas.md`: catálogo de tipos y subtipos de pista (`tipo.subtipo`), con la interfaz común, la definición de adyacencia, los subtipos definidos y los previstos, y una plantilla para añadir más. Cualquier pista nueva se define aquí antes de usarla en un nivel o en el generador.
- `implementation/netdoku_contenidos_asignatura.md`: resumen de lo que se ve en la asignatura Redes y Servicios (temas, terminología, puertos, TTL, direccionamiento) y tabla de concepto → tema mínimo. Su fuente principal son los apuntes de clase unificados, cuyas transparencias están marcadas como Teoría, Ejercicio o Adicional. Todo concepto, pista o protocolo nuevo debe ser coherente con este documento o marcarse como [Adicional] (ampliación vista en clase) o [Extra] (no se ve), con una aclaración.
- `levels/generated/`: niveles generados (JSON) e `index.json`.
- `levels/netdoku_murdoku_001.yaml`: primer nivel diseñado a mano (`schemaVersion: "0.1"`). Es un **ejemplo sin terminar**: sirve como referencia del formato de partida, pero no como nivel jugable ni como modelo de diseño. No hay que dedicarle esfuerzo salvo para mantenerlo coherente con el formato.
- `examples/*.jpg`: capturas de partidas de Murdoku usadas como referencia de mecánica e interfaz. `netdoku_murdoku_001.yaml` traslada a redes la estructura de una de ellas (6×6, habitaciones → redes, personas → paquetes).

## Arquitectura

Dos componentes completamente desacoplados que solo comparten el formato de fichero de partida:

1. **Motor del juego** (web): carga una partida ya creada y permite jugarla. No sabe cómo se generó. El jugador arrastra paquetes a casillas (acierto → se fija; fallo → vuelve al panel y pierde una vida) y, al colocar el último, el nivel queda resuelto y se revela el atacante, que es evidente con el tablero completo. Las tarjetas de paquete no tienen campos fijos: muestran solo lo que el nivel decide revelar.
2. **Generador de partidas**: programa independiente que produce niveles. Pipeline: grafo lógico → tablero → routers → nodos → posiciones de paquetes → rutas/TTL opcionales → validación → propiedades verdaderas → selección de pistas → evaluación de dificultad → guardar o reparar (pistas → solución → mapa completo).

Conceptos del modelo que atraviesan varios documentos:

- **Topología bipartita Red ↔ Router**: no hay aristas Red–Red ni Router–Router. Cada router conecta de 2 a 4 redes, nunca dos routers con el mismo conjunto de redes. El algoritmo de construcción incremental (parámetro `p1`, pesos `1/(1+grado)^α` y `(4-grado)^β`) garantiza conexidad por construcción.
- **Los routers no ocupan casillas**: se sitúan en una arista o esquina entre casillas de redes distintas (`position.kind: edge`, `between: [[f,c],[f,c]]`). Aun así pertenecen a todas las redes que unen, con una IP en cada una, como en la asignatura.
- **Rutas**: no se sortean por paquete. El generador calcula una tabla de encaminamiento por router una vez por nivel (camino mínimo en saltos, como RIP; empates decididos una sola vez) y deriva de ella la ruta de cada paquete (`routes.policy: routing_tables`). Ida y vuelta pueden diferir. Las tablas se guardan en el nivel (`routing.tables`).
- **Redes de tránsito** (sin equipos, solo unen routers): desactivadas por defecto; solo se permiten con rutas, saltos o TTL activos y si unen al menos dos routers. Nunca son origen ni destino de un paquete.
- **Los paquetes** solo pueden estar en casillas vacías (o en su nodo origen/destino); una casilla, un paquete.
- **Escenario `same_network_attacker`**: el atacante es el único otro paquete en la red de la víctima. La víctima se localiza por descarte al final: con tantos paquetes como filas y columnas, le queda la única fila y columna libres, sin pistas propias. Solo si eso no basta (menos paquetes que filas) recibe pistas, que no la colocan por sí solas.
- **Interfaz de reglas**: cada subtipo de pista implementa nombre, descripción, parámetros, plantilla textual, generación de instancias, cálculo del dominio `D` y de la anulación común `A = ∩ CasillasAnuladas(r, c)` para `c ∈ D`. Añadir pistas nuevas debe requerir solo implementar esta interfaz.
- **Regla básica**: como en Murdoku, **como mucho un paquete por fila y por columna** (además de un paquete por casilla). En un 6×6 con 6 paquetes, cada fila y cada columna tiene exactamente uno. El solver la aplica (colocación directa elimina fila y columna, filas/columnas obligadas, reservas de filas/columnas) y el nivel la declara en `rules`.
- **Solución única obligatoria**: cada paquete debe quedar en una única casilla, sin paquetes intercambiables, porque el motor quita una vida por cada colocación que no coincide con la solución. La unicidad se consigue con pistas y con la regla básica.
- **Selección de pistas**: iterativa con tres estrategias en orden (colocación directa con `|D|=1`, anulación con `|A|>0`, reserva de N casillas para N paquetes, es decir, subconjuntos desnudos) y retroceso. Las reglas unitarias no seleccionadas se consumen y se descartan. La dificultad se mide con la secuencia de deducciones más sencilla entre varios órdenes de aplicación (`easiest_valid_order`).
- **Protocolos**: solo de aplicación, definidos en `protocols.catalog` con su origen y destino posibles, transporte, puerto y nivel de conocimiento (`basic`, `advanced`, `additional`, `extra`; según cuánto se ve en la asignatura), que cuenta en la dificultad (`difficulty.knowledge`). TCP y UDP no son protocolos del paquete, sino propiedades que se deducen de él. Cualquier protocolo nuevo se añade al catálogo y se refleja en la tabla de `description.md`.
- **Temario**: pistas, protocolos y tipos de nodo llevan un bloque temático (`T3.dispositivos` < … < `T6`, sección 9 de `netdoku_contenidos_asignatura.md`) y un nivel de conocimiento. El generador los filtra con `level.minTopic`/`maxTopic` y `difficulty.knowledge`, y el nivel guarda lo que exige en `requirements`.
- **Nodos**: `type` puede ser `client`, `server`, `firewall`, `switch` o `access_point`. Solo los `server` llevan `services` (`web, dns, mail, storage, multimedia`), y esos servicios son los mismos que usa `protocols.catalog`.
- **Una propiedad de un paquete** (protocolo, origen, TTL…) puede presentarse como dato visible, pista directa, indirecta, relacional u oculta. Así una misma topología sirve para varias dificultades.

## Formato de nivel (YAML)

Los niveles y la configuración se escriben en YAML. El motor web solo lee JSON, así que las partidas se exportan a JSON en el generador o en un paso de build (la v0 del generador escribe JSON directamente, con la misma estructura). El motor no debe depender de ninguna librería de YAML.

Coordenadas `[fila, columna]` con origen arriba a la izquierda e índices desde 1. El fichero de nivel contiene información redundante a propósito (`board.networkGrid` frente a `networks[].cells`/`cellCount`, `topology.edges` frente a `routers[].connectedNetworks`, `packets.items[].solution` frente a `solution.placements`, y el bloque `validation.expected`). Al editar un nivel hay que mantener todas las copias coherentes.

## Inconsistencias conocidas entre documentos

- `levels/netdoku_murdoku_001.yaml` (ejemplo sin terminar, no prioritario) **no tiene solución única**: con sus pistas admite 11 520 colocaciones y 4 atacantes posibles. Además incumple la regla básica de un paquete por fila y columna (su solución pone tres paquetes en la fila 2).

Antes de fijar un esquema o implementar algo que dependa de estos puntos, conviene consultarlo con el usuario.
