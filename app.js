// app.js (vanilla JS)

let currentQuestion = 0;
let userProfile = {};
let questions = {};
let rackets = [];
let lang = localStorage.getItem("language") || getLanguage();
let averageScores = {}; // Container für die berechneten Mittelwerte
const SCALE_FACTOR = 3;
let matchMode = "strength";
let selectedRacketIndex = 0;

// === Sprache automatisch erkennen ===
function getLanguage() {
  const navLang = navigator.language || navigator.userLanguage || "de";
  return navLang.startsWith("de") ? "de" : "en";
}

// === Dynamische Mittelwerte berechnen (ANGEPASST AN DEINE JSON) ===
function calculateAverageScores(rackets) {
  const categories = [
    "Groundstrokes", "Volleys", "Serves", "Returns", "Power",
    "Control", "Maneuverability", "Stability", "Comfort",
    "Touch / Feel", "Topspin", "Slice"
  ];
  const counts = {};
  const sums = {}; 

  categories.forEach(cat => {
    sums[cat] = 0;
    counts[cat] = 0;
  });

  rackets.forEach(racket => {
    // Falls das Racket keine Stats hat, überspringen
    if (!racket.stats) return;

    categories.forEach(cat => {
      // Zugriff auf das verschachtelte stats-Objekt
      let val = racket.stats[cat];

      // Prüfen, ob val eine Zahl ist
      if (val !== undefined && typeof val === 'number') {
        // WICHTIG: Deine JSON nutzt 0-10 (z.B. 8.7), wir brauchen intern 0-100.
        // Also rechnen wir mal 10.
        if (val <= 10) { 
             val = val * 10; 
        }

        sums[cat] += val;
        counts[cat]++;
      }
    });
  });

  categories.forEach(cat => {
    // Durchschnitt berechnen oder Fallback auf 50
    averageScores[cat] = counts[cat] > 0
      ? Math.round(sums[cat] / counts[cat])
      : 50;
  });

  console.log("Dynamische Basiswerte (Mittelwerte):", averageScores);
}

// === Funktion zum Initialisieren des Benutzerprofils ===
function initializeUserProfile() {
  const categories = [
    "Groundstrokes", "Volleys", "Serves", "Returns", "Power",
    "Control", "Maneuverability", "Stability", "Comfort",
    "Touch / Feel", "Topspin", "Slice"
  ];

  userProfile = {}; 

  categories.forEach(cat => {
    // Setze den Startwert auf den berechneten Mittelwert
    userProfile[cat] = averageScores[cat] || 50; 
  });
  
  console.log("Benutzerprofil initialisiert:", userProfile);
}

// === Daten laden ===
async function loadData() {
  try {
    const [qRes, rRes] = await Promise.all([
      fetch("questions.json", { cache: "no-store" }),
      fetch("rackets.json", { cache: "no-store" })
    ]);
    const qData = await qRes.json();
    const rData = await rRes.json();

    questions = qData;
    rackets = rData;

    // 1. DYNAMISCHE WERTE BERECHNEN & PROFIL INITIALISIEREN
    calculateAverageScores(rackets);
    initializeUserProfile();

    // 2. BRANDING UND EVENT-LISTENER
    const brandEl = document.getElementById("brand");
    if (brandEl) {
      brandEl.innerHTML = `<b>WhichRacket.com</b>`;
      brandEl.style.textDecoration = "none";
      brandEl.style.cursor = "pointer";

      // Klick auf Branding-Insel -> Quiz neu starten
      brandEl.addEventListener("click", () => {
        restartQuiz();
      });
    }

    // 3. START DES QUIZ-ABLAUFS
    createImpressumHook();
    showQuestion();
    renderProgress();
    createBackButton();
    attachLangSwitchHandlers();

  } catch (err) {
    console.error("Fehler beim Laden:", err);
    const q = document.getElementById("question");
    if (q) q.innerText = "Fehler beim Laden 😕";
  }
}

// === Frage anzeigen ===
function showQuestion() {
  const qList = questions[lang];
  if (!qList || qList.length === 0) return;

  if (currentQuestion >= qList.length) {
    showResults();
    return;
  }

  const q = qList[currentQuestion];
  const qEl = document.getElementById("question");
  
  // Element für die Fragen-Nummer finden
  const qNumEl = document.getElementById("question-number");
  if (qNumEl) {
    qNumEl.textContent = `${lang === "de" ? "Frage" : "Question"} ${currentQuestion + 1}:`;
    qNumEl.style.fontSize = "1.1rem";
    qNumEl.style.fontWeight = "bold";
    qNumEl.style.margin = "0 0 8px 0";
  }

  if (qEl) {
      qEl.innerText = q.q;
      qEl.style.margin = "0";
  }

  for (let i = 0; i < 4; i++) {
    const btn = document.getElementById(`a${i + 1}`);
    const answer = q.answers[i];
    if (!btn || !answer) continue;
    btn.innerText = answer.text;
    
    btn.style.opacity = "";
    btn.onclick = () => {
      handleEffects(answer.effects);
      // visuelles kurzes drücken
      btn.style.opacity = "0.95";
      setTimeout(() => {
        btn.style.opacity = "";
        currentQuestion++;
        showQuestion();
      }, 120);
    };
  }

  const pText = document.getElementById("progress-text");
  if (pText) {
    pText.innerText =
      lang === "de"
        ? `Frage ${currentQuestion + 1} von ${qList.length}`
        : `Question ${currentQuestion + 1} of ${qList.length}`;
  }

  renderProgress();
}

