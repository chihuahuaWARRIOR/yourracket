// app.js (vanilla JS)

let currentQuestion = 0;
let userProfile = {};
let questions = {};
let rackets = [];
let lang = localStorage.getItem("language") || getLanguage();
let averageScores = {};
const SCALE_FACTOR = 4;
let matchMode = "neutral";
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

  const sums = {};
  const counts = {};

  categories.forEach(c => {
    sums[c] = 0;
    counts[c] = 0;
  });

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
    averageScores[c] = counts[c] > 0
      ? Math.round(sums[c] / counts[c])
      : 50;
  });
}

// === Profil initialisieren (BLEIBT SO!) ===
function initializeUserProfile() {
  userProfile = {};
  Object.keys(averageScores).forEach(k => {
    userProfile[k] = averageScores[k];
  });
}

// === Effekte verarbeiten ===
function handleEffects(effects) {
  if (!effects) return;

  for (const [key, val] of Object.entries(effects)) {

    if (key === "WeightMin" || key === "WeightMax") {
      userProfile.WeightPref = userProfile.WeightPref || {};
      if (key === "WeightMin") userProfile.WeightPref.min = val;
      if (key === "WeightMax") userProfile.WeightPref.max = val;
      continue;
    }

    if (key === "HeadsizeMin" || key === "HeadsizeMax") {
      userProfile.HeadsizePref = userProfile.HeadsizePref || {};
      if (key === "HeadsizeMin") userProfile.HeadsizePref.min = val;
      if (key === "HeadsizeMax") userProfile.HeadsizePref.max = val;
      continue;
    }

    const base = averageScores[key] ?? 50;
    userProfile[key] = (userProfile[key] ?? base) + val * SCALE_FACTOR;
    userProfile[key] = Math.max(0, Math.min(100, userProfile[key]));
  }
}

// === Matching ===
function getTopRackets(profile, mode) {
  const cats = [
    "Groundstrokes","Volleys","Serves","Returns","Power","Control",
    "Maneuverability","Stability","Comfort","Touch / Feel","Topspin","Slice"
  ];

  const scored = rackets.map(r => {
    let diff = 0;

    cats.forEach(c => {
      const p = profile[c] ?? 0;
      const rv = r.stats?.[c] ?? 0;

      if (mode === "neutral") {
        diff += Math.pow(p - rv, 2);
      } else if (mode === "weakness" && p < 6.5) {
        diff += Math.abs(10 - rv);
      } else {
        diff += Math.abs(p - rv);
      }
    });

    return { r, diff };
  });

  scored.sort((a, b) => a.diff - b.diff);
  return { bestRackets: scored.slice(0, 3).map(s => s.r) };
}

// === Ergebnisse anzeigen ===
function showResults() {
  const existing = document.getElementById("overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "overlay";
  overlay.style.cssText = `
    position:fixed; inset:0; background:rgba(255,255,255,.96);
    z-index:3000; overflow:auto; padding:30px;
  `;

  const normalized = {};
  Object.entries(userProfile).forEach(([k,v]) => {
    if (typeof v === "number") {
      normalized[k] = [
        "Groundstrokes","Volleys","Serves","Returns","Power","Control",
        "Maneuverability","Stability","Comfort","Touch / Feel","Topspin","Slice"
      ].includes(k) ? Math.round(v) / 10 : v;
    }
  });

  const { bestRackets } = getTopRackets(normalized, matchMode);
  const best = bestRackets[0];
  selectedRacketIndex = 0;

  const card = document.createElement("div");
  card.className = "results-card";

  // === MODE BUTTONS ===
  const modeWrap = document.createElement("div");

  const makeBtn = (id, label, mode, color) => {
    const b = document.createElement("button");
    b.id = id;
    b.innerText = label;
    b.style.background = color;
    b.style.opacity = matchMode === mode ? "0.7" : "1";
    b.onclick = () => { matchMode = mode; refreshOverlay(); };
    return b;
  };

  modeWrap.appendChild(
    makeBtn("mode-neutral", "Perfect Match", "neutral", "#111")
  );
  modeWrap.appendChild(
    makeBtn("mode-strength", "Enhance Strengths", "strength", "#2ea44f")
  );
  modeWrap.appendChild(
    makeBtn("mode-weakness", "Balance Weaknesses", "weakness", "#c92a2a")
  );

  card.appendChild(modeWrap);

  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

// === Overlay Refresh ===
function refreshOverlay() {
  const o = document.getElementById("overlay");
  if (o) o.remove();
  showResults();
}

// === Daten laden ===
async function loadData() {
  const [qRes, rRes] = await Promise.all([
    fetch("questions.json", { cache: "no-store" }),
    fetch("rackets.json", { cache: "no-store" })
  ]);
  questions = await qRes.json();
  rackets = await rRes.json();

  calculateAverageScores(rackets);
  initializeUserProfile();
  showQuestion();
}

// === Init ===
loadData();
