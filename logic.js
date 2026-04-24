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
  // Village of Outcasts. Three independent routes:
  //   1) DW East access + Hookshot + (Hammer OR any glove) + Moon Pearl
  //      — cross from East over the hookshot pegs/bridge into the village
  //   2) Moon Pearl + any glove + Hammer
  //      — south-then-up loop using hammer pegs to reach the village
  //   3) Moon Pearl + Titan glove
  //      — direct lift entry from the LW (kakariko-equivalent area)
  if (!has(items, 'moonpearl')) return false;
  if (titan(items)) return true;
  if (anyGlove(items) && has(items, 'hammer')) return true;
  if (canReachDarkWorldEast(items) && has(items, 'hookshot') &&
      (has(items, 'hammer') || anyGlove(items))) return true;
  return false;
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
   Super Metroid access predicates
   Ported approximately from tewtal/SMZ3Randomizer source.
   These represent the most common no-glitches paths — not every
   tournament-level trick is included, so a marker may show
   UNAVAIL when an expert player could in fact reach it.
   ------------------------------------------------------------- */

// Item shorthand — Super Metroid items use these IDs in state.items:
//   morph, bombs_sm, super, pb, charge, ice, wave, spazer, plasma,
//   varia, gravity, hijump, speed, space, spring, screw, grapple,
//   xray, missile

function smHasMorph(i)    { return has(i, 'morph'); }
function smHasBombs(i)    { return has(i, 'bombs_sm'); }
function smHasSuper(i)    { return has(i, 'super'); }
function smHasPB(i)       { return has(i, 'pb'); }
function smHasMissile(i)  { return has(i, 'missile'); }
function smHasVaria(i)    { return has(i, 'varia'); }
function smHasGravity(i)  { return has(i, 'gravity'); }
function smHasHiJump(i)   { return has(i, 'hijump'); }
function smHasSpeed(i)    { return has(i, 'speed'); }
function smHasSpace(i)    { return has(i, 'space'); }
function smHasSpring(i)   { return has(i, 'spring'); }
function smHasScrew(i)    { return has(i, 'screw'); }
function smHasGrapple(i)  { return has(i, 'grapple'); }
function smHasIce(i)      { return has(i, 'ice'); }
function smHasWave(i)     { return has(i, 'wave'); }
function smHasPlasma(i)   { return has(i, 'plasma'); }
function smHasCharge(i)   { return has(i, 'charge'); }

// Open a power-bomb passage (red door / pb block)
function canUsePowerBombs(i) { return smHasMorph(i) && smHasPB(i); }

// Get through a bomb-block — bombs OR power bombs
function canPassBombPassages(i) {
  return smHasMorph(i) && (smHasBombs(i) || smHasPB(i));
}

// Destroy bomb walls (slightly thicker than passages — needs power bombs OR screw OR speed)
function canDestroyBombWalls(i) {
  return (smHasMorph(i) && (smHasBombs(i) || smHasPB(i))) || smHasScrew(i);
}

// Open green-door rooms (need supers)
function canOpenGreenDoors(i) { return smHasSuper(i); }

// Open red-door rooms (need missiles or supers)
function canOpenRedDoors(i)   { return smHasMissile(i) || smHasSuper(i); }

// Get up tall jumps without a Space Jump
function canFly(i) { return smHasSpace(i) || (smHasMorph(i) && smHasBombs(i)); }

// Heat protection
function hasHeatShield(i) { return smHasVaria(i) || smHasGravity(i); }

// Hellrun — no Varia in Norfair, requires energy + speed
function canHellRun(i)    { return smHasVaria(i); }

// ----- Region access -----

// Reach Crateria upper / east areas. From start you have ship landing.
function canEnterAndLeaveGauntlet(i) {
  // Need to clear Gauntlet — speed booster shinespark, OR power bombs to clear
  return canDestroyBombWalls(i) || (smHasSpeed(i) && smHasMorph(i));
}

/* -------------------------------------------------------------
   Cross-game portals — vanilla SMZ3.
   Four portals connect ALttP and SM. Reaching the ALttP side
   of a portal grants access to the SM side, AND vice versa.
   For now we model the ALttP→SM direction (the more common
   case where ALttP routes unblock SM regions). The reverse
   direction (SM→ALttP) is left for a future pass.
   ------------------------------------------------------------- */

