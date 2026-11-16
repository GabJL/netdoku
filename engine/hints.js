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
// Cada posibilidad de un paquete es un número: la casilla k (de 0 a W·H − 1)
// o, si el paquete tiene oculto su origen o su destino (Encaminamiento), el
// estado «casilla k con el extremo en la red i», k + W·H·(1 + i). Un paquete
// queda colocado cuando todas sus posibilidades están en la misma casilla. Las
// pistas entre dos paquetes (`relation`) dan el valor de cada posibilidad de
// cada uno y los pares de valores permitidos.
//
// No conoce el DOM ni los textos: devuelve datos que netdoku.js explica en el
// idioma activo.
(function () {
  "use strict";

  const MAX_SUBSET = 4; // como maxSubset en el generador

  // ¿Trae el nivel lo que hace falta? (Los niveles anteriores a las sugerencias, no.)
  function supported(level) {
    return !!level && Array.isArray(level.clues) && level.clues.every((c) => Array.isArray(c.domain) || c.relation);
  }

  // ---------- Estado de la deducción ----------

  function setup(level, placed) {
    const W = level.board.width;
    const H = level.board.height;
    const nets = (level.networks || []).map((n) => n.id);
    // [f, c] o [f, c, red] → número (véase el comentario del principio).
    const idx = ([r, c, net]) => (r - 1) * W + (c - 1) + (net === undefined ? 0 : W * H * (1 + nets.indexOf(net)));
    const nodeCells = new Set(level.nodes.map((n) => idx(n.position)));
    const free = [];
    for (let k = 0; k < W * H; k++) if (!nodeCells.has(k)) free.push(k);
    const ids = level.packets.items.map((p) => p.id);
    // Encaminamiento: cada paquete parte de las casillas de su ruta a las que le
    // llega el TTL (packets.items[].domain, regla packetOnRoute); con un extremo
    // oculto, de los estados de todas sus rutas posibles.
    const start = new Map(level.packets.items.map((p) => [p.id, Array.isArray(p.domain) ? p.domain.map(idx) : free]));
    const domains = new Map(ids.map((p) => [p, new Set(start.get(p).filter((x) => !nodeCells.has(x % (W * H))))]));
    const clues = level.clues.filter((c) => !c.relation).map((c) => ({
      id: c.id,
      packet: c.packet,
      excluded: new Set((c.excluded || []).map(idx)),
    }));
    // Una casilla de la pista admite todos los estados de esa casilla.
    for (const c of level.clues) {
      if (c.relation) continue;
      const allowed = new Set(c.domain.map(idx));
      const d = domains.get(c.packet);
      for (const x of [...d]) if (!allowed.has(x) && !allowed.has(x % (W * H))) d.delete(x);
    }
    const relations = level.clues.filter((c) => c.relation).map((c) => {
      const values = {};
      for (const [packet, groups] of Object.entries(c.relation.values)) {
        values[packet] = new Map();
        for (const [value, list] of Object.entries(groups)) for (const x of list) values[packet].set(idx(x), value);
      }
      return { id: c.id, first: c.packets[0], second: c.packets[1], values,
        allowed: c.relation.allowed.map(([a, b]) => [String(a), String(b)]) };
    });
    const rules = level.rules || {};
    const sim = {
      W, H, ids, domains, clues, relations,
      victim: level.packets.victimId || (level.objective || {}).victimPacketId,
      placed: new Set(),
      annulled: new Set(),
      fullRows: rules.onePacketPerRow !== false && ids.length === H,
      fullColumns: rules.onePacketPerColumn !== false && ids.length === W,
    };
    for (const [p, pos] of Object.entries(placed || {})) {
      // Si tiene un extremo oculto, puede quedarle más de una red en esa casilla.
      const k = idx(pos);
      const here = [...sim.domains.get(p)].filter((x) => cellOf(sim, x) === k);
      sim.domains.set(p, new Set(here.length ? here : [k]));
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

  const cellOf = (sim, x) => x % (sim.W * sim.H);
  const row = (sim, x) => Math.floor(cellOf(sim, x) / sim.W) + 1;
  const col = (sim, x) => (cellOf(sim, x) % sim.W) + 1;
  const keyOf = (sim, key) => (key === "row" ? (x) => row(sim, x) : key === "column" ? (x) => col(sim, x) : (x) => cellOf(sim, x));

  // La casilla del paquete si todas sus posibilidades están en ella; si no, null.
  function placedCell(sim, d) {
    let cell = null;
    for (const x of d) {
      if (cell === null) cell = cellOf(sim, x);
      else if (cellOf(sim, x) !== cell) return null;
    }
    return cell;
  }

  // Posibilidades de `target` sin pareja entre las de `source` en una pista
  // entre dos paquetes, y cuántos valores le quedan a `source` (como
  // solver.Relation.drop).
  function relationDrop(sim, rel, target, source) {
    const first = target === rel.first;
    const sourceValues = new Set([...sim.domains.get(source)].map((y) => rel.values[source].get(y)));
    const ok = new Set(rel.allowed.filter(([a, b]) => sourceValues.has(first ? b : a)).map(([a, b]) => (first ? a : b)));
    const drop = [...sim.domains.get(target)].filter((x) => {
      const v = rel.values[target].get(x);
      return v !== undefined && !ok.has(v);
    });
    return { drop, values: sourceValues.size };
  }

  // Paquetes con alguna casilla posible en una fila o columna.
  function holders(sim, axis, line) {
    const at = keyOf(sim, axis);
    return sim.ids.filter((p) => [...sim.domains.get(p)].some((k) => at(k) === line));
  }

  // ---------- Pasos: comprobar si valen ahora y aplicarlos ----------

  function valid(sim, s) {
    switch (s.t) {
      case "single":
        return !sim.placed.has(s.packet) && placedCell(sim, sim.domains.get(s.packet)) !== null;
      case "line": {
        const h = holders(sim, s.axis, s.line);
        return (s.axis === "row" ? sim.fullRows : sim.fullColumns) && h.length === 1 && h[0] === s.packet;
      }
      case "annul":
        return !sim.annulled.has(s.clue);
      case "relation":
        return relationDrop(sim, sim.relations.find((r) => r.id === s.clue), s.packet, s.other).drop.length > 0;
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
      const k = placedCell(sim, sim.domains.get(s.packet));
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
        for (const x of [...d]) if (clue.excluded.has(cellOf(sim, x))) d.delete(x);
      }
    } else if (s.t === "relation") {
      const { drop } = relationDrop(sim, sim.relations.find((r) => r.id === s.clue), s.packet, s.other);
      const d = sim.domains.get(s.packet);
      for (const x of drop) d.delete(x);
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
      : mode === "relaxed" || (s.packet !== sim.victim && s.other !== sim.victim && !(s.packets || []).includes(sim.victim)));
    return allDeductions(sim).filter(allowed);
  }

  function allDeductions(sim) {
    const found = [];
    for (const p of sim.ids) {
      if (!sim.placed.has(p) && placedCell(sim, sim.domains.get(p)) !== null) found.push({ t: "single", packet: p, level: 1 });
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
      const hits = sim.ids.some((q) => q !== clue.packet && [...sim.domains.get(q)].some((x) => clue.excluded.has(cellOf(sim, x))));
      if (hits) found.push({ t: "annul", clue: clue.id, packet: clue.packet, level: 2 });
    }
    // Pistas entre dos paquetes, en cada sentido: nivel 1 si el otro paquete ya
    // tiene un solo valor; 3 si hay que cruzar valores abiertos.
    for (const rel of sim.relations) {
      for (const [target, source] of [[rel.first, rel.second], [rel.second, rel.first]]) {
        const { drop, values } = relationDrop(sim, rel, target, source);
        if (drop.length) found.push({ t: "relation", clue: rel.id, packet: target, other: source, open: values > 1, level: values > 1 ? 3 : 1 });
      }
    }
    // Reservas. A diferencia del generador, incluyen a la víctima y la de un
    // solo paquete en una fila o columna («B solo cabe en la fila 5: la fila
    // es suya»): el jugador puede haber colocado los paquetes en otro orden, y
    // entonces le hacen falta.
    const pending = sim.ids.filter((p) => placedCell(sim, sim.domains.get(p)) === null);
    for (let k = 1; k <= MAX_SUBSET; k++) {
      for (const combo of combinations(pending, k)) {
        const cells = new Set();
        for (const p of combo) for (const x of sim.domains.get(p)) cells.add(cellOf(sim, x));
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
  // Repite la cadena para saber qué casillas descarta cada pista entre dos paquetes.
  function describe(sim0, steps, level) {
    const sim = clone(sim0);
    const pos = (k) => [row(sim, k), col(sim, k)];
    return steps.map((s) => {
      const out = describeStep(sim, s, level, pos);
      apply(sim, s);
      return out;
    });
  }

  function describeStep(sim, s, level, pos) {
    switch (s.t) {
      case "single":
        return { t: "single", packet: s.packet, clues: level.clues.filter((c) => (c.packets || [c.packet]).includes(s.packet)).map((c) => c.id) };
      case "relation": {
        // Casillas que deja de tener el paquete (no las que conserva con otra red).
        const { drop } = relationDrop(sim, sim.relations.find((r) => r.id === s.clue), s.packet, s.other);
        const gone = new Set(drop);
        const kept = new Set([...sim.domains.get(s.packet)].filter((x) => !gone.has(x)).map((x) => cellOf(sim, x)));
        const cells = [...new Set(drop.map((x) => cellOf(sim, x)))].filter((k) => !kept.has(k)).sort((a, b) => a - b);
        return { t: "relation", packet: s.packet, other: s.other, clue: s.clue, open: s.open, cells: cells.map(pos) };
      }
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
  window.NetdokuHints = { supported, next, internals: { setup, chain, clone, valid, apply, cellOf } };
})();
