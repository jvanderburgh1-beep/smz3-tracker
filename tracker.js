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

/* ---------- Item catalogs ----------
   `img` — primary image source. For level items, use an array indexed by level (1-based).
   `glyph` / `label` — fallback shown if the image fails to load (file not present yet).
*/

const IMG_Z3 = 'images/zelda3/';
const IMG_SM = 'images/metroid3/';

// ALttP items. kind: 'bool' | 'level' (cycles 0..max)
// Order matches the in-game Y-menu / equipment screen (5 per row):
//   Row 1: Bow       | Boomerang | Hookshot | Powder    | Mushroom
//   Row 2: Fire Rod  | Ice Rod   | Bombos   | Ether     | Quake
//   Row 3: Lantern   | Hammer    | Shovel   | Flute     | Book
//   Row 4: Bottle    | Somaria   | Byrna    | Cape      | Mirror
//   Row 5: Sword     | M.Pearl   | Boots    | Flippers  | Glove
// Bombs are assumed to always be present, so they aren't tracked.
const Z3_ITEMS = [
  // Row 1 — consumables/throwables
  { id: 'bow',       kind: 'level', max: 2, label: 'Bow',       glyph: '⤭', tip: 'Bow → Silvers',
    img: [IMG_Z3+'bow.png', IMG_Z3+'silvers.png'] },
  { id: 'boomerang', kind: 'level', max: 3, label: 'Boomer.',   glyph: '↺', tip: 'Blue → Red → Both',
    img: [IMG_Z3+'boomerang.png', IMG_Z3+'boomerang2.png', IMG_Z3+'boomerang3.png'] },
  { id: 'hookshot',  kind: 'bool',           label: 'Hookshot', glyph: '⚓', img: IMG_Z3+'hookshot.png' },
  { id: 'powder',    kind: 'bool',           label: 'Powder',   glyph: '❋', img: IMG_Z3+'powder.png' },
  { id: 'mushroom',  kind: 'bool',           label: 'Mushroom', glyph: '✿', img: IMG_Z3+'mushroom.png' },
  // Row 2 — rods & medallions
  { id: 'firerod',   kind: 'bool',           label: 'Fire Rod', glyph: '🜂', img: IMG_Z3+'firerod.png' },
  { id: 'icerod',    kind: 'bool',           label: 'Ice Rod',  glyph: '❄', img: IMG_Z3+'icerod.png' },
  { id: 'bombos',    kind: 'bool',           label: 'Bombos',   glyph: 'B', img: IMG_Z3+'bombos.png' },
  { id: 'ether',     kind: 'bool',           label: 'Ether',    glyph: 'E', img: IMG_Z3+'ether.png' },
  { id: 'quake',     kind: 'bool',           label: 'Quake',    glyph: 'Q', img: IMG_Z3+'quake.png' },
  // Row 3 — utility
  { id: 'lantern',   kind: 'bool',           label: 'Lantern',  glyph: '☼', img: IMG_Z3+'lamp.png' },
  { id: 'hammer',    kind: 'bool',           label: 'Hammer',   glyph: '⚒', img: IMG_Z3+'hammer.png' },
  { id: 'shovel',    kind: 'bool',           label: 'Shovel',   glyph: '⛏', img: IMG_Z3+'shovel.png' },
  { id: 'flute',     kind: 'bool',           label: 'Flute',    glyph: '♫', img: IMG_Z3+'flute.png' },
  { id: 'book',      kind: 'bool',           label: 'Book',     glyph: '❢', img: IMG_Z3+'book.png' },
  // Row 4 — bottle + canes/cape/mirror
  { id: 'bottle',    kind: 'level', max: 4, label: 'Bottle',    glyph: '◉', tip: 'Up to 4 bottles',
    img: IMG_Z3+'bottle.png' },
  { id: 'somaria',   kind: 'bool',           label: 'Somaria',  glyph: '⌬', img: IMG_Z3+'somaria.png' },
  { id: 'byrna',     kind: 'bool',           label: 'Byrna',    glyph: '✦', img: IMG_Z3+'byrna.png' },
  { id: 'cape',      kind: 'bool',           label: 'Cape',     glyph: '▽', img: IMG_Z3+'cape.png' },
  { id: 'mirror',    kind: 'bool',           label: 'Mirror',   glyph: '◈', img: IMG_Z3+'mirror.png' },
  // Row 5 — equipment (from status/map screens)
  { id: 'sword',     kind: 'level', max: 4, label: 'Sword',     glyph: '†', tip: 'Fighter → Master → Tempered → Gold',
    img: [IMG_Z3+'sword1.png', IMG_Z3+'sword2.png', IMG_Z3+'sword3.png', IMG_Z3+'sword4.png'] },
  { id: 'moonpearl', kind: 'bool',           label: 'M.Pearl',  glyph: '◐', img: IMG_Z3+'moonpearl.png' },
  { id: 'boots',     kind: 'bool',           label: 'Boots',    glyph: '»', img: IMG_Z3+'boots.png' },
  { id: 'flippers',  kind: 'bool',           label: 'Flippers', glyph: '~', img: IMG_Z3+'flippers.png' },
  { id: 'glove',     kind: 'level', max: 2, label: 'Glove',     glyph: '✊', tip: 'Power → Titan',
    img: [IMG_Z3+'glove1.png', IMG_Z3+'glove2.png'] },
];

