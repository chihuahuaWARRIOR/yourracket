// app.js - 1:1 Original Design mit neuer Matching-Logik
let currentQuestion = 0;
let userProfile = {};
let questions = {};
let rackets = [];
let lang = localStorage.getItem("language") || getLanguage();
let averageScores = {}; 
const SCALE_FACTOR = 10; 
let matchMode = "neutral"; 
let selectedRacketIndex = 0;

const CATEGORIES = [
  "Groundstrokes", "Volleys", "Serves", "Returns", "Power",
  "Control", "Maneuverability", "Stability", "Comfort",
  "Touch / Feel", "Topspin", "Slice"
];

const STYLES = ["TheBigServer", "ServeAndVolleyer", "AllCourtPlayer", "AttackingBaseliner", "SolidBaseliner", "CounterPuncher"];

function getLanguage() {
  const navLang = navigator.language || navigator.userLanguage || "de";
  return navLang.startsWith("de") ? "de" : "en";
}

// === LOGIK: Balancer & Mittelwerte ===
function balanceProfile(profile, targetMean = 85) {
  const currentSum = CATEGORIES.reduce((sum, cat) => sum + (profile[cat] || 85), 0);
  const currentMean = currentSum / CATEGORIES.length;
  const diff = currentMean - targetMean;
  CATEGORIES.forEach(cat => {
    profile[cat] = Math.max(10, Math.min(100, (profile[cat] || targetMean) - diff));
  });
  return profile;
}

function calculateAverageScores(rackets) {
  const sums = {}; const counts = {};
  CATEGORIES.forEach(cat => { sums[cat] = 0; counts[cat] = 0; });
  rackets.forEach(r => {
    if (!r.stats) return;
    CATEGORIES.forEach(cat => {
      let val = r.stats[cat];
      if (val !== undefined) {
        val = val <= 10 ? val * 10 : val;
        sums[cat] += val; counts[cat]++;
      }
    });
  });
  CATEGORIES.forEach(cat => { averageScores[cat] = counts[cat] > 0 ? sums[cat]/counts[cat] : 85; });
}

function initializeUserProfile() {
  userProfile = {};
  CATEGORIES.forEach(cat => { userProfile[cat] = averageScores[cat] || 85; });
  STYLES.forEach(s => { userProfile[s] = 50; });
}

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
    const b = document.getElementById("brand");
    if(b) { b.onclick=()=>restartQuiz(); }
    showQuestion();
    renderProgress();
    createBackButton();
    attachLangSwitchHandlers();
  } catch (e) { console.error(e); }
}

function showQuestion() {
  const qList = questions[lang];
  if (!qList || currentQuestion >= qList.length) { showResults(); return; }
  const q = qList[currentQuestion];
  document.getElementById("question-number").textContent = `${lang==="de"?"Frage":"Question"} ${currentQuestion+1}:`;
  document.getElementById("question").innerText = q.q;
  for (let i=0; i<4; i++) {
    const btn = document.getElementById(`a${i+1}`);
    if (btn && q.answers[i]) {
      btn.innerText = q.answers[i].text;
      btn.onclick = () => { handleEffects(q.answers[i].effects); currentQuestion++; showQuestion(); };
    }
  }
  renderProgress();
}

function handleEffects(eff) {
  if (!eff) return;
  for (const [k, v] of Object.entries(eff)) {
    if (k.includes("Weight") || k.includes("Headsize")) {
      const t = k.includes("Weight") ? "WeightPref" : "HeadsizePref";
      userProfile[t] = userProfile[t] || {};
      if (k.endsWith("Min")) userProfile[t].min = v;
      if (k.endsWith("Max")) userProfile[t].max = v;
    } else if (CATEGORIES.includes(k) || STYLES.includes(k)) {
      userProfile[k] = (userProfile[k] || 85) + (v * SCALE_FACTOR);
    }
  }
  userProfile = balanceProfile(userProfile, 85);
}

// === Matching mit Quadratischer Abweichung ===
function getTopRackets(profile, mode) {
  const scores = rackets.map(r => {
    let diff = 0;
    const sorted = [...CATEGORIES].sort((a,b) => profile[b] - profile[a]);
    const top3 = sorted.slice(0,3);
    const bottom3 = sorted.slice(-3);
    CATEGORIES.forEach(cat => {
      const p = profile[cat];
      const rv = r.stats[cat] * 10;
      let d;
      if (mode === "strength" && top3.includes(cat)) d = 100 - rv;
      else if (mode === "weakness" && bottom3.includes(cat)) d = 100 - rv;
      else d = p - rv;
      diff += Math.pow(d, 2);
    });
    return { r, diff };
  });
  scores.sort((a,b) => a.diff - b.diff);
  return scores.slice(0,3).map(s => s.r);
}

// === Hybrid Spielstil Logik ===
function getHybridDescription(profile) {
  let sorted = STYLES.map(s => ({ name: s, val: profile[s] || 0 })).sort((a,b) => b.val - a.val);
  const top = sorted[0];
  const second = sorted[1];
  if (second && (top.val - second.val) < 10) {
    return lang === "de" ? `Hybrid: ${top.name} & ${second.name}` : `Hybrid: ${top.name} & ${second.name}`;
  }
  return top.name;
}

