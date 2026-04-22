/* =============================================================
   SMZ3 Tracker — location availability logic
   Ported from crossproduct42/alttprandohelper (used with permission)
   Adapted for SMZ3 (combined ALttP + Super Metroid item pool).

   State values:
     'available'   - can reach and obtain
     'dark'        - available but needs dark-room navigation without lantern
     'visible'     - can see but cannot collect
     'partial'     - dungeon: at least some chests reachable but not all
     'unavailable' - blocked
     'checked'     - manually checked off
   ============================================================= */

const STATE = {
  AVAILABLE: 'available',
  DARK:      'dark',
  VISIBLE:   'visible',
  PARTIAL:   'partial',
  UNAVAIL:   'unavailable',
  CHECKED:   'checked',
};

/* -------------------------------------------------------------
   Item helpers — aggregate capability checks over both games
   ------------------------------------------------------------- */
function has(items, k) { return !!items[k]; }

// Sword tier (0=none, 1=fighter, 2=master, 3=tempered, 4=gold)
function sword(items)   { return items.sword || 0; }
function masterSword(items) { return sword(items) >= 2; }
function tempered(items)    { return sword(items) >= 3; }

// Bow state (0=none, 1=bow, 2=silvers). Silvers implies bow.
function anyBow(items)   { return (items.bow || 0) >= 1; }
function silvers(items)  { return (items.bow || 0) >= 2; }

// Glove (0=none, 1=power, 2=titan)
function anyGlove(items) { return (items.glove || 0) >= 1; }
function titan(items)    { return (items.glove || 0) >= 2; }

// Fire source
function fire(items) {
  return has(items, 'firerod') || has(items, 'lantern');
}
// Melting (ice barriers)
function melt(items) {
  return has(items, 'firerod') || has(items, 'bombos');
}
// Can light dark rooms
function lantern(items)  { return has(items, 'lantern'); }

// Basic combat (any way to kill things)
function canAttack(items) {
  return sword(items) > 0 ||
         has(items, 'hammer') ||
         anyBow(items) ||
         has(items, 'firerod') ||
         has(items, 'icerod') ||
         has(items, 'somaria') ||
         has(items, 'byrna');
}

// Can hit crystal switches
function hitSwitch(items) {
  return sword(items) > 0 ||
         has(items, 'hammer') ||
         anyBow(items) ||
         has(items, 'somaria') ||
         has(items, 'boomerang') ||
         has(items, 'hookshot');
}

/* ---- Dark-World cross-world access ---- */

function canReachDWViaAgahnim(items) {
  // Beating Agahnim in Castle Tower drops you in DW
  return !!items.aga;
}

function canEnterDarkWorld(items) {
  // In open mode you start with moon pearl access via glove+hammer or mirror etc.
  // Standard path: either beat Agahnim OR have glove (so you can reach Pyramid of Power)
  return has(items, 'moonpearl') &&
         (canReachDWViaAgahnim(items) ||
          titan(items) ||
          (anyGlove(items) && has(items, 'hammer')));
}

function canReachPyramid(items) {
  return canEnterDarkWorld(items);
}

function canReachDarkWorldSouth(items) {
  return canEnterDarkWorld(items) &&
         (has(items, 'hammer') || (anyGlove(items) && has(items, 'flippers')));
}

function canReachDarkWorldEast(items) {
  return canEnterDarkWorld(items);
}

function canReachDarkWorldNorthWest(items) {
  // Village of Outcasts
  return canEnterDarkWorld(items) && titan(items);
}

function canReachDeathMountainWest(items) {
  // Light World DM west (spectacle rock, ether tablet side)
  return has(items, 'flute') || (anyGlove(items) && lantern(items)) ||
         (anyGlove(items) && has(items, 'firerod'));
}

function canReachDeathMountainEast(items) {
  // LW DM east (needs hammer+mirror or hookshot, on top of west access)
  return canReachDeathMountainWest(items) &&
         (has(items, 'hookshot') || (has(items, 'hammer') && has(items, 'mirror')));
}

function canReachDarkDeathMountainEast(items) {
  // DDM east — superbunny cave, TR front, Hookshot Cave
  return canReachDeathMountainEast(items) &&
         has(items, 'moonpearl') && titan(items);
}

function canReachDarkDeathMountainWest(items) {
  // DDM west (superbunny descent from top of DM)
  return canReachDeathMountainWest(items) && has(items, 'moonpearl');
}

