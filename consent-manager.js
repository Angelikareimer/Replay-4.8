/**
 * The Magnetic Femme consent manager
 * Drop-in, dependency-free consent UI for static pages and React/Next sites.
 */
(function (window, document) {
  "use strict";

  var DEFAULTS = {
    cookieName: "tmf_consent",
    cookieDomain: "",
    version: "2026-08-23",
    maxAgeDays: 365,
    privacyUrl: "https://www.themagneticfemme.co/datenschutz",
    imprintUrl: "https://www.themagneticfemme.co/impressum",
    site: window.location.hostname,
    locale: "de",
    reloadOnRevoke: true,
    showSettingsButton: false,
    legacyCookieNames: ["cookieyes-consent", "cookieyesID", "cky-consent", "cky-action"],
    analyticsCookieNames: ["_ga", "_gid", "_gat"],
    marketingCookieNames: ["_fbp", "_fbc", "_gcl_au"],
    services: {
      metaPixelId: "",
      anyTrackUrl: "",
      analyticsScripts: [],
      marketingScripts: []
    }
  };

  var config;
  var currentConsent = null;
  var mounted = false;

  function merge(base, extra) {
    var out = {};
    Object.keys(base || {}).forEach(function (key) {
      if (base[key] && typeof base[key] === "object" && !Array.isArray(base[key])) {
        out[key] = merge(base[key], (extra || {})[key] || {});
      } else {
        out[key] = (extra || {})[key] !== undefined ? extra[key] : base[key];
      }
    });
    Object.keys(extra || {}).forEach(function (key) {
      if (out[key] === undefined) out[key] = extra[key];
    });
    return out;
  }

  function readCookie(name) {
    var prefix = name + "=";
    var part = document.cookie.split("; ").find(function (item) { return item.indexOf(prefix) === 0; });
    if (!part) return null;
    try { return JSON.parse(decodeURIComponent(part.slice(prefix.length))); } catch (_) { return null; }
  }

  function cookieSuffix(maxAge) {
    var value = "; Max-Age=" + maxAge + "; Path=/; SameSite=Lax";
    if (config.cookieDomain) value += "; Domain=" + config.cookieDomain;
    if (window.location.protocol === "https:") value += "; Secure";
    return value;
  }

  function persist(consent) {
    document.cookie = config.cookieName + "=" + encodeURIComponent(JSON.stringify(consent)) +
      cookieSuffix(config.maxAgeDays * 86400);
  }

  function removeCookie(name) {
    var hosts = [""];
    var hostname = window.location.hostname;
    var parts = hostname.split(".");
    if (parts.length > 1) hosts.push("." + parts.slice(-2).join("."));
    if (config.cookieDomain && hosts.indexOf(config.cookieDomain) < 0) hosts.push(config.cookieDomain);
    ["/", window.location.pathname || "/"].forEach(function (path) {
      hosts.forEach(function (domain) {
        document.cookie = name + "=; Max-Age=0; Path=" + path +
          (domain ? "; Domain=" + domain : "") + "; SameSite=Lax";
      });
    });
  }

  function clearCookies(names, pattern) {
    names = names.slice();
    document.cookie.split(";").forEach(function (part) {
      var name = part.split("=")[0].trim();
      if (pattern.test(name)) names.push(name);
    });
    names.filter(function (name, index) { return names.indexOf(name) === index; }).forEach(removeCookie);
  }

  function valid(consent) {
    return !!consent && consent.version === config.version && consent.necessary === true;
  }

  function loadScript(src, id, attributes) {
    if (!src || document.getElementById(id)) return;
    var script = document.createElement("script");
    script.src = src;
    script.id = id;
    script.async = true;
    Object.keys(attributes || {}).forEach(function (key) { script.setAttribute(key, attributes[key]); });
    document.head.appendChild(script);
  }

  function loadList(list, prefix) {
    (list || []).forEach(function (item, index) {
      if (typeof item === "string") loadScript(item, prefix + "-" + index);
      else if (item && item.src) loadScript(item.src, item.id || prefix + "-" + index, item.attributes);
    });
  }

  function enableMetaPixel(id) {
    if (!id || window.__tmfMetaLoaded) return;
    window.__tmfMetaLoaded = true;
    window.fbq = window.fbq || function () { (window.fbq.callMethod ? window.fbq.callMethod : window.fbq.queue.push).apply(window.fbq, arguments); };
    if (!window._fbq) window._fbq = window.fbq;
    window.fbq.push = window.fbq;
    window.fbq.loaded = true;
    window.fbq.version = "2.0";
    window.fbq.queue = window.fbq.queue || [];
    loadScript("https://connect.facebook.net/en_US/fbevents.js", "tmf-meta-pixel");
    window.fbq("consent", "grant");
    window.fbq("init", id);
    window.fbq("track", "PageView");
  }

  function enableAnyTrack(url) {
    if (!url) return;
    window.AnyTrack = window.AnyTrack || function () { (window.AnyTrack.q = window.AnyTrack.q || []).push(arguments); };
    loadScript(url, "tmf-anytrack");
  }

  function apply(consent) {
    currentConsent = consent;
    if (consent.analytics) loadList(config.services.analyticsScripts, "tmf-analytics");
    if (consent.marketing) {
      enableMetaPixel(config.services.metaPixelId);
      enableAnyTrack(config.services.anyTrackUrl);
      loadList(config.services.marketingScripts, "tmf-marketing");
    }
    window.dispatchEvent(new CustomEvent("tmf:consent", { detail: consent }));
  }

  function createConsent(analytics, marketing) {
    return {
      necessary: true,
      analytics: !!analytics,
      marketing: !!marketing,
      version: config.version,
      timestamp: new Date().toISOString(),
      site: config.site
    };
  }

  function save(analytics, marketing) {
    var previous = currentConsent;
    var next = createConsent(analytics, marketing);
    persist(next);
    clearCookies(config.legacyCookieNames, /^(cookieyes|cky-)/i);
    if (!analytics) clearCookies(config.analyticsCookieNames, /^(_ga_|_hj)/i);
    if (!marketing) clearCookies(config.marketingCookieNames, /^(at_|anytrack)/i);
    closeDialog();
    apply(next);
    if (config.reloadOnRevoke && previous &&
        ((previous.marketing && !next.marketing) || (previous.analytics && !next.analytics))) {
      window.location.reload();
    }
  }

  function styles() {
    if (document.getElementById("tmf-consent-styles")) return;
    var style = document.createElement("style");
    style.id = "tmf-consent-styles";
    style.textContent =
      ".tmf-consent{--ink:#2d2522;--cream:#f7f2ec;--wine:#722f37;position:fixed;z-index:2147483647;inset:0;display:grid;place-items:end center;background:rgba(28,20,18,.38);font-family:Arial,sans-serif;padding:18px;box-sizing:border-box}" +
      ".tmf-consent[hidden]{display:none}.tmf-consent__box{width:min(720px,100%);background:var(--cream);color:var(--ink);padding:28px;border-radius:18px;box-shadow:0 18px 60px rgba(0,0,0,.24)}" +
      ".tmf-consent h2{font-family:Georgia,serif;font-size:26px;font-weight:400;margin:0 0 10px}.tmf-consent p{font-size:14px;line-height:1.55;margin:0 0 18px}" +
      ".tmf-consent a{color:inherit;text-underline-offset:3px}.tmf-consent__details{display:grid;gap:10px;margin:18px 0}.tmf-consent__row{display:flex;gap:12px;align-items:flex-start;padding:12px;background:#fff;border-radius:10px}" +
      ".tmf-consent__row input{margin-top:3px;accent-color:var(--wine)}.tmf-consent__row strong{display:block;font-size:14px}.tmf-consent__row span{font-size:12px;color:#655b56}" +
      ".tmf-consent__actions{display:flex;gap:9px;flex-wrap:wrap}.tmf-consent button,.tmf-cookie-settings{border:1px solid var(--wine);border-radius:999px;padding:11px 17px;font:600 13px Arial,sans-serif;cursor:pointer}" +
      ".tmf-consent button{background:transparent;color:var(--wine)}.tmf-consent button[data-primary]{background:var(--wine);color:#fff}.tmf-consent__links{font-size:11px!important;margin:15px 0 0!important}" +
      ".tmf-cookie-settings{position:fixed;z-index:2147483646;left:14px;bottom:14px;background:#f7f2ec;color:#722f37;padding:8px 12px;font-size:11px;box-shadow:0 3px 16px rgba(0,0,0,.12)}" +
      "@media(max-width:560px){.tmf-consent{padding:0;place-items:end}.tmf-consent__box{border-radius:18px 18px 0 0;padding:22px}.tmf-consent__actions button{width:100%}}";
    document.head.appendChild(style);
  }

  function dialogMarkup() {
    return '<div class="tmf-consent__box" role="dialog" aria-modal="true" aria-labelledby="tmf-consent-title">' +
      '<h2 id="tmf-consent-title">Deine Privatsphäre</h2>' +
      '<p>Wir verwenden notwendige Technologien für den Betrieb dieser Seite. Analyse- und Marketing-Dienste laden wir nur mit deiner Einwilligung. Deine Auswahl kannst du jederzeit ändern.</p>' +
      '<div class="tmf-consent__details" data-details hidden>' +
        '<label class="tmf-consent__row"><input type="checkbox" checked disabled><span><strong>Notwendig</strong>Erforderlich für Sicherheit und Grundfunktionen.</span></label>' +
        '<label class="tmf-consent__row"><input id="tmf-analytics" type="checkbox"><span><strong>Analyse</strong>Hilft uns zu verstehen, wie die Website genutzt wird.</span></label>' +
        '<label class="tmf-consent__row"><input id="tmf-marketing" type="checkbox"><span><strong>Marketing</strong>Ermöglicht personalisierte Werbung und Erfolgsmessung.</span></label>' +
      '</div>' +
      '<div class="tmf-consent__actions"><button type="button" data-reject>Nur notwendige</button><button type="button" data-custom>Einstellungen</button><button type="button" data-save hidden>Auswahl speichern</button><button type="button" data-accept data-primary>Alle akzeptieren</button></div>' +
      '<p class="tmf-consent__links"><a href="' + config.privacyUrl + '">Datenschutz</a> · <a href="' + config.imprintUrl + '">Impressum</a></p>' +
    '</div>';
  }

  function openDialog() {
    var root = document.getElementById("tmf-consent");
    if (!root) return;
    var consent = valid(currentConsent) ? currentConsent : createConsent(false, false);
    root.querySelector("#tmf-analytics").checked = consent.analytics;
    root.querySelector("#tmf-marketing").checked = consent.marketing;
    root.hidden = false;
    root.querySelector("button").focus();
  }

  function closeDialog() {
    var root = document.getElementById("tmf-consent");
    if (root) root.hidden = true;
  }

  function mount() {
    if (mounted) return;
    mounted = true;
    styles();
    var root = document.createElement("div");
    root.id = "tmf-consent";
    root.className = "tmf-consent";
    root.hidden = true;
    root.innerHTML = dialogMarkup();
    document.body.appendChild(root);

    if (config.showSettingsButton) {
      var settings = document.createElement("button");
      settings.type = "button";
      settings.className = "tmf-cookie-settings";
      settings.textContent = "Cookie-Einstellungen";
      settings.addEventListener("click", openDialog);
      document.body.appendChild(settings);
    }

    document.querySelectorAll("[data-tmf-consent-settings]").forEach(function (trigger) {
      trigger.addEventListener("click", openDialog);
    });

    root.querySelector("[data-reject]").addEventListener("click", function () { save(false, false); });
    root.querySelector("[data-accept]").addEventListener("click", function () { save(true, true); });
    root.querySelector("[data-custom]").addEventListener("click", function () {
      root.querySelector("[data-details]").hidden = false;
      root.querySelector("[data-save]").hidden = false;
      this.hidden = true;
    });
    root.querySelector("[data-save]").addEventListener("click", function () {
      save(root.querySelector("#tmf-analytics").checked, root.querySelector("#tmf-marketing").checked);
    });

    currentConsent = readCookie(config.cookieName);
    clearCookies(config.legacyCookieNames, /^(cookieyes|cky-)/i);
    if (!valid(currentConsent) || !currentConsent.analytics) clearCookies(config.analyticsCookieNames, /^(_ga_|_hj)/i);
    if (!valid(currentConsent) || !currentConsent.marketing) clearCookies(config.marketingCookieNames, /^(at_|anytrack)/i);
    if (valid(currentConsent)) apply(currentConsent); else openDialog();
  }

  function init(options) {
    config = merge(DEFAULTS, options || {});
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
    else mount();
    return api;
  }

  var api = {
    init: init,
    open: openDialog,
    getConsent: function () { return currentConsent; },
    hasConsent: function (category) { return !!(currentConsent && currentConsent[category]); },
    onChange: function (callback) { window.addEventListener("tmf:consent", function (event) { callback(event.detail); }); }
  };

  window.TMFConsent = api;
})(window, document);
