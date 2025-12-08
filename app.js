// app.js (vanilla JS) - ERSETZT die bestehende app.js

let currentQuestion = 0;
let userProfile = {};
let questions = {};
let rackets = [];
let lang = localStorage.getItem("language") || getLanguage();
// NEU: BASE_SCORE ist der neutrale Startpunkt (50/100) für Spielstile
// und der Fallback für Racket-Kategorien, falls der Durchschnitt nicht berechnet werden kann.
const BASE_SCORE = 50; 
const SCALE_FACTOR = 5;
let matchMode = "strength"; // "strength" oder "weakness"
let selectedRacketIndex = 0;
let racketAverages = {}; // NEU: Speichert die durchschnittlichen Racket-Werte (0-100 intern)

// === Sprache automatisch erkennen ===
function getLanguage() {
  const navLang = navigator.language || navigator.userLanguage || "de";
  return navLang.startsWith("de") ? "de" : "en";
}

// === Sprachwechsel behandeln ===
function switchLang(newLang) {
  lang = newLang;
  localStorage.setItem("language", newLang);
  // Optional: userProfile beibehalten oder resetten, hier reset für klare Neuanalyse
  currentQuestion = 0;
  userProfile = {};
  showQuestion();
  renderProgress();
  createImpressumHook(); // Update Imprint link text
}

// === Impressum Hook (footer-island) ===
function createImpressumHook() {
  const footer = document.getElementById("footer-island");
  if (!footer) return;
  
  // Entferne alten Anker, falls vorhanden
  const existing = document.getElementById("impressum-anchor");
  if (existing) existing.remove();

  const a = document.createElement("a");
  a.id = "impressum-anchor";
  a.href = "impressum.html";
  a.target = "_blank";
  a.innerText = lang === "de" ? "Impressum" : "Imprint";
  a.className = "text-xs text-gray-400 hover:underline transition-colors duration-200";
  footer.appendChild(a);
}

// === Language Switch Handler (muss an die Buttons im HTML binden) ===
function attachLangSwitchHandlers() {
    const langSwitch = document.getElementById("lang-switch");
    if (!langSwitch) return;

    const btns = langSwitch.getElementsByTagName("button");
    for (const b of btns) {
      if (/en/i.test(b.innerText)) b.onclick = () => switchLang("en");
      if (/de/i.test(b.innerText)) b.onclick = () => switchLang("de");
    }
}

// === App neu starten / Zustand resetten ===
function restartQuiz() {
    currentQuestion = 0;
    userProfile = {};
    localStorage.removeItem("userProfile");
    const existing = document.getElementById("overlay");
    if (existing) existing.remove();
    const floating = document.getElementById("restart-floating");
    if (floating) floating.remove();
    showQuestion();
    renderProgress();
    // Stelle sicher, dass der Zurück-Button ausgeblendet wird
    createBackButton();
}

// === Durchschnittliche Racket-Werte berechnen (Basis für den Start-Score) ===
function calculateRacketAverages(rackets) {
    const averages = {};
    const count = {};
    // Kategorien, die in rackets.json existieren und den Basis-Score bestimmen
    const categories = [
        "Groundstrokes", "Volleys", "Serves", "Returns", "Power", "Control",
        "Maneuverability", "Stability", "Comfort", "Touch / Feel", "Topspin", "Slice"
    ];

    if (!rackets || rackets.length === 0) {
        // Fallback, wenn keine Rackets geladen wurden
        categories.forEach(cat => {
            averages[cat] = BASE_SCORE; // 50 (neutral) als Fallback
        });
        return averages;
    }

    // Initialisiere Summen und Zähler
    categories.forEach(cat => {
        averages[cat] = 0;
        count[cat] = 0;
    });

    // Summiere alle Werte
    rackets.forEach(racket => {
        categories.forEach(cat => {
            const val = racket.stats[cat];
            if (typeof val === 'number') {
                averages[cat] += val; // Werte sind 0-10
                count[cat]++;
            }
        });
    });

    // Berechne den Durchschnitt und konvertiere auf die interne 0-100 Skala
    categories.forEach(cat => {
        if (count[cat] > 0) {
            // Durchschnitt (0-10) * 10 = Interne Skala (0-100)
            averages[cat] = (averages[cat] / count[cat]) * 10;
        } else {
            // Wenn Kategorie fehlt, nutze den neutralen Score
            averages[cat] = BASE_SCORE;
        }
    });

    return averages;
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
    racketAverages = calculateRacketAverages(rackets); // NEU: Durchschnittswerte berechnen

    const brandEl = document.getElementById("brand");
    if (brandEl) {
      // Branding-Text setzen
      brandEl.innerHTML = `<b>WhichRacket.com</b>`;
      brandEl.style.textDecoration = "none";
      brandEl.style.cursor = "pointer";

      // Klick auf Branding-Insel -> Quiz neu starten
      brandEl.addEventListener("click", () => {
        restartQuiz();
      });
    }

    // Prüfe, ob das Profil im localStorage existiert, um den Startpunkt zu bestimmen
    const storedProfile = localStorage.getItem("userProfile");
    if (storedProfile) {
        userProfile = JSON.parse(storedProfile);
        // Bestimme, wo weitergemacht werden soll
        currentQuestion = Object.keys(questions[lang]).findIndex(
            (qKey, index) => !userProfile[qKey]
        );
        // Wenn currentQuestion -1 ist, wurden alle Fragen beantwortet
        if (currentQuestion === -1) {
            currentQuestion = Object.keys(questions[lang]).length;
        }
    }


    // Impressum verlinken (footer-island wenn vorhanden)
    createImpressumHook();

    showQuestion();
    renderProgress();
    createBackButton();
    attachLangSwitchHandlers();
    injectResponsiveStyles(); // Stellt sicher, dass CSS-Korrekturen angewendet werden
  } catch (err) {
    console.error("Fehler beim Laden:", err);
    const q = document.getElementById("question");
    if (q) q.innerText = "Fehler beim Laden 😕";
  }
}

