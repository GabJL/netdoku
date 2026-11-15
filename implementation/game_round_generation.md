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

Un router situado entre dos regiones conectará dos redes. Si se encuentra en una intersección o esquina común, podrá conectar tres o cuatro redes.

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

Por defecto toda red tiene al menos un equipo. Si el nivel usa rutas, saltos o TTL, se pueden dejar algunas redes sin equipos (`nodes.emptyNetworks`), como los enlaces /30 entre routers de la asignatura. Estas **redes de tránsito**:

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

El coste de interpretación de una pista es el mayor de los costes de las formas que usa. La dificultad de interpretación del nivel, de 1 a 5, es el nivel más alto cuya condición se cumple (escala provisional, que habrá que calibrar jugando):

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

1. **Categoría:** el conocimiento que exige el nivel, es decir, el bloque temático más alto entre los de sus pistas y formas de nombrar (`requirements.topic`). Son acumulativas: un nivel de una categoría puede usar todo lo de las anteriores. Por ejemplo: Inicial (`T3.dispositivos`, sin conocimientos previos), Direccionamiento (`T3.ip` a `T3.vlsm`), Encaminamiento (`T3.encaminamiento`), Transporte y aplicación (`T4` a `T6`).
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