// === Fortschrittsanzeige ===
function renderProgress() {
  const bar = document.getElementById("progress-bar");
  const qList = questions[lang] || [];
  if (!bar) return;
  bar.innerHTML = "";
  for (let i = 0; i < qList.length; i++) {
    const span = document.createElement("span");
    if (i < currentQuestion) span.classList.add("active");
    if (i === currentQuestion) span.style.background = "#000";
    bar.appendChild(span);
  }
}

// === Effekte verarbeiten ===
function handleEffects(effects) {
  if (!effects) return;
  
  for (const [key, val] of Object.entries(effects)) {
    // WeightPref / HeadsizePref logic
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

    // NORMALE KATEGORIEN: 
    // Wir nutzen hier den berechneten Durchschnitt (averageScores) als Basis.
    const currentBase = averageScores[key] || 50;

    // Berechnung: (Basis) + Veränderung
    userProfile[key] = (userProfile[key] ?? currentBase) + (val * SCALE_FACTOR);
    userProfile[key] = Math.max(0, Math.min(100, userProfile[key]));
  }
}

// === Ergebnisse anzeigen (Overlay) ===
function showResults() {
  const existing = document.getElementById("overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "overlay";
  Object.assign(overlay.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    background: "rgba(255,255,255,0.96)",
    backdropFilter: "blur(6px)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: "30px",
    zIndex: "3000",
    overflowY: "auto",
    boxSizing: "border-box"
  });

  const normalizedProfile = {};
  const categories = [
    "Groundstrokes","Volleys","Serves","Returns","Power","Control",
    "Maneuverability","Stability","Comfort","Touch / Feel","Topspin","Slice",
    "TheBigServer", "ServeAndVolleyer", "AllCourtPlayer", "AttackingBaseliner", "SolidBaseliner", "CounterPuncher"
  ];
  
  categories.forEach(cat => {
    const raw = userProfile[cat] ?? null;
    if (raw === null) normalizedProfile[cat] = 0;
    else {
        if (["Groundstrokes","Volleys","Serves","Returns","Power","Control","Maneuverability","Stability","Comfort","Touch / Feel","Topspin","Slice"].includes(cat)) {
            normalizedProfile[cat] = Math.round((raw / 10) * 10) / 10;
        } else {
            normalizedProfile[cat] = raw;
        }
    }
  });

  if (userProfile.WeightPref) normalizedProfile.WeightPref = userProfile.WeightPref;
  if (userProfile.HeadsizePref) normalizedProfile.HeadsizePref = userProfile.HeadsizePref;

  const topResult = getTopRackets(normalizedProfile, matchMode);
  const bestRackets = topResult.bestRackets;
  const best = bestRackets[0] || rackets[0];
  selectedRacketIndex = 0;

  const card = document.createElement("div");
  Object.assign(card.style, {
    width: "min(1200px, 98%)",
    borderRadius: "16px",
    background: "#fff",
    padding: "22px",
    boxSizing: "border-box",
    boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
    maxHeight: "none",
    overflowY: "visible"
  });

  const styleTitle = document.createElement("h3");
  styleTitle.innerText = "Your Game";
  Object.assign(styleTitle.style, { margin: "0 0 12px 0", fontSize: "1.6rem", fontStyle: "italic", fontWeight: "700" });
  card.appendChild(styleTitle);

  // === DER FIX FÜR DIE BOXEN-HÖHE ===
  const chartLayoutContainer = document.createElement("div");
  Object.assign(chartLayoutContainer.style, {
    display: "flex",
    flexWrap: "wrap",
    gap: "20px",
    marginBottom: "18px",
    alignItems: "stretch" // Zwingt beide Boxen auf gleiche Höhe
  });

  const styleDesc = getPlayStyleDescription(normalizedProfile);
  const styleDiv = document.createElement("div");
  Object.assign(styleDiv.style, {
      flex: "1 1 450px",
      padding: "20px",
      borderRadius: "12px",
      border: "1px solid #ddd", 
      background: "#f9f9f9",
      boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      boxSizing: "border-box",
      minHeight: window.innerWidth < 768 ? "auto" : "500px" 
  });
  styleDiv.innerHTML = styleDesc;
  
  const radarDiv = document.createElement("div");
  Object.assign(radarDiv.style, {
      flex: "1 1 350px",
      padding: window.innerWidth < 600 ? "5px" : "20px", 
      borderRadius: "12px",
      border: "1px solid #ddd",
      background: "#f9f9f9",
      boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      margin: window.innerWidth < 768 ? "10px auto" : "0", 
      width: "100%",
      boxSizing: "border-box",
      minHeight: window.innerWidth < 768 ? "320px" : "500px" 
  });

  const canvas = document.createElement("canvas");
  canvas.id = "playingStyleChart";
  radarDiv.appendChild(canvas);

  chartLayoutContainer.appendChild(styleDiv);
  chartLayoutContainer.appendChild(radarDiv);
  card.appendChild(chartLayoutContainer);

  // 3. Überschrift "Your Racket"
  const racketTitle = document.createElement("h3");
  racketTitle.innerText = "Your Racket";
  Object.assign(racketTitle.style, {
    margin: "24px 0 12px 0",
    fontSize: "1.6rem",
    fontStyle: "italic", 
    fontWeight: "700"
  });
  card.appendChild(racketTitle);

  // 4. Mode Selection
  const modeSelectionWrap = document.createElement("div");
  Object.assign(modeSelectionWrap.style, {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "12px",
    marginBottom: "18px"
  });

  const modeLeft = document.createElement("div");
  modeLeft.style.flex = "1 1 300px";
  modeLeft.innerHTML = `<p style="margin:0; color:#444;">${lang === "de" ? "Möchtest du " : "Would you like to "}<span style="font-weight:700; color:#2ea44f;">${lang === "de" ? "Deine Stärken ausbauen" : "enhance strengths"}</span>${lang === "de" ? " oder " : " or "}<span style="font-weight:700; color:#c92a2a;">${lang === "de" ? "Schwächen ausgleichen" : "balance weaknesses"}</span>?</p>`;

  const modeRight = document.createElement("div");
  modeRight.style.display = "flex";
  modeRight.style.gap = "10px";
  modeRight.style.alignItems = "center";

  const btnStrength = document.createElement("button");
  btnStrength.type = "button";
  btnStrength.id = "mode-strength";
  btnStrength.innerText = lang === "de" ? "Stärken ausbauen" : "Enhance strengths";
  Object.assign(btnStrength.style, {
    minWidth: "150px",
    padding: "10px 14px",
    borderRadius: "10px",
    border: "none",
    cursor: "pointer",
    fontWeight: "700",
    background: "#2ea44f",
    color: "#fff",
    opacity: matchMode === "strength" ? "0.7" : "1"
  });

  const btnWeak = document.createElement("button");
  btnWeak.type = "button";
  btnWeak.id = "mode-weakness";
  btnWeak.innerText = lang === "de" ? "Schwächen ausgleichen" : "Balance weaknesses";
  Object.assign(btnWeak.style, {
    minWidth: "150px",
    padding: "10px 14px",
    borderRadius: "10px",
    border: "none",
    cursor: "pointer",
    fontWeight: "700",
    background: "#c92a2a",
    color: "#fff",
    opacity: matchMode === "weakness" ? "0.7" : "1"
  });
  
  btnStrength.onclick = () => { matchMode = "strength"; refreshOverlay(); };
  btnWeak.onclick = () => { matchMode = "weakness"; refreshOverlay(); };

  modeRight.appendChild(btnStrength);
  modeRight.appendChild(btnWeak);
  modeSelectionWrap.appendChild(modeLeft);
  modeSelectionWrap.appendChild(modeRight);
  card.appendChild(modeSelectionWrap);

  // 5. Racket Cards Container
const makeRacketCard = (r, idx) => {
  const div = document.createElement("div");
  Object.assign(div.style, {
    flex: "1 1 30%",
    minWidth: "220px",
    maxWidth: "360px",
    borderRadius: "12px",
    padding: "16px 12px",
    boxSizing: "border-box",
    border: "1px solid #ddd", 
    background: "#fff", 
    cursor: "pointer",
    position: "relative",
    transition: "border 0.2s, box-shadow 0.2s",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    fontFamily: "inherit" // Erbt die Schriftart der Website/Endkarte
  });
  div.dataset.index = idx;
  div.onclick = () => updateRacketDisplay(idx);

  // --- TOP 2 KATEGORIEN (Dezenter Outline-Stil) ---
  const relevantCats = [
    "Power", "Control", "Maneuverability", "Stability", 
    "Comfort", "Touch / Feel", "Topspin", "Slice"
  ];
  
  const topCats = relevantCats
    .map(cat => ({ name: cat, val: (r.stats && r.stats[cat]) ? r.stats[cat] : 0 }))
    .sort((a, b) => b.val - a.val)
    .slice(0, 2);

  const badgeContainer = document.createElement("div");
  Object.assign(badgeContainer.style, {
    display: "flex",
    gap: "6px",
    marginBottom: "12px",
    justifyContent: "center",
    width: "100%"
  });

  topCats.forEach(cat => {
    const badge = document.createElement("span");
    badge.innerText = cat.name;
    Object.assign(badge.style, {
      background: "transparent", // Kein Hintergrund mehr
      color: "#444",
      fontSize: "0.65rem",
      fontWeight: "700",
      padding: "3px 8px",
      borderRadius: "6px",
      textTransform: "uppercase",
      border: "1px solid #ddd", // Nur Umrandung
      whiteSpace: "nowrap",
      fontFamily: "inherit"
    });
    badgeContainer.appendChild(badge);
  });

  // BILD
  const img = document.createElement("img");
  img.src = r.img;
  img.alt = r.name;
  Object.assign(img.style, { 
    width: "55%", 
    height: "auto",
    borderRadius: "8px", 
    display: "block", 
    marginBottom: "12px",
    filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.08))"
  });

  // NAME
  const h = document.createElement("div");
  h.innerText = r.name;
  Object.assign(h.style, {
    fontWeight: "800",
    fontSize: "1rem",
    textAlign: "center",
    marginBottom: "6px",
    lineHeight: "1.2",
    color: "#111",
    fontFamily: "inherit"
  });

  // OPTIMIERTER CTA LINK (Button-Stil passend zu den Badges)
  const link = document.createElement("a");
  link.href = r.url;
  link.target = "_blank";
  link.innerText = lang === "de" ? "Jetzt entdecken & kaufen" : "Explore & buy now";
  
  Object.assign(link.style, {
    display: "inline-block",
    marginTop: "8px",
    marginBottom: "12px",
    padding: "8px 16px",
    background: "transparent",
    color: "#111",
    fontSize: "0.8rem",
    fontWeight: "700",
    textDecoration: "none",
    borderRadius: "8px",
    border: "1px solid #111", // Starker Kontrast für den Button
    transition: "all 0.2s ease",
    textAlign: "center",
    fontFamily: "inherit"
  });

  // Hover-Effekt
  link.onmouseenter = () => {
    link.style.background = "#111";
    link.style.color = "#fff";
  };
  link.onmouseleave = () => {
    link.style.background = "transparent";
    link.style.color = "#111";
  };

  // TECH STATS
  const tech = document.createElement("div");
  Object.assign(tech.style, {
    marginTop: "auto",
    fontSize: "0.8rem",
    color: "#777",
    fontWeight: "500",
    fontFamily: "inherit"
  });
  tech.innerHTML = `
    ${r.stats.Weight !== undefined ? `${r.stats.Weight}g` : ""}
    ${r.stats.Headsize !== undefined ? ` | ${r.stats.Headsize}cm²` : ""}
  `;

  div.appendChild(badgeContainer);
  div.appendChild(img);
  div.appendChild(h);
  div.appendChild(link);
  div.appendChild(tech);

  return div;
};
  
  // 6. Tabelle
  const tableWrap = document.createElement("div");
  tableWrap.style.overflowX = "auto";
  const table = document.createElement("table");
  table.id = "profile-table";
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";
  table.style.minWidth = "640px";

  const thead = document.createElement("thead");
  thead.innerHTML = `<tr style="background:transparent">
    <th style="text-align:left; padding:10px 12px; width:40%;">${lang === "de" ? "Kategorie" : "Category"}</th>
    <th style="text-align:center; padding:10px 12px; width:30%;">${lang === "de" ? "Dein Spielerprofil" : "Your Player Profile"}</th>
    <th style="text-align:center; padding:10px 12px; width:30%;">${lang === "de" ? "Schlägerprofil" : "Racket Profile"}</th>
  </tr>`;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  const profileForTable = {};
  Object.entries(normalizedProfile).forEach(([key, val]) => {
      if (typeof val === 'number' && val <= 10.00001) {
          profileForTable[key] = val;
      }
      if (key.endsWith("Pref")) {
          profileForTable[key] = val;
      }
  });
  tbody.innerHTML = buildProfileTableRows(profileForTable, best.stats);
  table.appendChild(tbody);
  tableWrap.appendChild(table);
  card.appendChild(tableWrap);

  // Restart Button
  const restartWrap = document.createElement("div");
  restartWrap.style.display = "flex";
  restartWrap.style.justifyContent = "center";
  restartWrap.style.marginTop = "18px";

  const restartBtn = document.createElement("button");
  restartBtn.innerText = lang === "de" ? "Quiz neu starten" : "Restart Quiz";
  Object.assign(restartBtn.style, {
    background: "#111",
    color: "#fff",
    fontWeight: "700",
    padding: "14px 26px",
    borderRadius: "12px",
    border: "none",
    fontSize: "1.05rem",
    cursor: "pointer"
  });
  restartBtn.onclick = () => restartQuiz();
  restartWrap.appendChild(restartBtn);
  card.appendChild(restartWrap);

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  createRestartFloatingButton();
  highlightMatchMode(); 
  highlightSelectedRacket(0);
  injectResponsiveStyles();

  // WICHTIG: Kurz warten, bis das Overlay sichtbar ist, dann zeichnen
  setTimeout(() => {
    renderRadarChart(normalizedProfile);
  }, 50);

}  
  
