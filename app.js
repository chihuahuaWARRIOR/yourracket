// app.js (vanilla JS) - ERSETZT die bestehende app.js
// Enthält alle Logik für das Quiz, die Sprachsteuerung und die Ergebnisberechnung.

let currentQuestion = 0;
let userProfile = {};
let questions = {};
let rackets = [];
let lang = localStorage.getItem("language") || getLanguage();
let baseScores = {}; // NEU: Objekt für die User-Basiswerte pro Attribut (Marktdurchschnitt)
const SCALE_FACTOR = 5; // Skalierungsfaktor für die Gewichtung der Antworten
let matchMode = "strength"; // Derzeit nicht verwendet, aber beibehalten ("strength" oder "weakness")
let selectedRacketIndex = 0;

// === Hilfsfunktionen für den DOM-Zugriff ===
const getEl = (id) => document.getElementById(id);

// === Sprache automatisch erkennen (Bestehender Code) ===
function getLanguage() {
  const navLang = navigator.language || navigator.userLanguage || "de";
  return navLang.startsWith("de") ? "de" : "en";
}

// === Berechnung der User-Basiswerte aus Rackets.json (NEU & ROBUST) ===
function calculateInitialBaseScores() {
  if (rackets.length === 0) return {};

  // 1. Alle Attribute sammeln und Gesamtsummen berechnen
  const attributeTotals = {};
  let attributeCounts = {};

  rackets.forEach(racket => {
    // SICHERHEITS-CHECK: Verhindert Absturz, falls 'attributes' fehlt oder null ist.
    const attributes = racket.attributes;
    if (attributes && typeof attributes === 'object') {
      Object.entries(attributes).forEach(([attribute, value]) => {
        attributeTotals[attribute] = (attributeTotals[attribute] || 0) + value;
        attributeCounts[attribute] = (attributeCounts[attribute] || 0) + 1;
      });
    }
  });

  // 2. Durchschnitt für jedes Attribut berechnen
  const calculatedBaseScores = {};
  Object.keys(attributeTotals).forEach(attribute => {
    if (attributeCounts[attribute] > 0) {
      calculatedBaseScores[attribute] = attributeTotals[attribute] / attributeCounts[attribute];
    }
  });

  // Speichere die berechneten Durchschnitte als neue Basis
  return calculatedBaseScores;
}

// === Daten laden (Aktualisiert) ===
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

    if (Object.keys(questions).length === 0 || rackets.length === 0) {
      // Wir werfen keinen Fehler mehr, falls die Dateien leer sind, sondern zeigen eine sanftere Meldung.
      console.warn("Questions or Rackets data is empty. Cannot initialize quiz.");
    }
    
    // Setze die Basis-Scores basierend auf den Marktdurchschnitten
    baseScores = calculateInitialBaseScores();

    // Initialisierung nach erfolgreichem Laden
    initApp();

  } catch (error) {
    console.error("Fehler beim Laden der Daten:", error);
    // Zeigt eine Fehlermeldung auf der Seite an
    document.body.innerHTML = `<div class="p-8 text-center bg-red-100 text-red-800 rounded-lg shadow-xl m-4 md:m-10">
      <h1 class="text-2xl font-bold">${lang === 'de' ? 'Ein kritischer Fehler ist aufgetreten.' : 'A critical error occurred.'}</h1>
      <p class="mt-2">${lang === 'de' ? 'Die Anwendung konnte nicht geladen werden. Bitte stellen Sie sicher, dass die Dateien questions.json und rackets.json korrekt formatiert sind (siehe Konsole für Details).' : 'The application could not be loaded. Please ensure questions.json and rackets.json are correctly formatted (check console for details).'}</p>
    </div>`;
  }
}

// === App Initialisierung (Vervollständigt & optimiert) ===
function initApp() {
  // Setzt die Anfangsseite auf die erste Frage
  showQuestion();
  renderProgress();
  createImpressumHook(); // Dein bestehender Hook
  updateUIForLang(); // Aktualisiert Texte basierend auf der Sprache

  // Stellt sicher, dass die "Zurück"-Funktion initialisiert ist (falls Button vorhanden)
  const backBtn = getEl('back-button');
  if (backBtn) {
    backBtn.onclick = goBack;
  }
  
  // Stellt sicher, dass der "Neustart"-Button initialisiert ist (falls Button vorhanden)
  const restartBtn = getEl('restart-button');
  if (restartBtn) {
    restartBtn.onclick = startQuiz;
  }
}