// === Zurück-Button (oben links) erstellen/aktualisieren ===
function createBackButton() {
    const backBtn = document.getElementById("back-button");
    
    // Erstelle den Button, falls er noch nicht existiert (wird nur einmal gemacht)
    if (!backBtn) {
        const btn = document.createElement("button");
        btn.id = "back-button";
        btn.innerText = lang === "de" ? "Zurück" : "Back";
        btn.onclick = goBack;
        
        // Styling für den Button (muss zur CI passen)
        Object.assign(btn.style, {
            position: "absolute",
            top: "10px",
            left: "10px",
            zIndex: "100",
            background: "none",
            color: "#666",
            border: "none",
            padding: "8px 12px",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: "600",
            transition: "color 0.1s"
        });
        btn.onmouseover = () => btn.style.color = "#000";
        btn.onmouseout = () => btn.style.color = "#666";
        
        const qContainer = document.getElementById("quiz-container");
        if (qContainer) qContainer.appendChild(btn);

    }

    // Aktualisiere Text und Sichtbarkeit
    const currentBtn = document.getElementById("back-button");
    if (currentBtn) {
        currentBtn.innerText = lang === "de" ? "Zurück" : "Back";
        currentBtn.style.display = currentQuestion > 0 ? "block" : "none";
    }
}

// === Zurück zur vorherigen Frage ===
function goBack() {
    if (currentQuestion > 0) {
        currentQuestion--;
        // Die letzte Antwort aus userProfile entfernen
        const qKey = Object.keys(questions[lang])[currentQuestion];
        delete userProfile[qKey];
        
        // Neu-Berechnung des userProfile basierend auf den verbleibenden Antworten
        recalculateProfile();

        localStorage.setItem("userProfile", JSON.stringify(userProfile));
        
        showQuestion();
    }
}

// === Profil neu berechnen (nach "Zurück") ===
function recalculateProfile() {
    const oldProfile = { WeightPref: userProfile.WeightPref, HeadsizePref: userProfile.HeadsizePref };
    userProfile = {};
    // Präferenzen wiederherstellen
    if (oldProfile.WeightPref) userProfile.WeightPref = oldProfile.WeightPref;
    if (oldProfile.HeadsizePref) userProfile.HeadsizePref = oldProfile.HeadsizePref;

    // Alle gespeicherten Antworten erneut verarbeiten
    Object.values(questions[lang]).slice(0, currentQuestion).forEach(q => {
        const effects = q.answers[q.answerIndex].effects;
        if (effects) {
            handleEffects(effects);
        }
    });
}


