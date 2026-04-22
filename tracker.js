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
  { id: 'boomerang', kind: 'level', max: 2, label: 'Boomer.',   glyph: '↺', tip: 'None → Boomerang 1 → Boomerang 2',
    img: [IMG_Z3+'boomerang1.png', IMG_Z3+'boomerang2.png'] },
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

// Prize codes (1:1 with sprite filenames in images/prizes/):
//   0 = dungeon0.png — blue crystal (default for most dungeons)
//   1 = dungeon1.png — red crystal (Crystal 5/6)
//   2 = dungeon2.png — red/blue pendant
//   3 = dungeon3.png — green pendant
//   4 = dungeon4.png — metroid boss prize (SM bosses in crossover seeds)
const IMG_PRIZES = 'images/prizes/';
const PRIZE_SRC = [
  IMG_PRIZES + 'dungeon0.png',
  IMG_PRIZES + 'dungeon1.png',
  IMG_PRIZES + 'dungeon2.png',
  IMG_PRIZES + 'dungeon3.png',
  IMG_PRIZES + 'dungeon4.png',
];
// Glyph fallback, used only if the prize image fails to load
const PRIZE_FALLBACK_GLYPH = ['◇', '◇', '◆', '◆', 'M'];

// Tap-to-cycle order: straight walk 0 → 1 → 2 → 3 → 4 → 0 …
const PRIZE_CYCLE = [0, 1, 2, 3, 4];
function nextPrize(current) {
  const i = PRIZE_CYCLE.indexOf(current);
  return PRIZE_CYCLE[(i + 1) % PRIZE_CYCLE.length];
}

// Medallion sprites — reused from the Items tab's images/zelda3/ folder.
// Index 0 = unknown (rendered as '?' glyph with no sprite), 1–3 map to
// the actual medallion PNGs.
const MED_SRC = [
  null,                       // 0 = unknown
  IMG_Z3 + 'bombos.png',      // 1
  IMG_Z3 + 'ether.png',       // 2
  IMG_Z3 + 'quake.png',       // 3
];

