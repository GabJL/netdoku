# Contenidos de Redes y Servicios relevantes para Netdoku

Resumen de lo que se ve en la asignatura (curso 2025-2026: Apuntes, Clases, Prácticas y Problemas) que afecta al diseño del juego. Sirve para que el vocabulario, las reglas y las pistas sean coherentes con lo que el alumno ha estudiado, y para saber **a partir de qué tema puede jugarse cada nivel**.

La fuente principal son los **apuntes de clase unificados** de cada tema (`Clases/RyS-Tema N (Apuntes de clase unificados).pdf`, del T1 al T5; el T6 no tiene). En ellos cada transparencia está marcada como **Teoría**, **Ejercicio** o **Adicional**, y esa marca se usa aquí para separar lo que forma parte del temario de lo que es ampliación.

Cada concepto lleva una de estas etiquetas:

- **[Visto]**: se da como Teoría o Ejercicio en clase, o aparece en los apuntes oficiales, las prácticas o los problemas.
- **[Adicional]**: se comenta en clase como ampliación (transparencia «Adicional»). Puede usarse en el juego, pero conviene acompañarlo de una aclaración.
- **[Extra]**: no se ve en la asignatura, pero es sencillo y puede usarse en el juego con una aclaración breve.

Contenidos marcados como **Adicional** en clase que afectan al juego: BGP, diseño interno de routers, ampliaciones de VLAN, detalles de NAT más allá del funcionamiento básico, detalles de las tramas Ethernet y 802.11, compartición de ficheros (SMB, NFS, WebDAV, BitTorrent, rsync), cookies y mejoras de HTTP, y la historia de la asignación de puertos.

## 1. Orden de los temas

| Tema | Capa TCP/IP | Contenido | Relación con el juego |
|---|---|---|---|
| T1. Introducción | — | Hosts y nodos intermedios, conmutación de paquetes, cliente/servidor y P2P, LAN/WAN, modelo de capas OSI y TCP/IP, encapsulamiento. | Vocabulario básico. |
| T2. Enlace | Enlace | Tramas, MAC, Ethernet, CSMA/CD, WiFi (802.11, BSS, modo infraestructura, CSMA/CA), Bluetooth, PPP, control de errores y flujo. | Switches y puntos de acceso; dentro de una red. |
| T3. Interconexión e IPv4 | Red | Dispositivos de interconexión, VLAN, datagrama IP, TTL, fragmentación, direccionamiento, subredes, VLSM, CIDR, tablas de encaminamiento, ARP, DHCP, ICMP, RIP, BGP, NAT, IPv6. | **Núcleo del juego.** |
| T4. Transporte | Transporte | Puertos, sockets, UDP, TCP (conexión, ventana, congestión), QUIC. | Transporte y puertos de los paquetes. |
| T5. Servicios clásicos | Aplicación | DNS, HTTP (1.1, 2, 3), FTP, Telnet/SSH, correo (SMTP, POP3, IMAP), TLS. | Protocolos y servidores. |
| T6. Servicios avanzados | Aplicación | Multimedia (DASH, RTP/RTCP, SDP, RTSP), nube (IaaS…SaaS), CDN. | Servidor multimedia. |

Las prácticas son: P1, tramas Ethernet y WiFi con Wireshark (T2); P2, IP e ICMP con Wireshark: campo protocolo, TTL, fragmentación, `ping` y `tracert` (T3); P3, configuración de red en Linux/Windows: IP, máscara, puerta de enlace, DNS y tablas de rutas (T3); P4, cliente/servidor UDP en Java (T4).

### Orden de las clases (curso 2025-2026)

El T3 ocupa siete clases y el orden en que se ven sus partes importa para decidir qué puede usar un nivel:

