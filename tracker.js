/* =============================================================
   SMZ3 Tracker — state, rendering, persistence
   ============================================================= */

// Reference logic via namespace — cannot use same names as logic.js
// because both scripts share global scope when loaded via <script> tags.
const LOGIC = window.SMZ3Logic;
const ST = LOGIC.STATE;
const ALL_DUNGEONS = LOGIC.DUNGEONS;
const ALL_LOCATIONS = LOGIC.LOCATIONS;

const STORAGE_KEY = 'smz3-tracker-state-v1';

/* ---------- Item catalogs ---------- */

// ALttP items. kind: 'bool' | 'level' (cycles 0..max)
const Z3_ITEMS = [
  { id: 'bow',       kind: 'level', max: 2, label: 'Bow',       glyph: '⤭', tip: 'Bow → Silvers' },
  { id: 'boomerang', kind: 'level', max: 3, label: 'Boomer.',   glyph: '↺', tip: 'Blue → Red → Both' },
  { id: 'hookshot',  kind: 'bool',           label: 'Hookshot', glyph: '⚓' },
  { id: 'mushroom',  kind: 'bool',           label: 'Mushroom', glyph: '✿' },
  { id: 'powder',    kind: 'bool',           label: 'Powder',   glyph: '❋' },
  { id: 'firerod',   kind: 'bool',           label: 'Fire Rod', glyph: '🜂' },
  { id: 'icerod',    kind: 'bool',           label: 'Ice Rod',  glyph: '❄' },
  { id: 'bombos',    kind: 'bool',           label: 'Bombos',   glyph: 'B' },
  { id: 'ether',     kind: 'bool',           label: 'Ether',    glyph: 'E' },
  { id: 'quake',     kind: 'bool',           label: 'Quake',    glyph: 'Q' },
  { id: 'lantern',   kind: 'bool',           label: 'Lantern',  glyph: '☼' },
  { id: 'hammer',    kind: 'bool',           label: 'Hammer',   glyph: '⚒' },
  { id: 'shovel',    kind: 'bool',           label: 'Shovel',   glyph: '⛏' },
  { id: 'flute',     kind: 'bool',           label: 'Flute',    glyph: '♫' },
  { id: 'book',      kind: 'bool',           label: 'Book',     glyph: '❢' },
  { id: 'bottle',    kind: 'level', max: 4, label: 'Bottle',   glyph: '◉', tip: 'Up to 4 bottles' },
  { id: 'somaria',   kind: 'bool',           label: 'Somaria',  glyph: '⌬' },
  { id: 'byrna',     kind: 'bool',           label: 'Byrna',    glyph: '✦' },
  { id: 'cape',      kind: 'bool',           label: 'Cape',     glyph: '▽' },
  { id: 'mirror',    kind: 'bool',           label: 'Mirror',   glyph: '◈' },
  { id: 'sword',     kind: 'level', max: 4, label: 'Sword',    glyph: '†', tip: 'Fighter → Master → Tempered → Gold' },
  { id: 'moonpearl', kind: 'bool',           label: 'M.Pearl',  glyph: '◐' },
  { id: 'flippers',  kind: 'bool',           label: 'Flippers', glyph: '~' },
  { id: 'boots',     kind: 'bool',           label: 'Boots',    glyph: '»' },
  { id: 'glove',     kind: 'level', max: 2, label: 'Glove',    glyph: '✊', tip: 'Power → Titan' },
  { id: 'bombs',     kind: 'bool',           label: 'Bombs',    glyph: '●' },
];

