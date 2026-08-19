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
    if (!confirm('Alles zurücksetzen: Inhalte, Layout und Palette-Aktivierungen werden gelöscht. Fortfahren?')) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LAYOUT_STORAGE_KEY);
    localStorage.removeItem(PALETTE_STATE_KEY);
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

      // Snap-Ziele einmal beim Drag-Start sammeln (alle sichtbaren anderen Draggables)
      const snapTargets = collectSnapTargets(sheet, el, sheetRect);
      const guides = ensureSnapGuides(sheet);

      const isCircle = el.classList.contains('circle');
      const move = (ev) => {
        const dxPct = (ev.clientX - startX) / sheetRect.width * 100;
        const dyPct = (ev.clientY - startY) / sheetRect.height * 100;
        if (mode === 'move') {
          let newLeft = startLeftPct + dxPct;
          let newTop  = startTopPct  + dyPct;
          const snap = applySnap(newLeft, newTop, startWPct, startHPct, snapTargets);
          newLeft = snap.left;
          newTop  = snap.top;
          el.style.left = newLeft.toFixed(2) + '%';
          el.style.top  = newTop.toFixed(2)  + '%';
          showSnapGuides(guides, snap);
        } else if (isCircle) {
          const newW = Math.max(0.3, startWPct + dxPct);
          el.style.width  = newW.toFixed(2) + '%';
          el.style.height = '';
        } else {
          el.style.width  = Math.max(0.5, startWPct + dxPct).toFixed(2) + '%';
          el.style.height = Math.max(0.5, startHPct + dyPct).toFixed(2) + '%';
        }
      };
      const up = () => {
        el.classList.remove('dragging');
        hideSnapGuides(guides);
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        saveLayoutToLocalStorage();
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });
  });
}

// ============================================================
// Snap-Funktionen (Ausrichtung an anderen Feldern)
// ============================================================
const SNAP_THRESHOLD_PCT = 0.4; // ~0.85 mm auf A4-Breite

function collectSnapTargets(sheet, self, sheetRect) {
  const xs = [];
  const ys = [];
  document.querySelectorAll('.draggable').forEach(el => {
    if (el === self) return;
    // versteckte Palette-Elemente überspringen
    if (el.classList.contains('palette-field') && !el.classList.contains('pal-active')) return;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    const left   = (r.left  - sheetRect.left) / sheetRect.width  * 100;
    const right  = (r.right - sheetRect.left) / sheetRect.width  * 100;
    const cx     = (left + right) / 2;
    const top    = (r.top    - sheetRect.top) / sheetRect.height * 100;
    const bottom = (r.bottom - sheetRect.top) / sheetRect.height * 100;
    const cy     = (top + bottom) / 2;
    xs.push(left, right, cx);
    ys.push(top, bottom, cy);
  });
  return { xs, ys };
}

function applySnap(left, top, w, h, targets) {
  const result = { left, top, snapX: null, snapY: null };

  // Kandidaten des zu bewegenden Elements: linke Kante, Mitte, rechte Kante
  const candX = [left, left + w/2, left + w];
  let bestX = { delta: Infinity, target: null };
  candX.forEach((c, idx) => {
    targets.xs.forEach(t => {
      const d = t - c;
      if (Math.abs(d) < Math.abs(bestX.delta) && Math.abs(d) <= SNAP_THRESHOLD_PCT) {
        bestX = { delta: d, target: t };
      }
    });
  });
  if (bestX.target !== null) {
    result.left = left + bestX.delta;
    result.snapX = bestX.target;
  }

  const candY = [top, top + h/2, top + h];
  let bestY = { delta: Infinity, target: null };
  candY.forEach((c, idx) => {
    targets.ys.forEach(t => {
      const d = t - c;
      if (Math.abs(d) < Math.abs(bestY.delta) && Math.abs(d) <= SNAP_THRESHOLD_PCT) {
        bestY = { delta: d, target: t };
      }
    });
  });
  if (bestY.target !== null) {
    result.top = top + bestY.delta;
    result.snapY = bestY.target;
  }

  return result;
}