// Norfair Upper Portal — LW Death Mountain in front of Turtle Rock
// drops into Upper Norfair. Source: SMZ3 Item.cs CanAccessNorfairUpperPortal
//   = Flute OR (any glove + Lantern)
function canAccessNorfairUpperPortal(i) {
  return has(i, 'flute') || (anyGlove(i) && lantern(i));
}

// Norfair Lower (West) Portal — Misery Mire entry square portals
// into Lower Norfair (Wrecked-Ship-side).
// Source: SMZ3 Item.cs CanAccessNorfairLowerPortal = Flute + Titan glove
function canAccessNorfairLowerPortal(i) {
  return has(i, 'flute') && titan(i);
}

// Maridia Portal — Crateria moat island accessible from outside
// the Wrecked Ship. The ALttP-side version requires standing on
// the sand / quicksand entry near the pyramid.
// Source: SMZ3 Item.cs CanAccessMaridiaPortal (Normal logic):
//   Moonpearl + Flippers + Gravity + Morph + (Aga OR (Hammer+Glove) OR Titan)
// Treat this as the ALttP-route way to reach Maridia.
function canAccessMaridiaPortal(i) {
  return has(i, 'moonpearl') && has(i, 'flippers') &&
         smHasGravity(i) && smHasMorph(i) &&
         (canReachDWViaAgahnim(i) || (has(i, 'hammer') && anyGlove(i)) || titan(i));
}

// Wrecked Ship Portal — DW Northwest (Skull Woods area) connects to
// the Wrecked Ship exterior. Once you can reach DW NW you can portal in.
function canAccessWreckedShipPortal(i) {
  return canReachDarkWorldNorthWest(i);
}

// Old Mother Brain / Tourian elevator — basic Crateria movement
function canAccessRedBrinstar(i) {
  return canOpenGreenDoors(i) && (canDestroyBombWalls(i) || smHasHiJump(i));
}

function canAccessKraid(i) {
  return canAccessRedBrinstar(i) && canPassBombPassages(i);
}

function canAccessHeatedNorfairUpper(i) {
  // Two ways in:
  //   (a) Brinstar elevator: Red Brinstar + heat shield (vanilla SM path)
  //   (b) Norfair Upper Portal from LW DM East / Turtle Rock area
  //       (still need heat protection unless you carry fast)
  return (canAccessRedBrinstar(i) && hasHeatShield(i)) ||
         (canAccessNorfairUpperPortal(i) && hasHeatShield(i));
}

function canAccessNorfairUpper(i) {
  // Norfair entry — to even reach the elevator from red Brinstar
  return canAccessRedBrinstar(i) || canAccessNorfairUpperPortal(i);
}

function canAccessLowerNorfair(i) {
  // Two ways in:
  //   (a) Through Upper Norfair: Varia + power bombs + Space Jump (or Gravity+HiJump)
  //   (b) Norfair Lower Portal from Misery Mire area — drops you straight into LN
  //       and you still need Varia for the heat. (No Space Jump strictly needed
  //       since you start from a different entry point.)
  const sideA = canAccessNorfairUpper(i) &&
                smHasVaria(i) && canUsePowerBombs(i) &&
                (smHasSpace(i) || (smHasGravity(i) && smHasHiJump(i)));
  const sideB = canAccessNorfairLowerPortal(i) && smHasVaria(i) && canUsePowerBombs(i);
  return sideA || sideB;
}

function canAccessWreckedShip(i) {
  // Two ways in:
  //   (a) SM Crateria path: power bombs + supers
  //   (b) Wrecked Ship Portal from DW Northwest (Skull Woods area)
  return (canUsePowerBombs(i) && canOpenGreenDoors(i)) ||
         canAccessWreckedShipPortal(i);
}

function canDefeatPhantoon(i) {
  // Phantoon dies to charge OR enough ammo. Simplified: charge OR plenty of supers.
  // We'll require supers (the door key) and accept either charge or just supers.
  return canAccessWreckedShip(i);
}

