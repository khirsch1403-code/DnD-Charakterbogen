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
      <input type="checkbox" id="skill-${s.id}-prof" data-save title="Übung" />
      <input type="checkbox" id="skill-${s.id}-exp"  data-save title="Expertise" />
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

  // Skills (Übung + Expertise; Expertise setzt Übung voraus im 5e-2024-Regelwerk)
  SKILLS.forEach((s) => {
    const prof = $(`skill-${s.id}-prof`).checked;
    const exp  = $(`skill-${s.id}-exp`).checked;
    let val = mods[s.attr];
    if (exp) val += pb * 2;
    else if (prof) val += pb;
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

  $('btn-export-layout').addEventListener('click', exportLayout);
  $('file-layout').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        applyLayout(JSON.parse(ev.target.result));
        saveLayoutToLocalStorage();
        alert('Layout geladen.');
      } catch (err) {
        alert('Layout-Datei konnte nicht gelesen werden: ' + err.message);
      }
    };
    reader.readAsText(file);
  });
}

// ============================================================
// Kalibrier-Drag & Layout
// ============================================================

// Alle verschiebbaren Elemente. Große Blöcke bekommen '.big' zusätzlich.
const DRAGGABLES = [
  { sel: '.field-name' }, { sel: '.field-level' },
  { sel: '.death-saves.failures', big: true }, { sel: '.death-saves.successes', big: true },
  { sel: '.field-str' }, { sel: '.mod-str' }, { sel: '.save-str-check' }, { sel: '.save-str' },
  { sel: '.field-dex' }, { sel: '.mod-dex' }, { sel: '.save-dex-check' }, { sel: '.save-dex' },
  { sel: '.field-con' }, { sel: '.mod-con' }, { sel: '.save-con-check' }, { sel: '.save-con' },
  { sel: '.field-int' }, { sel: '.mod-int' }, { sel: '.save-int-check' }, { sel: '.save-int' },
  { sel: '.field-wis' }, { sel: '.mod-wis' }, { sel: '.save-wis-check' }, { sel: '.save-wis' },
  { sel: '.field-cha' }, { sel: '.mod-cha' }, { sel: '.save-cha-check' }, { sel: '.save-cha' },
  { sel: '.portrait-drop', big: true },
  { sel: '.field-speed' }, { sel: '.field-initiative' },
  { sel: '.field-size' }, { sel: '.field-passive' },
  { sel: '.field-hp-current' }, { sel: '.field-hp-max' },
  { sel: '.field-ac' }, { sel: '.field-temp-hp' },
  { sel: '.field-prof-bonus' }, { sel: '.field-hit-dice-current' },
  { sel: '.field-hit-dice-max' }, { sel: '.field-inspiration' },
  { sel: '.jack-of-all' },
  { sel: '.skills', big: true }, { sel: '.weapons', big: true }, { sel: '.features', big: true },
  { sel: '.proto-prof' }, { sel: '.proto-exp' }, { sel: '.proto-value' },
];

const LAYOUT_STORAGE_KEY = 'dnd-charakterbogen-layout-v1';

function setupCalibrationDrag() {
  const sheet = document.getElementById('sheet');

  DRAGGABLES.forEach(({ sel, big }) => {
    const el = document.querySelector(sel);
    if (!el) return;
    el.classList.add('draggable');
    if (big) el.classList.add('big');
    el.dataset.selector = sel;

    el.addEventListener('mousedown', (e) => {
      if (!sheet.classList.contains('calibrate')) return;
      e.preventDefault();
      e.stopPropagation();

      const sheetRect = sheet.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const nearBR = (elRect.right - e.clientX < 14) && (elRect.bottom - e.clientY < 14);
      const mode = nearBR ? 'resize' : 'move';

      const startLeftPct = (elRect.left - sheetRect.left) / sheetRect.width * 100;
      const startTopPct  = (elRect.top  - sheetRect.top)  / sheetRect.height * 100;
      const startWPct    = elRect.width  / sheetRect.width * 100;
      const startHPct    = elRect.height / sheetRect.height * 100;
      const startX = e.clientX, startY = e.clientY;

      el.classList.add('dragging');

      const move = (ev) => {
        const dxPct = (ev.clientX - startX) / sheetRect.width * 100;
        const dyPct = (ev.clientY - startY) / sheetRect.height * 100;
        if (mode === 'move') {
          el.style.left = (startLeftPct + dxPct).toFixed(2) + '%';
          el.style.top  = (startTopPct  + dyPct).toFixed(2) + '%';
        } else {
          el.style.width  = Math.max(0.5, startWPct + dxPct).toFixed(2) + '%';
          el.style.height = Math.max(0.5, startHPct + dyPct).toFixed(2) + '%';
        }
      };
      const up = () => {
        el.classList.remove('dragging');
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        saveLayoutToLocalStorage();
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });
  });
}

function collectLayout() {
  const layout = {};
  DRAGGABLES.forEach(({ sel }) => {
    const el = document.querySelector(sel);
    if (!el) return;
    layout[sel] = {
      left: el.style.left || null,
      top: el.style.top || null,
      width: el.style.width || null,
      height: el.style.height || null,
    };
  });
  return layout;
}

function applyLayout(layout) {
  if (!layout) return;
  Object.entries(layout).forEach(([sel, css]) => {
    const el = document.querySelector(sel);
    if (!el || !css) return;
    ['left','top','width','height'].forEach((prop) => {
      if (css[prop]) el.style[prop] = css[prop];
    });
  });
}

function exportLayout() {
  const layout = collectLayout();
  const blob = new Blob([JSON.stringify(layout, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'layout.json';
  a.click();
  URL.revokeObjectURL(url);
}

function saveLayoutToLocalStorage() {
  try { localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(collectLayout())); }
  catch (e) { console.warn(e); }
}

function loadLayoutFromLocalStorage() {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (raw) applyLayout(JSON.parse(raw));
  } catch (e) { console.warn(e); }
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

  setupCalibrationDrag();
  loadLayoutFromLocalStorage();
  loadFromLocalStorage();
  recalcAll();
});
