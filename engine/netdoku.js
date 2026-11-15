// Motor de Netdoku (v0). Carga un nivel en JSON y permite jugarlo.
// No conoce el generador: solo usa el formato de partida.
(function () {
  "use strict";

  const LEVEL_INDEX = "../levels/generated/index.json";
  const LEVEL_DIR = "../levels/generated/";
  const START_LIVES = 3;
  const CELL = 80;
  const PAD = 6;
  const NETWORK_COLORS = ["#f3d9a4", "#c5e3c6", "#bcd6f2", "#f4c6d6", "#d6cbef", "#ffdcb4", "#b8e6ea", "#e3e9a4"];
  const NODE_TEXT = { client: "PC", web: "Web", dns: "DNS", mail: "Correo", storage: "Ficheros", multimedia: "Media" };
  const SVG_NS = "http://www.w3.org/2000/svg";

  const $ = (id) => document.getElementById(id);
  let level = null;
  let state = null;

  // ---------- Carga de niveles ----------

  async function init() {
    $("level-file").addEventListener("change", onFileChosen);
    $("level-select").addEventListener("change", () => loadFromUrl(LEVEL_DIR + $("level-select").value));
    $("restart").addEventListener("click", () => level && start(level));
    document.addEventListener("dragover", (e) => e.preventDefault());
    document.addEventListener("drop", onFileDropped);

    const params = new URLSearchParams(location.search);
    try {
      const res = await fetch(LEVEL_INDEX, { cache: "no-store" });
      if (!res.ok) throw new Error(res.statusText);
      const index = await res.json();
      const select = $("level-select");
      for (const item of index.levels) {
        const opt = document.createElement("option");
        opt.value = item.file;
        opt.textContent = `${item.name} (${item.clues} pistas)`;
        select.appendChild(opt);
      }
      const wanted = params.get("level");
      if (wanted) select.value = wanted;
      if (select.value) await loadFromUrl(LEVEL_DIR + select.value);
    } catch (err) {
      $("level-select").hidden = true;
      say("No se ha podido leer la lista de niveles. Usa «Abrir nivel…» o sirve la carpeta con un servidor web (véase README.md).", "bad");
    }
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
    state = {
      lives: START_LIVES,
      placed: {},        // id de paquete -> [f, c]
      marks: new Set(),  // "f,c" marcadas por el jugador
      struck: new Set(), // ids de pistas tachadas
      selected: null,
      over: false,
      solvedBoard: false,
    };
    $("final").hidden = true;
    $("final").innerHTML = "";
    $("objective").textContent = level.objective.text;
    say("");
    render();
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

  function renderBoard() {
    const { width, height, networkGrid } = level.board;
    const W = width * CELL + 2 * PAD;
    const H = height * CELL + 2 * PAD;
    const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Tablero" });
    const x = (c) => PAD + (c - 1) * CELL;
    const y = (r) => PAD + (r - 1) * CELL;

    // Casillas.
    for (let r = 1; r <= height; r++) {
      for (let c = 1; c <= width; c++) {
        const net = networkGrid[r - 1][c - 1];
        const rect = svg("rect", {
          x: x(c), y: y(r), width: CELL, height: CELL,
          fill: networkColor(net), stroke: "rgba(0,0,0,0.12)", "stroke-width": 1,
          class: "cell", "data-r": r, "data-c": c,
        }, root);
        rect.addEventListener("click", () => onCellClick(r, c));
        rect.addEventListener("contextmenu", (e) => { e.preventDefault(); toggleMark(r, c); });
      }
    }

    // Bordes entre redes y borde exterior.
    const wall = { stroke: "#3a3d42", "stroke-width": 4, "stroke-linecap": "round" };
    for (let r = 1; r <= height; r++) {
      for (let c = 1; c <= width; c++) {
        const net = networkGrid[r - 1][c - 1];
        if (c === width || networkGrid[r - 1][c] !== net) svg("line", { x1: x(c + 1), y1: y(r), x2: x(c + 1), y2: y(r + 1), ...wall }, root);
        if (r === height || networkGrid[r][c - 1] !== net) svg("line", { x1: x(c), y1: y(r + 1), x2: x(c + 1), y2: y(r + 1), ...wall }, root);
        if (c === 1) svg("line", { x1: x(1), y1: y(r), x2: x(1), y2: y(r + 1), ...wall }, root);
        if (r === 1) svg("line", { x1: x(c), y1: y(1), x2: x(c + 1), y2: y(1), ...wall }, root);
      }
    }

    // Marcas del jugador.
    for (const key of state.marks) {
      const [r, c] = key.split(",").map(Number);
      const t = svg("text", { x: x(c) + CELL / 2, y: y(r) + CELL / 2 + 10, "text-anchor": "middle", "font-size": 30, fill: "rgba(0,0,0,0.35)", "pointer-events": "none" }, root);
      t.textContent = "✕";
    }

    // Nodos.
    for (const n of level.nodes) {
      const [r, c] = n.position;
      const g = svg("g", { "pointer-events": "none" }, root);
      svg("rect", { x: x(c) + 10, y: y(r) + 14, width: CELL - 20, height: CELL - 28, rx: 8, fill: n.type === "client" ? "#5b6470" : "#2e3440" }, g);
      const t = svg("text", { x: x(c) + CELL / 2, y: y(r) + CELL / 2 + 5, "text-anchor": "middle", "font-size": 14, "font-weight": 600, fill: "#fff" }, g);
      t.textContent = n.type === "client" ? NODE_TEXT.client : (n.services || []).map((s) => NODE_TEXT[s] || s).join("/");
      svg("title", {}, g).textContent = `${n.label} (${n.id})`;
    }

    // Paquetes colocados.
    for (const [id, [r, c]] of Object.entries(state.placed)) {
      const p = packetById(id);
      svg("circle", { cx: x(c) + CELL / 2, cy: y(r) + CELL / 2, r: 22, fill: p.color, stroke: "rgba(0,0,0,0.4)", "stroke-width": 2, "pointer-events": "none" }, root);
      const t = svg("text", { x: x(c) + CELL / 2, y: y(r) + CELL / 2 + 7, "text-anchor": "middle", "font-size": 20, "font-weight": 700, fill: "#fff", "pointer-events": "none" }, root);
      t.textContent = id;
    }

    // Routers, encima de los bordes.
    for (const rt of level.routers) {
      const [[r1, c1], [r2, c2]] = rt.position.between;
      const cx = (x(c1) + x(c2)) / 2 + CELL / 2;
      const cy = (y(r1) + y(r2)) / 2 + CELL / 2;
      const g = svg("g", {}, root);
      svg("circle", { cx, cy, r: 14, fill: "#1f4e99", stroke: "#fff", "stroke-width": 2 }, g);
      const t = svg("text", { x: cx, y: cy + 5, "text-anchor": "middle", "font-size": 13, "font-weight": 700, fill: "#fff", "pointer-events": "none" }, g);
      t.textContent = "R";
      svg("title", {}, g).textContent = rt.name;
    }

    const wrap = $("board-wrap");
    wrap.innerHTML = "";
    wrap.appendChild(root);
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
      if (!placed && !state.over) token.addEventListener("pointerdown", (e) => onTokenDown(e, p.id));
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
            renderPackets();
          });
          ul.appendChild(li);
        }
        card.appendChild(ul);
      } else {
        const none = document.createElement("div");
        none.className = "no-clues";
        none.textContent = "Sin pistas propias.";
        card.appendChild(none);
      }
      el.appendChild(card);
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

    function up(ev) {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      ghost.hidden = true;
      if (dragging) {
        const target = document.elementFromPoint(ev.clientX, ev.clientY);
        if (target && target.classList && target.classList.contains("cell")) {
          tryPlace(id, Number(target.dataset.r), Number(target.dataset.c));
        }
      } else {
        state.selected = state.selected === id ? null : id;
        renderPackets();
      }
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function onCellClick(r, c) {
    if (state.selected && !state.over) tryPlace(state.selected, r, c);
  }

  function toggleMark(r, c) {
    const key = `${r},${c}`;
    state.marks.has(key) ? state.marks.delete(key) : state.marks.add(key);
    renderBoard();
  }

  function occupied(r, c) {
    if (level.nodes.some((n) => n.position[0] === r && n.position[1] === c)) return "un equipo";
    const other = Object.entries(state.placed).find(([, pos]) => pos[0] === r && pos[1] === c);
    return other ? `el paquete ${other[0]}` : null;
  }

  function tryPlace(id, r, c) {
    if (state.over || id in state.placed) return;
    const busy = occupied(r, c);
    if (busy) {
      say(`Esa casilla ya está ocupada por ${busy}.`, "bad");
      return;
    }
    const [sr, sc] = packetById(id).solution.position;
    state.selected = null;
    if (sr === r && sc === c) {
      state.placed[id] = [r, c];
      state.marks.delete(`${r},${c}`);
      say(`El paquete ${id} está bien colocado.`, "good");
      render();
      if (Object.keys(state.placed).length === level.packets.items.length) askAttacker();
    } else {
      loseLife(`El paquete ${id} no estaba en la fila ${r}, columna ${c}.`);
      const cell = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
      if (cell) cell.classList.add("wrong");
    }
  }

  function loseLife(text) {
    state.lives -= 1;
    render();
    if (state.lives <= 0) {
      state.over = true;
      say(`${text} Te has quedado sin vidas. Pulsa «Reiniciar» para volver a intentarlo.`, "bad");
      renderPackets();
    } else {
      say(`${text} Pierdes una vida.`, "bad");
    }
  }

  function askAttacker() {
    const box = $("final");
    box.hidden = false;
    box.innerHTML = "";
    const p = document.createElement("p");
    p.textContent = "Todos los paquetes están en su sitio. ¿Cuál es el paquete atacante?";
    box.appendChild(p);
    const choices = document.createElement("div");
    choices.className = "choices";
    for (const pk of level.packets.items) {
      if (pk.id === level.objective.victimPacketId) continue;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "button";
      b.textContent = `Paquete ${pk.id}`;
      b.addEventListener("click", () => answer(pk.id));
      choices.appendChild(b);
    }
    box.appendChild(choices);
  }

  function answer(id) {
    if (state.over) return;
    const right = level.objective.observableAnswer.attackerPacketId;
    if (id === right) {
      state.over = true;
      const victim = level.objective.victimPacketId;
      const net = level.networks.find((n) => n.id === level.solution.victimNetwork);
      $("final").innerHTML = "";
      say(`¡Correcto! El paquete ${id} era el único otro paquete en la red ${net.name}, junto a la víctima ${victim}.`, "good");
    } else {
      loseLife(`El paquete ${id} no es el atacante.`);
    }
  }

  function say(text, kind) {
    const el = $("message");
    el.textContent = text;
    el.className = "message" + (kind ? " " + kind : "");
  }

  init();
})();
