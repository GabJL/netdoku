// Aplicación de Netdoku: menú, vistas y progresión de niveles. La partida en sí
// está en netdoku.js (NetdokuGame). La vista se elige con el fragmento de la URL:
// #menu, #howto, #play[/categoría], #stats, #help, #about,
// #game/categoría/dificultad y #free (nivel cargado desde un fichero).
//
// Cada categoría tiene cinco dificultades y cada dificultad, un lote de niveles
// (levels/index.json). Al jugar una dificultad sale uno del lote al azar, sin
// repetir hasta haberlos visto casi todos. Se guarda el mejor resultado de cada
// dificultad (nunca baja) y, para abrir una dificultad, hay que haber resuelto
// la anterior.
(function () {
  "use strict";

  const LEVELS = "../levels/";
  const DIFFICULTIES = [1, 2, 3, 4, 5];
  const MAX_STARS = 3;
  const RECORD_KEY = "netdoku:record";
  const SLOT_PREFIX = "netdoku:slot:";
  const VIEWS = ["menu", "howto", "play", "stats", "help", "about", "game"];

  const $ = (id) => document.getElementById(id);
  const I18n = window.NetdokuI18n;
  const Help = window.NetdokuHelp;
  const t = (key, vars) => I18n.t(key, vars);
  const dots = (n) => "●".repeat(n) + "○".repeat(5 - n);
  const starText = (n) => "★".repeat(n) + "☆".repeat(MAX_STARS - n);

  let catalog = null; // [{ id, difficulties: { "1": [ficheros relativos a levels/] } }]
  let route = { view: "menu" };
  let current = null; // partida abierta: { cat, d, file } o { free: true }
  let freeLevel = null;
  let infoCategory = null; // categoría de la ventana de información abierta
  let loading = 0;

  // ---------- Almacenamiento (en este navegador) ----------

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      // Sin almacenamiento (modo privado…): se juega sin guardar.
    }
  }

  // Mejor resultado: { categoría: { dificultad: { stars, solved } } }.
  const record = () => readJson(RECORD_KEY, {});

  function best(cat, d) {
    const r = record();
    return (r[cat] && r[cat][d]) || { stars: 0, solved: 0 };
  }

  // Las estrellas son las mejores conseguidas: nunca se pierden.
  function recordSolve(cat, d, stars) {
    const r = record();
    r[cat] = r[cat] || {};
    const old = r[cat][d] || { stars: 0, solved: 0 };
    r[cat][d] = { stars: Math.max(old.stars, stars), solved: old.solved + 1 };
    writeJson(RECORD_KEY, r);
    return { best: r[cat][d].stars, unlocked: old.solved === 0 && hasLevels(cat, d + 1) };
  }

  // Hueco de cada dificultad: nivel actual, su progreso y los ya jugados.
  const slotKey = (cat, d) => `${SLOT_PREFIX}${cat}:${d}`;
  const readSlot = (cat, d) => ({ file: null, progress: null, played: [], ...readJson(slotKey(cat, d), {}) });
  const writeSlot = (cat, d, slot) => writeJson(slotKey(cat, d), slot);

  const finished = (progress) => !!progress && (progress.solved || progress.lost);
  const inProgress = (progress) => !!progress && !finished(progress)
    && (Object.keys(progress.placed || {}).length > 0 || Object.keys(progress.notes || {}).length > 0
      || (progress.marks || []).length > 0);

  // ---------- Catálogo ----------

  function categoryIds() {
    if (catalog) return catalog.map((c) => c.id);
    return Object.keys(I18n.get("categories") || {});
  }

  function levelsOf(cat, d) {
    const c = (catalog || []).find((x) => x.id === cat);
    return (c && c.difficulties[d]) || [];
  }

  const hasLevels = (cat, d) => levelsOf(cat, d).length > 0;
  const isSolved = (cat, d) => best(cat, d).solved > 0;
  const isUnlocked = (cat, d) => d === 1 || isSolved(cat, d - 1);

  // Completa: resueltas todas las dificultades que tienen niveles.
  function isComplete(cat) {
    const ds = DIFFICULTIES.filter((d) => hasLevels(cat, d));
    return ds.length > 0 && ds.every((d) => isSolved(cat, d));
  }

  const categoryStars = (cat) => DIFFICULTIES.reduce((sum, d) => sum + best(cat, d).stars, 0);
  const categoryName = (cat) => t(`categories.${cat}.name`);

  // Categoría que se muestra al entrar en «Jugar»: la más avanzada que se ha
  // empezado sin completarla; si no hay ninguna, la primera sin completar.
  function defaultCategory() {
    const ids = categoryIds();
    const started = ids.filter((c) => !isComplete(c) && DIFFICULTIES.some((d) => isSolved(c, d)));
    if (started.length) return started[started.length - 1];
    return ids.find((c) => !isComplete(c)) || ids[0];
  }

  // Elige un nivel del lote al azar entre los no jugados. Cuando ya se han
  // jugado todos, se vuelve a empezar evitando la mitad más reciente.
  function pickLevel(cat, d, avoid) {
    const files = levelsOf(cat, d);
    const slot = readSlot(cat, d);
    let played = slot.played.filter((f) => files.includes(f));
    let candidates = files.filter((f) => !played.includes(f) && f !== avoid);
    if (!candidates.length) {
      played = played.slice(-Math.floor(files.length / 2));
      candidates = files.filter((f) => !played.includes(f) && f !== avoid);
    }
    if (!candidates.length) candidates = files;
    const file = candidates[Math.floor(Math.random() * candidates.length)];
    writeSlot(cat, d, { file, progress: null, played: [...played.filter((f) => f !== file), file] });
    return file;
  }

  // ---------- Navegación ----------

  function go(path) {
    if (location.hash === `#${path}`) onRoute();
    else location.hash = path;
  }

  function onRoute() {
    const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
    const view = parts[0] || "menu";
    if (view === "game") {
      route = { view, cat: parts[1], d: Number(parts[2]) };
      openGame(route.cat, route.d);
    } else if (view === "free") {
      route = { view: "game", free: true };
      openFree();
    } else if (VIEWS.includes(view)) {
      route = { view, cat: parts[1] };
      showView(view);
      renderView();
    } else {
      go("menu");
    }
  }

  function showView(view) {
    for (const v of VIEWS) $(`view-${v}`).hidden = v !== view;
    document.body.dataset.view = view;
    updateTopbar();
    window.scrollTo(0, 0);
  }

  function renderView() {
    switch (route.view) {
      case "menu": renderMenu(); break;
      case "howto": renderHowto(); break;
      case "play": renderPlay(); break;
      case "stats": renderStats(); break;
      case "help": renderHelp(); break;
      case "about": renderAbout(); break;
      default: break;
    }
  }

  function updateTopbar() {
    const inGame = route.view === "game";
    $("back").hidden = route.view === "menu";
    $("game-title").hidden = !inGame;
    $("game-tools").hidden = !inGame;
    $("lives").hidden = !inGame;
    if (!inGame) return;
    const cat = route.free ? freeLevel && freeLevel.level && freeLevel.level.category : route.cat;
    const known = !!cat && !!I18n.get(`categories.${cat}`);
    $("category-info").hidden = !known;
    $("new-level").hidden = !!route.free;
    if (route.free) {
      $("game-title").textContent = known ? categoryName(cat) : "";
    } else {
      $("game-title").textContent = t("game.title", { category: categoryName(cat), tier: t(`tiers.${route.d}`) });
    }
  }

  function goBack() {
    if (route.view === "game" && !route.free && route.cat) go(`play/${route.cat}`);
    else go("menu");
  }

  // ---------- Partida ----------

  // Entra en una dificultad desde «Jugar» o desde el final de un nivel: si el
  // último nivel de esa dificultad ya terminó, sale otro.
  function playDifficulty(cat, d) {
    if (finished(readSlot(cat, d).progress)) pickLevel(cat, d);
    go(`game/${cat}/${d}`);
  }

  async function openGame(cat, d, retried) {
    if (!catalog) {
      go("menu");
      return;
    }
    if (!hasLevels(cat, d) || !isUnlocked(cat, d)) {
      go(`play/${cat}`);
      return;
    }
    const files = levelsOf(cat, d);
    let slot = readSlot(cat, d);
    if (!slot.file || !files.includes(slot.file)) {
      pickLevel(cat, d);
      slot = readSlot(cat, d);
    }
    const file = slot.file;
    const ticket = ++loading;
    let data;
    try {
      const res = await fetch(LEVELS + file, { cache: "no-store" });
      if (!res.ok) throw new Error(res.statusText);
      data = await res.json();
    } catch (err) {
      if (ticket !== loading) return;
      // El fichero ya no está (colección regenerada): se prueba con otro.
      if (!retried) {
        pickLevel(cat, d, file);
        openGame(cat, d, true);
      } else {
        notice(t("ui.levelLoadError"));
        go(`play/${cat}`);
      }
      return;
    }
    if (ticket !== loading) return;
    current = { cat, d, file };
    showView("game");
    window.NetdokuGame.start(data, {
      saved: slot.progress,
      category: cat,
      onSave: (progress) => {
        const s = readSlot(cat, d);
        if (s.file === file) writeSlot(cat, d, { ...s, progress });
      },
      onSolve: (lives) => recordSolve(cat, d, lives),
      actions: (state) => gameActions(cat, d, state),
    });
  }

  function gameActions(cat, d, state) {
    const list = [];
    const next = d < 5 && hasLevels(cat, d + 1) && isUnlocked(cat, d + 1);
    if (state.solved && next) {
      list.push({ label: t("game.nextDifficulty"), primary: true, onClick: () => playDifficulty(cat, d + 1) });
    }
    list.push({ label: t("game.newLevel"), primary: !state.solved || !next, onClick: () => newLevel(true) });
    list.push({ label: t("game.backToCategory"), onClick: () => go(`play/${cat}`) });
    return list;
  }

  // ↺: otro nivel de la misma dificultad.
  function newLevel(skipConfirm) {
    if (!current || current.free) return;
    if (!skipConfirm && window.NetdokuGame.hasProgress() && !window.confirm(t("game.confirmNew"))) return;
    pickLevel(current.cat, current.d, current.file);
    openGame(current.cat, current.d);
  }

  // Nivel arrastrado a la página: se juega sin guardar ni puntuar.
  function loadFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      let data = null;
      try {
        data = JSON.parse(reader.result);
      } catch (err) {
        data = null;
      }
      if (!data || !data.board || !data.packets || !data.networks || !data.clues) {
        notice(t("ui.fileError"));
        return;
      }
      freeLevel = data;
      go("free");
    };
    reader.readAsText(file);
  }

  function openFree() {
    if (!freeLevel) {
      go("menu");
      return;
    }
    loading++;
    current = { free: true };
    showView("game");
    window.NetdokuGame.start(freeLevel, {
      category: freeLevel.level && freeLevel.level.category,
      message: t("ui.freePlay"),
      actions: () => [{ label: t("ui.toMenu"), primary: true, onClick: () => go("menu") }],
    });
  }

  // ---------- Vistas ----------

  function el(tag, attrs, parent) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === "text") node.textContent = v;
      else if (k === "className") node.className = v;
      else node.setAttribute(k, v);
    }
    if (parent) parent.appendChild(node);
    return node;
  }

  // Aviso pasajero bajo la barra superior.
  let noticeTimer = null;
  function notice(text) {
    const box = $("notice");
    box.textContent = text;
    box.hidden = !text;
    clearTimeout(noticeTimer);
    if (text) noticeTimer = setTimeout(() => { box.hidden = true; }, 8000);
  }

  function renderMenu() {
    $("menu-error").hidden = !!catalog;
    $("menu-error").textContent = t("ui.loadError");
  }

  // Fichas de ayuda en rejilla (las mismas del panel de cada nivel).
  function helpCards(parent, ids) {
    const grid = el("div", { className: "help-grid" }, parent);
    for (const id of ids) {
      const entry = Help.entry(id);
      if (!entry) continue;
      const card = el("section", { className: `help-card cat-${entry.category}`, id: `help-${entry.id}` }, grid);
      Help.renderEntry(card, entry);
    }
    return grid;
  }

  function sectionTitle(parent, text, cat) {
    return el("h2", { className: `section${cat ? ` cat-${cat}` : ""}`, text }, parent);
  }

  function categoryCards(parent, onOpen) {
    const list = el("div", { className: "category-cards" }, parent);
    for (const cat of categoryIds()) {
      const card = el("article", { className: "category-card" }, list);
      el("h3", { text: categoryName(cat) }, card);
      el("p", { text: t(`categories.${cat}.short`) }, card);
      const b = el("button", { type: "button", className: "button", text: t("play.info") }, card);
      b.addEventListener("click", () => onOpen(cat));
    }
    return list;
  }

  function renderHowto() {
    const root = $("howto-body");
    root.innerHTML = "";
    el("p", { className: "intro", text: t("howto.intro") }, root);
    sectionTitle(root, t("howto.basics"), "basic");
    helpCards(root, ["how_to_play", "objective"]);
    sectionTitle(root, t("howto.common"), "rules");
    helpCards(root, ["row_column", "adjacent", "icons"]);
    sectionTitle(root, t("howto.clues"), "clues");
    helpCards(root, ["in_network", "adjacent_to_node", "router", "spatial"]);
    sectionTitle(root, t("howto.categories"));
    el("p", { className: "intro", text: t("howto.categoriesIntro") }, root);
    categoryCards(root, openInfo);
  }

  function renderHelp() {
    const root = $("help-body");
    root.innerHTML = "";
    el("p", { className: "intro", text: t("help.intro") }, root);
    for (const cat of Help.CATEGORIES) {
      const ids = Help.ENTRIES.filter((e) => e.category === cat.id).map((e) => e.id);
      if (!ids.length) continue;
      sectionTitle(root, cat.title, cat.id);
      helpCards(root, ids);
    }
  }

  function renderAbout() {
    const root = $("about-body");
    root.innerHTML = "";
    for (const p of I18n.get("about.paragraphs") || []) el("p", { text: p }, root);
    el("p", { className: "muted", text: t("about.license") }, root);
  }

  function renderPlay() {
    const tabs = $("play-categories");
    const detail = $("play-detail");
    tabs.innerHTML = "";
    detail.innerHTML = "";
    if (!catalog) {
      el("p", { className: "error", text: t("ui.loadError") }, detail);
      return;
    }
    const ids = categoryIds();
    const cat = ids.includes(route.cat) ? route.cat : defaultCategory();
    const maxStars = (c) => DIFFICULTIES.filter((d) => hasLevels(c, d)).length * MAX_STARS;

    for (const id of ids) {
      const b = el("button", { type: "button", role: "tab", className: "category-tab" }, tabs);
      b.setAttribute("aria-selected", id === cat);
      if (isComplete(id)) b.classList.add("complete");
      el("span", { className: "name", text: categoryName(id) }, b);
      const stars = el("span", { className: "count", text: `★ ${categoryStars(id)}/${maxStars(id)}` }, b);
      stars.title = t("play.progress", { stars: categoryStars(id), max: maxStars(id) });
      if (isComplete(id)) el("span", { className: "done", text: `✓ ${t("play.completed")}` }, b);
      b.addEventListener("click", () => go(`play/${id}`));
    }

    const head = el("div", { className: "detail-head" }, detail);
    const text = el("div", {}, head);
    el("h2", { text: categoryName(cat) }, text);
    el("p", { text: t(`categories.${cat}.short`) }, text);
    const info = el("button", { type: "button", className: "button", text: `ⓘ ${t("play.info")}` }, head);
    info.addEventListener("click", () => openInfo(cat));

    const list = el("div", { className: "difficulty-list" }, detail);
    for (const d of DIFFICULTIES) {
      const b = el("button", { type: "button", className: "difficulty" }, list);
      const unlocked = isUnlocked(cat, d);
      const available = hasLevels(cat, d);
      const result = best(cat, d);
      el("span", { className: "dots", text: dots(d) }, b);
      el("span", { className: "tier", text: t(`tiers.${d}`) }, b);
      if (!available) {
        b.disabled = true;
        b.title = t("play.noLevels");
        el("span", { className: "stars muted", text: "—" }, b);
      } else if (!unlocked) {
        b.disabled = true;
        b.title = t("play.locked");
        el("span", { className: "stars muted", text: "🔒" }, b);
      } else {
        const stars = el("span", { className: "stars", text: result.solved ? starText(result.stars) : "☆☆☆" }, b);
        if (!result.solved) stars.classList.add("muted");
        stars.title = t("play.progress", { stars: result.stars, max: MAX_STARS });
        if (inProgress(readSlot(cat, d).progress)) el("span", { className: "tag", text: t("play.inProgress") }, b);
        if (result.solved) b.classList.add("solved");
        b.addEventListener("click", () => playDifficulty(cat, d));
      }
    }
  }

  function renderStats() {
    const root = $("stats-body");
    root.innerHTML = "";
    if (!catalog) {
      el("p", { className: "error", text: t("ui.loadError") }, root);
      return;
    }
    const table = el("table", { className: "stats-table" }, root);
    const headRow = el("tr", {}, el("thead", {}, table));
    el("th", { scope: "col", text: t("stats.category") }, headRow);
    for (const d of DIFFICULTIES) {
      const th = el("th", { scope: "col", text: String(d) }, headRow);
      th.title = t(`tiers.${d}`);
    }
    el("th", { scope: "col", text: t("stats.total") }, headRow);
    const body = el("tbody", {}, table);
    let solvedGames = 0;
    for (const cat of categoryIds()) {
      const row = el("tr", {}, body);
      if (isComplete(cat)) row.className = "complete";
      const th = el("th", { scope: "row" }, row);
      const link = el("a", { href: `#play/${cat}`, text: categoryName(cat) }, th);
      link.title = t("play.title");
      let max = 0;
      for (const d of DIFFICULTIES) {
        const result = best(cat, d);
        solvedGames += result.solved;
        const td = el("td", {}, row);
        if (!hasLevels(cat, d)) {
          td.textContent = "";
        } else if (result.solved) {
          max += MAX_STARS;
          td.textContent = starText(result.stars);
          td.className = "stars";
          td.title = `${t(`tiers.${d}`)}: ${t("play.progress", { stars: result.stars, max: MAX_STARS })}`;
        } else {
          max += MAX_STARS;
          td.textContent = isUnlocked(cat, d) ? "·" : "🔒";
          td.className = "muted";
          td.title = isUnlocked(cat, d) ? t(`tiers.${d}`) : t("play.locked");
        }
      }
      el("td", { className: "total", text: `${categoryStars(cat)}/${max}` }, row);
    }
    el("p", { className: "muted", text: t("stats.solved", { n: solvedGames }) }, root);
  }

  // Ventana con la teoría y las reglas nuevas de una categoría.
  function openInfo(cat) {
    infoCategory = cat;
    renderInfo();
    const dialog = $("info-dialog");
    if (!dialog.open) dialog.showModal();
  }

  function renderInfo() {
    const cat = infoCategory;
    const body = $("info-body");
    body.innerHTML = "";
    el("h2", { text: categoryName(cat) }, body);
    el("p", { className: "intro", text: t(`categories.${cat}.short`) }, body);
    sectionTitle(body, t("info.theory"), "basic");
    const ul = el("ul", { className: "theory" }, body);
    for (const p of I18n.get(`categories.${cat}.theory`) || []) el("li", { text: p }, ul);
    sectionTitle(body, t("info.newRules"), "clues");
    helpCards(body, I18n.get(`categories.${cat}.rules`) || []);
  }

  // ---------- Idioma, tema y arranque ----------

  function fillLangSelect() {
    const select = $("lang-select");
    select.innerHTML = "";
    for (const code of I18n.available()) {
      el("option", { value: code, text: I18n.name(code) }, select);
    }
    select.value = I18n.current();
  }

  function onLang() {
    I18n.applyStatic();
    fillLangSelect();
    updateTopbar();
    renderView();
    if ($("info-dialog").open) renderInfo();
  }

  function onTheme() {
    // Los mini tableros de las fichas usan los colores del tema.
    if (route.view === "howto" || route.view === "help") renderView();
    if ($("info-dialog").open) renderInfo();
  }

  function bind() {
    $("back").addEventListener("click", goBack);
    $("new-level").addEventListener("click", () => newLevel(false));
    $("category-info").addEventListener("click", () => {
      const cat = route.free ? freeLevel.level.category : route.cat;
      if (cat) openInfo(cat);
    });
    $("lang-select").addEventListener("change", (e) => I18n.setLang(e.target.value));
    for (const dialog of document.querySelectorAll("dialog")) {
      const close = dialog.querySelector(".close");
      if (close) close.addEventListener("click", () => dialog.close());
      // Pulsar fuera de la ventana (en el fondo) la cierra.
      dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
    }
    document.addEventListener("dragover", (e) => e.preventDefault());
    document.addEventListener("drop", (e) => {
      e.preventDefault();
      if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
    });
    window.addEventListener("hashchange", onRoute);
    window.addEventListener("netdoku-lang", onLang);
    window.addEventListener("netdoku-theme", onTheme);
  }

  async function init() {
    document.documentElement.lang = I18n.current();
    I18n.applyStatic();
    fillLangSelect();
    if (window.NetdokuTheme) window.NetdokuTheme.mountControls($("appearance-controls"));
    bind();
    try {
      const res = await fetch(`${LEVELS}index.json`, { cache: "no-store" });
      if (!res.ok) throw new Error(res.statusText);
      catalog = (await res.json()).categories || [];
    } catch (err) {
      catalog = null;
    }
    onRoute();
  }

  init();
})();