// === Frage anzeigen ===
function showQuestion() {
  const qList = questions[lang];
  // WICHTIG: qList muss ein Array von Fragen sein, nicht das Objekt.
  const qArray = Object.values(qList);

  if (!qArray || qArray.length === 0) return;
  
  // Wenn Quiz beendet, Ergebnisse zeigen
  if (currentQuestion >= qArray.length) {
    showResults();
    return;
  }

  // Sicherstellen, dass der Zurück-Button im Quizmodus vorhanden und sichtbar ist
  createBackButton(); 
  
  const q = qArray[currentQuestion];
  const qEl = document.getElementById("question");
  
  // 💡 Hinzugefügt: Element für die Fragen-Nummer finden
  const qNumEl = document.getElementById("question-number"); 

  // 💡 Hinzugefügt: Fragen-Nummer setzen (z.B. "Frage 1:" oder "Question 1:")
  if (qNumEl) {
    qNumEl.textContent = `${lang === "de" ? "Frage" : "Question"} ${currentQuestion + 1}:`;
    // *** Hier die Größe anpassen (z.B. von 1.1rem auf 1.0rem oder 1.2rem) ***
    qNumEl.style.fontSize = "1.1rem"; 
    qNumEl.style.fontWeight = "bold"; // Und fett für mehr Kontrast
    // *** KORREKTUR für #question-number Margins ***
    qNumEl.style.margin = "0 0 8px 0"; // Oben, Rechts, Unten (8px), Links
  }
  
  if (qEl) qEl.innerText = q.q;
  // *** KORREKTUR für #question (h2) Margins ***
  if (qEl) qEl.style.margin = "0"; // Entfernt Standard-H2-Margins


  for (let i = 0; i < 4; i++) {
    const btn = document.getElementById(`a${i + 1}`);
    const answer = q.answers[i];
    if (!btn || !answer) continue;
    btn.innerText = answer.text;
    // Rücksetzen eventuell vorheriger inline-styles
    btn.style.opacity = "";
    const qKey = Object.keys(qList)[currentQuestion]; // Den korrekten Schlüssel für localStorage abrufen

    btn.onclick = () => {
        // Speichere die Antwort im userProfile
        userProfile[qKey] = {
            answerIndex: i, // Index der gewählten Antwort
            effects: answer.effects // Die zugehörigen Effekte
        };
        
        // Recalculate Profile to ensure all effects are applied correctly from start
        recalculateProfile(); 
        
        localStorage.setItem("userProfile", JSON.stringify(userProfile));
      
        // visuelles kurzes drücken (Option)
        btn.style.opacity = "0.95";
        setTimeout(() => {
          btn.style.opacity = "";
          currentQuestion++;
          showQuestion();
        }, 120);
    };
  }

  const pText = document.getElementById("progress-text");
  const totalQuestions = qArray.length;
  if (pText) {
    pText.innerText =
      lang === "de"
        ? `Frage ${currentQuestion + 1} von ${totalQuestions}`
        : `Question ${currentQuestion + 1} of ${totalQuestions}`;
  }

  renderProgress();
  // Stelle sicher, dass der Zurück-Button sichtbar ist, wenn nicht Frage 1
  createBackButton(); 
}

// === Fortschrittsanzeige ===
function renderProgress() {
  const bar = document.getElementById("progress-bar");
  const qArray = Object.values(questions[lang]) || [];
  if (!bar) return;
  bar.innerHTML = "";
  for (let i = 0; i < qArray.length; i++) {
    const span = document.createElement("span");
    if (i < currentQuestion) span.classList.add("active");
    if (i === currentQuestion) span.style.background = "#000";
    bar.appendChild(span);
  }
}

// === Effekte verarbeiten (Speichern im userProfile) ===
function handleEffects(effects) {
  if (!effects) return;
  // Effekte können normale Kategorien (Power etc.) oder Präferenzen WeightMin/Max etc. sein
  for (const [key, val] of Object.entries(effects)) {
    // Wenn es sich um WeightMin/Max oder HeadsizeMin/Max handelt, speichern wir als Pref-Objekt
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

    // Normale Kategorien: wir addieren mit BASE_SCORE / SCALE_FACTOR (intern 0-100)
    
    // NEU: Basis-Score definieren. Für Racket-Kats den Durchschnitt, sonst 50.
    let initialScore;
    if (racketAverages[key] !== undefined) {
        initialScore = racketAverages[key];
    } else {
        initialScore = BASE_SCORE; // Für Spielstile (TheBigServer etc.) bleibt es 50
    }

    // ACHTUNG: userProfile[key] ist der akkumulierte Wert. Wenn er null ist, den initialScore nehmen.
    userProfile[key] = (userProfile[key] ?? initialScore) + (val * SCALE_FACTOR);
    userProfile[key] = Math.max(0, Math.min(100, userProfile[key]));
  }
}

