# Netdoku: Juego de deducción lógica para el aprendizaje de Redes de Computadores

## Objetivo

Netdoku es un juego inspirado en la mecánica de **Murdoku**, adaptado al aprendizaje para la asignatura de Redes y Servicios (UMA).

El jugador debe reconstruir el estado de una red utilizando únicamente un conjunto de pistas lógicas relacionadas con conceptos propios de la asignatura.

No pretende simular Internet con precisión, sino representar una versión simplificada donde conceptos como redes, routers, protocolos o TTL puedan utilizarse para razonar.

La idea es que el alumno aprenda Redes resolviendo un problema de deducción y no realizando ejercicios aislados.

## Filosofía

Cada nivel representa un instante del recorrido de varios paquetes por una red.

El jugador debe deducir: dónde se encuentra cada paquete. Para ello, se apoya en pistas que le permite deducir parcialmente qué ruta ha seguido y qué propiedades tiene cada uno. Finalmente identificar el elemento responsable del incidente (el paquete infectado).

La complejidad aumenta progresivamente durante el juego. Quizás no tanto por la complejidad deductiva sino por incorporar nuevos elementos de la red.

Los primeros niveles únicamente introducirán:

- redes;
- equipos;
- routers;
- paquetes.

Posteriormente podrán añadirse conceptos como (algunos aún no me quedan claro cómo):

- switches;
- puntos de acceso WiFi;
- firewalls;
- NAT;
- VLANs;
- fragmentación;
- TCP;
- etc.

Cada nivel introduce únicamente uno o dos conceptos nuevos, que pueden ser elementos nuevos o tipo de pistas nuevas tales como tener que identificar redes, trabajar con el TTL, identificar tipos de servidores atendiendo al protocolo, etc.

## El tablero

El tablero representa un mapa simplificado de una red.

Está formado por una cuadrícula.

Cada casilla pertenece a una red. Las casillas de un red siempre están adyacentes entre sí. Cada red aparece con un color distinto y está identificada mediante su dirección IP y máscara.

Ejemplo:

- 192.168.1.0/24
- 10.0.0.0/16
- 172.16.10.0/25

Una casilla puede estar vacía o contener un nodo de uno de estos tipos:

- **cliente**: equipo de usuario;
- **servidor**: ofrece uno o varios servicios (web, DNS, correo, ficheros, multimedia);
- **infraestructura**: firewall, switch o punto de acceso WiFi. Se introducirán en niveles posteriores.

Los routers no ocupan casillas. Se sitúan en la frontera entre casillas de redes distintas: en un borde si conectan dos redes, o en una esquina común si conectan tres o cuatro. Aunque no ocupen casilla, **pertenecen a todas las redes que unen**: tienen una interfaz con una dirección IP en cada una, y esa IP cuenta al repartir las direcciones de la red (como en la asignatura: identificador y difusión + una por router + una por equipo). Dibujarlos en la frontera deja claro que un router es el punto de paso entre redes.

Los paquetes solo pueden estar en casillas vacías o en su nodo origen o destino.

**Regla básica:** como en Murdoku, en cada fila y en cada columna hay como mucho un paquete. Si hay tantos paquetes como filas, cada fila y cada columna tiene exactamente uno. Esto permite localizar al último paquete (la víctima) por descarte.

## Los paquetes

Las piezas del juego son **paquetes** (nivel 3, red). Para el resto de niveles se usa siempre el mismo nombre: **trama** (nivel 2), **segmento** (TCP) o **datagrama** (UDP) en el nivel 4, y **mensaje** (nivel 5) para el contenido de aplicación que lleva el paquete.

Cada paquete constituye una pieza del juego.

Internamente, el juego conoce toda la información asociada a cada paquete:

- origen;
- destino;
- protocolo;
- TTL;
- ruta completa;
- posición actual;
- estado (víctima, atacante u otro).

Sin embargo, **el jugador no tiene por qué conocer toda esa información**.

El origen, el destino, el protocolo o el TTL pueden actuar también como pistas. Cada nivel decide qué propiedades se muestran directamente, cuáles aparecen como pistas y cuáles permanecen ocultas.

Una misma propiedad puede presentarse de distintas formas:

- **Dato visible:** `Protocolo: HTTP`.
- **Pista directa:** "Este paquete utiliza HTTP."
- **Pista indirecta:** "Su destino es un servidor web."
- **Pista relacional:** "Utiliza el mismo protocolo que el paquete azul."
- **Dato oculto:** no se proporciona ninguna información sobre esa propiedad.

