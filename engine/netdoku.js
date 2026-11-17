// Motor de Netdoku: una partida. No conoce el generador ni la lista de niveles:
// recibe un nivel (formato de partida en JSON) con NetdokuGame.start(nivel,
// opciones) y avisa a app.js al guardar, al resolverlo y al perder. Los textos
// salen del idioma activo (NetdokuI18n), también el de las pistas, que se
// compone a partir de sus datos (tipo, parámetros y formas de nombrar).
(function () {
  "use strict";

  const START_LIVES = 3;
  const CELL = 80;
  const PAD = 6;
  const NUMBERS_MARGIN = 22; // margen superior e izquierdo para los números de fila y columna
  let margin = NUMBERS_MARGIN;
  // Texturas de casilla; con «una textura por red», cada red usa la suya en este orden.
  const PER_NETWORK_PATTERNS = ["tiles", "dots", "stripes", "cross", "waves", "plain"];
  const appearance = () => (window.NetdokuTheme ? window.NetdokuTheme.settings() : { pattern: "plain", icons: "drawings", numbers: true, netNames: true });
  const NETWORK_COLOR_COUNT = 8; // --net-1 … --net-8 en netdoku.css
  const SERVICE_COLORS = { web: "#2f7de1", dns: "#8e44ad", mail: "#e67e22", storage: "#16a085", multimedia: "#c0392b", dhcp: "#7f8c8d" };
  const SVG_NS = "http://www.w3.org/2000/svg";
  // Formas de nombrar que hablan del tamaño de las redes: el objetivo recuerda que las casillas no lo indican.
  const SIZE_FORMS = new Set(["size_rank", "prefix_length", "address_count", "usable_count", "mask"]);

  const $ = (id) => document.getElementById(id);
  // Color del tema actual (variables CSS de netdoku.css).
  const tv = (name) => (window.NetdokuTheme ? window.NetdokuTheme.value(name) : "") || "#888";
  const I18n = window.NetdokuI18n;
  const t = (key, vars) => I18n.t(key, vars);
  const dots = (n) => "●".repeat(n) + "○".repeat(5 - n);
  const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  // Nombre de una variante de entrenamiento (sus ids llevan puntos: no valen como ruta de t()).
  const variantName = (id) => (I18n.get("train.variants") || {})[id] || id;

  let level = null;
  let state = null;
  // Opciones de la partida (app.js): saved, category, onSave, onSolve, onLose, actions.
  let options = {};
  // Paquetes ya colocados cuyas pistas el jugador ha vuelto a desplegar.
  let expanded = new Set();
  // Encaminamiento: paquete bajo el ratón, cuyo origen y destino se marcan en el tablero.
  let routeFocus = null;
  let tableFocus = null; // Tabla de enrutamiento: { id, pinned } del router cuya tabla se ve
  let bound = false;

  // ---------- Nombres en el idioma activo ----------

  function networkById(id) {
    return level.networks.find((n) => n.id === id);
  }

  function networkName(net) {
    return (net.nameKey && I18n.get(`networks.${net.nameKey}`)) || net.name;
  }

  function nodeLabel(node) {
    const key = node.type === "client" ? "client" : (node.services || [])[0] || "server";
    return I18n.get(`nodes.${key}`) || node.label;
  }

  function nodeCaption(n) {
    if (n.type === "client") return t("nodeText.client");
    return (n.services || []).map((s) => I18n.get(`nodeText.${s}`) || s).join("/");
  }

  function routerTitle(rt) {
    return t("game.routerName", { names: rt.connectedNetworks.map((id) => networkName(networkById(id))) });
  }

  // Casillas de apoyo de un router: dos (borde) o cuatro (esquina donde se juntan tres o cuatro redes).
  function routerCells(rt) {
    return rt.position.cells || rt.position.between;
  }

  // Pistas de un paquete: las suyas y las que lo relacionan con otro paquete.
  function cluesOf(id) {
    return level.clues.filter((c) => (c.packets || [c.packet]).includes(id));
  }

  // ---------- Tablas de encaminamiento (categoría Tabla de enrutamiento) ----------

  const routing = () => (level && level.routing) || null;
  const routerById = (id) => level.routers.find((r) => r.id === id);
  const DEFAULT_ROUTE = "0.0.0.0/0";

  function ipNumber(ip) {
    return ip.split(".").reduce((n, x) => n * 256 + Number(x), 0);
  }

  function prefixLength(prefix) {
    return Number(prefix.split("/")[1]);
  }

  function inPrefix(ip, prefix) {
    const size = 2 ** (32 - prefixLength(prefix));
    return Math.floor(ipNumber(ip) / size) === Math.floor(ipNumber(prefix.split("/")[0]) / size);
  }

  // Coincidencia más larga: entradas que contienen la IP (sin la ruta por defecto) y la que gana.
  function lookup(routerId, ip) {
    const table = routing().tables[routerId] || [];
    const matches = table.filter((e) => e.prefix !== DEFAULT_ROUTE && inPrefix(ip, e.prefix));
    const best = matches.reduce((a, e) => (!a || prefixLength(e.prefix) > prefixLength(a.prefix) ? e : a), null);
    return { matches, entry: best || table.find((e) => e.prefix === DEFAULT_ROUTE) || null };
  }

  // Siguiente salto como lo escribe el nivel: el nombre del router o la IP de su
  // interfaz en la red que comparte con `fromId`.
  function hopText(fromId, viaId) {
    const via = routerById(viaId);
    if (routing().nextHop !== "ip" || !via) return viaId;
    const from = routerById(fromId);
    const shared = from ? from.connectedNetworks.find((n) => via.connectedNetworks.includes(n)) : null;
    return (via.interfaces || {})[shared] || viaId;
  }

  // Puerta de enlace de una red, escrita como los siguientes saltos.
  function gatewayText(netId) {
    const gw = routing() && routing().gateways[netId];
    if (!gw) return null;
    return routing().nextHop === "ip" ? (routerById(gw).interfaces || {})[netId] || gw : gw;
  }

  const prefixText = (prefix) => (prefix === DEFAULT_ROUTE ? t("tables.default") : prefix);

  function openTable(id, pin) {
    if (pin) tableFocus = tableFocus && tableFocus.id === id && tableFocus.pinned ? null : { id, pinned: true };
    else if (!tableFocus || !tableFocus.pinned) tableFocus = { id, pinned: false };
    renderBoard();
  }

  function closeTable(force) {
    if (!tableFocus || (tableFocus.pinned && !force)) return;
    tableFocus = null;
    renderBoard();
  }

  // Tabla del router enfocado, junto a él sobre el tablero: sus interfaces y sus entradas.
  function renderRouterTable() {
    const box = $("router-table");
    if (!box) return;
    const rt = tableFocus && routing() ? routerById(tableFocus.id) : null;
    box.innerHTML = "";
    box.hidden = !rt;
    if (!rt) return;
    const head = document.createElement("div");
    head.className = "head";
    const title = document.createElement("strong");
    title.textContent = t("tables.title", { router: rt.id });
    head.appendChild(title);
    if (tableFocus.pinned) {
      const close = document.createElement("button");
      close.type = "button";
      close.className = "close";
      close.textContent = "✕";
      close.setAttribute("aria-label", t("theme.close"));
      close.addEventListener("click", () => closeTable(true));
      head.appendChild(close);
    }
    box.appendChild(head);
    const ifaces = document.createElement("div");
    ifaces.className = "interfaces";
    for (const id of rt.connectedNetworks) {
      const ip = (rt.interfaces || {})[id];
      ifaces.appendChild(chip(ip ? `${networkName(networkById(id))} · ${ip}` : networkName(networkById(id)), networkColor(id)));
    }
    box.appendChild(ifaces);
    const table = document.createElement("table");
    const header = table.createTHead().insertRow();
    for (const key of ["tables.destination", "tables.nextHop"]) {
      const th = document.createElement("th");
      th.textContent = t(key);
      header.appendChild(th);
    }
    const body = table.createTBody();
    for (const e of routing().tables[rt.id] || []) {
      const row = body.insertRow();
      row.insertCell().textContent = prefixText(e.prefix);
      row.insertCell().textContent = e.direct ? t("tables.direct") : hopText(rt.id, e.via);
      if (e.direct) row.className = "direct";
    }
    box.appendChild(table);
    // Junto al router: a su derecha o a su izquierda, debajo o encima, según dónde esté.
    const board = $("board-wrap").querySelector("svg");
    if (!board) return;
    const view = board.viewBox.baseVal;
    const area = box.parentElement.getBoundingClientRect();
    const rect = board.getBoundingClientRect();
    const [cx, cy] = routerCenter(rt);
    const x = rect.left - area.left + (cx / view.width) * rect.width;
    const y = rect.top - area.top + (cy / view.height) * rect.height;
    box.style.left = `${x}px`;
    box.style.top = `${y}px`;
    box.classList.toggle("from-right", cx > view.width / 2);
    box.classList.toggle("from-bottom", cy > view.height / 2);
  }

  function maskOf(length) {
    const bits = length ? (0xffffffff << (32 - length)) >>> 0 : 0;
    return [24, 16, 8, 0].map((s) => (bits >>> s) & 255).join(".");
  }

  // Lo que necesitan las funciones clue() de lang/*.js para escribir una pista.
  const levelContext = {
    network: (id) => {
      const n = networkById(id);
      return { name: networkName(n), prefix: n.prefix };
    },
    node: (id) => level.nodes.find((n) => n.id === id),
    nodeLabel,
    router: (id) => level.routers.find((r) => r.id === id),
    mask: maskOf,
    ttl: (id) => ((packetById(id) || {}).ttl || {}).initial,
  };

  function clueText(c) {
    const write = I18n.get("clue");
    try {
      return typeof write === "function" ? write(c, levelContext) : c.text;
    } catch (err) {
      return c.text; // pista de un formato que este motor no conoce
    }
  }

  // ---------- Partida ----------

  function start(data, opts) {
    level = data;
    options = opts || {};
    expanded = new Set();
    routeFocus = null;
    tableFocus = null;
    const saved = options.saved;
    state = {
      lives: saved ? saved.lives : START_LIVES,
      placed: saved ? saved.placed : {},          // id de paquete -> [f, c]
      marks: new Set(saved ? saved.marks : []),   // "f,c" marcadas por el jugador
      // Notas del jugador: "f,c" -> conjunto de paquetes que cree posibles ahí.
      notes: new Map(Object.entries((saved && saved.notes) || {}).map(([k, v]) => [k, new Set(v)])),
      mode: "place",                             // place | note
      struck: new Set(saved ? saved.struck : []), // ids de pistas tachadas
      solved: saved ? saved.solved : false,
      lost: saved ? saved.lost : false,
      result: saved ? saved.result || null : null, // lo que devolvió onSolve (mejor resultado…)
      hints: saved ? saved.hints || 0 : 0,          // sugerencias usadas (cada una cuesta una vida)
      hint: saved ? saved.hint || null : null,      // última sugerencia (datos de NetdokuHints)
      asking: false,                                // pidiendo confirmación para una sugerencia
      hintStep: 0,                                  // paso de la sugerencia que se resalta
      selected: null,
      // Entrenamiento (level.training): paso actual y casillas marcadas en él.
      train: options.training && data.training ? newTrainState() : null,
    };
    if (state.train) state.placed = { ...data.training.placed };
    $("view-game").classList.toggle("training", !!state.train);
    bind();
    setMode("place");
    say(saved && !state.solved && !state.lost && Object.keys(state.placed).length ? t("game.resumed") : (options.message || ""));
    refresh();
  }

  function bind() {
    if (bound) return;
    bound = true;
    $("note-mode").addEventListener("change", (e) => { if (state) setMode(e.target.checked ? "note" : "place"); });
    $("hint-button").addEventListener("click", askHint);
    window.addEventListener("netdoku-theme", () => { if (level) render(); });
    window.addEventListener("netdoku-lang", refresh);
    document.addEventListener("click", (e) => {
      if (tableFocus && !e.target.closest(".router-table, .router-hit")) closeTable(true);
    });
    window.addEventListener("resize", () => { if (tableFocus) renderRouterTable(); });
    // Atajo: A activa o desactiva el modo anotar.
    document.addEventListener("keydown", (e) => {
      if (!state || $("view-game").hidden) return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest("input, select, textarea, dialog[open]")) return;
      if (e.key === "Escape" && tableFocus) closeTable(true);
      if (e.key.toLowerCase() === "a") setMode(state.mode === "note" ? "place" : "note");
    });
  }

  // Todo lo que depende del idioma o del tema.
  function refresh() {
    if (!level) return;
    renderHelpPanel();
    setMode(state.mode);
    render();
  }

  function snapshot() {
    return {
      lives: state.lives,
      placed: state.placed,
      marks: [...state.marks],
      notes: Object.fromEntries([...state.notes].map(([k, v]) => [k, [...v]])),
      struck: [...state.struck],
      solved: state.solved,
      lost: state.lost,
      result: state.result,
      hints: state.hints,
      hint: state.hint,
    };
  }

  function save() {
    if (options.onSave) options.onSave(snapshot());
  }

  function isOver() {
    return state.solved || state.lost;
  }

  // Hay algo que se perdería al empezar otro nivel.
  function hasProgress() {
    if (isTraining()) return false; // un ejercicio se deja sin perder nada
    return !!state && !isOver() && (Object.keys(state.placed).length > 0 || state.notes.size > 0
      || state.marks.size > 0 || state.lives < START_LIVES);
  }

  function allPlaced() {
    return Object.keys(state.placed).length === level.packets.items.length;
  }

  function packetById(id) {
    return level.packets.items.find((p) => p.id === id);
  }

  // ---------- Panel de ayuda (izquierda) ----------

  function renderHelpPanel() {
    const d = level.level.difficulty || {};
    const value = d.global || d.logic;
    const cat = options.category || level.level.category;
    const category = cat ? t(`categories.${cat}.name`) : "";
    const n = level.clues.length;
    let meta = value ? t("game.meta", { category, dots: dots(value), tier: t(`tiers.${value}`), n }) : `${category} · ${n}`;
    if (d.reading) meta += ` (${t("game.metaDetail", { logic: d.logic, reading: d.reading })})`;
    if (isTraining()) {
      const tr = level.training;
      meta = t("train.meta", { category: t(`train.categories.${tr.category}`), variant: variantName(tr.variant) });
    }
    $("level-meta").textContent = meta;

    let objective = isTraining() ? t("train.objective") : t("game.objective", { victim: level.objective.victimPacketId });
    if ((level.rules || {}).packetOnRoute) objective += " " + t("game.routeNote");
    if (level.routing) objective += " " + t("game.tablesNote");
    if (level.packets.items.some(hasHiddenEnd)) objective += " " + t("game.hiddenNote");
    if (level.clues.some((c) => Object.values(c.naming || {}).some((f) => SIZE_FORMS.has(f)))) {
      objective += " " + t("game.sizeNote");
    }
    $("objective").textContent = objective;
    renderHelpStrip();
  }

  // Etiquetas con las reglas que usa este nivel; cada una abre su ficha.
  function renderHelpStrip() {
    const panel = $("help-groups");
    panel.innerHTML = "";
    if (!window.NetdokuHelp) return;
    const entries = window.NetdokuHelp.forLevel(level);
    for (const cat of window.NetdokuHelp.CATEGORIES) {
      const inCat = entries.filter((e) => e.category === cat.id);
      if (!inCat.length) continue;
      const group = document.createElement("section");
      group.className = `help-group cat-${cat.id}`;
      const h = document.createElement("h3");
      h.textContent = cat.id === "clues" ? t("game.cluesOfLevel") : cat.title;
      group.appendChild(h);
      const chips = document.createElement("div");
      chips.className = "chips";
      for (const entry of inCat) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = `chip cat-${cat.id}`;
        b.textContent = entry.chip;
        b.title = entry.title;
        b.addEventListener("click", () => openHelp(entry));
        chips.appendChild(b);
      }
      group.appendChild(chips);
      panel.appendChild(group);
    }
  }

  function openHelp(entry) {
    const dialog = $("help-dialog");
    const body = dialog.querySelector(".help-body");
    body.innerHTML = "";
    dialog.className = `help-dialog cat-${entry.category}`;
    window.NetdokuHelp.renderEntry(body, entry);
    dialog.showModal();
  }

  // ---------- Texto de las pistas con las redes y los equipos resaltados ----------

  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Color de la insignia de un equipo: el de su servicio, o el de cliente.
  function nodeDotColor(node) {
    if (!node) return tv("--node-server");
    if (node.type === "client") return tv("--node-client");
    return SERVICE_COLORS[(node.services || [])[0]] || tv("--node-server");
  }

  function chip(text, background, dot, extraClass) {
    const span = document.createElement("span");
    span.className = extraClass ? `clue-chip ${extraClass}` : "clue-chip";
    if (background) span.style.background = background;
    if (dot) {
      const d = document.createElement("span");
      d.className = "dot";
      d.style.background = dot;
      span.appendChild(d);
    }
    span.appendChild(document.createTextNode(text));
    return span;
  }

  // Trozos de la pista que se resaltan: nombres de red (con su prefijo, si lo
  // lleva) y prefijos en el color de la red, y el equipo nombrado en el color de
  // su red con un punto del color de su servicio. Si la pista nombra algo por
  // una dirección, una máscara o un tamaño, no se colorea: averiguar la red es
  // parte de la pista.
  function cluePatterns(c) {
    const params = c.parameters || {};
    const naming = c.naming || {};
    const patterns = [];
    const word = (s) => `(?<![\\p{L}])${s}(?![\\p{L}])`;
    // El equipo que nombra la pista, o el que da nombre a su fila o columna.
    const aligned = Object.values(c.slots || {}).find((s) => s.form === "aligned_node");
    const nodeId = params.nodeId || (aligned && aligned.value && aligned.value.node);
    if (nodeId) {
      const node = level.nodes.find((n) => n.id === nodeId);
      if (node) {
        // Nombrado por su IP o por ser de la red pública o privada: sin el color de su red.
        const form = naming.node || (aligned && aligned.value && aligned.value.form);
        const hidden = form === "ip" || form === "label_privacy";
        patterns.push({ re: new RegExp(word(escapeRe(nodeLabel(node))), "iu"),
          make: (s) => chip(s, hidden ? null : networkColor(node.network), nodeDotColor(node)) });
      }
    } else if (params.nodeType) {
      const sample = level.nodes.find((n) => n.type === params.nodeType
        && (!params.service || (n.services || []).includes(params.service)));
      const specific = params.service || params.nodeType === "client";
      const label = specific ? (sample ? nodeLabel(sample) : "") : t("nodes.server");
      // También en plural («sin servidores web»).
      const plural = t(`nodesPlural.${params.service || params.nodeType}`);
      for (const text of [label, plural]) {
        if (!text || text.startsWith("nodesPlural.")) continue;
        patterns.push({ re: new RegExp(word(escapeRe(text)), "iu"),
          make: (s) => chip(s, null, specific ? nodeDotColor(sample) : tv("--node-server")) });
      }
    }
    for (const net of level.networks) {
      patterns.push({ re: new RegExp(word(escapeRe(networkName(net))) + `(?:\\s\\(${escapeRe(net.prefix)}\\))?`, "u"),
        make: (s) => chip(s, networkColor(net.id)) });
      patterns.push({ re: new RegExp(`(?<![\\d.])${escapeRe(net.prefix)}(?![\\d])`, "u"),
        make: (s) => chip(s, networkColor(net.id)) });
    }
    // Van detrás de los prefijos: a igual posición gana el primer patrón.
    patterns.push({ re: /(?<![\d.])\d{1,3}(?:\.\d{1,3}){3}(?:\/\d{1,2})?(?![\d])/u,
      make: (s) => chip(s, null, null, "addr") });
    patterns.push({ re: /(?<![\d.\w])\/\d{1,2}(?![\d])/u, make: (s) => chip(s, null, null, "addr") });
    return patterns;
  }

  function clueContent(c) {
    const frag = document.createDocumentFragment();
    const patterns = cluePatterns(c);
    let rest = clueText(c);
    while (rest) {
      let best = null;
      for (const p of patterns) {
        const m = p.re.exec(rest);
        if (m && (!best || m.index < best.m.index)) best = { m, p };
      }
      if (!best) {
        frag.appendChild(document.createTextNode(rest));
        break;
      }
      if (best.m.index) frag.appendChild(document.createTextNode(rest.slice(0, best.m.index)));
      frag.appendChild(best.p.make(best.m[0]));
      rest = rest.slice(best.m.index + best.m[0].length);
    }
    return frag;
  }

  function networkColor(netId) {
    const i = level.networks.findIndex((n) => n.id === netId);
    return tv(`--net-${(i % NETWORK_COLOR_COUNT) + 1}`);
  }

  // ---------- Dibujo ----------

  function render() {
    renderLives();
    renderBoard();
    renderLegend();
    renderPackets();
    if (isTraining()) renderTrain();
    else renderHint();
    renderFinal();
  }

  function renderLives() {
    const el = $("lives");
    el.innerHTML = "";
    el.title = t("game.lives");
    el.setAttribute("aria-label", `${t("game.lives")}: ${state.lives}`);
    for (let i = 0; i < START_LIVES; i++) {
      const s = document.createElement("span");
      s.textContent = "♥";
      if (i >= state.lives) s.className = "lost";
      el.appendChild(s);
    }
  }

  function svg(tag, attrs, parent) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
    if (parent) parent.appendChild(el);
    return el;
  }

  function text(parent, x, y, content, attrs) {
    const el = svg("text", { x, y, "text-anchor": "middle", "pointer-events": "none", ...attrs }, parent);
    el.textContent = content;
    return el;
  }

  const px = (c) => margin + (c - 1) * CELL;
  const py = (r) => margin + (r - 1) * CELL;

  function renderBoard() {
    const { width, height, networkGrid } = level.board;
    const look = appearance();
    margin = look.numbers ? NUMBERS_MARGIN : PAD;
    const W = margin + width * CELL + PAD;
    const H = margin + height * CELL + PAD;
    const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": t("game.board") });
    root.style.setProperty("--board-ratio", W / H); // para que el CSS limite su altura a la ventana

    // Números de fila y columna, para las pistas «en la fila N».
    const num = { "font-size": 13, "font-weight": 600, fill: tv("--board-number") };
    if (look.numbers) {
      for (let r = 1; r <= height; r++) text(root, margin / 2, py(r) + CELL / 2 + 5, r, num);
      for (let c = 1; c <= width; c++) text(root, px(c) + CELL / 2, margin - 7, c, num);
    }
    const patternFor = definePatterns(root, look.pattern);

    // Casillas.
    for (let r = 1; r <= height; r++) {
      for (let c = 1; c <= width; c++) {
        const net = networkGrid[r - 1][c - 1];
        const rect = svg("rect", {
          x: px(c), y: py(r), width: CELL, height: CELL,
          fill: networkColor(net), stroke: tv("--cell-line"), "stroke-width": 1,
          class: "cell", "data-r": r, "data-c": c,
        }, root);
        rect.addEventListener("click", () => onCellClick(r, c));
        // Descartar (✕): clic derecho o, en pantallas táctiles, pulsación larga.
        rect.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          if (longPress.handled) { longPress.handled = false; return; }
          toggleMark(r, c);
        });
        rect.addEventListener("pointerdown", (e) => startLongPress(e, r, c));
        const pattern = patternFor(net);
        if (pattern) {
          svg("rect", { x: px(c), y: py(r), width: CELL, height: CELL, fill: `url(#${pattern})`, "pointer-events": "none" }, root);
        }
      }
    }

    // Casillas de las que habla la sugerencia.
    for (const [r, c] of hintCells()) {
      svg("rect", {
        x: px(c) + 3, y: py(r) + 3, width: CELL - 6, height: CELL - 6, rx: 6,
        fill: tv("--hint-fill"), stroke: tv("--hint"), "stroke-width": 3, "stroke-dasharray": "7 4", "pointer-events": "none",
      }, root);
    }

    // Bordes entre redes y borde exterior.
    const wall = { stroke: tv("--wall"), "stroke-width": 4, "stroke-linecap": "round" };
    for (let r = 1; r <= height; r++) {
      for (let c = 1; c <= width; c++) {
        const net = networkGrid[r - 1][c - 1];
        if (c === width || networkGrid[r - 1][c] !== net) svg("line", { x1: px(c + 1), y1: py(r), x2: px(c + 1), y2: py(r + 1), ...wall }, root);
        if (r === height || networkGrid[r][c - 1] !== net) svg("line", { x1: px(c), y1: py(r + 1), x2: px(c + 1), y2: py(r + 1), ...wall }, root);
        if (c === 1) svg("line", { x1: px(1), y1: py(r), x2: px(1), y2: py(r + 1), ...wall }, root);
        if (r === 1) svg("line", { x1: px(c), y1: py(1), x2: px(c + 1), y2: py(1), ...wall }, root);
      }
    }

    // Marcas del jugador.
    for (const key of state.marks) {
      const [r, c] = key.split(",").map(Number);
      text(root, px(c) + CELL / 2, py(r) + CELL / 2 + 10, "✕", { "font-size": 30, fill: tv("--mark") });
    }
    if (isTraining()) drawTraining(root);

    // Notas: circulito del color del paquete, siempre en la misma posición de la casilla.
    const order = level.packets.items.map((p) => p.id);
    const noteGrid = notesLayout(order.length);
    for (const [key, ids] of state.notes) {
      const [r, c] = key.split(",").map(Number);
      for (const id of ids) {
        const i = order.indexOf(id);
        const p = packetById(id);
        if (i < 0 || !p) continue;
        const cx = px(c) + noteGrid.start + (i % noteGrid.cols) * noteGrid.step;
        const cy = py(r) + noteGrid.start - 1 + Math.floor(i / noteGrid.cols) * noteGrid.rowStep;
        svg("circle", { cx, cy, r: noteGrid.radius, fill: p.color, opacity: 0.85, "pointer-events": "none" }, root);
        text(root, cx, cy + noteGrid.font * 0.36, id, { "font-size": noteGrid.font, "font-weight": 700, fill: "#fff" });
      }
    }

    for (const n of level.nodes) drawNode(root, n);
    drawRouteEnds(root);
    if (look.netNames) drawNetworkNames(root);

    // Paquetes colocados.
    for (const [id, [r, c]] of Object.entries(state.placed)) {
      const p = packetById(id);
      svg("circle", { cx: px(c) + CELL / 2, cy: py(r) + CELL / 2, r: 22, fill: p.color, stroke: tv("--token-edge"), "stroke-width": 2, "pointer-events": "none" }, root);
      text(root, px(c) + CELL / 2, py(r) + CELL / 2 + 7, id, { "font-size": 20, "font-weight": 700, fill: "#fff" });
    }

    // Routers, encima de los bordes (o del vértice, si unen tres o cuatro redes).
    for (const rt of level.routers) {
      const [cx, cy] = routerCenter(rt);
      const g = svg("g", {}, root);
      if (routing() && tableFocus && tableFocus.id === rt.id) {
        svg("circle", { cx, cy, r: 19, fill: "none", stroke: tv("--hint"), "stroke-width": 3 }, g);
      }
      svg("circle", { cx, cy, r: 14, fill: tv("--router"), stroke: tv("--router-edge"), "stroke-width": 2 }, g);
      // Flechas cruzadas: símbolo habitual de router.
      const arrow = { stroke: "#fff", "stroke-width": 2, "stroke-linecap": "round", fill: "none" };
      svg("path", { d: `M${cx - 7} ${cy - 3} h14 m-4 -4 l4 4 l-4 4`, ...arrow }, g);
      svg("path", { d: `M${cx + 7} ${cy + 4} h-14 m4 -4 l-4 4 l4 4`, ...arrow, opacity: 0.75 }, g);
      svg("title", {}, g).textContent = routerTitle(rt);
      if (routing()) {
        // Tabla de enrutamiento: nombre del router y su tabla al tocarlo (o al pasar el ratón).
        g.setAttribute("class", "router-hit");
        text(g, cx + 18, cy - 12, rt.id, {
          "font-size": 13, "font-weight": 700, fill: tv("--router"),
          stroke: tv("--panel"), "stroke-width": 3, "paint-order": "stroke",
        });
        g.addEventListener("click", (e) => { e.stopPropagation(); openTable(rt.id, true); });
        g.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") openTable(rt.id, false); });
        g.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") closeTable(false); });
      }
    }

    const wrap = $("board-wrap");
    wrap.innerHTML = "";
    wrap.appendChild(root);
    renderRouterTable();
  }

  function routerCenter(rt) {
    const cells = routerCells(rt);
    return [cells.reduce((sum, [, c]) => sum + px(c), 0) / cells.length + CELL / 2,
      cells.reduce((sum, [r]) => sum + py(r), 0) / cells.length + CELL / 2];
  }

  // Nombre de cada red dentro del tablero, como las habitaciones de Murdoku:
  // en la parte baja de una casilla sin nodo, preferiblemente con otra casilla
  // libre de la misma red a la derecha para que el texto quepa.
  function drawNetworkNames(root) {
    const { width, height, networkGrid } = level.board;
    const nodeAt = new Set(level.nodes.map((n) => n.position.join(",")));
    // Casillas con un router en su borde inferior: el router taparía el texto.
    const routerBelow = new Set();
    for (const rt of level.routers) {
      const cells = routerCells(rt);
      if (cells.length === 4) {
        // En una esquina, el router tapa el borde inferior de las dos casillas de arriba.
        const top = Math.min(...cells.map(([r]) => r));
        cells.filter(([r]) => r === top).forEach(([r, c]) => routerBelow.add(`${r},${c}`));
        continue;
      }
      const [[r1, c1], [r2, c2]] = cells;
      if (c1 === c2) routerBelow.add(`${Math.min(r1, r2)},${c1}`);
    }
    const free = (r, c) => r >= 1 && r <= height && c >= 1 && c <= width
      && !nodeAt.has(`${r},${c}`) && !routerBelow.has(`${r},${c}`);
    for (const net of level.networks) {
      let best = null;
      for (const [r, c] of net.cells) {
        if (!free(r, c)) continue;
        let span = 1;
        while (span < 3 && free(r, c + span) && networkGrid[r - 1][c + span - 1] === net.id) span++;
        const score = r * 10 + Math.min(span, 2) * 6 - c;
        if (!best || score > best.score) best = { r, c, span, score };
      }
      if (!best) continue;
      const label = networkName(net).toUpperCase();
      const available = best.span * CELL - 10;
      const estimated = label.length * 7.4;
      const attrs = {
        "text-anchor": "start", "font-size": 12, "font-weight": 800, "letter-spacing": "0.03em",
        fill: tv("--label-ink"), stroke: tv("--label-halo"), "stroke-width": 3, "paint-order": "stroke",
      };
      if (estimated > available) Object.assign(attrs, { textLength: available, lengthAdjust: "spacingAndGlyphs" });
      text(root, px(best.c) + 5, py(best.r) + CELL - 6, label, attrs);
    }
  }

  // Texturas de las casillas (patrones SVG alineados con el tablero). Devuelve
  // una función red -> id de patrón (o null si la casilla va lisa).
  function definePatterns(root, mode) {
    if (!mode || mode === "plain") return () => null;
    const defs = svg("defs", {}, root);
    const ink = tv("--pattern-ink");
    const made = new Set();
    const make = (kind) => {
      const id = `pat-${kind}`;
      if (kind === "plain" || made.has(id)) return kind === "plain" ? null : id;
      made.add(id);
      const size = kind === "tiles" ? CELL / 2 : 16;
      const p = svg("pattern", { id, width: size, height: size, patternUnits: "userSpaceOnUse", x: margin, y: margin }, defs);
      const line = { stroke: ink, "stroke-width": 1.5, fill: "none" };
      switch (kind) {
        case "dots": svg("circle", { cx: 8, cy: 8, r: 1.7, fill: ink }, p); break;
        case "stripes": svg("path", { d: "M-4 4 L4 -4 M0 16 L16 0 M12 20 L20 12", ...line }, p); break;
        case "tiles": svg("rect", { x: 0.75, y: 0.75, width: size - 1.5, height: size - 1.5, rx: 3, ...line }, p); break;
        case "cross": svg("path", { d: "M0 0 L16 16 M16 0 L0 16", ...line, "stroke-width": 1 }, p); break;
        case "waves": svg("path", { d: "M0 8 Q4 4 8 8 T16 8", ...line }, p); break;
      }
      return id;
    };
    if (mode !== "perNetwork") return () => make(mode);
    return (netId) => {
      const i = level.networks.findIndex((n) => n.id === netId);
      return make(PER_NETWORK_PATTERNS[i % PER_NETWORK_PATTERNS.length]);
    };
  }

  function drawNode(root, n) {
    const [r, c] = n.position;
    const style = appearance().icons;
    const x = px(c);
    const y = py(r);
    const cx = x + CELL / 2;
    // Con «dibujos con texto», el dibujo sube para dejar sitio al rótulo.
    const cy = y + CELL / 2 - 2 - (style === "both" ? 7 : 0);
    const g = svg("g", { "pointer-events": "none" }, root);
    svg("rect", { x: x + 9, y: y + 9, width: CELL - 18, height: CELL - 18, rx: 10, fill: tv(n.type === "client" ? "--node-client" : "--node-server"), stroke: tv("--node-edge"), "stroke-width": 1.5 }, g);
    const caption = nodeCaption(n);

    if (style === "text") {
      text(g, cx, y + CELL / 2 + 5, caption, { "font-size": caption.length > 6 ? 12 : 15, "font-weight": 700, fill: tv("--node-part") });
    } else if (n.type === "client") {
      // Monitor.
      svg("rect", { x: cx - 17, y: cy - 15, width: 34, height: 24, rx: 3, fill: tv("--node-screen"), stroke: tv("--node-part"), "stroke-width": 2 }, g);
      svg("rect", { x: cx - 3, y: cy + 9, width: 6, height: 6, fill: tv("--node-part") }, g);
      svg("rect", { x: cx - 10, y: cy + 14, width: 20, height: 3, rx: 1.5, fill: tv("--node-part") }, g);
    } else {
      // Rack de servidor.
      for (let i = 0; i < 3; i++) {
        svg("rect", { x: cx - 17, y: cy - 17 + i * 12, width: 34, height: 10, rx: 2, fill: tv("--node-part") }, g);
        svg("circle", { cx: cx + 11, cy: cy - 12 + i * 12, r: 1.8, fill: "#36c26f" }, g);
        svg("rect", { x: cx - 13, y: cy - 13 + i * 12, width: 14, height: 2, fill: "#8a939e" }, g);
      }
      const service = (n.services || [])[0];
      if (service && style !== "both") drawServiceBadge(g, service, x + CELL - 17, y + CELL - 17);
    }
    if (style === "both") {
      text(g, cx, y + CELL - 14, caption, { "font-size": 10, "font-weight": 700, fill: tv("--node-part") });
    }
    svg("title", {}, g).textContent = `${capitalize(nodeLabel(n))} (${n.id})`;
  }

  // Encaminamiento: recuadro del color del paquete en su equipo de origen y en
  // el de destino, con su rótulo. Se ven al pasar el ratón por su ficha o con
  // el paquete seleccionado (en pantallas táctiles no hay ratón).
  function drawRouteEnds(root) {
    const p = packetById(routeFocus || state.selected);
    if (!p || !p.origin) return;
    const ends = [[endNode(p, "origin"), "game.originTag"], [endNode(p, "destination"), "game.destinationTag"]];
    for (const [id, key] of ends) {
      const n = id && level.nodes.find((x) => x.id === id);
      if (!n) continue;
      const [r, c] = n.position;
      const g = svg("g", { "pointer-events": "none" }, root);
      svg("rect", { x: px(c) + 3, y: py(r) + 3, width: CELL - 6, height: CELL - 6, rx: 12, fill: "none", stroke: p.color, "stroke-width": 5 }, g);
      const label = t(key);
      const w = 8 + label.length * 6.4;
      svg("rect", { x: px(c) + CELL / 2 - w / 2, y: py(r) - 2, width: w, height: 15, rx: 7, fill: p.color }, g);
      text(g, px(c) + CELL / 2, py(r) + 9, label, { "font-size": 11, "font-weight": 700, fill: "#fff" });
    }
  }

  function drawServiceBadge(g, service, bx, by) {
    svg("circle", { cx: bx, cy: by, r: 12, fill: SERVICE_COLORS[service] || "#555", stroke: "#fff", "stroke-width": 2 }, g);
    const line = { stroke: "#fff", "stroke-width": 1.6, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" };
    switch (service) {
      case "web": // Globo.
        svg("circle", { cx: bx, cy: by, r: 6.5, ...line }, g);
        svg("ellipse", { cx: bx, cy: by, rx: 3, ry: 6.5, ...line }, g);
        svg("path", { d: `M${bx - 6.5} ${by} h13`, ...line }, g);
        break;
      case "mail": // Sobre.
        svg("rect", { x: bx - 7, y: by - 5, width: 14, height: 10, rx: 1, ...line }, g);
        svg("path", { d: `M${bx - 7} ${by - 5} l7 6 l7 -6`, ...line }, g);
        break;
      case "storage": // Carpeta.
        svg("path", { d: `M${bx - 7} ${by - 5} h5 l2 2 h7 v9 h-14 z`, ...line }, g);
        break;
      case "multimedia": // Reproducir.
        svg("path", { d: `M${bx - 3} ${by - 6} l8 6 l-8 6 z`, fill: "#fff" }, g);
        break;
      default: // DNS y otros: siglas.
        text(g, bx, by + 3, service === "dns" ? "DNS" : service.slice(0, 3).toUpperCase(), { "font-size": 7.5, "font-weight": 800, fill: "#fff" });
    }
  }

  // ---------- Interacción ----------

  function onTokenDown(e, id) {
    e.preventDefault();
    const ghost = $("drag-ghost");
    const p = packetById(id);
    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;

    function move(ev) {
      if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 6) {
        dragging = true;
        ghost.textContent = id;
        ghost.style.background = p.color;
        ghost.hidden = false;
      }
      if (dragging) {
        ghost.style.left = ev.clientX + "px";
        ghost.style.top = ev.clientY + "px";
      }
    }

    function finish(ev, dropped) {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      ghost.hidden = true;
      if (!dropped) return;
      if (dragging) {
        const target = document.elementFromPoint(ev.clientX, ev.clientY);
        if (target && target.classList && target.classList.contains("cell")) {
          const r = Number(target.dataset.r);
          const c = Number(target.dataset.c);
          state.mode === "note" ? toggleNote(id, r, c) : tryPlace(id, r, c);
        }
      } else {
        state.selected = state.selected === id ? null : id;
        renderPackets();
      }
    }

    const up = (ev) => finish(ev, true);
    const cancel = (ev) => finish(ev, false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  }

  // Posición de las notas: 3 por fila hasta 9 paquetes; si hay más, 4 por fila y más pequeñas.
  function notesLayout(count) {
    const cols = count <= 9 ? 3 : 4;
    const step = (CELL - 8) / cols;
    return { cols, step, rowStep: Math.min(step, 22), start: 4 + step / 2, radius: Math.min(9, step / 2 - 2), font: cols === 3 ? 11 : 9 };
  }

  // Pulsación larga en táctil = clic derecho.
  const longPress = { timer: null, handled: false, suppressClick: false };

  function startLongPress(e, r, c) {
    if (e.pointerType !== "touch") return;
    clearTimeout(longPress.timer);
    longPress.handled = false;
    const cancel = () => {
      clearTimeout(longPress.timer);
      window.removeEventListener("pointerup", cancel);
      window.removeEventListener("pointermove", cancel);
    };
    longPress.timer = setTimeout(() => {
      longPress.handled = true;
      longPress.suppressClick = true;
      cancel();
      toggleMark(r, c);
    }, 500);
    window.addEventListener("pointerup", cancel);
    window.addEventListener("pointermove", cancel);
  }

  function onCellClick(r, c) {
    if (isOver()) return;
    if (longPress.suppressClick) { longPress.suppressClick = false; return; }
    if (isTraining()) { trainClick(r, c); return; }
    if (!state.selected) {
      if (state.mode === "note") say(t("game.selectFirst"), "");
      return;
    }
    state.mode === "note" ? toggleNote(state.selected, r, c) : tryPlace(state.selected, r, c);
  }

  function toggleNote(id, r, c) {
    if (isOver() || id in state.placed || occupied(r, c)) return;
    const key = `${r},${c}`;
    const ids = state.notes.get(key) || new Set();
    ids.has(id) ? ids.delete(id) : ids.add(id);
    if (ids.size) state.marks.delete(key); // una nota y una ✕ no conviven
    if (ids.size) state.notes.set(key, ids);
    else state.notes.delete(key);
    save();
    renderBoard();
  }

  function setMode(mode) {
    state.mode = mode;
    const noting = mode === "note";
    $("note-mode").checked = noting;
    $("mode-label").textContent = noting ? t("game.modeNote") : t("game.modePlace");
    $("board-wrap").classList.toggle("noting", noting);
    document.querySelector(".modebar").classList.toggle("noting", noting);
  }

  function toggleMark(r, c) {
    if (isOver()) return;
    if (isTraining()) { trainClick(r, c); return; } // en el entrenamiento, clic derecho = clic
    const key = `${r},${c}`;
    if (occupied(r, c)) return;
    if (state.marks.has(key)) {
      state.marks.delete(key);
      if (state.hint && state.hint.kind === "mark" && state.hint.cell.join(",") === key) {
        state.hint = null;
        renderHint();
        renderPackets();
      }
    } else {
      state.marks.add(key);
      state.notes.delete(key); // al descartar una casilla se borran sus notas
    }
    save();
    renderBoard();
  }

  function renderLegend() {
    const el = $("legend");
    el.innerHTML = "";
    for (const n of level.networks) {
      const item = document.createElement("div");
      const sw = document.createElement("span");
      sw.className = "swatch";
      sw.style.background = networkColor(n.id);
      item.appendChild(sw);
      item.appendChild(document.createTextNode(`${networkName(n)} · ${n.prefix}`));
      const gw = gatewayText(n.id);
      if (gw) {
        const g = document.createElement("span");
        g.className = "gateway";
        g.textContent = t("tables.gatewayOf", { gw });
        item.appendChild(g);
      }
      el.appendChild(item);
    }
  }

  // Encaminamiento: el origen o el destino de un paquete puede estar oculto en su
  // ficha ({hidden: true}) hasta que se resuelve el nivel.
  function hasHiddenEnd(p) {
    return !!((p.origin && p.origin.hidden) || (p.destination && p.destination.hidden));
  }

  // Equipo de origen o de destino que se puede mostrar (null si está oculto o es una difusión).
  function endNode(p, end) {
    const e = p[end] || {};
    const shown = state.solved || (state.train && state.train.finished);
    if (e.hidden) return shown ? (p.solution || {})[end] || null : null;
    return e.node || null;
  }

  function renderPackets() {
    const el = $("packets");
    el.innerHTML = "";
    const focus = hintFocus();
    for (const p of level.packets.items) {
      const card = document.createElement("div");
      card.className = "packet-card";
      if (state.selected === p.id) card.classList.add("selected");
      if (focus.packets.has(p.id)) card.classList.add("hinted");
      if (isTraining() && trainStep().packet === p.id) card.classList.add("selected");
      const placed = p.id in state.placed;
      // Un paquete colocado se compacta; sus pistas se pueden desplegar de nuevo. En el
      // entrenamiento, no: su ruta y su TTL suelen hacer falta.
      const open = !placed || expanded.has(p.id) || isTraining();
      if (placed) card.classList.add("placed");
      if (!open) card.classList.add("compact");
      if (p.origin) {
        card.addEventListener("mouseenter", () => { routeFocus = p.id; renderBoard(); });
        card.addEventListener("mouseleave", () => { if (routeFocus === p.id) { routeFocus = null; renderBoard(); } });
      }

      const token = document.createElement("div");
      token.className = "token" + (placed ? " placed" : "");
      token.style.background = p.color;
      token.textContent = p.id;
      if (!placed && !isOver() && !isTraining()) token.addEventListener("pointerdown", (e) => onTokenDown(e, p.id));
      card.appendChild(token);

      const title = document.createElement("div");
      title.className = "title";
      title.textContent = t("game.packet", { id: p.id });
      if (p.id === level.objective.victimPacketId) {
        const b = document.createElement("span");
        b.className = "badge";
        b.textContent = t("game.victim");
        title.appendChild(b);
      }
      card.appendChild(title);

      const clues = cluesOf(p.id);
      if (placed) {
        const [r, c] = state.placed[p.id];
        const where = document.createElement("span");
        where.className = "where";
        where.textContent = t("game.where", { r, c });
        title.appendChild(where);
        if (clues.length && !isTraining()) {
          const toggle = document.createElement("button");
          toggle.type = "button";
          toggle.className = "toggle";
          toggle.textContent = open ? t("game.hide") : t("game.showClues", { n: clues.length });
          toggle.setAttribute("aria-expanded", open);
          toggle.addEventListener("click", () => {
            expanded.has(p.id) ? expanded.delete(p.id) : expanded.add(p.id);
            renderPackets();
          });
          title.appendChild(toggle);
        }
      }
      if (open && p.origin) card.appendChild(routeInfo(p));
      if (!open) {
        // Compacto: solo ficha, nombre, posición y el botón para desplegar.
      } else if (clues.length) {
        const ul = document.createElement("ul");
        for (const c of clues) {
          const li = document.createElement("li");
          li.appendChild(clueContent(c));
          if (state.struck.has(c.id)) li.className = "done";
          if (focus.clues.has(c.id)) li.classList.add("hinted");
          li.addEventListener("click", () => {
            state.struck.has(c.id) ? state.struck.delete(c.id) : state.struck.add(c.id);
            save();
            renderPackets();
          });
          ul.appendChild(li);
        }
        card.appendChild(ul);
      } else {
        const none = document.createElement("div");
        none.className = "no-clues";
        none.textContent = p.id === level.objective.victimPacketId ? t("game.noCluesVictim") : t("game.noClues");
        card.appendChild(none);
      }
      el.appendChild(card);
    }
  }

  // Origen, destino y TTL inicial de un paquete (Encaminamiento). El destino de
  // difusión se escribe con su dirección, sin el color de su red.
  function routeInfo(p) {
    const box = document.createElement("div");
    box.className = "route-info";
    const endpoint = (id) => {
      const node = level.nodes.find((n) => n.id === id);
      return chip(t("game.endpoint", { label: nodeLabel(node), net: networkName(networkById(node.network)) }),
        networkColor(node.network), nodeDotColor(node));
    };
    const row = (key, content) => {
      const line = document.createElement("div");
      const label = document.createElement("span");
      label.className = "label";
      label.textContent = `${t(key)}: `;
      line.append(label, content);
      box.appendChild(line);
    };
    // Extremo oculto: «?» hasta resolver el nivel; entonces, el equipo.
    const unknown = () => chip(t("game.unknownEndpoint"), null, null, "addr unknown");
    const end = (e, key) => (e.hidden ? (endNode(p, key) ? endpoint(endNode(p, key)) : unknown()) : null);
    row("game.origin", end(p.origin, "origin") || endpoint(p.origin.node));
    row("game.destination", end(p.destination, "destination") || (p.destination.node ? endpoint(p.destination.node)
      : chip(t("game.broadcastTo", { address: p.destination.broadcast }), null, null, "addr")));
    if (p.destination.ip) row("game.destinationIp", chip(p.destination.ip, null, null, "addr"));
    row("game.ttlInitial", document.createTextNode(String(p.ttl.initial)));
    return box;
  }

  // Recuadro final: nivel resuelto (estrellas y atacante) o sin vidas, con los
  // botones que da app.js (otro nivel, siguiente dificultad…).
  function renderFinal() {
    const box = $("final");
    box.innerHTML = "";
    box.className = "final";
    const para = (content) => {
      const p = document.createElement("p");
      p.textContent = content;
      box.appendChild(p);
    };

    if (isTraining()) {
      if (!state.train.finished) {
        box.hidden = true;
        return;
      }
      box.classList.add("solved");
      para(t(state.train.revealed ? "train.doneRevealed" : "train.done"));
    } else if (state.solved) {
      const attacker = level.objective.observableAnswer.attackerPacketId;
      const victim = level.objective.victimPacketId;
      const net = networkById(level.solution.victimNetwork);
      box.classList.add("solved");
      const stars = document.createElement("div");
      stars.className = "stars";
      stars.textContent = "★".repeat(state.lives) + "☆".repeat(START_LIVES - state.lives);
      stars.setAttribute("aria-label", t("game.stars", { n: state.lives, max: START_LIVES }));
      box.appendChild(stars);
      const errors = START_LIVES - state.lives - state.hints;
      para(errors === 0 && !state.hints ? t("game.perfect") : t("game.result", { errors, hints: state.hints }));
      if (state.result && state.result.best != null) para(t("game.best", { n: state.result.best }));
      if (state.result && state.result.unlocked) para(t("game.unlocked"));
      para(t("game.attacker", { attacker, net: net ? networkName(net) : "", victim }));
    } else if (state.lost) {
      box.classList.add("lost");
      para(t("game.lost"));
    } else {
      box.hidden = true;
      return;
    }
    const actions = options.actions ? options.actions(state) : [];
    if (actions.length) {
      const row = document.createElement("div");
      row.className = "final-actions";
      for (const a of actions) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "button" + (a.primary ? " primary" : "");
        b.textContent = a.label;
        b.addEventListener("click", a.onClick);
        row.appendChild(b);
      }
      box.appendChild(row);
    }
    box.hidden = false;
  }

  // Qué ocupa una casilla: null, "node" o el id del paquete.
  function occupied(r, c) {
    if (level.nodes.some((n) => n.position[0] === r && n.position[1] === c)) return "node";
    const other = Object.entries(state.placed).find(([, pos]) => pos[0] === r && pos[1] === c);
    return other ? other[0] : null;
  }

  // Regla básica: como mucho un paquete por fila y por columna.
  function lineConflict(r, c) {
    const rules = level.rules || {};
    for (const [id, [pr, pc]] of Object.entries(state.placed)) {
      if (rules.onePacketPerRow !== false && pr === r) return t("game.rowTaken", { r, id });
      if (rules.onePacketPerColumn !== false && pc === c) return t("game.columnTaken", { c, id });
    }
    return null;
  }

  function tryPlace(id, r, c) {
    if (isOver() || id in state.placed) return;
    const busy = occupied(r, c);
    if (busy) {
      say(busy === "node" ? t("game.occupiedNode") : t("game.occupiedPacket", { id: busy }), "bad");
      return;
    }
    const conflict = lineConflict(r, c);
    if (conflict) {
      say(`${conflict} ${t("game.oneEach")}`, "bad");
      return;
    }
    const [sr, sc] = packetById(id).solution.position;
    state.selected = null;
    if (sr === r && sc === c) {
      state.placed[id] = [r, c];
      state.marks.delete(`${r},${c}`);
      // La sugerencia llevaba a este paquete: ya está cumplida.
      if (state.hint && state.hint.kind === "deduction" && state.hint.target === id) state.hint = null;
      // Fuera las notas de ese paquete y las de esa casilla (no es una deducción).
      state.notes.delete(`${r},${c}`);
      for (const [key, ids] of state.notes) {
        ids.delete(id);
        if (!ids.size) state.notes.delete(key);
      }
      // Con todos colocados, el atacante es evidente (el otro paquete de la
      // red de la víctima): el nivel queda resuelto sin preguntar.
      if (allPlaced()) {
        state.solved = true;
        state.result = options.onSolve ? options.onSolve(state.lives) || null : null;
      }
      save();
      say(state.solved ? t("game.solved") : t("game.placedOk", { id }), "good");
      render();
    } else {
      loseLife(t("game.wrongCell", { id, r, c }));
      const cell = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
      if (cell) cell.classList.add("wrong");
    }
  }

  // ---------- Entrenamiento ----------
  // Un ejercicio (level.training, véase generator/netdoku_gen/training.py) enseña
  // una pista o una regla en un tablero pequeño. En cada paso el jugador pulsa
  // casillas: las posibles de un paquete (`possible`), las imposibles
  // (`impossible`, con ✕) o las que quedan descartadas para los demás paquetes
  // (`annul`, con ✕). Una casilla que no toca no se marca: se explica por qué.
  // Los fallos no cuentan; la explicación y la solución se pueden ver siempre.

  const isTraining = () => !!(state && state.train);
  const keyOf = ([r, c]) => `${r},${c}`;

  function newTrainState() {
    return { step: 0, marks: new Set(), stepDone: false, explain: false, finished: false, revealed: false };
  }

  function trainStep() {
    return level.training.steps[state.train.step];
  }

  function trainSets(s) {
    return {
      answer: new Set(s.answer.map(keyOf)),
      extra: new Set((s.extra || []).map(keyOf)),
      given: new Set((s.given || []).map(keyOf)),
    };
  }

  // Los motivos y las explicaciones citan redes, equipos y routers por su
  // identificador: aquí pasan a sus nombres en el idioma activo.
  function trainVars(o) {
    const v = { ...o };
    const net = (id) => networkName(networkById(id) || { name: id });
    for (const k of ["net", "otherNet", "reach"]) if (o[k]) v[k] = net(o[k]);
    for (const k of ["nets", "tags", "route"]) if (Array.isArray(o[k])) v[k] = o[k].map(net);
    if (o.node) {
      const n = level.nodes.find((x) => x.id === o.node);
      if (n) Object.assign(v, { node: nodeLabel(n), nodeNet: net(n.network) });
    }
    if (o.router) {
      const rt = level.routers.find((x) => x.id === o.router);
      if (rt) v.router = rt.connectedNetworks.map(net);
    }
    if (o.cls) {
      v.clsKey = o.cls.service || o.cls.nodeType;
      v.cls = t(`nodes.${v.clsKey}`);
    }
    if (routing()) Object.assign(v, tableVars(o));
    return v;
  }

  // Entrenar (Tabla de enrutamiento): la puerta de enlace y las consultas se calculan con
  // los datos del ejercicio (la IP de destino de la ficha o la dirección de la forma).
  function tableVars(o) {
    const v = {};
    if (o.key === "tableGateway" || o.key === "fGateway") v.gw = gatewayText(o.net);
    const p = o.packet ? packetById(o.packet) : null;
    const ip = o.ip || (o.key === "tableLookup" && p && p.destination ? p.destination.ip : null);
    if (o.at && ip) {
      const { matches, entry } = lookup(o.at, ip.split("/")[0]);
      if (entry) {
        Object.assign(v, {
          ip, matches: matches.map((e) => e.prefix), winner: prefixText(entry.prefix),
          hop: entry.direct ? t("tables.direct") : hopText(o.at, entry.via), isDefault: entry.prefix === DEFAULT_ROUTE,
        });
      }
    }
    return v;
  }

  const trainText = (group, o) => t(`train.${group}.${o.key}`, trainVars(o));

  function trainClick(r, c) {
    const tr = state.train;
    if (tr.stepDone) return;
    const busy = occupied(r, c);
    if (busy) {
      say(busy === "node" ? t("game.occupiedNode") : t("game.occupiedPacket", { id: busy }), "bad");
      return;
    }
    const key = `${r},${c}`;
    const s = trainStep();
    if (tr.marks.has(key)) {
      tr.marks.delete(key);
      say("");
    } else {
      const sets = trainSets(s);
      if (!sets.answer.has(key) && !sets.extra.has(key)) {
        const reason = s.reasons[key];
        say(reason ? trainText("reasons", reason) : t("train.wrong"), "bad");
        renderBoard();
        const cell = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
        if (cell) cell.classList.add("wrong");
        return;
      }
      tr.marks.add(key);
      const why = s.why && s.why[key];
      say(why ? trainText("reasons", why) : sets.answer.has(key) ? "" : t("train.extraOk"), "good");
      if (s.answer.every((x) => tr.marks.has(keyOf(x)))) finishStep(false);
    }
    render();
  }

  function finishStep(revealed) {
    const tr = state.train;
    tr.stepDone = true;
    tr.explain = true;
    if (revealed) tr.revealed = true;
    if (tr.step === level.training.steps.length - 1) {
      tr.finished = true;
      if (options.onSolve) options.onSolve(!tr.revealed);
    }
    if (!revealed) say(t(tr.finished ? "train.finished" : "train.stepDone"), "good");
  }

  function nextStep() {
    const tr = state.train;
    Object.assign(tr, { step: tr.step + 1, marks: new Set(), stepDone: false, explain: false });
    say("");
    render();
  }

  function revealStep() {
    state.train.marks = new Set(trainStep().answer.map(keyOf));
    say("");
    finishStep(true);
    render();
  }

  // En el tablero: las casillas marcadas (círculo del paquete o ✕), las posibles
  // del paquete que da el paso (círculo discontinuo) y, con el paso resuelto, las
  // que también valían sin hacer falta (borde discontinuo).
  function drawTraining(root) {
    const tr = state.train;
    const s = trainStep();
    const p = packetById(s.packet);
    const sets = trainSets(s);
    const at = (key) => key.split(",").map(Number);
    const ring = (key, faint) => {
      const [r, c] = at(key);
      const cx = px(c) + CELL / 2;
      const cy = py(r) + CELL / 2;
      svg("circle", {
        cx, cy, r: 21, fill: p.color, "fill-opacity": faint ? 0.18 : 0.5, stroke: p.color, "stroke-width": 3,
        "stroke-dasharray": faint ? "6 4" : "none", "pointer-events": "none",
      }, root);
      text(root, cx, cy + 6, s.packet, {
        "font-size": 17, "font-weight": 700, fill: tv("--label-ink"), stroke: tv("--label-halo"), "stroke-width": 3, "paint-order": "stroke",
      });
    };
    for (const key of sets.given) ring(key, true);
    if (tr.stepDone) {
      for (const key of sets.extra) {
        if (tr.marks.has(key)) continue;
        const [r, c] = at(key);
        svg("rect", {
          x: px(c) + 4, y: py(r) + 4, width: CELL - 8, height: CELL - 8, rx: 6, fill: "none",
          stroke: tv("--mark"), "stroke-width": 2.5, "stroke-dasharray": "6 4", "pointer-events": "none",
        }, root);
      }
    }
    for (const key of tr.marks) {
      if (s.ask === "possible") {
        ring(key, false);
      } else {
        const [r, c] = at(key);
        text(root, px(c) + CELL / 2, py(r) + CELL / 2 + 10, "✕", { "font-size": 30, fill: tv("--mark") });
      }
    }
  }

  // Recuadro del ejercicio (en el sitio de las sugerencias): qué hay que marcar,
  // cuántas casillas lleva, la explicación y los botones.
  function renderTrain() {
    const box = $("hint");
    box.innerHTML = "";
    box.className = "hint-box train-box";
    const tr = state.train;
    const steps = level.training.steps;
    const s = trainStep();
    const add = (tag, content, parent, className) => {
      const e = document.createElement(tag);
      if (content) e.textContent = content;
      if (className) e.className = className;
      (parent || box).appendChild(e);
      return e;
    };
    add("h3", steps.length > 1 ? t("train.stepOf", { n: tr.step + 1, total: steps.length }) : t("train.task"));
    add("p", t(`train.ask.${s.ask}`, { packet: s.packet }), box, "ask");
    if (s.given) add("p", t("train.given", { packet: s.packet }), box, "hint-note");
    const found = s.answer.filter((x) => tr.marks.has(keyOf(x))).length;
    add("p", t("train.count", { n: found, total: s.answer.length }), box, "progress");
    if (tr.explain) {
      add("h4", t("train.explanation"));
      const ul = add("ul");
      for (const f of s.explain) add("li", trainText("facts", f), ul);
      if (tr.stepDone && s.extra && s.extra.length) add("p", t("train.extraNote"), box, "hint-note");
    }
    const row = add("div", "", box, "hint-actions");
    const button = (label, onClick, primary) => {
      const b = add("button", label, row, primary ? "button primary" : "button");
      b.type = "button";
      b.addEventListener("click", onClick);
    };
    if (!tr.explain) button(t("train.explain"), () => { tr.explain = true; renderTrain(); });
    if (!tr.stepDone) button(t("train.reveal"), revealStep);
    else if (tr.step < steps.length - 1) button(t("train.next"), nextStep, true);
    box.hidden = false;
  }

  // ---------- Sugerencias ----------

  // Se puede pedir con más de una vida: cuesta una y no debe hacer perder el nivel.
  function hintState() {
    if (isOver()) return "over";
    if (!window.NetdokuHints || !window.NetdokuHints.supported(level)) return "unsupported";
    if (state.lives <= 1) return "noLives";
    return "ok";
  }

  function askHint() {
    if (hintState() !== "ok") return;
    state.asking = true;
    renderHint();
  }

  function useHint() {
    state.asking = false;
    if (hintState() !== "ok") return renderHint();
    const hint = window.NetdokuHints.next(level, state.placed, state.marks);
    if (!hint) {
      say(t("hint.none"), "bad");
      renderHint();
      return;
    }
    state.lives -= 1;
    state.hints += 1;
    state.hint = hint;
    state.hintStep = 0;
    save();
    render();
    say(t("hint.used"), "");
  }

  function closeHint() {
    state.hint = null;
    save();
    render();
  }

  // Lista con la conjunción del idioma: «A, B y C», «A, B, and C».
  function list(items) {
    try {
      return new Intl.ListFormat(I18n.current(), { type: "conjunction" }).format(items.map(String));
    } catch (err) {
      return items.join(", ");
    }
  }

  function hintText(s, i) {
    switch (s.t) {
      case "single":
        if (i > 0) return t("hint.singleAfter", { packet: s.packet });
        return t(s.route ? "hint.singleRoute" : "hint.single", { packet: s.packet });
      case "line":
        return t(s.axis === "row" ? "hint.lineRow" : "hint.lineColumn", { packet: s.packet, n: s.line });
      case "annul":
        return t("hint.annul", { packet: s.packet });
      case "route":
      case "ttl": {
        const name = (id) => networkName(level.networks.find((n) => n.id === id) || { name: id });
        const vars = { packet: s.packet, ttl: s.ttl, route: s.route.map(name), networks: s.networks.map(name) };
        if (s.t === "route" && routing()) return t("hint.routeTables", { ...vars, lookups: tableLookups(s.packet) });
        return t(`hint.${s.t}`, vars);
      }
      case "relation":
        // Sin casillas resaltadas: solo descarta redes posibles del extremo oculto.
        return t(!s.cells.length ? "hint.relationEnds" : s.open ? "hint.relationOpen" : "hint.relationFixed",
          { packet: s.packet, other: s.other });
      case "subset":
        if (s.packets.length === 1) {
          return t(s.key === "row" ? "hint.oneRow" : "hint.oneColumn", { packet: s.packets[0], n: s.values[0] });
        }
        if (s.key === "cell") return t("hint.subsetCells", { packets: list(s.packets), n: s.values.length });
        return t(s.key === "row" ? "hint.subsetRows" : "hint.subsetColumns", { packets: list(s.packets), lines: list(s.values) });
      default:
        return "";
    }
  }

  // Consultas que deciden la ruta de un paquete (route.tableDecisions), explicadas.
  function tableLookups(id) {
    const p = packetById(id);
    const route = (p && p.route) || {};
    const ip = p && p.destination && p.destination.ip;
    if (!ip) return [];
    const name = (netId) => networkName(networkById(netId));
    return (route.tableDecisions || []).map((d) => {
      if (d === "gateway") {
        const net = route.networks[0];
        return t("hint.lookupGateway", { net: name(net), gw: gatewayText(net) });
      }
      const { matches, entry } = lookup(d, ip);
      if (!entry) return "";
      const hop = entry.direct ? t("tables.direct") : hopText(d, entry.via);
      return t("hint.lookup", {
        router: d, ip, matches: matches.map((e) => e.prefix), winner: prefixText(entry.prefix), hop,
        isDefault: entry.prefix === DEFAULT_ROUTE,
      });
    }).filter(Boolean);
  }

  // Paso de la sugerencia que se está mirando (se resalta uno cada vez).
  function hintStep() {
    const h = state.hint;
    if (!h || h.kind !== "deduction" || isOver()) return null;
    return h.steps[Math.min(state.hintStep || 0, h.steps.length - 1)];
  }

  // Casillas que resalta la sugerencia en el tablero: las del paso elegido.
  function hintCells() {
    if (state.hint && state.hint.kind === "mark" && !isOver()) return [state.hint.cell];
    const s = hintStep();
    if (!s) return [];
    const { width, height } = level.board;
    const cells = new Map();
    const add = (r, c) => cells.set(`${r},${c}`, [r, c]);
    const line = (axis, n) => {
      if (axis === "row") for (let c = 1; c <= width; c++) add(n, c);
      else for (let r = 1; r <= height; r++) add(r, n);
    };
    if (s.t === "line") line(s.axis, s.line);
    else if (s.t === "annul" || s.t === "relation" || s.t === "route" || s.t === "ttl") s.cells.forEach(([r, c]) => add(r, c));
    else if (s.t === "subset" && s.key === "cell") s.values.forEach(([r, c]) => add(r, c));
    else if (s.t === "subset") s.values.forEach((n) => line(s.key, n));
    return [...cells.values()].filter(([r, c]) => !occupied(r, c));
  }

  // Paquetes y pistas que resalta la sugerencia en el panel: los del paso elegido.
  function hintFocus() {
    const focus = { packets: new Set(), clues: new Set() };
    const s = hintStep();
    if (!s) return focus;
    if (s.t === "single") {
      focus.packets.add(s.packet);
      (s.clues || []).forEach((id) => focus.clues.add(id));
    } else if (s.t === "annul") {
      focus.clues.add(s.clue);
    } else if (s.t === "relation") {
      focus.clues.add(s.clue);
      focus.packets.add(s.packet);
      focus.packets.add(s.other);
    } else if (s.t === "line" || s.t === "route" || s.t === "ttl") {
      focus.packets.add(s.packet);
    } else if (s.t === "subset") {
      s.packets.forEach((p) => focus.packets.add(p));
    }
    return focus;
  }

  function showHintStep(i) {
    state.hintStep = i;
    renderBoard();
    renderPackets();
    renderHint();
  }

  function renderHint() {
    const box = $("hint");
    const button = $("hint-button");
    const status = hintState();
    button.disabled = status !== "ok";
    button.title = status === "ok" || status === "over" ? t("hint.buttonTitle") : t(`hint.${status}`);
    box.innerHTML = "";
    box.className = "hint-box";
    const add = (tag, text, parent) => {
      const e = document.createElement(tag);
      if (text) e.textContent = text;
      (parent || box).appendChild(e);
      return e;
    };
    if (state.asking && status === "ok") {
      add("p", t("hint.ask"));
      const row = add("div");
      row.className = "hint-actions";
      const yes = add("button", t("hint.yes"), row);
      yes.type = "button";
      yes.className = "button primary";
      yes.addEventListener("click", useHint);
      const no = add("button", t("hint.no"), row);
      no.type = "button";
      no.className = "button";
      no.addEventListener("click", () => { state.asking = false; renderHint(); });
    } else if (state.hint && status !== "over") {
      add("h3", t("hint.title"));
      const close = add("button", "✕");
      close.type = "button";
      close.className = "close";
      close.setAttribute("aria-label", t("hint.close"));
      close.title = t("hint.close");
      close.addEventListener("click", closeHint);
      if (state.hint.kind === "mark") {
        const [r, c] = state.hint.cell;
        add("p", t("hint.mark", { r, c }));
      } else {
        const steps = state.hint.steps;
        const current = Math.min(state.hintStep || 0, steps.length - 1);
        const ol = add("ol");
        steps.forEach((s, i) => {
          const li = add("li", hintText(s, i), ol);
          if (steps.length < 2) return;
          // Varios pasos: cada uno se puede elegir para ver sus casillas.
          li.className = i === current ? "step active" : "step";
          li.tabIndex = 0;
          li.setAttribute("aria-current", i === current ? "step" : "false");
          li.addEventListener("click", () => showHintStep(i));
          li.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              showHintStep(i);
            }
          });
        });
        if (steps.length > 1) add("p", t("hint.stepsNote")).className = "hint-note";
      }
    } else {
      box.hidden = true;
      return;
    }
    box.hidden = false;
  }

  function loseLife(message) {
    state.lives -= 1;
    if (state.lives <= 0) {
      state.lost = true;
      if (options.onLose) options.onLose();
    }
    save();
    render();
    say(state.lost ? message : `${message} ${t("game.loseLife")}`, "bad");
  }

  function say(content, kind) {
    const el = $("message");
    el.textContent = content;
    el.className = "message" + (kind ? " " + kind : "");
  }

  window.NetdokuGame = {
    start,
    refresh,
    hasProgress,
    say,
    isActive: () => !!level,
    level: () => level,
  };
})();