function ensureSnapGuides(sheet) {
  let v = sheet.querySelector('.snap-guide.vertical');
  let h = sheet.querySelector('.snap-guide.horizontal');
  if (!v) {
    v = document.createElement('div');
    v.className = 'snap-guide vertical';
    sheet.appendChild(v);
  }
  if (!h) {
    h = document.createElement('div');
    h.className = 'snap-guide horizontal';
    sheet.appendChild(h);
  }
  return { v, h };
}
function showSnapGuides(guides, snap) {
  if (snap.snapX !== null) {
    guides.v.style.left = snap.snapX + '%';
    guides.v.classList.add('active');
  } else {
    guides.v.classList.remove('active');
  }
  if (snap.snapY !== null) {
    guides.h.style.top = snap.snapY + '%';
    guides.h.classList.add('active');
  } else {
    guides.h.classList.remove('active');
  }
}
function hideSnapGuides(guides) {
  guides.v.classList.remove('active');
  guides.h.classList.remove('active');
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

  buildPalette();
  setupCalibrationDrag();
  loadLayoutFromLocalStorage();
  loadFromLocalStorage();
  restorePaletteState();
  recalcAll();
});

// ============================================================
// Feld-Palette (rechte Sidebar, K-Modus)
// ============================================================

// PALETTE_ITEMS enthält:
//   type: 'existing' → Element ist bereits im DOM (nur toggeln)
//   type: 'text' | 'number' | 'textarea' | 'circle' → wird dynamisch erzeugt
const PALETTE_ITEMS = [
  // ==== Kopf / Basis ====
  { id: 'char-name',   label: 'Charaktername',    type: 'existing', group: 'Kopf' },
  { id: 'char-level',  label: 'Charakterlevel',   type: 'existing', group: 'Kopf' },
  { sel: '.portrait-drop', id: 'portrait-drop', label: 'Portrait',    type: 'existing', group: 'Kopf' },
  { id: 'pal-class',       label: 'Klasse',               type: 'text',   group: 'Kopf', w: 18, h: 2.5 },
  { id: 'pal-subclass',    label: 'Unterklasse',          type: 'text',   group: 'Kopf', w: 18, h: 2.5 },
  { id: 'pal-species',     label: 'Spezies',              type: 'text',   group: 'Kopf', w: 15, h: 2.5 },
  { id: 'pal-background',  label: 'Hintergrund',          type: 'text',   group: 'Kopf', w: 15, h: 2.5 },
  { id: 'pal-alignment',   label: 'Ausrichtung',          type: 'text',   group: 'Kopf', w: 15, h: 2.5 },
  { id: 'pal-player-name', label: 'Spielername',          type: 'text',   group: 'Kopf', w: 15, h: 2.5 },
  { id: 'pal-xp',          label: 'Erfahrungspunkte',     type: 'number', group: 'Kopf', w: 8,  h: 2.5 },

  // ==== Attribute STR/DEX/CON/INT/WIS/CHA ====
  ...['str','dex','con','int','wis','cha'].flatMap(a => {
    const A = a.toUpperCase();
    return [
      { sel: `.field-${a}`,      id: `${a}-score`,     label: `${A} Wert`,             type: 'existing', group: A },
      { sel: `.mod-${a}`,        id: `${a}-mod`,       label: `${A} Modifikator`,      type: 'existing', group: A },
      { sel: `.save-${a}-check`, id: `${a}-save-check`,label: `${A} Rettungswurf-Übung`, type: 'existing', group: A },
      { sel: `.save-${a}`,       id: `${a}-save`,      label: `${A} Rettungswurf`,     type: 'existing', group: A },
    ];
  }),

  // ==== Werte-Boxen ====
  { sel: '.field-speed',      id: 'speed',              label: 'Bewegung',           type: 'existing', group: 'Werte' },
  { sel: '.field-initiative', id: 'initiative',         label: 'Initiative',         type: 'existing', group: 'Werte' },
  { sel: '.field-size',       id: 'size',               label: 'Größe',              type: 'existing', group: 'Werte' },
  { sel: '.field-passive',    id: 'passive-perception', label: 'Passive Wahrnehmung',type: 'existing', group: 'Werte' },
  { sel: '.field-hp-current', id: 'hp-current',         label: 'HP aktuell',         type: 'existing', group: 'Werte' },
  { sel: '.field-hp-max',     id: 'hp-max',             label: 'HP maximum',         type: 'existing', group: 'Werte' },
  { sel: '.field-ac',         id: 'ac',                 label: 'Rüstungsklasse (AC)',type: 'existing', group: 'Werte' },
  { sel: '.field-temp-hp',    id: 'temp-hp',            label: 'Temp HP',            type: 'existing', group: 'Werte' },
  { sel: '.field-prof-bonus', id: 'prof-bonus',         label: 'Übungsbonus',        type: 'existing', group: 'Werte' },
  { sel: '.field-hit-dice-current', id: 'hit-dice-current', label: 'Trefferwürfel aktuell', type: 'existing', group: 'Werte' },
  { sel: '.field-hit-dice-max',     id: 'hit-dice-max',     label: 'Trefferwürfel max',     type: 'existing', group: 'Werte' },
  { sel: '.field-inspiration',      id: 'inspiration',      label: 'Inspiration (Kreis)',   type: 'existing', group: 'Werte' },
  { sel: '.jack-of-all',            id: 'jack-of-all',      label: 'Alleskönner (Kreis)',   type: 'existing', group: 'Werte' },
  { sel: '.death-saves.failures',   id: 'ds-fails',         label: 'Todesrettung Fehler (3 Kreise)',  type: 'existing', group: 'Werte' },
  { sel: '.death-saves.successes',  id: 'ds-successes',     label: 'Todesrettung Erfolge (3 Kreise)', type: 'existing', group: 'Werte' },

  // ==== Skill-Prototypen (Kalibrierung; werden später auf 18 Skills geklont) ====
  { id: 'pal-skill-uebung',    label: 'Skill-Übung (Kreis)',     type: 'circle',   group: 'Skill-Prototyp', w: 1.4 },
  { id: 'pal-skill-expertise', label: 'Skill-Expertise (Kreis)', type: 'circle',   group: 'Skill-Prototyp', w: 1.4 },
  { id: 'pal-skill-value',     label: 'Skill-Wert (+0)',          type: 'text',     group: 'Skill-Prototyp', w: 4, h: 2 },

  // ==== Zauber ====
  { id: 'pal-spell-attr',  label: 'Zauber-Attribut',      type: 'text',   group: 'Zauber', w: 8, h: 2.5 },
  { id: 'pal-spell-dc',    label: 'Zauber-SG',            type: 'number', group: 'Zauber', w: 6, h: 2.5 },
  { id: 'pal-spell-atk',   label: 'Zauber-Angriffsbonus', type: 'number', group: 'Zauber', w: 6, h: 2.5 },

  // ==== Kompetenzen & Sprachen ====
  { id: 'pal-origin-feat', label: 'Herkunftstalent',      type: 'text',     group: 'Kompetenzen', w: 25, h: 2.5 },
  { id: 'pal-languages',   label: 'Sprachen',             type: 'textarea', group: 'Kompetenzen', w: 25, h: 6 },
  { id: 'pal-weapon-prof', label: 'Waffenkompetenzen',    type: 'textarea', group: 'Kompetenzen', w: 25, h: 6 },
  { id: 'pal-armor-prof',  label: 'Rüstungskompetenzen',  type: 'textarea', group: 'Kompetenzen', w: 25, h: 5 },
  { id: 'pal-tool-prof',   label: 'Werkzeugkompetenzen',  type: 'textarea', group: 'Kompetenzen', w: 25, h: 5 },

  // ==== Waffen / Klassenmerkmale ====
  { sel: '.weapons',  id: 'weapons-block',  label: 'Waffen-Tabelle (Block)',            type: 'existing', group: 'Blöcke' },
  { sel: '.features', id: 'features-block', label: 'Klassenmerkmale (Textblock)',       type: 'existing', group: 'Blöcke' },
  { sel: '.skills',   id: 'skills-block',   label: 'Skills-Container (Block)',          type: 'existing', group: 'Blöcke' },

  // ==== Münzen ====
  { id: 'pal-cp', label: 'Kupfer (K)',   type: 'number', group: 'Münzen', w: 6, h: 2.5 },
  { id: 'pal-sp', label: 'Silber (S)',   type: 'number', group: 'Münzen', w: 6, h: 2.5 },
  { id: 'pal-ep', label: 'Elektrum (E)', type: 'number', group: 'Münzen', w: 6, h: 2.5 },
  { id: 'pal-gp', label: 'Gold (G)',     type: 'number', group: 'Münzen', w: 6, h: 2.5 },
  { id: 'pal-pp', label: 'Platin (P)',   type: 'number', group: 'Münzen', w: 6, h: 2.5 },
];

