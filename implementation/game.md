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

Una vez colocados todos los paquetes, el jugador selecciona el equipo infectado.
