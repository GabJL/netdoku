# Implementación del juego

## Arquitectura

Se propone desarrollar el juego como una **aplicación web**.

Las razones principales son:

- funcionamiento en Windows, Linux y macOS sin instalación;
- integración sencilla con Moodle;
- distribución inmediata;
- actualizaciones automáticas;
- posibilidad de registrar estadísticas y progreso.

## Separación entre juego y generación

Se propone separar completamente dos componentes.

### Motor del juego

Interpreta una partida ya creada.

No conoce cómo ha sido generada.

Únicamente carga un fichero de partida y permite jugar.

### Generador de partidas

Programa independiente encargado de construir nuevos niveles.

Esta separación permite:

- mantener un motor muy sencillo;
- generar miles de partidas distintas;
- diseñar niveles manualmente;
- evolucionar el generador sin modificar el juego.

## Formato de una partida

Cada partida se escribirá en **YAML**, tanto si se diseña a mano como si la produce el generador. YAML es más legible y admite comentarios, y en él están escritos los niveles y la configuración del generador.

El motor del juego no lee YAML. Las partidas se exportan a **JSON** (en el generador o en un paso de build), y el motor web solo carga ficheros JSON. Así no necesita ninguna librería externa. Como YAML incluye a JSON, la conversión es directa y no pierde información; solo se pierden los comentarios.

El fichero contendrá:

### Mapa

- tamaño;
- redes;
- casillas;
- equipos;
- routers;
- tablas de encaminamiento de los routers (`routing.tables`), si el nivel usa rutas, saltos o TTL. Para cada router y red destino guardan la entrega directa o el siguiente salto, y las rutas de los paquetes son coherentes con ellas. Pueden mostrarse al jugador o servir de base a pistas.

### Paquetes

Para cada paquete existirán dos bloques claramente diferenciados.

#### Información interna (solución)

- origen;
- destino;
- protocolo;
- TTL;
- ruta;
- posición correcta;
- estado comprometido.

Esta información únicamente es utilizada por el motor para validar la partida.

#### Información visible

- nombre o color;
- propiedades visibles (si las hubiera);
- pistas mostradas al jugador.

Cada pista guarda también lo que dice en forma de casillas: su dominio `domain` (las casillas donde puede estar su paquete, `D`) y, si descarta casillas para los demás paquetes, `excluded` (`A`). No se muestran: el motor los usa para las sugerencias. Un nivel sin ellos se puede jugar, pero sin sugerencias.

De este modo el mismo motor puede ejecutar niveles de distinta dificultad sin modificaciones.

### Objetivo

- paquete atacante

## Interfaz

### Zona principal

Representa el mapa de la red.

Incluye:

- cuadrícula;
- redes coloreadas;
- equipos;
- routers.

Al pasar el ratón sobre cualquier elemento puede mostrarse información contextual.

Ejemplos:

**Casillas**

- red;
- máscara.

**Equipos**

- tipo;
- nombre.

**Routers**

- redes conectadas.

### Panel lateral

Cada paquete aparece como una tarjeta.

La tarjeta no posee campos fijos, sino que muestra únicamente la información que el nivel haya decidido revelar.

Puede contener:

- nombre o color;
- propiedades visibles (origen, destino, protocolo, TTL, etc.);
- conjunto de pistas.

El motor del juego simplemente muestra la información especificada en el fichero de la partida.

## Mecánica

El jugador arrastra cada paquete hasta una casilla.

Si la posición es correcta:

- queda fijado;
- aparece marcado como resuelto.

Si es incorrecta:

- vuelve al panel;
- el jugador pierde una vida.

Al colocar el último paquete, el nivel queda resuelto y se muestra el atacante, que es evidente con el tablero completo; no hay pregunta final.

### Sugerencias

Si el jugador se atasca, el botón **Sugerencia** le explica la siguiente deducción que puede hacer. En el texto del juego se llaman sugerencias para no confundirlas con las pistas de los paquetes.

- Cuesta una vida, y por tanto una estrella. No se puede pedir con la última vida, así que no hace perder el nivel, y con tres vidas caben como mucho dos por nivel. Se pide confirmación antes de gastarla.
- Se calcula desde el estado real de la partida: los paquetes colocados (que siempre son correctos) y lo que dice cada pista (`domain` y `excluded`). No depende del orden en que el generador resolvió el nivel ni de las notas del jugador.
- Primero comprueba las ✕ del jugador: si alguna está en la casilla de un paquete, la sugerencia lo dice y resalta esa casilla.
- Si no, busca con las técnicas del generador (colocación directa, fila o columna obligada, anulación y reservas), de la más sencilla a la más difícil, la cadena de deducciones que deja un paquete en una sola casilla, y quita los pasos que no hacen falta. Además usa dos razonamientos que el generador no necesita porque resuelve en su propio orden: un paquete que solo cabe en una fila o columna se queda esa línea, y las reservas pueden incluir a la víctima.
- La víctima se deja para el final, porque se deduce por descarte: primero se busca una cadena que no hable de ella; si no la hay, una que la use en filas obligadas o reservas sin colocarla; y solo si tampoco, una que la coloque. En las pruebas, ninguna sugerencia lleva a la víctima mientras quedan otros paquetes por colocar.
- Explica cada paso con un texto («Los paquetes B y D solo pueden estar en las columnas 5 y 6, uno en cada una…») y resalta en el tablero sus casillas y en el panel sus paquetes y pistas, un paso cada vez. No dice la casilla final: el último paso es «al paquete A solo le queda una casilla posible».
- La sugerencia se guarda con el progreso del nivel y desaparece al colocar el paquete al que lleva (o al quitar la ✕ equivocada) o al cerrarla.

El razonamiento está en `engine/hints.js`, separado del dibujo. Se ha probado en todos los niveles de los lotes con partidas que colocan los paquetes en órdenes al azar: siempre encuentra una deducción, y la cadena lleva a la casilla correcta.

## Organización del juego (v0.3)

Una sola página con pantalla inicial y cinco apartados:

- **Cómo se juega**: objetivo, forma de jugar, reglas comunes a todas las categorías, algunas pistas comunes y lo que añade cada categoría.
- **Jugar**: se elige una categoría y una de sus cinco dificultades. Las categorías completadas (todas sus dificultades resueltas) se distinguen por el color, y aparece elegida la más avanzada que se ha empezado sin completarla (o, si no hay, la primera sin completar).
- **Estadísticas**: tabla compacta categoría × dificultad con el mejor resultado en estrellas.
- **Ayuda**: todas las fichas de ayuda.
- **Sobre el juego**: relación con la asignatura, objetivo docente y licencia.

Progresión:

- Cada categoría corresponde a un bloque temático de la asignatura y muestra cinco niveles, uno por dificultad. Internamente cada dificultad tiene un lote de unos 75 niveles y, al jugarla, sale uno al azar sin repetir hasta haber visto casi todos. Reiniciar da otro nivel de la misma dificultad.
- Se guarda el mejor resultado de cada dificultad (tres estrellas menos una por fallo o sugerencia); nunca se pierde.
- Para abrir una dificultad hay que haber resuelto la anterior. Todas las categorías están abiertas desde el principio.
- En cada nivel, un botón abre la información de su categoría: un resumen corto de teoría y las reglas nuevas que introduce.

Idiomas: español e inglés de serie. Todos los textos de la interfaz, de la ayuda y de las pistas están en un fichero por idioma; el texto de cada pista se compone en el motor a partir de sus datos (tipo, parámetros y formas de nombrar), así que un nivel sirve para cualquier idioma.
