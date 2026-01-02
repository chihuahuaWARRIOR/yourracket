// app.js - WhichRacket Full Version (Hybrid Logic + Multi-Mode Matching)
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

// === Balancer: Hält den Durchschnitt bei 8.5 (85), damit das Profil dynamisch bleibt ===
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
  STYLES.forEach(s => { userProfile[s] = 50; }); // Startwert für Spielstile
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
    if(b) { b.innerHTML=`<b>WhichRacket.com</b>`; b.style.cursor="pointer"; b.onclick=()=>restartQuiz(); }
    showQuestion();
    renderProgress();
    createBackButton();
    createImpressumHook();
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
    if (r.stats.Weight && profile.WeightPref) {
      const {min, max} = profile.WeightPref;
      if ((min && r.stats.Weight < min) || (max && r.stats.Weight > max)) diff += 2000;
    }
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
  // Wenn der zweite Stil innerhalb von 10% des ersten liegt -> Hybrid
  if (second && (top.val - second.val) < 10) {
    return lang === "de" 
      ? `Du bist ein <strong>Hybrid: ${top.name} & ${second.name}</strong>. Deine Spielweise vereint zwei Stile fast perfekt.`
      : `You are a <strong>Hybrid: ${top.name} & ${second.name}</strong>. Your game perfectly blends two styles.`;
  }
  return lang === "de" 
    ? `Dein Spielstil: <strong>${top.name}</strong>.` 
    : `Your Playing Style: <strong>${top.name}</strong>.`;
}

function showResults() {
  const ex = document.getElementById("overlay"); if(ex) ex.remove();
  const uiProfile = {}; CATEGORIES.forEach(c => uiProfile[c] = Math.round(userProfile[c])/10);
  const bestRackets = getTopRackets(userProfile, matchMode);
  
  const overlay = document.createElement("div");
  overlay.id = "overlay";
  Object.assign(overlay.style, { position:"fixed", top:0, left:0, width:"100%", height:"100%", background:"rgba(255,255,255,0.98)", zIndex:4000, overflowY:"auto", padding:"20px", display:"flex", justifyContent:"center" });

  const card = document.createElement("div");
  card.style = "width:min(1100px, 95%); background:#fff; border-radius:20px; padding:25px; box-shadow:0 15px 40px rgba(0,0,0,0.1); height:fit-content; margin-bottom:50px;";
  
  card.innerHTML = `
    <h2 style="font-style:italic; font-weight:800; margin-top:0;">YOUR GAME</h2>
    <div style="background:#f8f9fa; padding:20px; border-radius:12px; border-left:5px solid #ffd700; margin-bottom:30px;">
        ${getHybridDescription(userProfile)}
    </div>

    <h2 style="font-style:italic; font-weight:800;">YOUR RACKET</h2>
    <div style="display:flex; gap:10px; margin-bottom:20px; flex-wrap:wrap;">
        <button id="m-neu" style="flex:1; min-width:120px; padding:12px; border-radius:10px; border:none; font-weight:700; cursor:pointer; background:${matchMode==='neutral'?'#ffd700':'#eee'}">MATCHING</button>
        <button id="m-str" style="flex:1; min-width:120px; padding:12px; border-radius:10px; border:none; font-weight:700; cursor:pointer; background:${matchMode==='strength'?'#2ea44f':'#eee'}; color:${matchMode==='strength'?'#fff':'#333'}">STÄRKEN</button>
        <button id="m-wek" style="flex:1; min-width:120px; padding:12px; border-radius:10px; border:none; font-weight:700; cursor:pointer; background:${matchMode==='weakness'?'#c92a2a':'#eee'}; color:${matchMode==='weakness'?'#fff':'#333'}">SCHWÄCHEN</button>
    </div>

    <div id="r-cont" style="display:flex; gap:15px; flex-wrap:wrap; justify-content:center; margin-bottom:30px; padding:15px; border:2px dashed #ddd; border-radius:15px;"></div>
    
    <div style="overflow-x:auto;">
        <table id="res-table" style="width:100%; border-collapse:collapse; font-size:0.95rem;">
            <thead><tr style="border-bottom:2px solid #111"><th style="text-align:left; padding:12px">Kategorie</th><th style="text-align:center">Dein Profil</th><th style="text-align:center">Schläger</th></tr></thead>
            <tbody></tbody>
        </table>
    </div>

    <button onclick="restartQuiz()" style="display:block; margin:40px auto 0; padding:15px 35px; background:#111; color:#fff; border:none; border-radius:10px; font-weight:700; cursor:pointer;">NEU STARTEN</button>
  `;

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  document.getElementById("m-neu").onclick = () => { matchMode="neutral"; showResults(); };
  document.getElementById("m-str").onclick = () => { matchMode="strength"; showResults(); };
  document.getElementById("m-wek").onclick = () => { matchMode="weakness"; showResults(); };

  const cont = document.getElementById("r-cont");
  bestRackets.forEach((r, idx) => {
    const d = document.createElement("div");
    d.style = `flex:1; min-width:240px; border:3px solid ${idx===selectedRacketIndex?'#111':'#eee'}; padding:15px; border-radius:12px; cursor:pointer; text-align:center; transition:0.2s; background:#fff`;
    d.innerHTML = `<img src="${r.img}" style="height:120px; object-fit:contain; margin-bottom:10px"><div style="font-weight:800">${r.name}</div><div style="font-size:0.8rem; color:#666">${r.stats.Weight}g | ${r.stats.Headsize}cm²</div>`;
    d.onclick = () => { selectedRacketIndex=idx; updateTable(r, uiProfile); highlightRacket(idx); };
    cont.appendChild(d);
  });
  updateTable(bestRackets[selectedRacketIndex], uiProfile);
}