// === Sprach-Wechsel (Bestehender Code) ===
function switchLang(newLang) {
  lang = newLang;
  localStorage.setItem("language", newLang);
  currentQuestion = 0;
  userProfile = {};
  showQuestion();
  renderProgress();
  createImpressumHook(); // Muss neu aufgerufen werden, um den Text zu aktualisieren
  updateUIForLang(); // Aktualisiert alle statischen Texte
}

// === Aktualisiert statische UI-Elemente wie Titel und Sprachschalter-Texte ===
function updateUIForLang() {
  const en = lang === "en";
  
  // 1. Sprachschalter-Setup (optimiert)
  const langSwitch = getEl("lang-switch");
  if (langSwitch) {
    // Wir löschen den alten Inhalt und fügen die Buttons mit korrekten Klicks neu hinzu
    langSwitch.innerHTML = `
      <button id="lang-de" class="p-2 rounded-l-lg ${!en ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}" onclick="switchLang('de')">DE</button>
      <button id="lang-en" class="p-2 rounded-r-lg ${en ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}" onclick="switchLang('en')">EN</button>
    `;
  }
  
  // 2. Aktualisiere Zurück-Button Text
  const backBtn = getEl('back-button');
  if(backBtn) {
    backBtn.textContent = en ? 'Back' : 'Zurück';
    backBtn.title = backBtn.textContent;
  }

  // 3. Aktualisiere Neustart-Button Text
  const restartBtn = getEl('restart-button');
  if(restartBtn) {
    restartBtn.textContent = en ? 'Start Over' : 'Neustart';
  }
}


// === Fragedarstellung (Vervollständigt) ===
function showQuestion() {
  const quizContainer = getEl('quiz-container');
  const resultsContainer = getEl('results-container');
  const detailsContainer = getEl('details-container');
  const backBtn = getEl('back-button');
  
  // Stelle sicher, dass wir im Quiz-Modus sind
  if (quizContainer) quizContainer.classList.remove('hidden');
  if (resultsContainer) resultsContainer.classList.add('hidden');
  if (detailsContainer) detailsContainer.classList.add('hidden');

  // Wenn alle Fragen beantwortet sind, zeige die Ergebnisse
  if (currentQuestion >= Object.keys(questions).length) {
    showResults();
    return;
  }

  const questionKeys = Object.keys(questions);
  const currentKey = questionKeys[currentQuestion];
  const qData = questions[currentKey];

  // Steuere den Zurück-Button
  if (backBtn) {
    backBtn.classList.toggle('hidden', currentQuestion === 0);
  }

  if (!quizContainer) {
    console.error("Quiz-Container nicht gefunden.");
    return;
  }

  const questionText = qData.text[lang] || qData.text['en'];
  let optionsHtml = '';

  // Generiere die Optionen
  qData.options.forEach((option, index) => {
    const optionText = option.text[lang] || option.text['en'];
    const effect = JSON.stringify(option.profileEffect); // JSON String für handleAnswer
    
    // Füge eine Markierung hinzu, wenn diese Option bereits ausgewählt wurde
    const isSelected = userProfile[currentKey] && JSON.stringify(userProfile[currentKey]) === effect;
    const selectedClass = isSelected ? 'bg-indigo-500 text-white shadow-xl transform scale-105' : 'bg-white text-gray-800 hover:bg-gray-50';

    optionsHtml += `
      <button 
        class="w-full text-left p-4 my-2 border border-gray-200 rounded-xl transition duration-200 ease-in-out ${selectedClass}"
        onclick='handleAnswer("${currentKey}", ${effect})'
      >
        ${optionText}
      </button>
    `;
  });

  // Generiere das gesamte Quiz-HTML
  quizContainer.innerHTML = `
    <h2 class="text-xl md:text-2xl font-semibold mb-6 text-gray-800">${questionText}</h2>
    <div id="options-container" class="space-y-3">
      ${optionsHtml}
    </div>
  `;
}

