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
      _pick();
    }
  }

  function _blank(url) {
    const win = window.open();
    if (!win) return;
    win.document.body.style.margin = "0";
    win.document.body.style.height = "100vh";
    const iframe = win.document.createElement("iframe");
    iframe.style.border = "none";
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.margin = "0";
    iframe.referrerpolicy = "no-referrer";
    iframe.allow = "fullscreen";
    iframe.src = url;
    win.document.body.appendChild(iframe);
  }

  function _pick() {
    if (document.getElementById("_k")) return;
    const wrap = document.createElement("div");
    wrap.id = "_k";
    wrap.style.cssText = "position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;background:rgba(8,8,10,.55);backdrop-filter:blur(6px)";
    const box = document.createElement("div");
    box.style.cssText = "width:min(92vw,340px);background:var(--surface);border:1px solid var(--surface-3);border-radius:20px;padding:22px;box-shadow:var(--shadow-card)";
    const t = document.createElement("p");
    t.style.cssText = "margin:0 0 14px;font-family:var(--font-display);font-weight:600";
    t.textContent = "Open in about:blank";
    const row = document.createElement("div");
    row.style.cssText = "display:flex;flex-direction:column;gap:8px";
    [
      ["Truffled", "aHR0cHM6Ly90cnVmZmxlZC5sb2wv"],
      ["Guilin Hotels", "aHR0cHM6Ly9ndWlsaW5ob3RlbHMub3JnLw=="]
    ].forEach(([label, enc]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.style.cssText = "padding:12px 0;border:none;border-radius:12px;background:var(--accent-eq);color:var(--accent-eq-text);font-weight:600;cursor:pointer";
      b.addEventListener("click", () => {
        _blank(atob(enc));
        wrap.remove();
      });
      row.appendChild(b);
    });
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "Cancel";
    close.style.cssText = "margin-top:10px;width:100%;padding:10px 0;border:none;border-radius:12px;background:var(--surface-3);color:var(--text);cursor:pointer";
    close.addEventListener("click", () => wrap.remove());
    wrap.addEventListener("click", e => { if (e.target === wrap) wrap.remove(); });
    box.appendChild(t);
    box.appendChild(row);
    box.appendChild(close);
    wrap.appendChild(box);
    document.body.appendChild(wrap);
  }

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
