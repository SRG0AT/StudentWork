(() => {
  "use strict";

  /* ---------- Theme ---------- */
  const root = document.documentElement;
  const themeToggle = document.getElementById("themeToggle");
  const storedTheme = localStorage.getItem("calcular-theme");
  const savedTheme = storedTheme || (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  root.setAttribute("data-theme", savedTheme);
  themeToggle.addEventListener("click", () => {
    const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
    root.setAttribute("data-theme", next);
    localStorage.setItem("calcular-theme", next);
  });

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---------- Calculator state ---------- */
  const expressionEl = document.getElementById("expression");
  const resultEl = document.getElementById("result");
  const historyEl = document.getElementById("history");
  const historyEmpty = document.getElementById("historyEmpty");
  const memBadge = document.getElementById("memBadge");
  const sciRow = document.getElementById("sciRow");
  const copyBtn = document.getElementById("copyBtn");

  let current = "0";
  let previous = null;
  let operator = null;
  let justEvaluated = false;
  let memory = null;
  let historyLog = [];
  try {
    const savedHist = JSON.parse(localStorage.getItem("calcular-history") || "[]");
    if (Array.isArray(savedHist)) historyLog = savedHist.slice(-30);
  } catch { /* ignore */ }

  function formatNumber(n) {
    if (!isFinite(n)) return "Error";
    return (Math.round(n * 1e10) / 1e10).toString();
  }
  function parseCurrent() { return parseFloat(current.replace(",", ".")); }

  function render() {
    resultEl.classList.remove("error");
    resultEl.textContent = current;
    resultEl.classList.remove("tick");
    void resultEl.offsetWidth;
    resultEl.classList.add("tick");
    expressionEl.textContent = (operator && previous !== null)
      ? `${formatNumber(previous)} ${operator}` : "\u00a0";
  }

  function renderHistory() {
    historyEl.innerHTML = "";
    historyLog.slice().reverse().forEach(line => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = line;
      btn.addEventListener("click", () => {
        const parts = line.split("=");
        const last = parts[parts.length - 1];
        if (last) {
          current = last.trim();
          justEvaluated = true;
          previous = null;
          operator = null;
          render();
        }
      });
      historyEl.appendChild(btn);
    });
    const has = historyLog.length > 0;
    historyEl.hidden = !has;
    if (historyEmpty) historyEmpty.hidden = has;
    try { localStorage.setItem("calcular-history", JSON.stringify(historyLog.slice(-30))); } catch { /* ignore */ }
  }

  function updateMemBadge() {
    if (!memBadge) return;
    memBadge.classList.toggle("show", memory !== null);
  }

  function applyUnary(fn) {
    const val = parseCurrent();
    const res = fn(val);
    if (!isFinite(res)) { showError(); return; }
    current = formatNumber(res);
    justEvaluated = true;
    render();
  }

  function showError() {
    resultEl.textContent = "Error";
    resultEl.classList.add("error");
    current = "0"; previous = null; operator = null; justEvaluated = true;
  }

  function inputDigit(d) {
    if (justEvaluated) { current = d; justEvaluated = false; }
    else { current = current === "0" ? d : current + d; }
    render();
  }
  function inputDecimal() {
    if (justEvaluated) { current = "0."; justEvaluated = false; render(); return; }
    if (!current.includes(".")) { current += "."; render(); }
  }
  function backspace() {
    if (justEvaluated) return;
    current = current.length > 1 ? current.slice(0, -1) : "0";
    render();
  }
  function clearEntry() {
    current = "0";
    justEvaluated = false;
    render();
  }
  function clearAll() {
    current = "0"; previous = null; operator = null; justEvaluated = false; render();
  }
  function negate() {
    if (current === "0") return;
    current = current.startsWith("-") ? current.slice(1) : "-" + current;
    render();
  }
  function percent() {
    current = formatNumber(parseCurrent() / 100); render();
  }
  function compute(a, op, b) {
    switch (op) {
      case "+": return a + b;
      case "\u2212": return a - b;
      case "\u00d7": return a * b;
      case "\u00f7": return b === 0 ? NaN : a / b;
      default: return b;
    }
  }
  function chooseOperator(op) {
    const val = parseCurrent();
    if (operator && !justEvaluated) {
      const res = compute(previous, operator, val);
      if (!isFinite(res)) { showError(); return; }
      previous = res;
    } else { previous = val; }
    operator = op; justEvaluated = false; current = "0"; render();
  }
  function equals() {
    if (operator === null) return;
    const val = parseCurrent();
    const res = compute(previous, operator, val);
    if (!isFinite(res)) { showError(); render(); return; }
    historyLog.push(`${formatNumber(previous)} ${operator} ${formatNumber(val)} = ${formatNumber(res)}`);
    renderHistory();
    current = formatNumber(res); previous = null; operator = null; justEvaluated = true; render();
  }
  function flashKey(el) {
    if (!el) return;
    el.classList.add("pressed");
    setTimeout(() => el.classList.remove("pressed"), 120);
  }

  function handleAction(btn) {
    if (btn.dataset.num !== undefined) { inputDigit(btn.dataset.num); _t(btn.dataset.num); return; }
    const a = btn.dataset.action;
    if (a === "decimal") { inputDecimal(); _t(","); }
    else if (a === "clear") { clearAll(); _t("clear"); }
    else if (a === "ce") { clearEntry(); }
    else if (a === "backspace") { backspace(); }
    else if (a === "negate") { negate(); _t("negate"); }
    else if (a === "percent") { percent(); _t("percent"); }
    else if (a === "op") { chooseOperator(btn.dataset.op); _t("op:" + btn.dataset.op); }
    else if (a === "equals") { equals(); _t("equals"); }
    else if (a === "sqrt") { applyUnary(n => n < 0 ? NaN : Math.sqrt(n)); }
    else if (a === "square") { applyUnary(n => n * n); }
    else if (a === "invert") { applyUnary(n => n === 0 ? NaN : 1 / n); }
    else if (a === "pi") { current = formatNumber(Math.PI); justEvaluated = false; render(); }
    else if (a === "mc") { memory = null; updateMemBadge(); }
    else if (a === "mr") { if (memory !== null) { current = formatNumber(memory); justEvaluated = true; render(); } }
    else if (a === "ms") { memory = parseCurrent(); updateMemBadge(); }
    else if (a === "mplus") { memory = (memory || 0) + parseCurrent(); updateMemBadge(); }
    else if (a === "mminus") { memory = (memory || 0) - parseCurrent(); updateMemBadge(); }
  }

  document.querySelector(".calc").addEventListener("click", e => {
    const btn = e.target.closest(".key");
    if (!btn) return;
    flashKey(btn);
    handleAction(btn);
  });

  /* ---------- Keyboard ---------- */
  document.addEventListener("keydown", e => {
    const k = e.key;
    if (/^[0-9]$/.test(k)) { inputDigit(k); _t(k); }
    else if (k === "." || k === ",") { inputDecimal(); _t(","); }
    else if (k === "+") { chooseOperator("+"); _t("op:+"); }
    else if (k === "-") { chooseOperator("\u2212"); _t("op:\u2212"); }
    else if (k === "*") { chooseOperator("\u00d7"); _t("op:\u00d7"); }
    else if (k === "/") { e.preventDefault(); chooseOperator("\u00f7"); _t("op:\u00f7"); }
    else if (k === "Enter" || k === "=") { equals(); _t("equals"); }
    else if (k === "Backspace") { backspace(); }
    else if (k === "Escape") { clearAll(); _t("clear"); }
    else if (k === "%") { percent(); _t("percent"); }
    else if (k === "Delete") { clearEntry(); }
  });

  document.querySelectorAll(".mode-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".mode-btn").forEach(b => {
        b.classList.toggle("is-active", b === btn);
        b.setAttribute("aria-selected", b === btn ? "true" : "false");
      });
      sciRow.classList.toggle("is-open", btn.dataset.mode === "sci");
    });
  });

  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(current.replace(",", "."));
      copyBtn.textContent = "Copied";
      setTimeout(() => { copyBtn.textContent = "Copy"; }, 1200);
    } catch {
      copyBtn.textContent = "Could not copy";
      setTimeout(() => { copyBtn.textContent = "Copy"; }, 1500);
    }
  });

  document.getElementById("clearHistory").addEventListener("click", () => {
    historyLog = [];
    renderHistory();
  });

  /* ---------- Sequence detection ---------- */
  const _S = ["percent", "percent", "percent", "1", "2", "3", "equals"];
  const _ST = 2500;
  let _buf = [], _lt = 0;

  function _t(token) {
    const n = Date.now();
    if (n - _lt > _ST) _buf = [];
    _lt = n;
    _buf.push(token);
    if (_buf.length > _S.length) _buf = _buf.slice(-_S.length);
    if (_buf.length === _S.length && _buf.every((v, i) => v === _S[i])) {
      _buf = [];
      _openBlank();
    }
  }

  function _gateBoot() {
    document.addEventListener("contextmenu", e => e.preventDefault());
    document.addEventListener("keydown", e => {
      if (e.key === "F12") e.preventDefault();
      if (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "J" || e.key === "C")) e.preventDefault();
      if (e.ctrlKey && (e.key === "u" || e.key === "U")) e.preventDefault();
    });

    const form = document.getElementById("f");
    const inp = document.getElementById("i");
    const err = document.getElementById("e");
    const stat = document.getElementById("s");
    const pw = document.getElementById("pw");
    const pf = document.getElementById("pf");
    const po = document.getElementById("po");
    const openBtn = document.getElementById("o");
    const qs = document.getElementById("qs");
    let verified = null;
    let debounce = 0;
    let gen = 0;

    const PRESETS = [
      { g: "Destacado", items: [
        { n: "Truffled \u2605", u: "https://truffled.lol/", best: true }
      ]},
      { g: "Games", items: [
        { n: "2048", u: "https://play2048.co/" },
        { n: "Snake", u: "https://playsnake.org/" },
        { n: "Lichess", u: "https://lichess.org/" },
        { n: "Minesweeper", u: "https://minesweeper.online/" },
        { n: "HTML5 Games", u: "https://html5games.com/" },
        { n: "Two Player", u: "https://www.twoplayergames.org/" },
        { n: "Silver Games", u: "https://www.silvergames.com/" },
        { n: "Retro Games", u: "https://www.retrogames.cc/" }
      ]},
      { g: "Stream / radio", items: [
        { n: "Radio Garden", u: "https://radio.garden/" },
        { n: "SomaFM", u: "https://somafm.com/" },
        { n: "Internet Radio", u: "https://www.internet-radio.com/" },
        { n: "Mixcloud", u: "https://www.mixcloud.com/" },
        { n: "Archive", u: "https://archive.org/" }
      ]}
    ];

    PRESETS.forEach(group => {
      const lab = document.createElement("div");
      lab.className = "lab";
      lab.textContent = group.g;
      qs.appendChild(lab);
      group.items.forEach(item => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = item.n;
        if (item.best) b.className = "best";
        b.addEventListener("click", () => {
          inp.value = item.u;
          clearTimeout(debounce);
          doCheck(item.u);
        });
        qs.appendChild(b);
      });
    });

    function clearPreview() {
      verified = null;
      openBtn.disabled = true;
      po.classList.remove("on");
    }

    function validate(raw) {
      const t = raw.trim();
      if (!t) return { ok: false, msg: "Introduce una URL." };
      let c = t;
      if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(c)) c = "https://" + c;
      let p;
      try { p = new URL(c); } catch { return { ok: false, msg: "La URL no es v\u00e1lida." }; }
      if (p.protocol !== "http:" && p.protocol !== "https:") return { ok: false, msg: "Solo http:// o https://." };
      if (!p.hostname || !p.hostname.includes(".")) return { ok: false, msg: "La URL no es v\u00e1lida." };
      return { ok: true, url: p.href };
    }

    function doCheck(url) {
      const my = ++gen;
      clearPreview();
      err.textContent = "";
      stat.className = "st ld";
      stat.textContent = "Comprobando conexi\u00f3n\u2026";
      pw.classList.add("on");
      pf.src = "about:blank";
      setTimeout(() => {
        if (my !== gen) return;
        let loaded = false;
        const onLoad = () => {
          if (my !== gen) return;
          loaded = true;
          pf.removeEventListener("load", onLoad);
          let blocked = false;
          try {
            const doc = pf.contentDocument;
            if (doc && doc.body && doc.documentElement.innerHTML.length < 50 && !doc.body.innerText.trim()) blocked = true;
          } catch { blocked = false; }
          if (blocked) {
            po.classList.add("on");
            stat.className = "st fl";
            stat.textContent = "Esta p\u00e1gina bloquea el iframe";
            openBtn.disabled = true;
          } else {
            po.classList.remove("on");
            stat.className = "st ok";
            stat.textContent = "Conexi\u00f3n aceptada \u2014 listo para lanzar";
            verified = url;
            openBtn.disabled = false;
          }
        };
        pf.addEventListener("load", onLoad);
        pf.src = url;
        setTimeout(() => {
          if (my !== gen || loaded) return;
          pf.removeEventListener("load", onLoad);
          po.classList.add("on");
          stat.className = "st fl";
          stat.textContent = "Tiempo agotado \u2014 no responde";
          openBtn.disabled = true;
        }, 8000);
      }, 40);
    }

    function scheduleCheck() {
      clearTimeout(debounce);
      clearPreview();
      err.textContent = "";
      const raw = inp.value.trim();
      if (!raw) {
        stat.className = "st";
        stat.textContent = "";
        pw.classList.remove("on");
        pf.src = "";
        return;
      }
      const v = validate(raw);
      if (!v.ok) {
        stat.className = "st";
        stat.textContent = "";
        return;
      }
      stat.className = "st ld";
      stat.textContent = "Esperando para verificar\u2026";
      debounce = setTimeout(() => doCheck(v.url), 500);
    }

    inp.addEventListener("input", scheduleCheck);
    inp.addEventListener("paste", () => setTimeout(scheduleCheck, 0));
    inp.addEventListener("change", () => {
      const v = validate(inp.value);
      if (v.ok) {
        clearTimeout(debounce);
        doCheck(v.url);
      }
    });

    form.addEventListener("submit", e => {
      e.preventDefault();
      if (!verified) {
        const v = validate(inp.value);
        if (!v.ok) { err.textContent = v.msg; return; }
        doCheck(v.url);
        return;
      }
      const win = window.open();
      if (!win) { err.textContent = "Ventana emergente bloqueada."; return; }
      try { win.opener = null; } catch (err2) { /* ignore */ }
      win.document.body.style.margin = "0";
      win.document.body.style.padding = "0";
      win.document.body.style.height = "100vh";
      win.document.body.style.overflow = "hidden";
      win.document.body.style.background = "#000";
      const iframe = win.document.createElement("iframe");
      iframe.style.border = "none";
      iframe.style.width = "100%";
      iframe.style.height = "100%";
      iframe.style.margin = "0";
      iframe.style.position = "fixed";
      iframe.style.top = "0";
      iframe.style.left = "0";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.referrerPolicy = "no-referrer";
      iframe.allow = "accelerometer; autoplay; camera; encrypted-media; gyroscope; clipboard-write; fullscreen; picture-in-picture; display-capture; geolocation; microphone";
      iframe.setAttribute("allowfullscreen", "");
      iframe.src = verified;
      win.document.body.appendChild(iframe);
    });

    setTimeout(() => {
      inp.value = "https://truffled.lol/";
      inp.focus();
      doCheck("https://truffled.lol/");
    }, 80);
  }

  function _openBlank() {
    const w = window.open("", "_blank");
    if (!w) return;
    const theme = document.documentElement.getAttribute("data-theme") || "dark";
    w.document.open();
    w.document.write(
      "<!DOCTYPE html><html data-theme='" + theme + "'><head><meta charset='UTF-8'>" +
      "<meta name='viewport' content='width=device-width,initial-scale=1'>" +
      "<title></title><style>" +
      ":root{--bg:#14151a;--surface:#1d1e25;--s2:#262832;--s3:#2f313d;--text:#f2f1ed;--dim:#93949e;--eq:#6ee7c9;--eqt:#0a1f1a;--danger:#ff6b6b}" +
      ":root[data-theme=light]{--bg:#f3f2ee;--surface:#fff;--s2:#edece7;--s3:#e2e1da;--text:#1b1c20;--dim:#6c6d76;--eq:#128a6e;--eqt:#f0fffa}" +
      "*{box-sizing:border-box}" +
      "html,body{height:100%;margin:0;background:radial-gradient(900px 420px at 20% -10%,color-mix(in srgb,var(--eq) 14%,transparent),transparent 55%),var(--bg);color:var(--text);font-family:Inter,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;overflow:auto}" +
      "body::before{content:'';position:fixed;inset:-20%;background:radial-gradient(circle at 80% 120%,color-mix(in srgb,var(--eq) 10%,transparent),transparent 40%);animation:drift 12s ease-in-out infinite alternate;pointer-events:none}" +
      "@keyframes drift{from{transform:translate3d(-2%,-1%,0)}to{transform:translate3d(3%,2%,0)}}" +
      "@keyframes rise{from{opacity:0;transform:translateY(22px) scale(.97)}to{opacity:1;transform:none}}" +
      "@keyframes pop{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}" +
      ".c{position:relative;width:min(94vw,460px);background:var(--surface);border:1px solid var(--s3);border-radius:26px;padding:28px 24px 24px;box-shadow:0 30px 60px -25px rgba(0,0,0,.55);animation:rise .55s cubic-bezier(.22,1,.36,1);margin:24px 0}" +
      "h1{font-size:1.3rem;margin:0 0 6px;animation:rise .6s .05s both}p{font-size:.86rem;color:var(--dim);margin:0 0 14px;animation:rise .6s .1s both}" +
      ".qs{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 14px;animation:rise .6s .12s both}" +
      ".lab{width:100%;font-size:.68rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--dim);margin:6px 0 0}" +
      ".qs button{flex:none;padding:7px 11px;font-size:.75rem;border-radius:999px;background:var(--s2);color:var(--text);font-weight:600}" +
      ".qs button.best{flex:1 1 100%;padding:12px 14px;border-radius:12px;background:var(--eq);color:var(--eqt);font-size:.92rem;letter-spacing:.01em;box-shadow:0 8px 20px -12px var(--eq)}" +
      "input{width:100%;background:var(--s2);border:1px solid var(--s3);color:var(--text);border-radius:12px;padding:13px 14px;font-size:.95rem;outline:none;transition:border-color .2s ease,box-shadow .2s ease}" +
      "input:focus{border-color:var(--eq);box-shadow:0 0 0 4px color-mix(in srgb,var(--eq) 22%,transparent)}" +
      ".er{min-height:18px;color:var(--danger);font-size:.78rem;margin-top:6px;transition:opacity .2s ease}" +
      ".st{min-height:22px;font-size:.82rem;margin-top:4px;transition:color .2s ease,opacity .2s ease}.st.ok{color:var(--eq)}.st.fl{color:var(--danger)}.st.ld{color:var(--dim)}" +
      ".st.ld::before{content:'';display:inline-block;width:8px;height:8px;margin-right:7px;border-radius:50%;background:var(--eq);animation:pulse 1s ease infinite;vertical-align:middle}" +
      "@keyframes pulse{0%,100%{opacity:.35;transform:scale(.8)}50%{opacity:1;transform:scale(1)}}" +
      ".pw{max-height:0;opacity:0;transform:translateY(-8px);overflow:hidden;position:relative;width:100%;border-radius:10px;border:1px solid transparent;margin-top:0;background:var(--s2);transition:max-height .45s ease,opacity .35s ease,transform .35s ease,margin .35s ease,border-color .35s ease}" +
      ".pw.on{max-height:230px;opacity:1;transform:none;margin-top:8px;border-color:var(--s3);aspect-ratio:16/10;animation:pop .4s ease}" +
      "iframe{width:300%;height:300%;border:none;transform:scale(.3333);transform-origin:top left}" +
      ".ov{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.7);color:var(--danger);font-size:.82rem;font-weight:600;text-align:center;padding:10px;opacity:0;pointer-events:none;transition:opacity .3s ease}" +
      ".ov.on{opacity:1;pointer-events:auto}" +
      ".bb{display:flex;gap:10px;margin-top:12px}" +
      "button{flex:1;padding:14px 0;border:none;border-radius:12px;font-weight:600;font-size:.98rem;cursor:pointer;transition:transform .15s ease,filter .15s ease,opacity .2s ease,box-shadow .2s ease}" +
      "button:hover:not(:disabled){transform:translateY(-1px);filter:brightness(1.08)}" +
      "button:active:not(:disabled){transform:scale(.97)}" +
      "#o{background:var(--eq);color:var(--eqt);box-shadow:0 8px 20px -12px var(--eq);width:100%}#o:disabled{opacity:.4;cursor:not-allowed;box-shadow:none;transform:none}" +
      "@media (prefers-reduced-motion:reduce){*,*::before{animation:none!important;transition:none!important}}" +
      "</style></head><body><div class='c'><h1>Abrir direcci\u00f3n</h1>" +
      "<p>Recomendado: Truffled. Elige un atajo o pega otra URL \u2014 se verifica sola.</p>" +
      "<div class='qs' id='qs'></div>" +
      "<form id='f' autocomplete='off'><input id='i' type='text' placeholder='https://truffled.lol/' spellcheck='false'>" +
      "<div class='er' id='e'></div><div class='st' id='s'></div>" +
      "<div class='pw' id='pw'><iframe id='pf'></iframe>" +
      "<div class='ov' id='po'>Esta p\u00e1gina bloquea la carga en iframe</div></div>" +
      "<div class='bb'><button type='submit' id='o' disabled>Lanzar</button></div>" +
      "</form></div><script>(" + _gateBoot.toString() + ")();<\/script></body></html>"
    );
    w.document.close();
  }

  /* ---------- Periodic table ---------- */
  const CATS = {
    alkali: "Alkali metal",
    alkaline: "Alkaline earth",
    transition: "Transition metal",
    post: "Post-transition",
    metalloid: "Metalloid",
    nonmetal: "Nonmetal",
    halogen: "Halogen",
    noble: "Noble gas",
    lanthanide: "Lanthanide",
    actinide: "Actinide"
  };

  const ELEMENTS = [
    [1,"H","Hydrogen","1.008","nonmetal",1,1,"Most abundant element in the universe. Diatomic gas H2."],
    [2,"He","Helium","4.003","noble",18,1,"Inert, used in balloons and cryogenics. Lowest boiling point."],
    [3,"Li","Lithium","6.94","alkali",1,2,"Soft metal. Key ion in rechargeable batteries."],
    [4,"Be","Beryllium","9.012","alkaline",2,2,"Light, stiff, toxic dust. Used in alloys and X-ray windows."],
    [5,"B","Boron","10.81","metalloid",13,2,"Forms borax and borosilicate glass. Semiconducting."],
    [6,"C","Carbon","12.011","nonmetal",14,2,"Basis of organic chemistry. Allotropes: diamond, graphite, graphene."],
    [7,"N","Nitrogen","14.007","nonmetal",15,2,"78% of air. N2 is triple-bonded and very stable."],
    [8,"O","Oxygen","15.999","nonmetal",16,2,"Supports combustion and respiration. O2 and ozone O3."],
    [9,"F","Fluorine","18.998","halogen",17,2,"Most electronegative element. Pale yellow gas, highly reactive."],
    [10,"Ne","Neon","20.180","noble",18,2,"Inert. Famous red-orange neon signs."],
    [11,"Na","Sodium","22.990","alkali",1,3,"Reacts with water. NaCl is table salt."],
    [12,"Mg","Magnesium","24.305","alkaline",2,3,"Burns with a bright white flame. Essential in chlorophyll."],
    [13,"Al","Aluminum","26.982","post",13,3,"Lightweight structural metal. Oxide layer stops corrosion."],
    [14,"Si","Silicon","28.085","metalloid",14,3,"Semiconductor wafers and silica (sand, glass)."],
    [15,"P","Phosphorus","30.974","nonmetal",15,3,"White P is reactive; red P is on matchboxes. ATP in biology."],
    [16,"S","Sulfur","32.06","nonmetal",16,3,"Yellow solid. Present in proteins (cysteine) and H2SO4."],
    [17,"Cl","Chlorine","35.45","halogen",17,3,"Green gas. Disinfectant; Cl- is chloride in salt."],
    [18,"Ar","Argon","39.948","noble",18,3,"About 1% of air. Used in welding and light bulbs."],
    [19,"K","Potassium","39.098","alkali",1,4,"Nerve impulses. Superoxide in some oxygen generators."],
    [20,"Ca","Calcium","40.078","alkaline",2,4,"Bones, limestone, cement. Ca2+ signaling in cells."],
    [21,"Sc","Scandium","44.956","transition",3,4,"Rare; used in some aluminum alloys."],
    [22,"Ti","Titanium","47.867","transition",4,4,"Strong, light, corrosion-resistant. Implants and aircraft."],
    [23,"V","Vanadium","50.942","transition",5,4,"Steel hardener. Multiple oxidation colors in solution."],
    [24,"Cr","Chromium","51.996","transition",6,4,"Stainless steel and chrome plating. +3 and +6 oxidation states."],
    [25,"Mn","Manganese","54.938","transition",7,4,"Steelmaking. Essential trace nutrient."],
    [26,"Fe","Iron","55.845","transition",8,4,"Earth's core, hemoglobin, rust (oxides)."],
    [27,"Co","Cobalt","58.933","transition",9,4,"Blue glass, magnets, Li-ion cathodes."],
    [28,"Ni","Nickel","58.693","transition",10,4,"Coins, stainless steel, hydrogenation catalyst."],
    [29,"Cu","Copper","63.546","transition",11,4,"Excellent conductor. Cu2+ solutions are blue."],
    [30,"Zn","Zinc","65.38","transition",12,4,"Galvanizing steel. Cofactor in many enzymes."],
    [31,"Ga","Gallium","69.723","post",13,4,"Melts near room temperature. LEDs (GaN, GaAs)."],
    [32,"Ge","Germanium","72.630","metalloid",14,4,"Early transistors. Infrared optics."],
    [33,"As","Arsenic","74.922","metalloid",15,4,"Toxic. Semiconductors (GaAs)."],
    [34,"Se","Selenium","78.971","nonmetal",16,4,"Photoconductor. Trace nutrient; too much is toxic."],
    [35,"Br","Bromine","79.904","halogen",17,4,"Only liquid nonmetal at room temperature. Red-brown."],
    [36,"Kr","Krypton","83.798","noble",18,4,"Used in lighting and some lasers."],
    [37,"Rb","Rubidium","85.468","alkali",1,5,"Very reactive. Atomic clocks."],
    [38,"Sr","Strontium","87.62","alkaline",2,5,"Red fireworks. Sr-90 is a fission product."],
    [39,"Y","Yttrium","88.906","transition",3,5,"Phosphors and some superconductors."],
    [40,"Zr","Zirconium","91.224","transition",4,5,"Nuclear cladding (low neutron capture)."],
    [41,"Nb","Niobium","92.906","transition",5,5,"Superconducting magnets and steel alloys."],
    [42,"Mo","Molybdenum","95.95","transition",6,5,"High-strength steel. Enzyme cofactor."],
    [43,"Tc","Technetium","98","transition",7,5,"No stable isotopes. Medical imaging (Tc-99m)."],
    [44,"Ru","Ruthenium","101.07","transition",8,5,"Hard platinum-group metal. Electronics."],
    [45,"Rh","Rhodium","102.91","transition",9,5,"Catalytic converters. Very reflective."],
    [46,"Pd","Palladium","106.42","transition",10,5,"Hydrogen absorber and coupling catalyst."],
    [47,"Ag","Silver","107.87","transition",11,5,"Best electrical conductor. Photography historically."],
    [48,"Cd","Cadmium","112.41","transition",12,5,"Toxic. Old Ni-Cd batteries."],
    [49,"In","Indium","114.82","post",13,5,"ITO coatings on touchscreens."],
    [50,"Sn","Tin","118.71","post",14,5,"Bronze and solder. Tin pest at low T for white tin."],
    [51,"Sb","Antimony","121.76","metalloid",15,5,"Flame retardants and some semiconductors."],
    [52,"Te","Tellurium","127.60","metalloid",16,5,"Alloys and CdTe solar cells."],
    [53,"I","Iodine","126.90","halogen",17,5,"Dark purple solid. Thyroid hormone, starch test."],
    [54,"Xe","Xenon","131.29","noble",18,5,"Anesthetic and ion-propulsion propellant. Forms compounds."],
    [55,"Cs","Cesium","132.91","alkali",1,6,"Softest metal. Defines the second (Cs-133)."],
    [56,"Ba","Barium","137.33","alkaline",2,6,"Green fireworks. BaSO4 is a GI contrast agent."],
    [57,"La","Lanthanum","138.91","lanthanide",3,6,"Start of the lanthanides. Camera glass."],
    [58,"Ce","Cerium","140.12","lanthanide",4,9,"Most abundant rare earth. Lighter flints, polishing."],
    [59,"Pr","Praseodymium","140.91","lanthanide",5,9,"Yellow-green glass and magnets."],
    [60,"Nd","Neodymium","144.24","lanthanide",6,9,"Nd2Fe14B permanent magnets."],
    [61,"Pm","Promethium","145","lanthanide",7,9,"Radioactive. No stable isotopes."],
    [62,"Sm","Samarium","150.36","lanthanide",8,9,"SmCo magnets and nuclear control rods."],
    [63,"Eu","Europium","151.96","lanthanide",9,9,"Red phosphor in older TVs and fluorescent lamps."],
    [64,"Gd","Gadolinium","157.25","lanthanide",10,9,"MRI contrast. High neutron capture."],
    [65,"Tb","Terbium","158.93","lanthanide",11,9,"Green phosphor. Magnetostrictive alloys."],
    [66,"Dy","Dysprosium","162.50","lanthanide",12,9,"High-temperature magnets."],
    [67,"Ho","Holmium","164.93","lanthanide",13,9,"Highest magnetic moment of any element."],
    [68,"Er","Erbium","167.26","lanthanide",14,9,"Fiber-optic amplifiers."],
    [69,"Tm","Thulium","168.93","lanthanide",15,9,"Rarest lanthanide. Portable X-ray sources."],
    [70,"Yb","Ytterbium","173.05","lanthanide",16,9,"Atomic clocks and stainless alloys."],
    [71,"Lu","Lutetium","174.97","lanthanide",17,9,"Last lanthanide. PET detectors (LSO)."],
    [72,"Hf","Hafnium","178.49","transition",4,6,"Control rods. Chemically like zirconium."],
    [73,"Ta","Tantalum","180.95","transition",5,6,"Capacitors. Very corrosion-resistant."],
    [74,"W","Tungsten","183.84","transition",6,6,"Highest melting point of metals. Light-bulb filaments."],
    [75,"Re","Rhenium","186.21","transition",7,6,"Jet-engine superalloys."],
    [76,"Os","Osmium","190.23","transition",8,6,"Densest stable element. Toxic OsO4."],
    [77,"Ir","Iridium","192.22","transition",9,6,"Very corrosion-resistant. Spark plugs, crucibles."],
    [78,"Pt","Platinum","195.08","transition",10,6,"Catalysts and jewelry. Inert electrode."],
    [79,"Au","Gold","196.97","transition",11,6,"Noble metal. Best known coinage and electronics."],
    [80,"Hg","Mercury","200.59","transition",12,6,"Only liquid metal at room T. Toxic vapor."],
    [81,"Tl","Thallium","204.38","post",13,6,"Highly toxic. Once used in rat poison."],
    [82,"Pb","Lead","207.2","post",14,6,"Dense, soft, toxic. Old pipes and solder."],
    [83,"Bi","Bismuth","208.98","post",15,6,"Low toxicity among heavy metals. Pinkish crystals."],
    [84,"Po","Polonium","209","post",16,6,"Intense alpha emitter. Discovered by Curie."],
    [85,"At","Astatine","210","halogen",17,6,"Rarest naturally occurring element. Radioactive."],
    [86,"Rn","Radon","222","noble",18,6,"Radioactive gas from uranium decay. Indoor hazard."],
    [87,"Fr","Francium","223","alkali",1,7,"Extremely radioactive alkali metal."],
    [88,"Ra","Radium","226","alkaline",2,7,"Glowing historically. Alpha emitter."],
    [89,"Ac","Actinium","227","actinide",3,7,"Gives the actinide series its name."],
    [90,"Th","Thorium","232.04","actinide",4,10,"Potential nuclear fuel. Long-lived Th-232."],
    [91,"Pa","Protactinium","231.04","actinide",5,10,"Scarce, highly radioactive."],
    [92,"U","Uranium","238.03","actinide",6,10,"Nuclear fuel. U-235 fissile, U-238 fertile."],
    [93,"Np","Neptunium","237","actinide",7,10,"First transuranic. Byproduct of reactors."],
    [94,"Pu","Plutonium","244","actinide",8,10,"Weapons and MOX fuel. Pu-239."],
    [95,"Am","Americium","243","actinide",9,10,"Smoke-detector sources (Am-241)."],
    [96,"Cm","Curium","247","actinide",10,10,"Alpha source for space RTGs research."],
    [97,"Bk","Berkelium","247","actinide",11,10,"Synthetic. Target for making heavier elements."],
    [98,"Cf","Californium","251","actinide",12,10,"Neutron source for industry and research."],
    [99,"Es","Einsteinium","252","actinide",13,10,"First seen in hydrogen-bomb debris."],
    [100,"Fm","Fermium","257","actinide",14,10,"Produced in nuclear explosions / reactors."],
    [101,"Md","Mendelevium","258","actinide",15,10,"Named for Mendeleev. Atom-at-a-time chemistry."],
    [102,"No","Nobelium","259","actinide",16,10,"Short-lived. +2 oxidation unusual for actinides."],
    [103,"Lr","Lawrencium","266","actinide",17,10,"Last actinide. Superheavy research."],
    [104,"Rf","Rutherfordium","267","transition",4,7,"Synthetic transition metal."],
    [105,"Db","Dubnium","268","transition",5,7,"Synthetic. Named for Dubna."],
    [106,"Sg","Seaborgium","269","transition",6,7,"Named for Glenn Seaborg."],
    [107,"Bh","Bohrium","270","transition",7,7,"Named for Niels Bohr."],
    [108,"Hs","Hassium","277","transition",8,7,"Named for Hesse, Germany."],
    [109,"Mt","Meitnerium","278","transition",9,7,"Named for Lise Meitner."],
    [110,"Ds","Darmstadtium","281","transition",10,7,"Named for Darmstadt."],
    [111,"Rg","Roentgenium","282","transition",11,7,"Named for Röntgen."],
    [112,"Cn","Copernicium","285","transition",12,7,"Named for Copernicus. Likely volatile metal."],
    [113,"Nh","Nihonium","286","post",13,7,"Named for Japan (Nihon)."],
    [114,"Fl","Flerovium","289","post",14,7,"Named for Flerov laboratory."],
    [115,"Mc","Moscovium","290","post",15,7,"Named for Moscow region."],
    [116,"Lv","Livermorium","293","post",16,7,"Named for Livermore."],
    [117,"Ts","Tennessine","294","halogen",17,7,"Named for Tennessee. Predicted halogen-like."],
    [118,"Og","Oganesson","294","noble",18,7,"Named for Oganessian. Predicted noble-gas-like."]
  ];

  function buildPeriodicTable() {
    const grid = document.getElementById("ptGrid");
    const detail = document.getElementById("ptDetail");
    const legend = document.getElementById("ptLegend");
    if (!grid) return;

    legend.innerHTML = Object.entries(CATS).map(([k, label]) =>
      "<span><i class='cat-" + k + "'></i>" + label + "</span>"
    ).join("");

    const map = {};
    ELEMENTS.forEach(e => { map[e[5] + "," + e[6]] = e; });

    for (let r = 1; r <= 10; r++) {
      for (let c = 1; c <= 18; c++) {
        if (r === 8) continue;
        const el = map[c + "," + r];
        if (!el) {
          const spacer = document.createElement("div");
          spacer.className = "el-empty";
          if (r >= 9 && c < 4) spacer.style.visibility = "hidden";
          grid.appendChild(spacer);
          continue;
        }
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "el cat-" + el[4];
        btn.innerHTML = "<small>" + el[0] + "</small><b>" + el[1] + "</b>";
        btn.title = el[2];
        btn.addEventListener("click", () => {
          grid.querySelectorAll(".el").forEach(n => n.classList.remove("is-on"));
          btn.classList.add("is-on");
          detail.innerHTML =
            "<div class='pt-detail-inner'><h3>" + el[1] + " — " + el[2] + "</h3>" +
            "<p class='pt-meta'>Atomic number " + el[0] + " · Mass " + el[3] + " u · " + CATS[el[4]] + "</p>" +
            "<p>" + el[7] + "</p>" +
            "<button type='button' class='text-btn' id='useMass'>Use mass in calculator</button></div>";
          document.getElementById("useMass").addEventListener("click", () => {
            current = el[3];
            justEvaluated = true;
            previous = null;
            operator = null;
            render();
            document.getElementById("calculator").scrollIntoView({ behavior: "smooth" });
          });
        });
        grid.appendChild(btn);
      }
    }
  }

  render();
  renderHistory();
  updateMemBadge();
  buildPeriodicTable();

  const revealEls = document.querySelectorAll(".hero, .workspace, .ref-block, .info, .site-footer, .faq article, .table-card, .side-card");
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  revealEls.forEach(el => {
    el.classList.add("reveal");
    io.observe(el);
  });
})();