// === Ergebnisse anzeigen (Overlay) ===
function showResults() {
  // entfernen, falls bereits vorhanden
  const existing = document.getElementById("overlay");
  if (existing) existing.remove();

  // hide back button
  const backBtn = document.getElementById("back-button");
  if (backBtn) backBtn.style.display = "none";

  // overlay container
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
    alignItems: "center",
    justifyContent: "center",
    padding: "30px",
    zIndex: "3000",
    overflowY: "auto",
    boxSizing: "border-box"
  });

  // Spielerprofil normalisieren auf 0-10 (mit 1 Dezimalstelle)
  const normalizedProfile = {};
  const categories = [
    "Groundstrokes","Volleys","Serves","Returns","Power","Control",
    "Maneuverability","Stability","Comfort","Touch / Feel","Topspin","Slice",
    // Spielstil-Kategorien hinzufügen (intern 0-100)
    "TheBigServer", "ServeAndVolleyer", "AllCourtPlayer", "AttackingBaseliner", "SolidBaseliner", "CounterPuncher"
  ];
  categories.forEach(cat => {
    const raw = userProfile[cat] ?? null;
    if (raw === null) normalizedProfile[cat] = 0;
    else {
        // nur die Performance/Racket-Kats auf 0-10 normalisieren
        if (["Groundstrokes","Volleys","Serves","Returns","Power","Control","Maneuverability","Stability","Comfort","Touch / Feel","Topspin","Slice"].includes(cat)) {
            normalizedProfile[cat] = Math.round((raw / 10) * 10) / 10;
        } else {
            // Spielstil-Kats bleiben intern 0-100 für die neue Logik
            normalizedProfile[cat] = raw;
        }
    }
  });

  // Extra: bring WeightPref/HeadsizePref in normalizedProfile for matching usage
  if (userProfile.WeightPref) normalizedProfile.WeightPref = userProfile.WeightPref;
  if (userProfile.HeadsizePref) normalizedProfile.HeadsizePref = userProfile.HeadsizePref;

  const topResult = getTopRackets(normalizedProfile, matchMode);
  const bestRackets = topResult.bestRackets;
  const best = bestRackets[0] || rackets[0];
  selectedRacketIndex = 0;

  // Inhalt card
  const card = document.createElement("div");
  Object.assign(card.style, {
    width: "min(1200px, 98%)",
    borderRadius: "16px",
    background: "#fff",
    padding: "22px",
    boxSizing: "border-box",
    boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
    maxHeight: "90vh",
    overflowY: "auto"
  });

  // 1. Überschrift "Your Game" (Spielstil)
  const styleTitle = document.createElement("h3");
  const styleTitleText = "Dein Spielstil"; // Deutsche Übersetzung
  styleTitle.innerText = styleTitleText;
  Object.assign(styleTitle.style, {
    margin: "0 0 12px 0",
    fontSize: "1.6rem", // VERGRÖSSERT
    fontStyle: "italic",
    fontWeight: "700"
  });
  card.appendChild(styleTitle);

  // 2. Spielstil Box (an den Anfang verschoben, ohne eigene Überschrift)
  const styleDesc = getPlayStyleDescription(normalizedProfile);
  const styleDiv = document.createElement("div");
  Object.assign(styleDiv.style, {
      margin: "0 0 18px 0",
      padding: "16px",  
      borderRadius: "12px",
      border: "1px solid #ddd",  
      background: "#f9f9f9",
      boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
  });
  // Nur der Inhalt, die Überschrift ist separat
  styleDiv.innerHTML = `<div style="font-size:1.0rem;">${styleDesc}</div>`;
  card.appendChild(styleDiv);

  // 3. Neue Überschrift "YourRacket"
  const racketTitle = document.createElement("h3");
  const racketTitleText = "Dein Schläger"; // Deutsche Übersetzung
  racketTitle.innerText = racketTitleText;
  // Größe und Kursiv wie Your Game
  Object.assign(racketTitle.style, {
    margin: "24px 0 12px 0",
    fontSize: "1.6rem", // VERGRÖSSERT
    fontStyle: "italic",  
    fontWeight: "700"
  });
  card.appendChild(racketTitle);

  // 4. Mode Selection Text + Buttons (Unter "YourRacket" verschoben)
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
  // Leerzeichen-Korrektur
  modeLeft.innerHTML = `<p style="margin:0; color:#444;">${lang === "de" ? "Möchtest du " : "Would you like to "}<span style="font-weight:700; color:#2ea44f;">${lang === "de" ? "Deine Stärken ausbauen" : "enhance strengths"}</span>${lang === "de" ? " oder " : " or "}<span style="font-weight:700; color:#c92a2a;">${lang === "de" ? "Schwächen ausgleichen" : "balance weaknesses"}</span>?</p>`;

  const modeRight = document.createElement("div");
  modeRight.style.display = "flex";
  modeRight.style.gap = "10px";
  modeRight.style.alignItems = "center";

  const btnStrength = document.createElement("button");
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


  // 5. horizontal row with top3 cards
  const topRow = document.createElement("div");
  topRow.id = "racket-cards-container"; // ID für das Highlighting
  Object.assign(topRow.style, {
    display: "flex",
    gap: "14px",
    justifyContent: "space-between",
    flexWrap: "wrap",
    marginTop: "0px", // Abstand wird durch modeSelectionWrap geregelt
    marginBottom: "18px",
    // Rahmen für die gesamte Reihe
    padding: "18px", // *** ANGEPASST: Erhöht für besseren Abstand zum Rand ***
    borderRadius: "14px",
  });

  const makeRacketCard = (r, idx) => {
    const div = document.createElement("div");
    Object.assign(div.style, {
      flex: "1 1 30%",
      minWidth: "220px",
      maxWidth: "360px",
      borderRadius: "12px",
      padding: "12px",
      boxSizing: "border-box",
      // Initialer Rahmen (wird durch highlightSelectedRacket überschrieben)
      border: "1px solid #ddd",  
      background: "#fff",  
      cursor: "pointer",
      // Hinzufügen eines einfachen Übergangs für das Highlighting
      transition: "border 0.2s, box-shadow 0.2s"  
    });
    div.dataset.index = idx;
    div.onclick = () => updateRacketDisplay(idx);

    const img = document.createElement("img");
    img.src = r.img;
    img.alt = r.name;
    // Bildgröße und Zentrierung (reduziert)
    Object.assign(img.style, {  
      width: "50%",  
      borderRadius: "8px",  
      display: "block",  
      marginBottom: "8px",
      margin: "0 auto 8px auto",
      // Hinzugefügt, um sicherzustellen, dass kein weißer Rand sichtbar ist
      border: "1px solid transparent"
    });

    const h = document.createElement("div");
    h.innerText = r.name;
    h.style.fontWeight = "800";
    h.style.marginBottom = "6px";

    const link = document.createElement("a");
    link.href = r.url;
    link.target = "_blank";
    link.innerText = lang === "de" ? "Mehr erfahren" : "Learn more";
    link.style.fontSize = "0.9rem";
    link.style.color = "#0066cc";
    link.style.textDecoration = "none";

    const tech = document.createElement("div");
    tech.style.marginTop = "8px";
    tech.style.fontSize = "0.9rem";
    tech.innerHTML = `
      ${r.stats.Weight !== undefined ? `<div>Gewicht: ${r.stats.Weight} g</div>` : ""}
      ${r.stats.Headsize !== undefined ? `<div>Headsize: ${r.stats.Headsize} cm²</div>` : ""}
    `;

    div.appendChild(img);
    div.appendChild(h);
    div.appendChild(link);
    div.appendChild(tech);

    return div;
  };

  // add top 3 (or fewer)
  bestRackets.forEach((r, i) => {
    topRow.appendChild(makeRacketCard(r, i));
  });
  card.appendChild(topRow);


  // 6. Profilvergleich Tabelle
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
  // Wichtig: Für die Tabelle nur die 0-10 Werte nutzen, nicht die 0-100 Spielstilwerte
  const profileForTable = {};
  Object.entries(normalizedProfile).forEach(([key, val]) => {
      if (typeof val === 'number' && val <= 10.00001) { // 0-10 Werte
          profileForTable[key] = val;
      }
      if (key.endsWith("Pref")) { // Præferenzen
          profileForTable[key] = val;
      }
  });
  tbody.innerHTML = buildProfileTableRows(profileForTable, best.stats);
  table.appendChild(tbody);
  tableWrap.appendChild(table);
  card.appendChild(tableWrap);

  // großer Restart Button (zentral)
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

  // floating left restart (bigger)
  createRestartFloatingButton();

  // DYNAMISCHE OUTLINE FÜR DEN MATCH MODE
  highlightMatchMode();  
  
  // make sure first racket highlighted
  highlightSelectedRacket(0);
  injectResponsiveStyles();
}

