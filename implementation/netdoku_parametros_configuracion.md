# Parámetros de configuración de Netdoku

Este documento recoge todos los parámetros configurables del generador de niveles. La configuración habitual debería utilizar únicamente los parámetros generales y dejar que el resto adopte sus valores por defecto.

Los parámetros marcados como **obligatorios** deben aparecer en una configuración de nivel concreta. Los parámetros **opcionales** pueden omitirse; en ese caso se utilizará el valor por defecto indicado.

Cuando un valor es `null`, el generador lo calcula automáticamente o no aplica ningún límite específico.

## 1. Parámetros generales

### `level.id`

- **Carácter:** opcional.
- **Dominio:** cadena de texto no vacía o `null`.
- **Valor por defecto:** `null`.
- **Descripción:** identificador externo del nivel. Si no se proporciona, puede generarse automáticamente.

### `level.name`

- **Carácter:** opcional.
- **Dominio:** cadena de texto o `null`.
- **Valor por defecto:** `null`.
- **Descripción:** nombre descriptivo del nivel.

### `level.seed`

- **Carácter:** opcional.
- **Dominio:** número entero no negativo, cadena de texto o `null`.
- **Valor por defecto:** `null`.
- **Descripción:** semilla utilizada para reproducir una generación. Si es `null`, se genera aleatoriamente.

### `level.difficulty`

- **Carácter:** obligatorio.
- **Dominio:** entero entre `1` y `5`.
- **Valor por defecto:** `3`.
- **Descripción:** dificultad objetivo global. Se traduce internamente en valores de complejidad topológica, lógica y visual.

### `level.scenario`

- **Carácter:** opcional.
- **Dominio:** identificador de un escenario registrado.
- **Valor por defecto:** `same_network_attacker`.
- **Descripción:** define el objetivo final del nivel. El escenario por defecto pide identificar el paquete atacante situado en la misma red que la víctima.

### `level.maxGenerationAttempts`

- **Carácter:** opcional.
- **Dominio:** entero positivo.
- **Valor por defecto:** `100`.
- **Descripción:** número máximo de intentos de generación completa antes de declarar el proceso fallido.

### `level.minTopic`