// === Match Mode Highlighting ===
function highlightMatchMode() {
  const topRow = document.getElementById("racket-cards-container");
  if (!topRow) return;

  const color = matchMode === "strength" ? "#2ea44f" : "#c92a2a";

  topRow.style.outline = "none";
  topRow.style.outlineOffset = "0";
  topRow.style.border = `3px solid ${color}`;
  topRow.style.boxShadow = `0 0 16px 2px ${color}80`;

  highlightSelectedRacket(selectedRacketIndex);
}

// === Tabellen-Zeilen ===
function buildProfileTableRows(player, racketStats) {
  const order = [
    "Groundstrokes", "Volleys", "Serves", "Returns", "Power", "Control",
    "Maneuverability", "Stability", "Comfort", "Touch / Feel", "Topspin", "Slice"
  ];
  return order.map((key, idx) => {
    const pVal = (player[key] ?? 0).toFixed(1);
    const rVal = racketStats[key];
    const bg = idx % 2 === 0 ? "#ffffff" : "#f6f6f6";
    return `<tr style="background:${bg}"><td style="padding:10px 12px; text-align:left;">${key}</td><td style="padding:10px 12px; text-align:center;">${pVal}</td><td style="padding:10px 12px; text-align:center;">${(typeof rVal === 'number') ? rVal.toFixed(1) : '-'}</td></tr>`;
  }).join("");
}

