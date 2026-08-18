// D&D 5e (2024) Charakterbogen — Automatische Berechnungen + Persistenz

const SKILLS = [
  { id: 'athletik',         name: 'Atletik',            attr: 'str' },
  { id: 'akrobatik',        name: 'Akrobatik',          attr: 'dex' },
  { id: 'fingerfertigkeit', name: 'Fingerfertigkeit',   attr: 'dex' },
  { id: 'heimlichkeit',     name: 'Heimlichkeit',       attr: 'dex' },
  { id: 'arkane-kunde',     name: 'Arkane Kunde',       attr: 'int' },
  { id: 'geschichte',       name: 'Geschichte',         attr: 'int' },
  { id: 'nachforschung',    name: 'Nachforschung',      attr: 'int' },
  { id: 'naturkunde',       name: 'Naturkunde',         attr: 'int' },
  { id: 'religion',         name: 'Religion',           attr: 'int' },
  { id: 'heilkunde',        name: 'Heilkunde',          attr: 'wis' },
  { id: 'tiere',            name: 'Mit Tieren umgehen', attr: 'wis' },
  { id: 'motiv',            name: 'Motiv erkennen',     attr: 'wis' },
  { id: 'ueberleben',       name: 'Überlebenskunst',    attr: 'wis' },
  { id: 'wahrnehmung',      name: 'Wahrnehmung',        attr: 'wis' },
  { id: 'auftreten',        name: 'Auftreten',          attr: 'cha' },
  { id: 'einschuechtern',   name: 'Einschüchtern',      attr: 'cha' },
  { id: 'taeuschen',        name: 'Täuschen',           attr: 'cha' },
  { id: 'ueberzeugen',      name: 'Überzeugen',         attr: 'cha' },
];

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const STORAGE_KEY = 'dnd-charakterbogen-v1';

// ---- Helpers ----
const $ = (id) => document.getElementById(id);
const fmt = (n) => (n >= 0 ? `+${n}` : `${n}`);
const abilityMod = (score) => Math.floor(((parseInt(score) || 10) - 10) / 2);
const proficiencyBonus = (level) => {
  const l = Math.max(1, Math.min(20, parseInt(level) || 1));
  return Math.ceil(l / 4) + 1; // 1-4:2, 5-8:3, 9-12:4, 13-16:5, 17-20:6
};

// ---- Skills UI ----
function buildSkillsUI() {
  const container = $('skills');
  SKILLS.forEach((s) => {
    const row = document.createElement('div');
    row.className = 'skill-row';
    row.innerHTML = `
      <label><input type="checkbox" id="skill-${s.id}-prof" data-save /></label>
      <span class="skill-name">${s.name}</span>
      <span class="skill-value" id="skill-${s.id}-value">+0</span>
    `;
    container.appendChild(row);
  });
}

// ---- Berechnungen ----
function recalcAll() {
  const level = parseInt($('char-level').value) || 1;
  const pb = proficiencyBonus(level);
  const jack = $('jack-of-all').checked;
  const jackBonus = Math.floor(pb / 2);

  $('prof-bonus').textContent = fmt(pb);

  // Ability mods + saves
  const mods = {};
  ABILITIES.forEach((a) => {
    const score = parseInt($(`${a}-score`).value) || 10;
    const mod = abilityMod(score);
    mods[a] = mod;
    $(`${a}-mod`).textContent = fmt(mod);
    const saveProf = $(`${a}-save-prof`).checked;
    $(`${a}-save`).textContent = fmt(mod + (saveProf ? pb : 0));
  });

  // Initiative
  $('initiative').textContent = fmt(mods.dex);

  // Passive Wahrnehmung (10 + WIS mod + PB wenn geübt in Wahrnehmung)
  const perceptionProf = $('skill-wahrnehmung-prof').checked;
  let passive = 10 + mods.wis + (perceptionProf ? pb : (jack ? jackBonus : 0));
  $('passive-perception').textContent = passive;

  // Skills
  SKILLS.forEach((s) => {
    const prof = $(`skill-${s.id}-prof`).checked;
    let val = mods[s.attr];
    if (prof) val += pb;
    else if (jack) val += jackBonus;
    $(`skill-${s.id}-value`).textContent = fmt(val);
  });
}

// ---- Persistenz ----
function collectState() {
  const state = {};
  document.querySelectorAll('[data-save]').forEach((el) => {
    if (el.type === 'checkbox') state[el.id] = el.checked;
    else state[el.id] = el.value;
  });
  // Portrait
  const img = $('portrait-img');
  if (img.src && img.src.startsWith('data:')) state.__portrait = img.src;
  return state;
}

function applyState(state) {
  if (!state) return;
  document.querySelectorAll('[data-save]').forEach((el) => {
    if (!(el.id in state)) return;
    if (el.type === 'checkbox') el.checked = !!state[el.id];
    else el.value = state[el.id];
  });
  if (state.__portrait) {
    const img = $('portrait-img');
    img.src = state.__portrait;
    $('portrait-drop').classList.add('has-image');
  }
  recalcAll();
}

function saveToLocalStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collectState()));
  } catch (e) {
    console.warn('LocalStorage voll oder blockiert', e);
  }
}

function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    applyState(JSON.parse(raw));
  } catch (e) {
    console.warn('LocalStorage laden fehlgeschlagen', e);
  }
}

// ---- Portrait Upload ----
function setupPortrait() {
  const drop = $('portrait-drop');
  const input = $('portrait-input');
  const img = $('portrait-img');

  const readFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target.result;
      drop.classList.add('has-image');
      saveToLocalStorage();
    };
    reader.readAsDataURL(file);
  };

  input.addEventListener('change', (e) => readFile(e.target.files[0]));

  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.classList.add('drag-over');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag-over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('drag-over');
    readFile(e.dataTransfer.files[0]);
  });
}

// ---- Toolbar ----
function setupToolbar() {
  $('btn-save').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(collectState(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const name = ($('char-name').value || 'charakter').replace(/[^a-z0-9äöüß_\- ]/gi, '').trim() || 'charakter';
    a.href = url;
    a.download = `${name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  $('file-load').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        applyState(JSON.parse(ev.target.result));
        saveToLocalStorage();
      } catch (err) {
        alert('Datei konnte nicht gelesen werden: ' + err.message);
      }
    };
    reader.readAsText(file);
  });

  $('btn-print').addEventListener('click', () => window.print());

  $('btn-reset').addEventListener('click', () => {
    if (!confirm('Alle Eingaben zurücksetzen?')) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  });

  const toggleCalibrate = () => document.getElementById('sheet').classList.toggle('calibrate');
  $('btn-calibrate').addEventListener('click', toggleCalibrate);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'k' || e.key === 'K') {
      if (document.activeElement && ['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) return;
      toggleCalibrate();
    }
  });
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  buildSkillsUI();
  setupPortrait();
  setupToolbar();

  // Änderungen abonnieren
  document.addEventListener('input', () => {
    recalcAll();
    saveToLocalStorage();
  });
  document.addEventListener('change', () => {
    recalcAll();
    saveToLocalStorage();
  });

  loadFromLocalStorage();
  recalcAll();
});
