(function (window, document) {
  "use strict";

  var defaults = {
    siteId: window.location.hostname,
    enabled: true,
    position: "bottom-right",
    delayMs: 8000,
    displayDurationMs: 6500,
    intervalMs: 18000,
    maxPerSession: 1,
    theme: "brand",
    showCloseButton: true,
    messages: []
  };

  function merge(options) {
    var result = {};
    Object.keys(defaults).forEach(function (key) {
      result[key] = options && options[key] !== undefined ? options[key] : defaults[key];
    });
    return result;
  }

  function activeMessages(messages) {
    var now = Date.now();
    return (messages || []).filter(function (message) {
      return message && message.enabled !== false &&
        (!message.expiresAt || new Date(message.expiresAt).getTime() > now);
    }).sort(function (a, b) { return (b.priority || 0) - (a.priority || 0); });
  }

  function readSession(key) {
    try { return Number(window.sessionStorage.getItem(key) || 0); } catch (_) { return 0; }
  }

  function writeSession(key, value) {
    try { window.sessionStorage.setItem(key, String(value)); } catch (_) {}
  }

  function addStyles() {
    if (document.getElementById("tmf-social-proof-styles")) return;
    var style = document.createElement("style");
    style.id = "tmf-social-proof-styles";
    style.textContent =
      ".tmf-proof{position:fixed;z-index:2147483000;width:min(370px,calc(100vw - 32px));display:flex;align-items:flex-start;gap:14px;padding:17px 46px 17px 19px;border:1px solid rgba(114,47,55,.22);border-radius:14px;background:rgba(248,244,239,.97);color:#2d2522;box-shadow:0 16px 42px rgba(49,34,31,.16);font-family:Mulish,Arial,sans-serif;opacity:0;transform:translateY(14px);transition:opacity .36s ease,transform .36s ease;box-sizing:border-box}" +
      ".tmf-proof[data-visible=true]{opacity:1;transform:translateY(0)}.tmf-proof[data-position=bottom-left]{left:16px;bottom:16px}.tmf-proof[data-position=bottom-right]{right:16px;bottom:16px}" +
      ".tmf-proof[data-position=top]{top:16px;left:50%;transform:translate(-50%,-14px)}.tmf-proof[data-position=top][data-visible=true]{transform:translate(-50%,0)}.tmf-proof[data-position=bottom]{bottom:16px;left:50%;transform:translate(-50%,14px)}.tmf-proof[data-position=bottom][data-visible=true]{transform:translate(-50%,0)}" +
      ".tmf-proof__mark{flex:0 0 auto;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:#722f37;color:#f8f4ef;font:600 17px Georgia,serif}" +
      ".tmf-proof__content{min-width:0}.tmf-proof__title{display:block;margin:0 0 3px;font:600 13px/1.3 Mulish,Arial,sans-serif;letter-spacing:.02em}.tmf-proof__text{margin:0;font:400 13px/1.45 Mulish,Arial,sans-serif;color:#625751}" +
      ".tmf-proof__close{position:absolute;right:10px;top:9px;width:30px;height:30px;border:0;background:transparent;color:#6c605a;font:400 21px/1 Arial,sans-serif;cursor:pointer;border-radius:50%}.tmf-proof__close:hover,.tmf-proof__close:focus-visible{background:rgba(114,47,55,.08);outline:2px solid transparent}" +
      "@media(max-width:560px){.tmf-proof{left:12px!important;right:12px!important;bottom:12px!important;top:auto!important;width:auto;transform:translateY(14px)!important}.tmf-proof[data-visible=true]{transform:translateY(0)!important}}" +
      "@media(prefers-reduced-motion:reduce){.tmf-proof{transition:none}}";
    document.head.appendChild(style);
  }

  function init(options) {
    var config = merge(options);
    var messages = activeMessages(config.messages);
    if (!config.enabled || !messages.length) return;
    var storageKey = "tmf_proof_" + config.siteId;
    var shown = readSession(storageKey);
    if (shown >= config.maxPerSession) return;
    addStyles();

    var index = 0;
    var root = document.createElement("aside");
    root.className = "tmf-proof";
    root.dataset.position = config.position;
    root.dataset.visible = "false";
    root.setAttribute("role", "status");
    root.setAttribute("aria-live", "polite");
    root.setAttribute("aria-atomic", "true");
    document.body.appendChild(root);

    function hide() {
      root.dataset.visible = "false";
      window.setTimeout(function () { if (root.parentNode) root.parentNode.removeChild(root); }, 400);
    }

    function show() {
      var message = messages[index % messages.length];
      root.innerHTML = '<span class="tmf-proof__mark" aria-hidden="true">M</span><div class="tmf-proof__content">' +
        (message.title ? '<strong class="tmf-proof__title"></strong>' : '') +
        '<p class="tmf-proof__text"></p></div>' +
        (config.showCloseButton ? '<button type="button" class="tmf-proof__close" aria-label="Hinweis schließen">×</button>' : '');
      if (message.title) root.querySelector(".tmf-proof__title").textContent = message.title;
      root.querySelector(".tmf-proof__text").textContent = message.text;
      var close = root.querySelector(".tmf-proof__close");
      if (close) close.addEventListener("click", hide);
      root.dataset.visible = "true";
      shown += 1;
      writeSession(storageKey, shown);
      window.setTimeout(hide, config.displayDurationMs);
    }

    window.setTimeout(show, config.delayMs);
    return { close: hide };
  }

  window.TMFSocialProof = { init: init };
})(window, document);