// Super Metroid items — order matches the in-game pause-menu layout (5 per row):
//   Row 1 (beams):    Charge | Ice     | Wave    | Spazer | Plasma
//   Row 2 (suits):    Varia  | Gravity |   —     |   —    |   —
//   Row 3 (utility):  Morph  | Bombs   | Spring  | Screw  | HiJump
//   Row 4 (movement): Speed  | Space   | Grapple | X-Ray  |   —
//   Row 5 (ammo):     Missile| Super   | PBomb   |   —    |   —
// Bosses are rendered in their own row above this grid.
const SM_ITEMS = [
  // Row 1 — beams
  { id: 'charge',   kind: 'bool', label: 'Charge',  glyph: '◎', img: IMG_SM+'charge.png' },
  { id: 'ice',      kind: 'bool', label: 'Ice',     glyph: '❋', img: IMG_SM+'ice.png' },
  { id: 'wave',     kind: 'bool', label: 'Wave',    glyph: '∿', img: IMG_SM+'wave.png' },
  { id: 'spazer',   kind: 'bool', label: 'Spazer',  glyph: '=',  img: IMG_SM+'spazer.png' },
  { id: 'plasma',   kind: 'bool', label: 'Plasma',  glyph: '⚡', img: IMG_SM+'plasma.png' },
  // Row 2 — suits (left-aligned, 3 spacer cells)
  { id: 'varia',    kind: 'bool', label: 'Varia',   glyph: 'V',  img: IMG_SM+'varia.png' },
  { id: 'gravity',  kind: 'bool', label: 'Gravity', glyph: 'G',  img: IMG_SM+'gravity.png' },
  { kind: 'spacer' }, { kind: 'spacer' }, { kind: 'spacer' },
  // Row 3 — utility
  { id: 'morph',    kind: 'bool', label: 'Morph',   glyph: '◉', img: IMG_SM+'morph.png' },
  { id: 'bombs_sm', kind: 'bool', label: 'Bombs',   glyph: '◎', img: IMG_SM+'bombs.png' },
  { id: 'spring',   kind: 'bool', label: 'Spring',  glyph: '◴', img: IMG_SM+'springball.png' },
  { id: 'screw',    kind: 'bool', label: 'Screw',   glyph: '✱', img: IMG_SM+'screw.png' },
  { id: 'hijump',   kind: 'bool', label: 'HiJump',  glyph: '↟', img: IMG_SM+'hijump.png' },
  // Row 4 — movement
  { id: 'speed',    kind: 'bool', label: 'Speed',   glyph: '»',  img: IMG_SM+'speed.png' },
  { id: 'space',    kind: 'bool', label: 'Space J', glyph: '↑', img: IMG_SM+'space.png' },
  { id: 'grapple',  kind: 'bool', label: 'Grapple', glyph: '⟿', img: IMG_SM+'grapple.png' },
  { id: 'xray',     kind: 'bool', label: 'X-Ray',   glyph: '✕',  img: IMG_SM+'xray.png' },
  { kind: 'spacer' },
  // Row 5 — ammo
  { id: 'missile',  kind: 'bool', label: 'Missile', glyph: 'M',  img: IMG_SM+'missile.png' },
  { id: 'super',    kind: 'bool', label: 'Super',   glyph: 'S',  img: IMG_SM+'supermissile.png' },
  { id: 'pb',       kind: 'bool', label: 'PBomb',   glyph: 'PB', img: IMG_SM+'powerbomb.png' },
  { kind: 'spacer' }, { kind: 'spacer' },
];