// === ENDKARTE 1:1 WIE VORHER ===
function showResults() {
  const existing = document.getElementById("overlay");
  if (existing) existing.remove();

  const uiProfile = {};
  CATEGORIES.forEach(c => uiProfile[c] = Math.round(userProfile[c])/10);
  const bestRackets = getTopRackets(userProfile, matchMode);
  
  const overlay = document.createElement("div");
  overlay.id = "overlay";
  overlay.className = "overlay"; // Nutzt deine CSS Klasse

  const card = document.createElement("div");
  card.className = "results-card"; // Nutzt deine CSS Klasse
  
  card.innerHTML = `
    <h2>${lang==='de'?'DEIN ERGEBNIS':'YOUR RESULT'}</h2>
    
    <div class="style-box" style="background:#f4f4f4; padding:15px; border-radius:10px; margin-bottom:20px; text-align:center;">
        <small>${lang==='de'?'Dein Spielstil:':'Your Playstyle:'}</small>
        <div style="font-weight:800; font-size:1.2rem;">${getHybridDescription(userProfile)}</div>
    </div>

    <div class="mode-selector" style="display:flex; gap:5px; margin-bottom:20px;">
        <button id="m-neu" style="flex:1; padding:10px; font-size:0.8rem; border:none; border-radius:5px; font-weight:700; cursor:pointer; background:${matchMode==='neutral'?'#ffd700':'#eee'}">MATCHING</button>
        <button id="m-str" style="flex:1; padding:10px; font-size:0.8rem; border:none; border-radius:5px; font-weight:700; cursor:pointer; background:${matchMode==='strength'?'#2ea44f':'#eee'}; color:${matchMode==='strength'?'#fff':'#333'}">STÄRKEN</button>
        <button id="m-wek" style="flex:1; padding:10px; font-size:0.8rem; border:none; border-radius:5px; font-weight:700; cursor:pointer; background:${matchMode==='weakness'?'#c92a2a':'#eee'}; color:${matchMode==='weakness'?'#fff':'#333'}">SCHWÄCHEN</button>
    </div>

    <div class="racket-grid" id="r-grid"></div>

    <div class="stats-container" style="margin-top:20px;">
        <table style="width:100%; border-collapse:collapse;" id="res-table">
            <thead>
                <tr style="border-bottom:2px solid #000">
                    <th style="text-align:left; padding:8px">Stats</th>
                    <th style="text-align:center">You</th>
                    <th style="text-align:center">Racket</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    </div>

    <button class="restart-btn" onclick="restartQuiz()" style="width:100%; margin-top:20px; padding:15px; background:#000; color:#fff; border:none; border-radius:10px; font-weight:700; cursor:pointer;">
        ${lang==='de'?'NEU STARTEN':'RESTART QUIZ'}
    </button>
  `;

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  document.getElementById("m-neu").onclick = () => { matchMode="neutral"; showResults(); };
  document.getElementById("m-str").onclick = () => { matchMode="strength"; showResults(); };
  document.getElementById("m-wek").onclick = () => { matchMode="weakness"; showResults(); };

  const grid = document.getElementById("r-grid");
  bestRackets.forEach((r, idx) => {
    const rDiv = document.createElement("div");
    rDiv.className = "racket-card"; 
    if(idx === selectedRacketIndex) rDiv.style.borderColor = "#000";
    
    rDiv.innerHTML = `
        <img src="${r.img}" class="racket-img">
        <div class="racket-name">${r.name}</div>
        <div class="racket-specs">${r.stats.Weight}g | ${r.stats.Headsize}in²</div>
    `;
    rDiv.onclick = () => { selectedRacketIndex=idx; updateTable(r, uiProfile); highlightRacket(idx); };
    grid.appendChild(rDiv);
  });

  updateTable(bestRackets[selectedRacketIndex], uiProfile);
}

function highlightRacket(idx) {
    const cards = document.getElementById("r-grid").children;
    for(let i=0; i<cards.length; i++) cards[i].style.borderColor = (i===idx) ? "#000" : "#eee";
}

function updateTable(r, p) {
  const tbody = document.querySelector("#res-table tbody");
  tbody.innerHTML = CATEGORIES.map(cat => `
    <tr style="border-bottom:1px solid #eee">
        <td style="padding:8px; font-size:0.9rem;">${cat}</td>
        <td style="text-align:center; font-weight:700">${p[cat].toFixed(1)}</td>
        <td style="text-align:center; font-weight:700">${r.stats[cat].toFixed(1)}</td>
    </tr>`).join("");
}

function renderProgress() {
  const b = document.getElementById("progress-bar"); if(!b) return; b.innerHTML = "";
  const total = (questions[lang] || []).length;
  for(let i=0; i<total; i++) {
    const s = document.createElement("span");
    if(i < currentQuestion) s.classList.add("active");
    if(i === currentQuestion) s.style.background = "#000";
    b.appendChild(s);
  }
}

function restartQuiz() { const o=document.getElementById("overlay"); if(o) o.remove(); currentQuestion=0; matchMode="neutral"; initializeUserProfile(); showQuestion(); }

function createBackButton() {
  const b = document.createElement("div"); b.id="back-button"; b.innerHTML="&#8617;";
  Object.assign(b.style, { position:"fixed", left:"15px", bottom:"15px", width:"40px", height:"40px", background:"#fff", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", boxShadow:"0 2px 8px rgba(0,0,0,0.2)", zIndex:1000 });
  b.onclick = () => { if(currentQuestion>0) { currentQuestion--; showQuestion(); } };
  document.body.appendChild(b);
}

function attachLangSwitchHandlers() {
  const d = document.getElementById("lang-de"); const e = document.getElementById("lang-en");
  if(d) d.onclick=() => { lang="de"; restartQuiz(); };
  if(e) e.onclick=() => { lang="en"; restartQuiz(); };
}

loadData();
