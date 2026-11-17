// Textos en español de Netdoku (idioma de referencia).
(function () {
  "use strict";

  // «y» pasa a «e» ante palabras que empiezan por el sonido «i» (Aulas e Investigación).
  const and = (next) => (/^h?[iíIÍ](?![aeiouáéó])/.test(next) ? "e" : "y");
  const plural = (n, one, many) => (n === 1 ? one : many);
  // «Aulas y Servicios», «Aulas, Servicios e Investigación».
  const join = (names) => (names.length === 1 ? names[0]
    : `${names.slice(0, -1).join(", ")} ${and(names[names.length - 1])} ${names[names.length - 1]}`);
  // La única red pública o privada del nivel (formas privacy y label_privacy).
  const privacy = (v) => (v === "public" ? "pública" : "privada");

  const NODES = {
    client: "equipo de usuario", server: "servidor", web: "servidor web", dns: "servidor DNS",
    mail: "servidor de correo", storage: "servidor de ficheros", multimedia: "servidor multimedia",
    dhcp: "servidor DHCP",
  };
  const PLURAL = {
    client: "equipos de usuario", server: "servidores", web: "servidores web", dns: "servidores DNS",
    mail: "servidores de correo", storage: "servidores de ficheros", multimedia: "servidores multimedia",
    dhcp: "servidores DHCP",
  };
  const COUNT = { 2: "dos", 3: "tres" };
  // Clase de equipo de una pista o de una forma de nombrar ({nodeType, service}).
  const kind = (v) => v.service || v.nodeType;
  // «sin servidores», «con un solo servidor web», «con exactamente dos equipos de usuario».
  const countText = (v) => (v.count === 0 ? `sin ${PLURAL[kind(v)]}`
    : v.count === 1 ? `con un solo ${NODES[kind(v)]}`
      : `con exactamente ${COUNT[v.count] || v.count} ${PLURAL[kind(v)]}`);
  const lengthOf = (prefix) => Number(prefix.split("/")[1]);
  const NUM = { 1: "un", 2: "dos", 3: "tres", 4: "cuatro", 5: "cinco" };
  // «un router», «dos routers».
  const routers = (n) => `${NUM[n] || n} router${n === 1 ? "" : "s"}`;

  // Entrenar: «ningún router», «un router», «dos routers»; fila o columna; origen o destino.
  const routers0 = (n) => (n === 0 ? "ningún router" : routers(n));
  // «ha atravesado dos routers», «no habría atravesado ningún router».
  const crossed = (n, verb) => (n === 0 ? `no ${verb} atravesado ningún router` : `${verb} atravesado ${routers(n)}`);
  // «le quedan dos routers», «no le quedaría ningún router» (verb: [singular, plural]).
  const left = (n, [one, many]) => (n === 0 ? `no le ${one} ningún router` : `le ${n === 1 ? one : many} ${routers(n)}`);
  const axisWord = (axis) => (axis === "row" ? "fila" : "columna");
  const endWord = (end) => (end === "origin" ? "origen" : "destino");
  // «Aulas o Servicios», «Aulas, Servicios o Biblioteca».
  const orJoin = (names) => (names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} o ${names[names.length - 1]}`);
  // Qué dice la trama en cada pista de ruta vista desde la capa de enlace (forma mac_view).
  const MAC_FACTS = {
    "endpoint.in_origin_network": "Cada equipo que reenvía el paquete lo mete en una trama nueva con su propia MAC de origen. Si la trama la envió el propio equipo de origen, el paquete aún no ha pasado por ningún router: sigue en la red de origen.",
    "endpoint.in_destination_network": "Una trama solo puede ir dirigida directamente a un equipo de su misma red. Si va a su equipo de destino, el paquete ya está en la red de destino.",
    "route.last_router": "Cada router reenvía el paquete en una trama nueva con su propia MAC de origen: quien envió la trama es el último router que atravesó.",
    "route.next_router": "La trama va dirigida a la MAC del siguiente salto, que es el siguiente router de la ruta.",
    default: "La trama solo viaja dentro de una red: su MAC de origen es la del último equipo que reenvió el paquete y su MAC de destino, la del siguiente salto.",
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
      const size = 2 ** (32 - lengthOf(n.prefix));
      switch (slot.form) {
        case "prefix": return `la red ${n.prefix}`;
        case "contents": return `la red ${countText(slot.value)}`;
        case "size_rank": return slot.value === "most" ? "la red con más direcciones" : "la red con menos direcciones";
        case "address_count": return `la red de ${size} direcciones`;
        case "usable_count": return `la red con ${size - 2} direcciones asignables`;
        case "mask": return `la red con máscara ${L.mask(lengthOf(n.prefix))}`;
        case "first_host": return `la red cuya primera dirección asignable es ${slot.value}`;
        case "last_host": return `la red cuya última dirección asignable es ${slot.value}`;
        case "broadcast": return `la red cuya dirección de difusión es ${slot.value}`;
        case "ip_member": return `la red de la dirección ${slot.value}`;
        case "privacy": return `la red ${privacy(slot.value)}`;
        default: return `la red ${n.name} (${n.prefix})`;
      }
    };
    // Un equipo sin artículo («servidor web de la red Aulas»).
    const nodeName = (slot) => {
      const n = L.node(slot.ref);
      const label = L.nodeLabel(n);
      switch (slot.form) {
        case "label": return label;
        case "label_prefix": return `${label} de la red ${L.network(n.network).prefix}`;
        case "ip": return `${label} ${slot.value}`;
        case "label_privacy": return `${label} de la red ${privacy(slot.value)}`;
        default: return `${label} de la red ${L.network(n.network).name}`;
      }
    };
    const node = (slot) => `al ${nodeName(slot)}`;
    // Un router une de dos a cuatro redes.
    const router = (slot) => {
      const nets = L.router(slot.ref).connectedNetworks.map((id) => L.network(id));
      if (slot.form === "interfaces") return `con las interfaces ${join(slot.value)}`;
      if (slot.form === "privacy") return `de la red ${privacy(slot.value)}`;
      return `que une ${join(nets.map((n) => (slot.form === "networks_prefix" ? n.prefix : n.name)))}`;
    };
    // Una fila o columna: por su número o por un equipo o un router que está en ella.
    const line = (slot, axis) => {
      const word = axis === "row" ? "fila" : "columna";
      const v = slot.value || {};
      if (slot.form === "aligned_node") return `en la misma ${word} que el ${nodeName({ ref: v.node, form: v.form })}`;
      if (slot.form === "aligned_router") return `en la misma ${word} que el router ${router({ ref: v.router, form: v.form })}`;
      return `en la ${word} ${slot.ref}`;
    };
    const length = (slot) => {
      const n = slot.ref;
      switch (slot.form) {
        case "address_count": return `una red de ${2 ** (32 - n)} direcciones`;
        case "usable_count": return `una red con ${2 ** (32 - n) - 2} direcciones asignables`;
        case "mask": return `una red con máscara ${L.mask(n)}`;
        default: return `una red /${n}`;
      }
    };

    // Pistas de ruta y TTL: desde la trama (MAC) o con el TTL actual.
    const mac = s.view && s.view.form === "mac_view";
    const ttlValue = s.ttl && s.ttl.form === "ttl_value";
    const ttl0 = L.ttl(p);
    // Pistas entre dos paquetes: el segundo.
    const q = (c.packets || [])[1];

    switch (c.type) {
      case "endpoint.origin":
      case "endpoint.destination": {
        const slot = s.node || { ref: params.nodeId };
        const origin = c.type === "endpoint.origin";
        if (slot.form === "ip") return `La IP de ${origin ? "origen" : "destino"} del paquete ${p} era ${slot.value}.`;
        return origin ? `El paquete ${p} lo había enviado el ${nodeName(slot)}.` : `El paquete ${p} iba dirigido ${node(slot)}.`;
      }
      case "endpoint.origin_class":
        return `El paquete ${p} lo había enviado un ${NODES[kind(params)]}.`;
      case "endpoint.destination_class":
        return `El paquete ${p} iba dirigido a un ${NODES[kind(params)]}.`;
      case "route.first_router": {
        const r = router(s.router || { ref: params.routerId });
        return mac ? `Al salir de su equipo de origen, la trama que llevaba el paquete ${p} iba dirigida al router ${r}.`
          : `El primer router de la ruta del paquete ${p} era el router ${r}, la puerta de enlace de su equipo de origen.`;
      }
      case "route.final_router": {
        const r = router(s.router || { ref: params.routerId });
        return mac ? `En la red de su destino, el paquete ${p} llegaba en una trama enviada por el router ${r}.`
          : `El último router de la ruta del paquete ${p} era el router ${r}.`;
      }
      case "relation.same_network":
        return `Los paquetes ${p} y ${q} estaban en la misma red.`;
      case "relation.routers_between":
        return params.count === 1 ? `Las redes de los paquetes ${p} y ${q} eran vecinas: las unía un router.`
          : `Para ir de la red del paquete ${p} a la del paquete ${q} había que atravesar como mínimo ${routers(params.count)}.`;
      case "relation.more_addresses_network":
        return `El paquete ${p} estaba en una red con más direcciones que la del paquete ${q}.`;
      case "relation.more_routers_crossed":
        return `El paquete ${p} había atravesado más routers que el paquete ${q}.`;
      case "relation.higher_ttl":
        return `En ese momento, el paquete ${p} llevaba más TTL que el paquete ${q}.`;
      case "relation.closer_to_destination":
        return `Al paquete ${p} le quedaban menos routers que al paquete ${q} para llegar a la red de su destino.`;
      case "relation.same_origin":
        return `Los paquetes ${p} y ${q} habían salido de la misma red.`;
      case "relation.same_destination":
        return `Los paquetes ${p} y ${q} iban a la misma red.`;
      case "endpoint.in_origin_network":
        return mac ? `La trama que llevaba el paquete ${p} la había enviado su propio equipo de origen.`
          : `El paquete ${p} aún no había salido de la red de su origen.`;
      case "endpoint.in_destination_network":
        return mac ? `La trama que llevaba el paquete ${p} iba dirigida directamente a su equipo de destino.`
          : `El paquete ${p} ya había llegado a la red de su destino.`;
      case "route.in_transit_network":
        return `El paquete ${p} estaba pasando por una red de tránsito.`;
      case "route.last_router": {
        const r = router(s.router || { ref: params.routerId });
        return mac ? `La trama que llevaba el paquete ${p} la había enviado el router ${r}.`
          : `El último router que había atravesado el paquete ${p} era el router ${r}.`;
      }
      case "route.next_router": {
        const r = router(s.router || { ref: params.routerId });
        return mac ? `La trama que llevaba el paquete ${p} iba dirigida al router ${r}.`
          : `El siguiente router que iba a atravesar el paquete ${p} era el router ${r}.`;
      }
      case "ttl.routers_crossed": {
        const n = params.count;
        if (ttlValue) return `El paquete ${p} llevaba TTL ${ttl0 - n}.`;
        return n === 0 ? `El paquete ${p} no había atravesado ningún router.`
          : `El paquete ${p} había atravesado exactamente ${routers(n)}.`;
      }
      case "ttl.routers_left": {
        const n = params.count;
        return `Al paquete ${p} le ${n === 1 ? "quedaba" : "quedaban"} ${routers(n)} para llegar a la red de su destino.`;
      }
      case "ttl.routers_crossed_range": {
        if (params.min !== undefined) {
          const n = params.min;
          if (ttlValue) return n === 1 ? `El TTL del paquete ${p} ya era menor que el inicial.` : `El TTL del paquete ${p} era como mucho ${ttl0 - n}.`;
          return n === 1 ? `El paquete ${p} ya había atravesado algún router.` : `El paquete ${p} había atravesado al menos ${routers(n)}.`;
        }
        const n = params.max;
        if (ttlValue) return `El TTL del paquete ${p} era al menos ${ttl0 - n}.`;
        return `El paquete ${p} había atravesado como mucho ${routers(n)}.`;
      }
      case "network.in_network":
        return `El paquete ${p} estaba en ${net(s.net || { ref: params.networkId })}.`;
      case "network.prefix_length":
        return `El paquete ${p} estaba en ${length(s.len || { ref: params.prefixLength })}.`;
      case "network.not_in_network":
        return `El paquete ${p} no estaba en ${net(s.net || { ref: params.networkId })}.`;
      case "network.in_either_network":
        return `El paquete ${p} estaba en ${net(s.net1 || { ref: params.networkIds[0] })} o en ${net(s.net2 || { ref: params.networkIds[1] })}.`;
      case "network.node_count":
        return `El paquete ${p} estaba en una red ${countText(params)}.`;
      case "node.not_adjacent_to_node":
        if (params.nodeId) return `El paquete ${p} no estaba junto ${node(s.node || { ref: params.nodeId })}.`;
        return `El paquete ${p} no estaba junto a ningún ${NODES[kind(params)]}.`;
      case "node.adjacent_to_node":
        if (params.nodeId) return `El paquete ${p} estaba junto ${node(s.node || { ref: params.nodeId })}.`;
        return `El paquete ${p} estaba junto a un ${params.service ? NODES[params.service] : NODES[params.nodeType]}.`;
      case "node.unique_adjacent_to_node":
        return `El paquete ${p} estaba junto ${node(s.node || { ref: params.nodeId })}, y ningún otro paquete lo estaba.`;
      case "router.adjacent_to_router":
        return `El paquete ${p} estaba junto al router ${router(s.router || { ref: params.routerId })}.`;
      case "spatial.in_row":
        return `El paquete ${p} estaba ${line(s.row || { ref: params.row }, "row")}.`;
      case "spatial.in_column":
        return `El paquete ${p} estaba ${line(s.column || { ref: params.column }, "column")}.`;
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
      office: "Secretaría", research: "Investigación", backbone: "Troncal",
    },
    nodes: NODES,
    nodesPlural: PLURAL,
    nodeText: { client: "PC", web: "Web", dns: "DNS", mail: "Correo", storage: "Ficheros", multimedia: "Media", dhcp: "DHCP" },
    clue,

    ui: {
      language: "Idioma",
      tagline: "Un juego de deducción para aprender redes de computadores",
      hook: "Administras estas redes y alguien ha manipulado un paquete. ¿Descubrirás al atacante antes de que el ataque se extienda?",
      back: "Volver",
      toMenu: "Menú principal",
      menu: {
        howto: "Cómo se juega",
        play: "Jugar",
        stats: "Estadísticas",
        help: "Ayuda",
        about: "Sobre el juego",
        test: "Pruebas",
        train: "Entrenar",
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
      metaDetail: "lógica {logic}, interpretación {reading}",
      title: "{category} · {tier}",
      objective: ({ victim }) => `¡Alerta! Alguien ha manipulado el paquete ${victim}. En su red solo había otro paquete: el atacante. Usa las pistas para averiguar dónde estaba cada paquete (como mucho uno por fila y por columna) y desenmascáralo antes de que el ataque se extienda.`,
      sizeNote: "Las casillas no indican el tamaño de una red: su tamaño es su número de direcciones.",
      routeNote: "La ficha de cada paquete dice su origen, su destino y su TTL inicial: estaba en una red de su ruta a la que le llegaba el TTL.",
      hiddenNote: "Si la ficha no dice el origen o el destino de un paquete, hay que deducirlo con las pistas: cada red posible da una ruta distinta.",
      unknownEndpoint: "desconocido",
      origin: "Origen",
      destination: "Destino",
      ttlInitial: "TTL inicial",
      endpoint: ({ label, net }) => `${label} de ${net}`,
      broadcastTo: ({ address }) => `difusión (${address})`,
      originTag: "origen",
      destinationTag: "destino",
      routerName: ({ names }) => `Router de ${join(names)}`,
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
      result: ({ errors, hints }) => {
        const parts = [];
        if (errors) parts.push(`${errors} ${plural(errors, "fallo", "fallos")}`);
        if (hints) parts.push(`${hints} ${plural(hints, "sugerencia", "sugerencias")}`);
        return `Resuelto con ${parts.join(" y ")}. Sin fallos ni sugerencias se consiguen las tres estrellas.`;
      },
      best: ({ n }) => `Tu mejor resultado en esta dificultad: ${n} ${plural(n, "estrella", "estrellas")}.`,
      unlocked: "Has desbloqueado la dificultad siguiente.",
      attacker: ({ attacker, net, victim }) => `¡Atrapado! El atacante es el paquete ${attacker}: el único otro paquete en la red ${net}, donde estaba la víctima ${victim}.`,
      lost: "Te has quedado sin vidas y el atacante ha escapado. Prueba con otro nivel de esta dificultad.",
      newLevel: "Otro nivel",
      nextDifficulty: "Siguiente dificultad ›",
      backToCategory: "Volver a la categoría",
      confirmNew: "¿Empezar otro nivel? Se perderá lo que llevas en este.",
    },

    hint: {
      button: "Sugerencia",
      title: "Sugerencia",
      buttonTitle: "Pide una sugerencia: te explica la siguiente deducción que puedes hacer. Cuesta una vida.",
      noLives: "Con una sola vida no se pueden pedir sugerencias.",
      unsupported: "Este nivel no admite sugerencias.",
      ask: "Una sugerencia te explica la siguiente deducción que puedes hacer, sin decirte la casilla. Cuesta una vida (y, por tanto, una estrella). ¿La quieres?",
      yes: "Sí, a cambio de una vida",
      no: "Cancelar",
      close: "Cerrar la sugerencia",
      none: "No se ha encontrado ninguna deducción.",
      stepsNote: "Pulsa un paso para ver en el tablero las casillas de las que habla.",
      used: "Has usado una sugerencia y pierdes una vida.",
      mark: ({ r, c }) => `Revisa tus marcas: la ✕ de la fila ${r}, columna ${c} está mal, porque en esa casilla sí había un paquete.`,
      single: ({ packet }) => `Fíjate en el paquete ${packet}: con sus pistas y las filas y columnas que ya están ocupadas, solo le queda una casilla posible.`,
      singleAfter: ({ packet }) => `Con esto, al paquete ${packet} solo le queda una casilla posible.`,
      singleRoute: ({ packet }) => `Fíjate en el paquete ${packet}: con su ruta, su TTL, sus pistas y las filas y columnas que ya están ocupadas, solo le queda una casilla posible.`,
      lineRow: ({ packet, n }) => `En la fila ${n} tiene que haber un paquete y el único que puede ir en ella es ${packet}: ${packet} está en la fila ${n}.`,
      lineColumn: ({ packet, n }) => `En la columna ${n} tiene que haber un paquete y el único que puede ir en ella es ${packet}: ${packet} está en la columna ${n}.`,
      annul: ({ packet }) => `Una pista del paquete ${packet} dice que ningún otro paquete estaba junto a ese elemento: las casillas de alrededor (resaltadas) quedan descartadas para los demás.`,
      // «no pasa por Desarrollo», «no pasa ni por Aulas ni por Servicios».
      route: ({ packet, route, networks }) => {
        const where = networks.length === 1 ? `por ${networks[0]}` : `ni por ${networks.slice(0, -1).join(", ni por ")} ni por ${networks[networks.length - 1]}`;
        const path = route.length === 1 ? `El paquete ${packet} no sale de ${route[0]}`
          : `El paquete ${packet} va por el camino con menos routers: ${route.join(" → ")}`;
        return `${path}. Solo puede estar en una red de su ruta, y no pasa ${where}: las casillas resaltadas quedan descartadas para ${packet}.`;
      },
      // «no llega a Investigación», «no llega ni a Biblioteca ni a Servicios».
      ttl: ({ packet, ttl, networks }) => {
        const crossed = ttl <= 1 ? "no ha podido atravesar ningún router de su ruta"
          : `como mucho ha atravesado ${routers(ttl - 1)} de su ruta`;
        const where = networks.length === 1 ? `a ${networks[0]}` : `ni a ${networks.slice(0, -1).join(", ni a ")} ni a ${networks[networks.length - 1]}`;
        return `El TTL inicial del paquete ${packet} es ${ttl}. Cada router le resta 1, y el que lo deja a 0 lo descarta: ${crossed}, así que no llega ${where}. Las casillas resaltadas quedan descartadas para ${packet}.`;
      },
      relationFixed: ({ packet, other }) => `Una pista relaciona los paquetes ${packet} y ${other}. Con lo que ya sabes de ${other}, las casillas resaltadas no cumplen la pista: quedan descartadas para ${packet}.`,
      relationOpen: ({ packet, other }) => `Una pista relaciona los paquetes ${packet} y ${other}. Aunque ${other} aún tiene varias posibilidades, ninguna cumple la pista con ${packet} en las casillas resaltadas: quedan descartadas para ${packet}.`,
      relationEnds: ({ packet, other }) => `Una pista relaciona los paquetes ${packet} y ${other}. Con lo que ya sabes de ${other}, descarta alguna de las redes posibles del origen o del destino oculto de ${packet}.`,
      oneRow: ({ packet, n }) => `El paquete ${packet} solo puede estar en la fila ${n}: esa fila es suya, así que ningún otro paquete puede ir en ella.`,
      oneColumn: ({ packet, n }) => `El paquete ${packet} solo puede estar en la columna ${n}: esa columna es suya, así que ningún otro paquete puede ir en ella.`,
      subsetCells: ({ packets, n }) => `Los paquetes ${packets} solo pueden estar en estas ${n} casillas (resaltadas), una cada uno: ningún otro paquete puede ir en ellas.`,
      subsetRows: ({ packets, lines }) => `Los paquetes ${packets} solo pueden estar en las filas ${lines}, uno en cada una: ningún otro paquete puede ir en esas filas.`,
      subsetColumns: ({ packets, lines }) => `Los paquetes ${packets} solo pueden estar en las columnas ${lines}, uno en cada una: ningún otro paquete puede ir en esas columnas.`,
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

    // Vista temporal de pruebas.
    test: {
      title: "Pruebas",
      intro: "Niveles fijos de los lotes del juego para comprobar las reglas y los textos: cada subtipo de pista sale en al menos tres tableros, y cada forma de nombrar y cada plan de direcciones, en al menos uno. Juégalos, marca los que estén bien y pasa la lista de semillas. No cuentan para las estadísticas.",
      askKey: "Clave de la vista de pruebas:",
      wrongKey: "Clave incorrecta.",
      loadError: "No se ha podido leer la lista de niveles de prueba (levels/test.json).",
      count: ({ done, total }) => `Validados: ${done} de ${total}.`,
      copy: "Copiar",
      copied: "Semillas copiadas.",
      seed: "Semilla {seed}",
      detail: ({ logic, reading, clues }) => `Lógica ${logic}, interpretación ${reading} · ${clues} ${plural(clues, "pista", "pistas")}`,
      subtypes: "Subtipos",
      forms: "Formas",
      plan: "Plan",
      features: "Con",
      feature: {
        broadcast: "paquete de difusión",
        transit: "red de tránsito",
        shortTtl: "TTL que no llega al destino",
      },
      play: "Jugar",
      validated: "Validado",
      playing: "Nivel de prueba {seed}: no cuenta para las estadísticas.",
      gameTitle: "{category} · {tier} · semilla {seed}",
      mark: "Marcar como validado",
      unmark: "Quitar la marca de validado",
      back: "Volver a las pruebas",
    },

    // Entrenar: ejercicios de cada pista y cada regla (véase generator/netdoku_gen/training.py).
    // Los motivos (reasons) explican por qué una casilla no vale; los hechos (facts), cómo se
    // resuelve el paso. Reciben las redes, equipos y routers ya con su nombre.
    train: {
      title: "Entrenar",
      intro: "Ejercicios cortos para aprender cada pista y cada regla: un tablero pequeño con un paquete por decidir y, si hacen falta, otros ya colocados. Pulsa las casillas que pide el ejercicio; si eliges una que no vale, verás por qué. Los fallos no cuentan.",
      categories: { rules: "Reglas del juego", inicial: "Inicial", direccionamiento: "Direccionamiento", encaminamiento: "Encaminamiento" },
      categoryIntro: {
        rules: "Lo que vale en todos los niveles: como mucho un paquete por fila y por columna, y qué casillas están junto a un equipo.",
        inicial: "Las pistas de la categoría Inicial: redes, equipos, routers, filas y columnas.",
        direccionamiento: "Redes y equipos nombrados por sus direcciones: prefijos, máscaras, tamaños, direcciones especiales y redes privadas.",
        encaminamiento: "Rutas y TTL: por dónde pasa cada paquete, hasta dónde llega, las tramas de cada salto y los extremos ocultos.",
      },
      progress: ({ done, total }) => `✓ ${done}/${total}`,
      openHelp: "Ver la ficha de ayuda",
      practice: "Practicar",
      practiceTitle: "Ejercicios de esta ficha",
      empty: "Todavía no hay ejercicios.",
      loadError: "No se ha podido leer la lista de ejercicios (levels/train/index.json).",
      gameTitle: "Entrenar · {variant}",
      meta: "{category} · {variant}",
      objective: "Entrenamiento: no hay víctima ni vidas. Pulsa las casillas que pide el ejercicio; los fallos no cuentan.",
      task: "Ejercicio",
      stepOf: "Paso {n} de {total}",
      ask: {
        possible: "Pulsa las casillas donde puede estar el paquete {packet}.",
        impossible: "Pulsa las casillas donde no puede estar el paquete {packet}: se marcan con ✕.",
        annul: "Pulsa las casillas donde ya no puede ir ningún otro paquete: se marcan con ✕.",
      },
      given: "Los círculos discontinuos son las casillas posibles del paquete {packet}.",
      count: ({ n, total }) => `Llevas ${n} de ${total}.`,
      explanation: "Explicación",
      explain: "Ver explicación",
      reveal: "Ver solución",
      next: "Siguiente paso",
      stepDone: "¡Bien! Ya están todas.",
      finished: "¡Ejercicio completado!",
      extraOk: "También vale: esta casilla queda descartada, aunque no hacía falta marcarla.",
      extraNote: "Las casillas con borde discontinuo también quedan descartadas, aunque no hacía falta marcarlas: comparten fila o columna con todas las casillas posibles del paquete.",
      wrong: "Esa casilla no vale.",
      done: "Ejercicio completado.",
      doneRevealed: "Ejercicio terminado con la solución. Prueba otro para completarlo por tu cuenta.",
      another: "Otro ejercicio",
      nextVariant: "Siguiente de la lista",
      back: "Volver a la lista",
      variants: {
        "rules.row_column.annul": "Un paquete colocado: su fila y su columna",
        "rules.row_column.free": "Filas y columnas libres",
        "rules.row_column.last": "La última casilla libre",
        "rules.row_column.forced": "Fila o columna obligada",
        "rules.adjacent": "Junto a un equipo: el borde de la red",
        "inicial.in_network": "En una red",
        "inicial.not_in_network": "No en una red",
        "inicial.not_adjacent.node": "No junto a un equipo",
        "inicial.not_adjacent.class": "No junto a ningún equipo de una clase",
        "inicial.either": "En una red o en otra",
        "inicial.node_count": "En una red con tantos equipos",
        "inicial.contents": "La red con tantos equipos",
        "inicial.adjacent.node": "Junto a un equipo",
        "inicial.adjacent.service": "Junto a un servidor de un servicio",
        "inicial.adjacent.class": "Junto a un equipo de una clase",
        "inicial.unique_adjacent": "Junto a un equipo, y ningún otro paquete",
        "inicial.router": "Junto a un router",
        "inicial.row": "En una fila",
        "inicial.column": "En una columna",
        "inicial.aligned_node": "En la fila o columna de un equipo",
        "inicial.aligned_router": "En la fila o columna de un router",
        "inicial.same_network": "En la misma red que otro paquete",
        "inicial.routers_between": "Routers entre las redes de dos paquetes",
        "dir.prefix": "Una red por su prefijo",
        "dir.label_prefix": "Un equipo de la red con un prefijo",
        "dir.networks_prefix": "Un router por los prefijos que une",
        "dir.size_rank": "La red con más o menos direcciones",
        "dir.address_count": "La red de N direcciones",
        "dir.mask": "La red con una máscara",
        "dir.prefix_length": "En una red /N",
        "dir.length_count": "En una red de N direcciones",
        "dir.length_usable": "En una red con N direcciones asignables",
        "dir.length_mask": "En una red con una máscara",
        "dir.ip_member": "La red de una dirección",
        "dir.node_ip": "Un equipo por su IP",
        "dir.interfaces": "Un router por sus interfaces",
        "dir.first_host": "La primera dirección asignable",
        "dir.last_host": "La última dirección asignable",
        "dir.broadcast": "La dirección de difusión",
        "dir.usable_count": "La red con N direcciones asignables",
        "dir.privacy": "La red pública o privada",
        "dir.label_privacy": "Un equipo de la red pública o privada",
        "dir.more_addresses": "Una red con más direcciones que la de otro paquete",
        "enc.route": "La ruta de un paquete",
        "enc.short_ttl": "Un TTL que no llega al destino",
        "enc.broadcast": "Un paquete de difusión",
        "enc.in_origin": "Aún en la red de origen",
        "enc.in_destination": "Ya en la red de destino",
        "enc.in_transit": "En una red de tránsito",
        "enc.last_router": "El último router atravesado",
        "enc.next_router": "El siguiente router",
        "enc.mac_origin": "Trama enviada por el equipo de origen",
        "enc.mac_last": "Trama enviada por un router",
        "enc.mac_next": "Trama dirigida a un router",
        "enc.mac_destination": "Trama dirigida al equipo de destino",
        "enc.crossed": "Routers atravesados",
        "enc.ttl_value": "El TTL actual",
        "enc.left": "Routers que quedan",
        "enc.range_min": "Al menos N routers",
        "enc.range_max": "Como mucho N routers",
        "enc.range_ttl": "Un TTL como mucho o al menos",
        "enc.corner": "Un router en una esquina",
        "enc.hidden_origin": "Origen oculto: quién lo envió",
        "enc.hidden_class": "Destino oculto: a qué clase de equipo iba",
        "enc.first_router": "Origen oculto: el primer router",
        "enc.final_router": "Destino oculto: el último router",
        "enc.more_routers": "Más routers que otro paquete",
        "enc.higher_ttl": "Más TTL que otro paquete",
        "enc.closer": "Más cerca de su destino que otro paquete",
      },
      reasons: {
        rowTaken: ({ r, packet }) => `En la fila ${r} ya está el paquete ${packet}, y solo cabe un paquete por fila.`,
        columnTaken: ({ c, packet }) => `En la columna ${c} ya está el paquete ${packet}, y solo cabe un paquete por columna.`,
        notLine: ({ packet, r, c }) => `Esta casilla no está en la fila ${r} ni en la columna ${c} del paquete ${packet}: aquí sí podría ir otro paquete.`,
        forced: ({ packet, other, axis, line, otherLine }) => `El paquete ${other} solo puede ir en la ${axisWord(axis)} ${otherLine}, así que ${packet} tiene que ir en la otra ${axisWord(axis)} libre, la ${line}.`,
        canBe: ({ packet }) => `El paquete ${packet} sí puede estar en esta casilla.`,
        open: () => "Esta casilla no queda descartada: otro paquete aún podría ir aquí.",
        offRoute: ({ packet, net }) => `La red ${net} no está en la ruta del paquete ${packet}.`,
        noTtl: ({ packet, net, k, ttl }) => `Para llegar a ${net}, el paquete ${packet} tendría que atravesar ${routers0(k)}, y con TTL inicial ${ttl} solo puede atravesar ${routers0(ttl - 1)}: cada router le resta 1 y lo descarta si llega a 0.`,
        hiddenOff: ({ packet, net, end }) => `Esté donde esté su ${endWord(end)}, la ruta del paquete ${packet} no llega a ${net}.`,
        hiddenNo: ({ packet, net, end, tags }) => `Con la pista, la red de su ${endWord(end)} es ${orJoin(tags)}, y entonces la ruta del paquete ${packet} no llega a ${net}.`,
        notNext: ({ node, nodeNet }) => `Esta casilla no está junto al ${node} de ${nodeNet}.`,
        notNextBorder: ({ node, net }) => `Esta casilla toca al ${node}, pero es de otra red (${net}): junto a un equipo solo cuentan las casillas de su misma red.`,
        notNextClass: ({ cls }) => `Esta casilla no está junto a ningún ${cls}.`,
        next: ({ node, nodeNet }) => `Esta casilla está junto al ${node} de ${nodeNet}.`,
        nextClass: ({ cls, node, nodeNet }) => `Esta casilla está junto al ${node} de ${nodeNet}${cls === node ? "" : `, que es un ${cls}`}.`,
        notRouter: ({ router }) => `Esta casilla no toca al router que une ${join(router)}.`,
        row: ({ r }) => `Esta casilla está en la fila ${r}.`,
        column: ({ c }) => `Esta casilla está en la columna ${c}.`,
        net: ({ net, prefix }) => `Esta casilla es de la red ${net} (${prefix}).`,
        netCount: ({ net, clsKey, count }) => `Esta casilla es de ${net}, una red ${countText({ nodeType: clsKey, count })}.`,
        netLength: ({ net, prefix, len }) => `Esta casilla es de ${net} (${prefix}), una red /${len}.`,
        routeAt: ({ packet, net, k, ttl }) => `En ${net}, el paquete ${packet} ${crossed(k, "habría")} y llevaría TTL ${ttl}.`,
        routeLast: ({ packet, net, router }) => (router ? `En ${net}, el último router que habría atravesado el paquete ${packet} sería el que une ${join(router)}.`
          : `En ${net}, el paquete ${packet} aún no habría atravesado ningún router.`),
        routeNext: ({ packet, net, router }) => (router ? `En ${net}, el siguiente router del paquete ${packet} sería el que une ${join(router)}.`
          : `En ${net}, el paquete ${packet} ya habría llegado a la red de su destino: no le quedaría ningún router.`),
        routeLeft: ({ packet, net, left: n }) => `En ${net}, al paquete ${packet} ${left(n, ["quedaría", "quedarían"])} para llegar a la red de su destino.`,
        relNet: ({ packet, other, net, otherNet }) => `Aquí el paquete ${packet} estaría en ${net}, y ${other} está en ${otherNet}.`,
        relDistance: ({ packet, other, net, otherNet, d }) => (d === 0 ? `Aquí el paquete ${packet} estaría en ${net}, la misma red que ${other}.`
          : `De ${net} a ${otherNet}, la red del paquete ${other}, hay que atravesar como mínimo ${routers(d)}.`),
        relSize: ({ packet, other, net, size, otherNet, otherSize }) => (net === otherNet ? `Aquí el paquete ${packet} estaría en ${net}, la misma red que ${other} (${size} direcciones).`
          : `Aquí el paquete ${packet} estaría en ${net}, de ${size} direcciones, y la red del paquete ${other}, ${otherNet}, tiene ${otherSize}.`),
        relCrossed: ({ packet, other, k, otherK }) => `Aquí el paquete ${packet} ${crossed(k, "habría")}, y ${other} ${crossed(otherK, "ha")}.`,
        relTtl: ({ packet, other, ttl, otherTtl }) => `Aquí el paquete ${packet} llevaría TTL ${ttl}, y ${other} lleva TTL ${otherTtl}.`,
        relLeft: ({ packet, other, l, otherL }) => `Aquí al paquete ${packet} ${left(l, ["quedaría", "quedarían"])}, y a ${other} ${left(otherL, ["queda", "quedan"])}.`,
      },
      facts: {
        route: ({ packet, route, ttl, reach, full }) => `Ruta del paquete ${packet}: ${route.join(" → ")}. Con TTL inicial ${ttl} puede atravesar ${routers0(ttl - 1)}: ${full ? "llega a la red de su destino" : `solo llega hasta ${reach}`}.`,
        broadcastRoute: ({ packet, net, address }) => `El paquete ${packet} va a la dirección de difusión ${address}: no sale de ${net}, porque los routers no reenvían la difusión.`,
        hiddenAlt: ({ end, net, route, reach, full }) => `Si su ${endWord(end)} estaba en ${net}: ruta ${route.join(" → ")}; ${full ? "llega a la red de su destino" : `con su TTL solo llega hasta ${reach}`}.`,
        nets: ({ packet, nets }) => `Así que el paquete ${packet} puede estar en cualquier casilla libre de ${join(nets)}.`,
        lines: ({ packet, other, r, c }) => `Además, ${packet} no puede ir en la fila ${r} ni en la columna ${c}, que son del paquete ${other}.`,
        adjacentRule: () => "Junto a un equipo: las casillas que tocan la suya por un lado (no en diagonal) y son de su misma red.",
        routerRule: ({ router, corner }) => `El router que une ${join(router)} está entre ${corner ? "cuatro casillas (en una esquina)" : "dos casillas"}: estar junto a él es estar en una de ellas.`,
        transit: ({ net }) => `La red de tránsito es ${net}: no tiene equipos, solo une routers.`,
        endpointNode: ({ packet, end, node, nodeNet }) => `El ${endWord(end)} del paquete ${packet} era el ${node} de ${nodeNet}: su ruta ${end === "origin" ? "empieza" : "termina"} en ${nodeNet}.`,
        endpointClass: ({ packet, end, cls, nets }) => `El ${endWord(end)} del paquete ${packet} era un ${cls}: su red es ${orJoin(nets)}.`,
        endRouter: ({ end, router, tags }) => `El ${end === "origin" ? "primer" : "último"} router de la ruta es el que une ${join(router)} solo si el ${endWord(end)} está en ${orJoin(tags)}.`,
        pNet: ({ other, net }) => `El paquete ${other} está en ${net}.`,
        pDistance: ({ other, net, d }) => `El paquete ${other} está en ${net}: la otra red tiene que estar a ${routers0(d)} de ella, como mínimo.`,
        pSize: ({ other, net, size, prefix }) => `El paquete ${other} está en ${net} (${prefix}), que tiene ${size} direcciones.`,
        pCrossed: ({ other, k }) => `El paquete ${other} ${crossed(k, "ha")}.`,
        pTtl: ({ other, ttl0, k, ttl }) => `El paquete ${other} salió con TTL ${ttl0} y ${crossed(k, "ha")}: ahora lleva TTL ${ttl}.`,
        pLeft: ({ other, left: n }) => `Al paquete ${other} ${left(n, ["queda", "quedan"])} para llegar a la red de su destino.`,
        relAt: ({ other, otherNet, d, nets }) => `Redes a ${routers(d)} de ${otherNet}, la del paquete ${other}: ${join(nets)}.`,
        relValues: ({ packet, what, nets, values }) => {
          const pairs = nets.map((n, i) => `${n}, ${values[i]}`).join("; ");
          if (what === "size") return `Direcciones de cada red: ${pairs}.`;
          if (what === "crossed") return `Routers que habría atravesado el paquete ${packet} en cada red de su ruta: ${pairs}.`;
          if (what === "ttl") return `TTL que llevaría el paquete ${packet} en cada red de su ruta: ${pairs}.`;
          return `Routers que le quedarían al paquete ${packet} en cada red de su ruta: ${pairs}.`;
        },
        annulUnique: ({ node, nodeNet }) => `«Ningún otro paquete lo estaba»: ningún otro paquete puede ocupar una casilla junto al ${node} de ${nodeNet}.`,
        annulLine: ({ packet, axis, line }) => `Todas las casillas posibles del paquete ${packet} están en la ${axisWord(axis)} ${line}: esa ${axisWord(axis)} será suya, y ningún otro paquete puede ir en ella.`,
        rowColumn: ({ packet, r, c }) => `Como mucho hay un paquete en cada fila y en cada columna: con ${packet} en la fila ${r} y la columna ${c}, ningún otro paquete puede ir en ellas.`,
        freeLines: ({ packet, rows, cols }) => `Filas libres: ${join(rows.map(String))}. Columnas libres: ${join(cols.map(String))}. El paquete ${packet} tiene que ir en una casilla libre donde se crucen.`,
        forcedLine: ({ packet, other, axis, line, otherLine }) => `Quedan dos ${axisWord(axis)}s libres para dos paquetes. Por su pista, ${other} solo puede ir en la ${axisWord(axis)} ${otherLine}, así que la ${axisWord(axis)} ${line} es para ${packet}.`,
        fPrefix: ({ prefix, net }) => `La red ${prefix} es ${net}.`,
        fSizeRank: ({ value, net, prefix, size }) => `La red con ${value === "most" ? "más" : "menos"} direcciones es ${net} (${prefix}: ${size} direcciones). El tamaño sale del prefijo, 2^(32 − longitud), no del número de casillas.`,
        fAddressCount: ({ net, prefix, len, size }) => `Una red /${len} tiene 2^(32 − ${len}) = ${size} direcciones: es ${net} (${prefix}).`,
        fUsableCount: ({ net, prefix, len, size }) => `Una red /${len} tiene ${size} direcciones; sin la del identificador y la de difusión quedan ${size - 2} asignables: es ${net} (${prefix}).`,
        fMask: ({ net, prefix, len, mask }) => `La máscara ${mask} tiene ${len} bits a 1: es la red /${len}, ${net} (${prefix}).`,
        fPrivacy: ({ value, net, prefix }) => `${net} (${prefix}) es la única red ${privacy(value)}. Las privadas son las de 10.0.0.0/8, 172.16.0.0/12 y 192.168.0.0/16.`,
        fContents: ({ net, clsKey, count }) => `${net} es la única red ${countText({ nodeType: clsKey, count })}.`,
        fFirstHost: ({ address, net, prefix, id, broadcast }) => `La red ${prefix} va de ${id} (identificador) a ${broadcast} (difusión); su primera dirección asignable, ${address}, es la siguiente al identificador. Es ${net}.`,
        fLastHost: ({ address, net, prefix, id, broadcast }) => `La red ${prefix} va de ${id} (identificador) a ${broadcast} (difusión); su última dirección asignable, ${address}, es la anterior a la de difusión. Es ${net}.`,
        fBroadcast: ({ address, net, prefix, id }) => `La dirección de difusión es la última de la red: ${address} es la de ${prefix} (de ${id} a ${address}), ${net}.`,
        fIpMember: ({ address, net, prefix, id, broadcast }) => `${address} está entre ${id} y ${broadcast}: pertenece a ${prefix}, que es ${net}.`,
        fNodePrefix: ({ prefix, net }) => `La red ${prefix} es ${net}.`,
        fNodeIp: ({ address, net, prefix, node, id, broadcast }) => `${address} está entre ${id} y ${broadcast}: pertenece a ${prefix} (${net}), así que es el ${node} de esa red.`,
        fNodePrivacy: ({ value, net, prefix }) => `${net} (${prefix}) es la única red ${privacy(value)}. Las privadas son las de 10.0.0.0/8, 172.16.0.0/12 y 192.168.0.0/16.`,
        fRouterPrefixes: ({ prefixes, nets }) => `${join(prefixes)} son ${join(nets)}.`,
        fRouterIps: ({ addresses, prefixes, nets }) => `Las interfaces ${join(addresses)} pertenecen a ${join(prefixes)}: el router une ${join(nets)}.`,
        fRouterPrivacy: ({ net, prefix, value }) => `${net} (${prefix}) es la única red ${privacy(value)}, y solo tiene un router.`,
        fLength: ({ len, size, mask, nets }) => `/${len}: máscara ${mask}, ${size} direcciones (${size - 2} asignables). Redes /${len}: ${join(nets)}.`,
        fAligned: ({ axis, line, node, nodeNet, router }) => (node ? `El ${node} de ${nodeNet} está en la ${axisWord(axis)} ${line}.`
          : `El router que une ${join(router)} está en la ${axisWord(axis)} ${line}.`),
        fMac: ({ type }) => MAC_FACTS[type] || MAC_FACTS.default,
        fTtlValue: ({ packet, ttl0, ttl, k }) => `El paquete ${packet} salió con TTL ${ttl0} y lleva TTL ${ttl}: ha atravesado ${ttl0} − ${ttl} = ${k} ${plural(k, "router", "routers")}.`,
        fTtlMax: ({ ttl0, bound, k }) => `Con TTL inicial ${ttl0}, un TTL de ${bound} como mucho quiere decir que ha atravesado al menos ${ttl0} − ${bound} = ${k} ${plural(k, "router", "routers")}.`,
        fTtlMin: ({ ttl0, bound, k }) => `Con TTL inicial ${ttl0}, un TTL de al menos ${bound} quiere decir que ha atravesado como mucho ${ttl0} − ${bound} = ${k} ${plural(k, "router", "routers")}.`,
      },
    },

    howto: {
      title: "Cómo se juega",
      intro: "Administras un conjunto de redes unidas por routers y tus sistemas acaban de dar la alarma: alguien ha manipulado un paquete. Es la **víctima**, y en su red solo había otro paquete: el **atacante**. No sabes dónde estaba cada paquete, pero los registros te dan pistas. Reconstruye la posición de todos y descubre de dónde salió el ataque antes de que se extienda. ¿Serás capaz?",
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
            "Sugerencia: si te atascas, el botón Sugerencia te explica la siguiente deducción que puedes hacer (o te avisa si alguna ✕ está mal), sin decirte la casilla. Cuesta una vida, así que no se puede pedir con la última.",
            "Al resolver un nivel ganas tres estrellas menos una por fallo o sugerencia, y se guarda tu mejor resultado en esa dificultad. El botón ↺ empieza otro nivel de la misma dificultad. El progreso se guarda en este navegador.",
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
        special_addresses: {
          chip: "Difusión y asignables",
          title: "Identificador, difusión y direcciones asignables",
          text: [
            "La primera dirección de una red es su identificador (la que aparece en el prefijo) y la última, la de difusión, que sirve para enviar a todos los equipos de la red. Ninguna de las dos se asigna a un equipo.",
            "Las demás, 2^(32−n) − 2, son asignables: a los equipos y a las interfaces de los routers. Una /26 tiene 64 direcciones y 62 asignables.",
            "La difusión es el identificador más el número de direcciones menos 1: en 192.168.1.64/26, 64 + 64 − 1 = 127, así que la difusión es 192.168.1.127. La primera asignable es la siguiente al identificador (192.168.1.65) y la última, la anterior a la difusión (192.168.1.126).",
            "Así, «la red cuya primera dirección asignable es 192.168.1.65» es la del identificador 192.168.1.64: búscala en la leyenda.",
          ],
        },
        privacy: {
          chip: "Privadas y públicas",
          title: "Redes privadas y públicas",
          text: [
            "Hay tres bloques de direcciones privadas: 10.0.0.0/8 (todas las que empiezan por 10), 172.16.0.0/12 (de 172.16.0.0 a 172.31.255.255) y 192.168.0.0/16 (todas las que empiezan por 192.168). Las demás direcciones de los niveles son públicas.",
            "«La red pública» es la única red del nivel con un prefijo público, y «la red privada», la única con un prefijo privado: míralo en la leyenda. «El servidor web de la red pública» es el servidor web de esa red, y «el router de la red pública», su único router.",
            "Cuidado con 172: 172.20.0.0/16 es privada, pero 172.15.0.0/16 y 172.32.0.0/16 son públicas.",
            "Las direcciones privadas se usan en redes internas, como la de tu casa o la de una empresa. Para salir a Internet, el router traduce la dirección privada a una pública (NAT).",
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
        negative: {
          chip: "«No estaba…»",
          title: "«No estaba en…» y «no estaba junto a…»",
          text: [
            "«No estaba en la red X»: el paquete está en cualquier casilla libre de las demás redes.",
            "«No estaba junto al servidor web»: ninguna de las casillas junto a ese equipo. «No estaba junto a ningún servidor»: ninguna casilla junto a un servidor, sea del tipo que sea.",
            "Estas pistas no dicen dónde está el paquete, sino dónde no: suelen servir al final, cuando ya quedan pocas casillas.",
          ],
          caption: "«No estaba en la red de la derecha»: cualquiera de las casillas con círculo.",
        },
        either: {
          chip: "Una red u otra",
          title: "«Estaba en la red X o en la red Y»",
          text: [
            "El paquete está en una de las dos redes, sin decir cuál: cualquier casilla libre de las dos vale.",
            "Las redes van en un orden fijo, así que la verdadera puede ser la primera o la segunda.",
          ],
          caption: "«En la red de arriba a la izquierda o en la de abajo a la derecha»: cualquiera de las casillas con círculo.",
        },
        node_count: {
          chip: "Recuento de equipos",
          title: "«Estaba en una red sin servidores»",
          text: [
            "Cuenta los equipos de cada red. «Una red sin servidores» es cualquier red que no tenga ninguno; «una red con un solo servidor web», cualquiera que tenga exactamente uno. El número es exacto.",
            "Si solo una red cumple la descripción, la pista la nombra así: «la red con exactamente dos equipos de usuario».",
            "«Servidores» incluye todos los servidores, sea cual sea su servicio.",
          ],
          caption: "«En una red sin servidores»: las dos redes de abajo solo tienen equipos de usuario.",
        },
        prefix_length: {
          chip: "Longitud de prefijo",
          title: "«Estaba en una red /26»",
          text: [
            "El paquete está en alguna de las redes con esa longitud de prefijo, que pueden ser varias. Míralo en la leyenda.",
            "La pista también puede dar el número de direcciones («una red de 64 direcciones»), el de direcciones asignables («una red con 62 direcciones asignables») o la máscara («una red con máscara 255.255.255.192»): todas dicen lo mismo.",
            "Si la longitud solo la tiene una red, la pista nombra esa red: «la red de 64 direcciones».",
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
            "Junto a un router en un borde solo hay dos casillas: la que lo toca en cada una de las dos redes.",
          ],
          caption: "Junto al router solo están las dos casillas con círculo, una en cada red.",
        },
        corner_router: {
          chip: "Router en una esquina",
          title: "Routers que unen tres o cuatro redes",
          text: [
            "Un router puede unir tres o cuatro redes: tiene una interfaz, con su dirección, en cada una. En el tablero está en la esquina donde se juntan esas redes.",
            "Junto a un router en una esquina están las cuatro casillas que tocan esa esquina (salvo las que tienen un equipo).",
            "Un router en una esquina no está en una sola fila ni en una sola columna, así que las pistas de fila y columna nunca lo usan.",
          ],
          caption: "El router une las tres redes; junto a él están las cuatro casillas con círculo.",
        },
        spatial: {
          chip: "Fila o columna",
          title: "«Estaba en la fila N» o «en la misma fila que…»",
          text: [
            "Las filas se cuentan de arriba abajo y las columnas de izquierda a derecha. Los números están en el margen del tablero.",
            "«En la misma fila que el servidor DNS»: en la fila de ese equipo, en cualquier red. Un router está en una fila si está en el borde entre dos casillas de esa fila, y en una columna si está en el borde entre dos casillas de esa columna.",
            "Junto con la regla de un paquete por fila y columna, una de estas pistas descarta esa fila o columna para todos los demás.",
          ],
          caption: "«En la misma fila que el servidor DNS»: cualquiera de las casillas libres de la fila 2.",
        },
        relation: {
          chip: "Entre dos paquetes",
          title: "Pistas entre dos paquetes",
          text: [
            "Algunas pistas hablan de dos paquetes a la vez y aparecen en la ficha de los dos. «Los paquetes A y B estaban en la misma red»: cuando sepas en qué red está uno, el otro está en esa misma red.",
            "«Las redes de los paquetes A y B eran vecinas: las unía un router»: están en dos redes distintas unidas por un router. «Para ir de la red de A a la de B había que atravesar como mínimo dos routers»: cuenta los routers del camino más corto entre las dos redes.",
            "«El paquete A estaba en una red con más direcciones que la del paquete B» compara el tamaño de las dos redes: su número de direcciones, no sus casillas.",
            "Estas pistas descartan casillas aunque ninguno de los dos esté colocado: si B solo puede estar en redes grandes, A no puede estar en la más pequeña.",
          ],
          caption: "«A y B estaban en la misma red»: con A colocado, B está en una de las casillas con círculo, fuera de la fila y la columna de A.",
        },
        route_trace: {
          chip: "Rutas",
          title: "Origen, destino y ruta de un paquete",
          text: [
            "En esta categoría, la ficha de cada paquete dice su origen, su destino y su TTL inicial. Pasa el ratón por la ficha (o selecciona el paquete) para ver en el tablero su equipo de origen y el de destino.",
            "La ruta del paquete es el camino más corto, con menos routers, entre la red de su origen y la de su destino. En todos los niveles ese camino es único: síguelo de router en router.",
            "El paquete estaba en alguna casilla libre de una red de su ruta: la de su origen, la de su destino o una intermedia, siempre que le llegue el TTL para alcanzarla (véase la ficha del TTL).",
            "Una red de tránsito (Troncal) no tiene equipos: solo une routers. Los paquetes pueden pasar por ella, pero nunca empiezan ni acaban en ella.",
            "Si el destino es la difusión de su red, el paquete va a todos los equipos de esa red y ningún router lo reenvía: sigue en la red de su origen.",
          ],
          caption: "Del equipo de usuario de la izquierda al servidor web de la derecha con TTL inicial 2: solo le llega para atravesar un router, así que está en una de las casillas con círculo.",
        },
        ttl: {
          chip: "TTL",
          title: "TTL: tiempo de vida",
          text: [
            "Cada paquete sale de su origen con un TTL inicial (en el juego, entre 2 y 6). Cada router que atraviesa le resta 1; los switches y los puntos de acceso no lo cambian.",
            "TTL actual = TTL inicial − routers atravesados. Un paquete con TTL 1 aún está vivo, pero el siguiente router lo dejará a 0, lo descartará y avisará al origen con un mensaje ICMP.",
            "Por eso un paquete con TTL inicial 3 solo puede haber atravesado 0, 1 o 2 routers, aunque su ruta tenga más: si no le llega, nunca alcanzará su destino.",
          ],
        },
        frames: {
          chip: "Tramas y MAC",
          title: "La trama que lleva un paquete",
          text: [
            "Dentro de cada red, el paquete viaja en una trama de la capa de enlace, que va de un equipo o router al siguiente de esa misma red. Cada uno se identifica por su dirección MAC.",
            "Las direcciones IP de origen y destino del paquete no cambian en todo el camino. Las MAC de la trama cambian en cada red: la envía el equipo o router anterior y va dirigida al siguiente salto.",
            "Así, «la trama la había enviado su propio equipo de origen» quiere decir que el paquete aún no había salido de la red de su origen; «la trama iba dirigida al router X», que el siguiente router de su ruta era X; «la trama la había enviado el router X», que el último router que había atravesado era X; y «la trama iba dirigida directamente a su equipo de destino», que ya estaba en la red de su destino.",
          ],
        },
        hidden_endpoint: {
          chip: "Origen o destino oculto",
          title: "Origen o destino desconocido",
          text: [
            "En algunos niveles, la ficha de un paquete no dice su origen o su destino: pone «desconocido». Hay que deducirlo con las pistas, y cada red posible da una ruta distinta y, por tanto, casillas distintas.",
            "«El paquete A lo había enviado el servidor web de la red Aulas» o «La IP de origen del paquete A era 10.0.1.7» dicen cuál es el equipo; «lo había enviado un servidor DNS», solo su clase: cualquiera de los servidores DNS del tablero.",
            "«El primer router de la ruta del paquete A era el router X, la puerta de enlace de su equipo de origen»: el origen está en una de las redes que une X, y la ruta sale de ella por X. «El último router de su ruta era X»: el destino está en una red que une X, y la ruta llega a ella por X.",
            "Al resolver el nivel, la ficha muestra el equipo que faltaba.",
          ],
        },
        route_position: {
          chip: "Origen, destino o tránsito",
          title: "«Aún no había salido de la red de su origen»",
          text: [
            "«Aún no había salido de la red de su origen»: el paquete está en la red de su equipo de origen; no ha atravesado ningún router.",
            "«Ya había llegado a la red de su destino»: está en la red de su equipo de destino.",
            "«Estaba pasando por una red de tránsito»: está en la red sin equipos de su ruta.",
          ],
          caption: "«Aún no había salido de la red de su origen»: cualquiera de las casillas con círculo.",
        },
        route_router: {
          chip: "Último o siguiente router",
          title: "«El último router que había atravesado…»",
          text: [
            "«El último router que había atravesado era el router que une X e Y»: el paquete acababa de pasar ese router, así que está en la red de las dos hacia la que iba. Hay que saber en qué sentido va.",
            "«El siguiente router que iba a atravesar era…»: está en la red de las dos de la que venía. Vale aunque el TTL no le llegue para atravesarlo.",
          ],
          caption: "«El último router que había atravesado era el de la izquierda»: va de izquierda a derecha, así que está en la red del centro.",
        },
        ttl_count: {
          chip: "Routers atravesados",
          title: "«Había atravesado exactamente dos routers»",
          text: [
            "Cuenta los routers de su ruta desde la red de origen: con dos atravesados, el paquete está en la tercera red de su ruta.",
            "«Le quedaban dos routers para llegar a la red de su destino»: cuenta hacia atrás desde la red de destino.",
            "«Ya había atravesado algún router», «al menos dos», «como mucho uno»: el paquete está en cualquiera de las redes de su ruta que cumplen la condición.",
            "«Llevaba TTL 2»: réstalo del TTL inicial de su ficha para saber cuántos routers ha atravesado (con TTL inicial 4, dos). «Su TTL era como mucho 2» equivale a «había atravesado al menos dos routers».",
          ],
          caption: "«Ya había atravesado algún router»: cualquier red de su ruta salvo la de origen.",
        },
        route_relation: {
          chip: "Rutas de dos paquetes",
          title: "Pistas que comparan dos paquetes",
          text: [
            "«El paquete A había atravesado más routers que el paquete B»: cuenta los routers que lleva cada uno desde su origen. «En ese momento, el paquete A llevaba más TTL que el paquete B»: compara el TTL actual de los dos (TTL inicial − routers atravesados).",
            "«Al paquete A le quedaban menos routers que al paquete B para llegar a la red de su destino»: compara cuántos routers le faltan a cada uno.",
            "«Los paquetes A y B habían salido de la misma red» o «iban a la misma red»: aparecen cuando el origen o el destino de alguno de los dos está oculto.",
            "Como las demás pistas entre dos paquetes, aparecen en la ficha de los dos y descartan casillas aunque ninguno esté colocado.",
          ],
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
      inicial: {
        name: "Inicial",
        short: "Redes, equipos y routers. No requiere conocimiento de redes.",
        theory: [
          "Una **red** es un conjunto de equipos que se comunican directamente entre sí, sin pasar por un **router**. Seguramente los equipos de tu casa (el ordenador, los móviles, la tele…) forman una red, y los ordenadores de un laboratorio de la universidad, otra. En el tablero, cada zona de color es una red: su nombre aparece en el tablero y su **prefijo** (por ejemplo, 192.168.1.0/24), que la identifica, en la leyenda.",
          "Las comunicaciones se organizan en **capas**, y cada una resuelve una parte del problema. La **capa de enlace** lleva los datos de un equipo a otro dentro de una misma red, por cable (Ethernet) o por WiFi: por eso se dice que los equipos de una red se comunican «a nivel de enlace». La **capa de red** los lleva de una red a otra a través de routers.",
          "Un **router** (encaminador) separa redes y a la vez las une: recibe un paquete por una red y lo reenvía por otra, hacia su destino. Tiene una **interfaz** (una conexión, con su propia dirección IP) en cada red que une, así que pertenece a todas ellas; por eso en el tablero está en el borde entre dos redes. El router de tu casa, por ejemplo, une tu red con la de tu proveedor de Internet.",
          "Lo que viaja de una red a otra atravesando routers es un **paquete**, la unidad de datos de la capa de red. Como un sobre, lleva la dirección de su **origen** y la de su **destino**.",
          "Los **equipos** (o **nodos**) pueden ser **terminales** o **intermedios**. Los terminales, también llamados **hosts** (ordenadores, móviles, servidores), originan y reciben los datos; los intermedios (switches, puntos de acceso WiFi, routers) solo los reenvían. Un **switch** une equipos dentro de una red, pero no la divide: todos los ordenadores de un laboratorio conectados a sus switches siguen siendo una sola red.",
          "Casi todos los servicios siguen el modelo **cliente/servidor**: el **cliente** pide algo y el **servidor** lo ofrece. Por ejemplo, tu navegador (cliente) pide una página a un **servidor web**. En el juego hay equipos de usuario (clientes) y servidores web, **DNS** (traducen nombres como www.uma.es a direcciones IP), de correo, de ficheros y multimedia.",
        ],
        rules: ["in_network", "negative", "either", "node_count", "adjacent_to_node", "unique_adjacent", "router", "spatial", "relation"],
      },
      direccionamiento: {
        name: "Direccionamiento",
        short: "Prefijos, máscaras y direcciones IP: calcula a qué red pertenece cada dirección.",
        theory: [
          "Cada equipo tiene una **dirección IP**, que es como su «nombre» en la red: lo identifica, y los paquetes llevan la dirección de su origen y la de su destino. En IPv4 son 32 bits que se escriben como cuatro números del 0 al 255 separados por puntos, por ejemplo **192.168.1.37**; cada número es un **octeto** (8 bits). En realidad la dirección es de cada **interfaz** (cada conexión a una red): por eso un router tiene una dirección en cada red que une.",
          "Una dirección tiene dos partes: la **red** (los primeros bits, iguales en todos los equipos de esa red) y el **equipo** o **host** (el resto). El **prefijo** /n indica cuántos bits son de red: en 192.168.1.0/24, los 24 primeros bits (192.168.1) son la red y los 8 últimos, el equipo.",
          "La **máscara** dice lo mismo que el prefijo, con n unos seguidos de ceros. /24 es **255.255.255.0**; /26 es **255.255.255.192**, porque el último octeto es 11000000 en binario, que es 192.",
          "Una red /n tiene **2^(32−n) direcciones**: una /24 tiene 256 y una /26, 64. Cuanto más largo es el prefijo, menos direcciones tiene la red. La primera es el **identificador de red** (en 192.168.1.0/24, la 192.168.1.0) y la última, la de **difusión** (192.168.1.255), que sirve para enviar a todos los equipos de la red. Las demás, 2^(32−n) − 2, son **asignables**: se dan a los equipos y a las interfaces de los routers (una /24 tiene 254). El tamaño de una red es su número de direcciones, no sus casillas en el tablero.",
          "La difusión se calcula sumando al identificador el número de direcciones menos 1. En 192.168.1.64/26 (64 direcciones), 64 + 64 − 1 = 127: la difusión es **192.168.1.127**, la primera dirección asignable es 192.168.1.65 y la última, 192.168.1.126.",
          "Una dirección pertenece a una red si, al aplicarle la máscara (**IP AND máscara**), se obtiene el identificador de esa red. Por ejemplo, para 192.168.1.130 con máscara /26: 130 AND 192 = 128 (10000010 AND 11000000 = 10000000), así que es de la red **192.168.1.128/26**.",
          "Un bloque de direcciones se reparte en **subredes**. Cada subred tiene un número de direcciones que es potencia de dos (4, 8, 16, 32, 64, 128…) y empieza en un múltiplo de ese número. Por ejemplo, una /24 se puede repartir en cuatro /26 de 64 direcciones, que empiezan en .0, .64, .128 y .192 (múltiplos de 64). **Truco**: para saber de qué /26 es 192.168.1.130, busca el múltiplo de 64 más cercano por debajo de 130, que es 128; la subred es 192.168.1.128/26 (de .128 a .191). Con prefijos más cortos que /24 se hace lo mismo en el octeto donde acaba el prefijo: por ejemplo, 10.0.37.5 en una /20 (bloques de 16 en el tercer octeto) es de la red 10.0.32.0/20.",
          "Con **VLSM** (máscara de longitud variable), las subredes de un mismo bloque pueden tener tamaños distintos, según lo que necesite cada una: por ejemplo, una /25 (128 direcciones) para un laboratorio y una /27 (32) para una secretaría. En un nivel las redes nunca se solapan, así que cada dirección pertenece a una sola.",
          "Hay tres bloques de **direcciones privadas**: **10.0.0.0/8**, **172.16.0.0/12** (de 172.16.0.0 a 172.31.255.255) y **192.168.0.0/16**. Se pueden usar en cualquier red interna, como la de tu casa o la de una empresa, pero no en Internet. Las demás son **públicas** y no se repiten en todo Internet. Para que un equipo con dirección privada salga a Internet, el router traduce su dirección a una pública: es **NAT**.",
        ],
        rules: ["named_by_address", "network_size", "ip_network", "special_addresses", "prefix_length", "privacy"],
      },
      encaminamiento: {
        name: "Encaminamiento",
        short: "Rutas y TTL: sigue cada paquete de router en router, desde su origen hasta su destino.",
        theory: [
          "Cuando el origen y el destino de un paquete están en redes distintas, el paquete tiene que atravesar **routers**. Cada router decide por qué red lo reenvía para acercarlo a su destino: es el **encaminamiento**. La sucesión de redes y routers por la que pasa es su **ruta**.",
          "En el juego, la ruta es el **camino más corto**, el que atraviesa menos routers, entre la red del origen y la del destino, como hace el protocolo de encaminamiento RIP, que cuenta saltos. En todos los niveles de esta categoría ese camino es único.",
          "Las direcciones IP de origen y destino del paquete no cambian en todo el camino. Lo que cambia en cada red es la **trama** de la capa de enlace que lo lleva: va del equipo o router anterior al **siguiente salto**, identificados por sus direcciones **MAC**. La MAC del siguiente salto se averigua con **ARP**.",
          "El **TTL** (tiempo de vida) es un campo de la cabecera IP. El origen le da un valor inicial y cada router le resta 1. Si un router lo deja a 0, descarta el paquete y avisa al origen con un mensaje **ICMP** (así funciona tracert). Sirve para que un paquete no dé vueltas para siempre si hay un error en las rutas.",
          "TTL actual = TTL inicial − routers atravesados. Un paquete con TTL inicial 3 solo puede haber atravesado dos routers: si su ruta tiene más, no llegará a su destino. Los switches y los puntos de acceso no cuentan, porque no miran la cabecera IP.",
          "Un router puede unir más de dos redes, con una interfaz en cada una. En el tablero, un router que une tres o cuatro redes está en la esquina donde se juntan.",
          "El router de su red al que un equipo envía los paquetes dirigidos a otras redes es su **puerta de enlace** (gateway): es el primer router de la ruta de esos paquetes.",
          "Una **red de tránsito** no tiene equipos: solo une routers, como los enlaces entre los routers de una empresa o de un proveedor. Los paquetes la atraviesan, pero nunca empiezan ni acaban en ella.",
          "La **difusión** (por ejemplo, la petición DHCP de un equipo que aún no tiene dirección) va a todos los equipos de una red, pero los routers no la reenvían: un paquete de difusión no sale de la red de su origen.",
        ],
        rules: ["route_trace", "ttl", "frames", "corner_router", "hidden_endpoint", "route_position", "route_router", "ttl_count", "route_relation"],
      },
    },

    about: {
      title: "Sobre el juego",
      paragraphs: [
        "Netdoku es un juego de deducción lógica inspirado en Murdoku. En lugar de habitaciones y sospechosos, el tablero tiene redes, equipos y routers, y hay que descubrir dónde estaba cada paquete para encontrar al atacante.",
        "Se ha creado para la asignatura Redes y Servicios de la Universidad de Málaga. Las categorías siguen el orden del temario: cada una corresponde a un bloque de la asignatura y se puede jugar en cuanto ese bloque se ha visto en clase.",
        "Su objetivo docente es practicar los conceptos de la asignatura usándolos para razonar, no solo memorizándolos. Cada pista obliga a interpretar un concepto: qué une un router, a qué red pertenece una dirección o cuántas direcciones tiene una red.",
        "La dificultad de cada nivel tiene dos componentes: la lógica (qué deducciones hacen falta) y la de interpretación (qué hay que calcular para entender las pistas).",
        "Los niveles se generan automáticamente. Todos tienen una única solución, a la que se llega razonando, sin necesidad de adivinar.",
      ],
      university: "Universidad de Málaga",
      credits: "Desarrollado por Gabriel Luque con la ayuda de Claude (Anthropic).",
      license: "Código abierto con licencia MIT.",
      source: "Código fuente:",
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