Esto permite reutilizar una misma topología para generar niveles con dificultades muy diferentes.

## Objetivo final

Una vez deducida la posición de todos los paquetes, el nivel tiene una respuesta final: quién es el atacante.

Al igual que en **Murdoku**, esta decisión final no debe constituir un nuevo problema de deducción. Toda la dificultad del nivel reside en reconstruir correctamente el estado de la red. Una vez hecho esto, la respuesta final debe obtenerse aplicando una regla sencilla sobre la solución.

La primera propuesta consiste en utilizar dos paquetes especiales:

- **Paquete víctima**, conocido por el jugador desde el inicio.
- **Paquete atacante**, que debe identificarse al finalizar el nivel.

La regla sería simplemente:

> El paquete atacante es el paquete que se encuentra en la misma red que el paquete víctima.

De esta forma, el jugador no necesita realizar nuevas deducciones una vez resuelto el tablero. Basta con localizar el paquete víctima e identificar el otro paquete situado en esa misma red. Como la respuesta es evidente con el tablero completo, el juego no la pregunta: al colocar el último paquete, el nivel queda resuelto y se muestra el atacante.

Esta mecánica reproduce la filosofía de Murdoku, donde la identificación del culpable es la consecuencia directa de haber resuelto correctamente el puzle y no un desafío independiente.

No obstante, esta es únicamente una primera propuesta. En el futuro podrían definirse otros escenarios con reglas finales diferentes, siempre manteniendo el mismo principio: la respuesta debe depender únicamente del estado final reconstruido y no requerir razonamientos adicionales.

## Tipos de pistas

Las pistas constituyen el núcleo del juego.

Todas describen propiedades verdaderas de la solución. A continuación se muestran varios ejemplos:

### Posición

- El paquete está en el equipo origen.
- El paquete está en el equipo destino.
- El paquete está en la red origen.
- El paquete está en la red destino.
- El paquete aún no ha abandonado la red origen.
- El paquete ya ha llegado a la red destino.
- El paquete está viajando por la red X.
- El paquete no está situado sobre ningún equipo.
- El paquete está junto al origen.
- El paquete está junto al destino.

### Negaciones, alternativas y recuentos

- El paquete no está en la red X.
- El paquete no está junto a ningún servidor.
- El paquete está en la red X o en la red Y.
- El paquete está en una red sin servidores.
- El paquete está en una red con exactamente dos equipos de usuario.
- El paquete está en la misma fila que el servidor DNS.

### Equipos

- El paquete HTTP ha llegado a su destino.
- El paquete DNS está cerca del servidor DNS.
- El paquete está en un cliente.
- El paquete está en un servidor.
- El paquete no está conectado a un AP WiFi.

### Routers

- Está a punto de atravesar un router.
- Acaba de atravesar un router.
- El siguiente salto será un router.
- El siguiente salto será la red del destino.
- Está exactamente a dos casillas de un router.

### Redes

El **tamaño de una red** es siempre su **número de direcciones**, 2^(32−n) para un prefijo /n, como en la asignatura: una /23 (512 direcciones) es mayor que una /24 (256). El número de casillas que ocupa en el tablero no tiene ningún significado de red. Para evitar confusiones, las pistas hablan de direcciones o de prefijos, no de «la red más grande», y cuando un nivel usa pistas de tamaño se recuerda en una línea que las casillas no indican el tamaño de la red.

- Está en la red con más direcciones.
- Está en la red con menos direcciones.
- Está en la red cuya dirección de difusión es 192.168.1.127.
- Está en la red cuya primera dirección asignable es 192.168.1.65.
- Está en una red con 62 direcciones asignables.
- Pertenece a una red /24.
- Pertenece a una red /30.
- El origen está en una red con más direcciones que el destino.

### Rutas y TTL (categoría Encaminamiento)

La ficha de cada paquete dice su origen, su destino y su TTL inicial (entre 2 y 6). El jugador traza la ruta, el camino con menos routers entre las dos redes, que en estos niveles es único, y sabe que el paquete está en una red de su ruta a la que le llega el TTL. Algunas redes de tránsito (Troncal) no tienen equipos y solo unen routers. Un paquete de difusión no sale de la red de su origen.