// === Antwort verarbeiten (Vervollständigt) ===
function handleAnswer(questionKey, profileEffect) {
  // Speichere die Antwort (den Effekt)
  userProfile[questionKey] = profileEffect;
  
  // Gehe zur nächsten Frage, wenn es noch Fragen gibt
  if (currentQuestion < Object.keys(questions).length) {
    currentQuestion++;
    showQuestion();
    renderProgress();
  }
}

// === Zurück zur vorherigen Frage (Vervollständigt) ===
function goBack() {
  if (currentQuestion > 0) {
    currentQuestion--;
    showQuestion();
    renderProgress();
  }
}

// === Fortschrittsanzeige rendern (Vervollständigt) ===
function renderProgress() {
  const progressBar = getEl('progress-bar');
  const questionCount = Object.keys(questions).length;
  if (!progressBar || questionCount === 0) return;

  const progress = ((currentQuestion / questionCount) * 100).toFixed(0);
  const text = lang === 'de' ? 
    `Frage ${currentQuestion} von ${questionCount}` : 
    `Question ${currentQuestion} of ${questionCount}`;
  
  progressBar.innerHTML = `
    <div class="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
      <div class="bg-indigo-600 h-2.5 rounded-full transition-all duration-500 ease-out" style="width: ${progress}%"></div>
    </div>
    <span class="text-sm font-medium text-gray-700 mt-2">${text}</span>
  `;
}


// === Ergebnisse berechnen (Aktualisiert) ===
function calculateScores() {
  // 1. Aggregiere das Benutzerprofil
  let finalProfile = {};
  
  // Initialisiere das Profil mit den berechneten Durchschnitts-Basiswerten
  Object.keys(baseScores).forEach(attribute => {
    finalProfile[attribute] = baseScores[attribute];
  });

  Object.values(userProfile).forEach(effect => {
    // profileEffect ist ein Objekt von Attribut-Änderungen
    Object.entries(effect).forEach(([attribute, change]) => {
      // Initialisiere mit Basis-Score, falls noch nicht vorhanden (Sicherheitsnetz)
      if (!finalProfile.hasOwnProperty(attribute)) {
        finalProfile[attribute] = baseScores[attribute] || 50; // Fallback zu 50
      }
      // Wende die Änderung an, skaliert mit SCALE_FACTOR
      finalProfile[attribute] += change * SCALE_FACTOR;
        
      // Werte auf 0-100 beschränken (falls die Änderungen zu extrem sind)
      finalProfile[attribute] = Math.max(0, Math.min(100, finalProfile[attribute]));
    });
  });
  
  // 2. Berechne die Match-Scores für jeden Schläger
  const scoredRackets = rackets.map(racket => {
    let totalDifference = 0;
    let attributesCount = 0;
    
    // Vergleiche das endgültige Benutzerprofil mit den idealen Racket-Attributen
    Object.entries(racket.attributes).forEach(([attribute, idealValue]) => {
      const userValue = finalProfile[attribute] || baseScores[attribute] || 50; // Fallback zu Marktdurchschnitt
      
      // Der Match-Score basiert auf der absoluten Differenz (kleiner ist besser)
      totalDifference += Math.abs(userValue - idealValue);
      attributesCount++;
    });
    
    // Berechne den durchschnittlichen Unterschied (Average Distance)
    const averageDifference = attributesCount > 0 ? totalDifference / attributesCount : 100; // 100 wenn keine Attribute
    
    // Konvertiere die Differenz in einen Match-Prozentsatz (höher ist besser)
    // 100% Match: averageDifference = 0
    // 0% Match: averageDifference >= 100 (Maximale Distanz ist 100)
    const matchPercentage = Math.max(0, 100 - averageDifference);
    
    return {
      ...racket,
      matchScore: matchPercentage,
      // Füge das Benutzerprofil zur Anzeige hinzu
      userAttributes: finalProfile 
    };
  });
  
  // 3. Sortiere die Schläger nach Match Score absteigend
  scoredRackets.sort((a, b) => b.matchScore - a.matchScore);
  
  return scoredRackets;
}