function highlightRacket(idx) {
    Array.from(document.getElementById("r-cont").children).forEach((c, i) => c.style.borderColor = i===idx?"#111":"#eee");
}

function updateTable(r, p) {
  document.querySelector("#res-table tbody").innerHTML = CATEGORIES.map((cat, i) => `
    <tr style="border-bottom:1px solid #eee; background:${i%2===0?'#fff':'#fafafa'}">
        <td style="padding:12px">${cat}</td>
        <td style="text-align:center; font-weight:700; color:#444">${p[cat].toFixed(1)}</td>
        <td style="text-align:center; font-weight:700; color:#000">${r.stats[cat].toFixed(1)}</td>
    </tr>`).join("");
}

function renderProgress() {
  const b = document.getElementById("progress-bar"); if(!b) return; b.innerHTML = "";
  const total = questions[lang]?.length || 0;
  for(let i=0; i<total; i++) {
    const s = document.createElement("span");
    if(i < currentQuestion) s.classList.add("active");
    if(i === currentQuestion) s.style.background = "#000";
    b.appendChild(s);
  }
}

function restartQuiz() { const o=document.getElementById("overlay"); if(o) o.remove(); currentQuestion=0; matchMode="neutral"; initializeUserProfile(); showQuestion(); }

function createBackButton() {
  const b = document.createElement("div"); b.innerHTML="&#8617;";
  Object.assign(b.style, { position:"fixed", left:"20px", bottom:"20px", width:"45px", height:"45px", background:"#fff", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", boxShadow:"0 4px 10px rgba(0,0,0,0.1)", zIndex:1000 });
  b.onclick = () => { if(currentQuestion>0) { currentQuestion--; showQuestion(); } };
  document.body.appendChild(b);
}

function createImpressumHook() {
  const f = document.getElementById("footer-island");
  if(f) f.innerHTML = `<a href="impressum.html" target="_blank" style="color:#888; text-decoration:none; font-size:0.8rem">${lang==='de'?'Impressum':'Imprint'}</a>`;
}

function attachLangSwitchHandlers() {
  const d = document.getElementById("lang-de"); const e = document.getElementById("lang-en");
  if(d) d.onclick=() => { lang="de"; restartQuiz(); };
  if(e) e.onclick=() => { lang="en"; restartQuiz(); };
}

loadData();