// === Update Racket Display ===
function updateRacketDisplay(index) {
  const normalized = {};
  const categories = [
    "Groundstrokes","Volleys","Serves","Returns","Power","Control",
    "Maneuverability","Stability","Comfort","Touch / Feel","Topspin","Slice",
    "TheBigServer", "ServeAndVolleyer", "AllCourtPlayer", "AttackingBaseliner", "SolidBaseliner", "CounterPuncher"
  ];
  categories.forEach(cat => {
    const raw = userProfile[cat] ?? null;
    if (raw === null) normalized[cat] = 0;
    else {
        if (["Groundstrokes","Volleys","Serves","Returns","Power","Control","Maneuverability","Stability","Comfort","Touch / Feel","Topspin","Slice"].includes(cat)) {
            normalized[cat] = Math.round((raw / 10) * 10) / 10;
        } else {
            normalized[cat] = raw;
        }
    }
  });
  if (userProfile.WeightPref) normalized.WeightPref = userProfile.WeightPref;
  if (userProfile.HeadsizePref) normalized.HeadsizePref = userProfile.HeadsizePref;

  const top = getTopRackets(normalized, matchMode).bestRackets;
  const racket = top[index] || top[0];
  const tbody = document.querySelector("#profile-table tbody");

  const profileForTable = {};
  Object.entries(normalized).forEach(([key, val]) => {
      if (typeof val === 'number' && val <= 10.00001) {
          profileForTable[key] = val;
      }
      if (key.endsWith("Pref")) {
          profileForTable[key] = val;
      }
  });

  if (tbody && racket) tbody.innerHTML = buildProfileTableRows(profileForTable, racket.stats);
  selectedRacketIndex = index;
  highlightSelectedRacket(index);
  
}

