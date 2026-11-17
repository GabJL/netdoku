# Generación automática de partidas

## Idea general

La generación automática constituye el principal reto del proyecto.

Se propone dividirla en cuatro etapas.

### 1. Generación del mapa

Se construye la topología de la red.

### 2. Generación de la solución

Se decide el estado real del nivel.

### 3. Generación de propiedades y pistas

A partir de la solución se calculan todas las propiedades y pistas posibles.

### 4. Selección

Se decide:

- qué propiedades serán visibles;
- cuáles aparecerán como pistas;
- cuáles permanecerán ocultas.

El objetivo es obtener una única solución con la dificultad deseada.

## Restricciones del mapa

### Redes

Cada red:

- debe formar una única región conexa;
- El número de casillas no tiene por qué ser proporcional al número de equipos ni al tamaño de la red (que es su número de direcciones, según el prefijo);

### Conectividad interna

Dentro de cada red:

- entre cualquier par de equipos debe existir un camino formado únicamente por casillas vacías;
- entre cualquier equipo y cualquier router conectado a esa red debe existir igualmente un camino;
- los equipos no deben bloquear el único acceso a una zona.

### Routers

Los routers deberán:

- conectar al menos dos redes distintas;
- situarse sobre una frontera entre ambas;
- disponer de una casilla accesible en ambos lados.

## Generación de la solución

La generación de la solución construye el estado completo del nivel antes de seleccionar qué propiedades se mostrarán al jugador y cuáles se convertirán en pistas.

El proceso puede dividirse en las siguientes fases:

### 1. Generación de las redes

En primer lugar, se divide el tablero en un conjunto de redes.

Cada red debe cumplir las restricciones estructurales establecidas:

- formar una región conexa;
- contener un número mínimo de casillas;
- evitar regiones excesivamente estrechas o irregulares;
- permitir posteriormente la colocación de nodos, paquetes y accesos a los routers.

El resultado de esta fase es un mapa en el que cada casilla pertenece a una única red.

Para esto una vez decidido el número de redes (atendiendo a los parámetros - véase el fichero [parámetros](netdoku_parametros_configuracion.md)):

- Hacemos un grafo con la conectividad
- Generamos la característica de cada red
- Generamos el tablero

#### 1.1 Generación del grafo

El primer paso del generador consiste en construir un **grafo lógico** que representa la conectividad entre las redes antes de generar el tablero.

La propuesta inicial es utilizar un **grafo bipartito**, formado por dos tipos de nodos:

- **Red**: representa una red lógica (prefijo, identificador, etc.).
- **Router**: representa un router físico que conecta varias redes.

Las únicas aristas permitidas son:

```
Red <------> Router
```

No existen conexiones:

- Red ↔ Red
- Router ↔ Router

Este modelo coincide con el dominio del problema y simplifica posteriormente el cálculo de rutas, saltos, TTL y otras propiedades.

##### Restricciones iniciales

Para una primera versión se propone imponer únicamente las restricciones estructurales imprescindibles:

- El grafo debe ser conexo.
- Todas las redes deben estar conectadas al menos a un router.
- Cada router conecta entre **2 y 4** redes.
- No existen aristas duplicadas.
- No existen dos routers conectando exactamente el mismo conjunto de redes.

No se impondrán inicialmente restricciones sobre:

- número de routers;
- distribución de grados;
- diámetro;
- número de ciclos;
- caminos alternativos;
- topologías lineales, malladas, jerárquicas, etc.

Estas propiedades simplemente se calcularán una vez generado el grafo para analizarlas y decidir posteriormente qué restricciones merece la pena incorporar.

##### Algoritmo de generación

Sea un conjunto de redes previamente generado.

1. Barajar aleatoriamente las redes.
2. Añadir la primera red al grafo.
3. Para cada una de las redes restantes:
   1. Generar un número aleatorio `r`.
   2. Si:
      - no existen routers,
      - todos los routers tienen grado 4,
      - o `r < p1`,
      entonces:
         - crear un router nuevo;
         - conectar dicho router con la nueva red;
         - seleccionar probabilísticamente una de las redes ya incorporadas al grafo (favoreciendo las de menor grado);
         - conectar el router con dicha red.
   3. En caso contrario:
         - seleccionar probabilísticamente un router existente con grado menor que 4 (favoreciendo los de menor grado);
         - conectar la nueva red a dicho router.

Visualmente pueden ocurrir dos situaciones.

Creación de un router nuevo:

```
Red existente ── Router nuevo ── Red nueva
```

Reutilización de un router existente:

```
                 Red nueva
                     │
Red A ───────── Router ───────── Red B
```

Este algoritmo garantiza que:

- el grafo siempre es conexo;
- todos los routers cumplen el grado permitido;
- todas las redes quedan conectadas;
- no es necesario realizar validaciones complejas durante la generación.

Además, el parámetro `p1` controla indirectamente el número de routers y su distribución:

- valores altos generan muchos routers de grado 2;
- valores bajos favorecen routers de grado 3 y 4.

##### Selección probabilística

Para evitar concentrar todas las conexiones sobre unas pocas redes o routers, la selección puede realizarse mediante pesos.

Para seleccionar una red ya existente puede utilizarse una función inversamente proporcional a su grado:

```
peso(red) = 1 / (1 + grado(red))^α
```

De esta forma, cuanto más conectada esté una red, menor será la probabilidad de seguir añadiendo routers sobre ella.

Para seleccionar un router existente puede utilizarse su capacidad restante:

```
peso(router) = (4 - grado(router))^β
```

Así, los routers menos utilizados tienen mayor probabilidad de recibir nuevas conexiones.

En una primera implementación basta utilizar `α = β = 1`.

##### Evolución futura

Una vez implementado el generador básico, las restricciones podrán añadirse progresivamente sin modificar la arquitectura general.

Por ejemplo:

- limitar el grado máximo de las redes;
- controlar la distribución de routers de grado 2, 3 y 4;
- imponer un número mínimo o máximo de ciclos;
- exigir un diámetro mínimo;
- forzar caminos alternativos;
- permitir o impedir varios routers entre las mismas redes;
- generar determinadas familias de topologías.

El flujo de evolución sería:

```
Generar grafo
        ↓
Calcular métricas
        ↓
Validar restricciones
        ↓
Aceptar o regenerar
```

Conforme se identifiquen necesidades concretas, algunas restricciones podrán dejar de comprobarse mediante validación y pasar a integrarse directamente en el algoritmo de construcción, reduciendo así el número de regeneraciones necesarias.

### 2. Colocación de los routers

A continuación, se colocan los routers o puertas que conectan las redes.

Cada router:

- se sitúa en una frontera compartida por varias redes;
- conecta entre dos y cuatro redes;
- debe ser accesible desde todas las redes que conecta;
- determina las conexiones correspondientes en la topología lógica.

