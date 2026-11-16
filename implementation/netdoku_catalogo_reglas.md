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
| **Formas de nombrar** | Cómo puede referirse el texto a los elementos de sus parámetros (red, equipo, router…), elegidas de las [formas de nombrar](#formas-de-nombrar) comunes. No cambian `D` ni `A`. |
| **Generación de instancias** | Cómo se obtienen todas las reglas verdaderas de este subtipo para una solución. |
| **Dominio `D`** | Casillas compatibles con la regla en el estado actual. |
| **Anulación común `A`** | Casillas descartadas para los demás paquetes (no para el propio `m`), sea cual sea la posición de `m` dentro de `D`: `A(r) = ⋂ CasillasAnuladas(r, c)` para `c ∈ D(r)`. |
| **Compatibilidad** | Restricciones o incompatibilidades con otros subtipos, escenarios o familias. |
| **Bloque mínimo** | [Bloque temático](netdoku_parametros_configuracion.md#bloques-temáticos) a partir del cual se entiende la pista. Puede depender de los parámetros (por ejemplo, del protocolo que nombra). |
| **Conocimiento** | [Nivel de conocimiento](netdoku_parametros_configuracion.md#niveles-de-conocimiento): `basic`, `advanced`, `additional` o `extra`. Puede depender de los parámetros. |

El generador usa el bloque mínimo y el conocimiento para descartar instancias que superen `level.maxTopic` o `difficulty.knowledge`, y para calcular el bloque `requirements` del nivel.

Las reglas **relacionales** calculan `D` para cada paquete implicado, teniendo en cuenta las posiciones posibles de los demás. Las reglas que **restringen una propiedad** deben indicar también cómo se traduce esa propiedad en posiciones; si no se puede traducir con el estado actual, `D = Libres(m)`.

### Formas de nombrar

Una pista tiene dos partes independientes:

- **Qué dice:** su dominio `D` y su anulación `A`. Es lo único que usan el solver, la selección de pistas y la [dificultad lógica](game_round_generation.md#evaluación-de-la-dificultad).
- **Cómo lo dice:** la forma de nombrar cada elemento que menciona. Dos textos que nombran la misma red, uno por su nombre y otro por una dirección IP que cae en ella, dan la misma pista lógica, pero el segundo obliga a hacer un cálculo antes de saber qué casillas permite.

Cada forma de nombrar tiene un **coste de interpretación** (de 0 a 3), un **bloque mínimo** y un **conocimiento**. El coste mide el trabajo que hace el jugador para pasar del texto a las casillas:

| Coste | Trabajo del jugador |
|---|---|
| 0 | Leerlo directamente en el tablero o en la leyenda (un nombre, un prefijo). |
| 1 | Comparar datos visibles con un criterio sencillo (la máscara más larga, un octeto). |
| 2 | Hacer un cálculo con un dato visible (aplicar una máscara dentro de un octeto, contar direcciones). |
| 3 | Un cálculo con varios prefijos distintos o en el límite entre dos redes. |

El coste depende del bloque temático solo en parte: leer un prefijo en la leyenda cuesta 0, como leer un nombre, aunque exija el bloque `T3.ip`. La categoría del nivel la fija el bloque; la dificultad de interpretación, el coste.

El generador elige primero las pistas por su efecto lógico y después la forma de nombrar de cada una, según la dificultad de interpretación y la categoría (bloques temáticos) que se busquen. Así, con un mismo tablero y las mismas pistas, cambiando solo los textos, se obtienen niveles de categorías y dificultades distintas. Solo se puede usar una forma si identifica el elemento sin ambigüedad en el nivel (por ejemplo, «la red con menos direcciones» exige que no haya empate).

Una forma con coste solo se usa si su **cálculo es imprescindible**. Para comprobarlo, el generador sustituye la pista por lo que dice sin calcular: de «junto al servidor web 10.0.3.7» queda «junto a algún servidor web»; de «junto al router con las interfaces …», «junto a algún router»; de una red o una longitud nombradas por dirección, máscara o tamaño, nada. Si con esa pista debilitada el nivel se sigue resolviendo con la misma dificultad lógica o una menor, el cálculo es esquivable (el jugador sabría a qué elemento se refiere por descarte) y la pista solo puede usar formas de coste 0. Si sin el cálculo el nivel no se resuelve, o exige una lógica más difícil, el cálculo cuenta. Así la dificultad de interpretación solo suma cálculos que el jugador tiene que hacer. El generador lo valida en cada nivel, como la solución única.

**Redes:**

| Forma | Ejemplo | Coste | Bloque mínimo | Conocimiento |
|---|---|---|---|---|
| `name` | «la red Aulas» | 0 | `T3.dispositivos` | `basic` |
| `prefix` | «la red 192.168.0.128/25» | 0 | `T3.ip` | `basic` |
| `size_rank` | «la red con menos direcciones» | 1 | `T3.subredes` | `basic` |
| `ip_member` | «la red de la dirección 192.168.0.130» | C | `T3.subredes` (`T3.vlsm` con el plan `vlsm`) | `basic` |
| `router_side` | «la red que une el router de Aulas con …» (pendiente de definir) | 2 | `T3.dispositivos` | `basic` |

**Longitud de prefijo** (solo en `network.prefix_length`):

| Forma | Ejemplo | Coste | Bloque mínimo | Conocimiento |
|---|---|---|---|---|
| `prefix_length` | «una red /25» | 1 | `T3.ip` | `basic` |
| `address_count` | «una red de 128 direcciones» | 2 | `T3.subredes` | `basic` |
| `mask` | «una red con máscara 255.255.255.128» | 2 | `T3.subredes` | `basic` |

**Equipos:**

| Forma | Ejemplo | Coste | Bloque mínimo | Conocimiento |
|---|---|---|---|---|
| `label` | «el servidor web» (solo si es el único con esa etiqueta en el tablero) | 0 | `T3.dispositivos` | `basic` |
| `label_network` | «el servidor web de Aulas» | 0 | `T3.dispositivos` | `basic` |
| `label_prefix` | «el servidor web de la red 192.168.0.128/25» | 0 | `T3.ip` | `basic` |
| `ip` | «el servidor web 192.168.0.130» | C | como `ip_member` | `basic` |
| `service` | «el servidor que atiende el puerto 53» | 2 | `T4.udp` y el bloque del protocolo | el `portKnowledge` del protocolo |

**Routers:**

| Forma | Ejemplo | Coste | Bloque mínimo | Conocimiento |
|---|---|---|---|---|
| `networks` | «el router que une Aulas y Laboratorio» o «…que une 10.0.1.0/24 y 10.0.2.0/24» | 0 | el de la forma de nombrar de cada red | `basic` |
| `interfaces` | «el router con las interfaces 10.0.1.1 y 10.0.2.1» | C (el mayor de los dos cálculos) | como `ip_member` | `basic` |

#### Coste C de calcular la red de una dirección

Las direcciones IP de los equipos no se muestran en el tablero. `ip_member`, `ip` e `interfaces` obligan a calcular a qué red pertenece una dirección, y su coste depende de lo parecidas que sean las redes del nivel, es decir, del [plan de direcciones](netdoku_parametros_configuracion.md#addressingplan) (`addressing.plan`), y de la dirección concreta:

| Plan | Ejemplo de redes | Qué hace falta | C |
|---|---|---|---|
| `distinct` | 10.0.0.0/8, 20.0.0.0/8, 30.0.0.0/8 | Mirar el primer octeto. | 1 |
| `octet_subnets` | 172.16.1.0/24, 172.16.2.0/24… | Comparar un octeto. | 1 |
| `bit_subnets` | 192.168.0.0/25 y 192.168.0.128/25, o cuatro /26 | Aplicar en binario una máscara que no acaba en un octeto. | 2 |
| `vlsm` | Un /24 repartido en /25, /26, /27 y /27 | Lo mismo, con máscaras distintas en cada red. | 3 |

C sube un punto, hasta 3, si la dirección está a `addressing.nearBoundaryDistance` direcciones o menos del límite con otra red del nivel y alguna de las dos máscaras no acaba en un octeto (192.168.0.130 con dos /25; no 172.16.1.254 frente a 172.16.2.0/24, que se distingue comparando el tercer octeto). Las direcciones de red y de difusión solo se usan con `addressing.allowSpecialAddresses`.

Las redes de un nivel nunca se solapan: una dirección pertenece a una sola red. Los prefijos solapados y la coincidencia más larga (LPM) aparecen en las tablas de encaminamiento, con la categoría Encaminamiento.

#### Equipos nombrados por su dirección

Como el jugador no ve las direcciones de los equipos, «junto al servidor web 192.168.0.130» solo le permite calcular la red: el dominio es el de la clase de equipo dentro de esa red, `D = Libres(m) ∩ ⋃ Ady(n)` para los equipos `n` de esa clase en la red de la dirección. Si la red solo tiene un equipo de esa clase, equivale a nombrar ese equipo.

En la v0.3, `label_prefix` e `ip` solo se usan con equipos cuya etiqueta se repite en otras redes pero es única en la suya (los únicos que el generador nombra uno a uno). Así la dirección identifica un equipo concreto, y nombrarla tiene sentido: si el equipo fuera el único con su etiqueta en todo el tablero, el jugador podría ignorar la dirección, y el coste de interpretación sería falso.

La dirección es la que el equipo nombrado tiene en la solución (el nivel guarda la dirección de cada equipo). Mientras el solver no razone sobre qué dirección tiene cada equipo (previsto para la categoría Rutas y TTL), el generador no pone en un mismo nivel dos pistas con direcciones distintas de equipos de la misma clase y la misma red: el jugador deduciría que están junto a equipos distintos, información que el solver no tiene en cuenta.

#### Proporción de formas nuevas

En una categoría que no es la primera, una parte de las pistas usa formas de nombrar propias de esa categoría aunque su coste sea 0 (por ejemplo, `prefix` en lugar de `name` en Direccionamiento), para que el nivel trabaje sus conceptos. La proporción la fija `clues.naming.categoryFormRatio` y varía de un nivel a otro. Siempre hay al menos una, porque es la que hace que el nivel pertenezca a la categoría.

La v0.2 solo usa `name` (con el prefijo entre paréntesis, como etiqueta) y `label_network`. La v0.3 añade las formas de redes, longitudes, equipos y routers de esta sección, salvo `router_side` y `service`.

### Reglas de colocación y objetivo

Este catálogo recoge solo las reglas que ayudan a **colocar** paquetes. La información sobre la víctima y el objetivo final (por ejemplo, «la víctima estaba a solas con el atacante») no es una pista de colocación: forma parte del escenario (`level.scenario`) y se guarda en el bloque `objective` del nivel.

## 2. Subtipos definidos

### `network.in_network`

- **Descripción:** el paquete está en una red concreta.
- **Aridad:** unaria.
- **Restringe:** posición.
- **Parámetros:**
  - `networkId`: identificador de una red del nivel.
- **Plantilla textual:** «El paquete {packet} estaba en la red {network}.», donde `{network}` es la red nombrada con una de sus formas.
- **Formas de nombrar:** `name` (en la v0.2, con el prefijo entre paréntesis), `prefix`, `size_rank` (solo si la red es la única con más o con menos direcciones), `ip_member`.
- **Generación de instancias:** una por paquete: la red de su posición en la solución.
- **Dominio:** `D = Libres(m) ∩ Casillas(networkId)`.
- **Anulación común:** `A = ∅` (colocar `m` en `c` solo ocupa `c`; si `|D| = 1`, la colocación directa ya ocupa esa casilla).
- **Compatibilidad:** las formas que no dan el nombre exigen que la leyenda muestre los prefijos de las redes. `size_rank` exige además la aclaración sobre el [tamaño de una red](#tamaño-de-una-red).
- **Bloque mínimo:** `T3.dispositivos`, o el de la forma de nombrar (`T3.ip` para `prefix`; `T3.subredes` para `size_rank` e `ip_member`).
- **Conocimiento:** `basic`.

### `network.prefix_length`

- **Descripción:** el paquete está en una red con una longitud de prefijo concreta, es decir, con un número de direcciones concreto.
- **Aridad:** unaria.
- **Restringe:** posición.
- **Parámetros:**
  - `prefixLength`: entero entre 8 y 30.
- **Plantilla textual:** «El paquete {packet} estaba en una red {longitud}.», donde `{longitud}` se nombra como «/25», «de 128 direcciones» o «con máscara 255.255.255.128».
- **Formas de nombrar:** `prefix_length`, `address_count`, `mask`.
- **Generación de instancias:** una por paquete, con la longitud de la red de su posición, **solo si al menos dos redes del nivel tienen esa longitud**. Si solo hay una, la pista es `network.in_network` dicha de otra forma y no se genera.
- **Dominio:** `D = Libres(m) ∩ ⋃ Casillas(r)` para todas las redes `r` con prefijo `/prefixLength`.
- **Anulación común:** `A = ∅`.
- **Compatibilidad:** necesita un plan de direcciones con longitudes repetidas pero no todas iguales (`vlsm`, o `bit_subnets` y `octet_subnets` con alguna red de otra longitud); si todas las redes tienen la misma longitud, la pista no aporta nada. Exige la aclaración sobre el [tamaño de una red](#tamaño-de-una-red) cuando habla de direcciones.
- **Bloque mínimo:** `T3.ip` con `prefix_length`; `T3.subredes` con `address_count` y `mask`.
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
- **Formas de nombrar** (nodo concreto): `label`, `label_network`, `label_prefix`, `ip` (véase [equipos nombrados por su dirección](#equipos-nombrados-por-su-dirección)).
- **Generación de instancias:** para cada paquete y cada nodo adyacente a su posición, se genera la forma de nodo concreto y las formas de clase que cumpla ese nodo (`nodeType` solo, y `nodeType` con cada uno de sus servicios).
- **Dominio:**
  - Nodo concreto: `D = Libres(m) ∩ Ady(nodeId)`.
  - Clase: `D = Libres(m) ∩ ⋃ Ady(n)` para todos los nodos `n` de la clase.
- **Anulación común:** `A = ∅`.
- **Compatibilidad:** ninguna especial.
- **Bloque mínimo:** `T3.dispositivos`, o el de la forma de nombrar. El servidor se identifica por su etiqueta, no por lo que hace.
- **Conocimiento:** el del tipo de nodo (`basic`, salvo `firewall`, que es `extra`).

### `node.unique_adjacent_to_node`

- **Descripción:** el paquete es el **único** paquete situado junto a un nodo concreto.
- **Aridad:** unaria en su formulación, aunque afecta a todos los paquetes: los demás no pueden estar junto a ese nodo.
- **Restringe:** posición.
- **Parámetros:**
  - `nodeId`: identificador de un nodo.
- **Plantilla textual:** «El paquete {packet} estaba junto a{l} {node.label}, y ningún otro paquete lo estaba.» Se evita «era el único paquete junto a…» porque es fácil olvidar que la restricción afecta también a los demás paquetes, incluida la víctima.
- **Formas de nombrar:** las mismas que `node.adjacent_to_node`. Con `ip`, la dirección identifica un equipo concreto (véase [equipos nombrados por su dirección](#equipos-nombrados-por-su-dirección)), así que la anulación común no cambia.
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
- **Formas de nombrar:** `networks` (cada red con `name` o `prefix`) e `interfaces` (la dirección del router en cada red).
- **Generación de instancias:** para cada paquete situado en una casilla de apoyo de un router, una instancia.
- **Dominio:** `D = Libres(m) ∩ Apoyo(routerId)`, donde `Apoyo` son las casillas que tocan al router: las dos que comparten el borde en un router de grado 2, o las tres o cuatro de la esquina en uno de grado 3 o 4. En un router de borde hay una casilla en cada red, así que, junto con `network.in_network`, coloca el paquete.
- **Anulación común:** `A = ∅`.
- **Compatibilidad:** ninguna especial. El generador evita colocar nodos en las casillas de apoyo, para que el router sea accesible desde todas sus redes.
- **Bloque mínimo:** `T3.dispositivos`, o el de la forma de nombrar.
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
- **Compatibilidad:** no tienen significado de red. Con la regla de un paquete por fila y por columna, «estaba en la fila 3» también descarta esa fila para todos los demás paquetes una vez colocado. El generador prefiere las pistas de red, nodos y routers, permite como mucho una pista espacial por paquete y solo da fila **y** columna (las coordenadas) como último recurso.
- **Bloque mínimo:** `T3.dispositivos`.
- **Conocimiento:** `basic`.

## 3. Subtipos previstos

Estos son los ejemplos de [description.md](../description.md) que aún no están definidos. Cada uno se completará con la plantilla de la sección siguiente cuando se vaya a usar.

| Tipo | Subtipo propuesto | Ejemplo de texto | Bloque mínimo |
|---|---|---|---|
| `spatial` | `on_board_edge` | «Estaba en el borde del tablero.» | `T3.dispositivos` |
| `node` | `on_node`, `near_node` (a N casillas) | «Estaba en un cliente.» | `T3.dispositivos` |
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
- **Formas de nombrar:** qué formas comunes admite cada parámetro.
- **Generación de instancias:**
- **Dominio:** `D = …`
- **Anulación común:** `A = …`
- **Compatibilidad:**
- **Bloque mínimo:**
- **Conocimiento:**
```

Al añadir un subtipo nuevo:

1. Si su tipo no existe, añadirlo a la tabla de tipos con su familia de `features`.
2. Completar todos los campos de la plantilla. `D` y `A` son obligatorios porque los usa el algoritmo de selección; el bloque mínimo y el conocimiento, porque los usa el filtro por temario. El bloque y el conocimiento de una instancia son los más altos entre los del subtipo y los de las formas de nombrar que use su texto. Ambos deben ser coherentes con el [resumen de la asignatura](netdoku_contenidos_asignatura.md).
3. Quitarlo de la tabla de subtipos previstos, si estaba.
4. Si necesita un concepto nuevo del tablero (por ejemplo, una distancia que atraviese routers), definirlo en la sección 1.
