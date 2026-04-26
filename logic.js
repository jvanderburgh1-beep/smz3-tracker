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
  GLITCHED:  'glitched',   // reachable only via Hard-logic tricks (rendered yellow)
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
  // Standard path: either beat Agahnim OR have glove (so you can reach Pyramid of Power).
  // Reverse-portal path: any SM portal that drops you in DW (Maridia→Pyramid,
  // Lower Norfair→Mire, Wrecked Ship→DW NW) all require Moon Pearl too.
  if (has(items, 'moonpearl') &&
      (canReachDWViaAgahnim(items) ||
       titan(items) ||
       (anyGlove(items) && has(items, 'hammer')))) return true;
  // Reverse-portal DW arrivals already include the Moon Pearl check
  if (reachedPyramidViaPortal(items)) return true;
  if (reachedMireAreaViaPortal(items)) return true;
  if (reachedDWNorthWestViaPortal(items)) return true;
  return false;
}

function canReachPyramid(items) {
  // Via normal DW entry OR direct Maridia portal exit
  return canEnterDarkWorld(items) || reachedPyramidViaPortal(items);
}

function canReachDarkWorldSouth(items) {
  return canEnterDarkWorld(items) &&
         (has(items, 'hammer') || (anyGlove(items) && has(items, 'flippers')));
}

function canReachDarkWorldEast(items) {
  return canEnterDarkWorld(items);
}

function canReachDarkWorldNorthWest(items) {
  // Village of Outcasts. Four independent routes:
  //   1) DW East access + Hookshot + (Hammer OR any glove) + Moon Pearl
  //      — cross from East over the hookshot pegs/bridge into the village
  //   2) Moon Pearl + any glove + Hammer
  //      — south-then-up loop using hammer pegs to reach the village
  //   3) Moon Pearl + Titan glove
  //      — direct lift entry from the LW (kakariko-equivalent area)
  //   4) Reverse Wrecked Ship portal exit — arrive in DW NW from SM
  if (reachedDWNorthWestViaPortal(items)) return true;
  if (!has(items, 'moonpearl')) return false;
  if (titan(items)) return true;
  if (anyGlove(items) && has(items, 'hammer')) return true;
  if (canReachDarkWorldEast(items) && has(items, 'hookshot') &&
      (has(items, 'hammer') || anyGlove(items))) return true;
  return false;
}

function canReachDeathMountainWest(items) {
  // Light World DM west (spectacle rock, ether tablet side).
  // Portal-arrival: exiting Upper Norfair → LW DM East which is a
  // subset of DM West reachability (you can walk back down from east to west).
  return has(items, 'flute') || (anyGlove(items) && lantern(items)) ||
         (anyGlove(items) && has(items, 'firerod')) ||
         reachedLWDMEastViaPortal(items);
}