// === Karten Highlighten ===
function highlightSelectedRacket(index) {
  const overlay = document.getElementById("overlay");
  if (!overlay) return;
  const cards = overlay.querySelectorAll("div[data-index]");
  cards.forEach(c => {
    const idx = parseInt(c.dataset.index, 10);
    const modeColor = matchMode === "strength" ? "#2ea44f" : "#c92a2a";

    if (idx === index) {
      c.style.background = "#fff"; 
      c.style.border = "3px solid #111"; 
      c.style.boxShadow = "0 6px 18px rgba(0,0,0,0.1)"; 
    } else {
      c.style.background = "#fff";
      c.style.border = `1px solid ${modeColor}`; 
      c.style.boxShadow = "0 1px 4px rgba(0,0,0,0.05)"; 
    }
  });
}

// === Restart Floating Button ===
function createRestartFloatingButton() {
  const existing = document.getElementById("restart-floating");
  if (existing) return;
  const btn = document.createElement("button");
  btn.id = "restart-floating";
  btn.innerText = lang === "de" ? "Quiz neu starten" : "Restart Quiz";
  Object.assign(btn.style, {
    position: "fixed",
    left: "8px",
    top: "50%",
    transform: "translateY(-50%)",
    zIndex: 4000,
    background: "#111",
    color: "#fff",
    border: "none",
    borderRadius: "20px",
    padding: "12px 14px",
    cursor: "pointer",
    fontWeight: "700",
    boxShadow: "0 4px 14px rgba(0,0,0,0.15)"
  });
  btn.onclick = () => restartQuiz();
  document.body.appendChild(btn);
}

// === Overlay Refresh (Stabilisierte Version) ===
function refreshOverlay() {
  const oldOverlay = document.getElementById("overlay");
  if (!oldOverlay) {
    showResults();
    return;
  }

  const currentScroll = oldOverlay.scrollTop;

  // 1. Dunklen Lade-Vorhang erstellen
  const loader = document.createElement("div");
  loader.id = "loading-curtain";
  Object.assign(loader.style, {
    position: "fixed",
    top: "0", left: "0", width: "100%", height: "100%",
    background: "rgba(30, 30, 30, 0.9)", // Dunkelgrau
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontSize: "1.2rem",
    zIndex: "9999",
    opacity: "0",
    transition: "opacity 0.2s ease"
  });
  loader.innerHTML = "<div>" + (lang === "de" ? "Wird aktualisiert..." : "Updating...") + "</div>";
  document.body.appendChild(loader);

  // 2. Vorhang einblenden
  requestAnimationFrame(() => {
    loader.style.opacity = "1";
  });

  // 3. Nach einer kurzen Verzögerung (wenn Vorhang zu ist) umbauen
  setTimeout(() => {
    oldOverlay.remove();
    showResults();

    const newOverlay = document.getElementById("overlay");
    if (newOverlay) {
      newOverlay.style.scrollBehavior = "auto";
      
      // Scroll-Position wiederherstellen (bevor Vorhang aufgeht)
      setTimeout(() => {
        newOverlay.scrollTop = currentScroll;
        
        // 4. Vorhang wieder ausblenden
        loader.style.opacity = "0";
        setTimeout(() => loader.remove(), 200);
      }, 80); 
    }
  }, 200);
}

// === Responsive Styles ===
function injectResponsiveStyles() {
  if (document.getElementById("appjs-responsive-styles")) return;
  const s = document.createElement("style");
  s.id = "appjs-responsive-styles";
  s.textContent = `
    body {
        display: flex !important;
        justify-content: center !important;
        align-items: center !important;
        min-height: 100vh !important;
        flex-direction: column !important; 
        padding: 0;
        margin: 0;
        overflow: auto !important;
    }
    #quiz-container {
        display: flex !important;
        flex-direction: column !important;
        min-height: auto !important;
        margin: 0;
        padding: 0;
    }
    #question-container {
        position: relative !important;
        top: auto !important;
        left: auto !important;
        transform: none !important;
        min-height: 250px !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: flex-start;
        margin: 0 auto !important;
        padding: 20px 40px 20px 40px !important;
        width: 60% !important; 
    }
    #question {
      min-height: 120px !important;
      flex-grow: 1 !important;
      display: flex !important; 
      align-items: center !important;
      justify-content: center !important;
      text-align: center;
      margin: 0 !important; 
      padding: 0 !important;
    }
    #progress-container {
        margin-top: 20px !important;
        padding-bottom: 20px !important;
        position: relative !important;
        flex-grow: 0 !important;
        flex-shrink: 0 !important;
    }
    #question-number {
        margin: 0 0 8px 0 !important;
        padding: 0 !important;
    }
    @media (max-width: 768px) {
        #question-container {
            width: 92% !important;
            margin: 32px auto !important;
            padding: 14px 16px 18px 16px !important;
        }
        #quiz-container {
            height: auto !important;
        }
    }
    @media (max-width: 900px) {
      #overlay { align-items: flex-start; padding-top: 24px; padding-bottom: 24px; }
    }
    @media (max-width: 640px) {
      #profile-table { min-width: 100% !important; }
      #restart-floating { display: none; }
    }
  `;
  document.head.appendChild(s);
}

