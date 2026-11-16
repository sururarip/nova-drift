# nova-drift

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/sururarip/nova-drift/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/sururarip/nova-drift/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

NOVA DRIFT — a neon arena survival shooter. You are the Kestrel, the last light-ship against the Hollow Star. Survive 15 waves of shard-ships, pick one of three upgrades between waves, and destroy the Hollow Star boss on wave 15 to win. Lose when your hull reaches zero.

## Run it

```sh
node serve.ts
# then open http://localhost:8080
```

Or open `game/index.html` directly in a desktop browser. No network requests, no libraries — plain ES modules and a canvas.

## Play

- **Move:** WASD or arrow keys (the ship banks as it turns)
- **Aim / fire:** mouse, hold left click
- **Dash:** Space or Shift — a short burst with invulnerability frames
- **Nova blast:** E or right click when the Nova bar is full — clears the field
- **Pause:** P · **Mute:** M · **Restart:** R or the button on the end screen
- **Start / continue:** Enter, or click the on-screen buttons

## Systems

- 5 enemy kinds (mote, darter, spitter, brute that splits into motes, and the Hollow Star boss with 3 phases: radial bursts, aimed fans, spirals, and mote summons) across 15 escalating waves; a boss every 5th wave.
- 10 upgrades drafted 1-of-3 between waves (Twin Lance, Rapid Cycler, Aegis Plating, Ember Magnet, Nova Capacitor, Swift Dash, Piercing Rounds, Overdrive, Guardian Shield, Ion Thrusters).
- Combo multiplier up to ×5, ember pickups that charge the Nova, hearts and shields, synthesized WebAudio sound effects and a bass-line music sequencer (no audio files), best score kept in localStorage.
- Deterministic screenshot scenes via `?shot=menu|play|boss|end&seed=7` (see `shots.json`); every scene is seeded and reproducible.

## Screenshots

The PNGs in `screenshots/` are **PLACEHOLDERS drawn with PIL** so the entry builds end to end. Before submitting, replace them with real renders of the game's `?shot=` scenes (1280×720, each ≤256 KiB).

## Build

`node main.ts` (or `MAKEFUN_OUTPUT_DIR=/output node main.ts`) copies `game/` and `screenshots/` into the output directory and writes `dossier.json` there. It only ever removes `game/`, `screenshots/` and `dossier.json` inside the output directory — never the directory itself, because the grader's `/output` is a mount point.

---

<sub>Entered on [make.fun](https://make.fun/?ref=b3d8gcn6&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
