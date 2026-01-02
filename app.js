// app.js (vanilla JS)

let currentQuestion = 0;
let userProfile = {};
let questions = {};
let rackets = [];
let lang = localStorage.getItem("language") || getLanguage();
let averageScores = {};
const SCALE_FACTOR = 1;
let matchMode = "strength"; // strength | weakness | match
let selectedRacketIndex = 0;

// === Sprache automatisch erkennen ===
function getLanguage() {
  const navLang = navigator.language || navigator.userLanguage || "de";
  return navLang.startsWith("de") ? "de" : "en";
}

// === Dynamische Mittelwerte berechnen ===
function calculateAverageScores(rackets) {
  const categories = [
    "Groundstrokes","Volleys","Serves","Returns","Power",
    "Control","Maneuverability","Stability","Comfort",
    "Touch / Feel","Topspin","Slice"
  ];
  const sums = {}, counts = {};
  categories.forEach(c => { sums[c] = 0; counts[c] = 0; });

  rackets.forEach(r => {
    if (!r.stats) return;
    categories.forEach(c => {
      let v = r.stats[c];
      if (typeof v === "number") {
        if (v <= 10) v *= 10;
        sums[c] += v;
        counts[c]++;
      }
    });
  });

  categories.forEach(c => {
    averageScores[c] = counts[c] ? Math.round(sums[c] / counts[c]) : 50;
  });
}

// === Profil initialisieren ===
function initializeUserProfile() {
  const cats = [
    "Groundstrokes","Volleys","Serves","Returns","Power",
    "Control","Maneuverability","Stability","Comfort",
    "Touch / Feel","Topspin","Slice"
  ];
  userProfile = {};
  cats.forEach(c => userProfile[c] = averageScores[c] || 50);
}

// === Daten laden ===
async function loadData() {
  try {
    const [qRes, rRes] = await Promise.all([
      fetch("questions.json", { cache: "no-store" }),
      fetch("rackets.json", { cache: "no-store" })
    ]);
    questions = await qRes.json();
    rackets = await rRes.json();

    calculateAverageScores(rackets);
    initializeUserProfile();

    const brand = document.getElementById("brand");
    if (brand) {
      brand.innerHTML = "<b>WhichRacket.com</b>";
      brand.onclick = restartQuiz;
      brand.style.cursor = "pointer";
    }

    createImpressumHook();
    createBackButton();
    attachLangSwitchHandlers();
    showQuestion();
    renderProgress();

  } catch (e) {
    console.error(e);
  }
}

// === Frage anzeigen ===
function showQuestion() {
  const qList = questions[lang];
  if (!qList) return;
  if (currentQuestion >= qList.length) {
    showResults();
    return;
  }

  const q = qList[currentQuestion];
  document.getElementById("question").innerText = q.q;
  document.getElementById("question-number").innerText =
    `${lang === "de" ? "Frage" : "Question"} ${currentQuestion + 1}`;

  q.answers.forEach((a, i) => {
    const btn = document.getElementById(`a${i + 1}`);
    btn.innerText = a.text;
    btn.onclick = () => {
      handleEffects(a.effects);
      currentQuestion++;
      showQuestion();
      renderProgress();
    };
  });
}

// === Effekte anwenden ===
function handleEffects(effects) {
  Object.entries(effects).forEach(([k, v]) => {
    const base = averageScores[k] || 50;
    userProfile[k] = Math.max(0, Math.min(100, (userProfile[k] ?? base) + v));
  });
}

// === Progress ===
function renderProgress() {
  const bar = document.getElementById("progress-bar");
  bar.innerHTML = "";
  const total = questions[lang].length;
  for (let i = 0; i < total; i++) {
    const s = document.createElement("span");
    if (i < currentQuestion) s.classList.add("active");
    bar.appendChild(s);
  }
}

// === Ergebnisse ===
function showResults() {
  const overlay = document.createElement("div");
  overlay.id = "overlay";
  overlay.style.cssText = "position:fixed;inset:0;background:#fff;z-index:3000;overflow:auto;padding:30px";

  const card = document.createElement("div");
  card.style.cssText = "max-width:1200px;margin:auto";

  const title = document.createElement("h2");
  title.innerText = "Your Racket";
  card.appendChild(title);

  // === Mode Buttons ===
  const modes = document.createElement("div");
  modes.style.display = "flex";
  modes.style.gap = "10px";

  const makeBtn = (id, label, mode) => {
    const b = document.createElement("button");
    b.id = id;
    b.innerText = label;
    b.onclick = () => { matchMode = mode; refreshOverlay(); };
    return b;
  };

  modes.appendChild(makeBtn("mode-strength","Strength","strength"));
  modes.appendChild(makeBtn("mode-weakness","Weakness","weakness"));
  modes.appendChild(makeBtn("mode-match","Best Match","match"));
  card.appendChild(modes);

  const best = getTopRackets(getNormalizedProfile(), matchMode).bestRackets;

  best.forEach(r => {
    const d = document.createElement("div");
    d.innerHTML = `<h3>${r.name}</h3>`;
    card.appendChild(d);
  });

  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

// === Normalisieren ===
function getNormalizedProfile() {
  const out = {};
  Object.entries(userProfile).forEach(([k,v]) => {
    out[k] = ["Groundstrokes","Volleys","Serves","Returns","Power","Control","Maneuverability","Stability","Comfort","Touch / Feel","Topspin","Slice"]
      .includes(k) ? Math.round(v) / 10 : v;
  });
  return out;
}

// === Matching ===
function getTopRackets(profile, mode) {
  const scores = rackets.map(r => {
    let diff = 0;
    Object.entries(profile).forEach(([k,p]) => {
      const rv = r.stats?.[k];
      if (typeof rv === "number") {
        if (mode === "weakness" && p < 6.5) diff += Math.abs(10 - rv);
        else diff += Math.abs(p - rv);
      }
    });
    return { r, diff };
  });
  scores.sort((a,b) => a.diff - b.diff);
  return { bestRackets: scores.slice(0,3).map(s => s.r) };
}

// === Overlay neu ===
function refreshOverlay() {
  document.getElementById("overlay")?.remove();
  showResults();
}

// === Back ===
function createBackButton() {
  const b = document.createElement("div");
  b.innerHTML = "↩";
  b.style.cssText = "position:fixed;left:10px;top:50%;cursor:pointer;z-index:1000";
  b.onclick = () => { if (currentQuestion > 0) { currentQuestion--; showQuestion(); } };
  document.body.appendChild(b);
}

// === Sprache ===
function attachLangSwitchHandlers() {
  document.getElementById("lang-en")?.addEventListener("click",()=>switchLang("en"));
  document.getElementById("lang-de")?.addEventListener("click",()=>switchLang("de"));
}
function switchLang(l) {
  lang = l;
  localStorage.setItem("language", l);
  restartQuiz();
}

// === Impressum ===
function createImpressumHook() {
  const f = document.getElementById("footer-island");
  if (!f) return;
  const a = document.createElement("a");
  a.href = "impressum.html";
  a.target = "_blank";
  a.innerText = lang === "de" ? "Impressum" : "Imprint";
  f.appendChild(a);
}

// === Restart ===
function restartQuiz() {
  document.getElementById("overlay")?.remove();
  currentQuestion = 0;
  initializeUserProfile();
  showQuestion();
  renderProgress();
}

// === Init ===
loadData();
