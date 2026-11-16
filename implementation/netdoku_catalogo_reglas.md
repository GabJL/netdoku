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
| `endpoint` | `origins` / `destinations` | Origen y destino del paquete. | Definido parcialmente (v0.4) |
| `route` | `routes` / `hops` | Ruta seguida, routers atravesados, siguiente salto. | Definido parcialmente (v0.4) |
| `ttl` | `ttl` | Valor del TTL y comparaciones de TTL. | Definido parcialmente (v0.4) |
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
| `contents` | «la red sin servidores», «la red con un solo equipo de usuario» (solo si ninguna otra red cumple la descripción) | 0 | `T3.dispositivos` | `basic` |
| `prefix` | «la red 192.168.0.128/25» | 0 | `T3.ip` | `basic` |
| `size_rank` | «la red con menos direcciones» | 1 | `T3.subredes` | `basic` |
| `first_host` | «la red cuya primera dirección asignable es 192.168.0.129» | 1 | `T3.subredes` | `basic` |
| `address_count` | «la red de 128 direcciones» (solo si es la única con esa longitud) | 2 | `T3.subredes` | `basic` |
| `usable_count` | «la red con 126 direcciones asignables» (ídem) | 2 | `T3.subredes` | `basic` |
| `mask` | «la red con máscara 255.255.255.128» (ídem) | 2 | `T3.subredes` | `basic` |
| `ip_member` | «la red de la dirección 192.168.0.130» | C | `T3.subredes` (`T3.vlsm` con el plan `vlsm`) | `basic` |
| `broadcast` | «la red cuya dirección de difusión es 192.168.0.255» | C | como `ip_member` | `basic` |
| `last_host` | «la red cuya última dirección asignable es 192.168.0.254» | C | como `ip_member` | `basic` |
| `router_side` | «la red que une el router de Aulas con …» (pendiente de definir) | 2 | `T3.dispositivos` | `basic` |

**Longitud de prefijo** (solo en `network.prefix_length`):

| Forma | Ejemplo | Coste | Bloque mínimo | Conocimiento |
|---|---|---|---|---|
| `prefix_length` | «una red /25» | 1 | `T3.ip` | `basic` |
| `address_count` | «una red de 128 direcciones» | 2 | `T3.subredes` | `basic` |
| `usable_count` | «una red con 126 direcciones asignables» | 2 | `T3.subredes` | `basic` |
| `mask` | «una red con máscara 255.255.255.128» | 2 | `T3.subredes` | `basic` |

**Filas y columnas** (solo en `spatial.in_row` y `spatial.in_column`):

| Forma | Ejemplo | Coste | Bloque mínimo | Conocimiento |
|---|---|---|---|---|
| `number` | «en la fila 3» | 0 | `T3.dispositivos` | `basic` |
| `aligned_node` | «en la misma fila que el servidor DNS» | 0 | el de la forma de nombrar del equipo (`label`, `label_network` o `label_prefix`) | `basic` |
| `aligned_router` | «en la misma columna que el router que une Aulas y Servicios» | 0 | el de la forma de nombrar del router (`networks`) | `basic` |

