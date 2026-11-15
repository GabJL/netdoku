// Idiomas de Netdoku. Cada idioma es un fichero lang/<código>.js que llama a
// NetdokuI18n.register(código, diccionario). Los textos se piden con
// t("ruta.de.la.clave", { variables }); una entrada puede ser una cadena con
// {variables} o una función que recibe las variables. Si falta una clave en un
// idioma se usa la del español.
//
// Al cambiar de idioma se emite el evento "netdoku-lang" y las páginas se redibujan.
(function () {
  "use strict";

  const KEY = "netdoku:lang";
  const FALLBACK = "es";
  const dicts = {};
  let lang = null;

  function register(code, dict) {
    dicts[code] = dict;
  }

  function available() {
    return Object.keys(dicts);
  }

  function detect() {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved && dicts[saved]) return saved;
    } catch (err) {
      // Sin almacenamiento: se usa el idioma del navegador.
    }
    for (const wanted of navigator.languages || [navigator.language || ""]) {
      const code = String(wanted).slice(0, 2).toLowerCase();
      if (dicts[code]) return code;
    }
    return FALLBACK;
  }

  function current() {
    if (!lang || !dicts[lang]) lang = detect();
    return lang;
  }

  function setLang(code) {
    if (!dicts[code] || code === lang) return;
    lang = code;
    try {
      localStorage.setItem(KEY, code);
    } catch (err) {
      // El idioma dura hasta recargar.
    }
    document.documentElement.lang = code;
    window.dispatchEvent(new Event("netdoku-lang"));
  }

  function lookup(dict, path) {
    let v = dict;
    for (const part of path.split(".")) {
      if (v == null) return undefined;
      v = v[part];
    }
    return v;
  }

  // Nombre de un idioma en ese mismo idioma (para el selector).
  function name(code) {
    return (dicts[code] && dicts[code].langName) || code;
  }

  // Valor sin procesar (cadena, lista, objeto o función).
  function get(path) {
    const v = lookup(dicts[current()] || {}, path);
    return v !== undefined ? v : lookup(dicts[FALLBACK] || {}, path);
  }

  function t(path, vars) {
    const v = get(path);
    if (typeof v === "function") return v(vars || {});
    if (typeof v === "string") {
      return v.replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] !== undefined ? vars[k] : m));
    }
    return v === undefined ? path : v;
  }

  // Textos fijos del HTML: data-i18n (contenido), data-i18n-title y data-i18n-aria.
  function applyStatic(root) {
    for (const el of (root || document).querySelectorAll("[data-i18n]")) el.textContent = t(el.dataset.i18n);
    for (const el of (root || document).querySelectorAll("[data-i18n-title]")) el.title = t(el.dataset.i18nTitle);
    for (const el of (root || document).querySelectorAll("[data-i18n-aria]")) el.setAttribute("aria-label", t(el.dataset.i18nAria));
  }

  window.NetdokuI18n = { register, available, current, name, setLang, get, t, applyStatic };
})();
