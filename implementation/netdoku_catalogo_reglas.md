# Catálogo de reglas (pistas) de Netdoku

Este documento define los tipos y subtipos de reglas que pueden usarse como pistas. Es la referencia común para el generador ([generación de partidas](game_round_generation.md)), para los niveles diseñados a mano y para el motor del juego, que solo muestra el texto.

Está pensado para crecer. Añadir una regla nueva consiste en añadir una entrada siguiendo la [plantilla](#plantilla-para-un-subtipo-nuevo), sin modificar el algoritmo de selección de pistas.

## 1. Conceptos comunes

### Identificadores

Cada subtipo se identifica como `tipo.subtipo`, por ejemplo `node.adjacent_to_node`. Ese identificador es el que aparece en el campo `type` de cada pista del fichero de nivel y en los parámetros `features.enabledRuleTypes`, `features.enabledRuleSubtypes`, `features.disabledRuleSubtypes`, `features.requiredRuleSubtypes` y `clues.subtypeWeights` de la configuración.

### Tipos de reglas

Cada tipo agrupa subtipos relacionados y depende de una familia de propiedades (`features.*`). Un subtipo solo puede usarse si su familia está activa.

| Tipo | Familia (`features.*`) | Qué describe | Estado |
|---|---|---|---|
| `spatial` | `spatial` | Posición en el tablero: fila, columna, distancia, bordes. | Definido parcialmente |
| `network` | `networks` | Pertenencia a una red y características de las redes (prefijo, tamaño). | Definido parcialmente |
| `node` | `nodes` | Relación con nodos: junto a, sobre, cerca de. | Definido parcialmente |
| `router` | `spatial` + `networks` | Relación con routers: junto a un router, a N casillas de un router. | Definido parcialmente |
| `protocol` | `protocols` | Protocolo, transporte y puerto del paquete. | Previsto |
| `endpoint` | `origins` / `destinations` | Origen y destino del paquete. | Previsto |
| `route` | `routes` / `hops` | Ruta seguida, routers atravesados, siguiente salto. | Previsto |
| `ttl` | `ttl` | Valor del TTL y comparaciones de TTL. | Previsto |
| `relation` | según las propiedades comparadas | Comparaciones entre varios paquetes. | Previsto |

Para añadir un tipo nuevo se añade una fila a esta tabla y, si hace falta, una familia nueva en `features`.

### Estado del tablero

Los dominios se calculan sobre el estado actual de la deducción:

- **casillas ocupadas por nodos**: los paquetes no pueden colocarse sobre ellas;
- **casillas ocupadas por paquetes ya colocados**;
- **casillas anuladas**: descartadas para todos los paquetes pendientes;
- **casillas reservadas**: un conjunto de `N` casillas reservado para `N` paquetes concretos, que no admite a ningún otro.

`Libres(m)` es el conjunto de casillas en las que el paquete `m` aún podría estar. Excluye las ocupadas, las anuladas y las reservadas para otros paquetes, y solo tiene en cuenta las restricciones ya aplicadas a `m`.

### Adyacencia

Dos casillas son **adyacentes** si comparten un lado (arriba, abajo, izquierda o derecha) **y pertenecen a la misma red**. Las diagonales no cuentan. Tampoco cuentan dos casillas contiguas de redes distintas, aunque haya un router entre ellas. Es el mismo criterio que usa Murdoku con las habitaciones.

`Ady(x)` es el conjunto de casillas adyacentes a una casilla, o a la casilla de un nodo, `x`.

### Tamaño de una red

El tamaño de una red es su **número de direcciones**, `2^(32−n)` para un prefijo `/n`. El número de casillas del tablero no cuenta. Las plantillas textuales de las reglas de tamaño deben hablar de «direcciones» o del prefijo, nunca de «la red más grande», y un nivel que use alguna de ellas debe mostrar una aclaración de una línea: «las casillas no indican el tamaño de la red».

### Interfaz de un subtipo

Cada subtipo define estos campos:

| Campo | Contenido |
|---|---|
| **Identificador** | `tipo.subtipo`. |
| **Descripción** | Qué información aporta la regla. |
| **Aridad** | `unaria` (afecta a un paquete) o `relacional` (relaciona varios paquetes). |
| **Restringe** | `posición` (limita directamente las casillas posibles) o `propiedad` (limita una propiedad, como el protocolo o el TTL, que a su vez puede limitar la posición). |
| **Parámetros** | Nombre, dominio y significado de cada parámetro. |
| **Plantilla textual** | Texto de la pista con marcadores `{parámetro}`. Puede tener variantes. |
| **Generación de instancias** | Cómo se obtienen todas las reglas verdaderas de este subtipo para una solución. |
| **Dominio `D`** | Casillas compatibles con la regla en el estado actual. |
| **Anulación común `A`** | Casillas descartadas para los demás paquetes (no para el propio `m`), sea cual sea la posición de `m` dentro de `D`: `A(r) = ⋂ CasillasAnuladas(r, c)` para `c ∈ D(r)`. |
| **Compatibilidad** | Restricciones o incompatibilidades con otros subtipos, escenarios o familias. |
| **Bloque mínimo** | [Bloque temático](netdoku_parametros_configuracion.md#bloques-temáticos) a partir del cual se entiende la pista. Puede depender de los parámetros (por ejemplo, del protocolo que nombra). |
| **Conocimiento** | [Nivel de conocimiento](netdoku_parametros_configuracion.md#niveles-de-conocimiento): `basic`, `advanced`, `additional` o `extra`. Puede depender de los parámetros. |

El generador usa el bloque mínimo y el conocimiento para descartar instancias que superen `level.maxTopic` o `difficulty.knowledge`, y para calcular el bloque `requirements` del nivel.

Las reglas **relacionales** calculan `D` para cada paquete implicado, teniendo en cuenta las posiciones posibles de los demás. Las reglas que **restringen una propiedad** deben indicar también cómo se traduce esa propiedad en posiciones; si no se puede traducir con el estado actual, `D = Libres(m)`.

### Reglas de colocación y objetivo

Este catálogo recoge solo las reglas que ayudan a **colocar** paquetes. La información sobre la víctima y el objetivo final (por ejemplo, «la víctima estaba a solas con el atacante») no es una pista de colocación: forma parte del escenario (`level.scenario`) y se guarda en el bloque `objective` del nivel.

## 2. Subtipos definidos

### `network.in_network`

- **Descripción:** el paquete está en una red concreta.
- **Aridad:** unaria.
- **Restringe:** posición.
- **Parámetros:**
  - `networkId`: identificador de una red del nivel.
- **Plantilla textual:**
  - «El paquete {packet} estaba en la red {network.name} ({network.prefix}).»
  - Variante solo con prefijo: «El paquete {packet} estaba en la red {network.prefix}.»
- **Generación de instancias:** una por paquete: la red de su posición en la solución.
- **Dominio:** `D = Libres(m) ∩ Casillas(networkId)`.
- **Anulación común:** `A = ∅` (colocar `m` en `c` solo ocupa `c`; si `|D| = 1`, la colocación directa ya ocupa esa casilla).
- **Compatibilidad:** las variantes que solo dan el prefijo exigen que el tablero muestre los prefijos de las redes.
- **Bloque mínimo:** `T3.dispositivos`. El prefijo funciona como una etiqueta de la red; no hace falta entenderlo.
- **Conocimiento:** `basic`.

### `node.adjacent_to_node`

- **Descripción:** el paquete está junto a un nodo concreto o junto a algún nodo de una clase.
- **Aridad:** unaria.
- **Restringe:** posición.
- **Parámetros**, exactamente una de estas dos formas:
  - **Nodo concreto:** `nodeId`.
  - **Clase de nodo:** `nodeType` (`client`, `server`, `firewall`, `switch`, `access_point`) y, opcionalmente, `service` (solo si `nodeType: server`).
- **Plantilla textual:**
  - Nodo concreto: «El paquete {packet} estaba junto a{l} {node.label}.» Solo debe usarse si el jugador puede identificar el nodo sin ambigüedad, porque es único de su clase o porque el texto lo distingue.
  - Clase: «El paquete {packet} estaba junto a un {clase}.» (por ejemplo, «un servidor de ficheros», «un equipo de usuario»).
- **Generación de instancias:** para cada paquete y cada nodo adyacente a su posición, se genera la forma de nodo concreto y las formas de clase que cumpla ese nodo (`nodeType` solo, y `nodeType` con cada uno de sus servicios).
- **Dominio:**
  - Nodo concreto: `D = Libres(m) ∩ Ady(nodeId)`.
  - Clase: `D = Libres(m) ∩ ⋃ Ady(n)` para todos los nodos `n` de la clase.
- **Anulación común:** `A = ∅`.
- **Compatibilidad:** ninguna especial.
- **Bloque mínimo:** `T3.dispositivos`. El servidor se identifica por su etiqueta, no por lo que hace.
- **Conocimiento:** el del tipo de nodo (`basic`, salvo `firewall`, que es `extra`).

### `node.unique_adjacent_to_node`

- **Descripción:** el paquete es el **único** paquete situado junto a un nodo concreto.
- **Aridad:** unaria en su formulación, aunque afecta a todos los paquetes: los demás no pueden estar junto a ese nodo.
- **Restringe:** posición.
- **Parámetros:**
  - `nodeId`: identificador de un nodo.
- **Plantilla textual:** «El paquete {packet} era el único paquete situado junto a{l} {node.label}.»
- **Generación de instancias:** para cada nodo `n` que tenga exactamente un paquete adyacente en la solución, una instancia para ese paquete.
- **Dominio:** `D = Libres(m) ∩ Ady(nodeId)`.
- **Anulación común:** `A = Ady(nodeId)`, para todos los paquetes salvo `m`. Si `m` ocupa `c ∈ D`, `c` queda ocupada y el resto de `Ady(nodeId)` queda prohibido para los demás porque `m` es el único junto al nodo. Así, para cualquier `c` las casillas anuladas son todas las de `Ady(nodeId)`. Por eso este subtipo sirve para la estrategia de anulación aunque `|D| > 1`.
- **Compatibilidad:** misma condición de identificabilidad del nodo que `node.adjacent_to_node`.
- **Bloque mínimo:** `T3.dispositivos`.
- **Conocimiento:** el del tipo de nodo, como en `node.adjacent_to_node`.

### `router.adjacent_to_router`

- **Descripción:** el paquete está junto a un router concreto.
- **Aridad:** unaria.
- **Restringe:** posición.
- **Parámetros:**
  - `routerId`: identificador de un router.
- **Plantilla textual:** «El paquete {packet} estaba junto al router que une {red1} y {red2}.» El router se identifica por las redes que une; como no hay dos routers con el mismo conjunto de redes, no hay ambigüedad.
- **Generación de instancias:** para cada paquete situado en una casilla de apoyo de un router, una instancia.
- **Dominio:** `D = Libres(m) ∩ Apoyo(routerId)`, donde `Apoyo` son las casillas que tocan al router: las dos que comparten el borde en un router de grado 2, o las tres o cuatro de la esquina en uno de grado 3 o 4. En un router de borde hay una casilla en cada red, así que, junto con `network.in_network`, coloca el paquete.
- **Anulación común:** `A = ∅`.
- **Compatibilidad:** ninguna especial. El generador evita colocar nodos en las casillas de apoyo, para que el router sea accesible desde todas sus redes.
- **Bloque mínimo:** `T3.dispositivos`.
- **Conocimiento:** `basic`.

### `spatial.in_row` y `spatial.in_column`

- **Descripción:** el paquete está en una fila (o columna) concreta del tablero.
- **Aridad:** unaria.
- **Restringe:** posición.
- **Parámetros:**
  - `row` (o `column`): índice desde 1.
- **Plantilla textual:** «El paquete {packet} estaba en la fila {row}.» / «… en la columna {column}.»
- **Generación de instancias:** una de cada por paquete.
- **Dominio:** `D = Libres(m) ∩ Fila(row)` (o `Columna(column)`).
- **Anulación común:** `A = ∅`.
- **Compatibilidad:** no tienen significado de red. Sin una regla global de «un paquete por fila y columna», sirven para fijar una casilla concreta dentro de un dominio pequeño (por ejemplo, junto a un nodo). El generador prefiere las pistas de red, nodos y routers, permite como mucho una pista espacial por paquete y solo da fila **y** columna (las coordenadas) como último recurso.
- **Bloque mínimo:** `T3.dispositivos`.
- **Conocimiento:** `basic`.

## 3. Subtipos previstos

Estos son los ejemplos de [description.md](../description.md) que aún no están definidos. Cada uno se completará con la plantilla de la sección siguiente cuando se vaya a usar.

| Tipo | Subtipo propuesto | Ejemplo de texto | Bloque mínimo |
|---|---|---|---|
| `spatial` | `on_board_edge` | «Estaba en el borde del tablero.» | `T3.dispositivos` |
| `node` | `on_node`, `near_node` (a N casillas) | «Estaba en un cliente.» | `T3.dispositivos` |
| `network` | `most_addresses_network`, `fewest_addresses_network`, `network_prefix_length` | «Pertenece a una red /24.» | `T3.subredes` |
| `router` | `distance_to_router` | «Está exactamente a dos casillas de un router.» | `T3.dispositivos` |
| `protocol` | `uses_protocol` | «Utiliza HTTPS.» | El del protocolo (`topic` del catálogo). |
| `protocol` | `uses_transport`, `destination_port` | «Viaja sobre UDP.» | `T4.udp` o `T4.tcp`, y como mínimo el del protocolo que permite deducir. |
| `endpoint` | `at_origin`, `at_destination`, `in_origin_network`, `in_destination_network` | «Aún no ha abandonado la red origen.» | `T3.ip` |
| `route` | `about_to_cross_router`, `just_crossed_router` | «Acaba de atravesar un router.» | `T3.ip` |
| `route` | `next_hop_is_destination_network`, `next_hop` | «El siguiente salto será la red del destino.» | `T3.encaminamiento` |
| `ttl` | `ttl_value`, `routers_crossed` | «Ha atravesado exactamente tres routers.» | `T3.ip` |
| `relation` | `closer_to_destination`, `higher_ttl` | «El paquete rojo tiene mayor TTL que el azul.» | `T3.ip` |
| `relation` | `same_protocol` | «Utiliza el mismo protocolo que el azul.» | El del protocolo. |
| `relation` | `more_addresses_network` | «El rojo está en una red con más direcciones que el azul.» | `T3.subredes` |

Salvo que se indique otra cosa, el conocimiento previsto es `basic`; las pistas de puerto toman el `portKnowledge` del protocolo.

## Plantilla para un subtipo nuevo

```markdown
### `tipo.subtipo`

- **Descripción:**
- **Aridad:** unaria | relacional.
- **Restringe:** posición | propiedad.
- **Parámetros:**
  - `parámetro`: dominio y significado.
- **Plantilla textual:**
  - «…{parámetro}…»
- **Generación de instancias:**
- **Dominio:** `D = …`
- **Anulación común:** `A = …`
- **Compatibilidad:**
- **Bloque mínimo:**
- **Conocimiento:**
```

Al añadir un subtipo nuevo:

1. Si su tipo no existe, añadirlo a la tabla de tipos con su familia de `features`.
2. Completar todos los campos de la plantilla. `D` y `A` son obligatorios porque los usa el algoritmo de selección; el bloque mínimo y el conocimiento, porque los usa el filtro por temario. Ambos deben ser coherentes con el [resumen de la asignatura](netdoku_contenidos_asignatura.md).
3. Quitarlo de la tabla de subtipos previstos, si estaba.
4. Si necesita un concepto nuevo del tablero (por ejemplo, una distancia que atraviese routers), definirlo en la sección 1.
