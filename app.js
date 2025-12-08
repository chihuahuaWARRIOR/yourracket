// app.js (vanilla JS) - ERSETZT die bestehende app.js

let currentQuestion = 0;
let userProfile = {};
let questions = {};
let rackets = [];
let lang = localStorage.getItem("language") || getLanguage();
const BASE_SCORE = 50; // neutral (0-100 internal, 50 => 5.0). ACHTUNG: Nur Basis für Spielstile.
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
  currentQuestion = 0;
  userProfile = {};
  showQuestion();
  renderProgress();
  createImpressumHook(); // Update Impressum link text
}

// === Impressum Hook (footer-island) ===
function createImpressumHook() {
  // prefer footer island for link
  const footer = document.getElementById("footer-island");
  if (!footer) return;
  // avoid duplicates
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
        // Fallback: 50 (neutral) als Fallback für alle Racket-Kategorien
        categories.forEach(cat => {
            averages[cat] = BASE_SCORE; 
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
        const questionKeys = Object.keys(questions[lang]);
        let nextQuestionKey = questionKeys.find(key => !userProfile[key]);
        currentQuestion = nextQuestionKey ? questionKeys.indexOf(nextQuestionKey) : questionKeys.length;
    }

    // Impressum verlinken (footer-island wenn vorhanden)
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

// === Language Switch Handler (muss an die Buttons im HTML binden) ===
function attachLangSwitchHandlers() {
    const langSwitch = document.getElementById("lang-switch");
    if (langSwitch) {
      const btns = langSwitch.getElementsByTagName("button");
      for (const b of btns) {
        if (/en/i.test(b.innerText)) b.onclick = () => switchLang("en");
        if (/de/i.test(b.innerText)) b.onclick = () => switchLang("de");
      }
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
        // Die Antwort selbst ist in userProfile nicht mehr gespeichert, 
        // daher muss man durch die Antwort-Schlüssel der Fragen iterieren.
        // Dies funktioniert nur, wenn die Antwort-Indexe in userProfile gespeichert wurden.
        // Da wir die Antwort-Indexe nicht mehr speichern, nutzen wir die ursprüngliche Logik,
        // die davon ausgeht, dass die *Effekte* direkt im Profil gespeichert wurden (was sie nicht tun sollten)
        // -> KORREKTUR: Wir müssen die `handleEffects` Logik aufrufen, indem wir die gespeicherten Indexe verwenden.
        const qKey = Object.keys(questions[lang])[Object.values(questions[lang]).indexOf(q)];
        if (userProfile[qKey] && userProfile[qKey].answerIndex !== undefined) {
             const effects = q.answers[userProfile[qKey].answerIndex].effects;
             handleEffects(effects);
        } else {
             // Da wir userProfile[qKey] gelöscht haben, müssen wir hier die Original-Logik
             // verwenden, die in meinem ursprünglichen Code fehlte.
             // Wir müssen die *Auswahl* des Nutzers in userProfile speichern.
             // Im nächsten Schritt in showQuestion fixen.
        }
    });

    // NEUE KORREKTUR: Da der Original-Code in `showQuestion` das Speichern des Index/Effects
    // nicht konsistent tat, müssen wir hier sauber rekonstruieren.
    // Da ich nur die *alte* app.js reparieren soll, halte ich mich an die Annahme,
    // dass die Effekte im `handleEffects` Aufruf sauber verarbeitet werden.

    // Wir speichern nur die `answerIndex` in `userProfile` und rufen `handleEffects` auf.
    const allQuestionKeys = Object.keys(questions[lang]);
    for (let i = 0; i < currentQuestion; i++) {
        const qKey = allQuestionKeys[i];
        const question = questions[lang][qKey];
        const storedAnswer = localStorage.getItem("userProfile") ? JSON.parse(localStorage.getItem("userProfile"))[qKey] : null;

        if (storedAnswer && storedAnswer.answerIndex !== undefined && question && question.answers[storedAnswer.answerIndex]) {
            const effects = question.answers[storedAnswer.answerIndex].effects;
            handleEffects(effects); // re-apply the effects
        }
    }
}


// === Frage anzeigen ===
function showQuestion() {
  const qList = questions[lang];
  const qArray = Object.values(qList);

  if (!qArray || qArray.length === 0) return;
  
  if (currentQuestion >= qArray.length) {
    showResults();
    return;
  }

  const q = qArray[currentQuestion];
  const qEl = document.getElementById("question");
  const qNumEl = document.getElementById("question-number"); 

  if (qNumEl) {
    qNumEl.textContent = `${lang === "de" ? "Frage" : "Question"} ${currentQuestion + 1}:`;
  }
  
  if (qEl) qEl.innerText = q.q;

  for (let i = 0; i < 4; i++) {
    const btn = document.getElementById(`a${i + 1}`);
    const answer = q.answers[i];
    if (!btn || !answer) continue;
    btn.innerText = answer.text;
    btn.style.opacity = "";

    const qKey = Object.keys(qList)[currentQuestion]; // Den korrekten Schlüssel abrufen

    btn.onclick = () => {
        // Speichere die Antwort im userProfile
        userProfile[qKey] = {
            answerIndex: i, // Index der gewählten Antwort
        };
        // NEU: Sofort die Effekte anwenden, damit userProfile korrekt ist
        handleEffects(answer.effects); 

        // Update localStorage
        localStorage.setItem("userProfile", JSON.stringify(userProfile));
      
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
    const baseScore = racketAverages[key] !== undefined 
                      ? racketAverages[key] // Durchschnitt für Racket-Kats (0-100)
                      : BASE_SCORE; // 50 für Spielstile (BigServer etc.)

    userProfile[key] = (userProfile[key] ?? baseScore) + (val * SCALE_FACTOR);
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
    background: "rgba(255,255,255,0.9)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
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
    width: "min(900px, 98%)",
    borderRadius: "12px",
    background: "#fff",
    padding: "30px",
    boxSizing: "border-box",
    boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
    maxHeight: "95vh",
    overflowY: "auto"
  });

  // 1. Überschrift
  const title = document.createElement("h2");
  title.innerText = lang === "de" ? "Dein ideales Racket" : "Your Ideal Racket";
  title.style.margin = "0 0 20px 0";
  title.style.textAlign = "center";
  card.appendChild(title);

  // 2. Mode Selection Text + Buttons
  const modeSelectionWrap = document.createElement("div");
  Object.assign(modeSelectionWrap.style, {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "10px",
    marginBottom: "20px"
  });
  
  const modeText = document.createElement("p");
  modeText.style.margin = "0";
  modeText.innerHTML = lang === "de" 
    ? "Wähle den Matching-Modus: Willst du <b>Stärken ausbauen</b> oder <b>Schwächen ausgleichen</b>?"
    : "Choose the matching mode: Do you want to <b>enhance strengths</b> or <b>balance weaknesses</b>?";
  modeSelectionWrap.appendChild(modeText);


  const btnStrength = document.createElement("button");
  btnStrength.id = "mode-strength";
  btnStrength.innerText = lang === "de" ? "Stärken" : "Strengths";
  Object.assign(btnStrength.style, {
    padding: "8px 12px",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    fontWeight: "600",
    background: matchMode === "strength" ? "#333" : "#eee",
    color: matchMode === "strength" ? "#fff" : "#333",
    transition: "background 0.2s"
  });

  const btnWeak = document.createElement("button");
  btnWeak.id = "mode-weakness";
  btnWeak.innerText = lang === "de" ? "Schwächen" : "Weaknesses";
  Object.assign(btnWeak.style, {
    padding: "8px 12px",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    fontWeight: "600",
    background: matchMode === "weakness" ? "#333" : "#eee",
    color: matchMode === "weakness" ? "#fff" : "#333",
    transition: "background 0.2s"
  });

  btnStrength.onclick = () => { matchMode = "strength"; refreshOverlay(); };
  btnWeak.onclick = () => { matchMode = "weakness"; refreshOverlay(); };

  modeSelectionWrap.appendChild(btnStrength);
  modeSelectionWrap.appendChild(btnWeak);
  card.appendChild(modeSelectionWrap);
  

  // 3. Spielstil Box
  const styleDesc = getPlayStyleDescription(normalizedProfile);
  const styleDiv = document.createElement("div");
  styleDiv.innerHTML = `<h3>${lang === "de" ? "Dein Spielstil" : "Your Play Style"}</h3>${styleDesc}`;
  Object.assign(styleDiv.style, {
      margin: "0 0 20px 0",
      padding: "15px",
      borderRadius: "8px",
      border: "1px solid #ddd",
      background: "#f8f8f8"
  });
  card.appendChild(styleDiv);

  // 4. horizontal row with top3 cards
  const topRow = document.createElement("div");
  Object.assign(topRow.style, {
    display: "flex",
    gap: "15px",
    justifyContent: "space-between",
    flexWrap: "wrap",
    marginBottom: "20px"
  });

  const makeRacketCard = (r, idx) => {
    const div = document.createElement("div");
    Object.assign(div.style, {
      flex: "1 1 30%",
      minWidth: "220px",
      borderRadius: "8px",
      padding: "15px",
      boxSizing: "border-box",
      border: idx === selectedRacketIndex ? "3px solid #000" : "1px solid #ddd",
      background: "#fff",
      cursor: "pointer",
      boxShadow: idx === selectedRacketIndex ? "0 4px 10px rgba(0,0,0,0.15)" : "none",
      transition: "border 0.2s, box-shadow 0.2s"
    });
    div.dataset.index = idx;
    div.onclick = () => updateRacketDisplay(idx);

    const img = document.createElement("img");
    img.src = r.img;
    img.alt = r.name;
    Object.assign(img.style, {
      width: "60%",
      borderRadius: "4px",
      display: "block",
      margin: "0 auto 10px auto"
    });

    const h = document.createElement("div");
    h.innerText = r.name;
    h.style.fontWeight = "bold";
    h.style.marginBottom = "5px";

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


  // 5. Profilvergleich Tabelle
  const tableWrap = document.createElement("div");
  tableWrap.style.overflowX = "auto";
  const table = document.createElement("table");
  table.id = "profile-table";
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";
  table.style.minWidth = "500px";

  const thead = document.createElement("thead");
  thead.innerHTML = `<tr style="background:#000; color:#fff;">
    <th style="text-align:left; padding:10px;">${lang === "de" ? "Kategorie" : "Category"}</th>
    <th style="text-align:center; padding:10px;">${lang === "de" ? "Dein Spielerprofil" : "Your Player Profile"}</th>
    <th style="text-align:center; padding:10px;">${lang === "de" ? "Schlägerprofil (${best.name})" : "Racket Profile (${best.name})"}</th>
  </tr>`;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  // Wichtig: Für die Tabelle nur die 0-10 Werte nutzen
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
  restartWrap.style.marginTop = "30px";

  const restartBtn = document.createElement("button");
  restartBtn.innerText = lang === "de" ? "Quiz neu starten" : "Restart Quiz";
  Object.assign(restartBtn.style, {
    background: "#333",
    color: "#fff",
    fontWeight: "bold",
    padding: "12px 20px",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer"
  });
  restartBtn.onclick = () => restartQuiz();
  restartWrap.appendChild(restartBtn);
  card.appendChild(restartWrap);

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  // floating left restart (bigger)
  createRestartFloatingButton();
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
    const bg = idx % 2 === 0 ? "#ffffff" : "#f4f4f4";
    // Verwende die deutsche Übersetzung
    const displayKey = translations[key] || key; 
    return `<tr style="background:${bg}"><td style="padding:8px 10px; text-align:left;">${displayKey}</td><td style="padding:8px 10px; text-align:center;">${pVal}</td><td style="padding:8px 10px; text-align:center;">${(typeof rVal === 'number') ? rVal.toFixed(1) : '-'}</td></tr>`;
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
  const thead = document.querySelector("#profile-table thead tr th:last-child");

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
  if (thead) thead.innerHTML = lang === "de" ? `Schlägerprofil (${racket.name})` : `Racket Profile (${racket.name})`;
  selectedRacketIndex = index;
  highlightSelectedRacket(index);
}

// === Highlighting der ausgewählten Schläger (Top-1/2/3) ===
function highlightSelectedRacket(index) {
  const overlay = document.getElementById("overlay");
  if (!overlay) return;
  const cards = overlay.querySelectorAll("div[data-index]");
  cards.forEach(c => {
    const idx = parseInt(c.dataset.index, 10);
    if (idx === index) {
      c.style.border = "3px solid #000";
      c.style.boxShadow = "0 4px 10px rgba(0,0,0,0.15)";
    } else {
      c.style.border = "1px solid #ddd";
      c.style.boxShadow = "none";
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
    background: "#333",
    color: "#fff",
    border: "none",
    borderRadius: "15px",
    padding: "10px 12px",
    cursor: "pointer",
    fontWeight: "bold",
    boxShadow: "0 4px 10px rgba(0,0,0,0.2)"
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

// === Spielstilbeschreibung (Logik) ===
function getPlayStyleDescription(profile) {
  const playStyles = {
    TheBigServer: {
      de: {
        name: "The Big Server",
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
  const styleScores = {};
  Object.keys(playStyles).forEach(style => {
    const raw = profile[style] ?? BASE_SCORE; 
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
        
        const hybridName = lang === "de"
          ? `Hybrid: <strong>${style1.name}</strong> & <strong>${style2.name}</strong>`
          : `Hybrid: <strong>${style1.name}</strong> & <strong>${style2.name}</strong>`;
        
        const hybridDesc = lang === "de"
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
