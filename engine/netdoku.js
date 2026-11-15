// Motor de Netdoku (v0). Carga un nivel en JSON y permite jugarlo.
// No conoce el generador: solo usa el formato de partida.
(function () {
  "use strict";

  const LEVEL_INDEX = "../levels/generated/index.json";
  const LEVEL_DIR = "../levels/generated/";
  const STORE_PREFIX = "netdoku:progress:";
  const START_LIVES = 3;
  const CELL = 80;
  const PAD = 6;
  const MARGIN = 22; // margen superior e izquierdo para los números de fila y columna
  const NETWORK_COLORS = ["#f3d9a4", "#c5e3c6", "#bcd6f2", "#f4c6d6", "#d6cbef", "#ffdcb4", "#b8e6ea", "#e3e9a4"];
  const SERVICE_COLORS = { web: "#2f7de1", dns: "#8e44ad", mail: "#e67e22", storage: "#16a085", multimedia: "#c0392b", dhcp: "#7f8c8d" };
  const SVG_NS = "http://www.w3.org/2000/svg";

  const $ = (id) => document.getElementById(id);
  let level = null;
  let state = null;
  let levelIndex = [];

  // ---------- Progreso guardado (por nivel, en este navegador) ----------

  function storageKey(id) {
    return STORE_PREFIX + id;
  }

  function levelId() {
    return (level && level.level && level.level.id) || "sin-id";
  }

  function readProgress(id) {
    try {
      const raw = localStorage.getItem(storageKey(id));
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function saveProgress() {
    try {
      localStorage.setItem(storageKey(levelId()), JSON.stringify({
        lives: state.lives,
        placed: state.placed,
        marks: [...state.marks],
        notes: Object.fromEntries([...state.notes].map(([k, v]) => [k, [...v]])),
        struck: [...state.struck],
        solved: state.solved,
        lost: state.lost,
      }));
    } catch (err) {
      // Sin almacenamiento (modo privado, etc.): se juega sin guardar.
    }
  }

  function clearProgress() {
    try {
      localStorage.removeItem(storageKey(levelId()));
    } catch (err) {
      // Nada que hacer.
    }
  }

  // ---------- Carga de niveles ----------

  async function init() {
    $("level-file").addEventListener("change", onFileChosen);
    $("level-select").addEventListener("change", () => loadFromUrl(LEVEL_DIR + $("level-select").value));
    $("restart").addEventListener("click", restart);
    $("note-mode").addEventListener("change", (e) => setMode(e.target.checked ? "note" : "place"));
    // Atajo: A activa o desactiva el modo anotar.
    document.addEventListener("keydown", (e) => {
      if (!state || e.ctrlKey || e.metaKey || e.altKey || e.target.closest("input, select, textarea, dialog[open]")) return;
      if (e.key.toLowerCase() === "a") setMode(state.mode === "note" ? "place" : "note");
    });
    const dialog = $("help-dialog");
    dialog.querySelector(".close").addEventListener("click", () => dialog.close());
    // Pulsar fuera de la ventana (en el fondo) la cierra.
    dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
    document.addEventListener("dragover", (e) => e.preventDefault());
    document.addEventListener("drop", onFileDropped);

    const params = new URLSearchParams(location.search);
    try {
      const res = await fetch(LEVEL_INDEX, { cache: "no-store" });
      if (!res.ok) throw new Error(res.statusText);
      levelIndex = (await res.json()).levels;
      fillLevelSelect();
      const select = $("level-select");
      const wanted = params.get("level");
      if (wanted) select.value = wanted;
      if (select.value) await loadFromUrl(LEVEL_DIR + select.value);
    } catch (err) {
      $("level-select").hidden = true;
      say("No se ha podido leer la lista de niveles. Usa «Abrir nivel…» o sirve la carpeta con un servidor web (véase README.md).", "bad");
    }
  }

  function fillLevelSelect() {
    const select = $("level-select");
    const current = select.value;
    select.innerHTML = "";
    for (const item of levelIndex) {
      const opt = document.createElement("option");
      opt.value = item.file;
      const progress = readProgress(item.id);
      const mark = progress && progress.solved ? "✓ " : "";
      opt.textContent = `${mark}${item.name} (${item.clues} pistas)`;
      select.appendChild(opt);
    }
    if (current) select.value = current;
  }

  async function loadFromUrl(url) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      start(await res.json());
    } catch (err) {
      say(`No se ha podido cargar ${url}.`, "bad");
    }
  }

  function loadFromFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        start(JSON.parse(reader.result));
      } catch (err) {
        say("El fichero no es un nivel JSON válido.", "bad");
      }
    };
    reader.readAsText(file);
  }

  function onFileChosen(e) {
    if (e.target.files[0]) loadFromFile(e.target.files[0]);
    e.target.value = "";
  }

  function onFileDropped(e) {
    e.preventDefault();
    if (e.dataTransfer.files[0]) loadFromFile(e.dataTransfer.files[0]);
  }

  // ---------- Estado de la partida ----------

  function start(data) {
    level = data;
    const saved = readProgress(levelId());
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
      selected: null,
    };
    $("objective").textContent = level.objective.text;
    renderHelpStrip();
    setMode("place");
    say(saved && !state.solved && !state.lost && Object.keys(state.placed).length ? "Se ha recuperado tu progreso en este nivel." : "");
    render();
  }

  // Etiquetas con las reglas que usa este nivel; cada una abre su ficha.
  function renderHelpStrip() {
    const strip = $("help-strip");
    strip.innerHTML = "";
    if (!window.NetdokuHelp) return;
    for (const entry of window.NetdokuHelp.forLevel(level)) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = entry.chip;
      b.title = entry.title;
      b.addEventListener("click", () => openHelp(entry));
      strip.appendChild(b);
    }
  }

  function openHelp(entry) {
    const dialog = $("help-dialog");
    const body = dialog.querySelector(".help-body");
    body.innerHTML = "";
    window.NetdokuHelp.renderEntry(body, entry);
    dialog.showModal();
  }

  function restart() {
    if (!level) return;
    clearProgress();
    start(level);
    fillLevelSelect();
  }

  function isOver() {
    return state.solved || state.lost;
  }

  function allPlaced() {
    return Object.keys(state.placed).length === level.packets.items.length;
  }

  function packetById(id) {
    return level.packets.items.find((p) => p.id === id);
  }

  function networkColor(netId) {
    const i = level.networks.findIndex((n) => n.id === netId);
    return NETWORK_COLORS[i % NETWORK_COLORS.length];
  }

  // ---------- Dibujo ----------

  function render() {
    renderLives();
    renderBoard();
    renderLegend();
    renderPackets();
    renderFinal();
  }

  function renderLives() {
    const el = $("lives");
    el.innerHTML = "";
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
    const t = svg("text", { x, y, "text-anchor": "middle", "pointer-events": "none", ...attrs }, parent);
    t.textContent = content;
    return t;
  }

  const px = (c) => MARGIN + (c - 1) * CELL;
  const py = (r) => MARGIN + (r - 1) * CELL;

  function renderBoard() {
    const { width, height, networkGrid } = level.board;
    const W = MARGIN + width * CELL + PAD;
    const H = MARGIN + height * CELL + PAD;
    const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Tablero" });

    // Números de fila y columna, para las pistas «en la fila N».
    const num = { "font-size": 13, "font-weight": 600, fill: "#8a8f96" };
    for (let r = 1; r <= height; r++) text(root, MARGIN / 2, py(r) + CELL / 2 + 5, r, num);
    for (let c = 1; c <= width; c++) text(root, px(c) + CELL / 2, MARGIN - 7, c, num);

    // Casillas.
    for (let r = 1; r <= height; r++) {
      for (let c = 1; c <= width; c++) {
        const net = networkGrid[r - 1][c - 1];
        const rect = svg("rect", {
          x: px(c), y: py(r), width: CELL, height: CELL,
          fill: networkColor(net), stroke: "rgba(0,0,0,0.12)", "stroke-width": 1,
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
      }
    }

    // Bordes entre redes y borde exterior.
    const wall = { stroke: "#3a3d42", "stroke-width": 4, "stroke-linecap": "round" };
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
      text(root, px(c) + CELL / 2, py(r) + CELL / 2 + 10, "✕", { "font-size": 30, fill: "rgba(0,0,0,0.35)" });
    }

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
    drawNetworkNames(root);

    // Paquetes colocados.
    for (const [id, [r, c]] of Object.entries(state.placed)) {
      const p = packetById(id);
      svg("circle", { cx: px(c) + CELL / 2, cy: py(r) + CELL / 2, r: 22, fill: p.color, stroke: "rgba(0,0,0,0.4)", "stroke-width": 2, "pointer-events": "none" }, root);
      text(root, px(c) + CELL / 2, py(r) + CELL / 2 + 7, id, { "font-size": 20, "font-weight": 700, fill: "#fff" });
    }

    // Routers, encima de los bordes.
    for (const rt of level.routers) {
      const [[r1, c1], [r2, c2]] = rt.position.between;
      const cx = (px(c1) + px(c2)) / 2 + CELL / 2;
      const cy = (py(r1) + py(r2)) / 2 + CELL / 2;
      const g = svg("g", {}, root);
      svg("circle", { cx, cy, r: 14, fill: "#1f4e99", stroke: "#fff", "stroke-width": 2 }, g);
      // Flechas cruzadas: símbolo habitual de router.
      const arrow = { stroke: "#fff", "stroke-width": 2, "stroke-linecap": "round", fill: "none" };
      svg("path", { d: `M${cx - 7} ${cy - 3} h14 m-4 -4 l4 4 l-4 4`, ...arrow }, g);
      svg("path", { d: `M${cx + 7} ${cy + 4} h-14 m4 -4 l-4 4 l4 4`, ...arrow, opacity: 0.75 }, g);
      svg("title", {}, g).textContent = rt.name;
    }

    const wrap = $("board-wrap");
    wrap.innerHTML = "";
    wrap.appendChild(root);
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
      const [[r1, c1], [r2, c2]] = rt.position.between;
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
      const label = net.name.toUpperCase();
      const available = best.span * CELL - 10;
      const estimated = label.length * 7.4;
      const attrs = {
        "text-anchor": "start", "font-size": 12, "font-weight": 800, "letter-spacing": "0.03em",
        fill: "#2b2d31", stroke: "rgba(255,255,255,0.85)", "stroke-width": 3, "paint-order": "stroke",
      };
      if (estimated > available) Object.assign(attrs, { textLength: available, lengthAdjust: "spacingAndGlyphs" });
      text(root, px(best.c) + 5, py(best.r) + CELL - 6, label, attrs);
    }
  }

  function drawNode(root, n) {
    const [r, c] = n.position;
    const x = px(c);
    const y = py(r);
    const cx = x + CELL / 2;
    const cy = y + CELL / 2 - 2;
    const g = svg("g", { "pointer-events": "none" }, root);
    svg("rect", { x: x + 9, y: y + 9, width: CELL - 18, height: CELL - 18, rx: 10, fill: n.type === "client" ? "#4f5965" : "#2e3440" }, g);

    if (n.type === "client") {
      // Monitor.
      svg("rect", { x: cx - 17, y: cy - 15, width: 34, height: 24, rx: 3, fill: "#cfe3ff", stroke: "#e9eef4", "stroke-width": 2 }, g);
      svg("rect", { x: cx - 3, y: cy + 9, width: 6, height: 6, fill: "#cfd6df" }, g);
      svg("rect", { x: cx - 10, y: cy + 14, width: 20, height: 3, rx: 1.5, fill: "#cfd6df" }, g);
    } else {
      // Rack de servidor.
      for (let i = 0; i < 3; i++) {
        svg("rect", { x: cx - 17, y: cy - 17 + i * 12, width: 34, height: 10, rx: 2, fill: "#cfd6df" }, g);
        svg("circle", { cx: cx + 11, cy: cy - 12 + i * 12, r: 1.8, fill: "#36c26f" }, g);
        svg("rect", { x: cx - 13, y: cy - 13 + i * 12, width: 14, height: 2, fill: "#8a939e" }, g);
      }
      const service = (n.services || [])[0];
      if (service) drawServiceBadge(g, service, x + CELL - 17, y + CELL - 17);
    }
    svg("title", {}, g).textContent = `${n.label} (${n.id})`;
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

  function renderLegend() {
    const el = $("legend");
    el.innerHTML = "";
    for (const n of level.networks) {
      const item = document.createElement("div");
      const sw = document.createElement("span");
      sw.className = "swatch";
      sw.style.background = networkColor(n.id);
      item.appendChild(sw);
      item.appendChild(document.createTextNode(`${n.name} · ${n.prefix}`));
      el.appendChild(item);
    }
  }

  function renderPackets() {
    const el = $("packets");
    el.innerHTML = "";
    for (const p of level.packets.items) {
      const card = document.createElement("div");
      card.className = "packet-card";
      if (state.selected === p.id) card.classList.add("selected");
      const placed = p.id in state.placed;
      if (placed) card.classList.add("placed");

      const token = document.createElement("div");
      token.className = "token" + (placed ? " placed" : "");
      token.style.background = p.color;
      token.textContent = p.id;
      if (!placed && !isOver()) token.addEventListener("pointerdown", (e) => onTokenDown(e, p.id));
      card.appendChild(token);

      const title = document.createElement("div");
      title.className = "title";
      title.textContent = `Paquete ${p.id}`;
      if (p.id === level.objective.victimPacketId) {
        const b = document.createElement("span");
        b.className = "badge";
        b.textContent = "víctima";
        title.appendChild(b);
      }
      card.appendChild(title);

      const clues = level.clues.filter((c) => c.packet === p.id);
      if (clues.length) {
        const ul = document.createElement("ul");
        for (const c of clues) {
          const li = document.createElement("li");
          li.textContent = c.text;
          if (state.struck.has(c.id)) li.className = "done";
          li.addEventListener("click", () => {
            state.struck.has(c.id) ? state.struck.delete(c.id) : state.struck.add(c.id);
            saveProgress();
            renderPackets();
          });
          ul.appendChild(li);
        }
        card.appendChild(ul);
      } else {
        const none = document.createElement("div");
        none.className = "no-clues";
        none.textContent = p.id === level.objective.victimPacketId
          ? "Sin pistas: se localiza por descarte."
          : "Sin pistas propias.";
        card.appendChild(none);
      }
      el.appendChild(card);
    }
  }

  // Recuadro final: nivel resuelto (con el atacante) o sin vidas.
  function renderFinal() {
    const box = $("final");
    box.innerHTML = "";
    box.className = "final";
    const para = (content) => {
      const p = document.createElement("p");
      p.textContent = content;
      box.appendChild(p);
    };

    if (state.solved) {
      const attacker = level.objective.observableAnswer.attackerPacketId;
      const victim = level.objective.victimPacketId;
      const net = level.networks.find((n) => n.id === level.solution.victimNetwork);
      box.classList.add("solved");
      para(`El atacante es el paquete ${attacker}: el único otro paquete en la red ${net ? net.name : ""}, donde estaba la víctima ${victim}.`);
      para("Pulsa «Reiniciar» para jugarlo de nuevo.");
    } else if (state.lost) {
      box.classList.add("lost");
      para("Te has quedado sin vidas. Pulsa «Reiniciar» para volver a intentarlo.");
    } else {
      box.hidden = true;
      return;
    }
    box.hidden = false;
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
    if (!state.selected) {
      if (state.mode === "note") say("Selecciona primero un paquete en el panel para anotarlo.", "");
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
    saveProgress();
    renderBoard();
  }

  function setMode(mode) {
    state.mode = mode;
    const noting = mode === "note";
    $("note-mode").checked = noting;
    $("mode-label").textContent = noting ? "Modo anotar: las pulsaciones ponen o quitan notas" : "Modo colocar";
    $("board-wrap").classList.toggle("noting", noting);
    document.querySelector(".modebar").classList.toggle("noting", noting);
  }

  function toggleMark(r, c) {
    if (isOver()) return;
    const key = `${r},${c}`;
    if (occupied(r, c)) return;
    if (state.marks.has(key)) {
      state.marks.delete(key);
    } else {
      state.marks.add(key);
      state.notes.delete(key); // al descartar una casilla se borran sus notas
    }
    saveProgress();
    renderBoard();
  }

  function occupied(r, c) {
    if (level.nodes.some((n) => n.position[0] === r && n.position[1] === c)) return "un equipo";
    const other = Object.entries(state.placed).find(([, pos]) => pos[0] === r && pos[1] === c);
    return other ? `el paquete ${other[0]}` : null;
  }

  // Regla básica: como mucho un paquete por fila y por columna.
  function lineConflict(r, c) {
    const rules = level.rules || {};
    for (const [id, [pr, pc]] of Object.entries(state.placed)) {
      if (rules.onePacketPerRow !== false && pr === r) return `En la fila ${r} ya está el paquete ${id}.`;
      if (rules.onePacketPerColumn !== false && pc === c) return `En la columna ${c} ya está el paquete ${id}.`;
    }
    return null;
  }

  function tryPlace(id, r, c) {
    if (isOver() || id in state.placed) return;
    const busy = occupied(r, c);
    if (busy) {
      say(`Esa casilla ya está ocupada por ${busy}.`, "bad");
      return;
    }
    const conflict = lineConflict(r, c);
    if (conflict) {
      say(`${conflict} Solo puede haber un paquete por fila y por columna.`, "bad");
      return;
    }
    const [sr, sc] = packetById(id).solution.position;
    state.selected = null;
    if (sr === r && sc === c) {
      state.placed[id] = [r, c];
      state.marks.delete(`${r},${c}`);
      // Fuera las notas de ese paquete y las de esa casilla (no es una deducción).
      state.notes.delete(`${r},${c}`);
      for (const [key, ids] of state.notes) {
        ids.delete(id);
        if (!ids.size) state.notes.delete(key);
      }
      // Con todos colocados, el atacante es evidente (el otro paquete de la
      // red de la víctima): el nivel queda resuelto sin preguntar.
      if (allPlaced()) state.solved = true;
      saveProgress();
      say(state.solved ? "¡Nivel resuelto!" : `El paquete ${id} está bien colocado.`, "good");
      render();
      if (state.solved) fillLevelSelect();
    } else {
      loseLife(`El paquete ${id} no estaba en la fila ${r}, columna ${c}.`);
      const cell = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
      if (cell) cell.classList.add("wrong");
    }
  }

  function loseLife(message) {
    state.lives -= 1;
    if (state.lives <= 0) state.lost = true;
    saveProgress();
    render();
    say(state.lost ? message : `${message} Pierdes una vida.`, "bad");
  }

  function say(content, kind) {
    const el = $("message");
    el.textContent = content;
    el.className = "message" + (kind ? " " + kind : "");
  }

  init();
})();