function canAccessOuterMaridia(i) {
  // Two ways in:
  //   (a) SM-side: Red Brinstar + power bombs + (Gravity OR HiJump+Ice)
  //   (b) Maridia Portal from Crateria moat (via the pyramid area in DW)
  const sideA = canAccessRedBrinstar(i) && canUsePowerBombs(i) &&
                (smHasGravity(i) || (smHasHiJump(i) && smHasIce(i)));
  const sideB = canAccessMaridiaPortal(i);  // already requires Gravity+Morph
  return sideA || sideB;
}

function canAccessInnerMaridia(i) {
  // Past Botwoon's quicksand — really wants gravity
  return canAccessOuterMaridia(i) && smHasGravity(i);
}

function canDefeatDraygon(i) {
  return canAccessInnerMaridia(i) && (smHasSpeed(i) || smHasGrapple(i));
}

function canDefeatBotwoon(i) {
  return canAccessOuterMaridia(i) && (smHasIce(i) || smHasSpeed(i));
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
    check: (i, st) => (st.dungeons.at?.boss && has(i, 'boots'))
                      ? STATE.AVAILABLE
                      : STATE.VISIBLE },
  { id: 'lw-king-tomb', region: 'Light World', name: "King's Tomb",
    check: (i) => {
      // Boots required to dash into the tomb. Reachable two ways:
      //   - Titan glove (lift the gravestones from the LW side), OR
      //   - Mirror back from the Dark World pyramid area.
      if (!has(i, 'boots')) return STATE.UNAVAIL;
      if (titan(i)) return STATE.AVAILABLE;
      if (has(i, 'mirror') && canEnterDarkWorld(i)) return STATE.AVAILABLE;
      return STATE.UNAVAIL;
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
    // Reach the ledge above the graveyard by mirroring from the
    // corresponding DW spot. Boots not required (it's the King's Tomb
    // chest that needs boots, not this one).
    check: (i) => (has(i, 'mirror') && canEnterDarkWorld(i)) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'lw-pegasus-rocks', region: 'Light World', name: 'Pegasus Rocks',
    check: (i) => has(i, 'boots') ? STATE.AVAILABLE : STATE.UNAVAIL },
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

  /* ====================================================
     Super Metroid — 100 individual checks
     IDs match the calibrator (sm-bri-NN, sm-crt-NN, etc.)
     Region tagged 'Super Metroid' so the map renderer
     knows to draw markers on the SM map.
     ====================================================*/

  // ---- Brinstar (1–28) ----
  { id: 'sm-bri-01', region: 'Super Metroid', name: 'Super Missile (green Brinstar top)',
    check: (i) => (canDestroyBombWalls(i) && smHasMorph(i) && canOpenGreenDoors(i) && smHasSpeed(i)) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-bri-02', region: 'Super Metroid', name: 'Missile (green Brinstar below super missile)',
    check: (i) => (canPassBombPassages(i) && canOpenRedDoors(i)) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-bri-03', region: 'Super Metroid', name: 'Reserve Tank, Brinstar',
    check: (i) => (canDestroyBombWalls(i) && smHasMorph(i) && smHasSpeed(i)) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-bri-04', region: 'Super Metroid', name: 'Missile (green Brinstar behind reserve tank)',
    check: (i) => (canDestroyBombWalls(i) && smHasMorph(i) && smHasSpeed(i)) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-bri-05', region: 'Super Metroid', name: 'Missile (green Brinstar behind missile)',
    check: (i) => (canDestroyBombWalls(i) && smHasMorph(i) && smHasSpeed(i)) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-bri-06', region: 'Super Metroid', name: 'Missile (pink Brinstar top)',
    check: (i) => (canPassBombPassages(i) && canOpenGreenDoors(i)) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-bri-07', region: 'Super Metroid', name: 'Power Bomb (green Brinstar bottom)',
    check: (i) => canUsePowerBombs(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-bri-08', region: 'Super Metroid', name: 'Power Bomb (pink Brinstar)',
    check: (i) => (canUsePowerBombs(i) && canOpenGreenDoors(i)) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-bri-09', region: 'Super Metroid', name: 'Energy Tank, Brinstar Gate',
    check: (i) => (canPassBombPassages(i) && canOpenGreenDoors(i) && (smHasWave(i) || smHasSuper(i) || smHasCharge(i))) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-bri-10', region: 'Super Metroid', name: 'Super Missile (green Brinstar bottom)',
    check: (i) => (canPassBombPassages(i) && canOpenGreenDoors(i)) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-bri-11', region: 'Super Metroid', name: 'Energy Tank, Etecoons',
    check: (i) => (canUsePowerBombs(i)) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-bri-12', region: 'Super Metroid', name: 'Missile (pink Brinstar bottom)',
    check: (i) => (canPassBombPassages(i) && canOpenGreenDoors(i)) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-bri-13', region: 'Super Metroid', name: 'Charge Beam',
    check: (i) => (canPassBombPassages(i) && canOpenGreenDoors(i)) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-bri-14', region: 'Super Metroid', name: 'Super Missile (pink Brinstar)',
    check: (i) => (canPassBombPassages(i) && canOpenGreenDoors(i) && (smHasGrapple(i) || smHasSpace(i) || smHasSpeed(i))) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-bri-15', region: 'Super Metroid', name: 'Power Bomb (blue Brinstar)',
    check: (i) => canUsePowerBombs(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-bri-16', region: 'Super Metroid', name: 'Morphing Ball',
    check: (i) => STATE.AVAILABLE },
  { id: 'sm-bri-17', region: 'Super Metroid', name: 'Missile (green Brinstar pipe)',
    check: (i) => smHasMorph(i) ? STATE.AVAILABLE : STATE.VISIBLE },
  { id: 'sm-bri-18', region: 'Super Metroid', name: 'Missile (blue Brinstar bottom)',
    check: (i) => smHasMorph(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-bri-19', region: 'Super Metroid', name: 'Missile (blue Brinstar behind missile)',
    check: (i) => (canPassBombPassages(i)) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-bri-20', region: 'Super Metroid', name: 'Missile (blue Brinstar top)',
    check: (i) => (canPassBombPassages(i)) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-bri-21', region: 'Super Metroid', name: 'Energy Tank, Brinstar Ceiling',
    check: (i) => (canFly(i) || smHasHiJump(i) || smHasSpeed(i) || smHasIce(i)) ? STATE.AVAILABLE : STATE.VISIBLE },
  { id: 'sm-bri-22', region: 'Super Metroid', name: 'Missile (blue Brinstar middle)',
    check: (i) => (smHasMorph(i) && canOpenRedDoors(i)) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-bri-23', region: 'Super Metroid', name: 'Power Bomb (red Brinstar sidehopper room)',
    check: (i) => (canAccessRedBrinstar(i) && canUsePowerBombs(i)) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-bri-24', region: 'Super Metroid', name: 'Missile (red Brinstar spike room)',
    check: (i) => (canAccessRedBrinstar(i)) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-bri-25', region: 'Super Metroid', name: 'Power Bomb (red Brinstar spike room)',
    check: (i) => (canAccessRedBrinstar(i) && canUsePowerBombs(i)) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-bri-26', region: 'Super Metroid', name: 'Energy Tank, Waterway',
    check: (i) => (canUsePowerBombs(i) && canOpenRedDoors(i) && smHasSpeed(i)) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-bri-27', region: 'Super Metroid', name: 'X-Ray Scope',
    check: (i) => (canAccessRedBrinstar(i) && canUsePowerBombs(i) && (smHasGrapple(i) || smHasSpace(i))) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-bri-28', region: 'Super Metroid', name: 'Spazer',
    check: (i) => (canPassBombPassages(i) && canOpenGreenDoors(i)) ? STATE.AVAILABLE : STATE.UNAVAIL },

  // ---- Lower Brinstar / Kraid (29–31) ----
  { id: 'sm-bri-29', region: 'Super Metroid', name: 'Missile (Kraid)',
    check: (i) => (canAccessKraid(i) && canUsePowerBombs(i)) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-bri-30', region: 'Super Metroid', name: 'Energy Tank, Kraid',
    check: (i) => canAccessKraid(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-bri-31', region: 'Super Metroid', name: 'Varia Suit',
    check: (i) => canAccessKraid(i) ? STATE.AVAILABLE : STATE.UNAVAIL },

  // ---- Crateria (32–44) ----
  { id: 'sm-crt-32', region: 'Super Metroid', name: 'Missile (Crateria gauntlet left)',
    check: (i) => (canEnterAndLeaveGauntlet(i) && (smHasSpeed(i) || canFly(i))) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-crt-33', region: 'Super Metroid', name: 'Missile (Crateria gauntlet right)',
    check: (i) => (canEnterAndLeaveGauntlet(i) && (smHasSpeed(i) || canFly(i))) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-crt-34', region: 'Super Metroid', name: 'Energy Tank, Gauntlet',
    check: (i) => canEnterAndLeaveGauntlet(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-crt-35', region: 'Super Metroid', name: 'Power Bomb (Crateria surface)',
    check: (i) => (canUsePowerBombs(i) && (smHasSpeed(i) || canFly(i))) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-crt-36', region: 'Super Metroid', name: 'Missile (Crateria moat)',
    check: (i) => canUsePowerBombs(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-crt-37', region: 'Super Metroid', name: 'Missile (outside Wrecked Ship bottom)',
    check: (i) => (canUsePowerBombs(i) && canDefeatPhantoon(i)) ? STATE.AVAILABLE : STATE.VISIBLE },
  { id: 'sm-crt-38', region: 'Super Metroid', name: 'Missile (outside Wrecked Ship middle)',
    check: (i) => (canUsePowerBombs(i) && canDefeatPhantoon(i) && smHasGravity(i)) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-crt-39', region: 'Super Metroid', name: 'Missile (outside Wrecked Ship top)',
    check: (i) => (canUsePowerBombs(i) && canDefeatPhantoon(i)) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-crt-40', region: 'Super Metroid', name: 'Energy Tank, Terminator',
    check: (i) => canDestroyBombWalls(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-crt-41', region: 'Super Metroid', name: 'Missile (Crateria middle)',
    check: (i) => canPassBombPassages(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-crt-42', region: 'Super Metroid', name: 'Bombs',
    check: (i) => (canOpenRedDoors(i) && smHasMorph(i)) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-crt-43', region: 'Super Metroid', name: 'Super Missile (Crateria)',
    check: (i) => (canUsePowerBombs(i) && smHasSpeed(i)) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-crt-44', region: 'Super Metroid', name: 'Missile (Crateria bottom)',
    check: (i) => canDestroyBombWalls(i) ? STATE.AVAILABLE : STATE.UNAVAIL },

  // ---- Wrecked Ship (45–52) ----
  { id: 'sm-ws-45',  region: 'Super Metroid', name: 'Missile (Wrecked Ship top)',
    check: (i) => canAccessWreckedShip(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-ws-46',  region: 'Super Metroid', name: 'Reserve Tank, Wrecked Ship',
    check: (i) => (canDefeatPhantoon(i) && smHasSpeed(i)) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-ws-47',  region: 'Super Metroid', name: 'Gravity Suit',
    check: (i) => canDefeatPhantoon(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-ws-48',  region: 'Super Metroid', name: 'Missile (Gravity Suit)',
    check: (i) => canDefeatPhantoon(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-ws-49',  region: 'Super Metroid', name: 'Energy Tank, Wrecked Ship',
    check: (i) => (canDefeatPhantoon(i) && smHasSpeed(i)) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-ws-50',  region: 'Super Metroid', name: 'Missile (Wrecked Ship middle)',
    check: (i) => canAccessWreckedShip(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-ws-51',  region: 'Super Metroid', name: 'Super Missile (Wrecked Ship left)',
    check: (i) => canDefeatPhantoon(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-ws-52',  region: 'Super Metroid', name: 'Right Super, Wrecked Ship',
    check: (i) => canDefeatPhantoon(i) ? STATE.AVAILABLE : STATE.UNAVAIL },

  // ---- Maridia (53–70) ----
  { id: 'sm-mar-53', region: 'Super Metroid', name: 'Plasma Beam',
    check: (i) => (canDefeatDraygon(i) && (smHasPlasma(i) || smHasScrew(i) || smHasSpeed(i))) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-mar-54', region: 'Super Metroid', name: 'Super Missile (yellow Maridia)',
    check: (i) => (canAccessOuterMaridia(i) && canUsePowerBombs(i)) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-mar-55', region: 'Super Metroid', name: 'Missile (yellow Maridia super missile)',
    check: (i) => (canAccessOuterMaridia(i) && canUsePowerBombs(i)) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-mar-56', region: 'Super Metroid', name: 'Missile (yellow Maridia false wall)',
    check: (i) => canAccessOuterMaridia(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-mar-57', region: 'Super Metroid', name: 'Missile (Draygon)',
    check: (i) => canDefeatDraygon(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-mar-58', region: 'Super Metroid', name: 'Missile (pink Maridia)',
    check: (i) => (canAccessOuterMaridia(i) && smHasSpeed(i)) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-mar-59', region: 'Super Metroid', name: 'Super Missile (pink Maridia)',
    check: (i) => (canAccessOuterMaridia(i) && smHasSpeed(i)) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-mar-60', region: 'Super Metroid', name: 'Energy Tank, Botwoon',
    check: (i) => canDefeatBotwoon(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-mar-61', region: 'Super Metroid', name: 'Space Jump',
    check: (i) => canDefeatDraygon(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-mar-62', region: 'Super Metroid', name: 'Super Missile (green Maridia)',
    check: (i) => (canAccessOuterMaridia(i) && smHasSpeed(i)) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-mar-63', region: 'Super Metroid', name: 'Missile (green Maridia shinespark)',
    check: (i) => (canAccessOuterMaridia(i) && smHasSpeed(i)) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-mar-64', region: 'Super Metroid', name: 'Energy Tank, Mama turtle',
    check: (i) => (canAccessOuterMaridia(i) && (smHasSpeed(i) || canFly(i) || smHasGrapple(i))) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-mar-65', region: 'Super Metroid', name: 'Missile (green Maridia tatori)',
    check: (i) => canAccessOuterMaridia(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-mar-66', region: 'Super Metroid', name: 'Missile (left Maridia sand pit room)',
    check: (i) => canAccessInnerMaridia(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-mar-67', region: 'Super Metroid', name: 'Reserve Tank, Maridia',
    check: (i) => canAccessInnerMaridia(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-mar-68', region: 'Super Metroid', name: 'Missile (right Maridia sand pit room)',
    check: (i) => canAccessInnerMaridia(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-mar-69', region: 'Super Metroid', name: 'Power Bomb (right Maridia sand pit room)',
    check: (i) => (canAccessInnerMaridia(i) && canUsePowerBombs(i)) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-mar-70', region: 'Super Metroid', name: 'Spring Ball',
    check: (i) => (canAccessInnerMaridia(i) && canUsePowerBombs(i) && (smHasGrapple(i) || smHasSpace(i))) ? STATE.AVAILABLE : STATE.UNAVAIL },

  // ---- Norfair / Lower Norfair (71–100) ----
  { id: 'sm-nor-71', region: 'Super Metroid', name: 'Ice Beam',
    check: (i) => (canAccessHeatedNorfairUpper(i) && canPassBombPassages(i)) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-nor-72', region: 'Super Metroid', name: 'Reserve Tank, Norfair',
    check: (i) => (canAccessHeatedNorfairUpper(i) && (canFly(i) || smHasGrapple(i) || smHasHiJump(i) || smHasIce(i))) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-nor-73', region: 'Super Metroid', name: 'Missile (Norfair Reserve Tank)',
    check: (i) => (canAccessHeatedNorfairUpper(i) && (canFly(i) || smHasGrapple(i) || smHasHiJump(i) || smHasIce(i))) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-nor-74', region: 'Super Metroid', name: 'Missile (bubble Norfair green door)',
    check: (i) => canAccessHeatedNorfairUpper(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-nor-75', region: 'Super Metroid', name: 'Missile (Speed Booster)',
    check: (i) => canAccessHeatedNorfairUpper(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-nor-76', region: 'Super Metroid', name: 'Speed Booster',
    check: (i) => canAccessHeatedNorfairUpper(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-nor-77', region: 'Super Metroid', name: 'Missile (below Ice Beam)',
    check: (i) => (canAccessHeatedNorfairUpper(i) && canUsePowerBombs(i) && smHasSpeed(i)) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-nor-78', region: 'Super Metroid', name: 'Hi-Jump Boots',
    check: (i) => canAccessHeatedNorfairUpper(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-nor-79', region: 'Super Metroid', name: 'Missile (Hi-Jump Boots)',
    check: (i) => canAccessHeatedNorfairUpper(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-nor-80', region: 'Super Metroid', name: 'Energy Tank (Hi-Jump Boots)',
    check: (i) => canAccessHeatedNorfairUpper(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-nor-81', region: 'Super Metroid', name: 'Missile (above Crocomire)',
    check: (i) => (canAccessHeatedNorfairUpper(i) && (canFly(i) || smHasGrapple(i) || (smHasHiJump(i) && smHasSpeed(i)))) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-nor-82', region: 'Super Metroid', name: 'Missile (lava room)',
    check: (i) => (canAccessHeatedNorfairUpper(i) && (smHasGravity(i) || smHasSpace(i) || smHasHiJump(i))) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-nor-83', region: 'Super Metroid', name: 'Missile (bubble Norfair)',
    check: (i) => canAccessHeatedNorfairUpper(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-nor-84', region: 'Super Metroid', name: 'Missile (Wave Beam)',
    check: (i) => canAccessHeatedNorfairUpper(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-nor-85', region: 'Super Metroid', name: 'Wave Beam',
    check: (i) => canAccessHeatedNorfairUpper(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-nor-86', region: 'Super Metroid', name: 'Missile (lower Norfair near Wave Beam)',
    check: (i) => canAccessLowerNorfair(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-nor-87', region: 'Super Metroid', name: 'Missile (lower Norfair above fire flea room)',
    check: (i) => canAccessLowerNorfair(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-nor-88', region: 'Super Metroid', name: 'Power Bomb (lower Norfair above fire flea room)',
    check: (i) => canAccessLowerNorfair(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-nor-89', region: 'Super Metroid', name: 'Power Bomb (Crocomire)',
    check: (i) => (canAccessHeatedNorfairUpper(i) && (canFly(i) || smHasGrapple(i) || (smHasHiJump(i) && smHasSpeed(i))) && smHasSuper(i)) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-nor-90', region: 'Super Metroid', name: 'Energy Tank, Crocomire',
    check: (i) => (canAccessHeatedNorfairUpper(i) && (canFly(i) || smHasGrapple(i) || (smHasHiJump(i) && smHasSpeed(i))) && smHasSuper(i)) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-nor-91', region: 'Super Metroid', name: 'Missile (Mickey Mouse room)',
    check: (i) => canAccessLowerNorfair(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-nor-92', region: 'Super Metroid', name: 'Energy Tank, Firefleas',
    check: (i) => canAccessLowerNorfair(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-nor-93', region: 'Super Metroid', name: 'Grapple Beam',
    check: (i) => (canAccessHeatedNorfairUpper(i) && smHasSuper(i) && (canFly(i) || smHasSpeed(i))) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-nor-94', region: 'Super Metroid', name: 'Missile (Grapple Beam)',
    check: (i) => (canAccessHeatedNorfairUpper(i) && smHasSuper(i) && (canFly(i) || smHasSpeed(i))) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-nor-95', region: 'Super Metroid', name: 'Missile (below Crocomire)',
    check: (i) => (canAccessHeatedNorfairUpper(i) && smHasSuper(i)) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-nor-96', region: 'Super Metroid', name: 'Missile (Gold Torizo)',
    check: (i) => (canAccessLowerNorfair(i) && smHasSpace(i)) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-nor-97', region: 'Super Metroid', name: 'Super Missile (Gold Torizo)',
    check: (i) => (canAccessLowerNorfair(i) && (smHasSpace(i) || (smHasSpeed(i) && smHasGravity(i)))) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-nor-98', region: 'Super Metroid', name: 'Screw Attack',
    check: (i) => canAccessLowerNorfair(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-nor-99', region: 'Super Metroid', name: 'Energy Tank, Ridley',
    check: (i) => canAccessLowerNorfair(i) ? STATE.AVAILABLE : STATE.UNAVAIL },
  { id: 'sm-nor-100', region: 'Super Metroid', name: 'Power Bomb (Power Bombs of shame)',
    check: (i) => (canAccessLowerNorfair(i) && canUsePowerBombs(i)) ? STATE.AVAILABLE : STATE.UNAVAIL },
];

/* Exports */
window.SMZ3Logic = {
  STATE,
  DUNGEONS,
  LOCATIONS,
};