| Clase | Tema | Contenido |
|---|---|---|
| 1–4 | T1 | Conceptos, métricas, capas, encapsulamiento, estructura de Internet. |
| 4–8 | T2 | Control de errores y flujo, MAC, Ethernet, CSMA/CD, WiFi, Bluetooth/BLE. |
| 9 | T3 | Dispositivos de interconexión (hub, puente, switch, router), VLAN. |
| 10 | T3 | IPv4, direcciones IP, cabecera (TTL, campo protocolo), ICMP. |
| 11 | T3 | Fragmentación. |
| 12 | T3 | ARP, encaminamiento jerárquico, clases, subredes. |
| 13 | T3 | VLSM, CIDR, DHCP. |
| 14 | T3 | Tablas de encaminamiento, encaminamiento (vector distancia, RIP, BGP). |
| 15 | T3 | Direcciones privadas, NAT, IPv6. |
| 16 | T4 | Servicios de transporte, puertos, multiplexación, UDP. |
| 17–18 | T4 | TCP (conexión, errores, flujo, congestión), QUIC. |
| 19 | T5 | Capa de aplicación, puertos, TLS, DNS, Telnet/SSH. |
| 20 | T5 | Web y HTTP (1.1, 2, 3). |
| 21 | T5 | Transferencia y compartición de ficheros (FTP, SMB, NFS, WebDAV, BitTorrent, rsync), correo (SMTP, POP3, IMAP). |
| 22 | T6 | Multimedia (DASH, RTP, RTSP), CDN, nube, P2P. |

### Estilo docente

Las clases usan mucho actividades con forma de juego, y Netdoku puede aprovechar sus mecánicas:

- **Pistas graduadas:** la actividad de fragmentación (clase 11) da pistas numeradas por apartado, cada una más concreta que la anterior. El *breakout* de la clase 15 ofrece hasta 4 pistas por reto y pide en el informe cuántas se usaron y la dificultad percibida (1–5).
- **Otras dinámicas:** Kahoot, Wooclap, Jeopardy de la capa de enlace (clase 8), adivinar términos con palabras clave (clase 16), puzle de reunir fragmentos (clase 11) y de reunir puertos NAT (clase 15).
- **Títulos con humor** en los ejercicios («No time to die» para TTL, «“Subnetear” es divertido», «Tableando», «Switchfeando»), que pueden servir de modelo para los nombres de los niveles.

**Consecuencia:** encaja con el estilo de la asignatura que Netdoku tenga un sistema de **ayudas graduadas** y registre las ayudas usadas y la dificultad percibida.

## 2. Terminología de la asignatura

**[Visto]** Cada capa tiene su nombre para la unidad de datos:

| Capa TCP/IP | Unidad | Dirección |
|---|---|---|
| Aplicación | mensaje | — (nombre, URL) |
| Transporte | segmento (TCP) / datagrama (UDP) | puerto |
| Red | paquete / datagrama IP | dirección IP |
| Enlace | trama | MAC |

**Decisión para el juego:** se usa el modelo TCP/IP de cinco niveles con un único nombre por nivel:

| Nivel | Unidad en el juego |
|---|---|
| 2 (enlace) | trama |
| 3 (red) | **paquete** |
| 4 (transporte) | **segmento** (TCP) o **datagrama** (UDP) |
| 5 (aplicación) | **mensaje** |

Lo que se mueve por el tablero entre redes y atraviesa routers es un **paquete**. En el juego, «datagrama» se reserva para UDP, aunque en la asignatura también se diga «datagrama IP». Los textos del juego hablan de «paquete» (en los ficheros, `packet`), y «mensaje» solo se usa para el contenido de aplicación que lleva el paquete (por ejemplo, «el paquete lleva un mensaje SMTP»).

## 3. Redes y dispositivos

### Qué es una red

**[Visto, T3]** «Una red es un conjunto de equipos que se pueden comunicar entre ellos directamente a nivel de enlace», sin pasar por un router. Las redes **están delimitadas por routers**.