// *** AKTUALISIERT: Entfernt Outline, nutzt starken Border und Box-Shadow ***
function highlightMatchMode() {
  const topRow = document.getElementById("racket-cards-container");
  if (!topRow) return;

  // Farbe des Modus: Grün für Stärke, Rot für Schwäche
  const color = matchMode === "strength" ? "#2ea44f" : "#c92a2a";

  // 1. Outline komplett entfernen
  topRow.style.outline = "none";
  topRow.style.outlineOffset = "0"; 

  // 2. Sichtbaren Rand (Border) des Containers verstärken
  topRow.style.border = `3px solid ${color}`; // Jetzt 3px Border in Farbe

  // 3. Box-Shadow für den "Popp"-Effekt verstärken
  // Wert: Horizontaler Versatz, Vertikaler Versatz, Weichheit, Ausbreitung, Farbe mit Alpha
  topRow.style.boxShadow = `0 0 16px 2px ${color}80`; // Größerer, leuchtender Schatten

  // Um die innere Auswahl beizubehalten, muss sichergestellt werden,
  // dass highlightSelectedRacket danach oder in updateRacketDisplay aufgerufen wird.
  highlightSelectedRacket(selectedRacketIndex);
}


// === Profilvergleich-Zeilenaufbau ===
function buildProfileTableRows(player, racketStats) {
  const order = [
    "Groundstrokes",
    "Volleys",
    "Serves",
    "Returns",
    "Power",
    "Control",
    "Maneuverability",
    "Stability",
    "Comfort",
    "Touch / Feel",
    "Topspin",
    "Slice"
  ];
  // Deutsche Übersetzungen für die Tabelle
  const translations = {
      Groundstrokes: "Grundschläge",
      Volleys: "Volleys",
      Serves: "Aufschläge",
      Returns: "Rückschläge",
      Power: "Power",
      Control: "Kontrolle",
      Maneuverability: "Manövrierbarkeit",
      Stability: "Stabilität",
      Comfort: "Komfort",
      "Touch / Feel": "Touch / Gefühl",
      Topspin: "Topspin",
      Slice: "Slice"
  };
  
  return order.map((key, idx) => {
    const pVal = (player[key] ?? 0).toFixed(1);
    const rVal = racketStats[key];
    const bg = idx % 2 === 0 ? "#ffffff" : "#f6f6f6";
    // Verwende die deutsche Übersetzung
    const displayKey = translations[key] || key; 
    return `<tr style="background:${bg}"><td style="padding:10px 12px; text-align:left;">${displayKey}</td><td style="padding:10px 12px; text-align:center;">${pVal}</td><td style="padding:10px 12px; text-align:center;">${(typeof rVal === 'number') ? rVal.toFixed(1) : '-'}</td></tr>`;
  }).join("");
}