// Super Metroid items
const SM_ITEMS = [
  { id: 'missile',  kind: 'bool', label: 'Missile', glyph: 'M' },
  { id: 'super',    kind: 'bool', label: 'Super',   glyph: 'S' },
  { id: 'pb',       kind: 'bool', label: 'PBomb',   glyph: 'PB' },
  { id: 'grapple',  kind: 'bool', label: 'Grapple', glyph: '⟿' },
  { id: 'xray',     kind: 'bool', label: 'X-Ray',   glyph: '✕' },
  { id: 'charge',   kind: 'bool', label: 'Charge',  glyph: '◎' },
  { id: 'wave',     kind: 'bool', label: 'Wave',    glyph: '∿' },
  { id: 'ice',      kind: 'bool', label: 'Ice',     glyph: '❋' },
  { id: 'spazer',   kind: 'bool', label: 'Spazer',  glyph: '=' },
  { id: 'plasma',   kind: 'bool', label: 'Plasma',  glyph: '⚡' },
  { id: 'varia',    kind: 'bool', label: 'Varia',   glyph: 'V' },
  { id: 'gravity',  kind: 'bool', label: 'Gravity', glyph: 'G' },
  { id: 'morph',    kind: 'bool', label: 'Morph',   glyph: '◉' },
  { id: 'bombs_sm', kind: 'bool', label: 'Bombs',   glyph: '◎' },
  { id: 'hijump',   kind: 'bool', label: 'HiJump',  glyph: '↟' },
  { id: 'speed',    kind: 'bool', label: 'Speed',   glyph: '»' },
  { id: 'space',    kind: 'bool', label: 'Space J', glyph: '↑' },
  { id: 'spring',   kind: 'bool', label: 'Spring',  glyph: '◴' },
  { id: 'screw',    kind: 'bool', label: 'Screw',   glyph: '✱' },
];

const SM_BOSSES = [
  { id: 'kraid',       kind: 'bool', label: 'Kraid',    glyph: 'K' },
  { id: 'phantoon',    kind: 'bool', label: 'Phantoon', glyph: 'P' },
  { id: 'draygon',     kind: 'bool', label: 'Draygon',  glyph: 'D' },
  { id: 'ridley',      kind: 'bool', label: 'Ridley',   glyph: 'R' },
  { id: 'motherbrain', kind: 'bool', label: 'Mother B', glyph: 'MB' },
];

const AGAHNIM = [
  { id: 'aga', kind: 'bool', label: 'Agahnim', glyph: 'A' },
];

/* ---------- Default state ---------- */

function defaultState() {
  const items = {};
  [...Z3_ITEMS, ...SM_ITEMS, ...SM_BOSSES, ...AGAHNIM].forEach(it => {
    items[it.id] = it.kind === 'level' ? 0 : false;
  });

  const dungeons = {};
  Object.entries(ALL_DUNGEONS).forEach(([id, d]) => {
    dungeons[id] = {
      chests: d.totalChests,
      boss:   false,
      prize:  0,        // 0=unknown, 1=green, 2=red/blue, 3=crystal, 4=red crystal
      medallion: 0,     // 0=unknown, 1=bombos, 2=ether, 3=quake
    };
  });

  const checked = {}; // checked[locId] = true

  return {
    items,
    dungeons,
    checked,
    settings: {
      mode: 'standard',
      glitches: false,
      darkrooms: true,
    },
    v: 1,
  };
}

/* ---------- State mgmt ---------- */

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    // merge with defaults in case new items were added across versions
    const def = defaultState();
    return {
      items:    { ...def.items, ...parsed.items },
      dungeons: mergeDungeons(def.dungeons, parsed.dungeons || {}),
      checked:  parsed.checked || {},
      settings: { ...def.settings, ...(parsed.settings || {}) },
      v: 1,
    };
  } catch (e) {
    console.warn('State load failed, resetting:', e);
    return defaultState();
  }
}

function mergeDungeons(defD, savedD) {
  const out = {};
  Object.keys(defD).forEach(id => {
    out[id] = { ...defD[id], ...(savedD[id] || {}) };
  });
  return out;
}

let saveTimer = null;
function saveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      flashSaved();
    } catch (e) {
      console.warn('Save failed:', e);
    }
  }, 150);
}

function flashSaved() {
  const el = document.getElementById('saved-indicator');
  if (!el) return;
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 300);
}

/* ---------- Rendering: items ---------- */

function renderItemGrid(hostId, catalog, isBoss = false) {
  const host = document.getElementById(hostId);
  host.innerHTML = '';
  catalog.forEach(it => {
    const v = state.items[it.id];
    const on = it.kind === 'level' ? v > 0 : !!v;

    const el = document.createElement('div');
    el.className = 'item' + (on ? ' on' : '') + (isBoss ? ' boss-item' : '');
    el.dataset.id = it.id;
    if (it.tip) el.title = it.tip;

    if (it.kind === 'level') {
      const level = document.createElement('span');
      level.className = 'level';
      level.textContent = v;
      el.appendChild(level);
    }

    const glyph = document.createElement('span');
    glyph.className = 'glyph';
    glyph.textContent = it.glyph;
    el.appendChild(glyph);

    const lab = document.createElement('span');
    lab.className = 'label';
    lab.textContent = it.label;
    el.appendChild(lab);

    el.addEventListener('click', () => {
      if (it.kind === 'level') {
        state.items[it.id] = (state.items[it.id] + 1) % (it.max + 1);
      } else {
        state.items[it.id] = !state.items[it.id];
      }
      saveState();
      rerenderAll();
    });

    host.appendChild(el);
  });
}