- Un **puente o switch no divide redes**: los segmentos que une siguen siendo una única red.
- Puede haber **redes sin equipos** que solo unen routers, como un enlace punto a punto entre dos routers. Son habituales en los problemas, por ejemplo la «LAN 4: 0 equipos, 2 routers».
- **[Visto, T3]** Una VLAN permite que equipos conectados al mismo switch estén en redes distintas. Para comunicar VLAN distintas hace falta un router.

### Dispositivos de interconexión

**[Visto, T3]** Cada dispositivo trabaja hasta una capa:

| Dispositivo | Capa | En el juego |
|---|---|---|
| Repetidor / concentrador (hub) | Física | No aporta nada. |
| Puente (bridge) / conmutador (switch) | Enlace | Nodo **dentro** de una red. No cambia de red ni decrementa el TTL. |
| Punto de acceso WiFi | Enlace | Nodo **dentro** de una red (BSS en modo infraestructura, T2). |
| Router (encaminador) | Red | **Separa redes.** Decrementa el TTL. |
| Pasarela (gateway) | Por encima de red | A veces se usa como sinónimo de router; en P3, «puerta de enlace» es el router por defecto del host. |

- **Cortafuegos (firewall) [Extra]:** no aparece en ningún material de la asignatura. El nivel 001 ya no lo usa. Si se usa en otro nivel, conviene explicarlo en una frase: «equipo que filtra los paquetes que pasan por él».
- **Proxy [Visto, T5]:** aparece en el Tema 5 y en un problema del Tema 3 (servidores de correo, web y proxy).

### Routers

**[Visto, T3]**

- El router tiene **una interfaz con una IP en cada red que conecta**, y esas IPs cuentan al calcular cuántas direcciones necesita cada red: «IP necesarias: 2 (ID y difusión) + R (routers) + H (hosts)» (clase 14). En los ejercicios, los routers suelen usar la primera dirección libre de la red. El juego coloca el router en la frontera entre casillas, lo que encaja si se entiende como un nodo que **pertenece a la vez a todas las redes que une**. En cambio, `description.md` dice que el router «no pertenece a ninguna» red, y eso contradice el temario.
- El router decide el **siguiente salto** con una **tabla de encaminamiento** que solo contiene redes (`identificador/máscara → siguiente salto | entrega directa`), más una **ruta por defecto**. Gana la coincidencia con el **prefijo más largo**.
- **Entrega directa** cuando el destino está en la misma red; **entrega indirecta** a través de routers en otro caso.
- El tráfico hacia una red desde un mismo origen **sigue siempre el mismo camino**, y la ruta de ida puede no coincidir con la de vuelta.
- Si una IP de destino coincide con varias entradas de la tabla, se elige la **más específica** (*Longest Prefix Match*). La ruta por defecto se escribe `default` o `0.0.0.0/0`.
- **RIP** (Teoría) usa como métrica el número de saltos (máximo 15). **BGP** (Adicional) se ve como encaminamiento entre sistemas autónomos.

## 4. Direccionamiento IPv4

**[Visto, T3]**

- Una dirección tiene 32 bits en notación decimal con puntos y se divide en `<red><host>`. La máscara puede escribirse como prefijo (`/24`) o en decimal (`255.255.255.0`), y sus unos siempre son contiguos.
- Una dirección pertenece a una red si `IP AND máscara = identificador de red`. Es un ejercicio habitual en los problemas («indique cuáles de estas direcciones están en la red 172.16.0.0/19»).
- Una red `/n` tiene `2^(32−n)` direcciones, de las cuales `2^(32−n) − 2` se pueden asignar a equipos: la primera es el **identificador de red** y la última, la **difusión**.
- Clases A, B, C, D y E como contexto histórico. Lo que se usa son subredes, **VLSM** y **CIDR**: los bloques tienen un tamaño que es potencia de dos y deben estar alineados.
- **Rangos privados:** `10.0.0.0/8`, `172.16.0.0/12` y `192.168.0.0/16`. Ningún router reenvía hacia Internet un paquete con una IP privada.
- **Direcciones especiales:** `127.0.0.1` (loopback), `0.0.0.0` y `255.255.255.255` (difusión local).