// === Ergebnisse anzeigen (Vervollständigt) ===
function showResults() {
  const quizContainer = getEl('quiz-container');
  const resultsContainer = getEl('results-container');
  const detailsContainer = getEl('details-container');
  
  if (!resultsContainer || !quizContainer) return;

  // Verstecke Quiz und Details, zeige Ergebnisse
  quizContainer.classList.add('hidden');
  detailsContainer.classList.add('hidden');
  resultsContainer.classList.remove('hidden');

  const recommendedRackets = calculateScores();
  const titleText = lang === 'de' ? 'Deine persönlichen Racket-Empfehlungen' : 'Your Personal Racket Recommendations';
  // Check, ob Ergebnisse vorhanden sind, um den Fehler zu vermeiden, wenn das Array leer ist
  const topRacketName = recommendedRackets.length > 0 ? recommendedRackets[0].name : (lang === 'de' ? 'kein Schläger' : 'No Racket');
  const subtitleText = lang === 'de' ? 
    `Basierend auf deinen Antworten sind dies die besten Treffer. Dein bestes Match ist der **${topRacketName}**.` : 
    `Based on your answers, here are the best matches. Your top match is the **${topRacketName}**.`;

  let resultsHtml = `<h2 class="text-3xl font-bold mb-2 text-indigo-700">${titleText}</h2>`;
  resultsHtml += `<p class="text-gray-600 mb-8">${subtitleText}</p>`;

  // Generiere die Karten für die Top-Ergebnisse (z.B. Top 5)
  recommendedRackets.slice(0, 5).forEach((racket, index) => {
    const matchColor = racket.matchScore > 80 ? 'bg-green-500' : (racket.matchScore > 60 ? 'bg-yellow-500' : 'bg-red-500');
    
    resultsHtml += `
      <div class="flex flex-col md:flex-row items-center border p-4 mb-4 rounded-xl shadow-md transition hover:shadow-lg bg-white">
        <div class="w-full md:w-3/4">
          <span class="text-sm font-bold text-indigo-500">#${index + 1}</span>
          <h3 class="text-xl font-bold text-gray-800">${racket.brand} ${racket.name}</h3>
          <p class="text-gray-500 text-sm">${racket.description[lang] || racket.description['en']}</p>
        </div>
        <div class="w-full md:w-1/4 text-right mt-3 md:mt-0 flex flex-col items-end">
          <div class="text-lg font-extrabold text-white px-3 py-1 rounded-full ${matchColor} shadow-md mb-2">
            ${racket.matchScore.toFixed(0)}% Match
          </div>
          <button 
            class="text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition duration-150"
            onclick="showRacketDetails(${racket.id})"
          >
            ${lang === 'de' ? 'Details ansehen' : 'View Details'} &rarr;
          </button>
        </div>
      </div>
    `;
  });
  
  resultsContainer.innerHTML = resultsHtml;

  // Setze den Neustart-Button sichtbar
  const restartBtn = getEl('restart-button');
  if (restartBtn) restartBtn.classList.remove('hidden');
  const backBtn = getEl('back-button');
  if (backBtn) backBtn.classList.add('hidden'); // Verstecke Zurück-Button auf der Ergebnisseite
}

