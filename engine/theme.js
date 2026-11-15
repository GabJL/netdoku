// Apariencia de Netdoku, compartida por el juego y la página de ayuda.
//
// Un «tema» es una combinación con nombre de opciones independientes:
//   mode     automático / claro / oscuro (colores de la interfaz)
//   palette  colores de las redes (cada paleta tiene versión clara y oscura)
//   pattern  fondo de las casillas
//   icons    cómo se dibujan los equipos
//   numbers  números de fila y columna en el margen
//   netNames nombres de las redes dentro del tablero
// Hay temas de serie (PRESETS) y el jugador puede guardar los suyos.
//
// Se carga en <head> para aplicar el modo y la paleta antes de pintar. Las
// páginas leen las opciones con settings() y los colores con value(), y se
// redibujan al recibir el evento "netdoku-theme".
(function () {
  "use strict";

  const KEY = "netdoku:appearance";

  const OPTIONS = {
    mode: { label: "Modo", values: { auto: "Automático (según el sistema)", light: "Claro", dark: "Oscuro" } },
    palette: { label: "Colores de las redes", values: { pastel: "Pastel", vivid: "Intensos", colorblind: "Aptos para daltonismo", gray: "Grises" } },
    pattern: { label: "Fondo de las casillas", values: { plain: "Liso", dots: "Puntos", stripes: "Rayas", tiles: "Baldosas", perNetwork: "Una textura por red" } },
    icons: { label: "Equipos", values: { drawings: "Dibujos", text: "Texto (PC, Web, DNS…)", both: "Dibujos con texto" } },
  };
  const TOGGLES = {
    numbers: "Números de fila y columna",
    netNames: "Nombres de las redes en el tablero",
  };

  // Ocho colores por paleta y modo (redes 1 a 8 del nivel).
  const PALETTES = {
    pastel: {
      light: ["#f3d9a4", "#c5e3c6", "#bcd6f2", "#f4c6d6", "#d6cbef", "#ffdcb4", "#b8e6ea", "#e3e9a4"],
      dark: ["#6b5a36", "#3e6347", "#39587a", "#77495b", "#574a7a", "#7a5733", "#2f6a70", "#5f6833"],
    },
    vivid: {
      light: ["#f2c14e", "#7fc97f", "#7aa6e0", "#ef8fae", "#b39ddb", "#f7a35c", "#5ec4c9", "#c9d65a"],
      dark: ["#8a6a1f", "#2f7a45", "#2c5f9e", "#8f3d5c", "#5e4a96", "#8f5420", "#1f7a80", "#6b7a1f"],
    },
    // Tonos de la paleta Okabe-Ito, distinguibles con los tipos de daltonismo más comunes.
    colorblind: {
      light: ["#f3cf80", "#aedaf4", "#80cfb9", "#f8f2a1", "#80b9d9", "#eaaf80", "#e6bcd3", "#cccccc"],
      dark: ["#7e5700", "#2f6380", "#005740", "#847d24", "#003e62", "#753300", "#70425c", "#545454"],
    },
    gray: {
      light: ["#e6e6e6", "#cfcfcf", "#f4f4f4", "#bdbdbd", "#dadada", "#c4c4c4", "#eeeeee", "#d2d2d2"],
      dark: ["#3a3a3a", "#4a4a4a", "#2e2e2e", "#565656", "#424242", "#505050", "#353535", "#474747"],
    },
  };

  const DEFAULT = { mode: "auto", palette: "pastel", pattern: "plain", icons: "drawings", numbers: true, netNames: true };
  const PRESETS = {
    "Clásico": { ...DEFAULT },
    "Texturas": { ...DEFAULT, pattern: "perNetwork" },
    "Accesible": { ...DEFAULT, palette: "colorblind", pattern: "perNetwork", icons: "both" },
    "Texto": { ...DEFAULT, icons: "text" },
  };

  // ---------- Estado guardado ----------

  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(KEY) || "null");
      if (data && data.settings) {
        return { theme: data.theme ?? null, settings: { ...DEFAULT, ...data.settings }, custom: data.custom || {} };
      }
    } catch (err) {
      // Datos corruptos o sin almacenamiento: valores por defecto.
    }
    return { theme: "Clásico", settings: { ...DEFAULT }, custom: {} };
  }

  let store = load();

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(store));
    } catch (err) {
      // Sin almacenamiento: la apariencia dura hasta recargar.
    }
  }

  function themes() {
    return { ...PRESETS, ...store.custom };
  }

  // ---------- Aplicación ----------

  const darkQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  function effectiveMode() {
    if (store.settings.mode !== "auto") return store.settings.mode;
    return darkQuery && darkQuery.matches ? "dark" : "light";
  }

  function apply() {
    const root = document.documentElement;
    if (store.settings.mode === "auto") delete root.dataset.theme;
    else root.dataset.theme = store.settings.mode;
    const colors = (PALETTES[store.settings.palette] || PALETTES.pastel)[effectiveMode()];
    colors.forEach((color, i) => root.style.setProperty(`--net-${i + 1}`, color));
  }

  function notify() {
    window.dispatchEvent(new Event("netdoku-theme"));
    refreshControls();
  }

  function update(changes, themeName) {
    store.settings = { ...store.settings, ...changes };
    store.theme = themeName === undefined ? null : themeName;
    persist();
    apply();
    notify();
  }

  function selectTheme(name) {
    const t = themes()[name];
    if (t) update({ ...DEFAULT, ...t }, name);
  }

  function saveTheme(name) {
    name = name.trim();
    if (!name || PRESETS[name]) return false;
    store.custom[name] = { ...store.settings };
    store.theme = name;
    persist();
    notify();
    return true;
  }

  function deleteTheme(name) {
    if (!store.custom[name]) return;
    delete store.custom[name];
    if (store.theme === name) store.theme = null;
    persist();
    notify();
  }

  function value(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function settings() {
    return { ...store.settings };
  }

  // ---------- Controles: selector de tema, botón y ventana de apariencia ----------

  const controls = [];

  function el(tag, props, parent) {
    const node = document.createElement(tag);
    Object.assign(node, props || {});
    if (parent) parent.appendChild(node);
    return node;
  }

  function fillThemeSelect(select) {
    select.innerHTML = "";
    if (store.theme === null) el("option", { value: "", textContent: "Tema: personalizado" }, select);
    for (const name of Object.keys(themes())) {
      el("option", { value: name, textContent: `Tema: ${name}` }, select);
    }
    select.value = store.theme === null ? "" : store.theme;
  }

  function buildDialog() {
    const dialog = el("dialog", { className: "help-dialog appearance-dialog" }, document.body);
    const close = el("button", { type: "button", className: "close", textContent: "✕" }, dialog);
    close.setAttribute("aria-label", "Cerrar");
    close.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });

    const body = el("div", { className: "help-body appearance" }, dialog);
    el("h2", { textContent: "Apariencia" }, body);

    const themeRow = el("label", { className: "field" }, body);
    el("span", { textContent: "Tema guardado" }, themeRow);
    const themeSelect = el("select", {}, themeRow);
    themeSelect.addEventListener("change", () => { if (themeSelect.value) selectTheme(themeSelect.value); });

    const fields = {};
    for (const [key, opt] of Object.entries(OPTIONS)) {
      const row = el("label", { className: "field" }, body);
      el("span", { textContent: opt.label }, row);
      const select = el("select", {}, row);
      for (const [v, text] of Object.entries(opt.values)) el("option", { value: v, textContent: text }, select);
      select.addEventListener("change", () => update({ [key]: select.value }));
      fields[key] = select;
    }
    for (const [key, text] of Object.entries(TOGGLES)) {
      const row = el("label", { className: "field check" }, body);
      const box = el("input", { type: "checkbox" }, row);
      el("span", { textContent: text }, row);
      box.addEventListener("change", () => update({ [key]: box.checked }));
      fields[key] = box;
    }

    const save = el("div", { className: "save-row" }, body);
    const nameInput = el("input", { type: "text", placeholder: "Nombre del tema", maxLength: 30 }, save);
    const saveBtn = el("button", { type: "button", className: "button", textContent: "Guardar como tema" }, save);
    const delBtn = el("button", { type: "button", className: "button", textContent: "Eliminar tema" }, save);
    const note = el("p", { className: "note" }, body);
    saveBtn.addEventListener("click", () => {
      const name = nameInput.value;
      if (PRESETS[name.trim()]) {
        note.textContent = "Ese nombre es de un tema de serie; elige otro.";
      } else if (saveTheme(name)) {
        note.textContent = `Guardado como «${name.trim()}».`;
        nameInput.value = "";
      } else {
        note.textContent = "Escribe un nombre para el tema.";
      }
    });
    delBtn.addEventListener("click", () => {
      if (store.theme && store.custom[store.theme]) {
        note.textContent = `Eliminado «${store.theme}».`;
        deleteTheme(store.theme);
      }
    });

    return {
      dialog,
      refresh() {
        fillThemeSelect(themeSelect);
        for (const key of Object.keys(OPTIONS)) fields[key].value = store.settings[key];
        for (const key of Object.keys(TOGGLES)) fields[key].checked = !!store.settings[key];
        delBtn.disabled = !(store.theme && store.custom[store.theme]);
      },
    };
  }

  // Añade a `container` el selector de tema y el botón «⚙ Apariencia».
  function mountControls(container) {
    const select = el("select", {}, container);
    select.setAttribute("aria-label", "Tema");
    select.addEventListener("change", () => { if (select.value) selectTheme(select.value); });
    const button = el("button", { type: "button", className: "button", textContent: "⚙ Apariencia" }, container);
    const panel = buildDialog();
    button.addEventListener("click", () => {
      panel.refresh();
      panel.dialog.showModal();
    });
    controls.push({ select, panel });
    refreshControls();
  }

  function refreshControls() {
    for (const c of controls) {
      fillThemeSelect(c.select);
      c.panel.refresh();
    }
  }

  apply();
  if (darkQuery) {
    darkQuery.addEventListener("change", () => {
      if (store.settings.mode === "auto") {
        apply();
        notify();
      }
    });
  }

  window.NetdokuTheme = { settings, value, mountControls, OPTIONS };
})();