// === Update Anzeige wenn man eines der Top-3 auswählt ===
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
  // scroll to top of overlay for convenience
  const overlay = document.getElementById("overlay");
  if (overlay) overlay.scrollTop = 0;
}

// === Highlighting der ausgewählten Schläger (Top-1/2/3) ===
function highlightSelectedRacket(index) {
  const overlay = document.getElementById("overlay");
  if (!overlay) return;
  const cards = overlay.querySelectorAll("div[data-index]");
  cards.forEach(c => {
    const idx = parseInt(c.dataset.index, 10);
    // Basisfarbe für den Match-Modus
    const modeColor = matchMode === "strength" ? "#2ea44f" : "#c92a2a";

    if (idx === index) {
      // Aktive Karte: Dicker schwarzer Rahmen
      c.style.background = "#fff";  
      c.style.border = "3px solid #111"; // Dickerer dunkler Rahmen
      c.style.boxShadow = "0 6px 18px rgba(0,0,0,0.1)"; // Etwas stärkerer Schatten
    } else {
      // Nicht aktive Karte: Rahmen in Modus-Farbe
      c.style.background = "#fff";
      c.style.border = `1px solid ${modeColor}`; // Dünner Rahmen in Modusfarbe
      c.style.boxShadow = "0 1px 4px rgba(0,0,0,0.05)"; // Dezenter Schatten
    }
  });
}

// === Restart Floating Button (links mittig) ===
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

// === Overlay neu aufbauen ===
function refreshOverlay() {
  const overlay = document.getElementById("overlay");
  if (overlay) overlay.remove();
  showResults();
}

