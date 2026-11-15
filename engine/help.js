// Fichas de ayuda de Netdoku, agrupadas por categoría (cómo jugar, reglas,
// pistas, iconos). Las usan el panel de ayuda de cada nivel (netdoku.js) y la
// página de ayuda (ayuda.html). Al añadir un subtipo de pista, añadir aquí su
// ficha (categoría "clues") y su entrada en TYPE_TO_ENTRY.
(function () {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  // Las redes A, B, C y D de los ejemplos usan los colores 1 a 4 del tema.
  const NET_VARS = { A: "--net-1", B: "--net-2", C: "--net-3", D: "--net-4" };
  const tv = (name) => (window.NetdokuTheme ? window.NetdokuTheme.value(name) : "") || "#888";
  const SERVICE_COLORS = { web: "#2f7de1", dns: "#8e44ad", mail: "#e67e22", storage: "#16a085", multimedia: "#c0392b" };
  const RED = "#d64545";
  const BLUE = "#3b6fd6";
  const GREEN = "#2e9e5b";
  const ORANGE = "#e08a1e";

  const CATEGORIES = [
    { id: "basic", title: "Cómo jugar" },
    { id: "rules", title: "Reglas" },
    { id: "clues", title: "Pistas" },
    { id: "icons", title: "Iconos" },
  ];

  // Mini tableros: grid (una letra de red por casilla), nodes [f, c, tipo],
  // routers [[f, c], [f, c]], packets [f, c, letra, color], notes [f, c, letra,
  // color, hueco], ok / no (casillas posibles / descartadas) y shade (casillas
  // resaltadas). Índices desde 1.
  const ENTRIES = [
    {
      id: "how_to_play",
      category: "basic",
      chip: "Cómo jugar",
      title: "Cómo jugar",
      text: [
        "Colocar: arrastra un paquete a la casilla donde crees que está, o selecciónalo en el panel y pulsa la casilla. Si aciertas, queda fijo; si fallas, vuelve al panel y pierdes una de tus tres vidas. Al resolverlo por primera vez ganas tres estrellas menos una por fallo, contando los intentos anteriores: reiniciar no borra los fallos.",
        "Anotar: activa el interruptor (o pulsa A), selecciona un paquete y pulsa las casillas donde podría estar. Aparece un circulito de su color; vuelve a pulsar para quitarlo.",
        "Descartar: clic derecho (o pulsación larga) marca una casilla con ✕ y borra sus notas. Pulsa una pista para tacharla cuando ya la hayas usado.",
        "El progreso se guarda en este navegador. «Reiniciar» empieza el nivel de cero.",
      ],
      mini: {
        grid: ["AAAA", "AAAA", "AAAA"],
        packets: [[1, 1, "A", "#d64545"]],
        notes: [[2, 3, "B", "#3b6fd6", 1], [2, 3, "C", "#2e9e5b", 2], [3, 4, "B", "#3b6fd6", 1]],
        no: [[3, 2]],
      },
      caption: "A está colocado; B y C tienen notas; una casilla está descartada.",
    },
    {
      id: "objective",
      category: "basic",
      chip: "Objetivo",
      title: "Objetivo: descubrir al atacante",
      text: [
        "La víctima estaba a solas con el atacante: en su red no hay ningún otro paquete.",
        "Coloca todos los paquetes en su casilla. Al colocar el último, el atacante queda al descubierto: es el otro paquete de la red de la víctima.",
      ],
      mini: {
        grid: ["AABB", "AABB", "AABB", "AABB"],
        packets: [[1, 1, "B", BLUE], [2, 3, "V", RED], [3, 2, "C", GREEN], [4, 4, "?", "#555"]],
        shade: [[1, 3], [1, 4], [2, 3], [2, 4], [3, 3], [3, 4], [4, 3], [4, 4]],
      },
      caption: "V es la víctima. El único otro paquete de su red es el atacante.",
    },
    {
      id: "row_column",
      category: "rules",
      chip: "Fila y columna",
      title: "Un paquete por fila y por columna",
      text: [
        "En cada fila y en cada columna hay como mucho un paquete. Al colocar uno, el resto de su fila y de su columna queda descartado para los demás.",
        "Con tantos paquetes como filas, cada fila y cada columna tiene exactamente uno. Por eso el último paquete (la víctima) se deduce por descarte.",
      ],
      mini: {
        grid: ["AAAA", "AAAA", "AAAA", "AAAA"],
        packets: [[2, 3, "A", RED]],
        no: [[2, 1], [2, 2], [2, 4], [1, 3], [3, 3], [4, 3]],
      },
      caption: "Con A en la fila 2 y la columna 3, ningún otro paquete puede ir en las casillas marcadas.",
    },
    {
      id: "adjacent",
      category: "rules",
      chip: "«Junto a»",
      title: "Qué significa «junto a»",
      text: [
        "Junto a una casilla están las cuatro que comparten un lado con ella (arriba, abajo, izquierda y derecha) y que pertenecen a la misma red.",
        "Las diagonales no cuentan. Una casilla de otra red tampoco, aunque toque al equipo: el borde de red las separa.",
      ],
      mini: {
        grid: ["AAB", "AAB", "AAA"],
        nodes: [[2, 2, "web"]],
        ok: [[1, 2], [2, 1], [3, 2]],
        no: [[2, 3], [1, 1], [1, 3], [3, 1], [3, 3]],
      },
      caption: "Junto al servidor solo están las casillas con círculo. La de la derecha es de otra red.",
    },
    {
      id: "in_network",
      category: "clues",
      chip: "En una red",
      title: "«Estaba en la red X»",
      text: [
        "El paquete está en alguna casilla libre de esa red. Las casillas con equipos nunca tienen paquetes.",
        "Cada red tiene su color, su nombre en el tablero y, en la leyenda, su prefijo (por ejemplo, 192.168.1.0/24).",
      ],
      mini: {
        grid: ["AABB", "AABB", "CCBB"],
        nodes: [[1, 4, "client"]],
        ok: [[1, 3], [2, 3], [2, 4], [3, 3], [3, 4]],
      },
      caption: "«En la red verde»: cualquiera de las casillas con círculo.",
    },
    {
      id: "adjacent_to_node",
      category: "clues",
      chip: "Junto a un equipo",
      title: "«Estaba junto a…» un equipo",
      text: [
        "«Junto al servidor web»: en una casilla junto a ese equipo concreto. Si hay varios iguales, la pista dice de qué red es.",
        "«Junto a un servidor web»: junto a cualquiera de los servidores web del tablero. «Junto a un servidor»: junto a cualquier servidor.",
      ],
      mini: {
        grid: ["AAAA", "AAAA", "AAAA"],
        nodes: [[1, 1, "web"], [3, 4, "web"], [2, 3, "client"]],
        ok: [[1, 2], [2, 1], [2, 4], [3, 3]],
      },
      caption: "«Junto a un servidor web»: cualquiera de las casillas con círculo.",
    },
    {
      id: "unique_adjacent",
      category: "clues",
      chip: "Ningún otro junto a…",
      title: "«…y ningún otro paquete lo estaba»",
      text: [
        "«El paquete A estaba junto al servidor de correo, y ningún otro paquete lo estaba»: A está en una de las casillas junto a ese equipo.",
        "Las demás casillas junto a él quedan descartadas para todos los demás paquetes, también para la víctima, aunque todavía no sepas en cuál de ellas está A.",
      ],
      mini: {
        grid: ["AAA", "AAA", "AAA"],
        nodes: [[2, 2, "mail"]],
        packets: [[1, 2, "A", ORANGE]],
        no: [[2, 1], [2, 3], [3, 2]],
      },
      caption: "Ningún otro paquete puede ocupar las otras casillas junto al servidor de correo.",
    },
    {
      id: "router",
      category: "clues",
      chip: "Junto a un router",
      title: "«Estaba junto al router que une X e Y»",
      text: [
        "Los routers están en el borde entre redes: son el punto de paso de una red a otra y pertenecen a todas las redes que unen.",
        "Junto a un router solo hay dos casillas: la que lo toca en cada una de las dos redes.",
      ],
      mini: {
        grid: ["AABB", "AABB", "AABB"],
        routers: [[[2, 2], [2, 3]]],
        ok: [[2, 2], [2, 3]],
      },
      caption: "Junto al router solo están las dos casillas con círculo, una en cada red.",
    },
    {
      id: "spatial",
      category: "clues",
      chip: "Fila o columna",
      title: "«Estaba en la fila N» o «en la columna N»",
      text: [
        "Las filas se cuentan de arriba abajo y las columnas de izquierda a derecha. Los números están en el margen del tablero.",
        "Junto con la regla de un paquete por fila y columna, una de estas pistas descarta esa fila o columna para todos los demás.",
      ],
      mini: {
        grid: ["AAAA", "AAAA", "AAAA"],
        nodes: [[2, 2, "dns"]],
        ok: [[2, 1], [2, 3], [2, 4]],
        numbers: true,
      },
      caption: "«En la fila 2»: cualquiera de las casillas libres de esa fila.",
    },
    {
      id: "icons",
      category: "icons",
      chip: "Iconos",
      title: "Iconos del tablero",
      text: [
        "Monitor: equipo de usuario (cliente). Rack: servidor; la insignia indica el servicio: globo azul (web), «DNS» morado, sobre naranja (correo), carpeta verde (ficheros) y triángulo rojo (multimedia).",
        "Círculo azul con flechas sobre un borde: router. Los paquetes son los círculos de colores con una letra.",
      ],
      mini: {
        grid: ["AAAA", "AABB"],
        nodes: [[1, 1, "client"], [1, 2, "web"], [1, 3, "dns"], [1, 4, "mail"], [2, 1, "storage"]],
        routers: [[[2, 2], [2, 3]]],
        packets: [[2, 4, "A", BLUE]],
      },
      caption: "Cliente, servidores web, DNS, de correo y de ficheros, un router y un paquete.",
    },
  ];

  const TYPE_TO_ENTRY = {
    "network.in_network": "in_network",
    "node.adjacent_to_node": "adjacent_to_node",
    "node.unique_adjacent_to_node": "unique_adjacent",
    "router.adjacent_to_router": "router",
    "spatial.in_row": "spatial",
    "spatial.in_column": "spatial",
  };
  const USES_ADJACENCY = new Set(["node.adjacent_to_node", "node.unique_adjacent_to_node"]);

  function entry(id) {
    return ENTRIES.find((e) => e.id === id);
  }

  // Fichas que usa un nivel, en el orden del catálogo.
  function forLevel(level) {
    const ids = new Set(["how_to_play", "objective", "row_column", "icons"]);
    for (const clue of level.clues || []) {
      if (TYPE_TO_ENTRY[clue.type]) ids.add(TYPE_TO_ENTRY[clue.type]);
      if (USES_ADJACENCY.has(clue.type)) ids.add("adjacent");
    }
    return ENTRIES.filter((e) => ids.has(e.id));
  }

  function el(tag, attrs, parent) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) node.setAttribute(k, v);
    if (parent) parent.appendChild(node);
    return node;
  }

  function label(parent, x, y, content, attrs) {
    const t = el("text", { x, y, "text-anchor": "middle", ...attrs }, parent);
    t.textContent = content;
    return t;
  }

  function renderMini(mini) {
    const S = 40;
    const off = mini.numbers ? 16 : 4;
    const rows = mini.grid.length;
    const cols = mini.grid[0].length;
    const X = (c) => off + (c - 1) * S;
    const Y = (r) => off + (r - 1) * S;
    const root = el("svg", { viewBox: `0 0 ${off + cols * S + 4} ${off + rows * S + 4}`, class: "mini", role: "img" });
    const net = (r, c) => mini.grid[r - 1][c - 1];

    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= cols; c++) {
        el("rect", { x: X(c), y: Y(r), width: S, height: S, fill: tv(NET_VARS[net(r, c)]), stroke: tv("--cell-line") }, root);
      }
    }
    for (const [r, c] of mini.shade || []) {
      el("rect", { x: X(c), y: Y(r), width: S, height: S, fill: "rgba(214,69,69,0.18)" }, root);
    }
    const wall = { stroke: tv("--wall"), "stroke-width": 3, "stroke-linecap": "round" };
    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= cols; c++) {
        if (c === cols || net(r, c + 1) !== net(r, c)) el("line", { x1: X(c + 1), y1: Y(r), x2: X(c + 1), y2: Y(r + 1), ...wall }, root);
        if (r === rows || net(r + 1, c) !== net(r, c)) el("line", { x1: X(c), y1: Y(r + 1), x2: X(c + 1), y2: Y(r + 1), ...wall }, root);
        if (c === 1) el("line", { x1: X(1), y1: Y(r), x2: X(1), y2: Y(r + 1), ...wall }, root);
        if (r === 1) el("line", { x1: X(c), y1: Y(1), x2: X(c + 1), y2: Y(1), ...wall }, root);
      }
    }
    if (mini.numbers) {
      for (let r = 1; r <= rows; r++) label(root, off / 2, Y(r) + S / 2 + 4, r, { "font-size": 11, fill: tv("--board-number") });
      for (let c = 1; c <= cols; c++) label(root, X(c) + S / 2, off - 4, c, { "font-size": 11, fill: tv("--board-number") });
    }
    for (const [r, c, kind] of mini.nodes || []) {
      const x = X(c);
      const y = Y(r);
      el("rect", { x: x + 5, y: y + 5, width: S - 10, height: S - 10, rx: 6, fill: tv(kind === "client" ? "--node-client" : "--node-server"), stroke: tv("--node-edge") }, root);
      if (kind === "client") {
        el("rect", { x: x + 11, y: y + 12, width: 18, height: 12, rx: 2, fill: tv("--node-screen") }, root);
        el("rect", { x: x + 15, y: y + 26, width: 10, height: 2, fill: tv("--node-part") }, root);
      } else {
        for (let i = 0; i < 3; i++) el("rect", { x: x + 11, y: y + 10 + i * 7, width: 18, height: 5, rx: 1, fill: tv("--node-part") }, root);
        el("circle", { cx: x + S - 9, cy: y + S - 9, r: 6, fill: SERVICE_COLORS[kind] || "#555", stroke: "#fff", "stroke-width": 1.5 }, root);
      }
    }
    for (const [r, c] of mini.ok || []) {
      el("circle", { cx: X(c) + S / 2, cy: Y(r) + S / 2, r: 8, fill: "none", stroke: tv("--ok"), "stroke-width": 3 }, root);
    }
    for (const [r, c] of mini.no || []) {
      label(root, X(c) + S / 2, Y(r) + S / 2 + 7, "✕", { "font-size": 20, fill: tv("--mark") });
    }
    for (const [r, c, id, color, slot] of mini.notes || []) {
      const nx = X(c) + 8 + (slot % 3) * 12;
      const ny = Y(r) + 8 + Math.floor(slot / 3) * 12;
      el("circle", { cx: nx, cy: ny, r: 5.5, fill: color, opacity: 0.85 }, root);
      label(root, nx, ny + 2.5, id, { "font-size": 7, "font-weight": 700, fill: "#fff" });
    }
    for (const [r, c, id, color] of mini.packets || []) {
      el("circle", { cx: X(c) + S / 2, cy: Y(r) + S / 2, r: 12, fill: color, stroke: tv("--token-edge"), "stroke-width": 1.5 }, root);
      label(root, X(c) + S / 2, Y(r) + S / 2 + 5, id, { "font-size": 13, "font-weight": 700, fill: "#fff" });
    }
    for (const [[r1, c1], [r2, c2]] of mini.routers || []) {
      const cx = (X(c1) + X(c2)) / 2 + S / 2;
      const cy = (Y(r1) + Y(r2)) / 2 + S / 2;
      el("circle", { cx, cy, r: 8, fill: tv("--router"), stroke: tv("--router-edge"), "stroke-width": 1.5 }, root);
    }
    return root;
  }

  // Contenido de una ficha (título, texto, ejemplo) dentro de `container`.
  // Ficha: texto (título y párrafos) y, si tiene, mini tablero. En la página de
  // ayuda el texto va a la izquierda y el tablero a la derecha.
  function renderEntry(container, e) {
    const body = document.createElement("div");
    body.className = "entry-text";
    const h = document.createElement("h2");
    h.textContent = e.title;
    body.appendChild(h);
    for (const p of e.text) {
      const para = document.createElement("p");
      para.textContent = p;
      body.appendChild(para);
    }
    container.appendChild(body);
    container.classList.toggle("has-mini", !!e.mini);
    if (e.mini) {
      const fig = document.createElement("figure");
      fig.appendChild(renderMini(e.mini));
      if (e.caption) {
        const cap = document.createElement("figcaption");
        cap.textContent = e.caption;
        fig.appendChild(cap);
      }
      container.appendChild(fig);
    }
  }

  window.NetdokuHelp = { CATEGORIES, ENTRIES, forLevel, renderEntry };
})();
