// Textos en español de Netdoku (idioma de referencia).
(function () {
  "use strict";

  // «y» pasa a «e» ante palabras que empiezan por el sonido «i» (Aulas e Investigación).
  const and = (next) => (/^h?[iíIÍ](?![aeiouáéó])/.test(next) ? "e" : "y");
  const plural = (n, one, many) => (n === 1 ? one : many);

  const NODES = {
    client: "equipo de usuario", server: "servidor", web: "servidor web", dns: "servidor DNS",
    mail: "servidor de correo", storage: "servidor de ficheros", multimedia: "servidor multimedia",
    dhcp: "servidor DHCP",
  };

  // Texto de una pista a partir de sus datos (tipo, parámetros y forma de nombrar
  // cada elemento). L da acceso al nivel: L.network(id), L.node(id), L.router(id),
  // L.nodeLabel(nodo).
  function clue(c, L) {
    const s = c.slots || {};
    const params = c.parameters || {};
    const p = c.packet;

    const net = (slot) => {
      const n = L.network(slot.ref);
      switch (slot.form) {
        case "prefix": return `la red ${n.prefix}`;
        case "size_rank": return slot.value === "most" ? "la red con más direcciones" : "la red con menos direcciones";
        case "ip_member": return `la red de la dirección ${slot.value}`;
        default: return `la red ${n.name} (${n.prefix})`;
      }
    };
    const node = (slot) => {
      const n = L.node(slot.ref);
      const label = L.nodeLabel(n);
      switch (slot.form) {
        case "label": return `al ${label}`;
        case "label_prefix": return `al ${label} de la red ${L.network(n.network).prefix}`;
        case "ip": return `al ${label} ${slot.value}`;
        default: return `al ${label} de la red ${L.network(n.network).name}`;
      }
    };
    const router = (slot) => {
      const nets = L.router(slot.ref).connectedNetworks.map((id) => L.network(id));
      if (slot.form === "interfaces") return `con las interfaces ${slot.value[0]} y ${slot.value[1]}`;
      const [a, b] = nets.map((n) => (slot.form === "networks_prefix" ? n.prefix : n.name));
      return `que une ${a} ${and(b)} ${b}`;
    };
    const length = (slot) => {
      const n = slot.ref;
      switch (slot.form) {
        case "address_count": return `una red de ${2 ** (32 - n)} direcciones`;
        case "mask": return `una red con máscara ${L.mask(n)}`;
        default: return `una red /${n}`;
      }
    };

    switch (c.type) {
      case "network.in_network":
        return `El paquete ${p} estaba en ${net(s.net || { ref: params.networkId })}.`;
      case "network.prefix_length":
        return `El paquete ${p} estaba en ${length(s.len || { ref: params.prefixLength })}.`;
      case "node.adjacent_to_node":
        if (params.nodeId) return `El paquete ${p} estaba junto ${node(s.node || { ref: params.nodeId })}.`;
        return `El paquete ${p} estaba junto a un ${params.service ? NODES[params.service] : NODES[params.nodeType]}.`;
      case "node.unique_adjacent_to_node":
        return `El paquete ${p} estaba junto ${node(s.node || { ref: params.nodeId })}, y ningún otro paquete lo estaba.`;
      case "router.adjacent_to_router":
        return `El paquete ${p} estaba junto al router ${router(s.router || { ref: params.routerId })}.`;
      case "spatial.in_row":
        return `El paquete ${p} estaba en la fila ${params.row}.`;
      case "spatial.in_column":
        return `El paquete ${p} estaba en la columna ${params.column}.`;
      default:
        return c.text;
    }
  }

  window.NetdokuI18n.register("es", {
    langName: "Español",
    tiers: { 1: "Muy fácil", 2: "Fácil", 3: "Media", 4: "Difícil", 5: "Muy difícil" },
    networks: {
      admin: "Administración", services: "Servicios", lab: "Laboratorio", dev: "Desarrollo",
      management: "Dirección", classrooms: "Aulas", library: "Biblioteca", guests: "Invitados",
      office: "Secretaría", research: "Investigación",
    },
    nodes: NODES,
    nodeText: { client: "PC", web: "Web", dns: "DNS", mail: "Correo", storage: "Ficheros", multimedia: "Media", dhcp: "DHCP" },
    clue,

    ui: {
      language: "Idioma",
      tagline: "Un juego de deducción para aprender redes de computadores",
      back: "Volver",
      toMenu: "Menú principal",
      menu: {
        howto: "Cómo se juega",
        play: "Jugar",
        stats: "Estadísticas",
        help: "Ayuda",
        about: "Sobre el juego",
      },
      loadError: "No se ha podido leer la lista de niveles. Sirve la carpeta con un servidor web (véase README.md).",
      levelLoadError: "No se ha podido cargar el nivel.",
      fileError: "El fichero no es un nivel JSON válido.",
      freePlay: "Nivel cargado desde un fichero: no cuenta para las estadísticas.",
    },

    game: {
      lives: "Vidas",
      anotherLevel: "Otro nivel de esta dificultad",
      categoryInfo: "Teoría y reglas de la categoría",
      helpTitle: "Ayuda",
      fullHelp: "Abrir la ayuda completa",
      networks: "Redes",
      cluesOfLevel: "Pistas de este nivel",
      board: "Tablero",
      modePlace: "Modo colocar",
      modeNote: "Modo anotar: las pulsaciones ponen o quitan notas",
      modeShortcut: "Atajo: tecla A",
      packet: "Paquete {id}",
      victim: "víctima",
      where: "fila {r}, columna {c}",
      hide: "▾ ocultar",
      showClues: ({ n }) => `▸ ${n} ${plural(n, "pista", "pistas")}`,
      noCluesVictim: "Sin pistas: se localiza por descarte.",
      noClues: "Sin pistas propias.",
      meta: ({ category, dots, tier, n }) => `${category} · Dificultad ${dots} ${tier} · ${n} ${plural(n, "pista", "pistas")}`,
      metaDetail: "lógica {logic}, lectura {reading}",
      title: "{category} · {tier}",
      objective: ({ victim }) => `Coloca los paquetes para descubrir al atacante. En cada fila y en cada columna hay como mucho un paquete. La víctima es el paquete ${victim}: en su red solo había otro paquete, el atacante.`,
      sizeNote: "Las casillas no indican el tamaño de una red: su tamaño es su número de direcciones.",
      routerName: ({ a, b }) => `Router de ${a} ${and(b)} ${b}`,
      resumed: "Se ha recuperado tu progreso en este nivel.",
      selectFirst: "Selecciona primero un paquete en el panel para anotarlo.",
      occupiedNode: "Esa casilla ya está ocupada por un equipo.",
      occupiedPacket: "Esa casilla ya está ocupada por el paquete {id}.",
      rowTaken: "En la fila {r} ya está el paquete {id}.",
      columnTaken: "En la columna {c} ya está el paquete {id}.",
      oneEach: "Solo puede haber un paquete por fila y por columna.",
      solved: "¡Nivel resuelto!",
      placedOk: "El paquete {id} está bien colocado.",
      wrongCell: "El paquete {id} no estaba en la fila {r}, columna {c}.",
      loseLife: "Pierdes una vida.",
      stars: ({ n, max }) => `${n} de ${max} estrellas`,
      perfect: "¡Perfecto: sin ningún fallo!",
      withErrors: ({ n }) => `Resuelto con ${n} ${plural(n, "fallo", "fallos")}. Sin fallos se consiguen las tres estrellas.`,
      best: ({ n }) => `Tu mejor resultado en esta dificultad: ${n} ${plural(n, "estrella", "estrellas")}.`,
      unlocked: "Has desbloqueado la dificultad siguiente.",
      attacker: ({ attacker, net, victim }) => `El atacante es el paquete ${attacker}: el único otro paquete en la red ${net}, donde estaba la víctima ${victim}.`,
      lost: "Te has quedado sin vidas. Prueba con otro nivel de esta dificultad.",
      newLevel: "Otro nivel",
      nextDifficulty: "Siguiente dificultad ›",
      backToCategory: "Volver a la categoría",
      confirmNew: "¿Empezar otro nivel? Se perderá lo que llevas en este.",
    },

    play: {
      title: "Jugar",
      intro: "Elige una categoría y una dificultad. Cada vez que juegas una dificultad sale un nivel distinto. Para abrir una dificultad hay que superar la anterior; las categorías están todas abiertas.",
      completed: "Completada",
      progress: ({ stars, max }) => `${stars} de ${max} estrellas`,
      locked: "Supera la dificultad anterior para desbloquearla",
      info: "Teoría y reglas",
      noLevels: "Todavía no hay niveles en esta dificultad.",
      inProgress: "En curso",
    },

    stats: {
      title: "Estadísticas",
      intro: "Mejor resultado en cada categoría y dificultad.",
      category: "Categoría",
      total: "Total",
      solved: ({ n }) => `Partidas resueltas: ${n}`,
    },

    info: {
      theory: "Teoría",
      newRules: "Reglas nuevas en esta categoría",
    },

    howto: {
      title: "Cómo se juega",
      intro: "Netdoku es un juego de deducción. El tablero es un conjunto de redes unidas por routers, y en él estaban varios paquetes. A partir de las pistas, descubre en qué casilla estaba cada uno y encontrarás al atacante.",
      basics: "Objetivo y forma de jugar",
      common: "Reglas comunes a todas las categorías",
      clues: "Algunas pistas que verás desde el principio",
      categories: "Lo que añade cada categoría",
      categoriesIntro: "Cada categoría corresponde a un bloque de la asignatura y añade pistas propias. Durante la partida, el botón «i» muestra la teoría y las reglas de la categoría.",
    },

    help: {
      title: "Ayuda",
      intro: "Todas las fichas de ayuda. Durante la partida, el panel de la izquierda muestra solo las que necesita cada nivel.",
      categories: { basic: "Cómo jugar", rules: "Reglas", clues: "Pistas", icons: "Iconos" },
      entries: {
        how_to_play: {
          chip: "Cómo jugar",
          title: "Cómo jugar",
          text: [
            "Colocar: arrastra un paquete a la casilla donde crees que está, o selecciónalo en el panel y pulsa la casilla. Si aciertas, queda fijo; si fallas, vuelve al panel y pierdes una de tus tres vidas.",
            "Anotar: activa el interruptor (o pulsa A), selecciona un paquete y pulsa las casillas donde podría estar. Aparece un circulito de su color; vuelve a pulsar para quitarlo.",
            "Descartar: clic derecho (o pulsación larga) marca una casilla con ✕ y borra sus notas. Pulsa una pista para tacharla cuando ya la hayas usado.",
            "Al resolver un nivel ganas tres estrellas menos una por fallo, y se guarda tu mejor resultado en esa dificultad. El botón ↺ empieza otro nivel de la misma dificultad. El progreso se guarda en este navegador.",
          ],
          caption: "A está colocado; B y C tienen notas; una casilla está descartada.",
        },
        objective: {
          chip: "Objetivo",
          title: "Objetivo: descubrir al atacante",
          text: [
            "La víctima estaba a solas con el atacante: en su red no hay ningún otro paquete.",
            "Coloca todos los paquetes en su casilla. Al colocar el último, el atacante queda al descubierto: es el otro paquete de la red de la víctima.",
          ],
          caption: "V es la víctima. El único otro paquete de su red es el atacante.",
        },
        row_column: {
          chip: "Fila y columna",
          title: "Un paquete por fila y por columna",
          text: [
            "En cada fila y en cada columna hay como mucho un paquete. Al colocar uno, el resto de su fila y de su columna queda descartado para los demás.",
            "Con tantos paquetes como filas, cada fila y cada columna tiene exactamente uno. Por eso el último paquete (la víctima) se deduce por descarte.",
          ],
          caption: "Con A en la fila 2 y la columna 3, ningún otro paquete puede ir en las casillas marcadas.",
        },
        adjacent: {
          chip: "«Junto a»",
          title: "Qué significa «junto a»",
          text: [
            "Junto a una casilla están las cuatro que comparten un lado con ella (arriba, abajo, izquierda y derecha) y que pertenecen a la misma red.",
            "Las diagonales no cuentan. Una casilla de otra red tampoco, aunque toque al equipo: el borde de red las separa.",
          ],
          caption: "Junto al servidor solo están las casillas con círculo. La de la derecha es de otra red.",
        },
        network_size: {
          chip: "Tamaño de una red",
          title: "Prefijos, máscaras y tamaño de una red",
          text: [
            "En un prefijo a.b.c.d/n, los n primeros bits identifican la red y el resto, los equipos. La red tiene 2^(32−n) direcciones: una /24 tiene 256; una /25, 128; una /26, 64; una /27, 32.",
            "Cuanto mayor es n, menos direcciones tiene la red. La máscara escribe lo mismo con n unos: /24 es 255.255.255.0; /25, 255.255.255.128; /26, 255.255.255.192; /27, 255.255.255.224.",
            "Las casillas no indican el tamaño de una red: una red con pocas casillas puede tener muchas direcciones.",
          ],
        },
        ip_network: {
          chip: "Red de una dirección",
          title: "A qué red pertenece una dirección",
          text: [
            "Una dirección pertenece a la red cuyos n primeros bits coinciden con los suyos, donde n es la longitud del prefijo de esa red. Las redes de un nivel nunca se solapan, así que solo hay una.",
            "Truco: cada red empieza en un múltiplo de su tamaño. Con 192.168.0.0/26, 192.168.0.64/26, 192.168.0.128/26 y 192.168.0.192/26, la dirección 192.168.0.130 está entre 128 y 191, así que es de 192.168.0.128/26.",
            "Cuidado con las direcciones cerca del límite entre dos redes (como .127 y .128): son las que más fallos dan.",
          ],
        },
        in_network: {
          chip: "En una red",
          title: "«Estaba en la red X»",
          text: [
            "El paquete está en alguna casilla libre de esa red. Las casillas con equipos nunca tienen paquetes.",
            "Cada red tiene su color, su nombre en el tablero y, en la leyenda, su prefijo (por ejemplo, 192.168.1.0/24).",
          ],
          caption: "«En la red verde»: cualquiera de las casillas con círculo.",
        },
        named_by_address: {
          chip: "Nombres con direcciones",
          title: "Redes, equipos y routers nombrados por su dirección",
          text: [
            "«La red 192.168.1.0/24» se nombra por su prefijo: búscalo en la leyenda. «La red con menos direcciones» es la de prefijo más largo.",
            "«La red de la dirección 192.168.1.37» obliga a calcular a qué red pertenece esa dirección.",
            "Las direcciones de los equipos no aparecen en el tablero. «Junto al servidor web 10.0.3.7» es el servidor web de la red de esa dirección.",
            "Un router tiene una dirección en cada red que une: «el router con las interfaces 10.0.1.1 y 10.0.2.1» es el que une las redes de esas dos direcciones.",
            "Las direcciones y las máscaras aparecen en las pistas sin el color de su red: averiguarla es parte de la pista.",
          ],
        },
        prefix_length: {
          chip: "Longitud de prefijo",
          title: "«Estaba en una red /26»",
          text: [
            "El paquete está en alguna de las redes con esa longitud de prefijo, que pueden ser varias. Míralo en la leyenda.",
            "La pista también puede dar el número de direcciones («una red de 64 direcciones») o la máscara («una red con máscara 255.255.255.192»): las tres formas dicen lo mismo.",
          ],
          caption: "Si la red de arriba a la izquierda y la de abajo a la derecha son las únicas /26, el paquete está en una de las casillas con círculo.",
        },
        adjacent_to_node: {
          chip: "Junto a un equipo",
          title: "«Estaba junto a…» un equipo",
          text: [
            "«Junto al servidor web»: en una casilla junto a ese equipo concreto. Si hay varios iguales, la pista dice de qué red es.",
            "«Junto a un servidor web»: junto a cualquiera de los servidores web del tablero. «Junto a un servidor»: junto a cualquier servidor.",
          ],
          caption: "«Junto a un servidor web»: cualquiera de las casillas con círculo.",
        },
        unique_adjacent: {
          chip: "Ningún otro junto a…",
          title: "«…y ningún otro paquete lo estaba»",
          text: [
            "«El paquete A estaba junto al servidor de correo, y ningún otro paquete lo estaba»: A está en una de las casillas junto a ese equipo.",
            "Las demás casillas junto a él quedan descartadas para todos los demás paquetes, también para la víctima, aunque todavía no sepas en cuál de ellas está A.",
          ],
          caption: "Ningún otro paquete puede ocupar las otras casillas junto al servidor de correo.",
        },
        router: {
          chip: "Junto a un router",
          title: "«Estaba junto al router que une X e Y»",
          text: [
            "Los routers están en el borde entre redes: son el punto de paso de una red a otra y pertenecen a todas las redes que unen.",
            "Junto a un router solo hay dos casillas: la que lo toca en cada una de las dos redes.",
          ],
          caption: "Junto al router solo están las dos casillas con círculo, una en cada red.",
        },
        spatial: {
          chip: "Fila o columna",
          title: "«Estaba en la fila N» o «en la columna N»",
          text: [
            "Las filas se cuentan de arriba abajo y las columnas de izquierda a derecha. Los números están en el margen del tablero.",
            "Junto con la regla de un paquete por fila y columna, una de estas pistas descarta esa fila o columna para todos los demás.",
          ],
          caption: "«En la fila 2»: cualquiera de las casillas libres de esa fila.",
        },
        icons: {
          chip: "Iconos",
          title: "Iconos del tablero",
          text: [
            "Monitor: equipo de usuario (cliente). Rack: servidor; la insignia indica el servicio: globo azul (web), «DNS» morado, sobre naranja (correo), carpeta verde (ficheros) y triángulo rojo (multimedia).",
            "Círculo azul con flechas sobre un borde: router. Los paquetes son los círculos de colores con una letra.",
          ],
          caption: "Cliente, servidores web, DNS, de correo y de ficheros, un router y un paquete.",
        },
      },
    },

    categories: {
      tablero: {
        name: "Tablero",
        short: "Redes, equipos y routers. Basta con leer el tablero.",
        theory: [
          "Una red es un conjunto de equipos que se comunican directamente a nivel de enlace, sin pasar por un router. Las redes están delimitadas por routers. En el tablero, cada zona de color es una red; en la leyenda aparece su prefijo (por ejemplo, 192.168.1.0/24), que la identifica.",
          "Los equipos (nodos) pueden ser terminales o intermedios. Los terminales (hosts) originan y reciben los datos; los intermedios, como los switches y los routers, solo los reenvían. Un switch une equipos dentro de una misma red: no la divide.",
          "La mayoría de los servicios siguen el modelo cliente/servidor: el cliente (el equipo de usuario) pide un servicio y el servidor lo ofrece. En el juego hay servidores web, DNS, de correo, de ficheros y multimedia.",
          "Un router separa redes y las une entre sí: tiene una interfaz, con su dirección IP, en cada red que conecta. Por eso en el tablero está en el borde entre dos redes y pertenece a las dos.",
          "Lo que viaja de una red a otra atravesando routers es un paquete, la unidad de datos del nivel de red.",
        ],
        rules: ["in_network", "adjacent_to_node", "unique_adjacent", "router", "spatial"],
      },
      direccionamiento: {
        name: "Direccionamiento",
        short: "Prefijos, máscaras y direcciones IP: calcula a qué red pertenece cada dirección.",
        theory: [
          "Una dirección IPv4 tiene 32 bits y se escribe como cuatro números decimales separados por puntos (192.168.1.37). Se divide en dos partes: la red y el equipo (host).",
          "El prefijo /n indica cuántos bits iniciales son de red. La máscara dice lo mismo con n unos seguidos: /24 es 255.255.255.0; /26, 255.255.255.192.",
          "Una red /n tiene 2^(32−n) direcciones. La primera es el identificador de red y la última, la dirección de difusión; las demás (2^(32−n) − 2) se asignan a los equipos y a las interfaces de los routers.",
          "Una dirección pertenece a una red si, al aplicarle la máscara (IP AND máscara), se obtiene el identificador de esa red.",
          "Un bloque de direcciones se reparte en subredes cuyo tamaño es una potencia de dos y que empiezan en un múltiplo de su tamaño. Con VLSM (máscara de longitud variable) las subredes pueden tener tamaños distintos.",
        ],
        rules: ["named_by_address", "network_size", "ip_network", "prefix_length"],
      },
    },

    about: {
      title: "Sobre el juego",
      paragraphs: [
        "Netdoku es un juego de deducción lógica inspirado en Murdoku. En lugar de habitaciones y sospechosos, el tablero tiene redes, equipos y routers, y hay que descubrir dónde estaba cada paquete para encontrar al atacante.",
        "Se ha creado para la asignatura Redes y Servicios de la Universidad de Málaga. Las categorías siguen el orden del temario: cada una corresponde a un bloque de la asignatura y se puede jugar en cuanto ese bloque se ha visto en clase.",
        "Su objetivo docente es practicar los conceptos de la asignatura usándolos para razonar, no solo memorizándolos. Cada pista obliga a interpretar un concepto: qué une un router, a qué red pertenece una dirección o cuántas direcciones tiene una red.",
        "La dificultad de cada nivel tiene dos componentes: la lógica (qué deducciones hacen falta) y la de lectura (qué cálculos hay que hacer para entender las pistas).",
        "Los niveles se generan automáticamente. Todos tienen una única solución, a la que se llega razonando, sin necesidad de adivinar.",
      ],
      license: "Código abierto con licencia MIT.",
    },

    theme: {
      label: "Tema",
      button: "Apariencia: crear o editar un tema",
      title: "Apariencia",
      savedTheme: "Tema guardado",
      custom: "Personalizado",
      close: "Cerrar",
      namePlaceholder: "Nombre del tema",
      save: "Guardar como tema",
      remove: "Eliminar tema",
      presetName: "Ese nombre es de un tema de serie; elige otro.",
      saved: "Guardado como «{name}».",
      needName: "Escribe un nombre para el tema.",
      removed: "Eliminado «{name}».",
      presets: { classic: "Clásico", textures: "Texturas", accessible: "Accesible", text: "Texto" },
      options: {
        mode: { label: "Modo", values: { auto: "Automático (según el sistema)", light: "Claro", dark: "Oscuro" } },
        palette: { label: "Colores de las redes", values: { pastel: "Pastel", vivid: "Intensos", colorblind: "Aptos para daltonismo", gray: "Grises" } },
        pattern: { label: "Fondo de las casillas", values: { plain: "Liso", dots: "Puntos", stripes: "Rayas", tiles: "Baldosas", perNetwork: "Una textura por red" } },
        icons: { label: "Equipos", values: { drawings: "Dibujos", text: "Texto (PC, Web, DNS…)", both: "Dibujos con texto" } },
      },
      toggles: { numbers: "Números de fila y columna", netNames: "Nombres de las redes en el tablero" },
    },
  });
})();