**Pistas de ruta y TTL** (formas de toda la pista, no de un elemento; véase [Encaminamiento](#encaminamiento-rutas-y-ttl-v04)):

| Forma | Ejemplo | Coste | Bloque mínimo | Conocimiento |
|---|---|---|---|---|
| `ip_view` | «El siguiente router que iba a atravesar era el que une Aulas y Servicios» | 0 | `T3.ip` | `basic` |
| `mac_view` | «La trama que lo llevaba iba dirigida al router que une Aulas y Servicios» | 1 | `T3.subredes` (ARP y MAC del siguiente salto) | `basic` |
| `count` | «Había atravesado exactamente dos routers» | 0 | `T3.ip` | `basic` |
| `ttl_value` | «Llevaba TTL 2» (con TTL inicial 4 en su ficha) | 1 | `T3.ip` | `basic` |

`mac_view` dice lo mismo desde la capa de enlace: la IP de destino de un paquete no cambia en todo el camino, pero la trama que lo lleva por cada red va dirigida a la MAC del siguiente salto (un router o, en la red del destino, el propio destino) y la envía el equipo o router anterior. Es la duda del ejercicio «Viaje con escalas» del resumen de la asignatura. `ttl_value` obliga a restar: routers atravesados = TTL inicial − TTL actual. Si la pista nombra además un router por sus interfaces, su coste es el mayor de los dos.

`aligned_node` y `aligned_router` nombran la fila (o la columna) por un elemento que está en ella. Un router de borde está en una sola fila si separa dos casillas de esa fila (borde vertical) y en una sola columna si separa dos casillas de esa columna (borde horizontal); solo se usa en ese caso. El equipo o el router se nombran con formas de coste 0, así que no añaden cálculo.

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

Las redes de un nivel nunca se solapan: una dirección pertenece a una sola red. Los prefijos solapados y la coincidencia más larga (LPM) aparecen en las tablas de encaminamiento (v0.5).

#### Identificador, difusión y direcciones asignables

Una red `/n` tiene `2^(32−n)` direcciones. La primera es el **identificador de red** y la última, la **difusión**; las `2^(32−n) − 2` restantes son **asignables** (a equipos y a interfaces de routers). Cuatro formas de nombrar una red se apoyan en esto (se dice «asignable» y no «para equipos» porque los routers también las usan):

- `first_host` cuesta 1: restando 1 a la primera dirección asignable sale el identificador, que se lee en la leyenda.
- `broadcast` y `last_host` cuestan C, como `ip_member`: para saber qué red acaba en esa dirección hay que calcular dónde acaban las redes candidatas. Como la difusión y la última asignable están siempre en el límite de su red, se aplica el punto de más por estar cerca del límite cuando la red siguiente es del nivel y alguna de las dos máscaras no acaba en un octeto: salen 1 con `distinct` y `octet_subnets`, 3 con `vlsm` y casi siempre con `bit_subnets` (2 si es la última red del bloque).
- `usable_count` cuesta 2, como `address_count`: sumar 2 no es un cálculo más difícil, sino una trampa de concepto.

No se nombra la red por su «puerta de enlace»: en los niveles el router no tiene por qué llevar la primera dirección asignable, y una red puede tener varios routers. Estas formas no asignan ninguna dirección a un equipo, así que no dependen de `addressing.allowSpecialAddresses`.

`address_count`, `usable_count` y `mask` sirven también para nombrar una red concreta cuando es la única del nivel con esa longitud de prefijo; si hay varias, la pista es `network.prefix_length`.

#### Equipos nombrados por su dirección

Como el jugador no ve las direcciones de los equipos, «junto al servidor web 192.168.0.130» solo le permite calcular la red: el dominio es el de la clase de equipo dentro de esa red, `D = Libres(m) ∩ ⋃ Ady(n)` para los equipos `n` de esa clase en la red de la dirección. Si la red solo tiene un equipo de esa clase, equivale a nombrar ese equipo.

En la v0.3, `label_prefix` e `ip` solo se usan con equipos cuya etiqueta se repite en otras redes pero es única en la suya (los únicos que el generador nombra uno a uno). Así la dirección identifica un equipo concreto, y nombrarla tiene sentido: si el equipo fuera el único con su etiqueta en todo el tablero, el jugador podría ignorar la dirección, y el coste de interpretación sería falso.

La dirección es la que el equipo nombrado tiene en la solución (el nivel guarda la dirección de cada equipo). Mientras el solver no razone sobre qué dirección tiene cada equipo (previsto para más adelante), el generador no pone en un mismo nivel dos pistas con direcciones distintas de equipos de la misma clase y la misma red: el jugador deduciría que están junto a equipos distintos, información que el solver no tiene en cuenta.

#### Proporción de formas nuevas

En una categoría que no es la primera, una parte de las pistas usa formas de nombrar propias de esa categoría aunque su coste sea 0 (por ejemplo, `prefix` en lugar de `name` en Direccionamiento), para que el nivel trabaje sus conceptos. La proporción la fija `clues.naming.categoryFormRatio` y varía de un nivel a otro. Siempre hay al menos una, porque es la que hace que el nivel pertenezca a la categoría.

La v0.2 solo usa `name` (con el prefijo entre paréntesis, como etiqueta) y `label_network`. La v0.3 añade las formas de redes, longitudes, equipos y routers de esta sección, salvo `router_side` y `service`. La v0.3.5 añade `contents`, `first_host`, `broadcast`, `last_host`, `usable_count`, las formas de tamaño para redes concretas y las de filas y columnas. En la categoría Inicial, cada pista elige al azar entre las formas de coste 0 que no son de otra categoría (`name` o `contents`; `number`, `aligned_node` o `aligned_router`).

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
- **Formas de nombrar:** todas las de redes: `name` (en la v0.2, con el prefijo entre paréntesis), `contents`, `prefix`, `size_rank` (solo si la red es la única con más o con menos direcciones), `first_host`, `address_count`, `usable_count`, `mask`, `ip_member`, `broadcast` y `last_host`.
- **Generación de instancias:** una por paquete: la red de su posición en la solución.
- **Dominio:** `D = Libres(m) ∩ Casillas(networkId)`.
- **Anulación común:** `A = ∅` (colocar `m` en `c` solo ocupa `c`; si `|D| = 1`, la colocación directa ya ocupa esa casilla).
- **Compatibilidad:** las formas que no dan el nombre exigen que la leyenda muestre los prefijos de las redes. Las que hablan del tamaño (`size_rank`, `address_count`, `usable_count`, `mask`) exigen además la aclaración sobre el [tamaño de una red](#tamaño-de-una-red).
- **Bloque mínimo:** `T3.dispositivos`, o el de la forma de nombrar (`T3.ip` para `prefix`; `T3.subredes` para las demás formas con direcciones).
- **Conocimiento:** `basic`.

### `network.not_in_network`

- **Descripción:** el paquete **no** está en una red concreta. Obliga a razonar descartando.
- **Aridad:** unaria.
- **Restringe:** posición.
- **Parámetros:**
  - `networkId`: identificador de una red del nivel en la que no está el paquete.
- **Plantilla textual:** «El paquete {packet} no estaba en la red {network}.»
- **Formas de nombrar:** las mismas que `network.in_network`.
- **Generación de instancias:** para cada paquete, una por cada red que no es la suya.
- **Dominio:** `D = Libres(m) \ Casillas(networkId)`.
- **Anulación común:** `A = ∅`.
- **Compatibilidad:** las de `network.in_network`. Sin hacer el cálculo de una forma con coste no queda nada, como en `network.in_network`.
- **Bloque mínimo:** el de la forma de nombrar.
- **Conocimiento:** `basic`.

### `network.in_either_network`

- **Descripción:** el paquete está en una de dos redes (disyunción).
- **Aridad:** unaria.
- **Restringe:** posición.
- **Parámetros:**
  - `networkIds`: dos redes del nivel; una es la del paquete.
- **Plantilla textual:** «El paquete {packet} estaba en la red {network1} o en la red {network2}.» Las redes van en el orden de sus identificadores, así que la verdadera puede ser cualquiera de las dos.
- **Formas de nombrar:** las de `network.in_network`, en cada red por separado.
- **Generación de instancias:** para cada paquete, una por cada red que no es la suya, emparejada con la suya.
- **Dominio:** `D = Libres(m) ∩ (Casillas(network1) ∪ Casillas(network2))`.
- **Anulación común:** `A = ∅`.
- **Compatibilidad:** las de `network.in_network`. Con cuatro redes equivale a dos pistas negativas, pero se lee de otra forma.
- **Bloque mínimo:** el más alto de las formas de nombrar.
- **Conocimiento:** `basic`.

### `network.node_count`

- **Descripción:** el paquete está en una red con un número exacto de equipos de una clase (recuento). El jugador tiene que contar los equipos de cada red.
- **Aridad:** unaria.
- **Restringe:** posición.
- **Parámetros:**
  - `nodeType` (`client` o `server`) y, opcionalmente, `service` (si `nodeType: server`): la clase de equipo que se cuenta.
  - `count`: número exacto de equipos de esa clase en la red, de 0 a 3.
- **Plantilla textual:** «El paquete {packet} estaba en una red sin servidores.» / «… con un solo servidor web.» / «… con exactamente dos equipos de usuario.»
- **Formas de nombrar:** ninguna.
- **Generación de instancias:** para la red de cada paquete y cada clase de equipo (equipos de usuario, servidores y servidores de cada servicio del nivel), una instancia con el número de equipos de esa clase en la red, **solo si al menos dos redes tienen ese número y no lo tienen todas**. Si solo lo tiene una, la descripción es la forma `contents` de esa red.
- **Dominio:** `D = Libres(m) ∩ ⋃ Casillas(r)` para las redes `r` con `count` equipos de la clase.
- **Anulación común:** `A = ∅`.
- **Compatibilidad:** ninguna especial.
- **Bloque mínimo:** `T3.dispositivos`.
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

### `node.not_adjacent_to_node`

- **Descripción:** el paquete **no** está junto a un nodo concreto, o no está junto a ningún nodo de una clase.
- **Aridad:** unaria.
- **Restringe:** posición.
- **Parámetros:** como en `node.adjacent_to_node`, `nodeId` o bien `nodeType` y, opcionalmente, `service`.
- **Plantilla textual:**
  - Nodo concreto: «El paquete {packet} no estaba junto a{l} {node.label}.»
  - Clase: «El paquete {packet} no estaba junto a ningún {clase}.»
- **Formas de nombrar** (nodo concreto): las de `node.adjacent_to_node`. Sin hacer el cálculo de `ip`, el jugador solo sabe que no está junto a alguno de los equipos con esa etiqueta, así que solo puede descartar las casillas que están junto a todos ellos.
- **Generación de instancias:** para cada paquete, una por cada nodo identificable que no tiene al lado y una por cada clase de nodo de la que no tiene ninguno al lado (si la clase existe en el nivel).
- **Dominio:**
  - Nodo concreto: `D = Libres(m) \ Ady(nodeId)`.
  - Clase: `D = Libres(m) \ ⋃ Ady(n)` para todos los nodos `n` de la clase.
- **Anulación común:** `A = ∅`.
- **Compatibilidad:** misma condición de identificabilidad del nodo que `node.adjacent_to_node`.
- **Bloque mínimo:** `T3.dispositivos`, o el de la forma de nombrar.
- **Conocimiento:** el del tipo de nodo.

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

### Encaminamiento: rutas y TTL (v0.4)

En la categoría Encaminamiento, la ficha de cada paquete muestra su **origen** (un equipo), su **destino** (un equipo o la difusión de su red) y su **TTL inicial**. El jugador no ve la ruta: la traza él en el mapa. Para que pueda hacerlo sin las tablas de encaminamiento, previstas para la v0.5, el generador solo usa pares de origen y destino con un **único camino mínimo** en el grafo Red↔Router.

Conceptos que usan los subtipos de esta sección:

- **Ruta** de un paquete: las redes `r0, r1, …, rL`, desde la de su origen (`r0`) hasta la de su destino (`rL`), y los routers `R1, …, RL`, donde `Ri` une `r(i−1)` y `ri`. `L` es el número de routers del camino.
- **Routers atravesados** `k`: el paquete está en una casilla libre de la red `rk` de su ruta.
- **TTL actual** = TTL inicial − `k`. Un paquete en el tablero tiene siempre TTL ≥ 1, así que `k ≤ TTL inicial − 1`. Si `L` es mayor, el paquete no llegará a su destino: lo descartará el router `R(TTL inicial)`, como en el ejercicio «No time to die».
- **Alcanzables(m)**: casillas libres de las redes `r0, …, rK` de la ruta de `m`, con `K = min(L, TTL inicial − 1)`.

**Restricción implícita (regla del nivel, no pista):** cada paquete está en una casilla de `Alcanzables(m)`. El nivel la declara en `rules.packetOnRoute` y el solver la aplica desde el principio, como la regla de un paquete por fila y columna. Leer la ficha y trazar la ruta es el trabajo propio de la categoría. En los subtipos de esta sección, `Libres(m)` ya está dentro de `Alcanzables(m)`.

**Paquetes de difusión.** No es una pista sino una clase de paquete: su destino es la **dirección de difusión de su red**, como una petición DHCP. La ficha muestra «Destino: difusión (192.168.1.255)». Como la difusión no atraviesa routers, su ruta es solo la red de su origen (`L = 0`) y el paquete está en ella. Como mucho uno por nivel. Bloque mínimo `T3.subredes` (difusión; con DHCP, `T3.vlsm`).

Todos los subtipos de esta sección son unarios, restringen la posición y tienen `A = ∅`; su conocimiento es `basic`.

Varios dicen a menudo lo mismo: para un paquete que ha atravesado un router, «había atravesado exactamente un router», «el último router que había atravesado era…» y «el siguiente router que iba a atravesar era…» tienen el mismo `D`. Por eso, en estos subtipos, dos pistas solo se consideran repetidas si además son del mismo subtipo (en el resto, basta con que tengan el mismo `D` y la misma `A`), y en la selección pesan más que las demás. Cada nivel de la categoría tiene al menos tres (`clues.categoryMinClues`).

Para comprobar que un cálculo es imprescindible (véase [Coste C](#coste-c-de-calcular-la-red-de-una-dirección)), sin entender la trama (`mac_view`) ni restar el TTL (`ttl_value`) la pista no dice nada; de un router nombrado por sus interfaces queda que el paquete había atravesado alguno (`last_router`) o que le quedaba alguno por atravesar (`next_router`).

#### `endpoint.in_origin_network`

- **Descripción:** el paquete aún no ha salido de la red de su origen (`k = 0`).
- **Plantilla textual:** «El paquete {packet} aún no había salido de la red de su origen.» Con `mac_view`: «La trama que llevaba el paquete {packet} la había enviado su propio equipo de origen.»
- **Formas:** `ip_view`, `mac_view`.
- **Generación de instancias:** una por paquete con `k = 0` cuya ruta no sea solo esa red (si no, no dice nada).
- **Dominio:** `D = Libres(m) ∩ Casillas(r0)`.
- **Bloque mínimo:** `T3.ip`; `T3.subredes` con `mac_view`.

#### `endpoint.in_destination_network`

- **Descripción:** el paquete ya ha llegado a la red de su destino (`k = L`).
- **Plantilla textual:** «El paquete {packet} ya había llegado a la red de su destino.» Con `mac_view`: «La trama que llevaba el paquete {packet} iba dirigida directamente a su equipo de destino.» (entrega directa).
- **Formas:** `ip_view`, `mac_view`.
- **Generación de instancias:** una por paquete con `k = L > 0`.
- **Dominio:** `D = Libres(m) ∩ Casillas(rL)`.
- **Bloque mínimo:** `T3.ip`; `T3.subredes` con `mac_view`.

#### `route.in_transit_network`

- **Descripción:** el paquete está pasando por una red de tránsito (sin equipos).
- **Plantilla textual:** «El paquete {packet} estaba pasando por una red de tránsito.»
- **Generación de instancias:** una por paquete situado en una red de tránsito.
- **Dominio:** `D = Libres(m) ∩ ⋃ Casillas(ri)` para las redes de tránsito de su ruta.
- **Bloque mínimo:** `T3.ip`.

#### `route.last_router`

- **Descripción:** el último router que atravesó el paquete es uno concreto (`Rk`, con `k ≥ 1`). Hay que saber en qué sentido va el paquete para saber a qué lado del router está.
- **Plantilla textual:** «El último router que había atravesado el paquete {packet} era el router {router}.» Con `mac_view`: «La trama que llevaba el paquete {packet} la había enviado el router {router}.»
- **Formas:** las del router (`networks`, `networks_prefix`, `interfaces`) y, para toda la pista, `ip_view` o `mac_view`.
- **Generación de instancias:** una por paquete con `k ≥ 1`.
- **Dominio:** `D = Libres(m) ∩ Casillas(rk)`, la red en la que entró al atravesar `Rk`.
- **Bloque mínimo:** `T3.ip`, o el de las formas.

#### `route.next_router`

- **Descripción:** el siguiente router que atravesará el paquete es uno concreto (`R(k+1)`, con `k < L`).
- **Plantilla textual:** «El siguiente router que iba a atravesar el paquete {packet} era el router {router}.» Con `mac_view`: «La trama que llevaba el paquete {packet} iba dirigida al router {router}.»
- **Formas:** como en `route.last_router`.
- **Generación de instancias:** una por paquete con `k < L`, aunque el TTL no le alcance para atravesarlo (el paquete aún no lo sabe).
- **Dominio:** `D = Libres(m) ∩ Casillas(rk)`, la red anterior a `R(k+1)`.
- **Bloque mínimo:** `T3.ip`, o el de las formas.

#### `ttl.routers_crossed`

- **Descripción:** el paquete ha atravesado exactamente `n` routers.
- **Plantilla textual:** «El paquete {packet} había atravesado exactamente {n} routers.» Con `ttl_value`: «El paquete {packet} llevaba TTL {t}.»
- **Formas:** `count`, `ttl_value`.
- **Generación de instancias:** una por paquete, con `n = k`.
- **Dominio:** `D = Libres(m) ∩ Casillas(rn)`.
- **Bloque mínimo:** `T3.ip`.

#### `ttl.routers_left`

- **Descripción:** al paquete le quedan `n` routers para llegar a la red de su destino (`k = L − n`).
- **Plantilla textual:** «Al paquete {packet} le quedaban {n} routers para llegar a la red de su destino.»
- **Generación de instancias:** una por paquete con `k < L` que llegará a su destino (`L ≤ TTL inicial − 1`).
- **Dominio:** `D = Libres(m) ∩ Casillas(r(L−n))`.
- **Bloque mínimo:** `T3.ip`.

#### `ttl.routers_crossed_range`

- **Descripción:** desigualdad sobre los routers atravesados: al menos `n` o como mucho `n`.
- **Plantilla textual:** «El paquete {packet} ya había atravesado algún router.» (al menos 1), «… al menos {n} routers», «… como mucho {n} routers». Con `ttl_value`: «El TTL del paquete {packet} ya era menor que el inicial.» (al menos 1), «… era como mucho {t}», «… era al menos {t}».
- **Formas:** `count`, `ttl_value`.
- **Generación de instancias:** las desigualdades verdaderas que dejan al menos dos redes de `Alcanzables(m)` y quitan al menos una (si no, equivalen a `routers_crossed` o no dicen nada).
- **Dominio:** `D = Libres(m) ∩ ⋃ Casillas(ri)` para las `i` del intervalo.
- **Bloque mínimo:** `T3.ip`.

### `spatial.in_row` y `spatial.in_column`

- **Descripción:** el paquete está en una fila (o columna) concreta del tablero.
- **Aridad:** unaria.
- **Restringe:** posición.
- **Parámetros:**
  - `row` (o `column`): índice desde 1.
- **Plantilla textual:** «El paquete {packet} estaba {fila}.», donde `{fila}` es «en la fila 3» o «en la misma fila que el servidor DNS» (ídem con columnas).
- **Formas de nombrar:** las de [filas y columnas](#formas-de-nombrar): `number`, `aligned_node` (cualquier equipo de esa fila o columna) y `aligned_router` (un router de borde que esté en ella).
- **Generación de instancias:** una de cada por paquete.
- **Dominio:** `D = Libres(m) ∩ Fila(row)` (o `Columna(column)`).
- **Anulación común:** `A = ∅`.
- **Compatibilidad:** no tienen significado de red. Con la regla de un paquete por fila y por columna, «estaba en la fila 3» también descarta esa fila para todos los demás paquetes una vez colocado. El generador prefiere las pistas de red, nodos y routers, permite como mucho una pista espacial por paquete y solo da fila **y** columna (las coordenadas) como último recurso.
- **Bloque mínimo:** `T3.dispositivos`.
- **Conocimiento:** `basic`.

## 3. Subtipos previstos

Subtipos y formas de nombrar que aún no están definidos, con la versión en que se piensa añadirlos (véase la hoja de ruta). Cada uno se completará con la plantilla de la sección siguiente cuando se vaya a usar.

Las pistas de la v0.4 (categoría Encaminamiento) están en la [sección 2](#encaminamiento-rutas-y-ttl-v04): las previstas `just_crossed_router` y `about_to_cross_router` pasan a ser `route.last_router` y `route.next_router`; `min_routers_crossed`, `ttl.routers_crossed_range`; la difusión que no atraviesa routers, los paquetes de difusión; y las pistas de MAC, la forma `mac_view`.

**Después de la v0.4:**

| Tipo | Subtipo o forma propuesta | Ejemplo de texto | Bloque mínimo | Versión prevista |
|---|---|---|---|---|
| `endpoint` | `origin_gateway` | «Su equipo de origen usa como puerta de enlace el router que une Aulas y Servicios.» Solo tiene sentido si el origen no está a la vista. | `T3.ip` | Con los orígenes ocultos |
| `endpoint` | `at_origin`, `at_destination` | «Aún estaba en su equipo de origen.» | `T3.ip` | Con los orígenes ocultos |
| `relation` | `same_network` (entrega directa) | «A podría haberse entregado a B directamente, sin pasar por ningún router.» | `T3.ip` | Pistas relacionales |
| `relation` | `neighbor_networks` | «A y B estaban en redes vecinas, separadas por un solo router.» | `T3.ip` | Pistas relacionales |
| `relation` | `same_destination` | «A y B iban al mismo destino.» | `T3.ip` | Pistas relacionales |
| `relation` | `closer_to_destination`, `higher_ttl` | «El paquete rojo tiene mayor TTL que el azul.» | `T3.ip` | Pistas relacionales |
| `relation` | `more_addresses_network` | «El rojo está en una red con más direcciones que el azul.» | `T3.subredes` | Pistas relacionales |
| `route` | `next_hop_is_destination_network`, `next_hop` | «El siguiente salto será la red del destino.» | `T3.encaminamiento` | v0.5, Encaminamiento |
| forma de red | `privacy` | «la única red pública»: exige planes que mezclen redes privadas (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16) y públicas. Coste 1 (2 si hay que fijarse en el rango 172.16.0.0/12). | `T3.nat` | Con NAT |
| `endpoint` | `source_translated` | «Su IP de origen ya no era privada.» (ya había pasado por el router NAT) | `T3.nat` | Con NAT |
| `protocol` | `uses_protocol` | «Utiliza HTTPS.» | El del protocolo (`topic` del catálogo). | v0.6, Transporte |
| `protocol` | `uses_transport`, `destination_port` | «Viaja sobre UDP.» | `T4.udp` o `T4.tcp`, y como mínimo el del protocolo que permite deducir. | v0.6, Transporte |
| `relation` | `same_protocol` | «Utiliza el mismo protocolo que el azul.» | El del protocolo. | v0.6, Transporte |
| `spatial` | `on_board_edge` | «Estaba en el borde del tablero.» | `T3.dispositivos` | Sin fecha |
| `node` | `on_node`, `near_node` (a N casillas) | «Estaba en un cliente.» | `T3.dispositivos` | Sin fecha |
| `router` | `distance_to_router` | «Está exactamente a dos casillas de un router.» | `T3.dispositivos` | Sin fecha |

Las pistas relacionales exigen restricciones entre paquetes en el solver, técnicas nuevas en la dificultad y en las sugerencias, y textos que las expliquen; por eso van en una versión propia. Salvo que se indique otra cosa, el conocimiento previsto es `basic`; las pistas de puerto toman el `portKnowledge` del protocolo.

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
