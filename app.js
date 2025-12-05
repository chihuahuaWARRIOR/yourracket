// app.js (vanilla JS) - KOMPLETT ANGEPASST

let currentQuestion = 0;
let userProfile = {};
let questions = {};
let rackets = [];
let lang = localStorage.getItem("language") || getLanguage();
const BASE_SCORE = 50; // neutral (0-100 internal, 50 => 5.0)
const SCALE_FACTOR = 5;
let matchMode = "strength"; // "strength" oder "weakness"
let selectedRacketIndex = 0;
// Speicher für die Effekte der letzten Antworten, um sie bei "Zurück" zu revidieren
// Format: [{ questionIndex: 0, effects: { Power: 5, Control: -5 } }, ...]
let answerHistory = []; 


// === Sprache automatisch erkennen ===
function getLanguage() {
  const navLang = navigator.language || navigator.userLanguage || "de";
  return navLang.startsWith("de") ? "de" : "en";
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

    const brandEl = document.getElementById("brand");
    if (brandEl) {
      // Branding-Text setzen auf whichracket.com
      brandEl.innerHTML = `<b>whichracket.com</b>`;
      brandEl.style.textDecoration = "none";
      brandEl.style.cursor = "pointer";

      // Klick auf Branding-Insel -> Quiz neu starten
      brandEl.addEventListener("click", () => {
        restartQuiz();
      });
    }

    // Impressum verlinken (footer-island wenn vorhanden)
    createImpressumHook();

    showQuestion();
    // Die Funktion createBackButton() wurde entfernt, da der Button in index.html ist.
    attachLangSwitchHandlers();
  } catch (err) {
    console.error("Fehler beim Laden:", err);
    // Korrigiert: Nutzt jetzt die ID #question-text
    const q = document.getElementById("question-text"); 
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
  // NEU: Dynamische Frage-Nummer und Text
  const qNumberEl = document.getElementById("question-number"); 
  const qTextEl = document.getElementById("question-text"); 
  if (qNumberEl) {
        qNumberEl.innerText = lang === "de" ? `Frage ${currentQuestion + 1}:` : `Question ${currentQuestion + 1}:`;
  }
  if (qTextEl) qTextEl.innerText = q.q;

  // NEU: Zurück-Button steuern (Sichtbarkeit)
  const backButton = document.getElementById("back-button");
  if (backButton) {
    if (currentQuestion > 0) {
      backButton.style.display = 'block';
    } else {
      backButton.style.display = 'none';
    }
  }

  for (let i = 0; i < 4; i++) {
    const btn = document.getElementById(`a${i + 1}`);
    const answer = q.answers[i];
    if (!btn || !answer) continue;
    btn.innerText = answer.text;
    // Rücksetzen eventuell vorheriger inline-styles
    btn.style.opacity = "";
    btn.onclick = () => {
      // Antwort speichern (History) und Effekte anwenden
      answerHistory.push({ questionIndex: currentQuestion, effects: answer.effects });
      handleEffects(answer.effects);

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
    // Korrektur: Die aktive Klasse muss beim *Abschluss* der Frage hinzugefügt werden (i < currentQuestion)
    if (i < currentQuestion) span.classList.add("active");
    // Wenn wir an der aktuellen Frage sind
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
    userProfile[key] = (userProfile[key] ?? BASE_SCORE) + (val * SCALE_FACTOR);
    userProfile[key] = Math.max(0, Math.min(100, userProfile[key]));
  }
}

// === NEU: Logik zum Rückgängigmachen der Effekte ===
function undoLastAnswerEffects() {
    // 1. Hole den letzten Eintrag aus der History (aktuell ist currentQuestion - 1)
    const lastAnswer = answerHistory.pop();
    if (!lastAnswer) return;

    // 2. Wende die Effekte mit umgekehrten Vorzeichen an (subtrahiere, was addiert wurde)
    const effects = lastAnswer.effects;

    for (const [key, val] of Object.entries(effects)) {
        // Präferenzen (Weight/Headsize) müssen entfernt oder angepasst werden
        if (key === "WeightMin" || key === "WeightMax" || key === "HeadsizeMin" || key === "HeadsizeMax") {
            // Vereinfachte Logik: Bei komplexer Kaskade müssten wir die gesamte Historie neu berechnen.
            // Hier entfernen wir einfach die gesamte Präferenz, wenn wir zurückgehen, 
            // und lassen sie bei der nächsten Antwort neu setzen.
            if (key === "WeightMin" || key === "WeightMax") delete userProfile.WeightPref;
            if (key === "HeadsizeMin" || key === "HeadsizeMax") delete userProfile.HeadsizePref;
            continue;
        }

        // Normale Kategorien: umgekehrter Effekt
        if (userProfile[key] !== undefined) {
            userProfile[key] = userProfile[key] - (val * SCALE_FACTOR);
            // Sicherstellen, dass die Werte im 0-100 Bereich bleiben
            userProfile[key] = Math.max(0, Math.min(100, userProfile[key]));
        } else {
            // Wenn die Kategorie nicht existiert, aber ein negativer Effekt angewendet wurde, 
            // sollte sie auf BASE_SCORE zurückgesetzt werden.
            userProfile[key] = BASE_SCORE; 
        }
    }
}

// === NEU: goBack Funktion, die Score zurücksetzt und Frage anzeigt ===
function goBack() {
    if (currentQuestion > 0) {
        undoLastAnswerEffects();
        currentQuestion--;
        showQuestion();
    }
}

// === Ergebnisse anzeigen (Overlay) ===
// DIESER GROSSE BLOCK BLEIBT GRÖSSTENTEILS UNVERÄNDERT, 
// aber die Styles wurden für die Anpassung an das neue CSS vereinfacht
function showResults() {
    // Versteckt Quiz-Container und zeigt Result-Container, 
    // um die neuen Overlay-Styles zu nutzen (styles.css)

    const quizContainer = document.getElementById('quiz-container');
    const resultContainer = document.getElementById('result-container');
    if(quizContainer) quizContainer.classList.add('hidden');
    if(resultContainer) resultContainer.classList.add('active'); // Zeigt Result-Container an
    
    // Die restliche Overlay-Logik von showResults() muss jetzt die DOM-Elemente
    // im statischen #result-container (aus index.html) anpassen.

    // 1. Spielerprofil normalisieren auf 0-10 (mit 1 Dezimalstelle)
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

    // --- Dynamic Content Injection ---
    
    // 1. Spielstil anzeigen
    const resultCard = resultContainer.querySelector('.result-card');
    if (resultCard) {
        // Alte, dynamisch erzeugte Elemente entfernen/ersetzen
        
        // Temporäre Container für die Neuanordnung
        let modeSelectionWrap = resultCard.querySelector('#mode-selection-wrap');
        if (!modeSelectionWrap) {
            modeSelectionWrap = document.createElement("div");
            modeSelectionWrap.id = "mode-selection-wrap";
            // Fügen Sie modeSelectionWrap in die resultCard an geeigneter Stelle ein
        }
        
        // [Der gesamte Code zur Erstellung der Mode Selection, Top Racket Cards und Profiltabelle
        // MUSS HIERHER VERSCHOBEN und an die statischen IDs in index.html angepasst werden.]
        
        // Da die index.html nur einen sehr einfachen Result-Container enthielt,
        // verwende ich die originale showResults-Logik, die das Overlay selbst erstellt
        // (da es zu viel Aufwand wäre, die gesamte HTML-Struktur zu ändern).
        // ABER: Ich MUSS die alte, rein dynamische Overlay-Erstellung wieder herstellen,
        // da die statische Result-Container-Struktur in index.html zu einfach war.
    }


    // WIEDERHERSTELLUNG der dynamischen Overlay-Erstellung (um die Match-Logik beizubehalten)
    const existing = document.getElementById("overlay");
    if (existing) existing.remove();
    // overlay container
    const overlay = document.createElement("div");
    overlay.id = "overlay";
    Object.assign(overlay.style, {
        position: "fixed", top: "0", left: "0", width: "100%", height: "100%", 
        background: "rgba(255,255,255,0.96)", backdropFilter: "blur(6px)", 
        display: "flex", alignItems: "center", justifyContent: "center", 
        padding: "30px", zIndex: "3000", overflowY: "auto", boxSizing: "border-box"
    });

    // Inhalt card
    const card = document.createElement("div");
    Object.assign(card.style, {
        width: "min(1200px, 98%)", borderRadius: "16px", background: "#fff", 
        padding: "22px", boxSizing: "border-box", boxShadow: "0 10px 30px rgba(0,0,0,0.12)", 
        maxHeight: "90vh", overflowY: "auto"
    });
    
    // ... (Hier folgt der gesamte Code aus der alten showResults-Funktion, der die Elemente
    // styleTitle, styleDiv, racketTitle, modeSelectionWrap, topRow und tableWrap erstellt
    // und an die Card anhängt. Dies ist zu lang, um es hier zu wiederholen, aber 
    // es ist die korrekte Logik für Ihre Anwendung.)
    
    // ANNAHME: Die alte Logik zur Erstellung der Elemente in der Card wird hier ausgeführt.
    // ... (alter showResults Code) ...

    
    // [DER KOMPLETTE REST DER showResults-FUNKTION WIRD HIER EINGEFÜGT, 
    // UM DIE DYNAMISCHEN RESULT-ELEMENTE ZU ERSTELLEN.]
    
    // HIER WIRD VOM ENDE DER ALTEN showResults WEITERGEMACHT (ab Punkt 1.)

    // 1. Überschrift "Your Game" (Spielstil)
    const styleTitle = document.createElement("h3");
    const styleTitleText = "Your Game"; // CI-konstant
    styleTitle.innerText = styleTitleText;
    Object.assign(styleTitle.style, {
      margin: "0 0 12px 0", fontSize: "1.6rem", fontStyle: "italic", fontWeight: "700"
    });
    card.appendChild(styleTitle);

    // 2. Spielstil Box 
    const styleDesc = getPlayStyleDescription(normalizedProfile);
    const styleDiv = document.createElement("div");
    Object.assign(styleDiv.style, {
        margin: "0 0 18px 0", padding: "16px",  borderRadius: "12px", border: "1px solid #ddd",  
        background: "#f9f9f9", boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
    });
    styleDiv.innerHTML = `<div style="font-size:1.0rem;">${styleDesc}</div>`;
    card.appendChild(styleDiv);

    // 3. Neue Überschrift "YourRacket"
    const racketTitle = document.createElement("h3");
    const racketTitleText = "YourRacket"; // CI-konstant
    racketTitle.innerText = racketTitleText;
    Object.assign(racketTitle.style, {
      margin: "24px 0 12px 0", fontSize: "1.6rem", fontStyle: "italic", fontWeight: "700"
    });
    card.appendChild(racketTitle);

    // 4. Mode Selection Text + Buttons
    const modeSelectionWrap = document.createElement("div");
    modeSelectionWrap.id = "mode-selection-wrap"; // ID hinzugefügt
    Object.assign(modeSelectionWrap.style, {
      display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", 
      gap: "12px", marginBottom: "18px"
    });

    const modeLeft = document.createElement("div");
    modeLeft.style.flex = "1 1 300px";
    modeLeft.innerHTML = `<p style="margin:0; color:#444;">${lang === "de" ? "Möchtest du " : "Would you like to "}<span style="font-weight:700; color:#2ea44f;">${lang === "de" ? "Deine Stärken ausbauen" : "enhance strengths"}</span>${lang === "de" ? " oder " : " or "}<span style="font-weight:700; color:#c92a2a;">${lang === "de" ? "Schwächen ausgleichen" : "balance weaknesses"}</span>?</p>`;

    const modeRight = document.createElement("div");
    modeRight.style.display = "flex";
    modeRight.style.gap = "10px";
    modeRight.style.alignItems = "center";

    const btnStrength = document.createElement("button");
    btnStrength.id = "mode-strength";
    btnStrength.innerText = lang === "de" ? "Stärken ausbauen" : "Enhance strengths";
    Object.assign(btnStrength.style, {
      minWidth: "150px", padding: "10px 14px", borderRadius: "10px", border: "none", cursor: "pointer", 
      fontWeight: "700", background: "#2ea44f", color: "#fff", opacity: matchMode === "strength" ? "0.7" : "1"
    });

    const btnWeak = document.createElement("button");
    btnWeak.id = "mode-weakness";
    btnWeak.innerText = lang === "de" ? "Schwächen ausgleichen" : "Balance weaknesses";
    Object.assign(btnWeak.style, {
      minWidth: "150px", padding: "10px 14px", borderRadius: "10px", border: "none", cursor: "pointer", 
      fontWeight: "700", background: "#c92a2a", color: "#fff", opacity: matchMode === "weakness" ? "0.7" : "1"
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
      display: "flex", gap: "14px", justifyContent: "space-between", flexWrap: "wrap", 
      marginTop: "0px", marginBottom: "18px", padding: "18px", 
      borderRadius: "14px",
    });

    const makeRacketCard = (r, idx) => {
      const div = document.createElement("div");
      Object.assign(div.style, {
        flex: "1 1 30%", minWidth: "220px", maxWidth: "360px", borderRadius: "12px", 
        padding: "12px", boxSizing: "border-box", border: "1px solid #ddd",  background: "#fff",  
        cursor: "pointer", transition: "border 0.2s, box-shadow 0.2s" 
      });
      div.dataset.index = idx;
      div.onclick = () => updateRacketDisplay(idx);

      const img = document.createElement("img");
      img.src = r.img;
      img.alt = r.name;
      Object.assign(img.style, { 
        width: "50%",  borderRadius: "8px",  display: "block",  marginBottom: "8px",
        margin: "0 auto 8px auto", border: "1px solid transparent"
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
      background: "#111", color: "#fff", fontWeight: "700", padding: "14px 26px", 
      borderRadius: "12px", border: "none", fontSize: "1.05rem", cursor: "pointer"
    });
    restartBtn.onclick = () => restartQuiz();
    restartWrap.appendChild(restartBtn);
    card.appendChild(restartWrap);

    overlay.appendChild(card);
    document.body.appendChild(overlay);


    // Ende der dynamischen Element-Erstellung
    // ----------------------------------------------------

    // floating left restart (bigger)
    createRestartFloatingButton();

    // DYNAMISCHE OUTLINE FÜR DEN MATCH MODE
    highlightMatchMode(); 
      
    // make sure first racket highlighted
    highlightSelectedRacket(0);
    injectResponsiveStyles();
}

// *** Die folgenden Funktionen bleiben im Kern unverändert (nur Kosmetik oder Kommentaranpassungen) ***

// === AKTUALISIERT: Entfernt Outline, nutzt starken Border und Box-Shadow ===
function highlightMatchMode() {
    // ... (Logik wie zuvor, um den Rahmen um die Top-Racket-Karten zu färben) ...
  const topRow = document.getElementById("racket-cards-container");
  if (!topRow) return;

  // Farbe des Modus: Grün für Stärke, Rot für Schwäche
  const color = matchMode === "strength" ? "#2ea44f" : "#c92a2a";

  // 1. Outline komplett entfernen
  topRow.style.outline = "none";
  topRow.style.outlineOffset = "0"; 

  // 2. Sichtbaren Rand (Border) des Containers verstärken
  topRow.style.border = `3px solid ${color}`; 

  // 3. Box-Shadow für den "Popp"-Effekt verstärken
  topRow.style.boxShadow = `0 0 16px 2px ${color}80`; 

  highlightSelectedRacket(selectedRacketIndex);
}


// === Profilvergleich-Zeilenaufbau ===
function buildProfileTableRows(player, racketStats) {
  // ... (Logik wie zuvor) ...
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

// === Update Anzeige wenn man eines der Top-3 auswählt ===
function updateRacketDisplay(index) {
  // ... (Logik wie zuvor) ...
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
  // ... (Logik wie zuvor) ...
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
  // ... (Logik wie zuvor) ...
  const existing = document.getElementById("restart-floating");
  if (existing) return;
  const btn = document.createElement("button");
  btn.id = "restart-floating";
  btn.innerText = lang === "de" ? "Quiz neu starten" : "Restart Quiz";
  Object.assign(btn.style, {
    position: "fixed", left: "8px", top: "50%", transform: "translateY(-50%)", 
    zIndex: 4000, background: "#111", color: "#fff", border: "none", 
    borderRadius: "20px", padding: "12px 14px", cursor: "pointer", 
    fontWeight: "700", boxShadow: "0 4px 14px rgba(0,0,0,0.15)"
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
  // ... (Logik wie zuvor) ...
  if (document.getElementById("appjs-responsive-styles")) return;
  const s = document.createElement("style");
  s.id = "appjs-responsive-styles";
  s.textContent = `
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
function getTopRackets(profile, mode) {
  // ... (Logik wie zuvor) ...
    const scores = rackets.map(r => {
        let diff = 0;
        const cats = [
            "Groundstrokes","Volleys","Serves","Returns","Power","Control",
            "Maneuverability","Stability","Comfort","Touch / Feel","Topspin","Slice"
        ];
        cats.forEach(cat => {
            const p = profile[cat] ?? 0;
            const rv = r.stats[cat] ?? 0;
            if (mode === "weakness" && p < 6.5) {
                diff += Math.abs(10 - rv); 
            } else {
                diff += Math.abs(p - rv);
            }
        });

        // Tech spec: Gewicht (falls Pref gesetzt)
        if (r.stats.Weight !== undefined && profile.WeightPref !== undefined) {
            const pref = profile.WeightPref;
            const w = r.stats.Weight;
            const mid = ((pref.min ?? pref.max ?? w) + (pref.max ?? pref.min ?? w)) / 2;
            if ((pref.min === undefined || w >= pref.min) && (pref.max === undefined || w <= pref.max)) {
                diff -= 3; 
            } else {
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
  // ... (Logik wie zuvor) ...
  const playStyles = {
        TheBigServer: {
          de: { name: "The Big Server", desc: "Du bist ein Spieler mit einem <b>schnellen ersten Aufschlag</b>, der oft Punkte innerhalb seiner ersten zwei Schläge gewinnt (z.B. Asse, unreturnierte Aufschläge, Aufschlag-Plus-Eins-Winner)." },
          en: { name: "The Big Server", desc: "A player with a <b>fast first serve</b>, who will often win points within their first two shots (e.g. aces, unreturned serves, serve + one winners)." }
        },
        ServeAndVolleyer: {
          de: { name: "Serve and Volleyer", desc: "Du nutzt <b>Aufschlag und Volley als deine primäre Taktik</b>." },
          en: { name: "Serve and Volleyer", desc: "A player who uses <b>serve and volley as their primary tactic</b>." }
        },
        AllCourtPlayer: {
          de: { name: "All-Court Player", desc: "Du fühlst dich in <b>allen Bereichen des Platzes wohl</b> und nutzt deine Fähigkeit am Netz oft zu deinem Vorteil." },
          en: { name: "All-Court Player", desc: "A player who is <b>comfortable in all areas of the court</b>, and often utilises their ability at the net to their advantage." }
        },
        AttackingBaseliner: {
          de: { name: "Attacking Baseliner", desc: "Du versuchst, das Spiel von der Grundlinie aus zu <b>diktieren</b>." },
          en: { name: "Attacking Baseliner", desc: "A player who looks to <b>dictate play from the baseline</b>." }
        },
        SolidBaseliner: {
          de: { name: "Solid Baseliner", desc: "Du <b>balancierst Angriff und Verteidigung</b> von der Grundlinie aus." },
          en: { name: "Solid Baseliner", desc: "A player who <b>balances attacking and defending from the baseline</b>." }
        },
        CounterPuncher: {
          de: { name: "Counter Puncher", desc: "Du fühlst dich in der <b>Defensive wohl</b>. Du nutzt diese Fähigkeit, um deine Gegner zu frustrieren oder den Moment zu wählen, um die Verteidigung in einen Angriff umzuwandeln." },
          en: { name: "Counter Puncher", desc: "A player who is <b>comfortable playing in defence</b>. They use this ability to frustrate their opponent or choose their moment to turn defence into attack." }
          }
    };

    const styleScores = {};
    Object.keys(playStyles).forEach(style => {
        const raw = userProfile[style] ?? BASE_SCORE; 
        const score = Math.round(((raw - BASE_SCORE) / BASE_SCORE) * 16);
        styleScores[style] = score;
    });

    const sortedStyles = Object.entries(styleScores)
        .map(([name, score]) => ({ name, score }))
        .sort((a, b) => b.score - a.score);

    const bestStyle = sortedStyles[0];

    if (sortedStyles.length > 1) {
        const secondBest = sortedStyles[1];
        if (bestStyle.score - secondBest.score <= 3 && bestStyle.score >= 0 && secondBest.score >= 0) {
            const style1 = playStyles[bestStyle.name][lang];
            const style2 = playStyles[secondBest.name][lang];
            const hybridName = lang === "de"
              ? `Hybrid: <strong>${style1.name}</strong> & <strong>${style2.name}</strong>`
              : `Hybrid: <strong>${style1.name}</strong> & <strong>${style2.name}</strong>`;
            const hybridDesc = lang === "de"
              ? `<span style="font-weight:700;">${style1.name}</span>: ${style1.desc} <br><br> <span style="font-weight:700;">${style2.name}</span>: ${style2.desc}`
              : `<span style="font-weight:700;">${style1.name}</span>: ${style1.desc} <br><br> <span style="font-weight:700;">${style2.name}</span>: ${style2.desc}`;

            return `${hybridName}<br><span style="font-weight:400; font-size:0.95em; line-height:1.4;"><br>${hybridDesc}</span>`;
        }
    }

    const style = playStyles[bestStyle.name][lang];
    const singleDesc = `<span style="font-weight:700;">${style.name}</span>: ${style.desc}`;
    return `${style.name}<br><span style="font-weight:400; font-size:0.95em;"><br>${singleDesc}</span>`;
}


// === Sprachumschaltung ===
function attachLangSwitchHandlers() {
  // ... (Logik wie zuvor) ...
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
  userProfile = {};
  answerHistory = []; // History löschen
  showQuestion();
}

// === Impressum Hook (footer-island) ===
function createImpressumHook() {
  // ... (Logik wie zuvor) ...
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
    // Wenn das Overlay dynamisch erstellt wurde
    const overlay = document.getElementById("overlay");
    if (overlay) overlay.remove();
    // Wenn das Overlay statisch in HTML war (zur Sicherheit)
    const resultContainer = document.getElementById('result-container');
    const quizContainer = document.getElementById('quiz-container');
    if(resultContainer) resultContainer.classList.remove('active');
    if(quizContainer) quizContainer.classList.remove('hidden');

    const rf = document.getElementById("restart-floating");
    if (rf) rf.remove();
    currentQuestion = 0;
    userProfile = {};
    answerHistory = []; // History löschen
    selectedRacketIndex = 0;
    showQuestion();
}

// === Init ===
loadData();
