# SMZ3 Tracker (PWA)

A mobile-first manual tracker for the **Super Metroid & A Link to the Past Crossover Randomizer (SMZ3)**. Tap items, bosses, dungeons, prizes, and medallions on your phone. Location availability is computed live as you toggle items. Works fully offline once installed.

No autotracking — this is for when you want to track on your phone while the game runs on your TV, emulator, or away from a PC.

## Install on Android

**Option A — self-host (recommended, no server needed):**
1. Fork or upload this folder to a GitHub repo.
2. Enable GitHub Pages in repo settings (deploy from `main` / root).
3. Open the Pages URL on your Android phone in Chrome.
4. Tap the menu → **Install app** (or **Add to Home Screen**).
5. The tracker now launches like a native app, works offline, survives airplane mode.

**Option B — local file (no install):**
- Put the folder anywhere and open `index.html` in Chrome. You get the UI but no PWA install prompt (browsers only allow install over HTTPS or localhost).

**Option C — wrap as a native APK:**
- Use [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) or [PWABuilder](https://www.pwabuilder.com/) to generate a Trusted Web Activity APK from your deployed URL. This gets you a real Play Store-eligible Android app pointing at the PWA.

## Features

- **Items** — full ALttP item set with multi-level cycling for Sword (fighter → gold), Glove (power → titan), Bow (bow → silvers), Boomerang, and Bottle (0–4). Full Super Metroid item set.
- **Dungeons** — every ALttP dungeon with: chest count (tap to decrement), boss defeat toggle, prize picker (pendants & crystals), medallion picker for Misery Mire & Turtle Rock.
- **Super Metroid bosses** — Kraid, Phantoon, Draygon, Ridley, Mother Brain.
- **Locations** — Light World, Dark World, and Super Metroid major-item regions with live color-coded availability (available / dark room / visible / partial / blocked / checked).
- **PWA** — installable to home screen, full offline support, persists state in `localStorage`.
- **Mobile-optimized** — 52px minimum tap targets, responsive grid (4/5/6/8 columns by screen width), safe-area aware.

## Logic notes

Location availability logic is ported from **crossproduct42's `alttprandohelper`** (used with explicit permission). Adapted for SMZ3's combined item pool — since SM items can land in ALttP chests and vice-versa, item state is a unified pool that contributes to both games' accessibility checks.

The logic covers:
- Light World / Dark World overworld chests
- Dungeon entry, chest reachability, and boss defeatability
- Medallion gating (MM & TR) — shown as "visible" when the medallion is unknown but you have at least one
- Dark room detection — blue state when you can reach a location but lack a lantern
- Cross-world travel via Agahnim, gloves+hammer, and mirror portals
- Super Metroid major item regions at the zone level

Logic is simplified compared to the canonical SMZ3 randomizer rules — it's designed for tracking, not seed generation. Some edge cases (swordless mode, specific keysanity interactions, all OWG tricks) are not modeled.

## Item images

The tracker shows item sprites from crossproduct's original trackers (used with permission). The tracker ships without the image files so you can choose your preferred source; until you add them, items display as text glyphs (still fully functional).

**Fastest way to add them:**

1. Go to `github.com/mistersunshine20/smz3tracker`, click the green `Code` → `Download ZIP`
2. Unzip it, find the `images/` folder (it has `zelda3/` and `metroid3/` subfolders)
3. Copy that entire `images/` folder into the root of your repo (next to `index.html`)
4. Commit and push — the images load automatically on next page load

Alternatively, you can pull the sprites directly from the original repos at `github.com/crossproduct42/alttprandohelper` and `github.com/crossproduct42/smrandohelper`, but you'll need to organize them into `images/zelda3/` and `images/metroid3/` folders yourself.

If any image filename doesn't match what the tracker expects, that single item falls back to a text glyph — nothing else breaks. Expected filenames are listed in the `Z3_ITEMS`, `SM_ITEMS`, `SM_BOSSES`, and `AGAHNIM` catalogs at the top of `tracker.js`.

## Credits

- **[crossproduct42](https://twitch.tv/crossproduct)** — creator of the original ALttP tracker (`alttprandohelper`). The location availability logic in this app is derived from his public rules. Used with explicit permission.
- **[halfarebel / Ohga](https://twitch.tv/halfarebel)** — co-author of the original tracker.
- **Muffins, Big Dunka, KrisDavie, catobat, Coxla, Jem, Structural Mike, mm2nescartridge, HolySmoke** — maintainers and contributors to the modern SMZ3 community trackers whose work demonstrated how to extend the logic for the crossover randomizer.
- **[tewtal](https://github.com/tewtal/SMZ3Randomizer)** and **[TheTrackerCouncil](https://github.com/TheTrackerCouncil/SMZ3Randomizer)** — SMZ3 randomizer developers and maintainers.

## Files

```
smz3-tracker/
├── index.html              – app shell
├── styles.css              – mobile-first styling
├── logic.js                – availability engine (ported from crossproduct)
├── tracker.js              – state, rendering, interaction
├── manifest.webmanifest    – PWA manifest
├── sw.js                   – service worker (offline)
├── icons/                  – PWA icons (app icon on home screen)
├── images/                 – item sprites (add these yourself — see "Item images")
│   ├── zelda3/             – ALttP item sprites
│   └── metroid3/           – Super Metroid item sprites
└── README.md               – this file
```

## Development

No build step. Edit files directly. For local testing with service worker, run any static server from the folder:

```
python3 -m http.server 8000
# visit http://localhost:8000 on any device on your LAN
```

For mobile testing specifically, expose it over HTTPS (service workers require secure context off localhost). `ngrok http 8000` or similar tools work well.

## License

This project is released under the MIT License. The portions of location availability logic derived from crossproduct42's `alttprandohelper` are used with explicit permission from the author (Dec 2025).
