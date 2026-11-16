// Sugerencias de Netdoku: la siguiente deducción que puede hacer el jugador.
//
// Parte del estado real de la partida (los paquetes colocados, que siempre son
// correctos) y de lo que dice cada pista: sus casillas posibles (`domain`, D)
// y las que anula para los demás (`excluded`, A), que guarda el nivel. Razona
// con las mismas técnicas que el generador (difficulty.py), de la más sencilla
// a la más difícil, hasta que un paquete queda en una sola casilla, y quita de
// esa cadena los pasos que no hacen falta. No dice la casilla: explica cómo
// llegar a ella. Antes comprueba que ninguna ✕ del jugador tape un paquete.
//
// No conoce el DOM ni los textos: devuelve datos que netdoku.js explica en el
// idioma activo.
(function () {
  "use strict";

  const MAX_SUBSET = 4; // como maxSubset en el generador

  // ¿Trae el nivel lo que hace falta? (Los niveles anteriores a las sugerencias, no.)
  function supported(level) {
    return !!level && Array.isArray(level.clues) && level.clues.every((c) => Array.isArray(c.domain));
  }

  // ---------- Estado de la deducción ----------

  function setup(level, placed) {
    const W = level.board.width;
    const H = level.board.height;
    const idx = ([r, c]) => (r - 1) * W + (c - 1);
    const nodeCells = new Set(level.nodes.map((n) => idx(n.position)));
    const free = [];
    for (let k = 0; k < W * H; k++) if (!nodeCells.has(k)) free.push(k);
    const ids = level.packets.items.map((p) => p.id);
    const domains = new Map(ids.map((p) => [p, new Set(free)]));
    const clues = level.clues.map((c) => ({
      id: c.id,
      packet: c.packet,
      excluded: new Set((c.excluded || []).map(idx)),
    }));
    for (const c of level.clues) {
      const allowed = new Set(c.domain.map(idx));
      const d = domains.get(c.packet);
      for (const k of [...d]) if (!allowed.has(k)) d.delete(k);
    }
    const rules = level.rules || {};
    const sim = {
      W, H, ids, domains, clues,
      victim: level.packets.victimId || (level.objective || {}).victimPacketId,
      placed: new Set(),
      annulled: new Set(),
      fullRows: rules.onePacketPerRow !== false && ids.length === H,
      fullColumns: rules.onePacketPerColumn !== false && ids.length === W,
    };
    for (const [p, pos] of Object.entries(placed || {})) {
      sim.domains.set(p, new Set([idx(pos)]));
      apply(sim, { t: "single", packet: p });
    }
    return sim;
  }

  function clone(sim) {
    return {
      ...sim,
      domains: new Map([...sim.domains].map(([p, d]) => [p, new Set(d)])),
      placed: new Set(sim.placed),
      annulled: new Set(sim.annulled),
    };
  }

  const row = (sim, k) => Math.floor(k / sim.W) + 1;
  const col = (sim, k) => (k % sim.W) + 1;
  const keyOf = (sim, key) => (key === "row" ? (k) => row(sim, k) : key === "column" ? (k) => col(sim, k) : (k) => k);

  // Paquetes con alguna casilla posible en una fila o columna.
  function holders(sim, axis, line) {
    const at = keyOf(sim, axis);
    return sim.ids.filter((p) => [...sim.domains.get(p)].some((k) => at(k) === line));
  }

  // ---------- Pasos: comprobar si valen ahora y aplicarlos ----------

  function valid(sim, s) {
    switch (s.t) {
      case "single":
        return !sim.placed.has(s.packet) && sim.domains.get(s.packet).size === 1;
      case "line": {
        const h = holders(sim, s.axis, s.line);
        return (s.axis === "row" ? sim.fullRows : sim.fullColumns) && h.length === 1 && h[0] === s.packet;
      }
      case "annul":
        return !sim.annulled.has(s.clue);
      case "subset": {
        const at = keyOf(sim, s.key);
        const values = new Set(s.values);
        return s.packets.every((p) => [...sim.domains.get(p)].every((k) => values.has(at(k))));
      }
      default:
        return false;
    }
  }

  function apply(sim, s) {
    const others = (keep) => sim.ids.filter((q) => !keep.includes(q));
    if (s.t === "single") {
      const [k] = sim.domains.get(s.packet);
      sim.placed.add(s.packet);
      for (const q of others([s.packet])) {
        const d = sim.domains.get(q);
        for (const x of [...d]) if (row(sim, x) === row(sim, k) || col(sim, x) === col(sim, k)) d.delete(x);
      }
    } else if (s.t === "line") {
      const at = keyOf(sim, s.axis);
      const d = sim.domains.get(s.packet);
      for (const x of [...d]) if (at(x) !== s.line) d.delete(x);
    } else if (s.t === "annul") {
      const clue = sim.clues.find((c) => c.id === s.clue);
      sim.annulled.add(s.clue);
      for (const q of others([clue.packet])) {
        const d = sim.domains.get(q);
        for (const x of clue.excluded) d.delete(x);
      }
    } else if (s.t === "subset") {
      const at = keyOf(sim, s.key);
      const values = new Set(s.values);
      for (const q of others(s.packets)) {
        const d = sim.domains.get(q);
        for (const x of [...d]) if (values.has(at(x))) d.delete(x);
      }
    }
  }

  // Deducciones que hacen avanzar ahora, como en difficulty._options (con su nivel).
  // `mode` decide qué se puede decir de la víctima, que se deduce por descarte
  // al final: "strict", nada; "relaxed", puede entrar en filas obligadas y
  // reservas, pero no colocarse; "any", todo.
  function deductions(sim, mode = "any") {
    const allowed = (s) => mode === "any" || (s.t === "single" ? s.packet !== sim.victim
      : mode === "relaxed" || (s.packet !== sim.victim && !(s.packets || []).includes(sim.victim)));
    return allDeductions(sim).filter(allowed);
  }

  function allDeductions(sim) {
    const found = [];
    for (const p of sim.ids) {
      if (!sim.placed.has(p) && sim.domains.get(p).size === 1) found.push({ t: "single", packet: p, level: 1 });
    }
    for (const [axis, full, size] of [["row", sim.fullRows, sim.H], ["column", sim.fullColumns, sim.W]]) {
      if (!full) continue;
      const at = keyOf(sim, axis);
      for (let line = 1; line <= size; line++) {
        const h = holders(sim, axis, line);
        if (h.length === 1 && [...sim.domains.get(h[0])].some((k) => at(k) !== line)) {
          found.push({ t: "line", packet: h[0], axis, line, level: 2 });
        }
      }
    }
    for (const clue of sim.clues) {
      if (!clue.excluded.size || sim.annulled.has(clue.id)) continue;
      const hits = sim.ids.some((q) => q !== clue.packet && [...clue.excluded].some((x) => sim.domains.get(q).has(x)));
      if (hits) found.push({ t: "annul", clue: clue.id, packet: clue.packet, level: 2 });
    }
    // Reservas. A diferencia del generador, incluyen a la víctima y la de un
    // solo paquete en una fila o columna («B solo cabe en la fila 5: la fila
    // es suya»): el jugador puede haber colocado los paquetes en otro orden, y
    // entonces le hacen falta.
    const pending = sim.ids.filter((p) => sim.domains.get(p).size > 1);
    for (let k = 1; k <= MAX_SUBSET; k++) {
      for (const combo of combinations(pending, k)) {
        const cells = new Set();
        for (const p of combo) for (const x of sim.domains.get(p)) cells.add(x);
        for (const key of k === 1 ? ["row", "column"] : ["cell", "row", "column"]) {
          const at = keyOf(sim, key);
          const used = new Set([...cells].map(at));
          if (used.size !== k) continue;
          const blocks = sim.ids.some((q) => !combo.includes(q) && [...sim.domains.get(q)].some((x) => used.has(at(x))));
          if (blocks) found.push({ t: "subset", key, packets: combo, values: [...used].sort((a, b) => a - b), level: k === 1 ? 2 : k + 1 });
        }
      }
    }
    return found;
  }

  function combinations(items, k, start = 0, acc = [], out = []) {
    if (acc.length === k) {
      out.push(acc.slice());
      return out;
    }
    for (let i = start; i < items.length; i++) {
      acc.push(items[i]);
      combinations(items, k, i + 1, acc, out);
      acc.pop();
    }
    return out;
  }

  // ---------- Sugerencia ----------

  // Cadena de deducciones hasta el siguiente paquete. Se prefiere no hablar de
  // la víctima: primero sin ella, luego con ella en filas obligadas y
  // reservas, y solo si no hay otro camino, colocándola.
  function chain(sim0) {
    for (const mode of ["strict", "relaxed", "any"]) {
      const steps = search(sim0, mode);
      if (steps) return steps;
    }
    return null;
  }

  // De la deducción más sencilla primero, hasta que un paquete queda en una
  // sola casilla; luego sin los pasos que no hacen falta.
  function search(sim0, mode) {
    const sim = clone(sim0);
    let steps = [];
    for (let guard = 0; guard < 500; guard++) {
      const options = deductions(sim, mode);
      if (!options.length) return null;
      const single = options.find((o) => o.t === "single");
      if (single) {
        steps.push(single);
        break;
      }
      const easiest = Math.min(...options.map((o) => o.level));
      const step = options.find((o) => o.level === easiest);
      apply(sim, step);
      steps.push(step);
    }
    if (!steps.length || steps[steps.length - 1].t !== "single") return null;
    for (let i = 0; i < steps.length - 1;) {
      const trial = steps.slice(0, i).concat(steps.slice(i + 1));
      if (replays(sim0, trial)) steps = trial;
      else i++;
    }
    return steps;
  }

  function replays(sim0, steps) {
    const sim = clone(sim0);
    for (const s of steps) {
      if (!valid(sim, s)) return false;
      apply(sim, s);
    }
    return true;
  }

  // Lo que el jugador debería mirar: datos de cada paso, en coordenadas [f, c].
  function describe(sim, steps, level) {
    const pos = (k) => [row(sim, k), col(sim, k)];
    return steps.map((s) => {
      switch (s.t) {
        case "single":
          return { t: "single", packet: s.packet, clues: level.clues.filter((c) => c.packet === s.packet).map((c) => c.id) };
        case "line":
          return { t: "line", packet: s.packet, axis: s.axis, line: s.line };
        case "annul": {
          const clue = sim.clues.find((c) => c.id === s.clue);
          return { t: "annul", packet: s.packet, clue: s.clue, cells: [...clue.excluded].sort((a, b) => a - b).map(pos) };
        }
        case "subset":
          return { t: "subset", key: s.key, packets: s.packets, values: s.key === "cell" ? s.values.map(pos) : s.values };
        default:
          return s;
      }
    });
  }

  // Sugerencia para el estado actual: una ✕ mal puesta o la cadena de
  // deducciones hasta el siguiente paquete. null si no hay nada que sugerir.
  function next(level, placed, marks) {
    if (!supported(level)) return null;
    for (const p of level.packets.items) {
      if (p.id in (placed || {})) continue;
      const [r, c] = p.solution.position;
      if (marks && marks.has(`${r},${c}`)) return { kind: "mark", cell: [r, c] };
    }
    const sim = setup(level, placed);
    const steps = chain(sim);
    if (!steps) return null;
    return { kind: "deduction", target: steps[steps.length - 1].packet, steps: describe(sim, steps, level) };
  }

  // `internals`: para las pruebas del razonador (no los usa el juego).
  window.NetdokuHints = { supported, next, internals: { setup, chain, clone, valid, apply } };
})();
