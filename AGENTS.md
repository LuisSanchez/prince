# AGENTS.md — Grok Prince

Context for AI agents and humans continuing work on this repo.

## What this is

**Grok Prince** — original browser platformer (vanilla JS + Canvas). Inspired by **multiple** classics: Castlevania (sword duels, tense beds), Metroid/Metroidvania (linked rooms, exploration), Prince of Persia–era cinematic platforming and timed duels, and similar dungeon-adventure games. **Not** a remake or single-franchise clone; all assets are original.

- **12 stages**, shared **7:00** hourglass timer
- Eras: **Castle (1–4)** → **Modern city (5–8)** → **Starship (9–10)** → **Mars (11–12)**
- Victory: free the princess on Mars
- Procedural Web Audio SFX + chiptune BGM/battle music
- **Leaderboard** for clean full runs only

## Run locally

```bash
npm start
# → http://localhost:5173
# Serves static files + POST/GET /api/leaderboard (persists data/leaderboard.json)
```

ES modules **do not** work via `file://`. Tests: `npm test`.

## Deploy (Vercel)

Static site + serverless API:

```bash
vercel        # preview
vercel --prod # production
```

- Root is the web root (`index.html`, `src/`, `levels/`, `api/`, `data/`)
- `vercel.json` present
- **API:** `GET|POST /api/leaderboard` → `api/leaderboard.js` + `lib/leaderboardStore.js`
- **Persistence note:** Vercel’s serverless FS is **ephemeral**. `data/leaderboard.json` is the store contract; local `npm start` persists reliably. For durable production scores later, swap the store to Vercel Blob / KV / Neon without changing the client API in `src/systems/leaderboard.js`.

## Project map

| Path | Role |
|------|------|
| `src/main.js` | Scene wiring, campaign flow, cheat jump hooks |
| `src/config.js` | Constants (timer 420s, combat, colors, motion tables) |
| `src/systems/session.js` | Health, timer, **cheated/fullRun**, `markCheated`, `cheatAddHeart` |
| `src/systems/leaderboard.js` | Client fetch/submit, eligibility helpers |
| `src/systems/traps.js` | Spikes, gates, stage exit door, potions |
| `src/systems/combat.js` | Sword combat resolution |
| `src/systems/collision.js` | AABB, careful edge, climb |
| `src/entities/Player.js` | Action FSM + fight sub-FSM |
| `src/entities/Enemy.js` | Guard AI + `outfit` |
| `src/scenes/*` | Title, Play, Victory, cutscenes, transitions |
| `src/render/draw.js` | Themes: `dungeon` \| `modern` \| `ship` \| `mars`; enemy outfits |
| `src/audio/sfx.js` | SFX + BGM + battle bed; music/SFX toggles |
| `levels/manifest.json` | Campaign order |
| `levels/level01.json`…`level12.json` | Entity-first rooms |
| `data/leaderboard.json` | Scoreboard JSON (`entries[]`) |
| `lib/leaderboardStore.js` | Server read/write/sort |
| `api/leaderboard.js` | Vercel serverless handler |
| `server.mjs` | Local static + API |
| `DESIGN.md` | Original architecture notes (may lag features) |

## Campaign & cutscenes

| After completing | Transition | Next |
|------------------|------------|------|
| level04 | `EraCutscene` (castle→city) | level05 |
| level08 | `ShipCutscene` (city→ship) | level09 |
| level10 | `MarsCutscene` (ship crash→Mars) | level11 |
| level12 | Victory + leaderboard | — |

Themes: stages 1–4 dungeon, 5–8 `modern`, 9–10 `ship`, 11–12 `mars`.

Mars enemies: **≥7 HP**; final boss `e12boss`: **13 HP**. Exit rooms need open right wall tiles (rows 2–4 last column `0`) so the stage door is walkable.

## Session / death policy

- Shared timer continues across deaths and stages
- Death → reinit **current stage** from entry snapshot (not whole campaign)
- New stage: `refillHealthForNewStage` → 3 current hearts (max can stay higher if cheated)
- Sword persists once found (`session.hasSword`)

## Leaderboard rules (important)

**Eligible only if:**

1. Started from title with **Enter** (clean `newGameSession`, `fullRun: true`)
2. Completed stages **1→12** without stage-skip
3. Never used **`+` life** cheat or **goN / goera / goship / gomars**

Any of those sets `session.cheated = true` and `fullRun = false` via `markCheated()`.

- Score = **elapsed** game time: `START_TIME_SEC - timeLeftSec` (pause freezes hourglass)
- Lower elapsed is better
- Name entry HTML panel on victory (`#lb-panel`); top scores on title canvas
- Server rejects POST if `cheated` / `eligible: false`

### When adding cheats later

Always call `markCheated(session, 'reason')` so ranking stays fair.

## Cheats (QA)

Typed buffer (~1.5s, prefix-safe for go10/go11/go12):

| Code | Effect |
|------|--------|
| `go1`…`go12` | Jump to stage (sword if ≥2) |
| `goera` | Castle→modern cutscene → 5 |
| `goship` | City→ship cutscene → 9 |
| `gomars` | Mars crash cutscene → 11 |
| `+` / `=` / numpad+ | +1 heart (max 5) |

## Audio UI

- `#btn-music` / `#btn-sfx` under canvas
- Battle music ducks BGM while `player.fightState` + living enemies

## Known design pitfalls

1. **Stage exit walls** — last room must open right column on walkable rows or exit is blocked by solid tiles
2. **Vertical pads** — do not cancel combat every frame on ↓/↑ pads (broke BONE HALL sword)
3. **Stage door arming** — `stageDoorArmed` after leaving spawn band; need `player.x >= exit.x + 6`
4. **go1 vs go10** — cheat matcher delays prefix codes

## Coding conventions

- ES modules, no build step for gameplay code
- Logical resolution **320×200** (HUD 16 + playfield 184)
- Fixed ~60 Hz sim in `gameLoop.js`
- Prefer small surgical edits; keep `setBattleMusic` / session APIs stable
- Level JSON: entity-first, unique ids, links for plate→gate

## Good first tasks for future agents

- Durable leaderboard backend (Blob/KV/DB)
- More rooms / polish Mars levels
- Optional name on title before run
- i18n / mobile controls
- Keep README + this file in sync when adding stages or cheats

## License

MIT code. Original work; not affiliated with Castlevania, Metroid, Prince of Persia, or other referenced franchises’ rights holders.