- **Carácter:** opcional.
- **Dominio:** un [bloque temático](#bloques-temáticos) o `null`.
- **Valor por defecto:** `null`.
- **Descripción:** bloque que el nivel debe usar como mínimo. Sirve para que un nivel introduzca un concepto nuevo: con `T3.ip`, al menos una pista, nodo o dato visible necesario para resolverlo debe ser de ese bloque. Con `null` no se exige nada.

### `level.maxTopic`

- **Carácter:** opcional.
- **Dominio:** un [bloque temático](#bloques-temáticos) o `null`.
- **Valor por defecto:** `null`.
- **Descripción:** bloque más avanzado que puede usar el nivel. El generador descarta los subtipos de pista, tipos de nodo, servicios y protocolos visibles de bloques posteriores. Con `null` no hay límite. Junto con `difficulty.knowledge`, que limita el nivel de conocimiento, permite generar niveles jugables en un punto concreto del curso.

### Requisitos calculados del nivel

El generador guarda en el fichero de nivel lo que realmente exige la partida generada, para que el motor pueda filtrar o desbloquear niveles:

```yaml
requirements:
  topic: T3.dispositivos    # bloque más avanzado de todo lo que hay que entender
  knowledge: basic          # nivel de conocimiento más alto
```

Solo cuenta lo que el jugador ve o necesita para resolver: las pistas, los datos visibles de los paquetes y las etiquetas de los nodos. Las propiedades internas que no se muestran (por ejemplo, el protocolo de un paquete que ninguna pista menciona) no cuentan.

## 2. Paquetes

### `packets.count`

- **Carácter:** obligatorio.
- **Dominio:** entero mayor que `2`.
- **Valor por defecto:** `10`.
- **Descripción:** número total de paquetes del nivel, incluida la víctima. Con la regla de un paquete por fila y por columna, no puede superar el ancho ni el alto del tablero; lo habitual es que coincida con ellos (por ejemplo, 6 paquetes en un 6×6), para que la víctima se localice por descarte.

### `packets.identifiers`

- **Carácter:** opcional.
- **Dominio:** lista de identificadores únicos o `null`.
- **Valor por defecto:** `null`.
- **Descripción:** nombres, colores o códigos de los paquetes. Si se omite, el generador los crea automáticamente.

### `packets.victim`

- **Carácter:** opcional.
- **Dominio:** identificador de un paquete existente, `random` o `null`.
- **Valor por defecto:** `random`.
- **Descripción:** determina qué paquete actúa como víctima.

### `packets.minPerNetwork`

- **Carácter:** opcional.
- **Dominio:** entero mayor o igual que `0`.
- **Valor por defecto:** `0`.
- **Descripción:** número mínimo de paquetes colocados en cada red.

### `packets.maxPerNetwork`

- **Carácter:** opcional.
- **Dominio:** entero positivo o `null`.
- **Valor por defecto:** `null`.
- **Descripción:** número máximo de paquetes colocados en una misma red.

### `packets.minOccupiedNetworks`

- **Carácter:** opcional.
- **Dominio:** entero positivo o `null`.
- **Valor por defecto:** `null`.
- **Descripción:** número mínimo de redes que deben contener al menos un paquete. Si es `null`, se calcula según el número de paquetes y redes.

### `packets.distribution`

- **Carácter:** opcional.
- **Dominio:** `auto`, `uniform`, `random`, `clustered`.
- **Valor por defecto:** `auto`.
- **Descripción:** estrategia general de distribución de paquetes entre las redes.

### `packets.minDistance`

- **Carácter:** opcional.
- **Dominio:** entero mayor o igual que `0`.
- **Valor por defecto:** `0`.
- **Descripción:** distancia mínima, en casillas, entre dos paquetes.

### `packets.allowAdjacentToNodes`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.

### `packets.allowAdjacentToRouters`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.

### `packets.allowOnNetworkBoundary`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.

### `packets.requireUniqueCell`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.
- **Descripción:** exige que cada paquete ocupe una casilla diferente.

### `packets.visibleProperties`

- **Carácter:** opcional.
- **Dominio:** lista con valores de `origin`, `destination`, `ttlInitial`.
- **Valor por defecto:** `[]`.
- **Descripción:** propiedades que muestra la ficha de cada paquete. En la categoría Encaminamiento (v0.4) son las tres: el origen y el destino se nombran por su etiqueta y su red («equipo de usuario de Aulas»), o el destino como «difusión (192.168.1.255)». Las propiedades visibles cuentan para el bloque mínimo del nivel.

### `packets.onePerRow` y `packets.onePerColumn`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.
- **Descripción:** regla básica del juego, como en Murdoku: como mucho un paquete por fila y por columna. Con tantos paquetes como filas (o columnas), cada fila (o columna) tiene exactamente uno, y eso permite localizar a la víctima por descarte. Obliga a que `packets.count` no supere el número de filas ni de columnas del tablero. El nivel la declara en su bloque `rules` para que el motor la muestre y la aplique.

## 3. Familias de propiedades y reglas

### `features.spatial`

- **Carácter:** obligatorio.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.
- **Descripción:** habilita propiedades espaciales, como fila, columna, proximidad y distancia.

### `features.networks`

- **Carácter:** obligatorio.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.
- **Descripción:** habilita propiedades relacionadas con la pertenencia y las características de las redes.

### `features.nodes`

- **Carácter:** obligatorio.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.
- **Descripción:** habilita propiedades relacionadas con equipos, servidores y otros nodos.

### `features.protocols`

- **Carácter:** obligatorio.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.

### `features.origins`

- **Carácter:** obligatorio.
- **Dominio:** booleano.
- **Valor por defecto:** `false`.

### `features.destinations`

- **Carácter:** obligatorio.
- **Dominio:** booleano.
- **Valor por defecto:** `false`.

### `features.routes`

- **Carácter:** obligatorio.
- **Dominio:** booleano.
- **Valor por defecto:** `false`.

### `features.hops`

- **Carácter:** obligatorio.
- **Dominio:** booleano.
- **Valor por defecto:** `false`.

### `features.ttl`

- **Carácter:** obligatorio.
- **Dominio:** booleano.
- **Valor por defecto:** `false`.

### `features.enabledRuleTypes`

- **Carácter:** opcional.
- **Dominio:** lista de identificadores de tipos de reglas o `null`.
- **Valor por defecto:** `null`.
- **Descripción:** limita los tipos de reglas disponibles. Si es `null`, se habilitan todos los compatibles con las familias activadas. Los identificadores de tipo y de subtipo (`tipo.subtipo`) de este parámetro y de los siguientes están definidos en el [catálogo de reglas](netdoku_catalogo_reglas.md).

### `features.enabledRuleSubtypes`

- **Carácter:** opcional.
- **Dominio:** lista de identificadores de subtipos o `null`.
- **Valor por defecto:** `null`.

### `features.disabledRuleSubtypes`

- **Carácter:** opcional.
- **Dominio:** lista de identificadores de subtipos.
- **Valor por defecto:** `[]`.

### `features.requiredRuleSubtypes`

- **Carácter:** opcional.
- **Dominio:** lista de identificadores de subtipos.
- **Valor por defecto:** `[]`.

## 4. Topología de redes

### `topology.networks.min`

- **Carácter:** opcional.
- **Dominio:** entero positivo o `null`.
- **Valor por defecto:** `null`.
- **Descripción:** número mínimo de redes. Si es `null`, se deriva del número de paquetes y de la dificultad.

### `topology.networks.max`

- **Carácter:** opcional.
- **Dominio:** entero positivo o `null`.
- **Valor por defecto:** `null`.

### `topology.networks.target`

- **Carácter:** opcional.
- **Dominio:** entero positivo o `null`.
- **Valor por defecto:** `null`.
- **Descripción:** número exacto deseado de redes. Tiene prioridad sobre `min` y `max`.

### `topology.connected`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.
- **Descripción:** exige que todas las redes formen una única topología conectada.

### `topology.allowCycles`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.

### `topology.cycles.min`

- **Carácter:** opcional.
- **Dominio:** entero mayor o igual que `0`.
- **Valor por defecto:** `0`.

### `topology.cycles.max`

- **Carácter:** opcional.
- **Dominio:** entero mayor o igual que `0` o `null`.
- **Valor por defecto:** `null`.

### `topology.alternativePaths.min`

- **Carácter:** opcional.
- **Dominio:** entero mayor o igual que `0`.
- **Valor por defecto:** `0`.

### `topology.alternativePaths.max`

- **Carácter:** opcional.
- **Dominio:** entero mayor o igual que `0` o `null`.
- **Valor por defecto:** `null`.

### `topology.diameter.min`

- **Carácter:** opcional.
- **Dominio:** entero mayor o igual que `1` o `null`.
- **Valor por defecto:** `null`.

### `topology.diameter.max`

- **Carácter:** opcional.
- **Dominio:** entero mayor o igual que `1` o `null`.
- **Valor por defecto:** `null`.

### `topology.allowTerminalNetworks`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.
- **Descripción:** permite redes conectadas al resto mediante un único router.

### `topology.allowArticulationPoints`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.

### `topology.allowParallelConnections`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `false`.
- **Descripción:** permite que dos redes estén conectadas mediante más de un router.

### `topology.symmetry`

- **Carácter:** opcional.
- **Dominio:** `avoid`, `allow`, `prefer`.
- **Valor por defecto:** `avoid`.

## 5. Geometría de las redes

En esta sección, «tamaño» (`networkSize`) es el **número de casillas** que ocupa una red en el tablero. No tiene relación con el tamaño de la red en sentido de red, que es su número de direcciones y depende del prefijo.

### `geometry.networkSize.min`

- **Carácter:** opcional.
- **Dominio:** entero mayor o igual que `6`.
- **Valor por defecto:** `6`.

### `geometry.networkSize.max`

- **Carácter:** opcional.
- **Dominio:** entero mayor o igual que `geometry.networkSize.min` o `null`.
- **Valor por defecto:** `null`.

### `geometry.networkSize.targetMean`

- **Carácter:** opcional.
- **Dominio:** número real positivo o `null`.
- **Valor por defecto:** `null`.
- **Descripción:** tamaño medio deseado de las redes. Si se omite, se calcula según paquetes, nodos y dificultad.

### `geometry.networkSize.variation`

- **Carácter:** opcional.
- **Dominio:** número real entre `0` y `1`.
- **Valor por defecto:** `0.25`.
- **Descripción:** variabilidad permitida en los tamaños de las redes.

### `geometry.minThickness`

- **Carácter:** opcional.
- **Dominio:** entero mayor o igual que `1`.
- **Valor por defecto:** `2`.

### `geometry.compactness.min`

- **Carácter:** opcional.
- **Dominio:** número real entre `0` y `1` o `null`.
- **Valor por defecto:** `null`.

### `geometry.aspectRatio.max`

- **Carácter:** opcional.
- **Dominio:** número real mayor o igual que `1` o `null`.
- **Valor por defecto:** `3.0`.

### `geometry.concavities.max`

- **Carácter:** opcional.
- **Dominio:** entero mayor o igual que `0` o `null`.
- **Valor por defecto:** `null`.

### `geometry.corners.max`

- **Carácter:** opcional.
- **Dominio:** entero mayor o igual que `4` o `null`.
- **Valor por defecto:** `null`.

### `geometry.allowInternalHoles`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `false`.

### `geometry.allowNarrowCorridors`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `false`.

### `geometry.narrowCorridorMaxLength`

- **Carácter:** opcional.
- **Dominio:** entero mayor o igual que `0`.
- **Valor por defecto:** `0`.

### `geometry.minInteriorCells`

- **Carácter:** opcional.
- **Dominio:** entero mayor o igual que `0`.
- **Valor por defecto:** `1`.

### `geometry.maxBoundaryCellRatio`

- **Carácter:** opcional.
- **Dominio:** número real entre `0` y `1` o `null`.
- **Valor por defecto:** `null`.

### `geometry.externalMargin`

- **Carácter:** opcional.
- **Dominio:** entero mayor o igual que `0`.
- **Valor por defecto:** `0`.

## 6. Tablero resultante

### `board.width`

- **Carácter:** opcional.
- **Dominio:** entero positivo o `null`.
- **Valor por defecto:** `null`.
- **Descripción:** anchura fija. Normalmente no debe indicarse.

### `board.height`

- **Carácter:** opcional.
- **Dominio:** entero positivo o `null`.
- **Valor por defecto:** `null`.

### `board.maxWidth`

- **Carácter:** opcional.
- **Dominio:** entero positivo o `null`.
- **Valor por defecto:** `null`.
- **Descripción:** límite técnico de anchura.

### `board.maxHeight`

- **Carácter:** opcional.
- **Dominio:** entero positivo o `null`.
- **Valor por defecto:** `null`.

### `board.maxArea`

- **Carácter:** opcional.
- **Dominio:** entero positivo o `null`.
- **Valor por defecto:** `null`.

### `board.maxAspectRatio`

- **Carácter:** opcional.
- **Dominio:** número real mayor o igual que `1`.
- **Valor por defecto:** `2.0`.

### `board.trimEmptyBorders`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.
- **Descripción:** elimina filas y columnas exteriores completamente vacías tras finalizar la generación.

## 7. Routers

### `routers.count.min`

- **Carácter:** opcional.
- **Dominio:** entero mayor o igual que `1` o `null`.
- **Valor por defecto:** `null`.

### `routers.count.max`

- **Carácter:** opcional.
- **Dominio:** entero mayor o igual que `1` o `null`.
- **Valor por defecto:** `null`.

### `routers.count.target`

- **Carácter:** opcional.
- **Dominio:** entero mayor o igual que `1` o `null`.
- **Valor por defecto:** `null`.

### `routers.degree.min`

- **Carácter:** opcional.
- **Dominio:** entero entre `2` y `4`.
- **Valor por defecto:** `2`.

### `routers.degree.max`

- **Carácter:** opcional.
- **Dominio:** entero entre `2` y `4`.
- **Valor por defecto:** `4`.

### `routers.degree.weights`

- **Carácter:** opcional.
- **Dominio:** mapa de pesos no negativos para grados `2`, `3` y `4`.
- **Valor por defecto:** `{2: 0.75, 3: 0.20, 4: 0.05}`.
- **Descripción:** distribución relativa usada al seleccionar cuántas redes conecta cada router.

### `routers.allowCornerRouters`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.

### `routers.allowAdjacentRouters`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `false`.

### `routers.minDistance`

- **Carácter:** opcional.
- **Dominio:** entero mayor o igual que `0`.
- **Valor por defecto:** `1`.

### `routers.maxPerSharedBoundary`

- **Carácter:** opcional.
- **Dominio:** entero positivo.
- **Valor por defecto:** `1`.

### `routers.requireAccessFromAllConnectedNetworks`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.

### `routers.allowSingleAccessNetworks`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.

## 8. Nodos

### `nodes.density`

- **Carácter:** opcional.
- **Dominio:** `auto`, `low`, `medium`, `high` o número real entre `0` y `1`.
- **Valor por defecto:** `auto`.

### `nodes.count.min`

- **Carácter:** opcional.
- **Dominio:** entero mayor o igual que `0`.
- **Valor por defecto:** `0`.

### `nodes.count.max`

- **Carácter:** opcional.
- **Dominio:** entero mayor o igual que `0` o `null`.
- **Valor por defecto:** `null`.

### `nodes.count.target`

- **Carácter:** opcional.
- **Dominio:** entero mayor o igual que `0` o `null`.
- **Valor por defecto:** `null`.

### `nodes.perNetwork.min`

- **Carácter:** opcional.
- **Dominio:** entero mayor o igual que `0`.
- **Valor por defecto:** `1`.

### `nodes.perNetwork.max`

- **Carácter:** opcional.
- **Dominio:** entero mayor o igual que `0` o `null`.
- **Valor por defecto:** `null`.

### `nodes.allowEmptyNetworks`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `false`.
- **Descripción:** permite **redes de tránsito**, sin equipos, que solo unen routers (como los enlaces /30 de la asignatura). Solo tiene efecto si está activa alguna de `features.routes`, `features.hops` o `features.ttl`; sin ellas, una red vacía apenas admite pistas y no se genera. Las redes vacías no cuentan para `nodes.perNetwork.min`. Ningún paquete tiene origen ni destino en ellas, pero pueden contener paquetes de paso. Pertenecen al bloque `T3.ip`: para jugar basta saber que son redes sin equipos que solo unen routers (propuesta de la v0.4; antes, `T3.encaminamiento`).

### `nodes.emptyNetworks.max`

- **Carácter:** opcional.
- **Dominio:** entero mayor o igual que `0` o `null`.
- **Valor por defecto:** `1`.
- **Descripción:** número máximo de redes de tránsito. Solo se aplica si `nodes.allowEmptyNetworks` es `true`.

### `nodes.emptyNetworks.probability`

- **Carácter:** opcional.
- **Dominio:** número real entre `0` y `1`.
- **Valor por defecto:** `0.5`.
- **Descripción:** probabilidad de que un nivel tenga una red de tránsito, si `nodes.allowEmptyNetworks` es `true` y alguna red une al menos dos routers. La red de tránsito se llama Troncal.

### `nodes.emptyNetworks.requireTransit`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.
- **Descripción:** una red vacía debe unir al menos dos routers, de modo que algún paquete pueda atravesarla.

### `nodes.enabledTypes`

- **Carácter:** opcional.
- **Dominio:** lista con valores de `client`, `server`, `firewall`, `switch`, `access_point`.
- **Valor por defecto:** `[client, server]`.
- **Descripción:** tipos de nodo que puede colocar el generador. `client` es un equipo de usuario. `server` ofrece uno o varios servicios (véase `nodes.enabledServices`). `firewall`, `switch` y `access_point` son infraestructura: no ofrecen servicios y se activan nivel a nivel conforme se introducen esos conceptos. En el fichero de nivel cada nodo se escribe como `{type: server, services: [web, ...]}` o `{type: client}`, sin `services`.

#### Bloque y conocimiento de cada nodo

| Nodo o servicio | Bloque mínimo | Conocimiento | Notas |
|---|---|---|---|
| `client` | `T3.dispositivos` | `basic` | |
| `server` | `T3.dispositivos` | `basic` | Con su etiqueta («servidor web», «servidor DNS»), como vocabulario del T1. |
| `switch` | `T3.dispositivos` | `basic` | No separa redes. |
| `access_point` | `T3.dispositivos` | `basic` | Se ve en la clase 9 con la WiFi. |
| `firewall` | `T3.dispositivos` | `extra` | No se ve en la asignatura; requiere una frase de aclaración. |
| servicio `web` | `T5.web` | `basic` | Solo si una pista o un dato visible depende del servicio (por ejemplo, del protocolo que recibe). |
| servicio `dns` | `T5.dns` | `basic` | Ídem. |
| servicio `mail`, `storage` | `T5.ficheros_correo` | `basic` | Ídem. `storage` se muestra como «servidor de ficheros». |
| servicio `multimedia` | `T6` | `basic` | Ídem. |
| servicio `dhcp` | `T3.vlsm` | `basic` | Ídem. |

Mientras un servidor solo aparezca con su etiqueta, como referencia de posición («junto al servidor web»), cuenta como `T3.dispositivos`. El bloque del servicio solo se aplica cuando hay que saber qué hace el servidor, por ejemplo para relacionarlo con un protocolo.

### `nodes.requiredTypes`

- **Carácter:** opcional.
- **Dominio:** lista de identificadores de tipos de nodos.
- **Valor por defecto:** `[]`.

### `nodes.typeLimits`

- **Carácter:** opcional.
- **Dominio:** mapa por tipo con límites `min` y `max`.
- **Valor por defecto:** `{}`.

### `nodes.enabledServices`

- **Carácter:** opcional.
- **Dominio:** lista con valores de `web`, `dns`, `mail`, `storage`, `multimedia`, `dhcp`. `storage` es el servidor de ficheros (FTP, SMB); en los textos visibles se llama siempre «servidor de ficheros».
- **Valor por defecto:** `[web, dns, mail, storage, multimedia]`.
- **Descripción:** servicios que pueden tener los nodos `server`. Son los mismos que usa `protocols.catalog` en `originNodes` y `destinationNodes`. `dhcp` no está activado por defecto.

### `nodes.requiredServices`

- **Carácter:** opcional.
- **Dominio:** lista de identificadores de servicios.
- **Valor por defecto:** `[]`.

### `nodes.allowMultipleServices`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.

### `nodes.minDistance`

- **Carácter:** opcional.
- **Dominio:** entero mayor o igual que `0`.
- **Valor por defecto:** `1`.

### `nodes.minDistanceFromRouters`

- **Carácter:** opcional.
- **Dominio:** entero mayor o igual que `0`.
- **Valor por defecto:** `0`.

### `nodes.allowAdjacentToRouters`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.

### `nodes.allowOnNetworkBoundary`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.

### `nodes.minFreeCellsAfterPlacement`

- **Carácter:** opcional.
- **Dominio:** entero mayor o igual que `0`.
- **Valor por defecto:** `0`.

### `nodes.minFreeCellRatioAfterPlacement`

- **Carácter:** opcional.
- **Dominio:** número real entre `0` y `1`.
- **Valor por defecto:** `0.40`.

### `nodes.preserveInternalConnectivity`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.


## 9. Protocolos

### `protocols.enabled`

- **Carácter:** opcional.
- **Dominio:** lista de identificadores de protocolos.
- **Valor por defecto:** `[http, https, dns, ssh, smtp]`.

### `protocols.required`

- **Carácter:** opcional.
- **Dominio:** lista de identificadores de protocolos.
- **Valor por defecto:** `[]`.

### `protocols.distribution`

- **Carácter:** opcional.
- **Dominio:** `uniform`, `weighted`, `random`.
- **Valor por defecto:** `weighted`.

### `protocols.weights`

- **Carácter:** opcional.
- **Dominio:** mapa de pesos no negativos por protocolo.
- **Valor por defecto:** `{http: 0.25, https: 0.30, dns: 0.20, ssh: 0.15, smtp: 0.10}`.

### `protocols.requireCompatibleDestinationService`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.
- **Descripción:** exige coherencia entre el protocolo del paquete y los servicios del nodo de destino, según `destinationNodes` de `protocols.catalog`.

### `protocols.requireCompatibleOriginNode`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.
- **Descripción:** exige que el nodo de origen del paquete sea de uno de los tipos de `originNodes` en `protocols.catalog`. Por ejemplo, POP3 e IMAP solo salen de un cliente, y SMTP sale de un cliente o de un servidor de correo.

### `protocols.catalog`

- **Carácter:** opcional.
- **Dominio:** mapa de identificador de protocolo a `{originNodes, destinationNodes, transport, port, sameNetworkOnly, knowledge, portKnowledge}`, donde:
  - `originNodes` y `destinationNodes` son listas con `client`, nombres de servicio (servidor con ese servicio), `any_server` o `any_node`;
  - `transport` es `tcp`, `udp` o `null` (sin capa de transporte);
  - `port` es un entero o `null`;
  - `sameNetworkOnly` (opcional, `false` por defecto) obliga a que origen y destino estén en la misma red, porque el protocolo usa difusión, que no atraviesa routers;
  - `knowledge` es el [nivel de conocimiento](#niveles-de-conocimiento) del protocolo, y `portKnowledge` (opcional) el de su número de puerto cuando es distinto;
  - `topic` es el [bloque temático](#bloques-temáticos) en que se ve el protocolo.
- **Valor por defecto:**

| Protocolo | Origen | Destino | Transporte | Puerto | Bloque | Conocimiento | Notas |
|---|---|---|---|---|---|---|---|
| `http` | cliente | `web` | `tcp` | 80 | `T5.web` | `basic` | |
| `https` | cliente | `web` | `tcp` | 443 | `T5.web` | `basic` | |
| `dns` | cliente, `dns` | `dns` | `udp` | 53 | `T5.dns` | `basic` | Un servidor DNS puede ser origen en la resolución recursiva. |
| `smtp` | cliente, `mail` | `mail` | `tcp` | 25 | `T5.ficheros_correo` | `basic` | Envío; también entre servidores de correo. |
| `pop3` | cliente | `mail` | `tcp` | 110 | `T5.ficheros_correo` | `basic` | Recogida de correo. |
| `imap` | cliente | `mail` | `tcp` | 143 | `T5.ficheros_correo` | `basic` | Recogida de correo. |
| `ssh` | cliente | `any_server` | `tcp` | 22 | `T5.dns` | `basic` | Se ve en la clase 19, con DNS y TLS. |
| `telnet` | cliente | `any_server` | `tcp` | 23 | `T5.dns` | `basic` | Ídem. |
| `ftp` | cliente | `storage` | `tcp` | 21 | `T5.ficheros_correo` | `basic` | Conexión de control. |
| `dhcp` | cliente | `dhcp` | `udp` | 67 | `T3.vlsm` | `basic` | `sameNetworkOnly`. No activado por defecto. |
| `icmp` | `any_node` | `any_node` | `null` | `null` | `T3.ip` | `basic` | Sin puertos. |
| `rtsp` | cliente | `multimedia` | `tcp` | 554 | `T6` | `basic` (puerto `extra`) | Se ve en el T6, pero sin puerto. |
| `smtps` | cliente, `mail` | `mail` | `tcp` | 465 | `T5.ficheros_correo` | `advanced` | Puerto seguro. |
| `pop3s` | cliente | `mail` | `tcp` | 995 | `T5.ficheros_correo` | `advanced` | Puerto seguro. |
| `imaps` | cliente | `mail` | `tcp` | 993 | `T5.ficheros_correo` | `advanced` | Puerto seguro. |
| `ftps` | cliente | `storage` | `tcp` | 990 | `T5.ficheros_correo` | `advanced` | Puerto seguro. |
| `ftp-data` | `storage` | cliente | `tcp` | 20 | `T5.ficheros_correo` | `advanced` | Conexión de datos de FTP. |
| `tftp` | cliente | `storage` | `udp` | 69 | `T5.ficheros_correo` | `advanced` (puerto `extra`) | Se ve como variante de FTP sobre UDP, sin puerto. |
| `smb` | cliente | `storage` | `tcp` | 445 | `T5.ficheros_correo` | `additional` (puerto `extra`) | Visto en clase como ampliación, sin puerto. |

- **Descripción:** lista todos los protocolos de aplicación que conoce el generador. `protocols.enabled`, `protocols.required` y `protocols.weights` solo pueden usar identificadores de este catálogo. El transporte (TCP/UDP) y el puerto **no son protocolos**: son propiedades que se deducen del protocolo y pueden usarse como pistas indirectas («viaja sobre UDP», «va dirigido al puerto 443»). Una pista que use el puerto tiene el nivel de conocimiento de `portKnowledge`; una que solo use el protocolo o el servicio, el de `knowledge`. Una pista que use el transporte o el puerto exige además el bloque `T4.udp` (o `T4.tcp`, si el transporte es TCP y la pista lo nombra), aunque el protocolo sea de un bloque anterior.

### Niveles de conocimiento

Cada protocolo del catálogo, cada [tipo de nodo](#bloque-y-conocimiento-de-cada-nodo) y cada subtipo de pista del [catálogo de reglas](netdoku_catalogo_reglas.md) indica cuánto se ve en la asignatura:

| Valor | Significado | Ejemplos |
|---|---|---|
| `basic` | Teoría o ejercicio de la asignatura. | HTTP/80, DNS/53, SMTP/25. |
| `advanced` | Aparece en la asignatura, pero en segundo plano (tablas, variantes). | Puertos seguros (465, 993, 995), FTP de datos (20), TFTP. |
| `additional` | Se comenta en clase como ampliación (transparencias «Adicional»). | SMB. |
| `extra` | No se ve en la asignatura. Requiere una aclaración en el juego. | Puerto 554 de RTSP, puerto 445 de SMB. |

### Bloques temáticos

Además del nivel de conocimiento, cada elemento indica el **bloque** de la asignatura a partir del cual se puede usar. Los bloques corresponden a las clases en que se ve cada concepto y están ordenados; su contenido se detalla en la sección 9 del [resumen de la asignatura](netdoku_contenidos_asignatura.md):

`T3.dispositivos` < `T3.vlan` < `T3.ip` < `T3.fragmentacion` < `T3.subredes` < `T3.vlsm` < `T3.encaminamiento` < `T3.nat` < `T4.udp` < `T4.tcp` < `T5.dns` < `T5.web` < `T5.ficheros_correo` < `T6`

Las dos escalas son independientes: el bloque dice **cuándo** se ve algo y el nivel de conocimiento **cuánto**. Por ejemplo, SMB es `T5.ficheros_correo` y `additional`. Las usan `level.minTopic`, `level.maxTopic` y `difficulty.knowledge`, y el bloque `requirements` del nivel.

El nivel de conocimiento de un nivel de juego es el más alto de lo que usan sus pistas y su información visible, y se tiene en cuenta en la dificultad (véase `difficulty.knowledge`).

## 10. Orígenes y destinos

### `endpoints.originAssignmentRatio`

- **Carácter:** opcional.
- **Dominio:** número real entre `0` y `1`.
- **Valor por defecto:** `1.0` si `features.origins`, `features.routes`, `features.hops` o `features.ttl` están activos; en otro caso `0.0`.

### `endpoints.destinationAssignmentRatio`

- **Carácter:** opcional.
- **Dominio:** número real entre `0` y `1`.
- **Valor por defecto:** `1.0` si `features.destinations`, `features.routes`, `features.hops` o `features.ttl` están activos; en otro caso `0.0`.

### `endpoints.allowSameNode`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `false`.

### `endpoints.allowSameNetwork`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.

### `endpoints.requireProtocolCompatibility`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.

### `endpoints.requireIdentifiable`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.
- **Descripción:** el origen y el destino de un paquete deben poder nombrarse sin ambigüedad en su ficha: su etiqueta es única en su red («el servidor web de Aulas»).

### `endpoints.broadcastPackets.probability`

- **Carácter:** opcional.
- **Dominio:** número real entre `0` y `1`.
- **Valor por defecto:** `0.3`.
- **Descripción:** probabilidad de que un nivel con orígenes y destinos tenga un **paquete de difusión**: su destino es la dirección de difusión de su red (por ejemplo, una petición DHCP), así que no sale de la red de su origen. Véase el [catálogo de reglas](netdoku_catalogo_reglas.md#encaminamiento-rutas-y-ttl-v04).

### `endpoints.broadcastPackets.max`

- **Carácter:** opcional.
- **Dominio:** entero mayor o igual que `0`.
- **Valor por defecto:** `1`.

### `endpoints.originNodeTypes`

- **Carácter:** opcional.
- **Dominio:** lista de tipos de nodos o `null`.
- **Valor por defecto:** `null`.

### `endpoints.destinationNodeTypes`

- **Carácter:** opcional.
- **Dominio:** lista de tipos de nodos o `null`.
- **Valor por defecto:** `null`.

## 11. Rutas y saltos

### `routes.assignmentRatio`

- **Carácter:** opcional.
- **Dominio:** número real entre `0` y `1`.
- **Valor por defecto:** `1.0` si se activa alguna propiedad de ruta; en otro caso `0.0`.

En la v0.4 (categoría Encaminamiento) todavía no hay tablas: la ruta de cada paquete es el camino mínimo único entre su origen y su destino (`routes.requireUniqueShortestPath`). Lo que sigue describe el modelo previsto para la v0.5.

Las rutas no se sortean paquete a paquete. Como en la asignatura, cada router decide el siguiente salto con su **tabla de encaminamiento**, de modo que el tráfico que llega a un router con destino a una red sigue siempre el mismo camino. El generador calcula las tablas una vez por nivel y la ruta de cada paquete se deriva de ellas. La ruta de A a B puede no coincidir con la de B a A.

### `routes.policy`

- **Carácter:** opcional.
- **Dominio:** `routing_tables`.
- **Valor por defecto:** `routing_tables`.
- **Descripción:** forma de obtener las rutas. Con `routing_tables`, la ruta de un paquete es la sucesión de siguientes saltos que dan las tablas desde el origen hasta la red destino. Se deja como parámetro por si en el futuro se añaden otras políticas (rutas estáticas mal configuradas, desvíos por un cortafuegos, etc.).

### `routes.tables.metric`

- **Carácter:** opcional.
- **Dominio:** `hops`.
- **Valor por defecto:** `hops`.
- **Descripción:** métrica con la que se construyen las tablas. `hops` es el número de routers atravesados, como en RIP. Con esta métrica las rutas derivadas son siempre caminos mínimos y no tienen ciclos.

### `routes.tables.tieBreak`

- **Carácter:** opcional.
- **Dominio:** `random`, `lowest_id`.
- **Valor por defecto:** `random`.
- **Descripción:** cómo se elige el siguiente salto cuando hay varios a la misma distancia. Con `random` se sortea con la semilla del nivel, una sola vez por router y red destino; con `lowest_id` se elige el router de menor identificador. En ningún caso se sortea de nuevo para cada paquete.

### `routes.tables.hostGateway`

- **Carácter:** opcional.
- **Dominio:** `shortest`, `default_gateway`.
- **Valor por defecto:** `shortest`.
- **Descripción:** primer salto de un paquete que sale de un equipo hacia otra red. Con `shortest`, el equipo envía al router de su red que está en el camino mínimo, como si tuviera la misma tabla que los routers. Con `default_gateway`, cada red tiene una **puerta de enlace por defecto** (uno de sus routers, elegido una vez por nivel) y todos sus equipos envían a ese router; es lo que se ve en la asignatura, pero la ruta completa puede dejar de ser mínima, lo que complica deducir saltos o TTL. Solo influye en redes con más de un router.

### `routes.tables.store`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.
- **Descripción:** guarda las tablas en el fichero de nivel (`routing.tables`) para que puedan usarlas pistas del bloque `T3.encaminamiento` (por ejemplo, «el siguiente salto de R1 hacia la red X es R2») y para comprobar la coherencia de las rutas.

### `routes.requireUniqueShortestPath`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.
- **Descripción:** solo se usan pares de origen y destino con un único camino mínimo en el grafo Red↔Router, para que el jugador pueda trazar la ruta sin ver las tablas de encaminamiento (v0.4). Con `false`, los empates los deciden las tablas (`routes.tables.tieBreak`), y la ruta solo se puede deducir con ellas (tablas de encaminamiento, v0.5).

### `routes.minHops`

- **Carácter:** opcional.
- **Dominio:** entero mayor o igual que `0`.
- **Valor por defecto:** `0`.

### `routes.maxHops`

- **Carácter:** opcional.
- **Dominio:** entero mayor o igual que `0` o `null`.
- **Valor por defecto:** `null`.

### `routes.finalPositionPolicy`

- **Carácter:** opcional.
- **Dominio:** `any_compatible`, `origin`, `destination`, `intermediate`, `weighted`.
- **Valor por defecto:** `weighted`.

### `routes.finalPositionWeights`

- **Carácter:** opcional.
- **Dominio:** mapa de pesos no negativos.
- **Valor por defecto:** `{origin: 0.15, intermediate: 0.60, destination: 0.25}`.

### `routes.storeRepresentation`

- **Carácter:** opcional.
- **Dominio:** `networks`, `routers`, `cells`.
- **Valor por defecto:** `routers`.

### `routes.requireFinalPositionOnRoute`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.

## 12. TTL

### `ttl.initialValues`

- **Carácter:** opcional.
- **Dominio:** lista no vacía de enteros positivos.
- **Valor por defecto:** `[32, 64, 128, 255]`.

### `ttl.initialValuePolicy`

- **Carácter:** opcional.
- **Dominio:** `random`, `weighted`, `fixed`.
- **Valor por defecto:** `weighted`.

### `ttl.initialValueWeights`

- **Carácter:** opcional.
- **Dominio:** mapa de pesos no negativos.
- **Valor por defecto:** `{32: 0.10, 64: 0.55, 128: 0.25, 255: 0.10}`.

### `ttl.fixedInitialValue`

- **Carácter:** opcional.
- **Dominio:** entero positivo o `null`.
- **Valor por defecto:** `null`.

### `ttl.shortRatio`

- **Carácter:** opcional.
- **Dominio:** número real entre `0` y `1` o `auto`.
- **Valor por defecto:** `auto`.
- **Descripción:** proporción de paquetes cuyo TTL inicial no les alcanza para llegar a su destino (`TTL inicial − 1` menor que el número de routers de su ruta), como en el ejercicio «No time to die»: el jugador deduce que el paquete no puede haber pasado de cierto router. Con `auto` se sortea en cada nivel entre 0,15 y 0,3. Solo tiene efecto con valores iniciales pequeños.

### `ttl.decrementPerRouter`

- **Carácter:** opcional.
- **Dominio:** entero positivo.
- **Valor por defecto:** `1`.

### `ttl.minRemaining`

- **Carácter:** opcional.
- **Dominio:** entero mayor o igual que `1`.
- **Valor por defecto:** `1`.

### `ttl.requireConsistency`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.

## 13. Generación de propiedades

### `properties.generateAllTrueProperties`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.

### `properties.minCandidatesPerPacket`

- **Carácter:** opcional.
- **Dominio:** entero mayor o igual que `1`.
- **Valor por defecto:** `3`.

### `properties.minRuleTypesPerLevel`

- **Carácter:** opcional.
- **Dominio:** entero mayor o igual que `1`.
- **Valor por defecto:** `2`.

### `properties.minCandidatesPerSubtype`

- **Carácter:** opcional.
- **Dominio:** entero mayor o igual que `0`.
- **Valor por defecto:** `0`.

### `properties.rejectIfInsufficientCandidates`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.

### `properties.directlyVisibleRatio`

- **Carácter:** opcional.
- **Dominio:** número real entre `0` y `1` o `auto`.
- **Valor por defecto:** `auto`.

### `properties.hiddenRatio`

- **Carácter:** opcional.
- **Dominio:** número real entre `0` y `1` o `auto`.
- **Valor por defecto:** `auto`.

## 14. Selección de pistas

### `clues.targetCount`

- **Carácter:** opcional.
- **Dominio:** entero positivo o `null`.
- **Valor por defecto:** `null`.

### `clues.minCount`

- **Carácter:** opcional.
- **Dominio:** entero positivo o `null`.
- **Valor por defecto:** `null`.

### `clues.maxCount`

- **Carácter:** opcional.
- **Dominio:** entero positivo o `null`.
- **Valor por defecto:** `null`.

### `clues.maxPerSubtype`

- **Carácter:** opcional.
- **Dominio:** entero positivo o `null`.
- **Valor por defecto:** `null`.

### `clues.maxPerType`

- **Carácter:** opcional.
- **Dominio:** entero positivo o `null`.
- **Valor por defecto:** `null`.

### `clues.subtypeWeights`

- **Carácter:** opcional.
- **Dominio:** mapa de pesos no negativos.
- **Valor por defecto:** `{}`.

### `clues.naming.categoryFormRatio`

- **Carácter:** opcional.
- **Dominio:** número real entre `0` y `1` o `auto`.
- **Valor por defecto:** `auto`.
- **Descripción:** proporción de pistas que usan [formas de nombrar](netdoku_catalogo_reglas.md#proporción-de-formas-nuevas) propias de la categoría del nivel (por ejemplo, `prefix` o `ip_member` en Direccionamiento), aunque su coste de interpretación sea 0. Siempre hay al menos una. Con `auto` se sortea en cada nivel entre 0,3 y 0,7, para que unos niveles usen más formas nuevas que otros. Las formas con coste mayor que el permitido por `difficulty.reading` no se usan, sea cual sea la proporción.

### `clues.categoryMinClues`

- **Carácter:** opcional.
- **Dominio:** entero mayor o igual que `0`.
- **Valor por defecto:** `0`.
- **Descripción:** número mínimo de pistas de los tipos propios de la categoría del nivel (en Encaminamiento, `endpoint`, `route` y `ttl`). Con `0` no se exige nada.

### `clues.avoidRedundant`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.

### `clues.avoidSemanticallyEquivalent`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.

### `clues.requireLogicalSolvability`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.

### `clues.requireUniqueSolution`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.
- **Descripción:** exige que las pistas determinen una única casilla para cada paquete. Todo nivel publicado debe tener una única solución, porque el motor penaliza cada colocación que no coincide con ella; `false` solo tiene sentido para depurar el generador.

### `clues.consumeUnselectedSingletonRules`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.
- **Descripción:** cuando aparecen varias reglas con dominio unitario, consume también las no seleccionadas para impedir que reaparezcan en la iteración siguiente.

### `clues.singletonSelection.min`

- **Carácter:** opcional.
- **Dominio:** entero mayor o igual que `1`.
- **Valor por defecto:** `1`.

### `clues.singletonSelection.max`

- **Carácter:** opcional.
- **Dominio:** entero mayor o igual que `1`.
- **Valor por defecto:** `2`.

### `clues.subsetReasoning.maxSize`

- **Carácter:** opcional.
- **Dominio:** entero mayor o igual que `2`.
- **Valor por defecto:** `4`.

### `clues.allowBacktrackingDuringGeneration`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.

### `clues.allowBacktrackingForPlayerSolution`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `false`.

## 15. Tratamiento de la víctima

### `victim.excludeFromClueSelection`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.
- **Descripción:** las pistas de la víctima no se eligen mientras queden otros paquetes por colocar. Con tantos paquetes como filas y columnas, la víctima se localiza por descarte sin pistas propias; si hay menos, puede recibir pistas al final (véase «Tratamiento del paquete víctima» en el documento del generador).

### `victim.excludeFromDomainSingletons`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.

### `victim.excludeFromAnnullations`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.

### `victim.excludeFromSubsetReasoning`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.

### `victim.requirePlacementByElimination`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.
- **Descripción:** las pistas de la víctima no deben colocarla por sí solas (`|D| > 1`); su casilla se determina gracias a las casillas que ocupan los demás paquetes. Si no hay ninguna pista así, el generador acepta una que la coloque directamente.

### `victim.requireUniqueFinalCell`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.

## 16. Perfil interno de dificultad

Estos parámetros pueden configurarse manualmente, pero normalmente se derivan de `level.difficulty`.

### `difficulty.topology`

- **Carácter:** opcional.
- **Dominio:** entero entre `1` y `5` o `auto`.
- **Valor por defecto:** `auto`.

### `difficulty.logic`

- **Carácter:** opcional.
- **Dominio:** entero entre `1` y `5` o `auto`.
- **Valor por defecto:** `auto`.

### `difficulty.visual`

- **Carácter:** opcional.
- **Dominio:** entero entre `1` y `5` o `auto`.
- **Valor por defecto:** `auto`.

### `difficulty.reading`

- **Carácter:** opcional.
- **Dominio:** entero entre `1` y `5` o `auto`.
- **Valor por defecto:** `auto`.
- **Descripción:** dificultad de interpretación de las pistas: cuánto cuesta pasar de su texto a casillas, según el coste de las [formas de nombrar](netdoku_catalogo_reglas.md#formas-de-nombrar) que use. Es independiente de `difficulty.logic`, que mide las deducciones necesarias una vez traducidas las pistas. La escala está en [dificultad de interpretación](game_round_generation.md#dificultad-de-interpretación).

### `difficulty.knowledge`

- **Carácter:** opcional.
- **Dominio:** `basic`, `advanced`, `additional`, `extra` o `auto`.
- **Valor por defecto:** `auto`.
- **Descripción:** nivel de conocimiento máximo que puede exigir el nivel (véase [niveles de conocimiento](#niveles-de-conocimiento)). El generador descarta los protocolos, puertos y pistas de un nivel superior. Con `auto` se deriva de `level.difficulty`: las dificultades bajas solo usan `basic`, y las altas admiten `advanced`, `additional` y `extra`. El nivel de conocimiento que realmente se usa forma parte de la dificultad calculada del nivel, junto con la complejidad topológica, lógica y visual.

### `difficulty.maxDirectRuleRatio`

- **Carácter:** opcional.
- **Dominio:** número real entre `0` y `1` o `auto`.
- **Valor por defecto:** `auto`.

### `difficulty.minDeductionSteps`

- **Carácter:** opcional.
- **Dominio:** entero mayor o igual que `0` o `auto`.
- **Valor por defecto:** `auto`.

### `difficulty.maxDeductionSteps`

- **Carácter:** opcional.
- **Dominio:** entero mayor o igual que `0`, `null` o `auto`.
- **Valor por defecto:** `auto`.

### `difficulty.minDependencyDepth`

- **Carácter:** opcional.
- **Dominio:** entero mayor o igual que `0` o `auto`.
- **Valor por defecto:** `auto`.

### `difficulty.maxDependencyDepth`

- **Carácter:** opcional.
- **Dominio:** entero mayor o igual que `0`, `null` o `auto`.
- **Valor por defecto:** `auto`.

### `difficulty.evaluateMultipleRuleOrders`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.

### `difficulty.ruleOrderSamples`

- **Carácter:** opcional.
- **Dominio:** entero positivo.
- **Valor por defecto:** `50`.

### `difficulty.scorePolicy`

- **Carácter:** opcional.
- **Dominio:** `easiest_valid_order`, `average_valid_order`, `first_valid_order`.
- **Valor por defecto:** `easiest_valid_order`.

## 17. Validación de la solución

### `validation.requireConnectedTopology`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.

### `validation.requireValidNetworkGeometry`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.

### `validation.requireRouterAccessibility`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.

### `validation.requireNodeAccessibility`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.

### `validation.requirePacketAccessibility`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.

### `validation.requireRouteConsistency`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.

### `validation.requireProtocolConsistency`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.

### `validation.requireEnoughProperties`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.

### `validation.requireUniqueFinalAnswer`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.

### `validation.requireVictimByElimination`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.

### `validation.requireDifficultyWithinTolerance`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.

### `validation.difficultyTolerance`

- **Carácter:** opcional.
- **Dominio:** número real mayor o igual que `0`.
- **Valor por defecto:** `0.5`.

## 18. Reparación y retroceso

### `repair.enabled`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.

### `repair.maxLocalAttempts`

- **Carácter:** opcional.
- **Dominio:** entero positivo.
- **Valor por defecto:** `20`.

### `repair.order`

- **Carácter:** opcional.
- **Dominio:** lista ordenada de fases.
- **Valor por defecto:** `[clues, packets, routes, nodes, routers, networks, full]`.

### `repair.regenerateClues`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.

### `repair.regeneratePackets`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.

### `repair.regenerateRoutes`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.

### `repair.regenerateNodes`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.

### `repair.regenerateRouters`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.

### `repair.regenerateNetworks`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `true`.

## 19. Límites técnicos

### `limits.maxNetworks`

- **Carácter:** opcional.
- **Dominio:** entero positivo.
- **Valor por defecto:** `20`.

### `limits.maxRouters`

- **Carácter:** opcional.
- **Dominio:** entero positivo.
- **Valor por defecto:** `30`.

### `limits.maxNodes`

- **Carácter:** opcional.
- **Dominio:** entero positivo.
- **Valor por defecto:** `50`.

### `limits.maxPackets`

- **Carácter:** opcional.
- **Dominio:** entero positivo.
- **Valor por defecto:** `30`.

### `limits.maxCandidateRules`

- **Carácter:** opcional.
- **Dominio:** entero positivo.
- **Valor por defecto:** `5000`.

### `limits.maxEvaluatedRoutes`

- **Carácter:** opcional.
- **Dominio:** entero positivo.
- **Valor por defecto:** `1000`.

### `limits.maxRouteLength`

- **Carácter:** opcional.
- **Dominio:** entero positivo.
- **Valor por defecto:** `100`.

### `limits.maxBacktrackingDepth`

- **Carácter:** opcional.
- **Dominio:** entero positivo.
- **Valor por defecto:** `100`.

### `limits.maxSearchStates`

- **Carácter:** opcional.
- **Dominio:** entero positivo.
- **Valor por defecto:** `100000`.

### `limits.maxGenerationTimeMs`

- **Carácter:** opcional.
- **Dominio:** entero positivo o `null`.
- **Valor por defecto:** `null`.

## 20. Direccionamiento

### `addressing.plan`

- **Carácter:** opcional.
- **Dominio:** `distinct`, `octet_subnets`, `bit_subnets`, `vlsm` o `auto`.
- **Valor por defecto:** `auto`.
- **Descripción:** cómo se parecen entre sí los prefijos de las redes del nivel, que determina el coste de calcular la red de una dirección (véase [coste C](netdoku_catalogo_reglas.md#coste-c-de-calcular-la-red-de-una-dirección)):
  - `distinct`: redes que se distinguen por el primer octeto (10.0.0.0/8, 20.0.0.0/8…).
  - `octet_subnets`: subredes de un mismo bloque con máscaras que acaban en un octeto (172.16.1.0/24, 172.16.2.0/24…).
  - `bit_subnets`: subredes de un mismo bloque con la misma máscara, que no acaba en un octeto (dos /25, cuatro /26…).
  - `vlsm`: subredes de un mismo bloque con máscaras distintas (un /24 repartido en /25, /26, /27 y /27). Exige `level.maxTopic` igual o posterior a `T3.vlsm`.
  
  Con `auto`, el generador elige el plan según `difficulty.reading` y `level.maxTopic`. Las redes nunca se solapan, y todos los prefijos son identificadores de red válidos, alineados con su máscara.

### `addressing.nearBoundaryDistance`

- **Carácter:** opcional.
- **Dominio:** entero mayor o igual que `0`.
- **Valor por defecto:** `4`.
- **Descripción:** una dirección que esté a esta distancia o menos del límite con otra red del nivel, si alguna de las dos máscaras no acaba en un octeto, cuesta un punto más de leer (hasta 3). Con `0` no se aplica.

### `addressing.allowSpecialAddresses`

- **Carácter:** opcional.
- **Dominio:** booleano.
- **Valor por defecto:** `false`.
- **Descripción:** permite usar en las pistas la dirección de red y la de difusión de una red (por ejemplo, «la red de la dirección 192.168.0.127»). Los equipos y los routers nunca las tienen.

## 21. Perfiles de categoría

Cada categoría de niveles cambia algunos valores por defecto. Los perfiles están en `categoryProfiles` de la configuración global.

| Parámetro | Inicial y Direccionamiento | Encaminamiento (v0.4) |
|---|---|---|
| `board.width` × `board.height` | 6 × 6 | 7 × 7 |
| `packets.count` | 6 | 7 |
| `topology.networks.min` / `max` | 4 / 4 | 5 / 6 |
| `features.origins`, `destinations`, `routes`, `ttl` | `false` | `true` |
| `endpoints.allowSameNetwork` | — | `false` (salvo los paquetes de difusión) |
| `clues.naming.categoryFormRatio` (`auto`) | entre 0,3 y 0,7 | entre 0,2 y 0,5, sin exigir ninguna |
| `packets.visibleProperties` | `[]` | `[origin, destination, ttlInitial]` |
| `nodes.allowEmptyNetworks` | `false` | `true` (como mucho una red de tránsito) |
| `ttl.initialValues` | — | `[2, 3, 4, 5, 6]`, con pesos `{2: 0.15, 3: 0.25, 4: 0.25, 5: 0.2, 6: 0.15}` |
| `clues.categoryMinClues` | 0 | 3 |

En Encaminamiento, los TTL iniciales son pequeños, como en el ejercicio «No time to die» de la asignatura, para que la resta sea sencilla y para que algunos paquetes no lleguen a su destino. Los valores reales (64, 128…) se dejan para más adelante.

## Configuración mínima recomendada

Una configuración normal solo necesita especificar:

```yaml
level:
  difficulty: 3

packets:
  count: 10

features:
  spatial: true
  networks: true
  nodes: true
  protocols: true
  origins: false
  destinations: false
  routes: false
  hops: false
  ttl: false
```

El resto de parámetros puede heredarse de la configuración global por defecto.