// === Styles injection für responsive behavior (kleine Ergänzungen) ===
function injectResponsiveStyles() {
  if (document.getElementById("appjs-responsive-styles")) return;
  const s = document.createElement("style");
  s.id = "appjs-responsive-styles";
  s.textContent = `
    /* KORREKTUR A: Flexbox-Zentrierung des gesamten Quiz (ersetzt absolute Positionierung) */
    body {
        display: flex !important;
        justify-content: center !important; /* Horizontale Zentrierung */
        align-items: center !important; /* Vertikale Zentrierung */
        min-height: 100vh !important;
        flex-direction: column !important;  
        padding: 0;
        margin: 0;
        overflow: auto !important;
    }

    /* KORREKTUR B: Flexbox-Einstellungen für den Haupt-Quiz-Container */
    #quiz-container {
        display: flex !important;  
        flex-direction: column !important;
        min-height: auto !important;
        margin: 0;
        padding: 0;
        /* Die anderen Styles wie width, height etc. werden von styles.css übernommen */
    }

    /* KORREKTUR C: ÜBERSCHREIBT ABSOLUTE POSITIONIERUNG auf #question-container */
    #question-container {
        /* Diese Regeln verhindern das Springen, indem sie die Zentrierung in styles.css überschreiben */
        position: relative !important;  
        top: auto !important;
        left: auto !important;
        transform: none !important; /* Entfernt die Verschiebung, die das Springen verursacht */
        
        min-height: 250px !important; /* Feste Mindesthöhe des Inhaltsblocks */
        display: flex !important;
        flex-direction: column !important;
        justify-content: flex-start;
        margin: 0 auto !important; /* Zentriert horizontal in der Mitte von #quiz-container */
        /* Behält 20px oben/unten Padding und 40px links/rechts bei */
        padding: 20px 40px 20px 40px !important;  
        width: 60% !important;  
    }

    /* KORREKTUR D: Fragetext nimmt den gesamten verbleibenden Raum ein */
    #question {
      min-height: 120px !important;  
      flex-grow: 1 !important; /* Zwingt das Element, den Raum auszufüllen */
      display: flex !important;  
      align-items: center !important;  
      justify-content: center !important;
      text-align: center;
      margin: 0 !important;  
      padding: 0 !important;
    }
    
    /* KORREKTUR E: Progress-Bar fix 20px unter der Frage */
    #progress-container {
    margin-top: 20px !important;
    padding-bottom: 20px !important;
    position: relative !important;
    }

    /* Wichtig: Sicherstellen, dass die Frage-Nummerierung keine unnötigen Abstände hat */
    #question-number {
        margin: 0 0 8px 0 !important;
        padding: 0 !important;
    }
    
    /* Fortschrittsanzeige */
    #progress-container {
        flex-grow: 0 !important;  
        flex-shrink: 0 !important;
        margin-top: 10px !important;
    }

    @media (max-width: 768px) {
        /* Mobile Korrekturen */
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

// === Matching-Logik ===
// Liefert Top 3 Rackets; bei mode "weakness" wird für Spielerwerte < 6.5
// die Differenz so berechnet, dass hohe Racket-Werte in dieser Kategorie belohnt werden.
// Tech specs (Weight, Headsize) werden stärker bewertet (Bonus/Malus).
function getTopRackets(profile, mode) {
  const scores = rackets.map(r => {
    let diff = 0;
    // nur die standardkategorien vergleichen
    const cats = [
      "Groundstrokes","Volleys","Serves","Returns","Power","Control",
      "Maneuverability","Stability","Comfort","Touch / Feel","Topspin","Slice"
    ];
    cats.forEach(cat => {
      const p = profile[cat] ?? 0;
      const rv = r.stats[cat] ?? 0;
      if (mode === "weakness" && p < 6.5) {
        // wir wollen Rackets mit möglichst hohem rv -> kleinere diff wenn rv hoch
        // diff addieren so, dass geringer ist bei hohem rv
        diff += Math.abs(10 - rv); // je näher rv an 10, desto kleiner
      } else {
        // normaler Modus: einfache absolute Differenz
        diff += Math.abs(p - rv);
      }
    });

    // Tech spec: Gewicht (falls Pref gesetzt)
    if (r.stats.Weight !== undefined && profile.WeightPref !== undefined) {
      const pref = profile.WeightPref;
      const w = r.stats.Weight;
      const mid = ((pref.min ?? pref.max ?? w) + (pref.max ?? pref.min ?? w)) / 2;
      // Bonus, wenn innerhalb der Präferenzbereich liegt
      if ((pref.min === undefined || w >= pref.min) && (pref.max === undefined || w <= pref.max)) {
        diff -= 3; // belohnen
      } else {
        // sonst Penalty proportional zur Distanz (geringer skalenfaktor)
        diff += Math.abs(w - mid) / 30;
      }
    }

    // Tech spec: Headsize
    if (r.stats.Headsize !== undefined && profile.HeadsizePref !== undefined) {
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

// === Spielstilbeschreibung (NEUE Logik) ===
function getPlayStyleDescription(profile) {
  // Neue Kategorien und ihre deutschen/englischen Beschreibungen
  const playStyles = {
    TheBigServer: {
      de: {
        name: "The Big Server",
        // ** durch <b> ersetzt (Spielstilname fett)
        desc: "Du bist ein Spieler mit einem <b>schnellen ersten Aufschlag</b>, der oft Punkte innerhalb seiner ersten zwei Schläge gewinnt (z.B. Asse, unreturnierte Aufschläge, Aufschlag-Plus-Eins-Winner)."
      },
      en: {
        name: "The Big Server",
        desc: "A player with a <b>fast first serve</b>, who will often win points within their first two shots (e.g. aces, unreturned serves, serve + one winners)."
      }
    },
    ServeAndVolleyer: {
      de: {
        name: "Serve and Volleyer",
        desc: "Du nutzt <b>Aufschlag und Volley als deine primäre Taktik</b>."
      },
      en: {
        name: "Serve and Volleyer",
        desc: "A player who uses <b>serve and volley as their primary tactic</b>."
      }
    },
    AllCourtPlayer: {
      de: {
        name: "All-Court Player",
        desc: "Du fühlst dich in <b>allen Bereichen des Platzes wohl</b> und nutzt deine Fähigkeit am Netz oft zu deinem Vorteil."
      },
      en: {
        name: "All-Court Player",
        desc: "A player who is <b>comfortable in all areas of the court</b>, and often utilises their ability at the net to their advantage."
      }
    },
      // Achtung: AttackingBaseliner, SolidBaseliner und CounterPuncher sind oft eng verwandt
    AttackingBaseliner: {
      de: {
        name: "Attacking Baseliner",
        desc: "Du versuchst, das Spiel von der Grundlinie aus zu <b>diktieren</b>."
      },
      en: {
        name: "Attacking Baseliner",
        desc: "A player who looks to <b>dictate play from the baseline</b>."
      }
    },
    SolidBaseliner: {
      de: {
        name: "Solid Baseliner",
        desc: "Du <b>balancierst Angriff und Verteidigung</b> von der Grundlinie aus."
      },
      en: {
        name: "Solid Baseliner",
        desc: "A player who <b>balances attacking and defending from the baseline</b>."
      }
    },
    CounterPuncher: {
      de: {
        name: "Counter Puncher",
        desc: "Du fühlst dich in der <b>Defensive wohl</b>. Du nutzt diese Fähigkeit, um deine Gegner zu frustrieren oder den Moment zu wählen, um die Verteidigung in einen Angriff umzuwandeln."
      },
      en: {
        name: "Counter Puncher",
        desc: "A player who is <b>comfortable playing in defence</b>. They use this ability to frustrate their opponent or choose their moment to turn defence into attack."
      }
      }
  };

  // Normalisierung: 0-100 intern -> -16 bis +16 extern (Basis 50/100 = 0)
  // -16 entspricht 0; +16 entspricht 100.
  // Formel: ((raw - 50) / 50) * 16
  const styleScores = {};
  Object.keys(playStyles).forEach(style => {
    const raw = profile[style] ?? BASE_SCORE; // userProfile hat 0-100
    // Umrechnung von 0-100 auf -16 bis +16. Math.round für ganze Zahlen.
    const score = Math.round(((raw - BASE_SCORE) / BASE_SCORE) * 16);
    styleScores[style] = score;
  });

  // Sortieren nach Score (absteigend)
  const sortedStyles = Object.entries(styleScores)
    .map(([name, score]) => ({ name, score }))
    .sort((a, b) => b.score - a.score);

  const bestStyle = sortedStyles[0];

  // Hybrid-Check: Sind die Top 2 nah beieinander (max. 3 Punkte Unterschied)?
  if (sortedStyles.length > 1) {
    const secondBest = sortedStyles[1];
    // Nur Hybrid, wenn beide einen positiven oder neutralen Score haben ( > 0 )
    if (bestStyle.score - secondBest.score <= 3 && bestStyle.score >= 0 && secondBest.score >= 0) {
        
        const style1 = playStyles[bestStyle.name][lang];
        const style2 = playStyles[secondBest.name][lang];
        
        // Formatierung angepasst, um "Hybrid: Name1 & Name2" und darunter die Beschreibungen zu zeigen
        const hybridName = lang === "de"
          ? `Hybrid: <strong>${style1.name}</strong> & <strong>${style2.name}</strong>`
          : `Hybrid: <strong>${style1.name}</strong> & <strong>${style2.name}</strong>`;
        
        const hybridDesc = lang === "de"
          // Zeilenumbruch und Abstand für die Beschreibung, Name fett
          ? `<span style="font-weight:700;">${style1.name}</span>: ${style1.desc}<br><br><span style="font-weight:700;">${style2.name}</span>: ${style2.desc}`
          : `<span style="font-weight:700;">${style1.name}</span>: ${style1.desc}<br><br><span style="font-weight:700;">${style2.name}</span>: ${style2.desc}`;

        return `
            <h4 style="font-size:1.15rem; margin:0 0 10px 0;">${hybridName}</h4>
            <div style="font-size:0.95rem; line-height: 1.4;">${hybridDesc}</div>
        `;
    }
  }

  // Normaler Fall (kein Hybrid oder nur ein klarer Stil)
  const styleInfo = playStyles[bestStyle.name][lang];
  return `
      <h4 style="font-size:1.15rem; margin:0 0 10px 0;"><strong>${styleInfo.name}</strong></h4>
      <div style="font-size:0.95rem; line-height: 1.4;">${styleInfo.desc}</div>
  `;
}


// Starte die App
loadData();