function canReachDeathMountainEast(items) {
  // LW DM east (needs hammer+mirror or hookshot, on top of west access)
  // Reverse portal: Upper Norfair exit drops you directly in DM East.
  if (reachedLWDMEastViaPortal(items)) return true;
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
  // Normal path: Flute + Titan from LW + DW entry
  // Reverse path: Lower Norfair portal exit drops you at MM square
  if (reachedMireAreaViaPortal(items)) return true;
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
// (canEnterAndLeaveGauntlet — moved to the v19 SM port section, below)

/* -------------------------------------------------------------
   Cross-game portals — vanilla SMZ3.
   Four portals connect ALttP and SM. Reaching the ALttP side
   of a portal grants access to the SM side, AND vice versa.
   This block models BOTH directions:
     - Forward (ALttP → SM): canAccess<Portal>Portal predicates
       layered into SM region-access predicates as alt paths.
     - Reverse (SM → ALttP): reachedALttPVia<X> predicates
       layered into ALttP canReach<Region> helpers as alt paths.
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

/* ---- Reverse-direction portal arrival predicates (SM → ALttP) ----
   "reachedALttPVia<Portal>" = true when the player has cleared the
   SM-side prerequisites to reach the portal AND has the ALttP-side
   items needed to not immediately become useless on arrival (Moon
   Pearl for Dark-World exits; nothing extra for Light-World exits).

   These are used as alternative entries to the existing ALttP
   cross-world access predicates below. Only the SM-native paths
   (not the forward portal clause) are considered to avoid
   circular "took the portal there, took the portal back" logic
   that would let zero items unlock access. */

// SM-native Upper Norfair access — exits the Upper Norfair portal
// to LW DM East. Uses ONLY the SM-side path (no portal clause) to
// avoid circular reasoning.
function _reachedUpperNorfairSMNative(i) {
  return ((canDestroyBombWalls(i) || smHasSpeed(i)) && smHasSuper(i) && smHasMorph(i)) &&
         hasHeatShield(i);
}

// SM-native Lower Norfair access — exits the Lower Norfair portal
// to the Misery Mire square in DW.
function _reachedLowerNorfairSMNative(i) {
  return _reachedUpperNorfairSMNative(i) &&
         smHasVaria(i) && canUsePowerBombs(i) &&
         smHasSpace(i) && smHasGravity(i);
}

// SM-native Outer Maridia access — exits to the Pyramid moat in DW.
function _reachedOuterMaridiaSMNative(i) {
  if (!smHasGravity(i)) return false;
  // Norfair Upper West native + canUsePowerBombs (matching the canonical
  // Maridia Outer CanEnter, but stripped of the portal alternative).
  const reachedNorfairUpperWestNative =
    (canDestroyBombWalls(i) || smHasSpeed(i)) && smHasSuper(i) && smHasMorph(i);
  return reachedNorfairUpperWestNative && canUsePowerBombs(i);
}

// SM-native Wrecked Ship access — exits to DW Northwest (Skull Woods area).
function _reachedWreckedShipSMNative(i) {
  if (!smHasSuper(i)) return false;
  // Over the moat: PB + traversal
  return canUsePowerBombs(i) &&
         (smHasSpeed(i) || smHasGrapple(i) || smHasSpace(i) ||
          (smHasGravity(i) && smHasHiJump(i)));
}

// Reached LW Death Mountain East via the Norfair Upper Portal
// (exits to LW DM East, in front of Turtle Rock). No Moon Pearl
// needed since LW DM East is a Light World area.
function reachedLWDMEastViaPortal(i) {
  return _reachedUpperNorfairSMNative(i);
}

// Reached the Misery Mire square (DW) via the Norfair Lower Portal.
// Needs Moon Pearl to function in DW.
function reachedMireAreaViaPortal(i) {
  return _reachedLowerNorfairSMNative(i) && has(i, 'moonpearl');
}

// Reached Pyramid of Power area (DW) via the Maridia Portal.
// Needs Moon Pearl to function in DW.
function reachedPyramidViaPortal(i) {
  return _reachedOuterMaridiaSMNative(i) && has(i, 'moonpearl');
}

// Reached Dark World Northwest (Skull Woods area) via the Wrecked
// Ship Portal. Needs Moon Pearl to function in DW.
function reachedDWNorthWestViaPortal(i) {
  return _reachedWreckedShipSMNative(i) && has(i, 'moonpearl');
}

/* =============================================================
   Super Metroid logic — faithful port from tewtal/SMZ3Randomizer
   (MIT-licensed, used with attribution).

   Source: Randomizer.SMZ3/Regions/SuperMetroid/*.cs (Normal logic only)
   See NOTICE.md for attribution.

   Key porting decisions:
   - Names match the SMZ3 source exactly so SM_CHECK_BY_NAME
     can be looked up directly.
   - Hard ("_") logic branches are NOT ported — only Normal.
   - Keysanity is not modeled. Every "Config.Keysanity ? CardX : ..."
     evaluates the non-keysanity branch (treating Card items as
     always satisfied).
   - The Hard-only tricks CanIbj, CanSpringBallJump, CanHellRun,
     and TwoPowerBombs are deliberately omitted.
   - HasEnergyReserves(N) uses the etank + reserve item counts
     added to the tracker as part of this port.
   ============================================================= */

// Energy reserves: etank count + reserve count
function hasEnergyReserves(i, n) {
  return ((i.etank || 0) + (i.reserve || 0)) >= n;
}

// CanEnterAndLeaveGauntlet (Normal):
//   Morph + (CanFly OR Speed) + (canUsePowerBombs OR Screw)
//   (CardCrateriaL1 → true w/o keysanity)
function canEnterAndLeaveGauntlet(i) {
  return smHasMorph(i) && (canFly(i) || smHasSpeed(i)) &&
         (canUsePowerBombs(i) || smHasScrew(i));
}

// Region access predicates — ported per-region from each region's CanEnter.
// All match the Normal-logic branch only; non-keysanity branch always taken.

function canEnterCrateriaWest(i) {
  return canDestroyBombWalls(i) || smHasSpeed(i);
}

function canEnterBrinstarGreen(i) {
  return canDestroyBombWalls(i) || smHasSpeed(i);
}

function canEnterBrinstarPink(i) {
  return (canOpenRedDoors(i) && (canDestroyBombWalls(i) || smHasSpeed(i))) ||
         canUsePowerBombs(i) ||
         (canAccessNorfairUpperPortal(i) && smHasMorph(i) && smHasWave(i) &&
          (smHasIce(i) || smHasHiJump(i) || smHasSpace(i)));
}

function canEnterBrinstarRed(i) {
  return ((canDestroyBombWalls(i) || smHasSpeed(i)) && smHasSuper(i) && smHasMorph(i)) ||
         (canAccessNorfairUpperPortal(i) && (smHasIce(i) || smHasHiJump(i) || smHasSpace(i)));
}

function canEnterBrinstarKraid(i) {
  return (canDestroyBombWalls(i) || smHasSpeed(i) || canAccessNorfairUpperPortal(i)) &&
         smHasSuper(i) && canPassBombPassages(i);
}

function canEnterNorfairUpperWest(i) {
  return ((canDestroyBombWalls(i) || smHasSpeed(i)) && smHasSuper(i) && smHasMorph(i)) ||
         canAccessNorfairUpperPortal(i);
}

function canEnterNorfairUpperEast(i) {
  const baseEntry =
    ((canDestroyBombWalls(i) || smHasSpeed(i)) && smHasSuper(i) && smHasMorph(i)) ||
    canAccessNorfairUpperPortal(i);
  if (!baseEntry || !smHasVaria(i) || !smHasSuper(i)) return false;
  const cathedral = canOpenRedDoors(i) && (canFly(i) || smHasHiJump(i) || smHasSpeed(i));
  const frog = smHasSpeed(i) && smHasWave(i) && canUsePowerBombs(i);
  return cathedral || frog;
}

function canEnterNorfairUpperCrocomire(i) {
  const baseEntry =
    ((canDestroyBombWalls(i) || smHasSpeed(i)) && smHasSuper(i) && smHasMorph(i)) ||
    canAccessNorfairUpperPortal(i);
  const mainPath = baseEntry && smHasVaria(i) && (
    (smHasSuper(i) && canUsePowerBombs(i) && smHasSpeed(i)) ||                    // Croc Speedway
    (smHasSpeed(i) && smHasWave(i)) ||                                            // Frog Speedway
    (canOpenRedDoors(i) && smHasSuper(i) &&
     (canFly(i) || smHasHiJump(i) || smHasSpeed(i)) &&
     (canPassBombPassages(i) || (smHasGravity(i) && smHasMorph(i))) && smHasWave(i))   // Cathedral
  );
  // Reverse Lava Dive (CardNorfairL2 → true w/o keysanity, "OR Morph" makes it always true)
  const reverseLavaDive = smHasVaria(i) && canAccessNorfairLowerPortal(i) &&
                          smHasScrew(i) && smHasSpace(i) && smHasSuper(i) &&
                          smHasGravity(i) && smHasWave(i);
  return mainPath || reverseLavaDive;
}

function canEnterNorfairLowerWest(i) {
  if (!smHasVaria(i)) return false;
  // CardNorfairL2 → true w/o keysanity, so Bubble Mountain is auto-satisfied,
  // making the inner OR collapse to true.
  const viaUpperEast = canEnterNorfairUpperEast(i) &&
                       canUsePowerBombs(i) && smHasSpace(i) && smHasGravity(i);
  const viaPortal = canAccessNorfairLowerPortal(i) && canDestroyBombWalls(i);
  return viaUpperEast || viaPortal;
}

function canEnterNorfairLowerEast(i) {
  if (!smHasVaria(i)) return false;
  const viaUpperEast = canEnterNorfairUpperEast(i) &&
                       canUsePowerBombs(i) && smHasSpace(i) && smHasGravity(i);
  const viaPortal = canAccessNorfairLowerPortal(i) && canDestroyBombWalls(i) &&
                    smHasSuper(i) && canUsePowerBombs(i) && canFly(i);
  return viaUpperEast || viaPortal;
}

// CanExit(Norfair Lower East) (Normal): Morph + (CardNorfairL2 OR ...)
// Without keysanity, CardNorfairL2 is true so this collapses to: Morph
function canExitNorfairLowerEast(i) {
  return smHasMorph(i);
}

// Wrecked Ship (Normal):
//   Super + (
//     (canUsePowerBombs + (Speed OR Grapple OR SpaceJump OR (Gravity + HiJump)))   // Over the moat
//     OR (canUsePowerBombs + Gravity)                                              // Through Maridia from pipe
//     OR (canAccessMaridiaPortal + Gravity + (canDestroyBombWalls OR can-defeat-Draygon))
//   )
function canEnterWreckedShip(i) {
  if (!smHasSuper(i)) return false;
  const overMoat = canUsePowerBombs(i) &&
                   (smHasSpeed(i) || smHasGrapple(i) || smHasSpace(i) ||
                    (smHasGravity(i) && smHasHiJump(i)));
  const throughMaridiaPipe = canUsePowerBombs(i) && smHasGravity(i);
  const fromMaridiaPortal = canAccessMaridiaPortal(i) && smHasGravity(i) &&
                            (canDestroyBombWalls(i) || canDefeatDraygon(i));
  return overMoat || throughMaridiaPipe || fromMaridiaPortal;
}

// CanUnlockShip = CardWreckedShipBoss + canPassBombPassages
// Without keysanity, CardWreckedShipBoss is "Phantoon defeated". For tracker UX
// we treat the locations behind it as available once you can enter the ship and
// pass bomb passages, since the player gates this themselves by toggling Phantoon.
function canUnlockShip(i) {
  return canPassBombPassages(i);
}

// canDefeatPhantoon — alias for being able to enter and unlock the ship
function canDefeatPhantoon(i) {
  return canEnterWreckedShip(i) && canUnlockShip(i);
}

function canEnterMaridiaOuter(i) {
  if (!smHasGravity(i)) return false;
  return (canEnterNorfairUpperWest(i) && canUsePowerBombs(i)) ||
         (canAccessMaridiaPortal(i) && (canPassBombPassages(i) || smHasScrew(i)));
}

function canEnterMaridiaInner(i) {
  if (!smHasGravity(i)) return false;
  return (canEnterNorfairUpperWest(i) && smHasSuper(i) && canUsePowerBombs(i) &&
          (canFly(i) || smHasSpeed(i) || smHasGrapple(i))) ||
         canAccessMaridiaPortal(i);
}

// CanReachAqueduct (Normal) — without keysanity:
//   (CanFly OR Speed OR Grapple) OR canAccessMaridiaPortal
function canReachAqueduct(i) {
  return canFly(i) || smHasSpeed(i) || smHasGrapple(i) || canAccessMaridiaPortal(i);
}

function canDefeatBotwoon(i) {
  return smHasSpeed(i) || canAccessMaridiaPortal(i);
}

// CanDefeatDraygon (Normal) — without keysanity:
//   (canDefeatBotwoon OR canAccessMaridiaPortal) + Gravity + ((Speed + HiJump) OR canFly)
function canDefeatDraygon(i) {
  return (canDefeatBotwoon(i) || canAccessMaridiaPortal(i)) &&
         smHasGravity(i) && ((smHasSpeed(i) && smHasHiJump(i)) || canFly(i));
}

/* =============================================================
   SM Hard-logic branches (ported alongside Normal in v21).

   The canonical source uses `Logic switch { Normal => ..., _ => ... }`
   to express a preset "Hard logic" branch that assumes the runner can
   execute various advanced techniques (infinite bomb jumps, spring
   ball jumps, hell runs without Varia, two-power-bomb execution, etc).

   The tracker treats these tricks as a single "Hard" preset:
     - canIbj, canSpringBallJump, canHellRun, twoPowerBombs → always true
   We don't surface per-trick toggles because the source itself doesn't
   decompose Hard into individually-addressable tricks.

   Per-location checks that have distinct Normal/Hard lambdas are encoded
   as `{ normal, hard }` pairs in SM_CHECK_BY_NAME. The dual-evaluator in
   smCheck() picks Normal first (green AVAILABLE); falls back to Hard
   (yellow GLITCHED) only when Normal fails.
   ============================================================= */

// --- Hard-logic trick helpers (assumed available on Hard) ---
function canIbj(_i)           { return true; }
function canSpringBallJump(_i) { return true; }
function canHellRun(_i)       { return true; }
function twoPowerBombs(i)     { return canUsePowerBombs(i); }

// --- Hard variants of region predicates ---

// Red Brinstar, Hard:
//   ((canDestroyBombWalls OR Speed) + Super + Morph)
//   OR (canAccessNorfairUpperPortal + (Ice OR canSpringBallJump OR HiJump OR canFly))
function canEnterBrinstarRedHard(i) {
  return ((canDestroyBombWalls(i) || smHasSpeed(i)) && smHasSuper(i) && smHasMorph(i)) ||
         (canAccessNorfairUpperPortal(i) && (smHasIce(i) || canSpringBallJump(i) || smHasHiJump(i) || canFly(i)));
}

// Pink Brinstar, Hard:
//   (canOpenRedDoors + (canDestroyBombWalls OR Speed)) OR canUsePowerBombs
//   OR (canAccessNorfairUpperPortal + Morph + (Missile OR Super OR Wave) +
//       (Ice OR HiJump OR canSpringBallJump OR canFly))
function canEnterBrinstarPinkHard(i) {
  return (canOpenRedDoors(i) && (canDestroyBombWalls(i) || smHasSpeed(i))) ||
         canUsePowerBombs(i) ||
         (canAccessNorfairUpperPortal(i) && smHasMorph(i) &&
          (smHasMissile(i) || smHasSuper(i) || smHasWave(i)) &&
          (smHasIce(i) || smHasHiJump(i) || canSpringBallJump(i) || canFly(i)));
}

// Norfair Upper East, Hard:
//   baseEntry + canHellRun +
//   ((canOpenRedDoors + (canFly OR HiJump OR Speed OR canSpringBallJump OR (Varia+Ice)))
//     OR (Speed + (Missile OR Super OR Wave) + canUsePowerBombs))
function canEnterNorfairUpperEastHard(i) {
  const baseEntry =
    ((canDestroyBombWalls(i) || smHasSpeed(i)) && smHasSuper(i) && smHasMorph(i)) ||
    canAccessNorfairUpperPortal(i);
  if (!baseEntry) return false;
  if (!canHellRun(i)) return false;
  const cathedral = canOpenRedDoors(i) && (
    canFly(i) || smHasHiJump(i) || smHasSpeed(i) ||
    canSpringBallJump(i) || (smHasVaria(i) && smHasIce(i))
  );
  const frog = smHasSpeed(i) && (smHasMissile(i) || smHasSuper(i) || smHasWave(i)) &&
               canUsePowerBombs(i);
  return cathedral || frog;
}

// Norfair Upper Crocomire, Hard:
//   baseEntry + (
//     (Super + canUsePowerBombs + Speed + (ER(3) OR Varia)) /* Ice -> Croc Speedway */
//     OR (Speed + (ER(2) OR Varia) + (Missile OR Super OR Wave))
//     OR (canHellRun + canOpenRedDoors + Super +
//         (canFly OR HiJump OR Speed OR canSpringBallJump OR (Varia+Ice)) +
//         (canPassBombPassages OR (Varia+Morph)) + (Missile OR Super OR Wave))
//   ) OR (Varia + canAccessNorfairLowerPortal + Screw + Space + Super + ER(2) + Morph[true])
function canEnterNorfairUpperCrocomireHard(i) {
  const baseEntry =
    ((canDestroyBombWalls(i) || smHasSpeed(i)) && smHasSuper(i) && smHasMorph(i)) ||
    canAccessNorfairUpperPortal(i);
  if (!baseEntry) {
    // Reverse Lava Dive is the only alt path
    return smHasVaria(i) && canAccessNorfairLowerPortal(i) && smHasScrew(i) &&
           smHasSpace(i) && smHasSuper(i) && hasEnergyReserves(i, 2);
  }
  const icePath   = smHasSuper(i) && canUsePowerBombs(i) &&
                    smHasSpeed(i) && (hasEnergyReserves(i, 3) || smHasVaria(i));
  const frogPath  = smHasSpeed(i) && (hasEnergyReserves(i, 2) || smHasVaria(i)) &&
                    (smHasMissile(i) || smHasSuper(i) || smHasWave(i));
  const cathPath  = canHellRun(i) && canOpenRedDoors(i) && smHasSuper(i) &&
                    (canFly(i) || smHasHiJump(i) || smHasSpeed(i) ||
                     canSpringBallJump(i) || (smHasVaria(i) && smHasIce(i))) &&
                    (canPassBombPassages(i) || (smHasVaria(i) && smHasMorph(i))) &&
                    (smHasMissile(i) || smHasSuper(i) || smHasWave(i));
  if (icePath || frogPath || cathPath) return true;
  // Reverse Lava Dive alt
  return smHasVaria(i) && canAccessNorfairLowerPortal(i) && smHasScrew(i) &&
         smHasSpace(i) && smHasSuper(i) && hasEnergyReserves(i, 2);
}

// Norfair Lower West, Hard:
//   [UpperEast + canUsePowerBombs + Varia + (HiJump OR Gravity) + true]
//   OR (canAccessNorfairLowerPortal + canDestroyBombWalls)
function canEnterNorfairLowerWestHard(i) {
  const viaUpperEast = canEnterNorfairUpperEast(i) &&
                       canUsePowerBombs(i) && smHasVaria(i) &&
                       (smHasHiJump(i) || smHasGravity(i));
  const viaPortal = canAccessNorfairLowerPortal(i) && canDestroyBombWalls(i);
  return viaUpperEast || viaPortal;
}

// Norfair Lower East, Hard:
//   Varia + [Upper East + canUsePowerBombs + (HiJump OR Gravity)
//     OR LowerPortal + canDestroyBombWalls + Super + (canFly OR canSpringBallJump OR Speed)]
//   + (canFly OR HiJump OR canSpringBallJump OR (Ice + Charge))
//   + (canPassBombPassages OR (Screw + Space))
function canEnterNorfairLowerEastHard(i) {
  if (!smHasVaria(i)) return false;
  const gate1 = (canEnterNorfairUpperEast(i) && canUsePowerBombs(i) &&
                 (smHasHiJump(i) || smHasGravity(i))) ||
                (canAccessNorfairLowerPortal(i) && canDestroyBombWalls(i) &&
                 smHasSuper(i) && (canFly(i) || canSpringBallJump(i) || smHasSpeed(i)));
  if (!gate1) return false;
  const gate2 = canFly(i) || smHasHiJump(i) || canSpringBallJump(i) ||
                (smHasIce(i) && smHasCharge(i));
  const gate3 = canPassBombPassages(i) || (smHasScrew(i) && smHasSpace(i));
  return gate2 && gate3;
}

// CanExit LN East, Hard:
//   Morph + (true OR (Missile OR Super OR Wave) +
//            (Speed OR canFly OR Grapple OR HiJump+(canSpringBallJump OR Ice)))
//   OR ER(5) /* Reverse Amphitheater: escape without Morph! */
function canExitNorfairLowerEastHard(i) {
  if (smHasMorph(i)) return true;  // bubble mountain always open w/ Morph
  // Morph-less: only ER(5) reverse amphitheater works
  return hasEnergyReserves(i, 5);
}

// Wrecked Ship, Hard:
//   Super + (
//     PB
//     OR (PB + (Gravity OR (HiJump+(Ice OR canSpringBallJump)+Grapple)))
//     OR (MaridiaPortal + ((HiJump + canPassBombPassages) OR
//                          (Gravity + (canDestroyBombWalls OR canDefeatDraygon))))
//   )
function canEnterWreckedShipHard(i) {
  if (!smHasSuper(i)) return false;
  // Over-the-moat on Hard: just PB (damage-boost across water)
  if (canUsePowerBombs(i)) return true;
  // Maridia portal path
  if (canAccessMaridiaPortal(i)) {
    if (smHasHiJump(i) && canPassBombPassages(i)) return true;
    if (smHasGravity(i) && (canDestroyBombWalls(i) || canDefeatDraygon(i))) return true;
  }
  return false;
}

// Maridia Outer, Hard:
//   (UpperWest + canUsePowerBombs + (Gravity OR HiJump+(canSpringBallJump OR Ice)))
//   OR (MaridiaPortal + (canPassBombPassages OR (Gravity+Screw) OR
//                        Super+(Gravity OR HiJump+(canSpringBallJump OR Ice))))
function canEnterMaridiaOuterHard(i) {
  const viaUpper = canEnterNorfairUpperWest(i) && canUsePowerBombs(i) &&
                   (smHasGravity(i) || (smHasHiJump(i) && (canSpringBallJump(i) || smHasIce(i))));
  const viaPortal = canAccessMaridiaPortal(i) && (
    canPassBombPassages(i) ||
    (smHasGravity(i) && smHasScrew(i)) ||
    (smHasSuper(i) && (smHasGravity(i) || (smHasHiJump(i) && (canSpringBallJump(i) || smHasIce(i)))))
  );
  return viaUpper || viaPortal;
}

// Maridia Inner, Hard:
//   (Super + UpperWest + canUsePowerBombs +
//     (Gravity OR HiJump+(Ice OR canSpringBallJump)+Grapple))
//   OR canAccessMaridiaPortal
function canEnterMaridiaInnerHard(i) {
  const viaUpper = smHasSuper(i) && canEnterNorfairUpperWest(i) && canUsePowerBombs(i) &&
                   (smHasGravity(i) ||
                    (smHasHiJump(i) && (smHasIce(i) || canSpringBallJump(i)) && smHasGrapple(i)));
  return viaUpper || canAccessMaridiaPortal(i);
}

// Crateria East — NEW in v21. Fixes the v20 bug where sm-crt-36 was gated
// by () => true, letting Crateria moat light green on empty inventory.
//
// Normal: Ship->Moat (PB+Super), OR UN Portal path with vertical kit,
//         OR Maridia portal + Gravity + Super combos, OR Maridia pipe.
function canEnterCrateriaEastNormal(i) {
  // Ship -> Moat: canUsePowerBombs + Super
  const ship = canUsePowerBombs(i) && smHasSuper(i);
  // UN Portal -> Red Tower -> Moat
  const unPortal = canUsePowerBombs(i) && canAccessNorfairUpperPortal(i) &&
                   (smHasIce(i) || smHasHiJump(i) || smHasSpace(i));
  // Through Maridia from Portal
  const marPortal = canAccessMaridiaPortal(i) && smHasGravity(i) && smHasSuper(i) &&
                    (canDestroyBombWalls(i) || canDefeatDraygon(i));
  // Through Maridia from Pipe
  const marPipe = canUsePowerBombs(i) && smHasSuper(i) && smHasGravity(i);
  return ship || unPortal || marPortal || marPipe;
}

function canEnterCrateriaEastHard(i) {
  const ship = canUsePowerBombs(i) && smHasSuper(i);
  const unPortal = canUsePowerBombs(i) && canAccessNorfairUpperPortal(i) &&
                   (smHasIce(i) || smHasHiJump(i) || canFly(i) || canSpringBallJump(i));
  const marPortal = canAccessMaridiaPortal(i) && (
    (smHasSuper(i) && (
      (smHasHiJump(i) && canPassBombPassages(i)) ||
      (smHasGravity(i) && canDestroyBombWalls(i))
    )) ||
    (smHasGravity(i) && canDefeatDraygon(i))
  );
  const marPipe = canUsePowerBombs(i) && smHasSuper(i) &&
                  (smHasGravity(i) ||
                   (smHasHiJump(i) && (smHasIce(i) || canSpringBallJump(i)) && smHasGrapple(i)));
  return ship || unPortal || marPortal || marPipe;
}

// --- Hard variants of named helpers ---

function canEnterAndLeaveGauntletHard(i) {
  // Morph + (Bombs OR true) OR Screw OR (Speed + canUsePowerBombs + ER(2))
  return (smHasMorph(i) && (smHasBombs(i) || twoPowerBombs(i))) ||
         smHasScrew(i) ||
         (smHasSpeed(i) && canUsePowerBombs(i) && hasEnergyReserves(i, 2));
}

function canReachAqueductHard(i) {
  return (smHasGravity(i) ||
          (smHasHiJump(i) && (smHasIce(i) || canSpringBallJump(i)) && smHasGrapple(i))) ||
         canAccessMaridiaPortal(i);
}

function canDefeatBotwoonHard(i) {
  return smHasIce(i) || (smHasSpeed(i) && smHasGravity(i)) || canAccessMaridiaPortal(i);
}

function canDefeatDraygonHard(i) {
  return (canDefeatBotwoon(i) || canAccessMaridiaPortal(i)) && smHasGravity(i);
}


// === Per-location check map ===
// Keyed by the exact location name from the SMZ3 source.
// Each function takes items and returns a STATE (AVAILABLE / UNAVAIL / VISIBLE).
// Region-entry gating is applied separately by SM_REGION_ENTRY below.

const SM_CHECK_BY_NAME = {
  // ---- Crateria/Central ----
  'Power Bomb (Crateria surface)':
    (i) => (canUsePowerBombs(i) && (smHasSpeed(i) || canFly(i))) ? STATE.AVAILABLE : STATE.UNAVAIL,
  'Missile (Crateria middle)':
    (i) => canPassBombPassages(i) ? STATE.AVAILABLE : STATE.UNAVAIL,
  'Missile (Crateria bottom)':
    (i) => canDestroyBombWalls(i) ? STATE.AVAILABLE : STATE.UNAVAIL,
  'Super Missile (Crateria)':
    (i) => (canUsePowerBombs(i) && hasEnergyReserves(i, 2) && smHasSpeed(i)) ? STATE.AVAILABLE : STATE.UNAVAIL,
  'Bombs': {
    normal: (i) => canOpenRedDoors(i) && canPassBombPassages(i),
    // Hard: Morph alone (the wall can be cleared with screw/dboost tricks)
    hard:   (i) => canOpenRedDoors(i) && smHasMorph(i),
  },

  // ---- Crateria/East ----
  'Missile (outside Wrecked Ship bottom)': {
    normal: (i) => smHasMorph(i) && (
      smHasSpeed(i) || smHasGrapple(i) || smHasSpace(i) ||
      (smHasGravity(i) && smHasHiJump(i)) ||
      canEnterWreckedShip(i)
    ),
    // Hard: Morph alone suffices via mockball / bomb-jump tricks
    hard: (i) => smHasMorph(i),
  },
  'Missile (outside Wrecked Ship top)':
    (i) => (canDefeatPhantoon(i) && canPassBombPassages(i)) ? STATE.AVAILABLE : STATE.UNAVAIL,
  'Missile (outside Wrecked Ship middle)':
    (i) => (canDefeatPhantoon(i) && canPassBombPassages(i)) ? STATE.AVAILABLE : STATE.UNAVAIL,
  'Missile (Crateria moat)':
    (_i) => STATE.AVAILABLE,

  // ---- Crateria/West ----
  'Energy Tank, Terminator':
    (_i) => STATE.AVAILABLE,
  'Energy Tank, Gauntlet': {
    // Normal: needs 1 tank to survive the Gauntlet hazards
    normal: (i) => canEnterAndLeaveGauntlet(i) && hasEnergyReserves(i, 1),
    // Hard: Gauntlet can be done at 0 tanks with the Hard traversal
    hard:   (i) => canEnterAndLeaveGauntletHard(i),
  },
  'Missile (Crateria gauntlet right)': {
    normal: (i) => canEnterAndLeaveGauntlet(i) && canPassBombPassages(i) && hasEnergyReserves(i, 2),
    hard:   (i) => canEnterAndLeaveGauntletHard(i) && canPassBombPassages(i),
  },
  'Missile (Crateria gauntlet left)': {
    normal: (i) => canEnterAndLeaveGauntlet(i) && canPassBombPassages(i) && hasEnergyReserves(i, 2),
    hard:   (i) => canEnterAndLeaveGauntletHard(i) && canPassBombPassages(i),
  },

  // ---- Brinstar/Blue ----
  'Morphing Ball':
    (_i) => STATE.AVAILABLE,
  'Power Bomb (blue Brinstar)':
    (i) => canUsePowerBombs(i) ? STATE.AVAILABLE : STATE.UNAVAIL,
  'Missile (blue Brinstar middle)':
    (i) => smHasMorph(i) ? STATE.AVAILABLE : STATE.UNAVAIL,
  'Energy Tank, Brinstar Ceiling': {
    // Normal: needs a vertical-mobility item to reach the ceiling tank
    normal: (i) => canFly(i) || smHasHiJump(i) || smHasSpeed(i) || smHasIce(i),
    // Hard: doable with any character via precise jumps off the
    // dropping enemies — region entry is the only real requirement
    hard:   (_i) => true,
  },
  'Missile (blue Brinstar bottom)':
    (i) => smHasMorph(i) ? STATE.AVAILABLE : STATE.UNAVAIL,
  'Missile (blue Brinstar top)':
    (i) => canUsePowerBombs(i) ? STATE.AVAILABLE : STATE.UNAVAIL,
  'Missile (blue Brinstar behind missile)':
    (i) => canUsePowerBombs(i) ? STATE.AVAILABLE : STATE.UNAVAIL,

  // ---- Brinstar/Green ----
  'Power Bomb (green Brinstar bottom)':
    (i) => canUsePowerBombs(i) ? STATE.AVAILABLE : STATE.UNAVAIL,
  'Missile (green Brinstar below super missile)':
    (i) => (canPassBombPassages(i) && canOpenRedDoors(i)) ? STATE.AVAILABLE : STATE.UNAVAIL,
  'Super Missile (green Brinstar top)': {
    normal: (i) => canOpenRedDoors(i) && smHasSpeed(i),
    hard:   (i) => canOpenRedDoors(i) && (smHasMorph(i) || smHasSpeed(i)),
  },
  'Reserve Tank, Brinstar': {
    normal: (i) => canOpenRedDoors(i) && smHasSpeed(i),
    hard:   (i) => canOpenRedDoors(i) && (smHasMorph(i) || smHasSpeed(i)),
  },
  'Missile (green Brinstar behind missile)': {
    normal: (i) => smHasSpeed(i) && canPassBombPassages(i) && canOpenRedDoors(i),
    hard:   (i) => canOpenRedDoors(i) && (canPassBombPassages(i) || (smHasMorph(i) && smHasScrew(i))),
  },
  'Missile (green Brinstar behind reserve tank)': {
    normal: (i) => smHasSpeed(i) && canOpenRedDoors(i) && smHasMorph(i),
    hard:   (i) => canOpenRedDoors(i) && smHasMorph(i),
  },
  'Energy Tank, Etecoons':
    (i) => canUsePowerBombs(i) ? STATE.AVAILABLE : STATE.UNAVAIL,
  'Super Missile (green Brinstar bottom)':
    (i) => (canUsePowerBombs(i) && smHasSuper(i)) ? STATE.AVAILABLE : STATE.UNAVAIL,

  // ---- Brinstar/Pink ----
  'Super Missile (pink Brinstar)':
    (i) => (canPassBombPassages(i) && smHasSuper(i)) ? STATE.AVAILABLE : STATE.UNAVAIL,
  'Missile (pink Brinstar top)':
    (_i) => STATE.AVAILABLE,
  'Missile (pink Brinstar bottom)':
    (_i) => STATE.AVAILABLE,
  'Charge Beam':
    (i) => canPassBombPassages(i) ? STATE.AVAILABLE : STATE.UNAVAIL,
  'Power Bomb (pink Brinstar)': {
    normal: (i) => canUsePowerBombs(i) && smHasSuper(i) && hasEnergyReserves(i, 1),
    hard:   (i) => canUsePowerBombs(i) && smHasSuper(i),
  },
  'Missile (green Brinstar pipe)':
    (i) => (smHasMorph(i) && (smHasPB(i) || smHasSuper(i) || canAccessNorfairUpperPortal(i))) ? STATE.AVAILABLE : STATE.UNAVAIL,
  'Energy Tank, Waterway':
    (i) => (canUsePowerBombs(i) && canOpenRedDoors(i) && smHasSpeed(i) &&
            (hasEnergyReserves(i, 1) || smHasGravity(i))) ? STATE.AVAILABLE : STATE.UNAVAIL,
  'Energy Tank, Brinstar Gate': {
    normal: (i) => canUsePowerBombs(i) && smHasWave(i) && hasEnergyReserves(i, 1),
    // Hard: Super opens the Blue Gate too, no ER(1) required
    hard:   (i) => canUsePowerBombs(i) && (smHasWave(i) || smHasSuper(i)),
  },

  // ---- Brinstar/Red ----
  'X-Ray Scope': {
    normal: (i) => canUsePowerBombs(i) && canOpenRedDoors(i) && (smHasGrapple(i) || smHasSpace(i)),
    // Hard: also reachable via IBJ / HiJump+Speed / SpringBall jump + tanks
    hard:   (i) => canUsePowerBombs(i) && canOpenRedDoors(i) && (
      smHasGrapple(i) || smHasSpace(i) ||
      ((canIbj(i) || (smHasHiJump(i) && smHasSpeed(i)) || canSpringBallJump(i)) &&
       ((smHasVaria(i) && hasEnergyReserves(i, 3)) || hasEnergyReserves(i, 5)))
    ),
  },
  'Power Bomb (red Brinstar sidehopper room)':
    (i) => (canUsePowerBombs(i) && smHasSuper(i)) ? STATE.AVAILABLE : STATE.UNAVAIL,
  'Power Bomb (red Brinstar spike room)': {
    normal: (i) => (canUsePowerBombs(i) || smHasIce(i)) && smHasSuper(i),
    // Hard: just Super — spike traversal without PB/Ice
    hard:   (i) => smHasSuper(i),
  },
  'Missile (red Brinstar spike room)':
    (i) => (canUsePowerBombs(i) && smHasSuper(i)) ? STATE.AVAILABLE : STATE.UNAVAIL,
  'Spazer':
    (i) => (canPassBombPassages(i) && smHasSuper(i)) ? STATE.AVAILABLE : STATE.UNAVAIL,

  // ---- Brinstar/Kraid ----
  // CardBrinstarBoss → true w/o keysanity
  'Energy Tank, Kraid':
    (_i) => STATE.AVAILABLE,
  'Varia Suit':
    (_i) => STATE.AVAILABLE,
  'Missile (Kraid)':
    (i) => canUsePowerBombs(i) ? STATE.AVAILABLE : STATE.UNAVAIL,

  // ---- Norfair Upper West ----
  'Missile (lava room)': {
    normal: (i) => smHasVaria(i) && (
      (canOpenRedDoors(i) && (canFly(i) || smHasHiJump(i) || smHasSpeed(i))) ||
      canEnterNorfairUpperEast(i)
    ) && smHasMorph(i),
    // Hard: canHellRun substitutes for Varia; vertical traversal relaxed
    hard: (i) => canHellRun(i) && (
      (canOpenRedDoors(i) && (
        canFly(i) || smHasHiJump(i) || smHasSpeed(i) ||
        canSpringBallJump(i) || (smHasVaria(i) && smHasIce(i))
      )) ||
      canEnterNorfairUpperEastHard(i)
    ) && smHasMorph(i),
  },
  'Ice Beam': {
    normal: (i) => smHasSuper(i) && canPassBombPassages(i) && smHasVaria(i) && smHasSpeed(i),
    // Hard: Morph + (Varia OR ER(3)) — no Speed needed
    hard:   (i) => smHasSuper(i) && smHasMorph(i) && (smHasVaria(i) || hasEnergyReserves(i, 3)),
  },
  'Missile (below Ice Beam)': {
    normal: (i) => smHasSuper(i) && canUsePowerBombs(i) && smHasVaria(i) && smHasSpeed(i),
    hard: (i) =>
      (smHasSuper(i) && canUsePowerBombs(i) && (smHasVaria(i) || hasEnergyReserves(i, 3))) ||
      ((smHasMissile(i) || smHasSuper(i) || smHasWave(i)) && smHasVaria(i) && smHasSpeed(i) && smHasSuper(i)),
  },
  'Hi-Jump Boots':
    (i) => (canOpenRedDoors(i) && canPassBombPassages(i)) ? STATE.AVAILABLE : STATE.UNAVAIL,
  'Missile (Hi-Jump Boots)':
    (i) => (canOpenRedDoors(i) && smHasMorph(i)) ? STATE.AVAILABLE : STATE.UNAVAIL,
  'Energy Tank (Hi-Jump Boots)':
    (i) => canOpenRedDoors(i) ? STATE.AVAILABLE : STATE.UNAVAIL,

  // ---- Norfair Upper East ----
  // CardNorfairL2 → true w/o keysanity
  'Reserve Tank, Norfair': {
    normal: (i) => smHasMorph(i) && (
      canFly(i) ||
      (smHasGrapple(i) && (smHasSpeed(i) || canPassBombPassages(i))) ||
      smHasHiJump(i) || smHasIce(i)
    ),
    // Hard: Morph + Super (shoot the green door)
    hard: (i) => smHasMorph(i) && smHasSuper(i),
  },
  'Missile (Norfair Reserve Tank)': {
    normal: (i) => smHasMorph(i) && (
      canFly(i) ||
      (smHasGrapple(i) && (smHasSpeed(i) || canPassBombPassages(i))) ||
      smHasHiJump(i) || smHasIce(i)
    ),
    hard: (i) => smHasMorph(i) && smHasSuper(i),
  },
  'Missile (bubble Norfair green door)': {
    normal: (i) =>
      canFly(i) ||
      (smHasGrapple(i) && smHasMorph(i) && (smHasSpeed(i) || canPassBombPassages(i))) ||
      smHasHiJump(i) || smHasIce(i),
    hard: (i) => smHasSuper(i),
  },
  'Missile (bubble Norfair)':
    (_i) => STATE.AVAILABLE,
  'Missile (Speed Booster)': {
    normal: (i) =>
      canFly(i) ||
      (smHasMorph(i) && (smHasSpeed(i) || canPassBombPassages(i))) ||
      smHasHiJump(i) || smHasIce(i),
    hard: (i) => smHasSuper(i),
  },
  'Speed Booster': {
    normal: (i) =>
      canFly(i) ||
      (smHasMorph(i) && (smHasSpeed(i) || canPassBombPassages(i))) ||
      smHasHiJump(i) || smHasIce(i),
    hard: (i) => smHasSuper(i),
  },
  'Missile (Wave Beam)': {
    normal: (i) => (
      canFly(i) ||
      (smHasMorph(i) && (smHasSpeed(i) || canPassBombPassages(i))) ||
      smHasHiJump(i) || smHasIce(i)
    ) || (smHasSpeed(i) && smHasWave(i) && smHasMorph(i) && smHasSuper(i)),
    // Hard: effectively always available once region is entered
    hard: (_i) => true,
  },
  'Wave Beam': {
    normal: (i) => smHasMorph(i) && (
      (
        canFly(i) ||
        (smHasMorph(i) && (smHasSpeed(i) || canPassBombPassages(i))) ||
        smHasHiJump(i) || smHasIce(i)
      ) ||
      (smHasSpeed(i) && smHasWave(i) && smHasMorph(i) && smHasSuper(i))
    ),
    hard: (i) => canOpenRedDoors(i) &&
                 (smHasMorph(i) || smHasGrapple(i) || (smHasHiJump(i) && smHasVaria(i)) || smHasSpace(i)),
  },

  // ---- Norfair Upper Crocomire ----
  // CanAccessCrocomire (no keysanity) = Super
  'Energy Tank, Crocomire': {
    normal: (i) => smHasSuper(i) && (hasEnergyReserves(i, 1) || smHasSpace(i) || smHasGrapple(i)),
    // Hard: just Super (drop into pit from above)
    hard:   (i) => smHasSuper(i),
  },
  'Missile (above Crocomire)': {
    normal: (i) => canFly(i) || smHasGrapple(i) || (smHasHiJump(i) && smHasSpeed(i)),
    hard: (i) => canHellRun(i) && (
      canFly(i) || smHasGrapple(i) ||
      (smHasHiJump(i) && (smHasSpeed(i) || canSpringBallJump(i) || (smHasVaria(i) && smHasIce(i))))
    ),
  },
  'Power Bomb (Crocomire)': {
    normal: (i) => smHasSuper(i) && (canFly(i) || smHasHiJump(i) || smHasGrapple(i)),
    hard:   (i) => smHasSuper(i),
  },
  'Missile (below Crocomire)':
    (i) => (smHasSuper(i) && smHasMorph(i)) ? STATE.AVAILABLE : STATE.UNAVAIL,
  'Missile (Grappling Beam)': {
    normal: (i) => smHasSuper(i) && smHasMorph(i) && (canFly(i) || (smHasSpeed(i) && canUsePowerBombs(i))),
    hard:   (i) => smHasSuper(i) && (smHasSpeed(i) || (smHasMorph(i) && (canFly(i) || smHasGrapple(i)))),
  },
  'Grappling Beam': {
    normal: (i) => smHasSuper(i) && smHasMorph(i) && (canFly(i) || (smHasSpeed(i) && canUsePowerBombs(i))),
    hard: (i) => smHasSuper(i) &&
                 (smHasSpace(i) || smHasMorph(i) || smHasGrapple(i) || (smHasHiJump(i) && smHasSpeed(i))),
  },

  // ---- Norfair Lower West ----
  'Missile (Gold Torizo)':
    (i) => (canUsePowerBombs(i) && smHasSpace(i) && smHasSuper(i)) ? STATE.AVAILABLE : STATE.UNAVAIL,
  'Super Missile (Gold Torizo)': {
    normal: (i) => canDestroyBombWalls(i) && (smHasSuper(i) || smHasCharge(i)) &&
                   (canAccessNorfairLowerPortal(i) || (canUsePowerBombs(i) && smHasSpace(i))),
    // Hard is tighter (requires Varia) — encoded for completeness
    hard:   (i) => canDestroyBombWalls(i) && smHasVaria(i) && (smHasSuper(i) || smHasCharge(i)),
  },
  'Screw Attack': {
    normal: (i) => canDestroyBombWalls(i) &&
                   (canAccessNorfairLowerPortal(i) || (canUsePowerBombs(i) && smHasSpace(i))),
    hard:   (i) => canDestroyBombWalls(i) && (canAccessNorfairLowerPortal(i) || smHasVaria(i)),
  },
  'Missile (Mickey Mouse room)':
    // Outer condition: Morph + Super + canFly + canUsePowerBombs
    // Inner OR: first clause is "(L1 OR Gravity) && L2" — both Cards true w/o keysanity → always true
    (i) => (smHasMorph(i) && smHasSuper(i) && canFly(i) && canUsePowerBombs(i)) ? STATE.AVAILABLE : STATE.UNAVAIL,

  // ---- Norfair Lower East ----
  // Per-loc use Normal canExitNorfairLowerEast for Normal branch;
  // Hard branch uses canExitNorfairLowerEastHard (which adds ER(5) morph-less escape).
  'Missile (lower Norfair above fire flea room)': {
    normal: (i) => canExitNorfairLowerEast(i),
    hard:   (i) => canExitNorfairLowerEastHard(i),
  },
  'Power Bomb (lower Norfair above fire flea room)': {
    normal: (i) => canExitNorfairLowerEast(i),
    // Hard: canonical actually tightens (requires canPassBombPassages).
    // Encode as tighter Hard so Normal stays looser when Normal passes.
    hard:   (i) => canExitNorfairLowerEastHard(i) && canPassBombPassages(i),
  },
  'Power Bomb (Power Bombs of shame)': {
    normal: (i) => canExitNorfairLowerEast(i) && canUsePowerBombs(i),
    hard:   (i) => canExitNorfairLowerEastHard(i) && canUsePowerBombs(i),
  },
  'Missile (lower Norfair near Wave Beam)': {
    normal: (i) => canExitNorfairLowerEast(i),
    // Hard: tightens — also requires Morph + canDestroyBombWalls
    hard:   (i) => canExitNorfairLowerEastHard(i) && smHasMorph(i) && canDestroyBombWalls(i),
  },
  'Energy Tank, Ridley': {
    // CardLowerNorfairBoss → true w/o keysanity
    normal: (i) => canExitNorfairLowerEast(i) && canUsePowerBombs(i) && smHasSuper(i),
    hard:   (i) => canExitNorfairLowerEastHard(i) && canUsePowerBombs(i) && smHasSuper(i),
  },
  'Energy Tank, Firefleas': {
    normal: (i) => canExitNorfairLowerEast(i),
    hard:   (i) => canExitNorfairLowerEastHard(i),
  },

  // ---- Wrecked Ship ----
  'Missile (Wrecked Ship middle)':
    (i) => canPassBombPassages(i) ? STATE.AVAILABLE : STATE.UNAVAIL,
  'Reserve Tank, Wrecked Ship': {
    normal: (i) => canUnlockShip(i) && canUsePowerBombs(i) && smHasSpeed(i) &&
                   (smHasGrapple(i) || smHasSpace(i) ||
                    (smHasVaria(i) && hasEnergyReserves(i, 2)) || hasEnergyReserves(i, 3)),
    hard:   (i) => canUnlockShip(i) && canUsePowerBombs(i) && smHasSpeed(i) &&
                   (smHasVaria(i) || hasEnergyReserves(i, 2)),
  },
  'Missile (Gravity Suit)': {
    normal: (i) => canUnlockShip(i) &&
                   (smHasGrapple(i) || smHasSpace(i) ||
                    (smHasVaria(i) && hasEnergyReserves(i, 2)) || hasEnergyReserves(i, 3)),
    hard:   (i) => canUnlockShip(i) && (smHasVaria(i) || hasEnergyReserves(i, 1)),
  },
  'Missile (Wrecked Ship top)':
    (i) => canUnlockShip(i) ? STATE.AVAILABLE : STATE.UNAVAIL,
  'Energy Tank, Wrecked Ship': {
    normal: (i) => canUnlockShip(i) && (smHasHiJump(i) || smHasSpace(i) || smHasSpeed(i) || smHasGravity(i)),
    // Hard: Morph+Bombs or Morph+PB also works (OnceBJ) + spring-ball jump
    hard: (i) => canUnlockShip(i) && (
      (smHasMorph(i) && (smHasBombs(i) || smHasPB(i))) ||
      canSpringBallJump(i) ||
      smHasHiJump(i) || smHasSpace(i) || smHasSpeed(i) || smHasGravity(i)
    ),
  },
  'Super Missile (Wrecked Ship left)':
    (i) => canUnlockShip(i) ? STATE.AVAILABLE : STATE.UNAVAIL,
  'Right Super, Wrecked Ship':
    (i) => canUnlockShip(i) ? STATE.AVAILABLE : STATE.UNAVAIL,
  'Gravity Suit': {
    normal: (i) => canUnlockShip(i) &&
                   (smHasGrapple(i) || smHasSpace(i) ||
                    (smHasVaria(i) && hasEnergyReserves(i, 2)) || hasEnergyReserves(i, 3)),
    hard:   (i) => canUnlockShip(i) && (smHasVaria(i) || hasEnergyReserves(i, 1)),
  },

  // ---- Maridia Outer ----
  'Missile (green Maridia shinespark)': {
    normal: (i) => smHasSpeed(i),
    // Hard tightens — Gravity also required (Maridia physics)
    hard:   (i) => smHasGravity(i) && smHasSpeed(i),
  },
  'Super Missile (green Maridia)':
    (_i) => STATE.AVAILABLE,
  'Energy Tank, Mama turtle': {
    normal: (i) => canOpenRedDoors(i) && (canFly(i) || smHasSpeed(i) || smHasGrapple(i)),
    hard: (i) => canOpenRedDoors(i) && (
      canFly(i) || smHasSpeed(i) || smHasGrapple(i) ||
      (canSpringBallJump(i) && (smHasGravity(i) || smHasHiJump(i)))
    ),
  },
  'Missile (green Maridia tatori)':
    (i) => canOpenRedDoors(i) ? STATE.AVAILABLE : STATE.UNAVAIL,

  // ---- Maridia Inner ----
  'Super Missile (yellow Maridia)':
    (i) => (canPassBombPassages(i) && canReachAqueduct(i) &&
            (smHasGravity(i) || smHasIce(i) || (smHasHiJump(i) && smHasSpring(i)))) ? STATE.AVAILABLE : STATE.UNAVAIL,
  'Missile (yellow Maridia super missile)':
    (i) => (canPassBombPassages(i) && canReachAqueduct(i) &&
            (smHasGravity(i) || smHasIce(i) || (smHasHiJump(i) && smHasSpring(i)))) ? STATE.AVAILABLE : STATE.UNAVAIL,
  'Missile (yellow Maridia false wall)':
    (i) => (canPassBombPassages(i) && canReachAqueduct(i) &&
            (smHasGravity(i) || smHasIce(i) || (smHasHiJump(i) && smHasSpring(i)))) ? STATE.AVAILABLE : STATE.UNAVAIL,
  'Plasma Beam': {
    normal: (i) => canDefeatDraygon(i) && (smHasScrew(i) || smHasPlasma(i)) && (smHasHiJump(i) || canFly(i)),
    // Hard: Charge+ER(3) damages Plasma-less; Speed also works for room
    hard: (i) => canDefeatDraygonHard(i) &&
                 ((smHasCharge(i) && hasEnergyReserves(i, 3)) ||
                  smHasScrew(i) || smHasPlasma(i) || smHasSpeed(i)) &&
                 (smHasHiJump(i) || canSpringBallJump(i) || canFly(i) || smHasSpeed(i)),
  },
  'Missile (left Maridia sand pit room)': {
    normal: (i) => canReachAqueduct(i) && smHasSuper(i) && canPassBombPassages(i),
    hard: (i) => canReachAqueductHard(i) && smHasSuper(i) &&
                 (smHasGravity(i) || (smHasHiJump(i) && (smHasSpace(i) || canSpringBallJump(i)))),
  },
  'Reserve Tank, Maridia': {
    normal: (i) => canReachAqueduct(i) && smHasSuper(i) && canPassBombPassages(i),
    hard: (i) => canReachAqueductHard(i) && smHasSuper(i) &&
                 (smHasGravity(i) || (smHasHiJump(i) && (smHasSpace(i) || canSpringBallJump(i)))),
  },
  'Missile (right Maridia sand pit room)': {
    normal: (i) => canReachAqueduct(i) && smHasSuper(i),
    hard: (i) => canReachAqueductHard(i) && smHasSuper(i) && (smHasHiJump(i) || smHasGravity(i)),
  },
  'Power Bomb (right Maridia sand pit room)': {
    normal: (i) => canReachAqueduct(i) && smHasSuper(i),
    hard: (i) => canReachAqueductHard(i) && smHasSuper(i) &&
                 (smHasGravity(i) || (smHasHiJump(i) && canSpringBallJump(i))),
  },
  'Missile (pink Maridia)': {
    normal: (i) => canReachAqueduct(i) && smHasSpeed(i),
    // Hard alt path: Gravity instead of Speed
    hard:   (i) => canReachAqueductHard(i) && smHasGravity(i),
  },
  'Super Missile (pink Maridia)': {
    normal: (i) => canReachAqueduct(i) && smHasSpeed(i),
    hard:   (i) => canReachAqueductHard(i) && smHasGravity(i),
  },
  'Spring Ball': {
    normal: (i) => smHasSuper(i) && smHasGrapple(i) && canUsePowerBombs(i) &&
                   (smHasSpace(i) || smHasHiJump(i)),
    // Hard: Gravity + canFly/HiJump path, or Ice+HiJump+SpringBall+Space combo
    hard: (i) => smHasSuper(i) && smHasGrapple(i) && canUsePowerBombs(i) && (
      (smHasGravity(i) && (canFly(i) || smHasHiJump(i))) ||
      (smHasIce(i) && smHasHiJump(i) && canSpringBallJump(i) && smHasSpace(i))
    ),
  },
  'Missile (Draygon)': {
    // CardMaridiaL1 + CardMaridiaL2 → both true w/o keysanity
    normal: (i) => canDefeatBotwoon(i) || canAccessMaridiaPortal(i),
    // Hard tightens — also requires Gravity
    hard:   (i) => (canDefeatBotwoonHard(i) || canAccessMaridiaPortal(i)) && smHasGravity(i),
  },
  'Energy Tank, Botwoon':
    (i) => (canDefeatBotwoon(i) || canAccessMaridiaPortal(i)) ? STATE.AVAILABLE : STATE.UNAVAIL,
  'Space Jump': {
    normal: (i) => canDefeatDraygon(i),
    hard:   (i) => canDefeatDraygonHard(i),
  },
};

// === Per-id region-entry gate ===
// Every check is gated by "can you physically enter the region this
// check lives in?" If the region entry fails, the check is UNAVAIL
// regardless of whether you have the per-loc requirements.
//
// Entries use either:
//   - a plain function (items) => bool                   — only Normal logic
//   - an object { normal, hard } of functions            — both branches
// See smCheck() for how they're evaluated.
const SM_REGION_ENTRY = {
  // Brinstar
  'sm-bri-01': canEnterBrinstarGreen,         // Super Missile (green Brinstar top)
  'sm-bri-02': canEnterBrinstarGreen,
  'sm-bri-03': canEnterBrinstarGreen,
  'sm-bri-04': canEnterBrinstarGreen,
  'sm-bri-05': canEnterBrinstarGreen,
  'sm-bri-06': { normal: canEnterBrinstarPink, hard: canEnterBrinstarPinkHard },   // Missile (pink Brinstar top)
  'sm-bri-07': canEnterBrinstarGreen,         // PB green bottom
  'sm-bri-08': { normal: canEnterBrinstarPink, hard: canEnterBrinstarPinkHard },
  'sm-bri-09': { normal: canEnterBrinstarPink, hard: canEnterBrinstarPinkHard },   // E-tank Brinstar Gate
  'sm-bri-10': canEnterBrinstarGreen,         // Super green bottom
  'sm-bri-11': canEnterBrinstarGreen,         // Etecoons
  'sm-bri-12': { normal: canEnterBrinstarPink, hard: canEnterBrinstarPinkHard },
  'sm-bri-13': { normal: canEnterBrinstarPink, hard: canEnterBrinstarPinkHard },   // Charge
  'sm-bri-14': { normal: canEnterBrinstarPink, hard: canEnterBrinstarPinkHard },   // Super pink
  'sm-bri-15': () => true,                    // PB blue Brinstar — Blue is from ship
  'sm-bri-16': () => true,                    // Morphing Ball — Blue
  'sm-bri-17': { normal: canEnterBrinstarPink, hard: canEnterBrinstarPinkHard },   // green Brinstar pipe
  'sm-bri-18': () => true,                    // Blue
  'sm-bri-19': () => true,                    // Blue
  'sm-bri-20': () => true,                    // Blue
  'sm-bri-21': () => true,                    // Blue ceiling
  'sm-bri-22': () => true,                    // Blue middle
  'sm-bri-23': { normal: canEnterBrinstarRed, hard: canEnterBrinstarRedHard },
  'sm-bri-24': { normal: canEnterBrinstarRed, hard: canEnterBrinstarRedHard },
  'sm-bri-25': { normal: canEnterBrinstarRed, hard: canEnterBrinstarRedHard },
  'sm-bri-26': { normal: canEnterBrinstarPink, hard: canEnterBrinstarPinkHard },   // Waterway
  'sm-bri-27': { normal: canEnterBrinstarRed, hard: canEnterBrinstarRedHard },
  'sm-bri-28': { normal: canEnterBrinstarRed, hard: canEnterBrinstarRedHard },     // Spazer
  'sm-bri-29': canEnterBrinstarKraid,         // Missile (Kraid)
  'sm-bri-30': canEnterBrinstarKraid,         // E-tank Kraid
  'sm-bri-31': canEnterBrinstarKraid,         // Varia

  // Crateria
  'sm-crt-32': canEnterCrateriaWest,          // Gauntlet left
  'sm-crt-33': canEnterCrateriaWest,          // Gauntlet right
  'sm-crt-34': canEnterCrateriaWest,          // Gauntlet etank
  'sm-crt-35': () => true,                    // PB Crateria surface — Central
  // v21 bug fix: Crateria East locations now properly gated via canEnterCrateriaEast.
  // Previously these were `() => true` which allowed Crateria moat (sm-crt-36) to
  // light green on empty inventory. sm-crt-37/38/39 also use this gate — their
  // per-loc requirements were already strict enough to prevent false positives,
  // but this is the correct architecture.
  'sm-crt-36': { normal: canEnterCrateriaEastNormal, hard: canEnterCrateriaEastHard },
  'sm-crt-37': { normal: canEnterCrateriaEastNormal, hard: canEnterCrateriaEastHard },
  'sm-crt-38': { normal: canEnterCrateriaEastNormal, hard: canEnterCrateriaEastHard },
  'sm-crt-39': { normal: canEnterCrateriaEastNormal, hard: canEnterCrateriaEastHard },
  'sm-crt-40': canEnterCrateriaWest,          // Terminator
  'sm-crt-41': () => true,                    // Crateria middle
  'sm-crt-42': () => true,                    // Bombs
  'sm-crt-43': () => true,                    // Super Crateria
  'sm-crt-44': () => true,                    // Crateria bottom

  // Wrecked Ship — all gated by canEnterWreckedShip (Normal + Hard)
  'sm-ws-45': { normal: canEnterWreckedShip, hard: canEnterWreckedShipHard },
  'sm-ws-46': { normal: canEnterWreckedShip, hard: canEnterWreckedShipHard },
  'sm-ws-47': { normal: canEnterWreckedShip, hard: canEnterWreckedShipHard },
  'sm-ws-48': { normal: canEnterWreckedShip, hard: canEnterWreckedShipHard },
  'sm-ws-49': { normal: canEnterWreckedShip, hard: canEnterWreckedShipHard },
  'sm-ws-50': { normal: canEnterWreckedShip, hard: canEnterWreckedShipHard },
  'sm-ws-51': { normal: canEnterWreckedShip, hard: canEnterWreckedShipHard },
  'sm-ws-52': { normal: canEnterWreckedShip, hard: canEnterWreckedShipHard },

  // Maridia
  'sm-mar-53': { normal: canEnterMaridiaInner, hard: canEnterMaridiaInnerHard },
  'sm-mar-54': { normal: canEnterMaridiaInner, hard: canEnterMaridiaInnerHard },
  'sm-mar-55': { normal: canEnterMaridiaInner, hard: canEnterMaridiaInnerHard },
  'sm-mar-56': { normal: canEnterMaridiaInner, hard: canEnterMaridiaInnerHard },
  'sm-mar-57': { normal: canEnterMaridiaInner, hard: canEnterMaridiaInnerHard },
  'sm-mar-58': { normal: canEnterMaridiaOuter, hard: canEnterMaridiaOuterHard },
  'sm-mar-59': { normal: canEnterMaridiaOuter, hard: canEnterMaridiaOuterHard },
  'sm-mar-60': { normal: canEnterMaridiaInner, hard: canEnterMaridiaInnerHard },
  'sm-mar-61': { normal: canEnterMaridiaInner, hard: canEnterMaridiaInnerHard },
  'sm-mar-62': { normal: canEnterMaridiaOuter, hard: canEnterMaridiaOuterHard },
  'sm-mar-63': { normal: canEnterMaridiaOuter, hard: canEnterMaridiaOuterHard },
  'sm-mar-64': { normal: canEnterMaridiaOuter, hard: canEnterMaridiaOuterHard },
  'sm-mar-65': { normal: canEnterMaridiaOuter, hard: canEnterMaridiaOuterHard },
  'sm-mar-66': { normal: canEnterMaridiaInner, hard: canEnterMaridiaInnerHard },
  'sm-mar-67': { normal: canEnterMaridiaInner, hard: canEnterMaridiaInnerHard },
  'sm-mar-68': { normal: canEnterMaridiaInner, hard: canEnterMaridiaInnerHard },
  'sm-mar-69': { normal: canEnterMaridiaInner, hard: canEnterMaridiaInnerHard },
  'sm-mar-70': { normal: canEnterMaridiaInner, hard: canEnterMaridiaInnerHard },

  // Norfair
  'sm-nor-71': canEnterNorfairUpperWest,      // Ice Beam
  'sm-nor-72': { normal: canEnterNorfairUpperEast, hard: canEnterNorfairUpperEastHard },
  'sm-nor-73': { normal: canEnterNorfairUpperEast, hard: canEnterNorfairUpperEastHard },
  'sm-nor-74': { normal: canEnterNorfairUpperEast, hard: canEnterNorfairUpperEastHard },
  'sm-nor-75': { normal: canEnterNorfairUpperEast, hard: canEnterNorfairUpperEastHard },
  'sm-nor-76': { normal: canEnterNorfairUpperEast, hard: canEnterNorfairUpperEastHard },
  'sm-nor-77': canEnterNorfairUpperWest,      // Missile below Ice Beam
  'sm-nor-78': canEnterNorfairUpperWest,      // Hi-Jump Boots
  'sm-nor-79': canEnterNorfairUpperWest,      // Missile Hi-Jump Boots
  'sm-nor-80': canEnterNorfairUpperWest,      // E-tank Hi-Jump Boots
  'sm-nor-81': { normal: canEnterNorfairUpperCrocomire, hard: canEnterNorfairUpperCrocomireHard },
  'sm-nor-82': canEnterNorfairUpperWest,      // Missile (lava room) — gate stays canEnterNorfairUpperWest; the Hard difference is per-loc (below)
  'sm-nor-83': { normal: canEnterNorfairUpperEast, hard: canEnterNorfairUpperEastHard },
  'sm-nor-84': { normal: canEnterNorfairUpperEast, hard: canEnterNorfairUpperEastHard },
  'sm-nor-85': { normal: canEnterNorfairUpperEast, hard: canEnterNorfairUpperEastHard },
  'sm-nor-86': { normal: canEnterNorfairLowerEast, hard: canEnterNorfairLowerEastHard },
  'sm-nor-87': { normal: canEnterNorfairLowerEast, hard: canEnterNorfairLowerEastHard },
  'sm-nor-88': { normal: canEnterNorfairLowerEast, hard: canEnterNorfairLowerEastHard },
  'sm-nor-89': { normal: canEnterNorfairUpperCrocomire, hard: canEnterNorfairUpperCrocomireHard },
  'sm-nor-90': { normal: canEnterNorfairUpperCrocomire, hard: canEnterNorfairUpperCrocomireHard },
  'sm-nor-91': { normal: canEnterNorfairLowerWest, hard: canEnterNorfairLowerWestHard },
  'sm-nor-92': { normal: canEnterNorfairLowerEast, hard: canEnterNorfairLowerEastHard },
  'sm-nor-93': { normal: canEnterNorfairUpperCrocomire, hard: canEnterNorfairUpperCrocomireHard },
  'sm-nor-94': { normal: canEnterNorfairUpperCrocomire, hard: canEnterNorfairUpperCrocomireHard },
  'sm-nor-95': { normal: canEnterNorfairUpperCrocomire, hard: canEnterNorfairUpperCrocomireHard },
  'sm-nor-96': { normal: canEnterNorfairLowerWest, hard: canEnterNorfairLowerWestHard },
  'sm-nor-97': { normal: canEnterNorfairLowerWest, hard: canEnterNorfairLowerWestHard },
  'sm-nor-98': { normal: canEnterNorfairLowerWest, hard: canEnterNorfairLowerWestHard },
  'sm-nor-99': { normal: canEnterNorfairLowerEast, hard: canEnterNorfairLowerEastHard },
  'sm-nor-100': { normal: canEnterNorfairLowerEast, hard: canEnterNorfairLowerEastHard },
};

// Master SM check function — combines region entry + per-loc check.
// Used by the SM_LOCATIONS entries below.
// Evaluate an SM check / region-entry "node" which may be either a
// plain function or a {normal, hard} pair.
//
// Plain function form (existing): `(items) => STATE | bool`
// Pair form (added v20): `{ normal: (items) => bool, hard: (items) => bool }`
//
// Returns 'normal' if the check passes via Normal logic, 'hard' if it
// passes only via the Hard branch (a glitch/trick), or 'no' otherwise.
//
// This dual-evaluator lets individual SM check entries be incrementally
// converted to the `{normal, hard}` shape without forcing a wholesale
// rewrite. Entries that haven't been converted are evaluated as Normal
// only — they'll never light up GLITCHED, which is the correct behavior
// because we haven't yet ported their Hard branch from the canonical
// source.
function _evalSMNode(node, items) {
  if (typeof node === 'function') {
    const r = node(items);
    // Function form may return STATE or bool; accept either as "normal pass"
    if (r === STATE.AVAILABLE || r === true) return 'normal';
    return 'no';
  }
  if (node && typeof node === 'object') {
    if (node.normal && node.normal(items)) return 'normal';
    if (node.hard && node.hard(items))     return 'hard';
  }
  return 'no';
}

function smCheck(id, name, items) {
  const entry = SM_REGION_ENTRY[id];
  const fn = SM_CHECK_BY_NAME[name];
  if (!entry || !fn) return STATE.UNAVAIL;
  const entryR = _evalSMNode(entry, items);
  if (entryR === 'no') return STATE.UNAVAIL;
  const checkR = _evalSMNode(fn, items);
  if (checkR === 'no') return STATE.UNAVAIL;
  // Result is GLITCHED if EITHER the region entry OR the per-loc check
  // could only be satisfied via the Hard branch.
  if (entryR === 'hard' || checkR === 'hard') return STATE.GLITCHED;
  return STATE.AVAILABLE;
}

// Backwards-compatibility shims for the predicate names the rest of
// logic.js references (cross-game portal predicates use these).
// They forward to the new region-entry functions.
function canAccessRedBrinstar(i)         { return canEnterBrinstarRed(i); }
function canAccessKraid(i)               { return canEnterBrinstarKraid(i); }
function canAccessHeatedNorfairUpper(i)  { return canEnterNorfairUpperWest(i) && hasHeatShield(i); }
function canAccessNorfairUpper(i)        { return canEnterNorfairUpperWest(i); }
function canAccessLowerNorfair(i)        { return canEnterNorfairLowerWest(i); }
function canAccessWreckedShip(i)         { return canEnterWreckedShip(i); }
function canAccessOuterMaridia(i)        { return canEnterMaridiaOuter(i); }
function canAccessInnerMaridia(i)        { return canEnterMaridiaInner(i); }

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


/* =============================================================
   ALttP logic — faithful port from tewtal/SMZ3Randomizer
   (MIT-licensed, used with attribution).

   Source: Randomizer.SMZ3/Regions/Zelda  (all .cs files in subfolders)
   See NOTICE.md for attribution.

   Key porting decisions:
   - Names match the SMZ3 source exactly so Z3_OVERWORLD_BY_NAME
     and Z3_DUNGEON_LOCATIONS can be looked up directly.
   - Keysanity is not modeled; canonical "Config.Keysanity ? a : b"
     evaluates the non-keysanity branch.
   - MultiWorld is not modeled (single player only).
   - Inverted mode is not supported.
   - The canonical source has only one logic branch per location
     (no Hard/Glitched variant), so checks return AVAILABLE or
     UNAVAIL — never GLITCHED. The GLITCHED state surfaces from
     SM checks where the canonical SM source DOES have Hard
     branches. (See SM port.)
   ============================================================= */

// ===========================================================
// Helper predicates translated from Item.cs / World.cs
// ===========================================================

// CanLiftLight() — any glove (Power or Titan)
function canLiftLight(i) { return (i.glove || 0) >= 1; }
// CanLiftHeavy() — Titan glove
function canLiftHeavy(i) { return (i.glove || 0) >= 2; }
// CanLightTorches() — Fire Rod or Lantern
function canLightTorches(i) { return has(i, 'firerod') || has(i, 'lantern'); }
// CanMeltFreezors() — Fire Rod, or (Bombos + Sword)
function canMeltFreezors(i) {
  return has(i, 'firerod') || (has(i, 'bombos') && (i.sword || 0) >= 1);
}
// CanKillManyEnemies() — most weapons
function canKillManyEnemies(i) {
  return (i.sword || 0) >= 1 ||
         has(i, 'hammer') ||
         (i.bow || 0) >= 1 ||
         has(i, 'firerod') || has(i, 'icerod') ||
         has(i, 'somaria') || has(i, 'byrna');
}
// CanBlockLasers() — Mirror Shield (NOT tracked; treat as false)
function canBlockLasers(_i) { return false; }
// CanExtendMagic(N=2) — magic supply at N times normal.
//   halfMagic doubles supply (1.0 → 2.0).
//   Each bottle adds one full refill (~1.0).
//   Formula: (halfMagic ? 2 : 1) + (bottle count) >= N
function canExtendMagic(i, n) {
  const supply = (has(i, 'halfMagic') ? 2 : 1) + (i.bottle || 0);
  return supply >= (n || 2);
}

// items.MasterSword → sword tier >= 2
function _masterSword(i) { return (i.sword || 0) >= 2; }

// World.CanAcquire(items, RewardType) and World.CanAcquireAll
// In single-player, these check whether the prize a dungeon was
// SET TO has been earned by completing that dungeon (boss + chests).
// Tracker tracks dungeon prize via st.dungeons.<id>.prize.
//
// Prize codes:
//   0 = blue crystal
//   1 = red crystal (CrystalRed)
//   2 = pendant blue/red (PendantNonGreen)
//   3 = pendant green   (PendantGreen)
//   4 = (metroid boss token — used by GT entry)
//
// Whether a "reward" is acquired depends on whether the matching
// dungeon's boss has been beaten. The tracker's per-dungeon
// boss state is st.dungeons.<id>.boss.
//
// Castle Tower is special — its reward is Agahnim, beaten via
// st.dungeons.at.boss.

// dungeon -> tracker key
const DUNGEON_TRACKER_IDS = ['ep','dp','toh','pod','sp','sw','tt','ip','mm','tr','gt','hc','at'];

function _dungeonHasPrize(st, dungId, prizeCodePredicate) {
  const d = st.dungeons[dungId];
  if (!d) return false;
  if (!d.boss) return false;
  return prizeCodePredicate(d.prize);
}

// World.CanAcquire(items, Agahnim) — beat Castle Tower
function canAcquireAgahnim(_i, st) {
  return !!(st && st.dungeons && st.dungeons.at && st.dungeons.at.boss);
}

// World.CanAcquire(items, PendantGreen) — at least one dungeon
// with green pendant prize has been completed
function canAcquirePendantGreen(_i, st) {
  if (!st || !st.dungeons) return false;
  return DUNGEON_TRACKER_IDS.some(id => _dungeonHasPrize(st, id, p => p === 3));
}

// World.CanAcquireAll(items, AnyPendant) — all 3 pendant-bearing
// dungeons completed (the 3 dungeons whose prize is set to a pendant)
function canAcquireAllPendants(_i, st) {
  if (!st || !st.dungeons) return false;
  let pendantCount = 0;
  for (const id of DUNGEON_TRACKER_IDS) {
    const d = st.dungeons[id];
    if (!d || !d.boss) continue;
    if (d.prize === 2 || d.prize === 3) pendantCount++;
  }
  return pendantCount >= 3;
}

// World.CanAcquireAll(items, CrystalRed) — both red-crystal dungeons
// completed (Pyramid Fairy gating)
function canAcquireAllRedCrystals(_i, st) {
  if (!st || !st.dungeons) return false;
  let n = 0;
  for (const id of DUNGEON_TRACKER_IDS) {
    const d = st.dungeons[id];
    if (!d || !d.boss) continue;
    if (d.prize === 1) n++;
  }
  return n >= 2;
}

// World.CanAcquireAtLeast(N, items, AnyCrystal) — N crystal dungeons
// completed (GT entry gate)
function canAcquireAtLeastNCrystals(_i, st, n) {
  if (!st || !st.dungeons) return false;
  let count = 0;
  for (const id of DUNGEON_TRACKER_IDS) {
    const d = st.dungeons[id];
    if (!d || !d.boss) continue;
    if (d.prize === 0 || d.prize === 1) count++;
  }
  return count >= n;
}

// items.CanAccessDeathMountainPortal() — SM-side reverse path
//   from Norfair Upper Portal that exits to LW DM.
function _canAccessDeathMountainPortal(i) {
  return _reachedUpperNorfairSMNative(i);
}

// items.CanAccessMiseryMirePortal(Config) — SM-side reverse path
//   from Norfair Lower Portal that exits to DW Mire.
function _canAccessMiseryMirePortalZ3(i) {
  return _reachedLowerNorfairSMNative(i);
}

// items.CanAccessDarkWorldPortal(Config) — SM-side reverse path
//   from Maridia Portal that exits to Pyramid moat in DW.
//   (Note: Z3 source uses this for DW NW/S/NE entry calcs.)
function _canAccessDarkWorldPortalZ3(i) {
  return _reachedOuterMaridiaSMNative(i);
}

// ===========================================================
// Z3 region-entry predicates (from each region's CanEnter)
// ===========================================================

// Light World North East / South / North West are accessible from spawn — no CanEnter override.
function z3CanEnterLWNorthEast(_i) { return true; }
function z3CanEnterLWNorthWest(_i) { return true; }
function z3CanEnterLWSouth(_i) { return true; }

// LW Death Mountain West:
//   Flute OR (CanLiftLight + Lamp) OR CanAccessDeathMountainPortal
function z3CanEnterLWDMWest(i) {
  return has(i, 'flute') ||
         (canLiftLight(i) && has(i, 'lantern')) ||
         _canAccessDeathMountainPortal(i);
}

// LW Death Mountain East:
//   LW DM West entry + (Hammer+Mirror OR Hookshot)
function z3CanEnterLWDMEast(i) {
  return z3CanEnterLWDMWest(i) &&
         ((has(i, 'hammer') && has(i, 'mirror')) || has(i, 'hookshot'));
}

// DW Mire:
//   (Flute + CanLiftHeavy) OR CanAccessMiseryMirePortal
function z3CanEnterDWMire(i) {
  return (has(i, 'flute') && canLiftHeavy(i)) ||
         _canAccessMiseryMirePortalZ3(i);
}

// DW South:
//   MoonPearl + (
//     (Agahnim OR (DW portal + Flippers)) + (Hammer OR (Hookshot + (Flippers OR LiftLight)))
//     OR (Hammer + LiftLight)
//     OR LiftHeavy
//   )
function z3CanEnterDWSouth(i, st) {
  if (!has(i, 'moonpearl')) return false;
  const aghOrPortal = canAcquireAgahnim(i, st) ||
                      (_canAccessDarkWorldPortalZ3(i) && has(i, 'flippers'));
  const part1 = aghOrPortal &&
                (has(i, 'hammer') ||
                 (has(i, 'hookshot') && (has(i, 'flippers') || canLiftLight(i))));
  const part2 = has(i, 'hammer') && canLiftLight(i);
  const part3 = canLiftHeavy(i);
  return part1 || part2 || part3;
}

// DW North East:
//   Agahnim
//   OR (MoonPearl + (
//        (Hammer + LiftLight)
//        OR (LiftHeavy + Flippers)
//        OR (DW portal + Flippers)
//      ))
function z3CanEnterDWNorthEast(i, st) {
  if (canAcquireAgahnim(i, st)) return true;
  if (!has(i, 'moonpearl')) return false;
  return (has(i, 'hammer') && canLiftLight(i)) ||
         (canLiftHeavy(i) && has(i, 'flippers')) ||
         (_canAccessDarkWorldPortalZ3(i) && has(i, 'flippers'));
}

// DW North West:
//   MoonPearl + (
//     (Agahnim OR (DW portal + Flippers)) + Hookshot + (Flippers OR LiftLight OR Hammer)
//     OR (Hammer + LiftLight)
//     OR LiftHeavy
//   )
function z3CanEnterDWNorthWest(i, st) {
  if (!has(i, 'moonpearl')) return false;
  const aghOrPortal = canAcquireAgahnim(i, st) ||
                      (_canAccessDarkWorldPortalZ3(i) && has(i, 'flippers'));
  const part1 = aghOrPortal && has(i, 'hookshot') &&
                (has(i, 'flippers') || canLiftLight(i) || has(i, 'hammer'));
  const part2 = has(i, 'hammer') && canLiftLight(i);
  const part3 = canLiftHeavy(i);
  return part1 || part2 || part3;
}

// DW Death Mountain East:
//   LiftHeavy + LW DM East entry
function z3CanEnterDWDMEast(i) {
  return canLiftHeavy(i) && z3CanEnterLWDMEast(i);
}

// DW Death Mountain West (Spike Cave region) — no CanEnter override
// in source; the Spike Cave location itself has all the gating.

// ===========================================================
// Per-location overworld checks
// ===========================================================
// Each function returns boolean. Caller wraps to STATE.
// Region-entry gate is applied in Z3_OVERWORLD_BY_NAME entries
// where it's an explicit dependency in the source.

const Z3_OVERWORLD_BY_NAME = {
  // ---------- LW North East ----------
  'King Zora': (i, _st) => canLiftLight(i) || has(i, 'flippers'),
  "Zora's Ledge": (i, _st) => has(i, 'flippers'),
  'Waterfall Fairy - Left':  (i, _st) => has(i, 'flippers'),
  'Waterfall Fairy - Right': (i, _st) => has(i, 'flippers'),
  'Potion Shop': (i, _st) => has(i, 'mushroom'),
  // Sahasrahla's Hut chests are unconditional
  "Sahasrahla's Hut - Left":   (_i, _st) => true,
  "Sahasrahla's Hut - Middle": (_i, _st) => true,
  "Sahasrahla's Hut - Right":  (_i, _st) => true,
  'Sahasrahla': (i, st) => canAcquirePendantGreen(i, st),

  // ---------- LW North West ----------
  'Master Sword Pedestal': (i, st) => canAcquireAllPendants(i, st),
  'Mushroom':              (_i, _st) => true,
  'Lost Woods Hideout':    (_i, _st) => true,
  'Lumberjack Tree':       (i, st) => canAcquireAgahnim(i, st) && has(i, 'boots'),
  'Pegasus Rocks':         (i, _st) => has(i, 'boots'),
  'Graveyard Ledge':       (i, st) => has(i, 'mirror') && has(i, 'moonpearl') &&
                                       z3CanEnterDWNorthWest(i, st),
  "King's Tomb":           (i, st) => has(i, 'boots') && (
                                       canLiftHeavy(i) ||
                                       (has(i, 'mirror') && has(i, 'moonpearl') &&
                                        z3CanEnterDWNorthWest(i, st))),
  // Kakariko Well — 5 chests, all unconditional
  'Kakariko Well - Top':    (_i, _st) => true,
  'Kakariko Well - Left':   (_i, _st) => true,
  'Kakariko Well - Middle': (_i, _st) => true,
  'Kakariko Well - Right':  (_i, _st) => true,
  'Kakariko Well - Bottom': (_i, _st) => true,
  // Blind's Hideout — 5 chests, all unconditional
  "Blind's Hideout - Top":       (_i, _st) => true,
  "Blind's Hideout - Far Left":  (_i, _st) => true,
  "Blind's Hideout - Left":      (_i, _st) => true,
  "Blind's Hideout - Right":     (_i, _st) => true,
  "Blind's Hideout - Far Right": (_i, _st) => true,
  'Bottle Merchant':       (_i, _st) => true,
  'Chicken House':         (_i, _st) => true,
  'Sick Kid':              (i, _st) => (i.bottle || 0) >= 1,
  'Kakariko Tavern':       (_i, _st) => true,
  'Magic Bat':             (i, _st) => has(i, 'powder') && (
                                        has(i, 'hammer') ||
                                        (has(i, 'moonpearl') && has(i, 'mirror') && canLiftHeavy(i))),

  // ---------- LW South ----------
  'Maze Race': (_i, _st) => true,
  'Library':   (i, _st) => has(i, 'boots'),
  'Flute Spot': (i, _st) => has(i, 'shovel'),
  'South of Grove': (i, st) => has(i, 'mirror') && z3CanEnterDWSouth(i, st),
  "Link's House": (_i, _st) => true,
  "Aginah's Cave": (_i, _st) => true,
  // Mini-Moldorm Cave — 5 chests/items, all unconditional
  'Mini Moldorm Cave - Far Left':  (_i, _st) => true,
  'Mini Moldorm Cave - Left':      (_i, _st) => true,
  'Mini Moldorm Cave - NPC':       (_i, _st) => true,
  'Mini Moldorm Cave - Right':     (_i, _st) => true,
  'Mini Moldorm Cave - Far Right': (_i, _st) => true,
  // Desert Ledge — gated by DP entry
  'Desert Ledge': (i, _st) => z3CanEnterDesertPalace(i),
  'Checkerboard Cave': (i, _st) => has(i, 'mirror') &&
                                    ((has(i, 'flute') && canLiftHeavy(i)) ||
                                     _canAccessMiseryMirePortalZ3(i)) &&
                                    canLiftLight(i),
  'Bombos Tablet': (i, st) => has(i, 'book') && _masterSword(i) && has(i, 'mirror') &&
                              z3CanEnterDWSouth(i, st),
  'Floodgate Chest': (_i, _st) => true,
  'Sunken Treasure': (_i, _st) => true,
  'Lake Hylia Island': (i, st) => has(i, 'flippers') && has(i, 'moonpearl') && has(i, 'mirror') &&
                                  (z3CanEnterDWSouth(i, st) || z3CanEnterDWNorthEast(i, st)),
  'Hobo': (i, _st) => has(i, 'flippers'),
  'Ice Rod Cave': (_i, _st) => true,

  // ---------- LW DM West ----------
  'Ether Tablet': (i, _st) => has(i, 'book') && _masterSword(i) &&
                              (has(i, 'mirror') || (has(i, 'hammer') && has(i, 'hookshot'))),
  'Spectacle Rock': (i, _st) => has(i, 'mirror'),
  'Spectacle Rock Cave': (_i, _st) => true,
  'Old Man': (i, _st) => has(i, 'lantern'),

  // ---------- LW DM East ----------
  'Floating Island': (i, _st) => has(i, 'mirror') && has(i, 'moonpearl') && canLiftHeavy(i),
  'Spiral Cave':                       (_i, _st) => true,
  'Paradox Cave Upper - Left':         (_i, _st) => true,
  'Paradox Cave Upper - Right':        (_i, _st) => true,
  'Paradox Cave Lower - Far Left':     (_i, _st) => true,
  'Paradox Cave Lower - Left':         (_i, _st) => true,
  'Paradox Cave Lower - Middle':       (_i, _st) => true,
  'Paradox Cave Lower - Right':        (_i, _st) => true,
  'Paradox Cave Lower - Far Right':    (_i, _st) => true,
  'Mimic Cave': (i, st) => has(i, 'mirror') &&
                           (st && st.dungeons && st.dungeons.tr &&
                            (st.dungeons.tr.smallKeys >= 2 || true)) &&  // small keys not tracked, assume met
                           z3CanEnterTurtleRock(i, st),

  // ---------- DW Mire ----------
  'Mire Shed - Left':  (i, _st) => has(i, 'moonpearl'),
  'Mire Shed - Right': (i, _st) => has(i, 'moonpearl'),

  // ---------- DW North East ----------
  'Catfish': (i, _st) => has(i, 'moonpearl') && canLiftLight(i),
  'Pyramid': (_i, _st) => true,
  'Pyramid Fairy - Left':  (i, st) => canAcquireAllRedCrystals(i, st) && has(i, 'moonpearl') &&
                                      z3CanEnterDWSouth(i, st) &&
                                      (has(i, 'hammer') || (has(i, 'mirror') && canAcquireAgahnim(i, st))),
  'Pyramid Fairy - Right': (i, st) => canAcquireAllRedCrystals(i, st) && has(i, 'moonpearl') &&
                                      z3CanEnterDWSouth(i, st) &&
                                      (has(i, 'hammer') || (has(i, 'mirror') && canAcquireAgahnim(i, st))),

  // ---------- DW North West ----------
  'Bumper Cave': (i, _st) => canLiftLight(i) && has(i, 'cape'),
  'Chest Game':  (_i, _st) => true,
  'C-Shaped House': (_i, _st) => true,
  'Brewery':     (_i, _st) => true,
  'Hammer Pegs': (i, _st) => canLiftHeavy(i) && has(i, 'hammer'),
  'Blacksmith':  (i, _st) => canLiftHeavy(i),
  'Purple Chest': (i, _st) => canLiftHeavy(i),

  // ---------- DW South ----------
  'Digging Game': (_i, _st) => true,
  'Stumpy':       (_i, _st) => true,
  'Hype Cave - Top':         (_i, _st) => true,
  'Hype Cave - Middle Right': (_i, _st) => true,
  'Hype Cave - Middle Left':  (_i, _st) => true,
  'Hype Cave - Bottom':       (_i, _st) => true,
  'Hype Cave - NPC':         (_i, _st) => true,

  // ---------- DW DM East ----------
  'Hookshot Cave - Top Right':    (i, _st) => has(i, 'moonpearl') && has(i, 'hookshot'),
  'Hookshot Cave - Top Left':     (i, _st) => has(i, 'moonpearl') && has(i, 'hookshot'),
  'Hookshot Cave - Bottom Left':  (i, _st) => has(i, 'moonpearl') && has(i, 'hookshot'),
  'Hookshot Cave - Bottom Right': (i, _st) => has(i, 'moonpearl') && (has(i, 'hookshot') || has(i, 'boots')),
  'Superbunny Cave - Top':    (i, _st) => has(i, 'moonpearl'),
  'Superbunny Cave - Bottom': (i, _st) => has(i, 'moonpearl'),

  // ---------- DW DM West ----------
  'Spike Cave': (i, _st) => has(i, 'moonpearl') && has(i, 'hammer') && canLiftLight(i) &&
                            ((canExtendMagic(i, 2) && has(i, 'cape')) || has(i, 'byrna')) &&
                            z3CanEnterLWDMWest(i),
};

// ===========================================================
// Tracker-id grouping
// ===========================================================
//
// The tracker collapses some multi-chest groups into one ID. For
// each tracker ID we list:
//   - the source location names that map to it
//   - any region-entry gate that must succeed
// The grouped check returns:
//   AVAILABLE = all named source chests reachable AND region entered
//   PARTIAL   = some chests reachable
//   UNAVAIL   = none

const Z3_TRACKER_GROUPS = {
  // ---- LW Pedestal (special — uses its own check below) ----
  // Handled inline — only one source location.

  // ---- LW NE single-name groups ----
  'lw-king-zora':         { region: z3CanEnterLWNorthEast, names: ['King Zora'] },
  // Zora's Ledge: fake-flipper (water-walk glitch) reaches it without any items.
  'lw-zora':              { region: z3CanEnterLWNorthEast, names: ["Zora's Ledge"],
                            hardIf: (_i, _st) => true },
  // Waterfall Fairy: fake-flipper / water-walk reaches with Boots OR Moon Pearl
  // (Moon Pearl is needed to maintain Link's form during the water-walk; Boots
  // give the dash-into-water momentum trick).
  'lw-waterfall-fairy':   { region: z3CanEnterLWNorthEast, names: ['Waterfall Fairy - Left', 'Waterfall Fairy - Right'],
                            hardIf: (i, _st) => has(i, 'boots') || has(i, 'moonpearl') },
  'lw-potion-shop':       { region: z3CanEnterLWNorthEast, names: ['Potion Shop'] },
  'lw-sahasrahla-hut':    { region: z3CanEnterLWNorthEast, names: ["Sahasrahla's Hut - Left", "Sahasrahla's Hut - Middle", "Sahasrahla's Hut - Right"] },
  'lw-sahasrahla-reward': { region: z3CanEnterLWNorthEast, names: ['Sahasrahla'] },

  // ---- LW NW groups ----
  'lw-pedestal':          { region: z3CanEnterLWNorthWest, names: ['Master Sword Pedestal'], visibleIf: (i,_st) => has(i, 'book') },
  'lw-mushroom':          { region: z3CanEnterLWNorthWest, names: ['Mushroom'] },
  'lw-lostwoods-hideout': { region: z3CanEnterLWNorthWest, names: ['Lost Woods Hideout'] },
  'lw-lumberjacks':       { region: z3CanEnterLWNorthWest, names: ['Lumberjack Tree'], visibleIf: (i,_st) => has(i, 'boots') },
  'lw-pegasus-rocks':     { region: z3CanEnterLWNorthWest, names: ['Pegasus Rocks'] },
  'lw-graveyard-ledge':   { region: z3CanEnterLWNorthWest, names: ['Graveyard Ledge'] },
  'lw-king-tomb':         { region: z3CanEnterLWNorthWest, names: ["King's Tomb"] },
  'lw-kakariko-well':     { region: z3CanEnterLWNorthWest, names: [
                            'Kakariko Well - Top', 'Kakariko Well - Left', 'Kakariko Well - Middle',
                            'Kakariko Well - Right', 'Kakariko Well - Bottom'] },
  'lw-blinds-hideout':    { region: z3CanEnterLWNorthWest, names: [
                            "Blind's Hideout - Top", "Blind's Hideout - Far Left", "Blind's Hideout - Left",
                            "Blind's Hideout - Right", "Blind's Hideout - Far Right"] },
  'lw-bottle-merchant':   { region: z3CanEnterLWNorthWest, names: ['Bottle Merchant'] },
  'lw-chicken-house':     { region: z3CanEnterLWNorthWest, names: ['Chicken House'] },
  'lw-sick-kid':          { region: z3CanEnterLWNorthWest, names: ['Sick Kid'] },
  'lw-kakariko-tavern':   { region: z3CanEnterLWNorthWest, names: ['Kakariko Tavern'] },
  'lw-magic-bat':         { region: z3CanEnterLWNorthWest, names: ['Magic Bat'] },

  // ---- LW South groups ----
  'lw-maze-race':         { region: z3CanEnterLWSouth, names: ['Maze Race'] },
  'lw-library':           { region: z3CanEnterLWSouth, names: ['Library'] },
  'lw-flute-spot':        { region: z3CanEnterLWSouth, names: ['Flute Spot'] },
  'lw-cave45':            { region: z3CanEnterLWSouth, names: ['South of Grove'] },
  'lw-links-house':       { region: z3CanEnterLWSouth, names: ["Link's House"] },
  'lw-aginah':            { region: z3CanEnterLWSouth, names: ["Aginah's Cave"] },
  'lw-mini-moldorm':      { region: z3CanEnterLWSouth, names: [
                            'Mini Moldorm Cave - Far Left', 'Mini Moldorm Cave - Left',
                            'Mini Moldorm Cave - NPC', 'Mini Moldorm Cave - Right',
                            'Mini Moldorm Cave - Far Right'] },
  'lw-desert-ledge':      { region: z3CanEnterLWSouth, names: ['Desert Ledge'] },
  'lw-checkerboard':      { region: z3CanEnterLWSouth, names: ['Checkerboard Cave'] },
  // Bombos Tablet — Book in your inventory technically lets you "read" the
  // tablet text, but you can't claim the item without Master Sword + Mirror
  // + DW South. Tightened from "just Book" to "Book + Mirror + DW South"
  // so VISIBLE means "one item away" rather than "merely identifiable."
  'lw-bombos-tablet':     { region: z3CanEnterLWSouth, names: ['Bombos Tablet'],
                            visibleIf: (i, st) => has(i, 'book') && has(i, 'mirror') &&
                                                  z3CanEnterDWSouth(i, st) },
  'lw-floodgate':         { region: z3CanEnterLWSouth, names: ['Floodgate Chest'] },
  'lw-sunken-treasure':   { region: z3CanEnterLWSouth, names: ['Sunken Treasure'] },
  // Lake Hylia Island — visible from across the water with no items
  // ("you can see the island, you just can't reach it yet").
  'lw-lake-hylia-island': { region: z3CanEnterLWSouth, names: ['Lake Hylia Island'],
                            visibleIf: (_i, _st) => true },
  // Hobo (under bridge) — fake-flipper / water-walk reaches with no items.
  'lw-hobo':              { region: z3CanEnterLWSouth, names: ['Hobo'],
                            hardIf: (_i, _st) => true },
  'lw-ice-rod-cave':      { region: z3CanEnterLWSouth, names: ['Ice Rod Cave'] },

  // Sanctuary-area / HC overworld pickups (NotInDungeon flagged in source)
  'lw-links-uncle':       { region: z3CanEnterLWNorthWest, names: ["Link's Uncle"] },
  'lw-secret-passage':    { region: z3CanEnterLWNorthWest, names: ['Secret Passage'] },

  // ---- LW DM West groups ----
  'lw-ether-tablet':       { region: z3CanEnterLWDMWest, names: ['Ether Tablet'],
                             visibleIf: (i,_st) => has(i, 'book') },
  'lw-spectacle-rock':     { region: z3CanEnterLWDMWest, names: ['Spectacle Rock'] },
  'lw-spectacle-rock-cave':{ region: z3CanEnterLWDMWest, names: ['Spectacle Rock Cave'] },
  'lw-old-man':            { region: z3CanEnterLWDMWest, names: ['Old Man'] },

  // ---- LW DM East groups ----
  'lw-floating-island':    { region: z3CanEnterLWDMEast, names: ['Floating Island'] },
  'lw-spiral-cave':        { region: z3CanEnterLWDMEast, names: ['Spiral Cave'] },
  'lw-paradox-cave':       { region: z3CanEnterLWDMEast, names: [
                             'Paradox Cave Upper - Left', 'Paradox Cave Upper - Right',
                             'Paradox Cave Lower - Far Left', 'Paradox Cave Lower - Left',
                             'Paradox Cave Lower - Middle', 'Paradox Cave Lower - Right',
                             'Paradox Cave Lower - Far Right'] },
  'lw-mimic-cave':         { region: z3CanEnterLWDMEast, names: ['Mimic Cave'] },

  // ---- DW Mire ----
  'dw-mire-shed':          { region: z3CanEnterDWMire, names: ['Mire Shed - Left', 'Mire Shed - Right'] },

  // ---- DW NE ----
  'dw-catfish':            { region: z3CanEnterDWNorthEast, names: ['Catfish'] },
  'dw-pyramid':            { region: z3CanEnterDWNorthEast, names: ['Pyramid'] },
  'dw-pyramid-fairy':      { region: z3CanEnterDWNorthEast, names: ['Pyramid Fairy - Left', 'Pyramid Fairy - Right'] },

  // ---- DW NW ----
  'dw-bumper-cave':        { region: z3CanEnterDWNorthWest, names: ['Bumper Cave'] },
  'dw-chest-game':         { region: z3CanEnterDWNorthWest, names: ['Chest Game'] },
  'dw-c-house':            { region: z3CanEnterDWNorthWest, names: ['C-Shaped House'] },
  'dw-brewery':            { region: z3CanEnterDWNorthWest, names: ['Brewery'] },
  'dw-hammer-peg':         { region: z3CanEnterDWNorthWest, names: ['Hammer Pegs'] },
  'dw-blacksmith':         { region: z3CanEnterDWNorthWest, names: ['Blacksmith'] },
  'dw-purple-chest':       { region: z3CanEnterDWNorthWest, names: ['Purple Chest'] },

  // ---- DW South ----
  'dw-digging-game':       { region: z3CanEnterDWSouth, names: ['Digging Game'] },
  'dw-stumpy':             { region: z3CanEnterDWSouth, names: ['Stumpy'] },
  'dw-hype-cave':          { region: z3CanEnterDWSouth, names: [
                             'Hype Cave - Top', 'Hype Cave - Middle Right', 'Hype Cave - Middle Left',
                             'Hype Cave - Bottom', 'Hype Cave - NPC'] },

  // ---- DW DM East ----
  'dw-hookshot-cave':      { region: z3CanEnterDWDMEast, names: [
                             'Hookshot Cave - Top Right', 'Hookshot Cave - Top Left',
                             'Hookshot Cave - Bottom Left', 'Hookshot Cave - Bottom Right'] },
  'dw-superbunny-cave':    { region: z3CanEnterDWDMEast, names: ['Superbunny Cave - Top', 'Superbunny Cave - Bottom'] },

  // ---- DW DM West ----
  'dw-spike-cave':         { region: () => true, names: ['Spike Cave'] },  // location has full gating
};

// Master overworld check
function z3OverworldCheck(id, items, st) {
  const group = Z3_TRACKER_GROUPS[id];
  if (!group) return STATE.UNAVAIL;
  // Region entry
  if (!group.region(items, st)) {
    // Hard-logic reachable from outside the normal region?
    if (group.hardIf && group.hardIf(items, st)) return STATE.GLITCHED;
    // Visible?
    if (group.visibleIf && group.visibleIf(items, st)) return STATE.VISIBLE;
    return STATE.UNAVAIL;
  }
  // Per-loc check (count reachable in group)
  let reachable = 0;
  for (const name of group.names) {
    const fn = Z3_OVERWORLD_BY_NAME[name];
    if (!fn) continue;
    if (fn(items, st)) reachable++;
  }
  if (reachable === group.names.length) return STATE.AVAILABLE;
  if (reachable > 0) return STATE.PARTIAL;
  // No chests reachable yet — try Hard-logic alternate first (yellow),
  // then Visible (peek hint), then UNAVAIL.
  if (group.hardIf && group.hardIf(items, st)) return STATE.GLITCHED;
  if (group.visibleIf && group.visibleIf(items, st)) return STATE.VISIBLE;
  return STATE.UNAVAIL;
}

// ===========================================================
// Dungeon entry & boss predicates (translated from each dungeon's CanEnter)
// ===========================================================

// EasternPalace — no CanEnter override (always reachable)
function z3CanEnterEasternPalace(_i, _st) { return true; }

// DesertPalace:
//   Book OR (Mirror + LiftHeavy + Flute) OR (MiseryMirePortal + Mirror)
function z3CanEnterDesertPalace(i) {
  return has(i, 'book') ||
         (has(i, 'mirror') && canLiftHeavy(i) && has(i, 'flute')) ||
         (_canAccessMiseryMirePortalZ3(i) && has(i, 'mirror'));
}

// TowerOfHera:
//   (Mirror OR (Hookshot + Hammer)) + LW DM West entry
function z3CanEnterTowerOfHera(i) {
  return (has(i, 'mirror') || (has(i, 'hookshot') && has(i, 'hammer'))) &&
         z3CanEnterLWDMWest(i);
}

// HyruleCastle (Sewers/HC) — no CanEnter override
function z3CanEnterHyruleCastle(_i, _st) { return true; }

// CastleTower (Agahnim 1):
//   CanKillManyEnemies + (Cape OR MasterSword)
function z3CanEnterCastleTower(i) {
  return canKillManyEnemies(i) && (has(i, 'cape') || _masterSword(i));
}

// PalaceOfDarkness:
//   MoonPearl + DW NE entry
function z3CanEnterPalaceOfDarkness(i, st) {
  return has(i, 'moonpearl') && z3CanEnterDWNorthEast(i, st);
}

// SwampPalace:
//   MoonPearl + Mirror + Flippers + DW South entry
function z3CanEnterSwampPalace(i, st) {
  return has(i, 'moonpearl') && has(i, 'mirror') && has(i, 'flippers') &&
         z3CanEnterDWSouth(i, st);
}

// SkullWoods:
//   MoonPearl + DW NW entry
function z3CanEnterSkullWoods(i, st) {
  return has(i, 'moonpearl') && z3CanEnterDWNorthWest(i, st);
}

// ThievesTown:
//   MoonPearl + DW NW entry
function z3CanEnterThievesTown(i, st) {
  return has(i, 'moonpearl') && z3CanEnterDWNorthWest(i, st);
}

// IcePalace:
//   MoonPearl + Flippers + LiftHeavy + canMeltFreezors
function z3CanEnterIcePalace(i, _st) {
  return has(i, 'moonpearl') && has(i, 'flippers') && canLiftHeavy(i) && canMeltFreezors(i);
}

// MiseryMire:
//   medallion + Sword + MoonPearl + (Boots OR Hookshot) + DW Mire entry
function z3CanEnterMiseryMire(i, st) {
  if (!_dungeonMedallionMet(st, 'mm', i)) return false;
  if ((i.sword || 0) < 1) return false;
  if (!has(i, 'moonpearl')) return false;
  if (!(has(i, 'boots') || has(i, 'hookshot'))) return false;
  return z3CanEnterDWMire(i);
}

// TurtleRock:
//   medallion + Sword + MoonPearl + LiftHeavy + Hammer + Somaria + LW DM East entry
function z3CanEnterTurtleRock(i, st) {
  if (!_dungeonMedallionMet(st, 'tr', i)) return false;
  if ((i.sword || 0) < 1) return false;
  if (!has(i, 'moonpearl')) return false;
  if (!canLiftHeavy(i)) return false;
  if (!has(i, 'hammer')) return false;
  if (!has(i, 'somaria')) return false;
  return z3CanEnterLWDMEast(i);
}

// GanonsTower:
//   MoonPearl + DW DM East entry + N crystals (depends on settings)
//   Default tower crystal requirement = 7 (vanilla SMZ3).
//   The "TourianBossTokens" / metroid token clause is for combined-randomizer rules;
//   we approximate by ignoring it.
function z3CanEnterGanonsTower(i, st) {
  if (!has(i, 'moonpearl')) return false;
  if (!z3CanEnterDWDMEast(i)) return false;
  return canAcquireAtLeastNCrystals(i, st, 7);
}

// Medallion check: matches state.dungeons[id].medallion to required item.
//   medallion code: 0=unknown, 1=bombos, 2=ether, 3=quake
function _dungeonMedallionMet(st, dungId, i) {
  const m = st && st.dungeons && st.dungeons[dungId] && st.dungeons[dungId].medallion;
  if (m === 1) return has(i, 'bombos');
  if (m === 2) return has(i, 'ether');
  if (m === 3) return has(i, 'quake');
  // Unknown medallion → require all three so the player can definitely fight in.
  return has(i, 'bombos') && has(i, 'ether') && has(i, 'quake');
}

// ===========================================================
// Per-dungeon chest+boss helpers
// ===========================================================
//
// Each function returns { chestsReachable, boss } where:
//   chestsReachable: number of chest checks reachable given current items
//                    (treating small keys & big keys as always satisfied —
//                    tracker doesn't model per-dungeon keys)
//   boss: STATE for the boss row (AVAILABLE / UNAVAIL)
//
// These functions assume entry has already been verified.

// =====================================================================
// Dungeon chest counters — "Option A" model (v26).
//
// We track the number of *unique random-item locations* in each dungeon,
// which is the items-tracker / streamer convention: map / compass / small-
// key / big-key chests are excluded because in non-keysanity those slots
// always hold their own non-random tracking items. The user manually
// decrements the counter as they collect items.
//
// Each helper returns:
//   { chestsReachable: <total>, boss: <state> }
// where chestsReachable is the dungeon's totalChests constant — the model
// is "if you can enter, you can find all N items as you progress through
// the dungeon normally, treating small/big keys as findable in order."
// The previous more-granular per-item gating produced inflated counts
// because many of the gated locations were map/compass/key chests.
//
// Boss state is still computed item-by-item per the canonical source so
// the boss square (top-right) lights up correctly when the player has
// the items needed to clear the boss.
// =====================================================================

// EP — 3 random-item locations: Cannonball Chest, Big Chest, and the Boss
// (Armos Knights) drop. The first two need only the dungeon's small/big
// keys (assumed satisfied since we don't track per-dungeon keys), but the
// boss drop genuinely requires Bow + Lantern. So when neither/either is
// missing, only 2/3 chests are reachable; with both, all 3 are.
function z3DungeonEP(i) {
  const canBeatBoss = anyBow(i) && has(i, 'lantern');
  const boss = canBeatBoss ? STATE.AVAILABLE : STATE.UNAVAIL;
  return { chestsReachable: canBeatBoss ? 3 : 2, boss };
}

// DP — 2 random-item locations: Big Chest, Lanmolas (boss).
// Boss needs ((LiftLight OR (Mire portal + Mirror)) + canLightTorches + weapon).
function z3DungeonDP(i) {
  const lanmolasReach = canLiftLight(i) || (_canAccessMiseryMirePortalZ3(i) && has(i, 'mirror'));
  const canBeat = (i.sword || 0) >= 1 || has(i, 'hammer') || anyBow(i) ||
                  has(i, 'firerod') || has(i, 'icerod') || has(i, 'byrna') || has(i, 'somaria');
  const canBeatBoss = lanmolasReach && canLightTorches(i) && canBeat;
  const boss = canBeatBoss ? STATE.AVAILABLE : STATE.UNAVAIL;
  return { chestsReachable: canBeatBoss ? 2 : 1, boss };
}

// ToH — 2 locations: Big Chest, Moldorm. Boss needs sword OR hammer.
function z3DungeonTOH(i) {
  const canBeatBoss = (i.sword || 0) >= 1 || has(i, 'hammer');
  const boss = canBeatBoss ? STATE.AVAILABLE : STATE.UNAVAIL;
  return { chestsReachable: canBeatBoss ? 2 : 1, boss };
}

// HC — no real boss drop; the 6 random-item locations don't depend on
// any single item gate beyond entry. Report all 6 reachable on entry,
// and report boss as AVAILABLE so the cell renders cleanly.
function z3DungeonHC(_i) {
  return { chestsReachable: 6, boss: STATE.AVAILABLE };
}

// AT — boss-only (Castle Tower); see registry totalChests: 0
function z3DungeonAT(i) {
  const boss = (has(i, 'lantern') && (i.sword || 0) >= 1) ? STATE.AVAILABLE : STATE.UNAVAIL;
  return { chestsReachable: 0, boss };
}

// PoD — 5 locations: 4 chests + Helmasaur boss. Boss needs Lamp + Hammer + Bow.
function z3DungeonPOD(i) {
  const canBeatBoss = has(i, 'lantern') && has(i, 'hammer') && anyBow(i);
  const boss = canBeatBoss ? STATE.AVAILABLE : STATE.UNAVAIL;
  return { chestsReachable: canBeatBoss ? 5 : 4, boss };
}

// SP — 6 locations: 5 chests + Arrghus boss. Boss needs Hammer + Hookshot.
function z3DungeonSP(i) {
  const canBeatBoss = has(i, 'hammer') && has(i, 'hookshot');
  const boss = canBeatBoss ? STATE.AVAILABLE : STATE.UNAVAIL;
  return { chestsReachable: canBeatBoss ? 6 : 5, boss };
}

// SW — 2 locations: Big Chest + Mothula. Boss needs Fire Rod + Sword.
function z3DungeonSW(i) {
  const canBeatBoss = has(i, 'firerod') && (i.sword || 0) >= 1;
  const boss = canBeatBoss ? STATE.AVAILABLE : STATE.UNAVAIL;
  return { chestsReachable: canBeatBoss ? 2 : 1, boss };
}

// TT — 4 locations: 3 chests + Blind. Boss needs (sword OR hammer OR somaria OR byrna).
function z3DungeonTT(i) {
  const canBeatBoss = (i.sword || 0) >= 1 || has(i, 'hammer') ||
                      has(i, 'somaria') || has(i, 'byrna');
  const boss = canBeatBoss ? STATE.AVAILABLE : STATE.UNAVAIL;
  return { chestsReachable: canBeatBoss ? 4 : 3, boss };
}

// IP — 3 locations: Big Chest, Iced T, Kholdstare. Boss needs Hammer + LiftLight.
function z3DungeonIP(i) {
  const canBeatBoss = has(i, 'hammer') && canLiftLight(i);
  const boss = canBeatBoss ? STATE.AVAILABLE : STATE.UNAVAIL;
  return { chestsReachable: canBeatBoss ? 3 : 2, boss };
}

// MM — 2 locations: Big Chest + Vitreous. Boss needs Lamp + Somaria.
function z3DungeonMM(i) {
  const canBeatBoss = has(i, 'lantern') && has(i, 'somaria');
  const boss = canBeatBoss ? STATE.AVAILABLE : STATE.UNAVAIL;
  return { chestsReachable: canBeatBoss ? 2 : 1, boss };
}

// TR — 5 locations: 4 chests + Trinexx. Boss needs Lamp + Fire Rod + Ice Rod.
function z3DungeonTR(i) {
  const canBeatBoss = has(i, 'lantern') && has(i, 'firerod') && has(i, 'icerod');
  const boss = canBeatBoss ? STATE.AVAILABLE : STATE.UNAVAIL;
  return { chestsReachable: canBeatBoss ? 5 : 4, boss };
}

// GT — 20 locations including the Moldorm-2 boss at the top.
// Boss needs Bow + canLightTorches + Hookshot + (Sword OR Hammer).
function z3DungeonGT(i) {
  const canBeatMoldorm = (i.sword || 0) >= 1 || has(i, 'hammer');
  const canBeatBoss = anyBow(i) && canLightTorches(i) && has(i, 'hookshot') && canBeatMoldorm;
  const boss = canBeatBoss ? STATE.AVAILABLE : STATE.UNAVAIL;
  return { chestsReachable: canBeatBoss ? 20 : 19, boss };
}

// ===========================================================
// Z3 dungeon registry — used to replace the existing DUNGEONS
// ===========================================================

const Z3_DUNGEONS_NEW = {
  ep: { name: 'Eastern Palace',     region: 'Light World', totalChests: 3,
        entry: z3CanEnterEasternPalace, run: z3DungeonEP, hasMedallion: false },
  dp: { name: 'Desert Palace',      region: 'Light World', totalChests: 2,
        entry: z3CanEnterDesertPalace, run: z3DungeonDP, hasMedallion: false },
  toh:{ name: 'Tower of Hera',      region: 'Light World', totalChests: 2,
        entry: z3CanEnterTowerOfHera, run: z3DungeonTOH, hasMedallion: false },
  hc: { name: 'Hyrule Castle',      region: 'Light World', totalChests: 6,
        entry: z3CanEnterHyruleCastle, run: z3DungeonHC, hasMedallion: false },
  at: { name: 'Castle Tower',       region: 'Light World', totalChests: 0,
        entry: z3CanEnterCastleTower, run: z3DungeonAT, hasMedallion: false },
  pod:{ name: 'Palace of Darkness', region: 'Dark World',  totalChests: 5,
        entry: z3CanEnterPalaceOfDarkness, run: z3DungeonPOD, hasMedallion: false },
  sp: { name: 'Swamp Palace',       region: 'Dark World',  totalChests: 6,
        entry: z3CanEnterSwampPalace, run: z3DungeonSP, hasMedallion: false },
  sw: { name: 'Skull Woods',        region: 'Dark World',  totalChests: 2,
        entry: z3CanEnterSkullWoods, run: z3DungeonSW, hasMedallion: false },
  tt: { name: "Thieves' Town",      region: 'Dark World',  totalChests: 4,
        entry: z3CanEnterThievesTown, run: z3DungeonTT, hasMedallion: false },
  ip: { name: 'Ice Palace',         region: 'Dark World',  totalChests: 3,
        entry: z3CanEnterIcePalace, run: z3DungeonIP, hasMedallion: false },
  mm: { name: 'Misery Mire',        region: 'Dark World',  totalChests: 2,
        entry: z3CanEnterMiseryMire, run: z3DungeonMM, hasMedallion: true },
  tr: { name: 'Turtle Rock',        region: 'Dark World',  totalChests: 5,
        entry: z3CanEnterTurtleRock, run: z3DungeonTR, hasMedallion: true },
  gt: { name: "Ganon's Tower",      region: 'Dark World',  totalChests: 20,
        entry: z3CanEnterGanonsTower, run: z3DungeonGT, hasMedallion: false },
};

// Runtime state stash so logic functions can read st.dungeons.* prize/medallion
// data without the tracker having to thread `state` into every check call.
// tracker.js calls SMZ3Logic.setRuntimeState(state) before each render.
let _z3RuntimeState = { dungeons: {}, items: {} };
function setZ3RuntimeState(s) { _z3RuntimeState = s || { dungeons: {}, items: {} }; }

// Build the DUNGEONS object that the rest of the tracker expects.
// Returns objects with the same shape as the previous DUNGEONS:
//   { name, region, totalChests, hasMedallion, check(items, chestsRemaining, medallion) }
function buildZ3DungeonsRegistry() {
  const out = {};
  for (const [id, cfg] of Object.entries(Z3_DUNGEONS_NEW)) {
    out[id] = {
      name: cfg.name,
      region: cfg.region,
      totalChests: cfg.totalChests,
      hasMedallion: cfg.hasMedallion,
      check(items, chestsRemaining, _medallion) {
        // Use the runtime state stash for prize/medallion lookups. The
        // tracker.js call site passes only (items, chests, medallion); the
        // medallion arg is unused here because we read it from the state
        // dungeon entry directly inside _dungeonMedallionMet.
        const st = _z3RuntimeState;
        const entry = cfg.entry(items, st);
        if (!entry) {
          return { entry: false, chests: STATE.UNAVAIL, boss: STATE.UNAVAIL };
        }
        const result = cfg.run(items, st);
        let chestsReachable = result.chestsReachable;
        if (chestsReachable > cfg.totalChests) chestsReachable = cfg.totalChests;
        return dungeonResult(entry, chestsReachable, chestsRemaining, result.boss);
      },
    };
  }
  return out;
}

/* =============================================================
   DUNGEONS — built from the canonical port. Same shape as the
   previous hand-rolled DUNGEONS object so the rest of the
   tracker (chest tap-counter, boss row, prize selector) keeps
   working unchanged.

   Per-dungeon chest counts treat small/big keys as always
   satisfied. The tracker doesn't model per-dungeon key state
   and asking the player to is bad UX; the resulting "what's
   reachable" view assumes you progress through the dungeon
   normally and find keys as you go.
   ============================================================= */

const DUNGEONS = buildZ3DungeonsRegistry();

/* -------------------------------------------------------------
   Overworld / standalone locations
   ------------------------------------------------------------- */

const LOCATIONS = [
  /* ---- Light World (ported from tewtal/SMZ3Randomizer LightWorld/*.cs) ---- */
  { id: 'lw-pedestal', region: 'Light World', name: 'Master Sword Pedestal',
    check: (i, st) => z3OverworldCheck('lw-pedestal', i, st) },
  { id: 'lw-mushroom', region: 'Light World', name: 'Mushroom (Lost Woods)',
    check: (i, st) => z3OverworldCheck('lw-mushroom', i, st) },
  { id: 'lw-lostwoods-hideout', region: 'Light World', name: 'Lost Woods Hideout',
    check: (i, st) => z3OverworldCheck('lw-lostwoods-hideout', i, st) },
  { id: 'lw-lumberjacks', region: 'Light World', name: 'Lumberjacks Tree',
    check: (i, st) => z3OverworldCheck('lw-lumberjacks', i, st) },
  { id: 'lw-king-tomb', region: 'Light World', name: "King's Tomb",
    check: (i, st) => z3OverworldCheck('lw-king-tomb', i, st) },
  { id: 'lw-kakariko-well', region: 'Light World', name: 'Kakariko Well',
    check: (i, st) => z3OverworldCheck('lw-kakariko-well', i, st) },
  { id: 'lw-blinds-hideout', region: 'Light World', name: "Blind's Hideout",
    check: (i, st) => z3OverworldCheck('lw-blinds-hideout', i, st) },
  { id: 'lw-bottle-merchant', region: 'Light World', name: 'Bottle Merchant',
    check: (i, st) => z3OverworldCheck('lw-bottle-merchant', i, st) },
  { id: 'lw-chicken-house', region: 'Light World', name: 'Chicken House',
    check: (i, st) => z3OverworldCheck('lw-chicken-house', i, st) },
  { id: 'lw-sick-kid', region: 'Light World', name: 'Sick Kid',
    check: (i, st) => z3OverworldCheck('lw-sick-kid', i, st) },
  { id: 'lw-library', region: 'Light World', name: 'Library',
    check: (i, st) => z3OverworldCheck('lw-library', i, st) },
  { id: 'lw-kakariko-tavern', region: 'Light World', name: 'Kakariko Tavern',
    check: (i, st) => z3OverworldCheck('lw-kakariko-tavern', i, st) },
  { id: 'lw-maze-race', region: 'Light World', name: 'Maze Race',
    check: (i, st) => z3OverworldCheck('lw-maze-race', i, st) },
  { id: 'lw-cave45', region: 'Light World', name: 'Cave 45',
    check: (i, st) => z3OverworldCheck('lw-cave45', i, st) },
  { id: 'lw-checkerboard', region: 'Light World', name: 'Checkerboard Cave',
    check: (i, st) => z3OverworldCheck('lw-checkerboard', i, st) },
  { id: 'lw-aginah', region: 'Light World', name: "Aginah's Cave",
    check: (i, st) => z3OverworldCheck('lw-aginah', i, st) },
  { id: 'lw-desert-ledge', region: 'Light World', name: 'Desert Ledge',
    check: (i, st) => z3OverworldCheck('lw-desert-ledge', i, st) },
  { id: 'lw-lake-hylia-island', region: 'Light World', name: 'Lake Hylia Island',
    check: (i, st) => z3OverworldCheck('lw-lake-hylia-island', i, st) },
  { id: 'lw-sunken-treasure', region: 'Light World', name: 'Sunken Treasure',
    check: (i, st) => z3OverworldCheck('lw-sunken-treasure', i, st) },
  { id: 'lw-flute-spot', region: 'Light World', name: 'Flute Spot (Ocarina)',
    check: (i, st) => z3OverworldCheck('lw-flute-spot', i, st) },
  { id: 'lw-waterfall-fairy', region: 'Light World', name: 'Waterfall Fairy',
    check: (i, st) => z3OverworldCheck('lw-waterfall-fairy', i, st) },
  { id: 'lw-zora', region: 'Light World', name: "Zora's Ledge",
    check: (i, st) => z3OverworldCheck('lw-zora', i, st) },
  { id: 'lw-mimic-cave', region: 'Light World', name: 'Mimic Cave',
    check: (i, st) => z3OverworldCheck('lw-mimic-cave', i, st) },
  { id: 'lw-spectacle-rock', region: 'Light World', name: 'Spectacle Rock',
    check: (i, st) => z3OverworldCheck('lw-spectacle-rock', i, st) },
  { id: 'lw-spectacle-rock-cave', region: 'Light World', name: 'Spectacle Rock Cave',
    check: (i, st) => z3OverworldCheck('lw-spectacle-rock-cave', i, st) },
  { id: 'lw-old-man', region: 'Light World', name: 'Old Man',
    check: (i, st) => z3OverworldCheck('lw-old-man', i, st) },
  { id: 'lw-ether-tablet', region: 'Light World', name: 'Ether Tablet',
    check: (i, st) => z3OverworldCheck('lw-ether-tablet', i, st) },
  { id: 'lw-bombos-tablet', region: 'Light World', name: 'Bombos Tablet',
    check: (i, st) => z3OverworldCheck('lw-bombos-tablet', i, st) },
  { id: 'lw-floating-island', region: 'Light World', name: 'Floating Island',
    check: (i, st) => z3OverworldCheck('lw-floating-island', i, st) },
  { id: 'lw-spiral-cave', region: 'Light World', name: 'Spiral Cave',
    check: (i, st) => z3OverworldCheck('lw-spiral-cave', i, st) },
  { id: 'lw-paradox-cave', region: 'Light World', name: 'Paradox Cave (upper + lower)',
    check: (i, st) => z3OverworldCheck('lw-paradox-cave', i, st) },
  { id: 'lw-mini-moldorm', region: 'Light World', name: 'Mini-Moldorm Cave',
    check: (i, st) => z3OverworldCheck('lw-mini-moldorm', i, st) },
  { id: 'lw-ice-rod-cave', region: 'Light World', name: 'Ice Rod Cave',
    check: (i, st) => z3OverworldCheck('lw-ice-rod-cave', i, st) },
  { id: 'lw-sahasrahla-reward', region: 'Light World', name: "Sahasrahla's Reward",
    check: (i, st) => z3OverworldCheck('lw-sahasrahla-reward', i, st) },
  { id: 'lw-sahasrahla-hut', region: 'Light World', name: "Sahasrahla's Hut",
    check: (i, st) => z3OverworldCheck('lw-sahasrahla-hut', i, st) },
  { id: 'lw-links-uncle', region: 'Light World', name: "Link's Uncle",
    check: (i, st) => z3OverworldCheck('lw-links-uncle', i, st) },
  { id: 'lw-secret-passage', region: 'Light World', name: 'Secret Passage',
    check: (i, st) => z3OverworldCheck('lw-secret-passage', i, st) },
  { id: 'lw-links-house', region: 'Light World', name: "Link's House",
    check: (i, st) => z3OverworldCheck('lw-links-house', i, st) },
  { id: 'lw-graveyard-ledge', region: 'Light World', name: 'Graveyard Ledge',
    check: (i, st) => z3OverworldCheck('lw-graveyard-ledge', i, st) },
  { id: 'lw-pegasus-rocks', region: 'Light World', name: 'Pegasus Rocks',
    check: (i, st) => z3OverworldCheck('lw-pegasus-rocks', i, st) },
  { id: 'lw-king-zora', region: 'Light World', name: 'King Zora',
    check: (i, st) => z3OverworldCheck('lw-king-zora', i, st) },
  { id: 'lw-potion-shop', region: 'Light World', name: 'Potion Shop',
    check: (i, st) => z3OverworldCheck('lw-potion-shop', i, st) },
  { id: 'lw-magic-bat', region: 'Light World', name: 'Magic Bat',
    check: (i, st) => z3OverworldCheck('lw-magic-bat', i, st) },
  { id: 'lw-floodgate', region: 'Light World', name: 'Floodgate Chest',
    check: (i, st) => z3OverworldCheck('lw-floodgate', i, st) },
  { id: 'lw-hobo', region: 'Light World', name: 'Hobo (under bridge)',
    check: (i, st) => z3OverworldCheck('lw-hobo', i, st) },

  /* ---- Dark World (ported from tewtal/SMZ3Randomizer DarkWorld/*.cs) ---- */
  { id: 'dw-pyramid-fairy', region: 'Dark World', name: 'Pyramid Fairy',
    check: (i, st) => z3OverworldCheck('dw-pyramid-fairy', i, st) },
  { id: 'dw-catfish', region: 'Dark World', name: 'Catfish',
    check: (i, st) => z3OverworldCheck('dw-catfish', i, st) },
  { id: 'dw-pyramid', region: 'Dark World', name: 'Pyramid (ledge)',
    check: (i, st) => z3OverworldCheck('dw-pyramid', i, st) },
  { id: 'dw-digging-game', region: 'Dark World', name: 'Digging Game',
    check: (i, st) => z3OverworldCheck('dw-digging-game', i, st) },
  { id: 'dw-stumpy', region: 'Dark World', name: 'Stumpy',
    check: (i, st) => z3OverworldCheck('dw-stumpy', i, st) },
  { id: 'dw-hype-cave', region: 'Dark World', name: 'Hype Cave',
    check: (i, st) => z3OverworldCheck('dw-hype-cave', i, st) },
  { id: 'dw-bumper-cave', region: 'Dark World', name: 'Bumper Cave',
    check: (i, st) => z3OverworldCheck('dw-bumper-cave', i, st) },
  { id: 'dw-chest-game', region: 'Dark World', name: 'Chest Game',
    check: (i, st) => z3OverworldCheck('dw-chest-game', i, st) },
  { id: 'dw-brewery', region: 'Dark World', name: 'Brewery',
    check: (i, st) => z3OverworldCheck('dw-brewery', i, st) },
  { id: 'dw-c-house', region: 'Dark World', name: 'C-House',
    check: (i, st) => z3OverworldCheck('dw-c-house', i, st) },
  { id: 'dw-hammer-peg', region: 'Dark World', name: 'Hammer Pegs Cave',
    check: (i, st) => z3OverworldCheck('dw-hammer-peg', i, st) },
  { id: 'dw-purple-chest', region: 'Dark World', name: 'Purple Chest (trade)',
    check: (i, st) => z3OverworldCheck('dw-purple-chest', i, st) },
  { id: 'dw-blacksmith', region: 'Dark World', name: 'Blacksmith',
    check: (i, st) => z3OverworldCheck('dw-blacksmith', i, st) },
  { id: 'dw-mire-shed', region: 'Dark World', name: 'Mire Shed',
    check: (i, st) => z3OverworldCheck('dw-mire-shed', i, st) },
  { id: 'dw-hookshot-cave', region: 'Dark World', name: 'Hookshot Cave',
    check: (i, st) => z3OverworldCheck('dw-hookshot-cave', i, st) },
  { id: 'dw-superbunny-cave', region: 'Dark World', name: 'Superbunny Cave',
    check: (i, st) => z3OverworldCheck('dw-superbunny-cave', i, st) },
  { id: 'dw-spike-cave', region: 'Dark World', name: 'Byrna Spike Cave',
    check: (i, st) => z3OverworldCheck('dw-spike-cave', i, st) },


  /* ====================================================
     Super Metroid — 100 individual checks
     IDs match the calibrator (sm-bri-NN, sm-crt-NN, etc.)
     Region tagged 'Super Metroid' so the map renderer
     knows to draw markers on the SM map.
     ====================================================*/

  // ----- Brinstar (1-31) -----
  { id: 'sm-bri-01', region: 'Super Metroid', name: 'Super Missile (green Brinstar top)',
    check: (i) => smCheck('sm-bri-01', 'Super Missile (green Brinstar top)', i) },
  { id: 'sm-bri-02', region: 'Super Metroid', name: 'Missile (green Brinstar below super missile)',
    check: (i) => smCheck('sm-bri-02', 'Missile (green Brinstar below super missile)', i) },
  { id: 'sm-bri-03', region: 'Super Metroid', name: 'Reserve Tank, Brinstar',
    check: (i) => smCheck('sm-bri-03', 'Reserve Tank, Brinstar', i) },
  { id: 'sm-bri-04', region: 'Super Metroid', name: 'Missile (green Brinstar behind reserve tank)',
    check: (i) => smCheck('sm-bri-04', 'Missile (green Brinstar behind reserve tank)', i) },
  { id: 'sm-bri-05', region: 'Super Metroid', name: 'Missile (green Brinstar behind missile)',
    check: (i) => smCheck('sm-bri-05', 'Missile (green Brinstar behind missile)', i) },
  { id: 'sm-bri-06', region: 'Super Metroid', name: 'Missile (pink Brinstar top)',
    check: (i) => smCheck('sm-bri-06', 'Missile (pink Brinstar top)', i) },
  { id: 'sm-bri-07', region: 'Super Metroid', name: 'Power Bomb (green Brinstar bottom)',
    check: (i) => smCheck('sm-bri-07', 'Power Bomb (green Brinstar bottom)', i) },
  { id: 'sm-bri-08', region: 'Super Metroid', name: 'Power Bomb (pink Brinstar)',
    check: (i) => smCheck('sm-bri-08', 'Power Bomb (pink Brinstar)', i) },
  { id: 'sm-bri-09', region: 'Super Metroid', name: 'Energy Tank, Brinstar Gate',
    check: (i) => smCheck('sm-bri-09', 'Energy Tank, Brinstar Gate', i) },
  { id: 'sm-bri-10', region: 'Super Metroid', name: 'Super Missile (green Brinstar bottom)',
    check: (i) => smCheck('sm-bri-10', 'Super Missile (green Brinstar bottom)', i) },
  { id: 'sm-bri-11', region: 'Super Metroid', name: 'Energy Tank, Etecoons',
    check: (i) => smCheck('sm-bri-11', 'Energy Tank, Etecoons', i) },
  { id: 'sm-bri-12', region: 'Super Metroid', name: 'Missile (pink Brinstar bottom)',
    check: (i) => smCheck('sm-bri-12', 'Missile (pink Brinstar bottom)', i) },
  { id: 'sm-bri-13', region: 'Super Metroid', name: 'Charge Beam',
    check: (i) => smCheck('sm-bri-13', 'Charge Beam', i) },
  { id: 'sm-bri-14', region: 'Super Metroid', name: 'Super Missile (pink Brinstar)',
    check: (i) => smCheck('sm-bri-14', 'Super Missile (pink Brinstar)', i) },
  { id: 'sm-bri-15', region: 'Super Metroid', name: 'Power Bomb (blue Brinstar)',
    check: (i) => smCheck('sm-bri-15', 'Power Bomb (blue Brinstar)', i) },
  { id: 'sm-bri-16', region: 'Super Metroid', name: 'Morphing Ball',
    check: (i) => smCheck('sm-bri-16', 'Morphing Ball', i) },
  { id: 'sm-bri-17', region: 'Super Metroid', name: 'Missile (green Brinstar pipe)',
    check: (i) => smCheck('sm-bri-17', 'Missile (green Brinstar pipe)', i) },
  { id: 'sm-bri-18', region: 'Super Metroid', name: 'Missile (blue Brinstar bottom)',
    check: (i) => smCheck('sm-bri-18', 'Missile (blue Brinstar bottom)', i) },
  { id: 'sm-bri-19', region: 'Super Metroid', name: 'Missile (blue Brinstar behind missile)',
    check: (i) => smCheck('sm-bri-19', 'Missile (blue Brinstar behind missile)', i) },
  { id: 'sm-bri-20', region: 'Super Metroid', name: 'Missile (blue Brinstar top)',
    check: (i) => smCheck('sm-bri-20', 'Missile (blue Brinstar top)', i) },
  { id: 'sm-bri-21', region: 'Super Metroid', name: 'Energy Tank, Brinstar Ceiling',
    check: (i) => smCheck('sm-bri-21', 'Energy Tank, Brinstar Ceiling', i) },
  { id: 'sm-bri-22', region: 'Super Metroid', name: 'Missile (blue Brinstar middle)',
    check: (i) => smCheck('sm-bri-22', 'Missile (blue Brinstar middle)', i) },
  { id: 'sm-bri-23', region: 'Super Metroid', name: 'Power Bomb (red Brinstar sidehopper room)',
    check: (i) => smCheck('sm-bri-23', 'Power Bomb (red Brinstar sidehopper room)', i) },
  { id: 'sm-bri-24', region: 'Super Metroid', name: 'Missile (red Brinstar spike room)',
    check: (i) => smCheck('sm-bri-24', 'Missile (red Brinstar spike room)', i) },
  { id: 'sm-bri-25', region: 'Super Metroid', name: 'Power Bomb (red Brinstar spike room)',
    check: (i) => smCheck('sm-bri-25', 'Power Bomb (red Brinstar spike room)', i) },
  { id: 'sm-bri-26', region: 'Super Metroid', name: 'Energy Tank, Waterway',
    check: (i) => smCheck('sm-bri-26', 'Energy Tank, Waterway', i) },
  { id: 'sm-bri-27', region: 'Super Metroid', name: 'X-Ray Scope',
    check: (i) => smCheck('sm-bri-27', 'X-Ray Scope', i) },
  { id: 'sm-bri-28', region: 'Super Metroid', name: 'Spazer',
    check: (i) => smCheck('sm-bri-28', 'Spazer', i) },
  { id: 'sm-bri-29', region: 'Super Metroid', name: 'Missile (Kraid)',
    check: (i) => smCheck('sm-bri-29', 'Missile (Kraid)', i) },
  { id: 'sm-bri-30', region: 'Super Metroid', name: 'Energy Tank, Kraid',
    check: (i) => smCheck('sm-bri-30', 'Energy Tank, Kraid', i) },
  { id: 'sm-bri-31', region: 'Super Metroid', name: 'Varia Suit',
    check: (i) => smCheck('sm-bri-31', 'Varia Suit', i) },

  // ----- Crateria (32-44) -----
  { id: 'sm-crt-32', region: 'Super Metroid', name: 'Missile (Crateria gauntlet left)',
    check: (i) => smCheck('sm-crt-32', 'Missile (Crateria gauntlet left)', i) },
  { id: 'sm-crt-33', region: 'Super Metroid', name: 'Missile (Crateria gauntlet right)',
    check: (i) => smCheck('sm-crt-33', 'Missile (Crateria gauntlet right)', i) },
  { id: 'sm-crt-34', region: 'Super Metroid', name: 'Energy Tank, Gauntlet',
    check: (i) => smCheck('sm-crt-34', 'Energy Tank, Gauntlet', i) },
  { id: 'sm-crt-35', region: 'Super Metroid', name: 'Power Bomb (Crateria surface)',
    check: (i) => smCheck('sm-crt-35', 'Power Bomb (Crateria surface)', i) },
  { id: 'sm-crt-36', region: 'Super Metroid', name: 'Missile (Crateria moat)',
    check: (i) => smCheck('sm-crt-36', 'Missile (Crateria moat)', i) },
  { id: 'sm-crt-37', region: 'Super Metroid', name: 'Missile (outside Wrecked Ship bottom)',
    check: (i) => smCheck('sm-crt-37', 'Missile (outside Wrecked Ship bottom)', i) },
  { id: 'sm-crt-38', region: 'Super Metroid', name: 'Missile (outside Wrecked Ship middle)',
    check: (i) => smCheck('sm-crt-38', 'Missile (outside Wrecked Ship middle)', i) },
  { id: 'sm-crt-39', region: 'Super Metroid', name: 'Missile (outside Wrecked Ship top)',
    check: (i) => smCheck('sm-crt-39', 'Missile (outside Wrecked Ship top)', i) },
  { id: 'sm-crt-40', region: 'Super Metroid', name: 'Energy Tank, Terminator',
    check: (i) => smCheck('sm-crt-40', 'Energy Tank, Terminator', i) },
  { id: 'sm-crt-41', region: 'Super Metroid', name: 'Missile (Crateria middle)',
    check: (i) => smCheck('sm-crt-41', 'Missile (Crateria middle)', i) },
  { id: 'sm-crt-42', region: 'Super Metroid', name: 'Bombs',
    check: (i) => smCheck('sm-crt-42', 'Bombs', i) },
  { id: 'sm-crt-43', region: 'Super Metroid', name: 'Super Missile (Crateria)',
    check: (i) => smCheck('sm-crt-43', 'Super Missile (Crateria)', i) },
  { id: 'sm-crt-44', region: 'Super Metroid', name: 'Missile (Crateria bottom)',
    check: (i) => smCheck('sm-crt-44', 'Missile (Crateria bottom)', i) },

  // ----- Wrecked Ship (45-52) -----
  { id: 'sm-ws-45', region: 'Super Metroid', name: 'Missile (Wrecked Ship top)',
    check: (i) => smCheck('sm-ws-45', 'Missile (Wrecked Ship top)', i) },
  { id: 'sm-ws-46', region: 'Super Metroid', name: 'Reserve Tank, Wrecked Ship',
    check: (i) => smCheck('sm-ws-46', 'Reserve Tank, Wrecked Ship', i) },
  { id: 'sm-ws-47', region: 'Super Metroid', name: 'Gravity Suit',
    check: (i) => smCheck('sm-ws-47', 'Gravity Suit', i) },
  { id: 'sm-ws-48', region: 'Super Metroid', name: 'Missile (Gravity Suit)',
    check: (i) => smCheck('sm-ws-48', 'Missile (Gravity Suit)', i) },
  { id: 'sm-ws-49', region: 'Super Metroid', name: 'Energy Tank, Wrecked Ship',
    check: (i) => smCheck('sm-ws-49', 'Energy Tank, Wrecked Ship', i) },
  { id: 'sm-ws-50', region: 'Super Metroid', name: 'Missile (Wrecked Ship middle)',
    check: (i) => smCheck('sm-ws-50', 'Missile (Wrecked Ship middle)', i) },
  { id: 'sm-ws-51', region: 'Super Metroid', name: 'Super Missile (Wrecked Ship left)',
    check: (i) => smCheck('sm-ws-51', 'Super Missile (Wrecked Ship left)', i) },
  { id: 'sm-ws-52', region: 'Super Metroid', name: 'Right Super, Wrecked Ship',
    check: (i) => smCheck('sm-ws-52', 'Right Super, Wrecked Ship', i) },

  // ----- Maridia (53-70) -----
  { id: 'sm-mar-53', region: 'Super Metroid', name: 'Plasma Beam',
    check: (i) => smCheck('sm-mar-53', 'Plasma Beam', i) },
  { id: 'sm-mar-54', region: 'Super Metroid', name: 'Super Missile (yellow Maridia)',
    check: (i) => smCheck('sm-mar-54', 'Super Missile (yellow Maridia)', i) },
  { id: 'sm-mar-55', region: 'Super Metroid', name: 'Missile (yellow Maridia super missile)',
    check: (i) => smCheck('sm-mar-55', 'Missile (yellow Maridia super missile)', i) },
  { id: 'sm-mar-56', region: 'Super Metroid', name: 'Missile (yellow Maridia false wall)',
    check: (i) => smCheck('sm-mar-56', 'Missile (yellow Maridia false wall)', i) },
  { id: 'sm-mar-57', region: 'Super Metroid', name: 'Missile (Draygon)',
    check: (i) => smCheck('sm-mar-57', 'Missile (Draygon)', i) },
  { id: 'sm-mar-58', region: 'Super Metroid', name: 'Missile (pink Maridia)',
    check: (i) => smCheck('sm-mar-58', 'Missile (pink Maridia)', i) },
  { id: 'sm-mar-59', region: 'Super Metroid', name: 'Super Missile (pink Maridia)',
    check: (i) => smCheck('sm-mar-59', 'Super Missile (pink Maridia)', i) },
  { id: 'sm-mar-60', region: 'Super Metroid', name: 'Energy Tank, Botwoon',
    check: (i) => smCheck('sm-mar-60', 'Energy Tank, Botwoon', i) },
  { id: 'sm-mar-61', region: 'Super Metroid', name: 'Space Jump',
    check: (i) => smCheck('sm-mar-61', 'Space Jump', i) },
  { id: 'sm-mar-62', region: 'Super Metroid', name: 'Super Missile (green Maridia)',
    check: (i) => smCheck('sm-mar-62', 'Super Missile (green Maridia)', i) },
  { id: 'sm-mar-63', region: 'Super Metroid', name: 'Missile (green Maridia shinespark)',
    check: (i) => smCheck('sm-mar-63', 'Missile (green Maridia shinespark)', i) },
  { id: 'sm-mar-64', region: 'Super Metroid', name: 'Energy Tank, Mama turtle',
    check: (i) => smCheck('sm-mar-64', 'Energy Tank, Mama turtle', i) },
  { id: 'sm-mar-65', region: 'Super Metroid', name: 'Missile (green Maridia tatori)',
    check: (i) => smCheck('sm-mar-65', 'Missile (green Maridia tatori)', i) },
  { id: 'sm-mar-66', region: 'Super Metroid', name: 'Missile (left Maridia sand pit room)',
    check: (i) => smCheck('sm-mar-66', 'Missile (left Maridia sand pit room)', i) },
  { id: 'sm-mar-67', region: 'Super Metroid', name: 'Reserve Tank, Maridia',
    check: (i) => smCheck('sm-mar-67', 'Reserve Tank, Maridia', i) },
  { id: 'sm-mar-68', region: 'Super Metroid', name: 'Missile (right Maridia sand pit room)',
    check: (i) => smCheck('sm-mar-68', 'Missile (right Maridia sand pit room)', i) },
  { id: 'sm-mar-69', region: 'Super Metroid', name: 'Power Bomb (right Maridia sand pit room)',
    check: (i) => smCheck('sm-mar-69', 'Power Bomb (right Maridia sand pit room)', i) },
  { id: 'sm-mar-70', region: 'Super Metroid', name: 'Spring Ball',
    check: (i) => smCheck('sm-mar-70', 'Spring Ball', i) },

  // ----- Norfair / Lower Norfair (71-100) -----
  { id: 'sm-nor-71', region: 'Super Metroid', name: 'Ice Beam',
    check: (i) => smCheck('sm-nor-71', 'Ice Beam', i) },
  { id: 'sm-nor-72', region: 'Super Metroid', name: 'Reserve Tank, Norfair',
    check: (i) => smCheck('sm-nor-72', 'Reserve Tank, Norfair', i) },
  { id: 'sm-nor-73', region: 'Super Metroid', name: 'Missile (Norfair Reserve Tank)',
    check: (i) => smCheck('sm-nor-73', 'Missile (Norfair Reserve Tank)', i) },
  { id: 'sm-nor-74', region: 'Super Metroid', name: 'Missile (bubble Norfair green door)',
    check: (i) => smCheck('sm-nor-74', 'Missile (bubble Norfair green door)', i) },
  { id: 'sm-nor-75', region: 'Super Metroid', name: 'Missile (Speed Booster)',
    check: (i) => smCheck('sm-nor-75', 'Missile (Speed Booster)', i) },
  { id: 'sm-nor-76', region: 'Super Metroid', name: 'Speed Booster',
    check: (i) => smCheck('sm-nor-76', 'Speed Booster', i) },
  { id: 'sm-nor-77', region: 'Super Metroid', name: 'Missile (below Ice Beam)',
    check: (i) => smCheck('sm-nor-77', 'Missile (below Ice Beam)', i) },
  { id: 'sm-nor-78', region: 'Super Metroid', name: 'Hi-Jump Boots',
    check: (i) => smCheck('sm-nor-78', 'Hi-Jump Boots', i) },
  { id: 'sm-nor-79', region: 'Super Metroid', name: 'Missile (Hi-Jump Boots)',
    check: (i) => smCheck('sm-nor-79', 'Missile (Hi-Jump Boots)', i) },
  { id: 'sm-nor-80', region: 'Super Metroid', name: 'Energy Tank (Hi-Jump Boots)',
    check: (i) => smCheck('sm-nor-80', 'Energy Tank (Hi-Jump Boots)', i) },
  { id: 'sm-nor-81', region: 'Super Metroid', name: 'Missile (above Crocomire)',
    check: (i) => smCheck('sm-nor-81', 'Missile (above Crocomire)', i) },
  { id: 'sm-nor-82', region: 'Super Metroid', name: 'Missile (lava room)',
    check: (i) => smCheck('sm-nor-82', 'Missile (lava room)', i) },
  { id: 'sm-nor-83', region: 'Super Metroid', name: 'Missile (bubble Norfair)',
    check: (i) => smCheck('sm-nor-83', 'Missile (bubble Norfair)', i) },
  { id: 'sm-nor-84', region: 'Super Metroid', name: 'Missile (Wave Beam)',
    check: (i) => smCheck('sm-nor-84', 'Missile (Wave Beam)', i) },
  { id: 'sm-nor-85', region: 'Super Metroid', name: 'Wave Beam',
    check: (i) => smCheck('sm-nor-85', 'Wave Beam', i) },
  { id: 'sm-nor-86', region: 'Super Metroid', name: 'Missile (lower Norfair near Wave Beam)',
    check: (i) => smCheck('sm-nor-86', 'Missile (lower Norfair near Wave Beam)', i) },
  { id: 'sm-nor-87', region: 'Super Metroid', name: 'Missile (lower Norfair above fire flea room)',
    check: (i) => smCheck('sm-nor-87', 'Missile (lower Norfair above fire flea room)', i) },
  { id: 'sm-nor-88', region: 'Super Metroid', name: 'Power Bomb (lower Norfair above fire flea room)',
    check: (i) => smCheck('sm-nor-88', 'Power Bomb (lower Norfair above fire flea room)', i) },
  { id: 'sm-nor-89', region: 'Super Metroid', name: 'Power Bomb (Crocomire)',
    check: (i) => smCheck('sm-nor-89', 'Power Bomb (Crocomire)', i) },
  { id: 'sm-nor-90', region: 'Super Metroid', name: 'Energy Tank, Crocomire',
    check: (i) => smCheck('sm-nor-90', 'Energy Tank, Crocomire', i) },
  { id: 'sm-nor-91', region: 'Super Metroid', name: 'Missile (Mickey Mouse room)',
    check: (i) => smCheck('sm-nor-91', 'Missile (Mickey Mouse room)', i) },
  { id: 'sm-nor-92', region: 'Super Metroid', name: 'Energy Tank, Firefleas',
    check: (i) => smCheck('sm-nor-92', 'Energy Tank, Firefleas', i) },
  { id: 'sm-nor-93', region: 'Super Metroid', name: 'Grappling Beam',
    check: (i) => smCheck('sm-nor-93', 'Grappling Beam', i) },
  { id: 'sm-nor-94', region: 'Super Metroid', name: 'Missile (Grappling Beam)',
    check: (i) => smCheck('sm-nor-94', 'Missile (Grappling Beam)', i) },
  { id: 'sm-nor-95', region: 'Super Metroid', name: 'Missile (below Crocomire)',
    check: (i) => smCheck('sm-nor-95', 'Missile (below Crocomire)', i) },
  { id: 'sm-nor-96', region: 'Super Metroid', name: 'Missile (Gold Torizo)',
    check: (i) => smCheck('sm-nor-96', 'Missile (Gold Torizo)', i) },
  { id: 'sm-nor-97', region: 'Super Metroid', name: 'Super Missile (Gold Torizo)',
    check: (i) => smCheck('sm-nor-97', 'Super Missile (Gold Torizo)', i) },
  { id: 'sm-nor-98', region: 'Super Metroid', name: 'Screw Attack',
    check: (i) => smCheck('sm-nor-98', 'Screw Attack', i) },
  { id: 'sm-nor-99', region: 'Super Metroid', name: 'Energy Tank, Ridley',
    check: (i) => smCheck('sm-nor-99', 'Energy Tank, Ridley', i) },
  { id: 'sm-nor-100', region: 'Super Metroid', name: 'Power Bomb (Power Bombs of shame)',
    check: (i) => smCheck('sm-nor-100', 'Power Bomb (Power Bombs of shame)', i) },
];

/* Exports */
window.SMZ3Logic = {
  STATE,
  DUNGEONS,
  LOCATIONS,
  setRuntimeState: setZ3RuntimeState,
};
