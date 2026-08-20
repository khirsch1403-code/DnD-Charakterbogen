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
// Merged Skills: jede Fertigkeit hat 2 Kreise (Übung, Expertise) und 1 Wert.
// Ein Klick auf einen Kreis zykliert den gemeinsamen Zustand:
//   0 = leer, 1 = Übung, 2 = Übung + Expertise, dann zurück auf 0.
// Positionen leiten sich vom Skill-Prototyp (Palette) und einer Zeilen-
// Schrittgröße ab; die Reihen sind gleichmäßig auf den Skill-Bereich verteilt.
const SKILL_ROW_STEP = 1.62; // % pro Zeile (18 Skills = ~29% vertikal)
const skillStates = {};      // { skill-id: 0|1|2 }

function buildSkillsUI() {
  const container = $('skills');
  container.innerHTML = '';

  const proto = {
    u:  PALETTE_ITEMS.find(i => i.id === 'pal-skill-uebung'),
    e:  PALETTE_ITEMS.find(i => i.id === 'pal-skill-expertise'),
    v:  PALETTE_ITEMS.find(i => i.id === 'pal-skill-value'),
  };
  const uL = parseFloat(proto.u.defaultLeft);
  const uT = parseFloat(proto.u.defaultTop);
  const eL = parseFloat(proto.e.defaultLeft);
  const eT = parseFloat(proto.e.defaultTop);
  const vL = parseFloat(proto.v.defaultLeft);
  const vT = parseFloat(proto.v.defaultTop);
  const uW = proto.u.w;
  const eW = proto.e.w;
  const vW = proto.v.w;
  const vH = proto.v.h;

  SKILLS.forEach((s, idx) => {
    const yOff = idx * SKILL_ROW_STEP;

    // Übung-Kreis (rendert schwarz gefüllt bei state >= 1)
    const prof = document.createElement('label');
    prof.className = 'skill-cell circle skill-prof';
    prof.id = `skill-${s.id}-prof-cell`;
    prof.style.left = uL + '%';
    prof.style.top  = (uT + yOff) + '%';
    prof.style.width = uW + '%';
    prof.innerHTML = `<input type="checkbox" tabindex="-1" />`;
    container.appendChild(prof);

    // Expertise-Kreis
    const exp = document.createElement('label');
    exp.className = 'skill-cell circle skill-exp';
    exp.id = `skill-${s.id}-exp-cell`;
    exp.style.left = eL + '%';
    exp.style.top  = (eT + yOff) + '%';
    exp.style.width = eW + '%';
    exp.innerHTML = `<input type="checkbox" tabindex="-1" />`;
    container.appendChild(exp);

    // Unsichtbare Klickfläche über beide Kreise (bequem zu treffen)
    const hit = document.createElement('div');
    hit.className = 'skill-cell skill-hit';
    hit.dataset.skillId = s.id;
    const hitLeft = Math.min(uL, eL);
    const hitRight = Math.max(uL + uW, eL + eW);
    hit.style.left = hitLeft + '%';
    hit.style.top  = (Math.min(uT, eT) + yOff) + '%';
    hit.style.width = (hitRight - hitLeft) + '%';
    hit.style.height = Math.max(uW, eW) + '%';
    hit.addEventListener('click', () => {
      if (document.getElementById('sheet').classList.contains('calibrate')) return;
      cycleSkill(s.id);
    });
    container.appendChild(hit);

    // Wert-Anzeige (+0)
    const val = document.createElement('div');
    val.className = 'skill-cell skill-value';
    val.id = `skill-${s.id}-value`;
    val.style.left = vL + '%';
    val.style.top  = (vT + yOff) + '%';
    val.style.width = vW + '%';
    val.style.height = vH + '%';
    val.textContent = '+0';
    container.appendChild(val);

    if (!(s.id in skillStates)) skillStates[s.id] = 0;
    updateSkillVisual(s.id);
  });
}

function cycleSkill(id) {
  skillStates[id] = (skillStates[id] + 1) % 3;
  updateSkillVisual(id);
  recalcAll();
  saveToLocalStorage();
}