// === Matching Logic ===
function getTopRackets(profile, mode) {
  const scores = rackets.map(r => {
    let diff = 0;
    const cats = [
      "Groundstrokes","Volleys","Serves","Returns","Power","Control",
      "Maneuverability","Stability","Comfort","Touch / Feel","Topspin","Slice"
    ];
    cats.forEach(cat => {
      const p = profile[cat] ?? 0;
      // WICHTIG: Hier stats aus dem stats-Objekt holen!
      const rv = (r.stats && r.stats[cat]) ? r.stats[cat] : 0;
      
      if (mode === "weakness" && p < 6.5) {
        diff += Math.abs(10 - rv);
      } else {
        diff += Math.abs(p - rv);
      }
    });

    if (r.stats && r.stats.Weight !== undefined && profile.WeightPref !== undefined) {
      const pref = profile.WeightPref;
      const w = r.stats.Weight;
      const mid = ((pref.min ?? pref.max ?? w) + (pref.max ?? pref.min ?? w)) / 2;
      if ((pref.min === undefined || w >= pref.min) && (pref.max === undefined || w <= pref.max)) {
        diff -= 3;
      } else {
        diff += Math.abs(w - mid) / 30;
      }
    }

    if (r.stats && r.stats.Headsize !== undefined && profile.HeadsizePref !== undefined) {
      const pref = profile.HeadsizePref;
      const hs = r.stats.Headsize;
      const mid = ((pref.min ?? pref.max ?? hs) + (pref.max ?? pref.min ?? hs)) / 2;
      if ((pref.min === undefined || hs >= pref.min) && (pref.max === undefined || hs <= pref.max)) {
        diff -= 2.5;
      } else {
        diff += Math.abs(hs - mid) / 80;
      }
    }

    return { r, diff };
  });

  scores.sort((a, b) => a.diff - b.diff);
  return { bestRackets: scores.slice(0, 3).map(s => s.r) };
}