- Aún no había salido de la red de su origen. / La trama que lo llevaba la había enviado su propio equipo de origen.
- Ya había llegado a la red de su destino. / La trama iba dirigida directamente a su equipo de destino.
- Estaba pasando por una red de tránsito.
- El último router que había atravesado era el que une Aulas y Servicios. / La trama la había enviado ese router.
- El siguiente router que iba a atravesar era el que une Aulas y Servicios. / La trama iba dirigida a ese router.
- Había atravesado exactamente dos routers. / Llevaba TTL 2 (con TTL inicial 4).
- Le quedaba un router para llegar a la red de su destino.
- Ya había atravesado algún router. / Había atravesado como mucho un router. / Su TTL era como mucho 2.

Desde la v0.4.5, un router puede unir tres o cuatro redes (está en la esquina donde se juntan), y la ficha de un paquete puede no decir su origen o su destino («desconocido»): hay que deducirlo, porque cada red posible da una ruta distinta.

- El paquete A lo había enviado el servidor web de la red Aulas. / La IP de origen del paquete A era 10.0.1.7. / Lo había enviado un servidor DNS.
- El primer router de su ruta era el que une Aulas y Servicios, la puerta de enlace de su equipo de origen.
- El último router de su ruta era el que une Aulas y Servicios.

### Pistas entre dos paquetes

Desde la v0.4.5, algunas pistas relacionan dos paquetes y aparecen en la ficha de los dos:

- Los paquetes A y B estaban en la misma red.
- Las redes de A y B eran vecinas: las unía un router. / Para ir de la red de A a la de B había que atravesar como mínimo dos routers.
- A estaba en una red con más direcciones que la de B.
- A había atravesado más routers que B. / A llevaba más TTL que B. / Al paquete A le quedaban menos routers que al B para llegar a la red de su destino.
- A y B habían salido de la misma red. / Iban a la misma red.

### TTL

Suponiendo un TTL inicial de 64:

- TTL = 64 → ningún router atravesado.
- TTL = 63 → un router.
- TTL = 62 → dos routers.

Ejemplos:

- El paquete tiene TTL 62.
- El paquete rojo tiene mayor TTL que el azul.
- Ha atravesado exactamente tres routers.

### Protocolos

Cada paquete tiene un protocolo de aplicación, y cada protocolo determina desde qué nodo puede salir, qué servicio debe ofrecer el destino, qué transporte usa y a qué puerto va. Los protocolos básicos son los que se ven como teoría en la asignatura:

| Protocolo | Origen | Destino | Transporte | Puerto |
|---|---|---|---|---|
| HTTP / HTTPS | Cliente | Servidor web | TCP | 80 / 443 |
| DNS | Cliente o servidor DNS | Servidor DNS | UDP | 53 |
| SMTP | Cliente o servidor de correo | Servidor de correo | TCP | 25 |
| POP3 / IMAP | Cliente | Servidor de correo | TCP | 110 / 143 |
| SSH / Telnet | Cliente | Cualquier servidor | TCP | 22 / 23 |
| FTP | Cliente | Servidor de ficheros | TCP | 21 |
| DHCP | Cliente (solo dentro de su red) | Servidor DHCP | UDP | 67 |
| RTSP | Cliente | Servidor multimedia | TCP | 554 (dato no visto en la asignatura) |
| ICMP | Cualquier nodo | Cualquier nodo | — (capa de red) | — |

Para niveles más avanzados hay también protocolos que la asignatura menciona en segundo plano (puertos seguros como SMTPS 465, IMAPS 993 o POP3S 995; FTP de datos, 20; TFTP) y otros vistos como ampliación (SMB). Cada protocolo y cada puerto tienen un **nivel de conocimiento** (básico, avanzado, adicional o extra) que cuenta en la dificultad del nivel.

TCP y UDP no se tratan como protocolos del paquete, sino como propiedades que se deducen de él. Esto permite pistas indirectas.

Ejemplos:

- El paquete utiliza HTTPS.
- El paquete viaja sobre UDP (→ es DNS).
- El paquete va dirigido al puerto 25 (→ es SMTP y su destino es un servidor de correo).
- Utiliza el mismo transporte que el paquete azul.

### Relaciones

Las pistas más complejas comparan distintos paquetes.

Ejemplos:

- El paquete rojo está más cerca del destino que el azul.
- El paquete HTTP está más lejos del destino que el DNS.
- El paquete verde tiene mayor TTL que el amarillo.
- El paquete rojo está en una red con más direcciones que el azul.