// Medallion cycles: 0 (unknown) → 1 (bombos) → 2 (ether) → 3 (quake) → 0 ...
function nextMed(current) { return ((current || 0) + 1) % 4; }

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

  // Prize overlay — rendered as an image when possible, falling back to
  // a small glyph if the image file is missing.
  if (opts.showPrize) {
    const p = document.createElement('div');
    const prizeIdx = opts.prize || 0;
    p.className = 'boss-overlay boss-prize';
    p.dataset.prize = prizeIdx;
    const pImg = document.createElement('img');
    pImg.className = 'prize-img';
    pImg.src = PRIZE_SRC[prizeIdx];
    pImg.alt = '';
    pImg.draggable = false;
    pImg.addEventListener('error', () => {
      pImg.remove();
      p.textContent = PRIZE_FALLBACK_GLYPH[prizeIdx] || '?';
    });
    p.appendChild(pImg);
    p.addEventListener('click', (e) => { e.stopPropagation(); opts.onPrizeTap && opts.onPrizeTap(); });
    cell.appendChild(p);
  }

  // Medallion overlay (MM/TR only) — rendered as the actual medallion
  // sprite from images/zelda3/ (bombos/ether/quake). Index 0 = unknown,
  // shown as a small '?' glyph with no image.
  if (opts.showMed) {
    const m = document.createElement('div');
    const medIdx = opts.medallion || 0;
    m.className = 'boss-overlay boss-med';
    m.dataset.med = medIdx;
    if (medIdx > 0) {
      const mImg = document.createElement('img');
      mImg.className = 'med-img';
      mImg.src = MED_SRC[medIdx];
      mImg.alt = '';
      mImg.draggable = false;
      mImg.addEventListener('error', () => {
        mImg.remove();
        m.textContent = medGlyph(medIdx);
      });
      m.appendChild(mImg);
    } else {
      m.textContent = medGlyph(medIdx);
    }
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

// Map image sources. Set the <img src> once on setup — the images
// cache and only load once per PWA install.
const MAP_IMG_SRC = {
  lw: 'images/maps/lightworld.png',
  dw: 'images/maps/darkworld.png',
};

// Calibrated coordinates produced by the calibrate.html tool. Values are
// percentages of the map image's natural dimensions, so markers scale
// correctly regardless of the rendered map size.
const MAP_COORDS = {
  // ---- Light World overworld ----
  "lw-pedestal":            { map: "lw", x: 4.10,  y: 3.56 },
  "lw-mushroom":            { map: "lw", x: 12.31, y: 8.42 },
  "lw-lostwoods-hideout":   { map: "lw", x: 19.01, y: 13.07 },
  "lw-lumberjacks":         { map: "lw", x: 33.15, y: 2.48 },
  "lw-graveyard-ledge":     { map: "lw", x: 56.59, y: 27.86 },
  "lw-king-tomb":           { map: "lw", x: 60.26, y: 29.48 },
  "lw-old-man":             { map: "lw", x: 40.60, y: 18.79 },
  "lw-spectacle-rock-cave": { map: "lw", x: 48.81, y: 14.36 },
  "lw-spectacle-rock":      { map: "lw", x: 50.76, y: 8.21 },
  "lw-ether-tablet":        { map: "lw", x: 42.01, y: 1.73 },
  "lw-floating-island":     { map: "lw", x: 81.21, y: 1.94 },
  "lw-spiral-cave":         { map: "lw", x: 79.59, y: 8.42 },
  "lw-paradox-cave":        { map: "lw", x: 86.29, y: 20.84 },
  "lw-mimic-cave":          { map: "lw", x: 84.34, y: 8.42 },
  "lw-waterfall-fairy":     { map: "lw", x: 90.06, y: 13.28 },
  "lw-zora":                { map: "lw", x: 95.14, y: 12.74 },
  "lw-king-zora":           { map: "lw", x: 96.54, y: 12.74 },
  "lw-potion-shop":         { map: "lw", x: 80.02, y: 32.83 },
  "lw-magic-bat":           { map: "lw", x: 32.51, y: 56.16 },
  "lw-sahasrahla-hut":      { map: "lw", x: 80.35, y: 44.06 },
  "lw-sahasrahla-reward":   { map: "lw", x: 81.86, y: 44.06 },
  "lw-kakariko-well":       { map: "lw", x: 2.27,  y: 42.55 },
  "lw-blinds-hideout":      { map: "lw", x: 12.85, y: 41.25 },
  "lw-bottle-merchant":     { map: "lw", x: 9.50,  y: 46.44 },
  "lw-chicken-house":       { map: "lw", x: 11.34, y: 53.02 },
  "lw-sick-kid":            { map: "lw", x: 15.55, y: 52.59 },
  "lw-library":             { map: "lw", x: 15.66, y: 64.90 },
  "lw-kakariko-tavern":     { map: "lw", x: 15.98, y: 57.02 },
  "lw-pegasus-rocks":       { map: "lw", x: 39.09, y: 29.27 },
  "lw-links-uncle":         { map: "lw", x: 59.61, y: 40.82 },
  "lw-secret-passage":      { map: "lw", x: 55.08, y: 42.33 },
  "lw-links-house":         { map: "lw", x: 54.64, y: 67.49 },
  "lw-floodgate":           { map: "lw", x: 46.87, y: 93.09 },
  "lw-maze-race":           { map: "lw", x: 3.24,  y: 69.87 },
  "lw-cave45":              { map: "lw", x: 26.57, y: 81.86 },
  "lw-aginah":              { map: "lw", x: 19.87, y: 81.75 },
  "lw-flute-spot":          { map: "lw", x: 28.94, y: 66.09 },
  "lw-desert-ledge":        { map: "lw", x: 2.38,  y: 90.93 },
  "lw-checkerboard":        { map: "lw", x: 17.60, y: 77.65 },
  "lw-bombos-tablet":       { map: "lw", x: 22.03, y: 92.12 },
  "lw-sunken-treasure":     { map: "lw", x: 45.25, y: 93.20 },
  "lw-hobo":                { map: "lw", x: 70.84, y: 69.98 },
  "lw-lake-hylia-island":   { map: "lw", x: 72.79, y: 83.15 },
  "lw-ice-rod-cave":        { map: "lw", x: 89.63, y: 76.89 },
  "lw-mini-moldorm":        { map: "lw", x: 65.12, y: 93.63 },

  // ---- LW dungeon entrances ----
  "dung-ep":  { map: "lw", x: 95.79, y: 37.90, dungeon: true },
  "dung-dp":  { map: "lw", x: 7.34,  y: 78.40, dungeon: true },
  "dung-toh": { map: "lw", x: 55.94, y: 2.05,  dungeon: true },
  "dung-hc":  { map: "lw", x: 50.11, y: 43.52, dungeon: true },
  "dung-at":  { map: "lw", x: 50.11, y: 38.77, dungeon: true },

  // ---- Dark World overworld ----
  "dw-spike-cave":      { map: "dw", x: 57.45, y: 13.71 },
  "dw-superbunny-cave": { map: "dw", x: 84.45, y: 13.82 },
  "dw-hookshot-cave":   { map: "dw", x: 83.15, y: 6.48 },
  "dw-catfish":         { map: "dw", x: 89.52, y: 17.06 },
  "dw-pyramid":         { map: "dw", x: 58.10, y: 45.36 },
  "dw-pyramid-fairy":   { map: "dw", x: 46.87, y: 47.84 },
  "dw-bumper-cave":     { map: "dw", x: 34.02, y: 15.33 },
  "dw-chest-game":      { map: "dw", x: 4.97,  y: 45.57 },
  "dw-c-house":         { map: "dw", x: 20.63, y: 46.98 },
  "dw-brewery":         { map: "dw", x: 10.91, y: 57.56 },
  "dw-hammer-peg":      { map: "dw", x: 31.64, y: 60.48 },
  "dw-purple-chest":    { map: "dw", x: 30.45, y: 52.16 },
  "dw-blacksmith":      { map: "dw", x: 14.79, y: 66.20 },
  "dw-mire-shed":       { map: "dw", x: 3.89,  y: 79.37 },
  "dw-digging-game":    { map: "dw", x: 5.51,  y: 69.33 },
  "dw-stumpy":          { map: "dw", x: 30.89, y: 68.36 },
  "dw-hype-cave":       { map: "dw", x: 59.72, y: 77.65 },

  // ---- DW dungeon entrances ----
  "dung-pod": { map: "dw", x: 95.90, y: 38.12, dungeon: true },
  "dung-sp":  { map: "dw", x: 46.87, y: 92.44, dungeon: true },
  "dung-sw":  { map: "dw", x: 3.89,  y: 4.32,  dungeon: true },
  "dung-tt":  { map: "dw", x: 12.42, y: 47.73, dungeon: true },
  "dung-ip":  { map: "dw", x: 79.59, y: 87.04, dungeon: true },
  "dung-mm":  { map: "dw", x: 7.45,  y: 81.21, dungeon: true },
  "dung-tr":  { map: "dw", x: 94.17, y: 5.40,  dungeon: true },
  "dung-gt":  { map: "dw", x: 56.26, y: 3.67,  dungeon: true },
};

// Mapping from dungeon id on the map → dungeon id in state.dungeons
// (map ids have the dung- prefix; state ids don't).
function dungeonIdFor(markerId) {
  return markerId.startsWith('dung-') ? markerId.slice(5) : null;
}

let mapsInitialized = false;
function ensureMapImages() {
  if (mapsInitialized) return;
  const lwImg = document.getElementById('map-lw-img');
  const dwImg = document.getElementById('map-dw-img');
  if (lwImg && !lwImg.src) lwImg.src = MAP_IMG_SRC.lw;
  if (dwImg && !dwImg.src) dwImg.src = MAP_IMG_SRC.dw;
  mapsInitialized = true;
}

// Compute the best state for a dungeon marker: use the current dungeon
// availability as a stand-in. If boss is defeated and no chests remain,
// show the "checked" state for quick visual confirmation.
function dungeonMarkerState(dungId) {
  const d = ALL_DUNGEONS[dungId];
  const s = state.dungeons[dungId];
  if (!d || !s) return ST.UNAVAIL;
  if (s.boss && s.chests <= 0) return ST.CHECKED;
  const result = d.check(state.items, s.chests, s.medallion);
  // Prefer chest state when present, else boss state, else entry
  if (result.chests !== undefined && result.chests !== null) return result.chests;
  if (result.boss   !== undefined && result.boss   !== null) return result.boss;
  return result.entry ? ST.AVAILABLE : ST.UNAVAIL;
}

function renderLocations() {
  ensureMapImages();
  renderMapMarkers('lw');
  renderMapMarkers('dw');
  renderSMLocationsList();
}

function renderMapMarkers(mapKey) {
  const host = document.getElementById('markers-' + mapKey);
  if (!host) return;
  host.innerHTML = '';

  Object.entries(MAP_COORDS).forEach(([id, coord]) => {
    if (coord.map !== mapKey) return;

    const isDungeon = !!coord.dungeon;
    let st;
    if (isDungeon) {
      const dungId = dungeonIdFor(id);
      st = dungeonMarkerState(dungId);
    } else {
      const loc = ALL_LOCATIONS.find(l => l.id === id);
      if (!loc) return;  // no check defined — skip silently
      const isChecked = !!state.checked[id];
      st = isChecked ? ST.CHECKED : loc.check(state.items, state);
    }

    const m = document.createElement('div');
    m.className = 'map-marker state-' + st + (isDungeon ? ' is-dungeon' : '');
    m.style.left = coord.x + '%';
    m.style.top  = coord.y + '%';
    m.dataset.id = id;
    // Show the location name on long-press / hover so the user can
    // confirm they tapped the right thing
    const label = isDungeon
      ? (ALL_DUNGEONS[dungeonIdFor(id)]?.name || id)
      : (ALL_LOCATIONS.find(l => l.id === id)?.name || id);
    m.title = label;

    m.addEventListener('click', () => {
      if (isDungeon) {
        // Jump to Dungeons tab so the user can toggle chests/boss/prize.
        switchToTab('dungeons');
      } else {
        state.checked[id] = !state.checked[id];
        saveState();
        renderMapMarkers(mapKey);
      }
    });
    host.appendChild(m);
  });
}

function renderSMLocationsList() {
  const sm = document.getElementById('locs-sm');
  if (!sm) return;
  sm.innerHTML = '';
  ALL_LOCATIONS.forEach(loc => {
    if (loc.region !== 'Super Metroid') return;
    const isChecked = !!state.checked[loc.id];
    const st = isChecked ? ST.CHECKED : loc.check(state.items, state);
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
      renderSMLocationsList();
    });
    sm.appendChild(node);
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

// Switch the main top-level tab (items / dungeons / locations).
// Exposed so map markers can jump to Dungeons tab on tap.
function switchToTab(key) {
  document.querySelectorAll('.tab').forEach(t => {
    const isActive = t.dataset.tab === key;
    t.classList.toggle('active', isActive);
    t.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
  document.querySelectorAll('.panel').forEach(p => {
    p.classList.toggle('hidden', p.dataset.panel !== key);
  });
}

function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchToTab(tab.dataset.tab));
  });
}

// Sub-tabs within the Locations panel (LW / DW map sub-views).
function setupSubTabs() {
  document.querySelectorAll('.subtab').forEach(st => {
    st.addEventListener('click', () => {
      const key = st.dataset.subtab;
      document.querySelectorAll('.subtab').forEach(s => {
        const active = s.dataset.subtab === key;
        s.classList.toggle('active', active);
        s.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      document.querySelectorAll('.map-panel').forEach(p => {
        p.classList.toggle('active', p.dataset.map === key);
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
  setupSubTabs();
  setupReset();
  setupSettings();
  rerenderAll();
}

document.addEventListener('DOMContentLoaded', init);