**Consecuencias para el juego:**

- **El tamaño de una red** en el sentido de la asignatura es su **número de direcciones**, que depende del prefijo, y no el número de casillas del tablero. **Decisión:** las pistas hablan de «la red con más direcciones» o de «una red /23», nunca de «la red más grande», y un nivel con pistas de tamaño recuerda que las casillas no indican el tamaño de la red.
- Las máscaras que no acaban en un octeto completo son lo normal en la asignatura: la red del laboratorio de P3 es una `/22` (`192.168.164.0/22`, con puerta de enlace `192.168.167.254`), y en clase se usa una tabla de máscaras de `/0` a `/32`.
- Los prefijos de los niveles deben ser **identificadores de red válidos**, alineados con su máscara. Por ejemplo, `192.168.40.0/23` es válido porque 40 es par, pero `192.168.41.0/23` no lo es.
- Se pueden plantear pistas con direcciones IP del estilo de los problemas: «su destino es 192.168.10.37», que obliga a deducir la red con la máscara.

## 5. El paquete IP (cabecera)

**[Visto, T3 y P2]**

### TTL (tiempo de vida)

- Lo fija el emisor y **cada router lo decrementa en 1**; los switches no lo tocan. Cuando llega a 0, el datagrama se descarta y el router envía al origen un **ICMP de tiempo excedido**, que es el mecanismo en el que se basa `tracert`/`traceroute` (P2).
- En P2 se compara el TTL de la petición y el de la respuesta («¿quién establece cada valor?»). Los problemas usan valores arbitrarios, como TTL 10 o 62.
- El ejercicio «No time to die» (clase 10) es casi un nivel de Netdoku: con valores iniciales pequeños (2 a 5), pregunta con qué TTL llega un paquete. «TTL inicial 3 → llega con TTL 1 (atraviesa 2 routers)»; «TTL inicial 2 → no llega: el segundo router lo deja a 0, lo descarta e informa»; «TTL inicial 4 → llega con 4: no atraviesa ningún router, los puentes no miran la cabecera de red».
- **[Extra]** Los valores iniciales típicos dependen del sistema operativo (64 en Linux y macOS, 128 en Windows, 255 en algunos equipos de red). No se ven en la asignatura, pero se ven en las capturas de P2 y sirven como aclaración.

**Consecuencia:** `TTL actual = TTL inicial − routers atravesados`. Un paquete que aún está en su red de origen conserva el TTL inicial. Un paquete que está en el tablero siempre tiene TTL ≥ 1. Los TTL iniciales pequeños, como en «No time to die», hacen las pistas más fáciles de calcular que 64 o 128.

### IP frente a MAC en cada salto

El ejercicio de examen «Viaje con escalas» (parcial de 2021, repetido en la clase 10) pide, para un datagrama que va de A a B pasando por R1 y R2, las MAC y las IP de cada trama: las **IP de origen y destino son las mismas en las tres tramas**, y las **MAC cambian en cada red**. En P2 (ejercicio 2) se comprueba lo mismo con tráfico real: dos paquetes con **IP de destino distintas** (fuera de la red) llevan la **misma MAC de destino**, la del router. La IP indica el destino final y no cambia; la MAC indica el siguiente salto y cambia en cada red. En la clase 12 era una duda frecuente al estudiar ARP («origen y destino del mensaje frente a origen y destino de ARP»).

**Consecuencia (futuro):** son posibles pistas de nivel de enlace como «su MAC de destino es la del router R2», que dice hacia dónde va el paquete dentro de su red actual.

### Campo protocolo

En la cabecera IP, el campo protocolo indica a quién se entrega el contenido: ICMP = 1, IGMP = 2, TCP = 6, UDP = 17, OSPF = 89. Es el ejercicio 1 de P2.

**Consecuencia:** se puede usar como pista indirecta: «el campo protocolo de su cabecera IP vale 17» lleva a UDP. Esta pista requiere el T4, porque hay que saber qué es UDP.