// === Spielstil Beschreibung ===
function getPlayStyleDescription(profile) {
  const playStyles = {
    TheBigServer: {
      iconPath: "/assets/icons/biceps-flexed.svg",
      de: { name: "Big Serve", desc: "Dein Spiel dreht sich um Deinen <b>schnellen ersten Aufschlag</b>. Dabei hilft Dir ein Schläger, der Dich bei <b>Serves</b> unterstützt. Um Punkte frühzeitig zu entscheiden, hilft Dir ein Schläger mit viel <b>Power</b>. Du bestimmst das Spiel mit Deinem <b>risikoreichen Offensivspiel</b> und bewegst dich daher sehr effizient: <b>Manövrierfähigkeit</b> ist für Deinen Schläger also weniger wichtig." },
      en: { name: "Big Serve", desc: "Your game is built around your <b>fast first serve</b>. You need a racket that provides maximum support for your <b>serves</b>. To end points early, a racket with plenty of <b>power</b> is your best ally. You dictate the game with your <b>high-risk offensive play</b> and move very efficiently: <b>maneuverability</b> is therefore less of a priority for your racket." }
    },
    ServeAndVolleyer: {
      iconPath: "/assets/icons/zap.svg",
      de: { name: "Serve and Volley", desc: "Ein guter <b>Aufschlag, gefolgt von einem Angriff am Netz</b> ist der Mittelpunkt Deines Spiels. Ein Schläger für gute <b>Serves</b> ist dabei ebenso wichtig, wie die Qualität der <b>Volleys</b>. Durch den Fokus auf Dein <b>Offensivspiel am Netz</b> ist eine Unterstützung für <b>Schläge von der Grundlinie</b> von Deinem Schläger nicht die Priorität." },
      en: { name: "Serve and Volley", desc: "A strong <b>serve followed by an attack at the net</b> is the heart of your game. A racket for great <b>serves</b> is just as important as the quality of your <b>volleys</b>. Due to the focus on your <b>offensive net play</b>, support for <b>baseline strokes</b> is not the priority for your racket." }
    },
    AllCourtPlayer: {
      iconPath: "/assets/icons/wind.svg",
      de: { name: "All-Court", desc: "Du spielst <b>offensiv</b> und versuchst von allen Bereichen des Platzes aus in den Angriff zu kommen. Dein Schläger sollte, wie du, eine gute <b>all-around Performance</b> mitbringen. Bei Angriffsbällen aus dem Halbfeld und dem Angriff am Netz danach hilft Dir eine gute <b>Manövrierfähigkeit</b> besonders. Um Deine Präzision zu unterstützen, rückt die <b>Power</b> des Schlägers etwas in den Hintergrund. " },
      en: { name: "All-Court", desc: "You play <b>offensively</b> and look to attack from all areas of the court. Like you, your racket should deliver strong <b>all-around performance</b>. For mid-court approach shots and following up at the net, good <b>maneuverability</b> is especially helpful. To support your precision, the <b>power</b> of the racket takes more of a backseat." }
    },
    AttackingBaseliner: {
      iconPath: "/assets/icons/target.svg",
      de: { name: "Attacking Baseliner", desc: "Du diktierst das Spiel von der <b>Grundlinie</b>. Mit harten, platzierten Bällen bringst Du den Gegner zum Laufen. Ein Schläger, der Dir dafür starken <b>Topspin</b> liefert, ist perfekt. Auch bei der Qualität der <b>Schläge von der Grundlinie</b> kann dein Racket dich unterstützen, um Bälle platziert und weit zu spielen. Bei Deinem hohen Spieltempo liegt der Fokus für dich nicht auf defensive Schläger mit viel Slice." },
      en: { name: "Attacking Baseliner", desc: "You dictate the play from the <b>baseline</b>. With hard, well-placed shots, you keep your opponent on the run. A racket that provides strong <b>topspin</b> is perfect for this. Your racket also supports the quality of your <b>baseline strokes</b>, helping you play deep and accurate balls. Given your high pace, defensive rackets with high <b>slice</b> potential are not the focus for you." }
    },
    SolidBaseliner: {
      iconPath: "/assets/icons/scale.svg",
      de: { name: "Solid Baseliner", desc: "Eine gute <b>Balance aus Angriff und Verteidigung</b> von der Grundlinie aus steht für Dich im Mittelpunkt. Schläger mit einer guten <b>Kontrolle</b> helfen dir bei der Platzierung genauer Bälle, während eine hohe <b>Stabilität</b> hilft, auch schnelle Angriffsbälle zurückzuspielen. In der Regel stehst Du weiter hinten: <b>Volleys</b> sind daher eher eine zweitrangige Anforderung an deinen Schläger." },
      en: { name: "Solid Baseliner", desc: "A solid <b>balance between offense and defense</b> from the baseline is the heart of your game. Rackets with great <b>control</b> help you place precise shots, while high <b>stability</b> allows you to return even the fastest attacking balls. Since you typically play from deep in the court, <b>volleys</b> are a secondary requirement for your racket." }
    },
    CounterPuncher: {
      iconPath: "/assets/icons/shield.svg",
      de: { name: "Counter Puncher", desc: "Du fühlst Dich in der <b>Defensive wohl</b>. Eine hohe <b>Stabilität</b> hilft Dir, auch schnelle Angriffsbälle sicher zurückzuspielen, während Dir ein Schläger mit gutem <b>Slice</b> die nötige Zeit verschafft, wieder in die Ausgangsposition zu kommen. Da Du die Kraft des Gegners nutzt, ist zusätzliche <b>Power</b> aus Deinem Schläger weniger wichtig. " },
      en: { name: "Counter Puncher", desc: "You feel comfortable playing <b>defense</b>. High <b>stability</b> helps you return even the fastest attacking shots, while a racket with great <b>slice</b> potential gives you the time you need to recover your position. Since you use your opponent's pace, <b>power</b> from your racket is less of a priority. " }
    }
  };

  const styleScores = {};
  const BASE_CALC = 50; 
  Object.keys(playStyles).forEach(style => {
    const raw = userProfile[style] ?? BASE_CALC; 
    const score = Math.round(((raw - BASE_CALC) / BASE_CALC) * 16);
    styleScores[style] = score;
  });

  const sortedStyles = Object.entries(styleScores)
    .map(([name, score]) => ({ name, score }))
    .sort((a, b) => b.score - a.score);
  
  const bestStyleKey = sortedStyles[0].name;
  const bestStyle = playStyles[bestStyleKey];

  // 1. EINLEITUNG (Farbe #444 wie in Mode Selection)
  const introText = lang === "de" 
    ? "Auf Basis Deiner Antworten haben wir folgendes Spielprofil gematched:" 
    : "Based on your answers, we have matched the following player profile:";
  const introHtml = `<p style="color:#444; margin:0 0 15px 0; line-height:1.4;">${introText}</p>`;

  // Hilfsfunktion für Icon + Name Zeile
  const renderLine = (path, name) => `
    <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
      <img src="${path}" style="width:22px; height:22px; object-fit:contain;" onerror="this.style.display='none'">
      <span style="font-weight:700; font-size:1.15rem;">${name}</span>
    </div>`;

  // 2. HYBRID LOGIK
  if (sortedStyles.length > 1) {
    const secondKey = sortedStyles[1].name;
    const secondStyle = playStyles[secondKey];
    if (sortedStyles[0].score - sortedStyles[1].score <= 3 && sortedStyles[0].score >= 0 && sortedStyles[1].score >= 0) {
      
      return `
        ${introHtml}
        <div style="margin-bottom:20px;">
          <div style="font-size:0.85rem; font-weight:800; text-transform:uppercase; color:#999; margin-bottom:8px; letter-spacing:0.5px;">Hybrid</div>
          ${renderLine(bestStyle.iconPath, bestStyle[lang].name)}
          ${renderLine(secondStyle.iconPath, secondStyle[lang].name)}
        </div>
        <div style="color:#444; line-height:1.5;">
          <p style="margin-bottom:15px;"><b>${bestStyle[lang].name}</b>: ${bestStyle[lang].desc}</p>
          <p><b>${secondStyle[lang].name}</b>: ${secondStyle[lang].desc}</p>
        </div>`;
    }
  }

  // 3. SINGLE STYLE LOGIK
  return `
    ${introHtml}
    <div style="margin-bottom:15px;">
      ${renderLine(bestStyle.iconPath, bestStyle[lang].name)}
    </div>
    <div style="color:#444; line-height:1.5;">${bestStyle[lang].desc}</div>`;
}
// === Zurück-Button ===
function createBackButton() {
  const existing = document.getElementById("back-button");
  if (existing) return;
  const btn = document.createElement("div");
  btn.id = "back-button";
  btn.innerHTML = "&#8617";
  Object.assign(btn.style, {
    position: "fixed",
    left: "8px",
    top: "50%",
    transform: "translateY(-50%)",
    width: "38px",
    height: "38px",
    background: "rgba(255,255,255,1)",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "1.2rem",
    fontWeight: "bold",
    cursor: "pointer",
    userSelect: "none",
    zIndex: "1000",
    backdropFilter: "blur(4px)",
    boxShadow: "0 2px 6px rgba(0,0,0,0.2)"
  });
  btn.onclick = () => goBack();
  document.body.appendChild(btn);
}

function goBack() {
  if (currentQuestion > 0) {
    currentQuestion--;
    showQuestion();
  }
}

// === Sprachumschaltung ===
function attachLangSwitchHandlers() {
  const en = document.getElementById("lang-en");
  const de = document.getElementById("lang-de");

  if (en) en.onclick = () => switchLang("en");
  if (de) de.onclick = () => switchLang("de");

  const langSwitch = document.getElementById("lang-switch");
  if (langSwitch && !en && !de) {
    const btns = langSwitch.getElementsByTagName("button");
    for (const b of btns) {
      if (/en/i.test(b.innerText)) b.onclick = () => switchLang("en");
      if (/de/i.test(b.innerText)) b.onclick = () => switchLang("de");
    }
  }
}