Un router situado entre dos regiones conectará dos redes. Si se encuentra en una intersección o esquina común, podrá conectar tres o cuatro redes. Hasta la v0.4 todos los routers son de dos redes; desde la v0.4.5, la categoría Encaminamiento tiene también routers de tres o cuatro redes (véase la [implementación](#implementación-en-la-v045)).

El conjunto de redes y routers define un grafo de conectividad que puede utilizarse posteriormente para calcular rutas, saltos y distancias entre redes.

El generador deberá comprobar que:

- todas las redes conectadas por el router sean realmente adyacentes a su posición;
- el router sea accesible desde cada una de ellas;
- no conecte accidentalmente redes que no deberían comunicarse;
- la topología global resultante sea conexa;
- se cumplan las restricciones de complejidad definidas para el nivel.

### 3. Generación y colocación de nodos

Una vez fijada la topología, se generan los nodos del nivel, como equipos de usuario, servidores u otros dispositivos.

Para cada nodo se determina:

- su tipo;
- la red a la que pertenece;
- su posición dentro del tablero;
- las propiedades necesarias para generar pistas, como los servicios o protocolos asociados.

La colocación debe garantizar que:

- los nodos no bloqueen los caminos internos de la red;
- exista un camino entre cada nodo y los routers de su red;
- queden suficientes casillas disponibles para colocar los paquetes;
- la distribución permita generar propiedades y pistas variadas.

#### Redes de tránsito

Por defecto toda red tiene al menos un equipo. Si el nivel usa rutas, saltos o TTL, se pueden dejar algunas redes sin equipos (`nodes.emptyNetworks`), como los enlaces /30 entre routers de la asignatura. Para jugar basta saber que es una red sin equipos que solo une routers, así que su bloque es `T3.ip` (propuesta de la v0.4; antes figuraba `T3.encaminamiento`). Estas **redes de tránsito**:

- solo se eligen entre las redes que unen al menos dos routers (`requireTransit`); una red vacía en un extremo de la topología no aportaría nada;
- nunca son red de origen ni de destino de un paquete, porque no tienen equipos;
- pueden contener paquetes, que estarán siempre de paso. Eso permite deducciones como «ya ha atravesado al menos un router» o «su TTL es menor que el inicial», y pistas como «está viajando por la red X».

Sin rutas, saltos ni TTL, una red vacía apenas admite pistas (no hay equipos de referencia), así que no se generan.

### 4. Generación de las posiciones finales de los paquetes

Después se determina la posición correcta de cada paquete en el estado final del puzle.

Las posiciones deben cumplir las restricciones generales:

- cada paquete ocupa una única casilla;
- una casilla no puede contener más de un paquete;
- **como mucho un paquete por fila y por columna** (regla básica del juego, como en Murdoku). Con tantos paquetes como filas, cada fila y cada columna tiene exactamente uno;
- solo pueden utilizarse casillas válidas y accesibles;
- debe quedar garantizada la mecánica final del nivel.

En particular, la distribución deberá permitir identificar de forma única el paquete atacante a partir de la posición del paquete víctima.

La víctima también recibe una posición final durante esta fase, aunque posteriormente no participe en la selección normal de pistas y deba ser localizada por descarte.

La generación no debería limitarse a colocar los paquetes completamente al azar. Conviene controlar aspectos como:

- número de paquetes por red;
- separación entre paquetes;
- disponibilidad de propiedades espaciales útiles;
- existencia de suficientes reglas candidatas para cada paquete;
- unicidad de la respuesta final.

### 5. Generación opcional de redes iniciales y rutas

Algunas propiedades de los paquetes solo pueden calcularse si se conoce su recorrido previo por la red. Por ejemplo:

- red de origen;
- nodo de origen;
- nodo de destino;
- ruta seguida;
- número de routers atravesados;
- TTL inicial y TTL actual;
- proximidad al origen o al destino.

Esta fase solo será necesaria cuando el nivel utilice reglas relacionadas con rutas, saltos o TTL.

#### Tablas de encaminamiento

Las rutas no se sortean paquete a paquete. Antes de asignar orígenes y destinos, el generador calcula una **tabla de encaminamiento** para cada router, como en la asignatura:

1. Para cada red destino `X`, se calcula la distancia en routers desde cada router hasta `X` sobre el grafo bipartito Red↔Router (métrica `hops`, como RIP). Basta un recorrido en anchura desde `X`.
2. Si el router pertenece a `X`, la entrada es de **entrega directa**. Si no, el siguiente salto es un router vecino (que comparte una red con él) cuya distancia a `X` sea una unidad menor.
3. Si hay varios siguientes saltos posibles, se elige uno según `routes.tables.tieBreak`. La elección se hace una sola vez por par (router, red destino) y vale para todos los paquetes del nivel.
4. El primer salto desde un equipo se decide según `routes.tables.hostGateway`: el router de su red en el camino mínimo, o la puerta de enlace por defecto de la red.

La ruta de un paquete es la sucesión de siguientes saltos que dan las tablas desde la red origen hasta la red destino. Esto garantiza lo que se ve en la asignatura:

- dos paquetes que llegan al mismo router con destino a la misma red continúan por el mismo sitio;
- con la métrica `hops` y `hostGateway: shortest`, toda ruta es mínima y no tiene ciclos;
- la ruta de A a B puede no coincidir con la de B a A, porque los empates se deciden por separado en cada sentido.

Si `routes.tables.store` vale `true`, las tablas se guardan en el nivel (`routing.tables`) para pistas futuras del bloque `T3.encaminamiento`.

#### Asignación por paquete

Para cada paquete afectado se podrá determinar:

1. un nodo o red de origen;
2. un nodo o red de destino;
3. la ruta entre ambos, derivada de las tablas de encaminamiento;
4. una posición final compatible con algún punto de dicha ruta;
5. los valores derivados, como el número de saltos o el TTL.

La ruta no tiene por qué almacenarse necesariamente como una secuencia exacta de casillas. Puede representarse en distintos niveles:

- secuencia de redes atravesadas;
- secuencia de routers;
- camino completo dentro del tablero.

La representación elegida dependerá de la precisión necesaria para las reglas disponibles.

#### Implementación en la v0.4 (categoría Encaminamiento)

Implementada en `generator/netdoku_gen/routes.py`. Las pistas están en el [catálogo de reglas](netdoku_catalogo_reglas.md#encaminamiento-rutas-y-ttl-v04).

Primera versión de las rutas, pensada para que el jugador las trace sin tablas de encaminamiento.

**Tablero.** 7×7 con 7 paquetes (uno en cada fila y en cada columna), 5 o 6 redes y routers de grado 2 sobre un árbol generador más, a veces, un router que cierra un ciclo. Con probabilidad 0,5 (`nodes.emptyNetworks.probability`), una **red de tránsito**, elegida al azar entre las que unen al menos dos routers, que se llama Troncal. Con 4 redes en un 6×6 las rutas tendrían como mucho 2 o 3 routers y darían poco juego.

**Orden de la generación.** Para no tener que sortear rutas hasta que encajen en las casillas, primero se colocan los paquetes y después se les asigna una ruta que pase por su red:

1. Tablero, routers y equipos, como ahora, dejando vacía la red de tránsito.
2. Posiciones de los paquetes: una por fila y columna, con la víctima y el atacante solos en una red (como ahora).
3. Para cada paquete en la red `X`, se sortea un par de origen y destino cuya ruta pase por `X`, según el papel que se quiera para `X` (`routes.finalPositionWeights`: origen 15 %, intermedia 60 %, destino 25 %; en una red de tránsito, siempre intermedia). Origen y destino están en redes distintas, se prefieren las rutas largas y las que no lleva ya otro paquete, y dos paquetes no tienen el mismo par de equipos si se puede evitar. Solo valen pares con un **único camino mínimo** (`routes.requireUniqueShortestPath`) y equipos que se puedan nombrar sin ambigüedad en la ficha (su etiqueta es única en su red). Con probabilidad `endpoints.broadcastPackets.probability`, uno de los paquetes que están en una red con equipos pasa a ser de difusión: su origen es un equipo de esa red y su destino, la difusión de la red.
4. TTL inicial: un valor de `ttl.initialValues` que mantenga vivo al paquete donde está (`TTL inicial ≥ k + 1`). Una parte de los paquetes (`ttl.shortRatio`) recibe un TTL que no le alcanza para llegar a su destino (`TTL inicial − 1 < L`), para que aparezca la deducción de «No time to die»: con TTL 3 solo puede haber atravesado dos routers.
5. `Alcanzables(m)` de cada paquete (las redes de su ruta hasta `min(L, TTL inicial − 1)`), que es su dominio de partida en el solver, en la medida de la dificultad, en la validación y en las sugerencias.
6. Pistas, selección, validación y dificultad, como ahora. Las pistas de ruta y TTL pesan más que las demás, y cada nivel debe tener al menos tres (`clues.categoryMinClues`), para que la categoría se note. Mientras se eligen las pistas de los demás paquetes no cuenta la ruta de la víctima, que se sigue deduciendo al final.
7. Formas de nombrar: como en Direccionamiento, con la misma dificultad de interpretación por dificultad global, pero sin exigir formas de la categoría (la categoría la dan las pistas de ruta y TTL) y con `clues.naming.categoryFormRatio` entre 0,2 y 0,5.

Las tablas de encaminamiento todavía no se calculan: llegan con la v0.5, en otra categoría (véase su [implementación](#implementación-en-la-v05-categoría-tabla-de-enrutamiento)).

**Lo que no entra en la v0.4:** pistas relacionales entre dos paquetes, orígenes o destinos ocultos (y deducir la IP de cada equipo), routers de grado 3 o 4, rutas con empates (exigen tablas) y `hostGateway: default_gateway`. Las pistas relacionales, los extremos ocultos y los routers de grado 3 o 4 llegan en la [v0.4.5](#implementación-en-la-v045).

**Formato del nivel.** Cada paquete añade:

```json
"origin": {"node": "N3"},
"destination": {"node": "N7"},            // o {"broadcast": "192.168.1.255", "network": "net2"}
"ttl": {"initial": 4},
"route": {"networks": ["net1", "net3", "net2"], "routers": ["R1", "R4"]},
"domain": [[1, 2], [1, 3], ...],          // Alcanzables: lo usan las sugerencias
"solution": {"position": [3, 4], "network": "net3", "routersCrossed": 1, "ttl": 3}
```

y `rules.packetOnRoute: true`; la red de tránsito lleva `"transit": true`. La ficha del paquete muestra origen, destino y TTL inicial; `route`, `domain` y `solution` no se muestran. Al pasar el ratón por la ficha (o con el paquete seleccionado), el tablero marca su equipo de origen y el de destino.

**Medidas:** un nivel tarda unos 20 s (con un proceso por núcleo); en un móvil de 380 px de ancho el tablero 7×7 cabe, con casillas de unos 45 px.

#### Implementación en la v0.4.5

Las pistas están en el catálogo de reglas: [entre dos paquetes](netdoku_catalogo_reglas.md#pistas-entre-dos-paquetes-v045), [orígenes y destinos ocultos](netdoku_catalogo_reglas.md#orígenes-y-destinos-ocultos-v045), [routers de tres o cuatro redes](netdoku_catalogo_reglas.md#routers-de-tres-o-cuatro-redes-v045) y [redes privadas y públicas](netdoku_catalogo_reglas.md#redes-privadas-y-públicas-v045).

La v0.4.5 añade lo que se dejó fuera de la v0.4, salvo las rutas con empates y `hostGateway: default_gateway`, que necesitan las tablas de la v0.5. Los niveles actuales no cambian: los lotes pasan de 75 a 100 niveles por dificultad, y los 25 nuevos de cada una se generan con la opción `--novelties`, que exige al menos una novedad de su categoría.

| Novedad | Inicial | Direccionamiento | Encaminamiento |
|---|---|---|---|
| Pistas entre dos paquetes | `same_network`, `routers_between` | además, `more_addresses_network` | además, `more_routers_crossed`, `higher_ttl`, `closer_to_destination`, `same_origin` y `same_destination` |
| Orígenes y destinos ocultos | — | — | sí |
| Routers de tres o cuatro redes | — | — | sí |
| Redes privadas y públicas | — | `privacy` (redes, routers) y `label_privacy` (equipos) | — |

Los routers de esquina solo van en Encaminamiento: en un 6×6 con cuatro redes, un router que une tres deja la topología casi en estrella y quita juego a las pistas de routers, y donde se nota es en las rutas.

**Pistas entre dos paquetes.** En el nivel se guardan así:

```json
{"id": "C7", "type": "relation.same_network", "packets": ["A", "C"],
 "relation": {
   "values": {"A": {"net1": [[1, 2], [1, 3]], "net3": [[4, 4]]},
              "C": {"net1": [[2, 1]], "net3": [[5, 6], [6, 6]]}},
   "allowed": [["net1", "net1"], ["net3", "net3"]]}}
```

`values` reparte entre valores las casillas posibles de cada paquete (las libres o, en Encaminamiento, su `domain`), y `allowed` da los pares (valor del primero, valor del segundo) que hacen verdadera la pista. Los valores son cadenas, para que el motor no tenga que saber qué significan. Con un extremo oculto, cada casilla lleva la red del extremo (`[4, 4, "net2"]`). No llevan `domain` ni `excluded`.

- **Solver:** cada posibilidad de un paquete es una casilla `(f, c)` o, con un extremo oculto, un estado `(f, c, red)`; `cell_of` y `placed_cell` dan su casilla. Cada pista relacional es una `Relation(first, second, allowed)`. La propagación revisa cada pista relacional (consistencia de arco): quita de cada paquete las casillas cuyo valor no tiene pareja entre los valores que le quedan al otro, y repite hasta que nada cambia. `count_solutions` comprueba la relación al colocar el segundo paquete de cada pareja.
- **Dificultad lógica:** dos técnicas nuevas, que habrá que calibrar jugando:

  | Nivel | Técnica | Qué hace el jugador |
  |---|---|---|
  | 1 | Relación con un valor fijo | Al otro paquete le queda un solo valor (está colocado o todas sus casillas dan el mismo): la pista se usa como una unaria. |
  | 3 | Relación entre valores abiertos | Hay que tener en cuenta todos los valores que le quedan al otro paquete («C está en Aulas o en Servicios, así que A también»). |

- **Selección:** compiten con las demás pistas. Como no tienen un `D` fijo, en cada elección se mide lo que quitan propagando desde el estado actual, a cualquiera de los dos paquetes. Un nivel lleva como mucho `clues.relations.max` (2), y nunca nombran a la víctima. `relation.more_addresses_network` y `relation.higher_ttl` no se usan en Inicial ni con dificultad de interpretación 1. Sin su cálculo, `size_compare` y `ttl_compare` no dicen nada, así que `rules.uncalculated` las quita al comprobar si su cálculo es imprescindible.
- **Motor:** la pista sale en las fichas de los dos paquetes, con el texto que compone `clue(c, L)`. Hay dos fichas de ayuda: `relation` (misma red, routers entre las dos redes, más direcciones) y `route_relation` (las de ruta y TTL). Las sugerencias (`hints.js`) añaden las dos técnicas, con el mismo orden de preferencia: el paso dice qué paquetes relaciona la pista y resalta las casillas que deja de tener el paquete (o, si solo descarta redes del extremo oculto, lo dice así).

**Orígenes y destinos ocultos** (Encaminamiento). Con probabilidad `endpoints.hidden.probability`, un nivel oculta el origen o el destino de uno o dos paquetes (`endpoints.hidden.max`), que no sean la víctima ni de difusión. En el nivel, `"origin": {"hidden": true}`; el equipo real va en `solution.origin`. El `domain` del paquete pasa a ser de estados (`[f, c, red]`).

- **Solver, dificultad y sugerencias** trabajan con estados en lugar de casillas. Un paquete está colocado cuando todos sus estados están en la misma casilla, aunque no se sepa aún su extremo, y la colocación descarta su fila y su columna para los demás, como ahora.
- **Validación:** la solución tiene que ser única también en la red del extremo oculto, porque la gracia es deducirlo. Al acabar el nivel, la ficha muestra el equipo.
- **Selección:** cada paquete con un extremo oculto tiene al menos una pista de `endpoint.origin`, `endpoint.origin_class`, `route.first_router` o sus equivalentes del destino; las pistas de ruta y TTL de la v0.4 le sirven sin cambios, porque ya se calculan con la ruta de cada estado.
- **Motor:** la ficha dice «Origen: desconocido» y el tablero marca solo el extremo conocido (`drawRouteEnds`); al resolver el nivel muestra el equipo. El objetivo del nivel lo avisa (`game.hiddenNote`) y la ayuda añade la ficha `hidden_endpoint`. En `hints.js`, cada posibilidad es un número: la casilla `k` (de 0 a W·H − 1) o el estado `k + W·H·(1 + i)`, con `i` el índice de la red en `level.networks`.

**Routers de tres o cuatro redes** (Encaminamiento). `board.place_routers` sortea el grado de cada router con `routers.degree.weights`; si sale 3 o 4 y hay una esquina libre donde se juntan tantas redes, el router va ahí y sustituye a las aristas del árbol generador entre ellas (dos para tres redes, tres para cuatro). Como mucho hay `routers.cornerRouters.max` (2), y dos routers nunca comparten dos redes, para que entre dos redes vecinas haya un solo router y los caminos mínimos sigan siendo únicos. En el nivel: `"position": {"kind": "corner", "cells": [[2, 3], [2, 4], [3, 3], [3, 4]]}`, sin `orientation`, con `degree` 3 o 4 y una interfaz por red. El motor lo dibuja en el vértice común (`routerCells`), los textos de los routers admiten listas de redes y de interfaces, y la ayuda añade la ficha `corner_router`. Inicial y Direccionamiento fijan `routers.degree.max: 2`.

**Redes privadas y públicas.** Con probabilidad `addressing.privacyMix.probability`, los planes `distinct` y `octet_subnets` mezclan las dos clases (véase el [catálogo](netdoku_catalogo_reglas.md#redes-privadas-y-públicas-v045)). Su bloque, `T3.nat`, es posterior a los de Direccionamiento (hasta `T3.vlsm`), y se valoraron tres opciones: ampliar Direccionamiento hasta `T3.nat`, usarla solo en Encaminamiento o dejarla para la categoría de NAT. **Se eligió la primera:** el resumen de la asignatura recoge los rangos privados con el direccionamiento, y `requirements.topic` dice siempre lo que exige cada nivel. El perfil de Direccionamiento fija `level.maxTopic: T3.nat` y `addressing.privacyMix.probability: 0.7`.

Como las demás formas con coste, `privacy` y `label_privacy` solo van en pistas cuyo cálculo es imprescindible, y esas pistas suelen nombrar routers. Por eso la forma existe también para routers («el router de la red pública», si es el único de esa red), `naming.Namer` prefiere estas formas cuando caben (`PREFERRED_FORMS`) y `selection.Selector` multiplica por 4 el peso de las pistas que nombran esa red, un equipo suyo o su router (`boost_networks`). Aun así es rara: sale en 4 de los 125 niveles nuevos de Direccionamiento de la v0.4.5 (en pruebas sueltas, en torno al 13 % de los de dificultad 2 y 3), porque solo la admiten los planes `distinct` y `octet_subnets`. Si hace falta más, se puede exigir en una parte de los niveles nuevos.

**Medidas.** Inicial y Direccionamiento tardan lo mismo que en la v0.4. Un nivel de Encaminamiento tarda unos 26 s (antes, 20): los routers de esquina acortan las rutas y duplican los intentos en los que las pistas no bastan.

**Generación de los lotes.** Unos 25 × 5 × 3 = 375 niveles nuevos (`generate.py --pool 100 --novelties`). Inicial 5 tarda unos 100 s por nivel y, en este equipo, Claude Code corta las tareas largas en segundo plano por falta de memoria, así que conviene lanzarla en primer plano con `--workers 1` o desde la terminal con `!`. `levels/test.json` se rehace después con `test_set.py --write`, que debe cubrir también los subtipos y novedades nuevos.

#### Implementación en la v0.5 (categoría Tabla de enrutamiento)

El modelo de las tablas, los costes de interpretación y las pistas nuevas están en el [catálogo de reglas](netdoku_catalogo_reglas.md#tabla-de-enrutamiento-v05). Es una categoría nueva (id `enrutamiento`, bloque `T3.encaminamiento`), después de Encaminamiento en el menú. Encaminamiento no cambia: sigue con caminos mínimos únicos y sin tablas.

**Tablero.** El de Encaminamiento (7×7, 7 paquetes, red de tránsito con probabilidad 0,5, routers de esquina), pero siempre con 6 redes y con dos o tres routers de dos redes que cierran ciclos sobre el árbol generador (`topology.cycles`), porque los empates son los que hacen falta para que las tablas importen. Medido con 60 tableros: con 6 redes y dos routers de más, el 98 % tiene algún par de redes con dos caminos mínimos (5,2 de los 30 pares ordenados, de media); con uno de más, el 73 % (3,6). Con 5 redes y uno de más, el 79 % (3,1 de 20).

**Orden de la generación:**

1. Tablero, routers y equipos, como en Encaminamiento, con los routers de más.
2. **Puertas de enlace:** en cada red con varios routers se sortea uno (`routes.tables.hostGateway: default_gateway`). Las redes de tránsito no tienen, porque no tienen equipos.
3. **Plan de direcciones**, según la interpretación buscada (tabla de abajo). Para las tablas con resúmenes hay dos planes nuevos por zonas (`octet_zones` y `bit_zones`), que reparten los prefijos después de colocar los routers, porque las zonas siguen la vecindad entre redes.
4. **Siguientes saltos:** para cada red de destino `X`, un recorrido en anchura desde `X` da la distancia en routers de cada router, y el siguiente salto de cada router hacia `X` es un vecino a una unidad menos. Los empates se deciden al azar una sola vez por router y red de destino (`routes.tables.tieBreak: random`), sin mirar las zonas: con dos o tres zonas, la mayoría de las tablas `summary` ya pueden resumir alguna.
5. **Posiciones de los paquetes**, como en Encaminamiento.
6. **Origen y destino de cada paquete**, como en Encaminamiento, pero la ruta es la de las tablas: la puerta de enlace de la red de origen y, desde ella, los siguientes saltos hasta el router que entrega directamente. Se descartan los pares cuya ruta pasa dos veces por la misma red. Ya no se exige un camino mínimo único (`routes.requireUniqueShortestPath: false`); al contrario, mientras falten rutas que exigen las tablas hasta `routes.tables.minRequiredRoutes` (2), los pares cuya ruta las exige pesan `routes.tables.requiredRouteWeight` (4) veces más. Una ruta exige las tablas si en su parte alcanzable (`r0 … rK`) no es el único camino mínimo: el TTL puede acabar con el paquete antes del empate, y entonces no importa.
7. TTL inicial y `Alcanzables(m)`, como en Encaminamiento.
8. **Escritura de las tablas** según su estilo (`routes.tables.style`; véase más abajo). Si alguna tiene más de `routes.tables.maxEntries` (6) entradas, se sortean otras. En la implementación, los pasos 4 y 8 van antes del 5: con las tablas ya escritas se sabe qué cuesta cada ruta, y en las interpretaciones 4 y 5 se exigen pares cuya consulta decisiva cueste al menos 2 o 3 (coincidencia más larga o máscaras que no acaban en un octeto); si no hay, se sortean otras tablas (hasta 20 veces) antes de repetir el intento. Esos pares son los que se prefieren al elegir origen y destino en el paso 6.
9. Pistas, selección, validación y dificultad lógica, como en Encaminamiento, con los subtipos nuevos.
10. **Tablas imprescindibles** (`level.tables_needed`): a cada paquete cuya ruta exige las tablas se le añaden a `Alcanzables(m)` las casillas de todas las redes alcanzables de cualquier camino mínimo entre su red de origen y la de destino. Cada camino es una hipótesis, un estado `(f, c, "pN")` como los de un extremo oculto; las pistas del paquete se recalculan con todas y, al final, se pasan a casillas: una casilla vale si la pista es verdadera en ella con algún camino. Las pistas entre dos paquetes cuyo valor en una casilla depende del camino se quitan, porque sin las tablas no dicen nada seguro. Si con eso el nivel se sigue resolviendo con la misma dificultad lógica o con una menor, las tablas no hacían falta y se repite el intento; si ya no se resuelve, o la evaluación falla, sí hacían falta. Es la misma idea que la del cálculo imprescindible de las formas de nombrar (`rules.uncalculated`), aplicada a las rutas.
11. **Interpretación:** el coste de cada ruta que exige las tablas (el de su consulta más cara entre las que deciden un empate) entra en la escala como una pista más, junto a las formas de nombrar (`naming.assign(fixed_costs=…)`). La selección de pistas favorece las de los paquetes con esas rutas (`Selector(boost_packets=…)`), para que la ruta llegue a importar.

**Interpretación buscada.** Como en Direccionamiento, la dificultad global buscada fija una interpretación (`READING_FOR_TARGET`), y con ella se eligen el estilo de las tablas, cómo se escribe el siguiente salto y el plan de direcciones:

| Interpretación | Tablas (`routes.tables.style`) | Siguiente salto (`routes.tables.nextHop`) | Plan de direcciones |
|---|---|---|---|
| 1 | `full` | nombre | `distinct` u `octet_subnets` |
| 2 | `full` o `default` | nombre o IP | `distinct` u `octet_subnets` |
| 3 | `default` o `summary` | IP | `octet_zones` |
| 4 | `summary` | IP | `octet_zones` o `bit_zones` |
| 5 | `summary` | IP | `bit_zones` |

Para que la dificultad de la categoría venga de las tablas, las rutas tienen que dar por sí solas al menos la interpretación buscada menos uno; las formas de nombrar pueden subirla un punto más. Si no se llega, se repite el intento.

**Planes por zonas.** Se reparte el grafo de redes en dos o tres zonas conexas (`addressing.zones.count`) y cada zona recibe un bloque, del que salen las redes de esa zona, como en el encaminamiento jerárquico de la clase 12:

- `octet_zones`: bloques /16 dentro de 10.0.0.0/8 (10.1.0.0/16, 10.2.0.0/16…) y redes /24 dentro de ellos. Todas las máscaras acaban en un octeto: la coincidencia más larga se ve comparando octetos. Coste C de las formas de direcciones: 1, como `octet_subnets`.
- `bit_zones`: bloques cuya máscara no acaba en un octeto (172.16.0.0/20 y 172.16.16.0/20 con redes /24, o 192.168.1.0/25 y 192.168.1.128/25 con redes /27). Hay que comparar en binario. Coste C: 2, como `bit_subnets`, con el punto de más cerca del límite.

**Escritura de las tablas.** Para cada router, con el siguiente salto de cada red del nivel ya calculado:

- `full`: entrega directa en sus redes y una entrada por cada una de las demás.
- `default`: la ruta por defecto va hacia el siguiente salto más usado (los empates, al azar), y solo llevan entrada propia las redes que van por otro sitio.
- `summary`: en cada zona con al menos dos redes (sin contar las del propio router) que van por el mismo siguiente salto, una entrada con el bloque de la zona hacia el siguiente salto más usado entre ellas; las redes de la zona que van por otro sitio mantienen su entrada, más específica, y las del propio router, su entrega directa. La ruta por defecto va al siguiente salto más usado entre las redes que no cubre ningún resumen, y las demás llevan su entrada. Se resume aunque la tabla no quede más corta: lo que se busca es que haya que aplicar la coincidencia más larga.

En los tres casos se comprueba que la coincidencia más larga da, para cada red del nivel, el siguiente salto calculado.

**Formato del nivel.** Un bloque nuevo `routing` y, en la ruta de cada paquete, los routers donde las tablas deciden un empate (`"gateway"` si es la puerta de enlace; vacío si la ruta no exige las tablas), que usan las sugerencias y el entrenamiento:

```json
"routing": {
  "tableStyle": "summary",
  "nextHop": "ip",
  "gateways": {"net1": "R2", "net3": "R4"},
  "tables": {
    "R1": [{"prefix": "10.1.1.0/24", "direct": true},
           {"prefix": "10.2.0.0/16", "via": "R5"},
           {"prefix": "10.2.4.0/24", "via": "R6"},
           {"prefix": "0.0.0.0/0", "via": "R3"}]
  }
},
...
"route": {"networks": ["net1", "net3", "net2"], "routers": ["R2", "R4"], "tableDecisions": ["gateway", "R4"]}
```

Las interfaces de cada router ya están en el nivel (`routers[].interfaces`) y la IP de cada equipo, en `nodes[].ip`. El motor calcula la coincidencia más larga a partir de `tables`, sin más datos.

**Motor.** Nombre de cada router (R1, R2…) junto a él; panel con su tabla (sus interfaces encima, dos columnas: destino y siguiente salto) al tocarlo o al pasar el ratón; puerta de enlace en la leyenda de cada red; IP de destino en la ficha del paquete. Las sugerencias cambian el paso `route`: en lugar de «va por el camino con menos routers», sigue las tablas y explica cada consulta que decide un empate («R2 busca 10.2.4.9 en su tabla: coinciden 10.2.0.0/16 y 10.2.4.0/24, y gana la /24, que lo envía a R6»); `netdoku.js` calcula la coincidencia más larga (`lookup`) con `routing.tables`, y `hints.js` no cambia: el paso `route` ya sale de la ruta del nivel. Fichas de ayuda nuevas y teoría de la categoría (`categories.enrutamiento`), con sus textos en cada idioma.

**Entrenamiento.** Un perfil de tablero propio en `training.PROFILES` (`table`: 6×6 con 4 o 5 redes y uno o dos routers de más, para que haya empates en poco espacio) y 13 variantes (`tab.*`). Cinco son para la regla implícita: el ejercicio pide dónde puede estar el paquete solo con su ruta (seguir la ruta por las tablas con un empate en un router, empate en la puerta de enlace, siguiente salto escrito con su IP, ruta por defecto y coincidencia más larga, esta con planes por zonas; `Variant.tables` fija el estilo y qué tiene que decidir la ruta, que comprueba `training._table_need`). Otra para cada subtipo nuevo (`crossed_router`, `last_entry`, `next_entry` con la entrega directa y `same_next_hop`) y otra para cada forma nueva (`gateway`, `next_hop`, `next_hop_network` y `router_side`). La explicación da la ruta según las tablas y cada consulta que la decide; el motor compone la consulta con la IP de destino de la ficha.

**Desactivación.** `feature:routingTables` quita la categoría entera (el generador no la genera, `generate.py --index` deja fuera sus niveles y sus ejercicios, y el motor oculta la categoría, sus fichas y su teoría); `feature:tableDefault`, `feature:tableSummary` y `feature:nextHopIp` limitan los estilos de tabla y la forma del siguiente salto, y la tabla de interpretación se recorta a lo que quede (sin resúmenes, la interpretación 5 no se puede buscar y `--pool` lo avisa).

**Lotes.** 75 niveles por dificultad (375), con `--category enrutamiento` y semillas desde 4 000 000 (más 10 000 por dificultad). Con 7 procesos, un nivel cuesta de media unos 20 s en las dificultades 1, 2, 4 y 5 y unos 40 s en la 3, la que menos intentos acierta (alrededor de uno de cada 40: las pistas no bastan, ninguna selección da la dificultad o las tablas no hacen falta). Muchas semillas fallan sus 100 intentos, así que `--pool` sigue tras la semilla más alta del lote en lugar de volver a probar las que faltan por debajo. `levels/test.json` añade niveles de la categoría para cubrir cada subtipo, forma, plan y estilo de tabla (`test_set.py`).

### 6. Validación de la solución

Antes de generar las propiedades y pistas, se valida el estado completo.

La solución deberá garantizar:

- conectividad válida entre redes;
- accesibilidad de los nodos y routers;
- posiciones válidas para todos los paquetes;
- coherencia entre origen, destino, ruta, TTL y posición final;
- existencia de suficientes propiedades verdaderas para generar pistas;
- identificación única del paquete atacante;
- posibilidad de localizar la víctima por descarte.

Si alguna condición no se cumple, el generador podrá reparar la fase correspondiente o retroceder a una fase anterior.

## Generación de propiedades y pistas

Una vez generada la solución completa, el sistema obtiene automáticamente todas las propiedades verdaderas del nivel.

Estas propiedades constituyen la base para generar tanto la información mostrada directamente al jugador como las distintas pistas del puzle.

### Tipos y subtipos de reglas

Las pistas se organizan en **tipos de reglas**, cada uno de los cuales agrupa un conjunto de **subtipos** que representan una forma concreta de expresar una determinada propiedad o relación.

Por ejemplo, un tipo podría corresponder a relaciones espaciales, mientras que sus subtipos podrían ser "junto a un router", "en la misma fila que un equipo" o "a dos saltos del destino".

Cada subtipo implementa una interfaz común, lo que permite incorporar nuevas clases de pistas sin modificar el algoritmo general de generación.

Para cada subtipo se define:

- **Nombre**, utilizado para identificar el subtipo.
- **Descripción**, que resume qué información aporta la regla y puede emplearse para controlar la variedad de pistas o su selección durante la generación.
- **Parámetros**, necesarios para instanciar la regla (por ejemplo, un router, una red o un paquete concreto).
- **Plantilla textual**, utilizada para generar automáticamente el texto visible de la pista a partir de sus parámetros.
- **Generación de instancias**, que identifica todas las reglas verdaderas de ese subtipo para una solución concreta.
- **Cálculo del dominio (`D`)**, que determina las posiciones compatibles con la regla en el estado actual del tablero.
- **Cálculo de las anulaciones (`A`)**, que determina las casillas que pueden descartarse independientemente de la posición concreta del paquete dentro de su dominio.

Esta interfaz desacopla completamente el catálogo de reglas del algoritmo de generación. Como consecuencia, la incorporación de nuevos tipos o subtipos únicamente requiere implementar esta interfaz, sin necesidad de modificar el resto del sistema.

### Selección de pistas

La selección de pistas se realiza de forma incremental. Inicialmente todas las pistas candidatas están disponibles y ninguna ha sido aplicada.

En cada iteración se evalúan todas las reglas pendientes sobre el estado actual del tablero. Para cada regla se calculan dos conjuntos:

- **Dominio (`D`)**: conjunto de casillas en las que el paquete asociado podría colocarse si se aplicara la regla en el estado actual.
- **Anulación común (`A`)**: intersección de las casillas que quedarían descartadas independientemente de cuál sea la posición final del paquete dentro de `D`.

Es decir,

\[
A(r)=\bigcap_{c\in D(r)}CasillasAnuladas(r,c)
\]

El algoritmo aplica sucesivamente las siguientes estrategias:

1. **Colocación directa.**

   Se calculan todas las reglas pendientes con `|D| = 1`, excluyendo las
   asociadas al paquete víctima mientras existan otros paquetes sin colocar.

   En lugar de conservar o aplicar todas las reglas disponibles, se selecciona
   aleatoriamente un subconjunto reducido. Su tamaño puede depender del número
   de paquetes pendientes, procurando seleccionar normalmente entre el 1 % y
   el 20 % de ellos, con un mínimo de una regla.

   Para cada paquete solo podrá seleccionarse una regla, aunque varias de sus
   reglas tengan dominio unitario.

   Todas las reglas con `|D| = 1` se consumen en esta iteración:

   - las reglas seleccionadas se incorporan al conjunto final de pistas y se
     utilizan para colocar sus paquetes;
   - las reglas no seleccionadas se descartan definitivamente y no podrán
     utilizarse en iteraciones posteriores.

   Después:

   - se colocan los paquetes correspondientes a las reglas seleccionadas;
   - se eliminan las demás reglas de los paquetes ya colocados;
   - se actualizan conjuntamente las casillas ocupadas y anuladas;
   - se recalculan los dominios de las reglas restantes.

   Las reglas del paquete víctima se ignoran mientras queden otros paquetes por
   colocar. Su posición se determina cuando todos los demás están colocados,
   con pistas propias que solo la fijan gracias a las casillas ya ocupadas
   (véase «Tratamiento del paquete víctima»).

2. **Anulación de casillas.**

   Si no existe ninguna colocación directa, se buscan reglas con `|A| > 0`.

   Al aplicar una de ellas:

   - se marca como utilizada;
   - las casillas de `A` dejan de ser válidas para el resto de paquetes;
   - se recalculan todos los dominios.

3. **Reserva de conjuntos de casillas.**

   Si tampoco existe ninguna regla del tipo anterior, se buscan conjuntos de `N` reglas pertenecientes a `N` paquetes distintos cuyos dominios cumplan:

   \[
   \left|\bigcup_{i=1}^{N} D(r_i)\right| = N
   \]

   Esto implica que esos `N` paquetes únicamente pueden ocupar esas `N` casillas, aunque todavía no pueda determinarse cuál corresponde a cada uno.

   En consecuencia:

   - esas casillas quedan reservadas para dichos paquetes;
   - dejan de ser válidas para el resto;
   - los paquetes permanecen sin colocar hasta que nuevas deducciones permitan distinguirlos.

   Este mecanismo generaliza los conocidos pares, tríos y subconjuntos desnudos utilizados en otros puzles de lógica.

4. **Retroceso.**

   Si ninguna de las estrategias anteriores puede aplicarse, el algoritmo realiza un paso atrás en el proceso de generación y prueba una selección diferente de reglas.

5. **Finalización.**

   El proceso termina cuando todos los paquetes han quedado determinados, cada uno en una única casilla.

   No se aceptan niveles con paquetes intercambiables, aunque la permutación no cambie la respuesta final. El motor fija cada paquete al acertar y quita una vida al fallar, así que si dos casillas fueran igual de válidas para un paquete, el jugador podría perder una vida por una deducción correcta. **Todo nivel tiene una única solución.**

### Tratamiento del paquete víctima

El paquete víctima se excluye de todo el proceso de selección de pistas mientras existan otros paquetes pendientes.

En particular, sus reglas:

- no pueden utilizarse para una colocación directa;
- no generan anulaciones mediante el conjunto `A`;
- no participan en reservas de conjuntos de casillas.

La víctima tampoco se considera un paquete pendiente a efectos de buscar conjuntos de `N` reglas y `N` casillas.

Su posición se determina únicamente al final, una vez colocados todos los demás paquetes. Para aceptar el nivel, deberá quedar una única casilla válida para la víctima y esta deberá coincidir con la solución generada.

Gracias a la regla de un paquete por fila y por columna, si hay tantos paquetes como filas y columnas, la víctima queda en la única fila y la única columna libres, sin pistas propias, como en Murdoku. Si hay menos paquetes, puede quedar más de una casilla posible; solo entonces la víctima recibe pistas:

1. Primero se eligen pistas para los demás paquetes, sin contar con la víctima, hasta que todos quedan colocados.
2. Si la víctima no queda determinada por descarte, se añaden pistas suyas hasta que lo esté. Se prefieren pistas que por sí solas no la colocan (`|D| > 1`), de modo que solo se resuelve gracias a las casillas, filas y columnas ya ocupadas por los demás.
3. Al quitar pistas redundantes se mantiene que los demás paquetes se resuelvan sin las pistas de la víctima.

### Evaluación de la dificultad

La dificultad de un nivel no depende únicamente del conjunto de pistas seleccionado, sino también del razonamiento necesario para utilizarlas.

Durante la generación se registra la secuencia de deducciones empleada, distinguiendo entre:

- colocaciones directas;
- anulaciones de casillas;
- reservas de conjuntos de casillas.

Además, se registra información como:

- número de aplicaciones de cada tipo;
- longitud máxima de cadenas de deducciones indirectas;
- tamaño de los conjuntos utilizados en las reservas (`N`).

No obstante, la primera secuencia encontrada no tiene por qué representar la dificultad real del nivel, ya que distintas reglas pueden aplicarse en órdenes diferentes.

Por ello, el generador deberá explorar distintos órdenes de aplicación de las reglas y estimar la dificultad utilizando la secuencia válida más sencilla encontrada.

En una primera implementación, esta exploración podrá realizarse probando distintos órdenes (por ejemplo, aleatorios o guiados por heurísticas). Si alguna estrategia encuentra una resolución significativamente más sencilla que la inicialmente obtenida, esa será la que determine la dificultad real del nivel.

De este modo, la dificultad reflejará el razonamiento mínimo que un jugador puede seguir para resolver el puzle, evitando clasificaciones excesivamente optimistas o pesimistas debidas únicamente al orden de aplicación de las pistas.

#### Implementación actual (`generator/netdoku_gen/difficulty.py`)

No hace falta muestrear órdenes al azar. Las deducciones son monótonas (aplicar una nunca impide aplicar otra), así que basta con simular a un jugador que en cada paso busca todas las deducciones que le hacen avanzar y aplica una de la técnica más sencilla. Ese orden es la secuencia válida más sencilla: la técnica más difícil que aparece en él no se puede evitar con ningún otro orden.

Técnicas, con su nivel:

| Nivel | Técnica | Qué hace el jugador |
|---|---|---|
| 1 | Colocación directa | Un paquete solo cabe en una casilla; se coloca y su fila y su columna quedan descartadas para los demás. |
| 2 | Fila o columna obligada | Solo un paquete puede ir en una fila o columna que debe tener uno. |
| 2 | Anulación | Una pista «… y ningún otro paquete lo estaba» descarta casillas para los demás. |
| 3 | Reserva de 2 | Dos paquetes solo caben en dos casillas, filas o columnas. |
| 4 | Reserva de 3 | Ídem con tres. |
| 5 | Reserva de 4 | Ídem con cuatro. |

En cada paso se registra también cuántas deducciones tenía disponibles el jugador. Un **cuello de botella** es un paso con un único camino posible que no es una colocación directa: el jugador tiene que encontrar justo esa deducción para avanzar.

La dificultad lógica (`level.difficulty.logic`, de 1 a 5) es el nivel de la técnica más difícil necesaria, más 1 si hay al menos dos cuellos de botella, o uno y al menos cuatro pasos no directos. Sus nombres son Muy fácil, Fácil, Media, Difícil y Muy difícil. El informe completo (pasos, técnicas usadas, cuellos de botella y la traza) se guarda en `generation.difficulty`.

Esta fórmula es provisional: hay que calibrarla con partidas reales. Los datos de 700 niveles confirman que influye el número de pistas: con 5 pistas, el 36 % sale Media o más; con 8, el 7 %. Con la v0 (6×6, solo pistas de tablero) el reparto en 150 niveles fue: 19 % Muy fácil, 53 % Fácil, 23 % Media, 5 % Difícil y ninguno Muy difícil; nunca hicieron falta reservas de 3 o 4.

#### Dificultad de interpretación

La dificultad lógica supone que el jugador ya sabe qué casillas permite cada pista. Traducir el texto a casillas tiene su propio coste, que depende de cómo nombra la pista sus elementos: «en la red Aulas» se lee en la leyenda; «en la red de la dirección 10.147.3.5» obliga a aplicar máscaras. Son las [formas de nombrar](netdoku_catalogo_reglas.md#formas-de-nombrar) del catálogo, cada una con un coste de interpretación de 0 a 3.

La dificultad tendrá así dos ejes independientes:

- **Lógica** (`difficulty.logic`): técnicas de deducción y cuellos de botella. Depende solo de los dominios `D` y las anulaciones `A`.
- **Interpretación** (`difficulty.reading`): esfuerzo de pasar del texto de las pistas a casillas, a partir del coste de las formas de nombrar usadas.

El coste de interpretación de una pista es el mayor de los costes de las formas que usa. Solo cuentan cálculos imprescindibles: una forma con coste no se usa si el nivel se resuelve igual sin hacer su cálculo (véase [formas de nombrar](netdoku_catalogo_reglas.md#formas-de-nombrar)). La dificultad de interpretación del nivel, de 1 a 5, es el nivel más alto cuya condición se cumple (escala provisional, que habrá que calibrar jugando):

| Interpretación | Condición |
|---|---|
| 1 | Todas las pistas cuestan 0. |
| 2 | Alguna cuesta 1. |
| 3 | Alguna cuesta 2. |
| 4 | Tres o más cuestan 2, o alguna cuesta 3. |
| 5 | Dos o más cuestan 3. |

La **dificultad global** es la mayor de las dos, más un punto si ambas son 3 o más (hasta 5), porque calcular máscaras dentro de un nivel que además exige reservas cuesta más que cada cosa por separado. Como la forma de nombrar no cambia el efecto lógico, el generador elige primero las pistas (eje lógico) y después los textos (eje de interpretación), según la dificultad buscada y la [proporción de formas de la categoría](netdoku_catalogo_reglas.md#proporción-de-formas-nuevas).

#### Organización de los niveles

Los niveles se organizan en **categoría → dificultad → nivel**:

1. **Categoría:** el conocimiento que exige el nivel, es decir, el bloque temático más alto entre los de sus pistas y formas de nombrar (`requirements.topic`). Son acumulativas: un nivel de una categoría puede usar todo lo de las anteriores. Por ejemplo: Inicial (`T3.dispositivos`, sin conocimientos previos), Direccionamiento (`T3.ip` a `T3.vlsm`), Encaminamiento, Transporte y aplicación (`T4` a `T6`). Encaminamiento (v0.4) es la excepción: no la define un bloque sino que los paquetes tengan ruta, porque el TTL y los routers atravesados se ven en la clase 10, antes que las máscaras; las tablas de encaminamiento (`T3.encaminamiento`) tienen su propia categoría, [Tabla de enrutamiento](#implementación-en-la-v05-categoría-tabla-de-enrutamiento) (v0.5), que va después en el menú. Sus niveles van después de Direccionamiento en el menú y pueden usar sus formas de nombrar (hasta `T3.vlsm`); las más fáciles solo exigen `T3.ip`, y `requirements.topic` dice siempre lo que exige cada nivel.
2. **Dificultad:** la global, de 1 a 5, a partir de la lógica y la de interpretación.
3. **Nivel:** varios por cada combinación, elegidos de un lote grande generado.

## Evaluación

Cada partida generada debe comprobar:

- existencia de una única solución;
- dificultad adecuada;
- ausencia de contradicciones;
- ausencia de ambigüedades;
- ausencia de pistas redundantes.

## Reparación

Cuando una partida no cumple los requisitos no siempre será necesario regenerarla completamente.

### Nivel 1

Modificar únicamente la información visible y las pistas.

### Nivel 2

Modificar la solución manteniendo el mismo mapa.

Por ejemplo:

- mover un paquete;
- cambiar un origen;
- cambiar un destino;
- modificar el equipo infectado.

### Nivel 3

Regenerar completamente el mapa cuando el problema sea estructural.

## Flujo general

```text
Generar mapa
      │
      ▼
Generar solución completa
      │
      ▼
Calcular propiedades y pistas posibles
      │
      ▼
Seleccionar:
- información visible
- pistas
- propiedades ocultas
      │
      ▼
Evaluar dificultad y solución única
      │
      ├── Correcta → Guardar partida
      │
      └── Incorrecta
              │
              ├── Reparar pistas
              ├── Reparar solución
              └── Regenerar mapa
```

Este diseño desacopla completamente el motor del juego del generador de niveles. El motor únicamente interpreta un fichero de partida, mientras que el generador puede evolucionar independientemente, incorporar algoritmos más sofisticados o incluso coexistir con niveles diseñados manualmente utilizando exactamente el mismo formato de partida.