### Fragmentación

- Cada red tiene una **MTU** (1500 en Ethernet). Si el datagrama no cabe, el router lo fragmenta. Todos los fragmentos comparten el identificador, el desplazamiento se mide en unidades de 8 bytes, y el flag MF está activo en todos menos el último. **Solo se reensambla en el destino.**
- **Consecuencia (futuro):** las redes podrían tener una MTU, y una pista como «el paquete ya ha sido fragmentado» indicaría que ha atravesado una red con MTU menor que su tamaño.

### Las direcciones no cambian

Salvo el TTL, el checksum y la fragmentación, **el encaminamiento no modifica la cabecera**: las IP de origen y destino se mantienen en todo el camino. La excepción es NAT.

## 6. Protocolos de apoyo a IP

**[Visto, T3]**

- **ARP:** traduce una IP en una MAC. La petición se envía por difusión y la respuesta es unicast, con caché.
- **Las difusiones no atraviesan routers.**
- **DHCP:** da a un equipo su IP, máscara, puerta de enlace y DNS. El servidor «suele estar instalado en el router».
- **ICMP:** mensajes de error, que se envían al origen (por ejemplo, tiempo excedido o puerto inalcanzable), y de consulta, que van por pares (eco de petición y respuesta, `ping`). **ICMP va dentro de IP y no usa puertos.**
- **NAT/NAPT (Teoría, clase 15):** dentro de la organización se usan IP privadas. NAT básico cambia una IP por otra; NAPT (o PAT) enmascara toda una red tras una única IP pública cambiando también el **puerto de origen**, y apunta el cambio en una tabla de traducción. NAPT se explica ya en el T3, antes de ver puertos formalmente en el T4. La clase 15 tuvo una actividad de emparejar puertos con esa tabla. Los tipos y problemas de NAT son Adicional.

**Consecuencia (futuro):** NAT es el único caso en que un paquete **cambia de IP de origen** por el camino, lo que da lugar a pistas del tipo «su IP de origen ya no es privada», es decir, «ya ha pasado por el router NAT».

**Consecuencia (v0.4.5):** las formas de nombrar `privacy` y `label_privacy` («la red pública», «el servidor web de la red pública») solo exigen distinguir los rangos privados, así que son `T3.nat` aunque no haya NAT en el nivel. Cuestan 1, o 2 si hay que comprobar el rango 172.16.0.0/12. Las usa la categoría Direccionamiento, que por eso llega hasta `T3.nat`: el resumen de la asignatura recoge los rangos privados con el direccionamiento.

## 7. Transporte y puertos

**[Visto, T4]**

- Los puertos son números de 16 bits: bien conocidos (0–1023), registrados (1024–49151) y dinámicos o efímeros (49152–65535).
- **El servidor usa un puerto bien conocido y el cliente, un puerto efímero.**
- El socket es la tupla `<protocolo, IP, puerto>`.
- **UDP** no tiene conexión ni control de errores o de flujo. **TCP** es orientado a conexión (*three-way handshake*), con ventana deslizante y control de congestión. **QUIC** funciona sobre UDP, va cifrado y lo usa HTTP/3.

**Consecuencia:** el puerto de destino identifica el servicio. El puerto de origen de una petición es efímero y no da pistas sobre el protocolo. En las respuestas ocurre al revés.

## 8. Servicios y puertos según la asignatura

**[Visto, T5]** Tabla del Tema 5:

| Servicio | Puerto | Con TLS | Notas de la asignatura |
|---|---|---|---|
| ftp-data / ftp | 20/tcp, 21/tcp | 989, 990 | También FTPS, SFTP (sobre SSH) y TFTP (UDP). |
| ssh | 22/tcp | — | Acceso remoto seguro. |
| telnet | 23/tcp | 992 | Acceso remoto sin cifrar. |
| smtp | 25/tcp | 465 | Envío de correo entre servidores. |
| dns | 53/udp | — | «Hay versiones sobre TCP y QUIC». |
| dhcp | 67/udp | — | Visto en el T3. |
| http / https | 80/tcp, 443/tcp | 443 | HTTP/3 va sobre QUIC (UDP). |
| pop3 | 110/tcp | 995 | Recogida de correo. |
| imap | 143/tcp | 993 | Recogida de correo. |
| smb, nfs, webdav | — | — | **[Adicional]** Clase 21: compartición de ficheros «como si fueran carpetas». SMB en redes Windows, NFS en Linux/Unix, WebDAV sobre HTTP/HTTPS. **[Extra]** Puerto de SMB: 445/tcp. |
| rtsp | — | — | T6: control de streaming; los datos van por RTP/UDP, UDP o TCP. **[Extra]** Puerto estándar 554. |

**Cómo se refleja en `protocols.catalog`** (resuelto):

- Cada protocolo y cada puerto tiene un **nivel de conocimiento**: `basic` (teoría), `advanced` (en segundo plano: puertos seguros, FTP de datos, TFTP), `additional` (ampliación en clase: SMB) o `extra` (no visto: puertos de RTSP, TFTP y SMB). Este nivel cuenta en la dificultad (`difficulty.knowledge`).
- Se han añadido **telnet** (23) y **dhcp** (67/udp). DHCP lleva `sameNetworkOnly`, porque la petición se envía por difusión y no atraviesa routers, y no está activado por defecto.
- Cada protocolo indica su **origen** posible (`originNodes`): SMTP puede salir de un cliente o de un servidor de correo, POP3 e IMAP solo de un cliente, y DNS de un cliente o de un servidor DNS (resolución recursiva).
- **FTP y SMB** van al **servidor de ficheros** (servicio `storage`). La asignatura habla de «servidor FTP» o de compartición de ficheros, así que en los textos visibles se usa «servidor de ficheros» y no «almacenamiento».
- **RTSP (servidor multimedia)** se ve en el T6, así que un nivel que lo use requiere ese tema.

## 9. Tema mínimo de cada nivel

Cada concepto que aparece en un nivel (elemento del tablero, propiedad de un paquete o tipo de pista) se ve en un tema concreto. **El tema mínimo de un nivel es el mayor de los temas de todo lo que usa**, y conviene guardarlo en el propio nivel para poder ofrecer a cada alumno solo los niveles que puede jugar en el punto del curso en que está.

Como el tablero ya contiene redes con prefijo, routers y paquetes que los atraviesan, **cualquier nivel exige como mínimo el T3**. Los temas 1 y 2 aportan vocabulario y elementos que están dentro de una red (switches, puntos de acceso), pero no bastan por sí solos para jugar.

### Concepto → tema mínimo

El T3 se reparte en siete clases, así que un número de tema no basta: un nivel con TTL puede jugarse desde la clase 10, pero uno con tablas de encaminamiento necesita la clase 14. Por eso se propone identificar el requisito con un **bloque** (`T3.ip`, `T3.subredes`…) que corresponde a la clase en que se ve. Los bloques están ordenados, y el tema mínimo de un nivel es el bloque más avanzado de todo lo que usa.