// === Schlägerdetails anzeigen (Vervollständigt) ===
function showRacketDetails(racketId) {
  const quizContainer = getEl('quiz-container');
  const resultsContainer = getEl('results-container');
  const detailsContainer = getEl('details-container');
  
  if (!detailsContainer || !resultsContainer) return;

  // Zeige Details, verstecke Quiz und Ergebnisse
  quizContainer.classList.add('hidden');
  resultsContainer.classList.add('hidden');
  detailsContainer.classList.remove('hidden');

  // Finde den Schläger anhand der ID (oder Index, falls du Index in der Ergebnis-Funktion verwendest)
  const racket = rackets.find(r => r.id === racketId);
  if (!racket) {
    detailsContainer.innerHTML = `<p class="text-red-500">${lang === 'de' ? 'Schläger nicht gefunden.' : 'Racket not found.'}</p>`;
    return;
  }

  const recommendedRackets = calculateScores();
  const currentMatch = recommendedRackets.find(r => r.id === racketId);
  const userScores = currentMatch ? currentMatch.userAttributes : {};
  
  // Generiere Attribute-Visualisierung (z.B. einfache Balken)
  let attributeHtml = '';
  const maxAttributeValue = 100; // Da die interne Skala 0-100 ist
  
  Object.entries(racket.attributes).forEach(([attribute, idealValue]) => {
    const userValue = userScores[attribute] || baseScores[attribute] || 50;
    
    // Übersetze den Attributnamen (hier: einfache Großschreibung)
    const attrName = attribute.charAt(0).toUpperCase() + attribute.slice(1);
    
    // Darstellung des idealen Werts des Schlägers
    const idealPosition = (idealValue / maxAttributeValue) * 100;
    
    // Darstellung des Benutzerprofil-Werts
    const userWidth = (userValue / maxAttributeValue) * 100;

    attributeHtml += `
      <div class="mb-4">
        <p class="font-semibold text-gray-700">${attrName} (${idealValue})</p>
        <div class="relative w-full h-4 bg-gray-200 rounded-full mt-1">
          <!-- Benutzerprofil-Balken (wird vom Marktdurchschnitt verschoben) -->
          <div class="h-4 rounded-full bg-indigo-200 transition-all duration-500" style="width: ${userWidth}%" title="${lang === 'de' ? 'Dein Profil' : 'Your Profile'}: ${userValue.toFixed(1)}"></div>
          <!-- Idealer Wert Marker -->
          <div class="absolute h-6 w-1 bg-red-500 top-[-4px] rounded-full shadow-lg" style="left: calc(${idealPosition}% - 2px);" title="${lang === 'de' ? 'Idealer Wert des Schlägers' : 'Racket Ideal Value'}: ${idealValue}"></div>
        </div>
      </div>
    `;
  });
  
  detailsContainer.innerHTML = `
    <h2 class="text-3xl font-bold mb-4 text-gray-900">${racket.brand} ${racket.name}</h2>
    <p class="text-gray-600 mb-6">${racket.description[lang] || racket.description['en']}</p>
    
    <h3 class="text-xl font-semibold mb-3 text-indigo-700">${lang === 'de' ? 'Match-Analyse' : 'Match Analysis'}</h3>
    
    ${attributeHtml}
    
    <button 
      class="mt-8 px-6 py-2 bg-indigo-500 text-white font-semibold rounded-xl shadow-md hover:bg-indigo-600 transition duration-200"
      onclick="showResults()"
    >
      &larr; ${lang === 'de' ? 'Zurück zur Ergebnisliste' : 'Back to Results'}
    </button>
  `;
}

// === Quiz zurücksetzen und neu starten (Vervollständigt) ===
function startQuiz() {
  currentQuestion = 0;
  userProfile = {};
  selectedRacketIndex = 0;
  
  // Verstecke den Neustart-Button (wird in showResults wieder gezeigt)
  const restartBtn = getEl('restart-button');
  if (restartBtn) restartBtn.classList.add('hidden');
  
  showQuestion();
  renderProgress();
}


// === Impressum Hook (footer-island) (Bestehender Code) ===
function createImpressumHook() {
  // prefer footer island for link
  const footer = getEl("footer-island");
  if (!footer) return;
  // avoid duplicates
  if (getEl("impressum-anchor")) {
    // Bestehenden Text aktualisieren
    getEl("impressum-anchor").innerText = lang === "de" ? "Impressum" : "Imprint";
    return;
  }
  const a = document.createElement("a");
  a.id = "impressum-anchor";
  a.href = "impressum.html";
  a.target = "_blank";
  a.innerText = lang === "de" ? "Impressum" : "Imprint";
  a.className = "text-sm text-gray-500 hover:text-indigo-600 transition duration-150";
  footer.appendChild(a);
}

// === Anwendung starten ===
// Ruft loadData auf, sobald das DOM geladen ist.
document.addEventListener('DOMContentLoaded', loadData);