function canReachMireArea(items) {
  return canEnterDarkWorld(items) && has(items, 'flute') && titan(items);
}

/* -------------------------------------------------------------
   Dungeon logic — returns {entry, chests, boss}
     entry: can enter
     chests: STATE for chest accessibility (available/partial/unavail/dark)
     boss:   STATE for whether you can beat the dungeon
   Dungeon state also factors in chestsRemaining from user input.
   ------------------------------------------------------------- */

function dungeonResult(entry, chestsReachable, chestsRemaining, bossState) {
  // Outer chest square state
  let chestState = STATE.UNAVAIL;
  if (entry) {
    if (chestsRemaining <= 0) chestState = STATE.CHECKED;
    else if (chestsReachable >= chestsRemaining) chestState = STATE.AVAILABLE;
    else if (chestsReachable > 0) chestState = STATE.PARTIAL;
    else chestState = STATE.UNAVAIL;
  }
  return { entry, chests: chestState, boss: bossState };
}

const DUNGEONS = {
  /* ---------------- Light World ---------------- */
  ep: {
    name: 'Eastern Palace',
    region: 'Light World',
    totalChests: 3,       // chests + heart container drop
    hasMedallion: false,
    check(items, chestsRemaining) {
      const entry = true; // always reachable
      // To beat boss (Armos Knights): need bow
      const boss = entry && anyBow(items) && (lantern(items) || chestsRemaining === 0)
                   ? STATE.AVAILABLE
                   : (entry && anyBow(items) ? STATE.DARK : STATE.UNAVAIL);
      // Chests: the back chest (big key room) requires lantern (dark room)
      let reachable = 1; // entry room chest
      let isDark = false;
      if (anyBow(items)) reachable = 3; // can clear boss, all chests accessible with lantern
      if (!lantern(items) && reachable === 3) isDark = true;
      const r = dungeonResult(entry, reachable, chestsRemaining, boss);
      if (isDark && r.chests === STATE.AVAILABLE) r.chests = STATE.DARK;
      return r;
    },
  },

  dp: {
    name: 'Desert Palace',
    region: 'Light World',
    totalChests: 2,
    hasMedallion: false,
    check(items, chestsRemaining) {
      // Entry: book, OR mirror+flute+glove (Light World Dark World travel)
      const entry = has(items, 'book') ||
                    (has(items, 'mirror') && has(items, 'flute') && titan(items));
      // To beat boss (Lanmolas): need fire source + glove + (sword/bow/hammer/etc)
      const canBoss = entry && anyGlove(items) && fire(items) && canAttack(items);
      const boss = canBoss ? STATE.AVAILABLE : STATE.UNAVAIL;
      // Chests: without glove you get 1 chest; with glove you get all
      let reachable = 0;
      if (entry) reachable = anyGlove(items) ? 2 : 1;
      return dungeonResult(entry, reachable, chestsRemaining, boss);
    },
  },

  toh: {
    name: 'Tower of Hera',
    region: 'Light World',
    totalChests: 2,
    hasMedallion: false,
    check(items, chestsRemaining) {
      const entry = canReachDeathMountainWest(items) &&
                    (has(items, 'mirror') || (has(items, 'hookshot') && has(items, 'hammer')));
      // Big key requires fire source; boss (Moldorm) needs any weapon
      const canBoss = entry && fire(items) && canAttack(items);
      let reachable = 0;
      if (entry) {
        reachable = 1; // entry chest
        if (fire(items)) reachable = 2; // big key room + boss reward
      }
      // Dark-room consideration if no flute AND no lantern (climbing DM in the dark)
      const darkClimb = !lantern(items) && !has(items, 'flute');
      const boss = canBoss ? STATE.AVAILABLE : STATE.UNAVAIL;
      const r = dungeonResult(entry, reachable, chestsRemaining, boss);
      if (darkClimb && r.chests === STATE.AVAILABLE) r.chests = STATE.DARK;
      if (darkClimb && r.boss === STATE.AVAILABLE) r.boss = STATE.DARK;
      return r;
    },
  },

  hc: {
    name: 'Hyrule Castle',
    region: 'Light World',
    totalChests: 6,
    hasMedallion: false,
    check(items, chestsRemaining) {
      // Escape: reachable but sewers are dark without lantern
      const entry = true;
      const reachable = 6;
      const boss = STATE.AVAILABLE; // no boss (escape only)
      const r = dungeonResult(entry, reachable, chestsRemaining, STATE.CHECKED);
      if (!lantern(items) && r.chests === STATE.AVAILABLE) r.chests = STATE.DARK;
      return r;
    },
  },

  at: {
    name: 'Castle Tower',
    region: 'Light World',
    totalChests: 0,          // no lootable chests (Aga is the "prize")
    hasMedallion: false,
    check(items) {
      // Entry: master sword OR cape+fighter sword
      const entry = masterSword(items) ||
                    (has(items, 'cape') && sword(items) >= 1);
      // Boss: needs sword to hit Agahnim
      const canBoss = entry && sword(items) >= 1;
      const boss = canBoss ? STATE.AVAILABLE : STATE.UNAVAIL;
      // Dark rooms inside
      const isDark = !lantern(items);
      const r = { entry, chests: STATE.CHECKED, boss };
      if (isDark && r.boss === STATE.AVAILABLE) r.boss = STATE.DARK;
      return r;
    },
  },

  /* ---------------- Dark World ---------------- */
  pod: {
    name: 'Palace of Darkness',
    region: 'Dark World',
    totalChests: 5,
    hasMedallion: false,
    check(items, chestsRemaining) {
      const entry = canEnterDarkWorld(items) && anyGlove(items);
      // Boss: need bow, hammer for helmasaur
      const canBoss = entry && anyBow(items) && has(items, 'hammer');
      const boss = canBoss ? STATE.AVAILABLE : STATE.UNAVAIL;
      // All chests need lantern to navigate dark rooms
      let reachable = 0;
      if (entry) {
        reachable = anyBow(items) && has(items, 'hammer') ? 5
                  : anyBow(items) ? 5 // can still reach most; simplified
                  : 1;
      }
      const r = dungeonResult(entry, reachable, chestsRemaining, boss);
      if (!lantern(items) && r.chests !== STATE.UNAVAIL) r.chests = STATE.DARK;
      if (!lantern(items) && r.boss === STATE.AVAILABLE) r.boss = STATE.DARK;
      return r;
    },
  },

  sp: {
    name: 'Swamp Palace',
    region: 'Dark World',
    totalChests: 6,
    hasMedallion: false,
    check(items, chestsRemaining) {
      const entry = canReachDarkWorldSouth(items) &&
                    has(items, 'mirror') && has(items, 'flippers');
      const canBoss = entry && has(items, 'hammer') && has(items, 'hookshot');
      const boss = canBoss ? STATE.AVAILABLE : STATE.UNAVAIL;
      let reachable = 0;
      if (entry) {
        reachable = 1; // entry chest
        if (has(items, 'hammer')) {
          reachable = 4;
          if (has(items, 'hookshot')) reachable = 6;
        }
      }
      return dungeonResult(entry, reachable, chestsRemaining, boss);
    },
  },

  sw: {
    name: 'Skull Woods',
    region: 'Dark World',
    totalChests: 2,
    hasMedallion: false,
    check(items, chestsRemaining) {
      const entry = canReachDarkWorldNorthWest(items);
      const canBoss = entry && has(items, 'firerod') && sword(items) >= 1;
      const boss = canBoss ? STATE.AVAILABLE : STATE.UNAVAIL;
      const reachable = entry ? 2 : 0;
      return dungeonResult(entry, reachable, chestsRemaining, boss);
    },
  },

  tt: {
    name: "Thieves' Town",
    region: 'Dark World',
    totalChests: 4,
    hasMedallion: false,
    check(items, chestsRemaining) {
      const entry = canReachDarkWorldNorthWest(items);
      const canBoss = entry && canAttack(items) && has(items, 'hammer');
      const boss = canBoss ? STATE.AVAILABLE : STATE.UNAVAIL;
      let reachable = 0;
      if (entry) {
        reachable = 3;
        if (has(items, 'hammer')) reachable = 4;
      }
      return dungeonResult(entry, reachable, chestsRemaining, boss);
    },
  },

  ip: {
    name: 'Ice Palace',
    region: 'Dark World',
    totalChests: 3,
    hasMedallion: false,
    check(items, chestsRemaining) {
      const entry = canEnterDarkWorld(items) &&
                    has(items, 'flippers') && titan(items) && melt(items);
      const canBoss = entry && has(items, 'hammer') && anyGlove(items);
      const boss = canBoss ? STATE.AVAILABLE : STATE.UNAVAIL;
      let reachable = 0;
      if (entry) {
        reachable = 1;
        if (has(items, 'hammer')) {
          reachable = 2;
          if (titan(items)) reachable = 3;
        }
      }
      return dungeonResult(entry, reachable, chestsRemaining, boss);
    },
  },

  mm: {
    name: 'Misery Mire',
    region: 'Dark World',
    totalChests: 2,
    hasMedallion: true,
    check(items, chestsRemaining, medallion) {
      const entryBase = canReachMireArea(items) &&
                        has(items, 'moonpearl') &&
                        sword(items) >= 1 &&
                        (has(items, 'boots') || has(items, 'hookshot'));
      if (!entryBase) {
        return { entry: false, chests: STATE.UNAVAIL, boss: STATE.UNAVAIL };
      }
      // Medallion gating
      let medOk = false;
      if (medallion === 1 && has(items, 'bombos')) medOk = true;
      else if (medallion === 2 && has(items, 'ether')) medOk = true;
      else if (medallion === 3 && has(items, 'quake')) medOk = true;
      else if (!medallion) {
        // Unknown medallion — show visible only if you have sword+any medallion
        if (sword(items) >= 1 && (has(items, 'bombos') || has(items, 'ether') || has(items, 'quake'))) {
          medOk = 'maybe';
        }
      }
      if (!medOk) {
        return { entry: entryBase, chests: STATE.VISIBLE, boss: STATE.VISIBLE };
      }
      const canBoss = has(items, 'somaria') && fire(items);
      const boss = canBoss ? STATE.AVAILABLE : STATE.UNAVAIL;
      let reachable = 2;
      const r = dungeonResult(true, reachable, chestsRemaining, boss);
      if (medOk === 'maybe') {
        if (r.chests !== STATE.UNAVAIL && r.chests !== STATE.CHECKED) r.chests = STATE.VISIBLE;
        if (r.boss !== STATE.UNAVAIL) r.boss = STATE.VISIBLE;
      }
      if (!lantern(items) && !has(items, 'firerod')) {
        if (r.chests === STATE.AVAILABLE) r.chests = STATE.DARK;
        if (r.boss === STATE.AVAILABLE) r.boss = STATE.DARK;
      }
      return r;
    },
  },

  tr: {
    name: 'Turtle Rock',
    region: 'Dark World',
    totalChests: 5,
    hasMedallion: true,
    check(items, chestsRemaining, medallion) {
      const entryBase = canReachDarkDeathMountainEast(items) &&
                        has(items, 'hammer') && has(items, 'somaria') &&
                        sword(items) >= 1;
      if (!entryBase) {
        return { entry: false, chests: STATE.UNAVAIL, boss: STATE.UNAVAIL };
      }
      let medOk = false;
      if (medallion === 1 && has(items, 'bombos') && masterSword(items)) medOk = true;
      else if (medallion === 2 && has(items, 'ether')) medOk = true;
      else if (medallion === 3 && has(items, 'quake')) medOk = true;
      else if (!medallion) {
        const haveAnyMed = has(items, 'bombos') || has(items, 'ether') || has(items, 'quake');
        if (haveAnyMed) medOk = 'maybe';
      }
      if (!medOk) {
        return { entry: entryBase, chests: STATE.VISIBLE, boss: STATE.VISIBLE };
      }
      const defense = has(items, 'byrna') || has(items, 'cape') || sword(items) >= 3;
      const canBoss = fire(items) && has(items, 'icerod');
      const boss = canBoss ? STATE.AVAILABLE : STATE.UNAVAIL;
      // Chests: laser bridge room needs cape/byrna/mirror-shield (sword4 is tempered+)
      let reachable = 1;
      if (has(items, 'firerod')) reachable = 2;
      if (defense) reachable = 4;
      if (defense && has(items, 'firerod')) reachable = 5;
      const r = dungeonResult(true, reachable, chestsRemaining, boss);
      if (medOk === 'maybe') {
        if (r.chests !== STATE.UNAVAIL && r.chests !== STATE.CHECKED) r.chests = STATE.VISIBLE;
        if (r.boss !== STATE.UNAVAIL) r.boss = STATE.VISIBLE;
      }
      return r;
    },
  },

  gt: {
    name: "Ganon's Tower",
    region: 'Dark World',
    totalChests: 20,
    hasMedallion: false,
    check(items, chestsRemaining, _med, crystalCount) {
      // GT entry: need enough crystals + reach DDM + moonpearl
      const canReach = canReachDarkDeathMountainEast(items) || canReachDarkDeathMountainWest(items);
      const entry = canReach && has(items, 'moonpearl') && (crystalCount || 0) >= 7;
      if (!entry) return { entry: false, chests: STATE.UNAVAIL, boss: STATE.UNAVAIL };
      // Beating Ganon inside GT: need silvers or similar — abstracted
      const canBoss = silvers(items) && has(items, 'hammer') && anyBow(items);
      const boss = canBoss ? STATE.AVAILABLE : STATE.UNAVAIL;
      // Simplified: if you can enter, chests are accessible with full kit.
      // Bombs are assumed to always be available.
      let reachable = 0;
      if (has(items, 'firerod') && has(items, 'hookshot') &&
          has(items, 'hammer') && has(items, 'somaria') &&
          has(items, 'boots')) reachable = 20;
      else if (has(items, 'hammer')) reachable = 10;
      else reachable = 3;
      reachable = Math.min(reachable, 20);
      const r = dungeonResult(true, reachable, chestsRemaining, boss);
      if (!lantern(items) && r.chests !== STATE.UNAVAIL) r.chests = STATE.DARK;
      if (!lantern(items) && r.boss === STATE.AVAILABLE) r.boss = STATE.DARK;
      return r;
    },
  },
};