const SM_BOSSES = [
  { id: 'kraid',       kind: 'bool', label: 'Kraid',    glyph: 'K',  img: IMG_SM+'kraid.png' },
  { id: 'phantoon',    kind: 'bool', label: 'Phantoon', glyph: 'P',  img: IMG_SM+'phantoon.png' },
  { id: 'draygon',     kind: 'bool', label: 'Draygon',  glyph: 'D',  img: IMG_SM+'draygon.png' },
  { id: 'ridley',      kind: 'bool', label: 'Ridley',   glyph: 'R',  img: IMG_SM+'ridley.png' },
  { id: 'motherbrain', kind: 'bool', label: 'Mother B', glyph: 'MB', img: IMG_SM+'mbrain.png' },
];

const AGAHNIM = [
  { id: 'aga', kind: 'bool', label: 'Agahnim', glyph: 'A', img: IMG_Z3+'boss102.png' },
];

/* ---------- Default state ---------- */

function defaultState() {
  const items = {};
  [...Z3_ITEMS, ...SM_ITEMS, ...SM_BOSSES, ...AGAHNIM].forEach(it => {
    if (it.kind === 'spacer' || !it.id) return;
    items[it.id] = it.kind === 'level' ? 0 : false;
  });

  const dungeons = {};
  Object.entries(ALL_DUNGEONS).forEach(([id, d]) => {
    dungeons[id] = {
      chests: d.totalChests,
      boss:   false,
      prize:  0,        // cycles 0→1→2→4 on tap: 0=crystal (default), 1=green, 2=red/blue pendant, 4=red crystal 5/6
      medallion: 0,     // 0=unknown, 1=bombos, 2=ether, 3=quake
    };
  });

  const checked = {}; // checked[locId] = true
  const smBossPrizes = {}; // smBossPrizes[bossId] = prize code (same scheme as dungeon prize)

  return {
    items,
    dungeons,
    checked,
    smBossPrizes,
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
      smBossPrizes: parsed.smBossPrizes || {},
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

// Resolve the right image src for an item given its current value.
// For level items, `img` is an array indexed by level-1; for single-sprite
// level items (like bottle), `img` is a string and is shared across all levels.
function itemImgSrc(it, v) {
  if (!it.img) return null;
  if (Array.isArray(it.img)) {
    const i = Math.max(0, Math.min(it.img.length - 1, (v || 1) - 1));
    return it.img[i];
  }
  return it.img;
}

function renderItemGrid(hostId, catalog, isBoss = false) {
  const host = document.getElementById(hostId);
  host.innerHTML = '';
  catalog.forEach(it => {
    // Spacer cell: holds a grid slot but isn't interactive.
    if (it.kind === 'spacer') {
      const sp = document.createElement('div');
      sp.className = 'item spacer';
      sp.setAttribute('aria-hidden', 'true');
      host.appendChild(sp);
      return;
    }

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

    // Image takes priority. If it fails, fall back to glyph+label so the
    // app stays usable when images aren't yet in the repo.
    const src = itemImgSrc(it, v);
    if (src) {
      const img = document.createElement('img');
      img.className = 'item-img';
      img.src = src;
      img.alt = it.label;
      img.draggable = false;
      img.loading = 'lazy';
      img.addEventListener('error', () => {
        // Swap in the text fallback in-place
        img.remove();
        const glyph = document.createElement('span');
        glyph.className = 'glyph';
        glyph.textContent = it.glyph || '?';
        el.appendChild(glyph);
        const lab = document.createElement('span');
        lab.className = 'label';
        lab.textContent = it.label;
        el.appendChild(lab);
      });
      el.appendChild(img);
    } else {
      const glyph = document.createElement('span');
      glyph.className = 'glyph';
      glyph.textContent = it.glyph || '?';
      el.appendChild(glyph);
      const lab = document.createElement('span');
      lab.className = 'label';
      lab.textContent = it.label;
      el.appendChild(lab);
    }

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

// Mapping of dungeon id → boss sprite path (numbering follows the
// crossproduct/mistersunshine convention: boss02..boss122).
const DUNGEON_SPRITES = {
  ep:  IMG_Z3 + 'boss02.png',   // Armos Knights
  dp:  IMG_Z3 + 'boss12.png',   // Lanmolas
  toh: IMG_Z3 + 'boss22.png',   // Moldorm
  pod: IMG_Z3 + 'boss32.png',   // Helmasaur King
  sp:  IMG_Z3 + 'boss42.png',   // Arrghus
  sw:  IMG_Z3 + 'boss52.png',   // Mothula
  tt:  IMG_Z3 + 'boss62.png',   // Blind
  ip:  IMG_Z3 + 'boss72.png',   // Kholdstare
  mm:  IMG_Z3 + 'boss82.png',   // Vitreous
  tr:  IMG_Z3 + 'boss92.png',   // Trinexx
  at:  IMG_Z3 + 'boss102.png',  // Agahnim (Castle Tower)
  gt:  IMG_Z3 + 'boss122.png',  // Ganon (Ganon's Tower)
  hc:  null,                    // Hyrule Castle (no boss, escape sequence only)
};

// Short labels shown below each cell and as fallback when sprite is missing.
const DUNGEON_LABELS = {
  ep: 'Eastern', dp: 'Desert',  toh: 'Hera',     hc: 'Castle',
  at: 'Tower',   pod: 'Palace', sp: 'Swamp',     sw: 'Skull',
  tt: 'Thieves', ip: 'Ice',     mm: 'Mire',      tr: 'Turtle',
  gt: 'Ganon',
};

// Short names shown in fallback block (2 lines)
const DUNGEON_FALLBACKS = {
  ep: ['Eastern','Palace'],   dp: ['Desert','Palace'],   toh: ['Tower of','Hera'],
  hc: ['Hyrule','Castle'],    at: ['Castle','Tower'],    pod: ['Palace of','Darkness'],
  sp: ['Swamp','Palace'],     sw: ['Skull','Woods'],     tt: ['Thieves','Town'],
  ip: ['Ice','Palace'],       mm: ['Misery','Mire'],     tr: ['Turtle','Rock'],
  gt: ['Ganon\'s','Tower'],
};

// Cycle through prize values on each tap: 0 (crystal default) →
// 1 (green) → 2 (red/blue pendant) → 4 (red crystal 5/6) → 0 (crystal) ...
// Per user spec: crystal is default; no separate "unknown" state.
const PRIZE_CYCLE = [0, 1, 2, 4];
function nextPrize(current) {
  const i = PRIZE_CYCLE.indexOf(current);
  return PRIZE_CYCLE[(i + 1) % PRIZE_CYCLE.length];
}

// Medallion cycles: 0 (unknown) → 1 (bombos) → 2 (ether) → 3 (quake) → 0 ...
function nextMed(current) { return ((current || 0) + 1) % 4; }

function prizeGlyph(p) {
  // 0 = crystal (default), 1 = green, 2 = red/blue pendant, 4 = red crystal
  return { 0: '◇', 1: '◆', 2: '◆', 3: '◇', 4: '◇' }[p] || '◇';
}
function medGlyph(m) {
  return ['?', 'B', 'E', 'Q'][m] || '?';
}

function renderDungeons() {
  const host = document.getElementById('z3-dungeons');
  host.innerHTML = '';

  Object.entries(ALL_DUNGEONS).forEach(([id, d]) => {
    const s = state.dungeons[id];
    host.appendChild(buildBossCell({
      id,
      spriteSrc:    DUNGEON_SPRITES[id],
      fallback:     DUNGEON_FALLBACKS[id] || [d.name],
      label:        DUNGEON_LABELS[id] || d.name,
      defeated:     !!s.boss,
      chestsLeft:   s.chests,
      chestsTotal:  d.totalChests,
      showChests:   d.totalChests > 0,
      prize:        s.prize,
      showPrize:    d.totalChests > 0 || id === 'at' || id === 'gt',  // AT/GT prize still matters
      medallion:    s.medallion,
      showMed:      !!d.hasMedallion,
      onBossToggle: () => {
        s.boss = !s.boss;
        // Keep items.aga mirrored with Castle Tower's boss state so that
        // logic.js's canReachDWViaAgahnim() works without needing state refs.
        if (id === 'at') state.items.aga = s.boss;
        saveState();
        rerenderAll();
      },
      onChestsTap: () => {
        s.chests = (s.chests <= 0) ? d.totalChests : s.chests - 1;
        saveState();
        rerenderAll();
      },
      onPrizeTap: () => {
        s.prize = nextPrize(s.prize || 0);
        saveState();
        rerenderAll();
      },
      onMedTap: () => {
        s.medallion = nextMed(s.medallion);
        saveState();
        rerenderAll();
      },
    }));
  });
}

function renderSMBossGrid() {
  const host = document.getElementById('sm-boss-grid');
  if (!host) return;
  host.innerHTML = '';

  // Re-use SM_BOSSES catalog; store prize state in a dedicated object so
  // SM boss prizes are tracked alongside ALttP dungeon prizes.
  SM_BOSSES.forEach(b => {
    const defeated = !!state.items[b.id];
    const prizeState = state.smBossPrizes || (state.smBossPrizes = {});
    const prize = prizeState[b.id] || 0;

    host.appendChild(buildBossCell({
      id:            b.id,
      spriteSrc:     b.img,
      fallback:      [b.label],
      label:         b.label,
      defeated,
      showChests:    false,   // SM bosses don't drop chests
      prize,
      showPrize:     true,
      showMed:       false,
      onBossToggle:  () => {
        state.items[b.id] = !defeated;
        saveState();
        rerenderAll();
      },
      onPrizeTap:    () => {
        prizeState[b.id] = nextPrize(prize);
        saveState();
        rerenderAll();
      },
    }));
  });
}

// Build one boss-sprite cell with overlays. Returns a wrapper element
// (the cell + a small label underneath).
function buildBossCell(opts) {
  const wrap = document.createElement('div');
  wrap.className = 'boss-cell-wrap';

  const cell = document.createElement('div');
  cell.className = 'boss-cell' + (opts.defeated ? ' defeated' : '');
  cell.dataset.id = opts.id;

  // Tapping the cell background (not an overlay) toggles boss
  cell.addEventListener('click', (ev) => {
    if (ev.target.closest('.boss-overlay')) return;
    opts.onBossToggle && opts.onBossToggle();
  });

  // Sprite (or fallback)
  if (opts.spriteSrc) {
    const img = document.createElement('img');
    img.className = 'boss-sprite';
    img.src = opts.spriteSrc;
    img.alt = opts.label;
    img.draggable = false;
    img.addEventListener('error', () => {
      img.remove();
      appendFallback(cell, opts.fallback);
    });
    cell.appendChild(img);
  } else {
    appendFallback(cell, opts.fallback);
  }

  // Chest counter overlay
  if (opts.showChests) {
    const c = document.createElement('div');
    c.className = 'boss-overlay boss-chests' + (opts.chestsLeft <= 0 ? ' empty' : '');
    c.textContent = opts.chestsLeft;
    c.addEventListener('click', (e) => { e.stopPropagation(); opts.onChestsTap && opts.onChestsTap(); });
    cell.appendChild(c);
  }

  // Prize overlay
  if (opts.showPrize) {
    const p = document.createElement('div');
    p.className = 'boss-overlay boss-prize';
    p.dataset.prize = opts.prize || 0;
    p.textContent = prizeGlyph(opts.prize || 0);
    p.addEventListener('click', (e) => { e.stopPropagation(); opts.onPrizeTap && opts.onPrizeTap(); });
    cell.appendChild(p);
  }

  // Medallion overlay (MM/TR only)
  if (opts.showMed) {
    const m = document.createElement('div');
    m.className = 'boss-overlay boss-med';
    m.dataset.med = opts.medallion || 0;
    m.textContent = medGlyph(opts.medallion || 0);
    m.addEventListener('click', (e) => { e.stopPropagation(); opts.onMedTap && opts.onMedTap(); });
    cell.appendChild(m);
  }

  wrap.appendChild(cell);
  return wrap;
}

function appendFallback(cell, lines) {
  const fb = document.createElement('div');
  fb.className = 'boss-fallback';
  lines.forEach((line, i) => {
    const s = document.createElement('span');
    s.className = i === 0 ? 'boss-fallback-name' : '';
    s.textContent = line;
    fb.appendChild(s);
  });
  cell.appendChild(fb);
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
  renderItemGrid('z3-items',    Z3_ITEMS);
  renderItemGrid('sm-bosses',   SM_BOSSES, true);
  renderItemGrid('sm-items',    SM_ITEMS);
  renderDungeons();
  renderSMBossGrid();
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

function setupPrizeModal() { /* no-op; prize cycling is now inline tap */ }
function setupMedallionModal() { /* no-op; medallion cycling is now inline tap */ }

/* ---------- Init ---------- */

function init() {
  setupTabs();
  setupReset();
  setupSettings();
  rerenderAll();
}

document.addEventListener('DOMContentLoaded', init);
