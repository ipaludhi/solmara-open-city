# solmara-open-city

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/ipaludhi/solmara-open-city/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/ipaludhi/solmara-open-city/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

SOLMARA: Open City — an original 3D open-world crime game (raw WebGL, zero dependencies). Raka, a courier dragged into the Kru Senja heist crew, explores the coastal city of Solmara (6 named districts) on foot and by stolen car: traffic and pedestrians, wanted level 1–5 with police chases, 6 named story missions, combat, a HUD with minimap, title screen and save, and synthesised WebAudio sound. Everything — city, characters, vehicles, story — is original.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 — no build step, no network, just static files under `game/`. Needs a browser with WebGL (any modern desktop or mobile browser). Play with keyboard + mouse: WASD to walk/drive, E to enter and steal cars, Space to punch, F to shoot, R to reload, P to pause, M to mute. Screenshots in `screenshots/` are staged deterministically from the game's own code (`?shot=chase|street|title|heist&seed=1`).

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
