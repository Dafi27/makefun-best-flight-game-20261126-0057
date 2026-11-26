# Kestrel Run

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Dafi27/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Dafi27/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

A complete, original flight game for the [make.fun best flight game bounty](https://make.fun/bounty/best-flight-game-20261126-0057): fly the mail plane *Kestrel* through six gold rings over the Sora Archipelago, then land her on Sora Field. Built with plain Canvas 2D and a small projection of our own — no library, no network request, every sound synthesised in the browser.

Play it: serve `game/` with any static server (`node serve.ts`, then open http://localhost:8080) and fly with keyboard and mouse.

## How to fly

- **W / S** — throttle up / down (mouse wheel works the throttle too)
- **Arrow keys** — pitch and bank (Up pushes the nose down, Down pulls up)
- **A / D** — rudder
- **Mouse** — hold the button and steer by pointer position
- **Space** — brake, for the landing roll
- **P** — pause · **R** — fly again · **M** — mute · **Enter** — start

## The mail run

Six gold rings lead north across the islands, from the start strip to Sora Field. Each ring is worth 250 points. Land gently on the strip — slow, wings level, sinking softly — for a 500-point landing bonus plus time and fuel bonuses. Fly too hard into the ground, the hills or the sea and the run ends. Fuel burns with the throttle, and below 30 knots the wings stall, so mind the speed.

## Layout

- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`
- `game/index.html` — the page; `game/src/` holds the game, one job per file: `config.js` (constants), `terrain.js` (the archipelago), `flight.js` (the flight model and the mail run), `render.js` (the 3D chase view), `hud.js` (cockpit and screens), `audio.js` (synthesised sound), `input.js` (keyboard and mouse), `shots.js` (the deterministic screenshot scenes), `main.js` (the loop)
- `screenshots/` — four renders of the game's own code
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged

## Referral

Built with make.fun — [try it yourself](https://make.fun/r/n99wbh60).