const PALETTE_STATE_KEY = 'dnd-charakterbogen-palette-v1';

function resolveItemElement(item) {
  if (item.sel) return document.querySelector(item.sel);
  return document.getElementById(item.id);
}

function buildPalette() {
  const inputLayer = document.querySelector('.input-layer');
  const list = document.getElementById('palette-list');

  // Nach Gruppe sortieren
  const groups = {};
  PALETTE_ITEMS.forEach(item => {
    (groups[item.group] = groups[item.group] || []).push(item);
  });

  Object.entries(groups).forEach(([groupName, items]) => {
    const title = document.createElement('div');
    title.className = 'pal-group-title';
    title.textContent = groupName;
    list.appendChild(title);

    items.forEach(item => {
      let el = resolveItemElement(item);
      if (!el) {
        // Neu erstellen (nicht 'existing')
        el = createPaletteField(item);
        inputLayer.appendChild(el);
        DRAGGABLES.push({ sel: '#' + item.id, big: item.type === 'textarea' });
      }
      // Alle Palette-Elemente sind standardmäßig versteckt, bis der User sie aktiviert
      el.classList.add('palette-field');

      const row = document.createElement('label');
      row.innerHTML = `<input type="checkbox" data-pal-target="${item.id}" /> ${item.label}`;
      list.appendChild(row);
      row.querySelector('input').addEventListener('change', (e) => {
        togglePaletteItem(item, e.target.checked);
      });
    });
  });
}