function switchLang(newLang) {
  lang = newLang;
  localStorage.setItem("language", newLang);
  currentQuestion = 0;
  // Profil resetten und neu initialisieren mit den bereits berechneten Averages
  initializeUserProfile(); 
  showQuestion();
  renderProgress();
}

// === Impressum Hook ===
function createImpressumHook() {
  const footer = document.getElementById("footer-island");
  if (!footer) return;
  if (document.getElementById("impressum-anchor")) return;
  const a = document.createElement("a");
  a.id = "impressum-anchor";
  a.href = "impressum.html";
  a.target = "_blank";
  a.innerText = lang === "de" ? "Impressum" : "Imprint";
  a.style.textDecoration = "none";
  a.style.color = "inherit";
  footer.appendChild(a);
}

// === Quiz neu starten ===
function restartQuiz() {
  const overlay = document.getElementById("overlay");
  if (overlay) overlay.remove();
  const rf = document.getElementById("restart-floating");
  if (rf) rf.remove();
  currentQuestion = 0;
  // Profil resetten und mit Averages neu füllen
  initializeUserProfile();
  selectedRacketIndex = 0;
  showQuestion();
  renderProgress();
}

//Radar-Chart-Design
function renderRadarChart(profile) {
  const canvas = document.getElementById('playingStyleChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const labels = ["Big Server", ["Serve &", "Volley"], "All-Court", ["Attacking", "Baseliner"], ["Solid", "Baseliner"], ["Counter", "Puncher"]];
  const activeLang = (typeof lang !== 'undefined' && lang === 'en') ? 'en' : 'de';
  
  const descriptions = {
    de: ["Fokussiert auf Asse und kurze Punkte mit hartem Aufschlag.", "Rückt ständig ans Netz vor, um Punkte schnell zu beenden.", "In allen Bereichen sicher, passt sich jeder Situation an.", "Diktiert Ballwechsel mit aggressiven Schlägen.", "Konstant, macht sehr wenige unforced errors.", "Exzellente Defensive, lebt vom Tempo des Gegners."],
    en: ["Focuses on aces and short points with a powerful serve.", "Rushes the net to finish points quickly.", "Comfortable from all areas, adapts to every situation.", "Dictates points with aggressive groundstrokes.", "Consistent, rarely makes unforced errors.", "Excellent defense, lives on the opponent's pace."]
  };

  const dataValues = [profile.TheBigServer || 0, profile.ServeAndVolleyer || 0, profile.AllCourtPlayer || 0, profile.AttackingBaseliner || 0, profile.SolidBaseliner || 0, profile.CounterPuncher || 0];

  if (window.myRadarChart instanceof Chart) { window.myRadarChart.destroy(); }

  function splitText(text, maxLen) {
    const words = text.split(' ');
    let lines = [], currentLine = "";
    words.forEach(word => {
      if ((currentLine + word).length > maxLen) { lines.push(currentLine.trim()); currentLine = word + " "; }
      else { currentLine += word + " "; }
    });
    lines.push(currentLine.trim());
    return lines;
  }

  // SCHNELLES PLUGIN (Deine funktionierende Desktop-Version)
  const labelHoverPlugin = {
    id: 'labelHoverPlugin',
    afterEvent(chart, args) {
      const {event} = args;
      if (event.type !== 'mousemove' && event.type !== 'touchstart' && event.type !== 'click') return;
      
      const scale = chart.scales.r;
      let hoveredIndex = -1;
      
      if (scale._pointLabelItems) {
        for (let i = 0; i < scale._pointLabelItems.length; i++) {
          const item = scale._pointLabelItems[i];
          if (event.x >= item.left - 15 && event.x <= item.right + 15 && event.y >= item.top - 15 && event.y <= item.bottom + 15) {
            hoveredIndex = i;
            break; 
          }
        }
      }

      const currentActive = chart.tooltip.getActiveElements();
      const newActiveId = hoveredIndex !== -1 ? hoveredIndex : null;
      const oldActiveId = currentActive.length > 0 ? currentActive[0].index : null;

      if (newActiveId !== oldActiveId) {
        if (hoveredIndex !== -1) {
          chart.tooltip.setActiveElements([{ datasetIndex: 0, index: hoveredIndex }], {x: event.x, y: event.y});
        } else {
          chart.tooltip.setActiveElements([], {x: event.x, y: event.y});
        }
        chart.update('none'); 
      }
    }
  };

  window.myRadarChart = new Chart(ctx, {
    type: 'radar',
    plugins: [labelHoverPlugin],
    data: {
      labels: labels,
      datasets: [{
        data: dataValues,
        backgroundColor: 'rgba(54, 162, 235, 0.2)', 
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 2,
        pointRadius: 5,
        pointHitRadius: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: {
        mode: 'none'
      },
      scales: {
        r: {
          min: 0, max: 100,
          ticks: { display: false },
          pointLabels: {
            display: true,
            padding: 20,
            font: { size: window.innerWidth < 500 ? 11 : 13, weight: 'bold' }
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          displayColors: false,
          animation: { duration: 0 },
          callbacks: {
            title: (items) => {
               const l = labels[items[0].dataIndex];
               return Array.isArray(l) ? l.join(' ') : l;
            },
            label: (context) => {
              const fullText = descriptions[activeLang][context.dataIndex];
              return [context.raw.toFixed(1) + "%", ...splitText(fullText, 25)]; 
            }
          }
        }
      }
    }
  });
}
// === Init ===
loadData();




























































