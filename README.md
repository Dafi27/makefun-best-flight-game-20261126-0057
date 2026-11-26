# makefun-best-flight-game-20261126-0057

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Dafi27/makefun-best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Dafi27/makefun-best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

"Kestrel Run" — a complete, original flight game: fly the mail plane Kestrel (N27KR) through six gold rings over the fictional Sora Archipelago, then land on Sora Field. Hand-written Canvas 2D with a small 3D projection (chase camera), no libraries, no network, all sounds synthesised with WebAudio. Controls: W/S throttle, arrow keys pitch/bank, A/D rudder, mouse steer, Space brake, Enter start, R restart, P pause, M mute.

## Run it
```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```
This copies game/ and screenshots/ into out/ and writes out/dossier.json. Play the game by serving game/ with any static server (node serve.ts, then open http://localhost:8080).

## How to fly

- **W / S** — throttle up / down (mouse wheel works the throttle too)
- **Arrow keys** — pitch and bank (Up pushes the nose down, Down pulls up)
- **A / D** — rudder
- **Mouse** — hold the button and steer by pointer position
- **Space** — brake, for the landing roll
- **P** — pause · **R** — fly again · **M** — mute · **Enter** — start

## The mail run

Six gold rings lead north across the islands, from the start strip to Sora Field. Each ring is worth 250 points. Land gently on the strip — slow, wings level, sinking softly — for a 500-point landing bonus plus time and fuel bonuses. Fly too hard into the ground, the hills or the sea and the run ends. Fuel burns with the throttle, and below 30 knots the wings stall, so mind the speed.

---

<sub>Entered on [make.fun](https://make.fun/?ref=n99wbh60&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