/* -------------------------------------------------------------
   Overworld / standalone locations
   ------------------------------------------------------------- */

const LOCATIONS = [
  /* ---- Light World ---- */
  { id: 'lw-pedestal', region: 'Light World', name: 'Master Sword Pedestal',
    check: (i, st) => {
      // Prize codes: 0=blue crystal, 1=red crystal, 2=red/blue pendant,
      // 3=green pendant, 4=metroid boss. Pedestal needs all 3 pendants.
      const prizes = [st.dungeons.ep?.prize, st.dungeons.dp?.prize, st.dungeons.toh?.prize];
      const pendants = prizes.filter(p => p === 2 || p === 3).length;
      if (pendants >= 3) return STATE.AVAILABLE;
      if (has(i, 'book')) return STATE.VISIBLE;
      return STATE.UNAVAIL;
    } },
  { id: 'lw-mushroom', region: 'Light World', name: 'Mushroom (Lost Woods)',
    check: () => STATE.AVAILABLE },
  { id: 'lw-lostwoods-hideout', region: 'Light World', name: 'Lost Woods Hideout',
    check: () => STATE.AVAILABLE },
  { id: 'lw-lumberjacks', region: 'Light World', name: 'Lumberjacks Tree',
    check: (i, st) => (st.dungeons.at?.boss && has(i, 'boots')) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'lw-king-tomb', region: 'Light World', name: "King's Tomb",
    check: (i) => {
      if (!has(i, 'boots')) return STATE.UNAVAIL;
      if (titan(i)) return STATE.AVAILABLE;
      if (has(i, 'mirror') && canEnterDarkWorld(i)) return STATE.AVAILABLE;
      return STATE.VISIBLE;
    } },
  { id: 'lw-kakariko-well', region: 'Light World', name: 'Kakariko Well',
    check: () => STATE.AVAILABLE },
  { id: 'lw-blinds-hideout', region: 'Light World', name: "Blind's Hideout",
    check: () => STATE.AVAILABLE },
  { id: 'lw-bottle-merchant', region: 'Light World', name: 'Bottle Merchant',
    check: () => STATE.AVAILABLE },
  { id: 'lw-chicken-house', region: 'Light World', name: 'Chicken House',
    check: () => STATE.AVAILABLE },
  { id: 'lw-sick-kid', region: 'Light World', name: 'Sick Kid',
    check: (i) => (i.bottle || 0) > 0 ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'lw-library', region: 'Light World', name: 'Library',
    check: (i) => has(i, 'boots') ? STATE.AVAILABLE : STATE.VISIBLE },
  { id: 'lw-kakariko-tavern', region: 'Light World', name: 'Kakariko Tavern',
    check: () => STATE.AVAILABLE },
  { id: 'lw-maze-race', region: 'Light World', name: 'Maze Race',
    check: () => STATE.AVAILABLE },
  { id: 'lw-cave45', region: 'Light World', name: 'Cave 45',
    check: (i) => (has(i, 'mirror') && canReachDarkWorldSouth(i)) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'lw-checkerboard', region: 'Light World', name: 'Checkerboard Cave',
    check: (i) => (canReachMireArea(i) && has(i, 'mirror')) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'lw-aginah', region: 'Light World', name: "Aginah's Cave",
    check: () => STATE.AVAILABLE },
  { id: 'lw-desert-ledge', region: 'Light World', name: 'Desert Ledge',
    check: (i) => {
      if (has(i, 'book')) return STATE.AVAILABLE;
      if (has(i, 'flute') && has(i, 'mirror') && titan(i)) return STATE.AVAILABLE;
      return STATE.UNAVAIL;
    } },
  { id: 'lw-lake-hylia-island', region: 'Light World', name: 'Lake Hylia Island',
    check: (i) => (has(i, 'flippers') && has(i, 'moonpearl') && has(i, 'mirror') && canEnterDarkWorld(i))
                  ? STATE.AVAILABLE : STATE.VISIBLE },
  { id: 'lw-sunken-treasure', region: 'Light World', name: 'Sunken Treasure',
    check: () => STATE.AVAILABLE },
  { id: 'lw-flute-spot', region: 'Light World', name: 'Flute Spot (Ocarina)',
    check: (i) => has(i, 'shovel') ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'lw-waterfall-fairy', region: 'Light World', name: 'Waterfall Fairy',
    check: (i) => has(i, 'flippers') ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'lw-zora', region: 'Light World', name: "Zora's Ledge",
    check: (i) => has(i, 'flippers') ? STATE.AVAILABLE
                : (anyGlove(i) ? STATE.VISIBLE : STATE.UNAVAIL) },
  { id: 'lw-mimic-cave', region: 'Light World', name: 'Mimic Cave',
    check: (i, st) => {
      // Requires TR medallion known + mirror + accessed via DDM
      const tr = DUNGEONS.tr.check(i, 5, st.dungeons.tr?.medallion);
      if (!tr.entry) return STATE.UNAVAIL;
      if (!has(i, 'mirror')) return STATE.UNAVAIL;
      if (tr.chests === STATE.VISIBLE) return STATE.VISIBLE;
      return STATE.AVAILABLE;
    } },
  { id: 'lw-spectacle-rock', region: 'Light World', name: 'Spectacle Rock',
    check: (i) => {
      if (!canReachDeathMountainWest(i)) return STATE.UNAVAIL;
      if (has(i, 'mirror')) return STATE.AVAILABLE;
      return STATE.VISIBLE;
    } },
  { id: 'lw-spectacle-rock-cave', region: 'Light World', name: 'Spectacle Rock Cave',
    check: (i) => canReachDeathMountainWest(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'lw-old-man', region: 'Light World', name: 'Old Man',
    check: (i) => {
      if (!canReachDeathMountainWest(i)) return STATE.UNAVAIL;
      return lantern(i) ? STATE.AVAILABLE : STATE.DARK;
    } },
  { id: 'lw-ether-tablet', region: 'Light World', name: 'Ether Tablet',
    check: (i) => {
      if (!canReachDeathMountainEast(i)) return STATE.UNAVAIL;
      if (!has(i, 'book')) return STATE.VISIBLE;
      if (!masterSword(i)) return STATE.VISIBLE;
      return STATE.AVAILABLE;
    } },
  { id: 'lw-bombos-tablet', region: 'Light World', name: 'Bombos Tablet',
    check: (i) => {
      if (!has(i, 'mirror') || !canReachDarkWorldSouth(i)) return STATE.UNAVAIL;
      if (!has(i, 'book')) return STATE.VISIBLE;
      if (!masterSword(i)) return STATE.VISIBLE;
      return STATE.AVAILABLE;
    } },
  { id: 'lw-floating-island', region: 'Light World', name: 'Floating Island',
    check: (i) => {
      if (!canReachDeathMountainEast(i)) return STATE.UNAVAIL;
      if (has(i, 'mirror') && has(i, 'moonpearl') && titan(i)) return STATE.AVAILABLE;
      return STATE.VISIBLE;
    } },
  { id: 'lw-spiral-cave', region: 'Light World', name: 'Spiral Cave',
    check: (i) => canReachDeathMountainEast(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'lw-paradox-cave', region: 'Light World', name: 'Paradox Cave (upper + lower)',
    check: (i) => canReachDeathMountainEast(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'lw-mini-moldorm', region: 'Light World', name: 'Mini-Moldorm Cave',
    check: () => STATE.AVAILABLE },
  { id: 'lw-ice-rod-cave', region: 'Light World', name: 'Ice Rod Cave',
    check: () => STATE.AVAILABLE },
  { id: 'lw-sahasrahla-reward', region: 'Light World', name: "Sahasrahla's Reward",
    check: (i, st) => st.dungeons.ep?.prize === 3 ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'lw-sahasrahla-hut', region: 'Light World', name: "Sahasrahla's Hut",
    check: () => STATE.AVAILABLE },

  /* ---- Light World: newly added from the MapleQueen guide cross-check ---- */
  { id: 'lw-links-uncle', region: 'Light World', name: "Link's Uncle",
    check: () => STATE.AVAILABLE },
  { id: 'lw-secret-passage', region: 'Light World', name: 'Secret Passage',
    check: () => STATE.AVAILABLE },
  { id: 'lw-links-house', region: 'Light World', name: "Link's House",
    check: () => STATE.AVAILABLE },
  { id: 'lw-graveyard-ledge', region: 'Light World', name: 'Graveyard Ledge',
    // Need boots to dash into the grave, then accessed from DW via mirror
    // OR glitch-less vanilla path (skipped for now). Treat same shape as King's Tomb.
    check: (i) => {
      if (!has(i, 'boots')) return STATE.UNAVAIL;
      if (has(i, 'mirror') && canEnterDarkWorld(i)) return STATE.AVAILABLE;
      return STATE.VISIBLE;
    } },
  { id: 'lw-pegasus-rocks', region: 'Light World', name: 'Pegasus Rocks',
    check: (i) => has(i, 'boots') ? STATE.AVAILABLE : STATE.VISIBLE },
  { id: 'lw-king-zora', region: 'Light World', name: 'King Zora',
    // Pay 500 rupees — reachable with any glove (to climb around the cliff)
    check: (i) => anyGlove(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'lw-potion-shop', region: 'Light World', name: 'Potion Shop',
    // The witch gives you one free item once you deliver her the mushroom
    check: (i) => has(i, 'mushroom') ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'lw-magic-bat', region: 'Light World', name: 'Magic Bat',
    // Needs powder (to wake the bat) and hammer (to smash hammer pegs on the way)
    check: (i) => (has(i, 'powder') && has(i, 'hammer')) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'lw-floodgate', region: 'Light World', name: 'Floodgate Chest',
    // Chest on the ledge near the floodgate control — reachable once you
    // can get to the swamp region. Always available in standard rules.
    check: () => STATE.AVAILABLE },
  { id: 'lw-hobo', region: 'Light World', name: 'Hobo (under bridge)',
    // Under the bridge near Lake Hylia — need flippers to swim there
    check: (i) => has(i, 'flippers') ? STATE.AVAILABLE : STATE.UNAVAIL },

  /* ---- Dark World ---- */
  { id: 'dw-pyramid-fairy', region: 'Dark World', name: 'Pyramid Fairy',
    check: (i, st) => {
      if (!canReachPyramid(i) || !has(i, 'mirror')) return STATE.UNAVAIL;
      // Need to have rescued the 2 dwarves = need crystals 5+6 (red crystals, prize code 1)
      const redCount = Object.values(st.dungeons).filter(d => d.prize === 1).length;
      if (redCount < 2) return STATE.UNAVAIL;
      return has(i, 'hammer') || canReachDWViaAgahnim(i) ? STATE.AVAILABLE : STATE.UNAVAIL;
    } },
  { id: 'dw-catfish', region: 'Dark World', name: 'Catfish',
    check: (i) => (canReachDarkWorldEast(i) && anyGlove(i)) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'dw-pyramid', region: 'Dark World', name: 'Pyramid (ledge)',
    check: (i) => canReachPyramid(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'dw-digging-game', region: 'Dark World', name: 'Digging Game',
    check: (i) => canReachDarkWorldSouth(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'dw-stumpy', region: 'Dark World', name: 'Stumpy',
    check: (i) => canReachDarkWorldSouth(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'dw-hype-cave', region: 'Dark World', name: 'Hype Cave',
    check: (i) => canReachDarkWorldSouth(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'dw-bumper-cave', region: 'Dark World', name: 'Bumper Cave',
    check: (i) => (canReachDarkWorldNorthWest(i) && has(i, 'cape') && anyGlove(i))
                  ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'dw-chest-game', region: 'Dark World', name: 'Chest Game',
    check: (i) => canReachDarkWorldNorthWest(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'dw-brewery', region: 'Dark World', name: 'Brewery',
    check: (i) => canReachDarkWorldNorthWest(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'dw-c-house', region: 'Dark World', name: 'C-House',
    check: (i) => canReachDarkWorldNorthWest(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'dw-hammer-peg', region: 'Dark World', name: 'Hammer Pegs Cave',
    check: (i) => (canReachDarkWorldNorthWest(i) && has(i, 'hammer') && titan(i))
                  ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'dw-purple-chest', region: 'Dark World', name: 'Purple Chest (trade)',
    check: (i) => (canReachDarkWorldNorthWest(i) && titan(i)) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'dw-blacksmith', region: 'Dark World', name: 'Blacksmith',
    check: (i) => (canReachDarkWorldNorthWest(i) && titan(i)) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'dw-mire-shed', region: 'Dark World', name: 'Mire Shed',
    check: (i) => canReachMireArea(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'dw-hookshot-cave', region: 'Dark World', name: 'Hookshot Cave',
    check: (i) => {
      if (!canReachDarkDeathMountainEast(i)) return STATE.UNAVAIL;
      if (has(i, 'hookshot')) return STATE.AVAILABLE;
      if (has(i, 'boots')) return STATE.AVAILABLE;
      return STATE.UNAVAIL;
    } },
  { id: 'dw-superbunny-cave', region: 'Dark World', name: 'Superbunny Cave',
    check: (i) => canReachDarkDeathMountainEast(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'dw-spike-cave', region: 'Dark World', name: 'Byrna Spike Cave',
    check: (i) => {
      if (!canReachDarkDeathMountainWest(i)) return STATE.UNAVAIL;
      if (!has(i, 'hammer') || !anyGlove(i)) return STATE.UNAVAIL;
      // Survivable with byrna or cape; otherwise technically possible but rough
      return (has(i, 'byrna') || has(i, 'cape')) ? STATE.AVAILABLE : STATE.PARTIAL;
    } },

  /* ---- Super Metroid (major items / zones) ---- */
  { id: 'sm-crateria-wake', region: 'Super Metroid', name: 'Crateria — Wake Up Items',
    check: (i) => has(i, 'morph') ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-brin-morph', region: 'Super Metroid', name: 'Brinstar — Morph Ball Area',
    check: (i) => has(i, 'morph') ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-brin-pinkpb', region: 'Super Metroid', name: 'Pink Brinstar — Super/Hidden PB',
    check: (i) => (has(i, 'morph') && has(i, 'super')) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-brin-redtower', region: 'Super Metroid', name: 'Red Brinstar — Red Tower',
    check: (i) => (has(i, 'morph') && (has(i, 'super') || has(i, 'pb'))) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-kraid', region: 'Super Metroid', name: 'Kraid (boss)',
    check: (i) => (has(i, 'morph') && has(i, 'super')) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-norfair-upper', region: 'Super Metroid', name: 'Upper Norfair — items',
    check: (i) => (has(i, 'morph') && has(i, 'super') && (has(i, 'hijump') || has(i, 'ice') || has(i, 'space'))) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-norfair-lower', region: 'Super Metroid', name: 'Lower Norfair — items',
    check: (i) => (has(i, 'morph') && has(i, 'super') && has(i, 'varia') && has(i, 'pb') && (has(i, 'space') || (has(i, 'hijump') && has(i, 'gravity')))) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-ridley', region: 'Super Metroid', name: 'Ridley (boss)',
    check: (i) => (has(i, 'morph') && has(i, 'super') && has(i, 'varia') && has(i, 'pb')) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-wrecked', region: 'Super Metroid', name: 'Wrecked Ship — items',
    check: (i) => (has(i, 'morph') && has(i, 'super') && has(i, 'pb')) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-phantoon', region: 'Super Metroid', name: 'Phantoon (boss)',
    check: (i) => (has(i, 'morph') && has(i, 'super') && has(i, 'pb')) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-maridia-outer', region: 'Super Metroid', name: 'Maridia — Outer',
    check: (i) => (has(i, 'morph') && has(i, 'super') && has(i, 'pb') && (has(i, 'gravity') || (has(i, 'hijump') && has(i, 'ice')))) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-maridia-inner', region: 'Super Metroid', name: 'Maridia — Inner',
    check: (i) => (has(i, 'morph') && has(i, 'super') && has(i, 'pb') && has(i, 'gravity')) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-draygon', region: 'Super Metroid', name: 'Draygon (boss)',
    check: (i) => (has(i, 'morph') && has(i, 'super') && has(i, 'pb') && has(i, 'gravity')) ? STATE.AVAILABLE : STATE.UNAVAIL },
];

/* Exports */
window.SMZ3Logic = {
  STATE,
  DUNGEONS,
  LOCATIONS,
};
