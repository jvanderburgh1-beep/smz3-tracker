# Third-party attributions

This tracker incorporates code translated from the following open-source projects.
All upstream projects retain their original copyright; the original MIT license
text is reproduced below for each.

---

## tewtal/SMZ3Randomizer

The Super Metroid logic in `logic.js` is a JavaScript port of
`Randomizer.SMZ3/Regions/SuperMetroid/*.cs` (Normal logic only) from
[tewtal/SMZ3Randomizer](https://github.com/tewtal/SMZ3Randomizer).

Specifically:
- The 11 region-entry predicates (`canEnterBrinstarGreen`, `canEnterBrinstarPink`,
  `canEnterBrinstarRed`, `canEnterBrinstarKraid`, `canEnterCrateriaWest`,
  `canEnterNorfairUpperWest`, `canEnterNorfairUpperEast`, `canEnterNorfairUpperCrocomire`,
  `canEnterNorfairLowerWest`, `canEnterNorfairLowerEast`, `canEnterMaridiaOuter`,
  `canEnterMaridiaInner`, `canEnterWreckedShip`)
- The cross-game portal entry predicates (`canAccessNorfairUpperPortal`,
  `canAccessNorfairLowerPortal`, `canAccessMaridiaPortal`)
- The 64 per-location requirement checks in `SM_CHECK_BY_NAME`
- Helper predicates (`canPassBombPassages`, `canDestroyBombWalls`,
  `canUsePowerBombs`, `canOpenRedDoors`, `canOpenGreenDoors`, `canFly`,
  `hasHeatShield`, `canEnterAndLeaveGauntlet`, `canReachAqueduct`,
  `canDefeatBotwoon`, `canDefeatDraygon`, `canUnlockShip`)

Deviations from the upstream source:
- Both Normal and Hard logic branches are ported (as of v21). Checks are
  AVAILABLE (green) when Normal logic passes; GLITCHED (yellow) when only
  the Hard branch passes.
- Hard-logic trick helpers (`CanIbj`, `CanSpringBallJump`, `CanHellRun`,
  `TwoPowerBombs`) are treated as unconditionally true when evaluating
  the Hard branch. The canonical source treats Hard as a single preset
  rather than a menu of toggleable tricks, so we don't decompose it.
- Keysanity is not modeled. Every `Config.Keysanity ? CardX : Y` evaluates
  the non-keysanity branch.
- `CanUnlockShip`'s `CardWreckedShipBoss` check is treated as satisfied once
  the player can reach the Wrecked Ship; the player gates Phantoon themselves
  via the boss tracker.
- v21 fix: Crateria East region entry (`sm-crt-36/37/38/39`) now correctly
  uses the canonical `CanEnter` predicate. Previously sm-crt-36 (Crateria
  moat) could light green on empty inventory; now it requires Super + PB
  at minimum per the source.

License (MIT):

```
MIT License

Copyright (c) tewtal and contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## crossproduct42/alttprandohelper (initial Z3 logic, superseded in v20)

The original A Link to the Past logic in this tracker (versions through v19)
was derived from [crossproduct42/alttprandohelper](https://github.com/crossproduct42/alttprandohelper)
with the author's explicit permission (Discord, 2026).

As of v20, the A Link to the Past logic is a fresh port from
`tewtal/SMZ3Randomizer` (see below). Attribution to crossproduct42 is
retained because remnants of the earlier port informed dungeon-shape and
chest-counting decisions.

License (MIT) — same terms as above, copyright (c) crossproduct42 and contributors.

---

## tewtal/SMZ3Randomizer (A Link to the Past logic — added in v20)

The A Link to the Past logic in `logic.js` is a JavaScript port of
`Randomizer.SMZ3/Regions/Zelda/**.cs` (single-player, non-keysanity, non-multiworld
configuration) from [tewtal/SMZ3Randomizer](https://github.com/tewtal/SMZ3Randomizer).
This is the same upstream as the SM port above.

Specifically:

- The 8 region-entry predicates (`z3CanEnterLWNorthEast`, `z3CanEnterLWNorthWest`,
  `z3CanEnterLWSouth`, `z3CanEnterLWDMWest`, `z3CanEnterLWDMEast`,
  `z3CanEnterDWMire`, `z3CanEnterDWNorthEast`, `z3CanEnterDWNorthWest`,
  `z3CanEnterDWSouth`, `z3CanEnterDWDMEast`)
- The 13 dungeon-entry predicates (one per dungeon: EP, DP, TOH, HC, AT, POD,
  SP, SW, TT, IP, MM, TR, GT) including medallion gating for MM and TR and
  crystal-count gating for GT
- The 80+ per-location requirement predicates in `Z3_OVERWORLD_BY_NAME`
- Dungeon chest counting via per-dungeon `z3DungeonXX(items)` helpers that
  evaluate each chest's requirements from the source and count reachable
  chests, treating small/big keys as always satisfied (the tracker
  doesn't model per-dungeon key state)
- Helper predicates (`canLiftLight`, `canLiftHeavy`, `canLightTorches`,
  `canMeltFreezors`, `canKillManyEnemies`, `canExtendMagic`,
  `canAcquireAgahnim`, `canAcquirePendantGreen`, `canAcquireAllPendants`,
  `canAcquireAllRedCrystals`, `canAcquireAtLeastNCrystals`)

Deviations from the upstream source:

- Single-player only. Multiworld config flags (`Config.MultiWorld`) are
  treated as false; the `Allow`/`AlwaysAllow`/`CanFill` overrides that exist
  to constrain item placement during generation are not relevant for tracking
  and are omitted.
- Keysanity is not modeled. `Config.Keysanity ? a : b` evaluates the non-keysanity
  branch.
- Inverted mode is not supported.
- Per-dungeon small/big key counts are NOT tracked. Any check that requires
  `items.KeyXX >= N` or `items.BigKeyXX` is treated as satisfied. Rationale:
  the tracker exists to answer "what's reachable assuming I progress through
  the dungeon normally", not "what's reachable given exactly the keys I've
  found so far". Asking the player to track key counts per dungeon is bad UX.
- `CanBlockLasers()` (mirror shield) is treated as false because the tracker
  doesn't model the mirror shield item. The TR Eye Bridge has a Cape/Byrna
  fallback so this is rarely the binding constraint.
- The SMZ3 source has only one logic branch per Z3 location (no Hard/Glitched
  variant). All Z3 checks return AVAILABLE / VISIBLE / PARTIAL / UNAVAIL —
  never GLITCHED. The GLITCHED state surfaces only from SM checks where the
  canonical SM source DOES have Hard branches.

License: MIT — same terms as the SM port above.