function updateSkillVisual(id) {
  const state = skillStates[id] || 0;
  const profCB = document.querySelector(`#skill-${id}-prof-cell input`);
  const expCB  = document.querySelector(`#skill-${id}-exp-cell input`);
  if (profCB) profCB.checked = state >= 1;
  if (expCB)  expCB.checked  = state >= 2;
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
  const perceptionState = skillStates['wahrnehmung'] || 0;
  const perceptionProf = perceptionState >= 1;
  const perceptionExp  = perceptionState >= 2;
  let passiveBonus = 0;
  if (perceptionExp) passiveBonus = pb * 2;
  else if (perceptionProf) passiveBonus = pb;
  else if (jack) passiveBonus = jackBonus;
  $('passive-perception').textContent = 10 + mods.wis + passiveBonus;

  // Skills nach dem Cycle-Zustand (0/1/2)
  SKILLS.forEach((s) => {
    const state = skillStates[s.id] || 0;
    let val = mods[s.attr];
    if (state === 2) val += pb * 2;
    else if (state === 1) val += pb;
    else if (jack) val += jackBonus;
    const el = document.getElementById(`skill-${s.id}-value`);
    if (el) el.textContent = fmt(val);
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
  // Skill-Cycling-Zustände
  state.__skillStates = { ...skillStates };
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
  if (state.__skillStates) {
    Object.assign(skillStates, state.__skillStates);
    SKILLS.forEach((s) => updateSkillVisual(s.id));
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
  const snapToggle = $('btn-snap');
  if (snapToggle) {
    SNAP_ENABLED = snapToggle.checked;
    snapToggle.addEventListener('change', (e) => { SNAP_ENABLED = e.target.checked; });
  }
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
  { sel: '.ds-f1' }, { sel: '.ds-f2' }, { sel: '.ds-f3' },
  { sel: '.ds-s1' }, { sel: '.ds-s2' }, { sel: '.ds-s3' },
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
  { sel: '.skills', big: true },
  { sel: '.wc-name' },  { sel: '.wc-bonus' }, { sel: '.wc-damage' },
  { sel: '.wc-type' },  { sel: '.wc-note' },
  { sel: '.features', big: true },
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

      const isSquareShape = el.classList.contains('circle')
                          || el.classList.contains('diamond')
                          || el.classList.contains('xmark');
      const isCircle = isSquareShape;
      const move = (ev) => {
        const dxPct = (ev.clientX - startX) / sheetRect.width * 100;
        const dyPct = (ev.clientY - startY) / sheetRect.height * 100;
        if (mode === 'move') {
          let newLeft = startLeftPct + dxPct;
          let newTop  = startTopPct  + dyPct;
          const snap = SNAP_ENABLED
            ? applySnap(newLeft, newTop, startWPct, startHPct, snapTargets)
            : { left: newLeft, top: newTop, snapX: null, snapY: null };
          newLeft = snap.left;
          newTop  = snap.top;
          // Innerhalb des Bogens halten – so kann nichts "verschwinden"
          newLeft = Math.max(0, Math.min(100 - startWPct, newLeft));
          newTop  = Math.max(0, Math.min(100 - startHPct, newTop));
          el.style.left = newLeft.toFixed(2) + '%';
          el.style.top  = newTop.toFixed(2)  + '%';
          showSnapGuides(guides, snap);
        } else if (isCircle) {
          // Kreise: min 0.8% Breite (~1.7mm) damit sie greifbar bleiben
          const newW = Math.max(0.8, startWPct + dxPct);
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
let SNAP_ENABLED = true;

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
  { id: 'pal-class',       label: 'Klasse',               type: 'text',   group: 'Kopf', w: 18, h: 2.5, defaultLeft: '21.3%',  defaultTop: '4.48%' },
  { id: 'pal-subclass',    label: 'Unterklasse',          type: 'text',   group: 'Kopf', w: 18, h: 2.5, defaultLeft: '61.09%', defaultTop: '4.58%' },
  { id: 'pal-species',     label: 'Spezies',              type: 'text',   group: 'Kopf', w: 15, h: 2.5 },
  { id: 'pal-background',  label: 'Hintergrund',          type: 'text',   group: 'Kopf', w: 15, h: 2.5 },
  { id: 'pal-alignment',   label: 'Ausrichtung',          type: 'text',   group: 'Kopf', w: 15, h: 2.5 },
  { id: 'pal-player-name', label: 'Spielername',          type: 'text',   group: 'Kopf', w: 15, h: 2.5 },
  { id: 'pal-xp',          label: 'Erfahrungspunkte',     type: 'number', group: 'Kopf', w: 8,  h: 2.5 },

  // ==== Attribute STR/DEX/CON/INT/WIS/CHA ====
  ...(() => {
    // Defaults für die Rettungswurf-Übungs-Kreise (aus CSS)
    const SAVE_CHECK_DEFAULTS = {
      str: { l: '8.05%',  t: '25.76%' },
      dex: { l: '8.42%',  t: '38.52%' },
      con: { l: '8.42%',  t: '51.31%' },
      int: { l: '85.51%', t: '25.04%' },
      wis: { l: '85.51%', t: '37.90%' },
      cha: { l: '85.64%', t: '50.69%' },
    };
    return ['str','dex','con','int','wis','cha'].flatMap(a => {
      const A = a.toUpperCase();
      const sc = SAVE_CHECK_DEFAULTS[a];
      return [
        { sel: `.field-${a}`,      id: `${a}-score`,     label: `${A} Wert`,             type: 'existing', group: A },
        { sel: `.mod-${a}`,        id: `${a}-mod`,       label: `${A} Modifikator`,      type: 'existing', group: A },
        { sel: `.save-${a}-check`, id: `${a}-save-check`,label: `${A} Rettungswurf-Übung (Kreis)`, type: 'existing', group: A,
          defaultLeft: sc.l, defaultTop: sc.t, w: 1.62 },
        { sel: `.save-${a}`,       id: `${a}-save`,      label: `${A} Rettungswurf`,     type: 'existing', group: A },
      ];
    });
  })(),

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
  { sel: '.ds-f1', id: 'ds-f1-cell', label: 'Todesrettung Fehler 1 (X)', type: 'existing', group: 'Werte' },
  { sel: '.ds-f2', id: 'ds-f2-cell', label: 'Todesrettung Fehler 2 (X)', type: 'existing', group: 'Werte' },
  { sel: '.ds-f3', id: 'ds-f3-cell', label: 'Todesrettung Fehler 3 (X)', type: 'existing', group: 'Werte' },
  { sel: '.ds-s1', id: 'ds-s1-cell', label: 'Todesrettung Erfolg 1 (X)', type: 'existing', group: 'Werte' },
  { sel: '.ds-s2', id: 'ds-s2-cell', label: 'Todesrettung Erfolg 2 (X)', type: 'existing', group: 'Werte' },
  { sel: '.ds-s3', id: 'ds-s3-cell', label: 'Todesrettung Erfolg 3 (X)', type: 'existing', group: 'Werte' },
  { id: 'pal-shield', label: 'Schild (Raute, +2 auf AC)', type: 'diamond', group: 'Werte', w: 1.62, defaultLeft: '49.01%', defaultTop: '50.44%' },

  // ==== Skill-Prototypen (Kalibrierung; werden später auf 18 Skills geklont) ====
  { id: 'pal-skill-uebung',    label: 'Skill-Übung (Kreis)',     type: 'circle', group: 'Skill-Prototyp', w: 1.62, defaultLeft: '4.85%',  defaultTop: '69.05%' },
  { id: 'pal-skill-expertise', label: 'Skill-Expertise (Kreis)', type: 'circle', group: 'Skill-Prototyp', w: 1.62, defaultLeft: '6.08%',  defaultTop: '69.05%' },
  { id: 'pal-skill-value',     label: 'Skill-Wert (+0)',          type: 'text',  group: 'Skill-Prototyp', w: 4.63, h: 1.82, defaultLeft: '30.03%', defaultTop: '68.62%' },

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

  // ==== Waffen-Spalten (jede einzeln positioniert & skaliert) ====
  { sel: '.wc-name',   id: 'wc-name',   label: 'Waffen — Name-Spalte',   type: 'existing', group: 'Waffen' },
  { sel: '.wc-bonus',  id: 'wc-bonus',  label: 'Waffen — Bonus-Spalte',  type: 'existing', group: 'Waffen' },
  { sel: '.wc-damage', id: 'wc-damage', label: 'Waffen — Schaden-Spalte',type: 'existing', group: 'Waffen' },
  { sel: '.wc-type',   id: 'wc-type',   label: 'Waffen — Art-Spalte',    type: 'existing', group: 'Waffen' },
  { sel: '.wc-note',   id: 'wc-note',   label: 'Waffen — Notiz-Spalte',  type: 'existing', group: 'Waffen' },

  // ==== Klassenmerkmale / Skills-Container ====
  { sel: '.features', id: 'features-block', label: 'Klassenmerkmale (Textblock)', type: 'existing', group: 'Blöcke' },
  { sel: '.skills',   id: 'skills-block',   label: 'Skills (alle 18 Fertigkeiten)', type: 'existing', group: 'Blöcke' },

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

      const row = document.createElement('div');
      row.className = 'palette-row';
      row.innerHTML = `
        <label><input type="checkbox" data-pal-target="${item.id}" /> ${item.label}</label>
        <button type="button" class="pal-recall" title="An Startposition holen (2%/2%)">↺</button>
      `;
      list.appendChild(row);
      row.querySelector('input').addEventListener('change', (e) => {
        togglePaletteItem(item, e.target.checked);
      });
      row.querySelector('.pal-recall').addEventListener('click', () => {
        recallPaletteItem(item);
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
    case 'diamond':
    case 'xmark':
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
  const shapeTypes = ['circle', 'diamond', 'xmark'];
  if (shapeTypes.includes(item.type)) el.classList.add(item.type);
  if (!shapeTypes.includes(item.type)) el.setAttribute('data-save', '');
  el.style.left = item.defaultLeft || '2%';
  el.style.top  = item.defaultTop  || '2%';
  el.style.width = item.w + '%';
  if (!shapeTypes.includes(item.type) && item.h) el.style.height = item.h + '%';
  return el;
}

function togglePaletteItem(item, on) {
  const el = resolveItemElement(item);
  if (!el) return;
  el.classList.toggle('pal-active', on);
  if (on) {
    normalizeShapeSize(el, item);
    ensureVisible(el);
  }
  savePaletteState();
  saveLayoutToLocalStorage();
}

// Formen (circle/diamond/xmark) bei EXPLIZITER Aktivierung via Palette-
// Checkbox: immer Default-Breite. So bekommt der User eine vorhersagbare
// Ausgangsgröße (Skill-Prototyp-Maß 1.62%).
function normalizeShapeSize(el, item) {
  const isShape = el.classList.contains('circle')
               || el.classList.contains('diamond')
               || el.classList.contains('xmark');
  if (!isShape) return;
  const w = (item && item.w) ? item.w : 1.62;
  el.style.width  = w + '%';
  el.style.height = '';
}

// Heilung beim Seitenneuladen: nur zurücksetzen, wenn eine Form so kaputt
// ist, dass sie den Bogen überdecken würde. Ansonsten vom User gezogene
// Größen NICHT antasten.
function healBrokenShapeSize(el, item) {
  const isShape = el.classList.contains('circle')
               || el.classList.contains('diamond')
               || el.classList.contains('xmark');
  if (!isShape) return;
  const sheetRect = document.getElementById('sheet').getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const broken = r.width > sheetRect.width * 0.15 || r.width < 2;
  if (broken) {
    el.style.width  = ((item && item.w) || 1.62) + '%';
    el.style.height = '';
  }
}

// Recall: Feld an sichtbare Startposition (Default oder mittig) holen,
// Größe auf sinnvollen Wert zurücksetzen und aktivieren.
function recallPaletteItem(item) {
  const el = resolveItemElement(item);
  if (!el) return;
  el.style.left = item.defaultLeft || '45%';
  el.style.top  = item.defaultTop  || '45%';
  // Größe zurücksetzen (nur wenn item.w bekannt, sonst CSS-Default)
  if (item.w) el.style.width = item.w + '%';
  else el.style.width = '';
  if (el.classList.contains('circle') || el.classList.contains('diamond') || el.classList.contains('xmark')) {
    el.style.height = '';               // 1:1-Formen: Höhe aus aspect-ratio
    if (!item.w) el.style.width = '2%';  // Mindestgröße für Sichtbarkeit
  } else if (item.h) {
    el.style.height = item.h + '%';
  } else {
    el.style.height = '';
  }
  el.classList.add('pal-active');
  const cb = document.querySelector(`[data-pal-target="${item.id}"]`);
  if (cb) cb.checked = true;
  savePaletteState();
  saveLayoutToLocalStorage();
}

// Falls Feld außerhalb des Bogens sitzt, an sichtbaren Rand holen
function ensureVisible(el) {
  const sheet = document.getElementById('sheet');
  const sheetRect = sheet.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const outside =
    r.right  < sheetRect.left  + 2 ||
    r.left   > sheetRect.right - 2 ||
    r.bottom < sheetRect.top   + 2 ||
    r.top    > sheetRect.bottom- 2 ||
    r.width  < 1 || r.height < 1;
  if (outside) {
    el.style.left = '2%';
    el.style.top  = '2%';
  }
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
      if (el && on) {
        el.classList.add('pal-active');
        // Nach dem Anzeigen prüfen: nur wirklich kaputte Größen heilen
        requestAnimationFrame(() => {
          healBrokenShapeSize(el, item);
          ensureVisible(el);
        });
      }
      const cb = document.querySelector(`[data-pal-target="${item.id}"]`);
      if (cb) cb.checked = on;
    });
  } catch (e) { console.warn(e); }
}