function createPaletteField(item) {
  let el;
  switch (item.type) {
    case 'textarea':
      el = document.createElement('textarea');
      el.placeholder = item.label;
      break;
    case 'circle':
      el = document.createElement('label');
      el.innerHTML = `<input type="checkbox" data-save id="${item.id}-cb" />`;
      break;
    case 'number':
      el = document.createElement('input');
      el.type = 'number';
      el.placeholder = item.label;
      break;
    default:
      el = document.createElement('input');
      el.type = 'text';
      el.placeholder = item.label;
  }
  el.id = item.id;
  el.classList.add('palette-created');
  if (item.type === 'circle') el.classList.add('circle');
  if (item.type !== 'circle') el.setAttribute('data-save', '');
  el.style.left = '2%';
  el.style.top = '2%';
  el.style.width = item.w + '%';
  if (item.type !== 'circle' && item.h) el.style.height = item.h + '%';
  return el;
}

function togglePaletteItem(item, on) {
  const el = resolveItemElement(item);
  if (!el) return;
  el.classList.toggle('pal-active', on);
  savePaletteState();
  saveLayoutToLocalStorage();
}

function collectPaletteState() {
  const state = {};
  PALETTE_ITEMS.forEach(item => {
    const el = resolveItemElement(item);
    state[item.id] = el ? el.classList.contains('pal-active') : false;
  });
  return state;
}

function savePaletteState() {
  try { localStorage.setItem(PALETTE_STATE_KEY, JSON.stringify(collectPaletteState())); }
  catch (e) { console.warn(e); }
}

function restorePaletteState() {
  try {
    const raw = localStorage.getItem(PALETTE_STATE_KEY);
    if (!raw) return;
    const state = JSON.parse(raw);
    PALETTE_ITEMS.forEach(item => {
      const on = !!state[item.id];
      const el = resolveItemElement(item);
      if (el && on) el.classList.add('pal-active');
      const cb = document.querySelector(`[data-pal-target="${item.id}"]`);
      if (cb) cb.checked = on;
    });
  } catch (e) { console.warn(e); }
}