| Bloque | Clase | Concepto del juego | Capa |
|---|---|---|---|
| `T3.dispositivos` | 9 | Red como conjunto de equipos unidos por switches o puentes; router que separa redes; adyacencia a nodos (cliente, servidor genérico o identificado por su etiqueta, como «servidor web», vocabulario del T1); switch y punto de acceso dentro de una red. | Red / Enlace |
| `T3.vlan` | 9 | VLAN. | Enlace |
| `T3.ip` | 10 | Dirección IP, prefijo como etiqueta de la red, TTL, routers atravesados, campo protocolo (como valor), ICMP, `ping` y `tracert`. | Red |
| `T3.fragmentacion` | 11 | MTU, fragmentación. | Red |
| `T3.subredes` | 12 | Máscara: pertenencia de una IP a una red, número de direcciones de una red y de direcciones asignables (2^(32−n) − 2), identificador y difusión, red «más grande» por prefijo; ARP y MAC del siguiente salto. | Red |
| `T3.vlsm` | 13 | VLSM, CIDR, DHCP. | Red |
| `T3.encaminamiento` | 14 | Tablas de encaminamiento, siguiente salto, ruta por defecto, ruta más corta. | Red |
| `T3.nat` | 15 | Direcciones privadas y públicas, NAT y NAPT (cambio de IP y de puerto de origen). | Red |
| `T4.udp` | 16 | Puertos (bien conocidos y efímeros), UDP, campo protocolo = 17. | Transporte |
| `T4.tcp` | 17–18 | TCP, campo protocolo = 6. | Transporte |
| `T5.dns` | 19 | DNS, Telnet/SSH, TLS. | Aplicación |
| `T5.web` | 20 | HTTP/HTTPS y servidor web como destino de un protocolo. | Aplicación |
| `T5.ficheros_correo` | 21 | FTP; SMTP, POP3, IMAP y servidor de correo como destino. SMB y NFS como [Adicional]. | Aplicación |
| `T6` | 22 | Multimedia (RTSP, RTP), CDN, P2P. | Aplicación |
| — | — | Cortafuegos: **[Extra]**, requiere aclaración; puede usarse desde `T3.dispositivos`. | Red |

Aunque la ruta y los routers atravesados se ven en la clase 10, algunas pistas de rutas (siguiente salto, «se dirige a la red X») solo se entienden del todo con las tablas de la clase 14. Cada subtipo de pista debe indicar su propio bloque.

### Consecuencias en los documentos del juego

Ya aplicadas:

- Cada **subtipo de pista** del [catálogo de reglas](netdoku_catalogo_reglas.md) indica su bloque mínimo y su nivel de conocimiento.
- Cada **protocolo** de `protocols.catalog` lleva su bloque (`topic`), y cada **tipo de nodo o servicio** tiene el suyo en el [documento de parámetros](netdoku_parametros_configuracion.md#bloque-y-conocimiento-de-cada-nodo).
- El **generador** recibe `level.minTopic` y `level.maxTopic` y descarta todo lo que sea de un bloque posterior a `maxTopic`.
- El **fichero de nivel** guarda lo que exige en el bloque `requirements` (`topic` y `knowledge`), para que el motor pueda filtrar o desbloquear niveles.

Con esta tabla, las **pistas** del nivel 001 solo requieren el bloque **`T3.dispositivos`**: pertenencia a una red con nombre y adyacencia a servidores identificados por su etiqueta. El prefijo aparece en el texto de C2 y C4, pero no hace falta entenderlo para resolver la pista. No usa ningún elemento [Extra]: el antiguo cortafuegos es ahora un servidor de correo y los servidores `storage` se presentan como «servidores de ficheros». Sus paquetes llevan protocolos (ssh, dns, https…), pero ninguna pista los usa. Si se mostraran al jugador, el nivel pasaría a requerir el T5.

## 10. Progresión de niveles sugerida

Sigue el orden de la asignatura:

1. **Redes, equipos, routers y paquetes** (T3): pertenencia a red y adyacencias.
2. **Prefijos y máscaras** (T3): «está en una red /24», «su destino es 10.0.3.7».
3. **Encaminamiento** (T3 y P2): routers atravesados, siguiente salto, TTL (v0.4). Las tablas de encaminamiento (clase 14: siguiente salto, puerta de enlace, ruta por defecto, coincidencia más larga) van en su propia categoría, **Tabla de enrutamiento** (v0.5).
4. **Switches y WiFi** (T2 y T3): están dentro de una red y no cuentan como salto.
5. **Transporte y puertos** (T4): TCP/UDP, puerto destino, campo protocolo.
6. **Protocolos y servicios** (T5): servidor destino de cada protocolo.
7. **Multimedia** (T6) y, en cualquier momento a partir del T3, NAT, VLAN y fragmentación.