/* ---------- Rendering: dungeons ---------- */

function renderDungeons() {
  const host = document.getElementById('z3-dungeons');
  host.innerHTML = '';

  Object.entries(ALL_DUNGEONS).forEach(([id, d]) => {
    const s = state.dungeons[id];
    const row = document.createElement('div');
    row.className = 'dungeon' + (d.hasMedallion ? ' has-medallion' : '');
    row.dataset.id = id;

    // Name
    const name = document.createElement('div');
    name.className = 'dungeon-name';
    name.innerHTML = `${d.name}<span class="sub">${d.region}</span>`;
    row.appendChild(name);

    // Chests cell
    if (d.totalChests > 0) {
      const c = document.createElement('div');
      c.className = 'dung-cell dung-chests ' + (s.chests > 0 ? 'has' : 'empty');
      c.innerHTML = `<span>${s.chests}</span><span class="cell-label">chests</span>`;
      c.addEventListener('click', () => {
        // cycle: total -> total-1 -> ... -> 0 -> total
        s.chests = (s.chests <= 0) ? d.totalChests : s.chests - 1;
        saveState();
        rerenderAll();
      });
      row.appendChild(c);
    } else {
      // empty spacer so grid alignment is preserved
      const c = document.createElement('div');
      c.className = 'dung-cell dung-chests empty';
      c.innerHTML = `<span>–</span><span class="cell-label">chests</span>`;
      row.appendChild(c);
    }

    // Boss cell
    const b = document.createElement('div');
    b.className = 'dung-cell dung-boss' + (s.boss ? ' defeated' : '');
    b.innerHTML = `<span class="boss-mark"></span><span class="cell-label">boss</span>`;
    b.addEventListener('click', () => {
      s.boss = !s.boss;
      saveState();
      rerenderAll();
    });
    row.appendChild(b);

    // Prize cell
    const p = document.createElement('div');
    p.className = 'dung-cell dung-prize';
    p.dataset.prize = s.prize;
    p.innerHTML = `<span class="prize-mark">${prizeGlyph(s.prize)}</span><span class="cell-label">prize</span>`;
    p.addEventListener('click', () => openPrizeModal(id, d));
    row.appendChild(p);

    // Medallion cell (only MM/TR)
    if (d.hasMedallion) {
      const m = document.createElement('div');
      m.className = 'dung-cell dung-med';
      m.dataset.med = s.medallion;
      m.innerHTML = `<span class="med-mark">${medGlyph(s.medallion)}</span><span class="cell-label">med</span>`;
      m.addEventListener('click', () => openMedallionModal(id, d));
      row.appendChild(m);
    }

    host.appendChild(row);
  });
}

function prizeGlyph(p) {
  return ['?', '◆', '◆', '◇', '◇'][p] || '?';
}
function medGlyph(m) {
  return ['?', 'B', 'E', 'Q'][m] || '?';
}

/* ---------- Modals ---------- */

let activePrizeDungeon = null;
function openPrizeModal(dungId, dungDef) {
  activePrizeDungeon = dungId;
  const modal = document.getElementById('prize-modal');
  document.getElementById('prize-modal-title').textContent = `${dungDef.name} — prize`;
  modal.classList.remove('hidden');
}
function closePrizeModal() {
  document.getElementById('prize-modal').classList.add('hidden');
  activePrizeDungeon = null;
}

let activeMedDungeon = null;
function openMedallionModal(dungId, dungDef) {
  activeMedDungeon = dungId;
  const modal = document.getElementById('medallion-modal');
  document.getElementById('medallion-modal-title').textContent = `${dungDef.name} — medallion`;
  modal.classList.remove('hidden');
}
function closeMedallionModal() {
  document.getElementById('medallion-modal').classList.add('hidden');
  activeMedDungeon = null;
}

/* ---------- Rendering: locations ---------- */

