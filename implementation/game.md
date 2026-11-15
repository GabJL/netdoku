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

## Organización del juego (v0.3)

Una sola página con pantalla inicial y cinco apartados:

- **Cómo se juega**: objetivo, forma de jugar, reglas comunes a todas las categorías, algunas pistas comunes y lo que añade cada categoría.
- **Jugar**: se elige una categoría y una de sus cinco dificultades. Las categorías completadas (todas sus dificultades resueltas) se distinguen por el color, y aparece elegida la más avanzada que se ha empezado sin completarla (o, si no hay, la primera sin completar).
- **Estadísticas**: tabla compacta categoría × dificultad con el mejor resultado en estrellas.
- **Ayuda**: todas las fichas de ayuda.
- **Sobre el juego**: relación con la asignatura, objetivo docente y licencia.

Progresión:

- Cada categoría corresponde a un bloque temático de la asignatura y muestra cinco niveles, uno por dificultad. Internamente cada dificultad tiene un lote de unos 50 niveles y, al jugarla, sale uno al azar sin repetir hasta haber visto casi todos. Reiniciar da otro nivel de la misma dificultad.
- Se guarda el mejor resultado de cada dificultad (tres estrellas menos una por fallo); nunca se pierde.
- Para abrir una dificultad hay que haber resuelto la anterior. Todas las categorías están abiertas desde el principio.
- En cada nivel, un botón abre la información de su categoría: un resumen corto de teoría y las reglas nuevas que introduce.

Idiomas: español e inglés de serie. Todos los textos de la interfaz, de la ayuda y de las pistas están en un fichero por idioma; el texto de cada pista se compone en el motor a partir de sus datos (tipo, parámetros y formas de nombrar), así que un nivel sirve para cualquier idioma.