function renderLocations() {
  const lw = document.getElementById('locs-lw');
  const dw = document.getElementById('locs-dw');
  const sm = document.getElementById('locs-sm');
  lw.innerHTML = '';
  dw.innerHTML = '';
  sm.innerHTML = '';

  ALL_LOCATIONS.forEach(loc => {
    const isChecked = !!state.checked[loc.id];
    let st = isChecked ? ST.CHECKED : loc.check(state.items, state);

    const node = document.createElement('div');
    node.className = 'location state-' + st;
    node.dataset.id = loc.id;
    node.innerHTML = `
      <div class="loc-name">${loc.name}<span class="loc-region">${loc.region}</span></div>
      <div class="loc-badge">${badgeLabel(st)}</div>
    `;
    node.addEventListener('click', () => {
      state.checked[loc.id] = !state.checked[loc.id];
      saveState();
      rerenderLocations();
    });

    if (loc.region === 'Light World') lw.appendChild(node);
    else if (loc.region === 'Dark World') dw.appendChild(node);
    else sm.appendChild(node);
  });
}

function rerenderLocations() {
  renderLocations();
}

function badgeLabel(s) {
  switch (s) {
    case ST.AVAILABLE: return 'Available';
    case ST.DARK:      return 'Dark';
    case ST.VISIBLE:   return 'Visible';
    case ST.PARTIAL:   return 'Partial';
    case ST.UNAVAIL:   return 'Blocked';
    case ST.CHECKED:   return 'Checked';
    default: return '—';
  }
}

/* ---------- Master re-render ---------- */

function rerenderAll() {
  renderItemGrid('z3-items',   Z3_ITEMS);
  renderItemGrid('sm-items',   SM_ITEMS);
  renderItemGrid('sm-bosses',  SM_BOSSES, true);
  renderItemGrid('agahnim-row', AGAHNIM, true);
  renderDungeons();
  renderLocations();
}

/* ---------- Tabs ---------- */

function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      const key = tab.dataset.tab;
      document.querySelectorAll('.panel').forEach(p => {
        p.classList.toggle('hidden', p.dataset.panel !== key);
      });
    });
  });
}

/* ---------- Reset / Settings / Modal handlers ---------- */

function setupReset() {
  const modal = document.getElementById('reset-modal');
  document.getElementById('btn-reset').addEventListener('click', () => {
    modal.classList.remove('hidden');
  });
  document.getElementById('reset-cancel').addEventListener('click', () => {
    modal.classList.add('hidden');
  });
  document.getElementById('reset-confirm').addEventListener('click', () => {
    state = defaultState();
    saveState();
    rerenderAll();
    modal.classList.add('hidden');
  });
}

function setupSettings() {
  const modal = document.getElementById('settings-modal');
  document.getElementById('btn-settings').addEventListener('click', () => {
    document.getElementById('mode-select').value = state.settings.mode;
    document.getElementById('opt-glitches').checked = state.settings.glitches;
    document.getElementById('opt-darkrooms').checked = state.settings.darkrooms;
    modal.classList.remove('hidden');
  });
  document.getElementById('settings-close').addEventListener('click', () => {
    state.settings.mode = document.getElementById('mode-select').value;
    state.settings.glitches = document.getElementById('opt-glitches').checked;
    state.settings.darkrooms = document.getElementById('opt-darkrooms').checked;
    saveState();
    modal.classList.add('hidden');
    rerenderLocations();
  });
}

function setupPrizeModal() {
  document.querySelectorAll('#prize-modal .prize-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = parseInt(btn.dataset.prize, 10);
      if (activePrizeDungeon) {
        state.dungeons[activePrizeDungeon].prize = p;
        saveState();
      }
      closePrizeModal();
      rerenderAll();
    });
  });
  document.getElementById('prize-close').addEventListener('click', closePrizeModal);
  document.getElementById('prize-modal').addEventListener('click', (e) => {
    if (e.target.id === 'prize-modal') closePrizeModal();
  });
}

function setupMedallionModal() {
  document.querySelectorAll('#medallion-modal .prize-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      const m = parseInt(btn.dataset.med, 10);
      if (activeMedDungeon) {
        state.dungeons[activeMedDungeon].medallion = m;
        saveState();
      }
      closeMedallionModal();
      rerenderAll();
    });
  });
  document.getElementById('medallion-close').addEventListener('click', closeMedallionModal);
  document.getElementById('medallion-modal').addEventListener('click', (e) => {
    if (e.target.id === 'medallion-modal') closeMedallionModal();
  });
}

/* ---------- Init ---------- */

function init() {
  setupTabs();
  setupReset();
  setupSettings();
  setupPrizeModal();
  setupMedallionModal();
  rerenderAll();
}

document.addEventListener('DOMContentLoaded', init);
