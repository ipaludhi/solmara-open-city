// SOLMARA: Open City — boot and the one loop. Input is read every frame, the
// world advances in fixed 1/60 s steps (several in a slow frame, none in a
// fast one), and the renderer paints what is there. Screens: title, play,
// paused, busted, wasted, story complete.
//
// ?seed=N fixes the city and traffic. ?shot=chase|street|title|heist (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot. window.__solmara always
// carries a plain state dump for play-tests.
import { CAR_MODELS, CLOCK_START_MIN, PISTOL, STEP, VIEW, WORLD } from './config.js';
import { createRng, hashSeed } from './random.js';
import { ACTION, createInput } from './input.js';
import { createCity } from './city.js';
import { createPlayer, damagePlayer, updateOnFoot } from './player.js';
import { distToCar, driveCar } from './vehicles.js';
import { createTraffic, hitPedestrians, updateTraffic } from './traffic.js';
import { addWanted, createPolice, updatePolice } from './police.js';
import { createMissions, currentMission, missionTarget, updateMissions } from './missions.js';
import { createCombat, tryPunch, tryShoot, updateCombat } from './combat.js';
import { createAudio } from './audio.js';
import { clearSave, loadBest, loadSave, saveBest, saveGame } from './save.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_COMPLETE, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED } from './render.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;
const SPAWN = { x: 1000, y: 1250 };

export function createGame(seed) {
  const canvas = document.getElementById('game');
  const rng = createRng(seed);
  const city = createCity(rng);
  const input = createInput(canvas);
  const audio = createAudio();
  const state = {
    seed, rng, city, input, audio,
    player: createPlayer(SPAWN.x, SPAWN.y),
    traffic: createTraffic(rng, city),
    police: createPolice(),
    missions: createMissions(),
    combat: createCombat(),
    cash: 250, clockMin: 0, time: 0,
    screen: SCREEN_TITLE,
    camera: { x: 1280, y: 1680 },
    particles: [], floaters: [], skids: [], shake: 0,
    nearCar: null, missionTarget: null,
    autopilot: null, autopilotHook: null,
    stats: { missionsDone: 0, carsStolen: 0 },
    save: loadSave(), best: loadBest(),
    muted: false,
  };
  if (state.save) {
    state.cash = state.save.cash ?? 250;
    state.missions.index = state.save.missionIndex ?? 0;
    state.missions.done = state.save.done ?? [];
    state.stats.missionsDone = state.save.missionsDone ?? 0;
    state.stats.carsStolen = state.save.carsStolen ?? 0;
  }
  return state;
}

function nearestStealable(state) {
  const p = state.player;
  if (!p.onFoot) return null;
  let best = null; let bestD = 78;
  const all = [...state.traffic.parked, ...state.traffic.cars.map((n) => n.car)];
  for (const car of all) {
    if (car.police) continue;
    const d = distToCar(p.x, p.y, car);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function enterCar(state, car) {
  const p = state.player;
  if (car.npc) {
    // The driver flees on foot; stealing a driven car is a crime.
    car.npc = false;
    state.traffic.peds.push({ x: car.x + 30, y: car.y + 30, tx: car.x + 400, ty: car.y + 400, speed: 130, state: 'walk', down: 0, color: '#fda4af', phase: 0 });
  }
  car.parked = false;
  car.stolen = true;
  p.car = car;
  p.onFoot = false;
  p.x = car.x; p.y = car.y;
  state.stats.carsStolen += 1;
  state.floaters.push({ x: car.x, y: car.y - 40, text: `DICURI: ${car.model.name}!`, color: '#ff4d4d', ttl: 1.8 });
  addWanted(state.police, 1, state);
  state.audio.blip();
}

function exitCar(state) {
  const p = state.player;
  const car = p.car;
  if (!car) return;
  car.speed = 0;
  const side = car.angle + Math.PI / 2;
  p.x = car.x + Math.cos(side) * 42;
  p.y = car.y + Math.sin(side) * 42;
  p.x = Math.max(20, Math.min(WORLD.width - 20, p.x));
  p.y = Math.max(20, Math.min(WORLD.height - 20, p.y));
  p.car = null;
  p.onFoot = true;
}

function burst(state, x, y, color, n, speed) {
  for (let i = 0; i < n; i += 1) {
    const a = state.rng.range(0, Math.PI * 2);
    const v = state.rng.range(speed * 0.3, speed);
    state.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.6, max: 0.6, color, size: state.rng.range(2, 5) });
  }
}

// One fixed update of the whole game. Used by the live loop and by the
// screenshot staging, so a staged frame is a real frame of the real game.
export function stepGame(s, dt) {
  s.time += dt;
  s.clockMin += dt / 6;
  if (s.missions.bannerTimer > 0) s.missions.bannerTimer -= dt;
  if (s.shake > 0) s.shake = Math.max(0, s.shake - dt * 22);
  for (let i = s.floaters.length - 1; i >= 0; i -= 1) {
    const f = s.floaters[i];
    f.ttl -= dt; f.y -= 22 * dt;
    if (f.ttl <= 0) s.floaters.splice(i, 1);
  }
  for (let i = s.particles.length - 1; i >= 0; i -= 1) {
    const pt = s.particles[i];
    pt.life -= dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt;
    if (pt.life <= 0) s.particles.splice(i, 1);
  }
  for (let i = s.skids.length - 1; i >= 0; i -= 1) {
    s.skids[i].ttl -= dt;
    if (s.skids[i].ttl <= 0) s.skids.splice(i, 1);
  }
  if (s.autopilotHook) s.autopilotHook(s);
  if (s.screen !== SCREEN_PLAY) return;

  const input = s.input;
  const p = s.player;
  if (input.wasPressed(ACTION.PAUSE)) { s.screen = SCREEN_PAUSED; return; }
  if (input.wasPressed(ACTION.MUTE)) {
    s.muted = !s.muted;
    s.audio.setMuted(s.muted);
    s.floaters.push({ x: p.x, y: p.y - 30, text: s.muted ? 'SUARA MATI' : 'SUARA NYALA', color: '#d8c9a8', ttl: 1.2 });
  }

  // Steal / enter / exit a car.
  s.nearCar = nearestStealable(s);
  if (input.wasPressed(ACTION.ENTER_CAR)) {
    if (p.onFoot && s.nearCar) enterCar(s, s.nearCar);
    else if (!p.onFoot) exitCar(s);
  }

  if (p.car) {
    const car = p.car;
    const ap = s.autopilot;
    const throttle = ap ? ap.throttle : (input.isDown(ACTION.UP) || input.isDown(ACTION.UP2) ? 1 : (input.isDown(ACTION.DOWN) || input.isDown(ACTION.DOWN2) ? -0.6 : 0));
    const steer = ap ? ap.steer : ((input.isDown(ACTION.LEFT) || input.isDown(ACTION.LEFT2) ? -1 : 0) + (input.isDown(ACTION.RIGHT) || input.isDown(ACTION.RIGHT2) ? 1 : 0));
    const before = { x: car.x, y: car.y };
    const ev = driveCar(car, throttle, steer, dt, s.city);
    if (ev.skidding) {
      s.skids.push({ x1: before.x, y1: before.y, x2: car.x, y2: car.y, ttl: 6 });
      burst(s, car.x, car.y, '#9a8f7a', 1, 40);
    }
    if (ev.crashed) {
      s.shake = Math.max(s.shake, 9);
      burst(s, car.x, car.y, '#ffb020', 10, 160);
      s.audio.crash();
      car.hp -= 18;
      if (car.hp <= 0) {
        car.hp = 100;
        s.floaters.push({ x: car.x, y: car.y - 40, text: 'MOBIL RUSAK!', color: '#ff4d4d', ttl: 1.8 });
        damagePlayer(p, 15);
        exitCar(s);
      }
    }
    p.x = car.x; p.y = car.y;
    s.audio.engine(Math.abs(car.speed) / car.model.top);
  } else {
    const ap = s.autopilot;
    if (ap && ap.move) {
      // Autopilot walks by temporarily holding keys.
      const mv = ap.move;
      const fake = { moveVector: () => mv };
      updateOnFoot(p, fake, s.city, dt);
    } else {
      updateOnFoot(p, input, s.city, dt);
    }
    if (input.wasPressed(ACTION.PUNCH) || input.consumeClick()) {
      if (input.mouse.down || input.wasPressed(ACTION.PUNCH)) tryPunch(s.combat, s);
    }
    if (input.wasPressed(ACTION.SHOOT)) tryShoot(s.combat, s);
    if (input.wasPressed(ACTION.RELOAD) && p.ammo > 0 && p.mag < PISTOL.magSize && p.reloading <= 0) {
      p.reloading = PISTOL.reloadTime;
    }
    s.audio.engine(0);
  }

  updateTraffic(s.traffic, dt, s.city, s.rng, p, p.car);
  for (const ev of hitPedestrians(s.traffic, p.car, s)) {
    addWanted(s.police, 1, s);
    s.shake = Math.max(s.shake, 7);
    burst(s, ev.x, ev.y, '#ff4d4d', 8, 120);
    s.audio.crash();
  }
  const pol = updatePolice(s.police, dt, s, s.rng);
  s.audio.siren(s.police.wanted > 0, dt);
  if (pol.busted) {
    s.cash = Math.max(0, s.cash - 100);
    s.police.wanted = 0;
    s.police.cars = [];
    s.police.bustTimer = 0;
    if (p.car) { p.car.speed = 0; p.car = null; }
    p.onFoot = true;
    p.x = SPAWN.x; p.y = SPAWN.y;
    p.hp = Math.max(p.hp, 50);
    s.screen = SCREEN_BUSTED;
    saveGame(s);
    return;
  }
  const missionEvent = updateMissions(s.missions, s);
  if (missionEvent === 'complete' || missionEvent === 'story-done') saveGame(s);
  if (missionEvent === 'story-done') {
    s.screen = SCREEN_COMPLETE;
    saveBest({ missionsDone: 6, cash: s.cash });
  }
  updateCombat(s.combat, dt, s);
  if (p.hp <= 0) {
    p.hp = 100;
    s.police.wanted = 0;
    s.police.cars = [];
    s.screen = SCREEN_WASTED;
    saveGame(s);
    return;
  }
  s.missionTarget = missionTarget(s.missions);
  // Camera follows the player, clamped to the world.
  const focusX = p.car ? p.car.x : p.x;
  const focusY = p.car ? p.car.y : p.y;
  s.camera.x = Math.max(0, Math.min(WORLD.width - VIEW.width, focusX - VIEW.width / 2));
  s.camera.y = Math.max(0, Math.min(WORLD.height - VIEW.height, focusY - VIEW.height / 2));
}

export function stateDump(s) {
  const p = s.player;
  return {
    screen: s.screen,
    cash: s.cash,
    wanted: s.police.wanted,
    missionIndex: s.missions.index,
    missionName: currentMission(s.missions) ? currentMission(s.missions).name : 'tamat',
    missionsDone: s.missions.done.length,
    player: { x: Math.round(p.x), y: Math.round(p.y), onFoot: p.onFoot, hp: Math.round(p.hp), car: p.car ? p.car.model.name : null, speed: p.car ? Math.round(p.car.speed) : 0 },
    policeCars: s.police.cars.length,
    trafficCars: s.traffic.cars.length,
    peds: s.traffic.peds.length,
    pedsDown: s.traffic.peds.filter((q) => q.state === 'down').length,
    parkedCars: s.traffic.parked.length,
    bullets: s.combat.bullets.length,
    time: Math.round(s.time * 100) / 100,
    clock: (() => {
      const total = CLOCK_START_MIN + Math.floor(s.clockMin);
      return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    })(),
  };
}

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const state = createGame(seed);
// Play-test handle: the live state for CDP checks (read-only use in tests).
window.__game = state;
const renderer = createRenderer(canvas);

function announce(message) { status.textContent = message; }

function startGame() {
  state.screen = SCREEN_PLAY;
  state.audio.ensure();
  announce('Bermain sebagai Raka di Solmara.');
}

function backToTitle() {
  state.screen = SCREEN_TITLE;
  state.camera = { x: 1280, y: 1680 };
}

async function runShot(name) {
  const { stageShot } = await import('./shots.js');
  // Shots must be identical on every run: ignore any autosave this browser
  // profile carries from an earlier play session.
  state.save = null;
  state.cash = 250;
  state.missions = createMissions();
  state.stats = { missionsDone: 0, carsStolen: 0 };
  const scene = stageShot(name, state);
  state.screen = scene.screen;
  window.__solmara = stateDump(state);
  let painted = 0;
  function paint() {
    renderer.draw(state);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else {
      window.__shotReady = true;
      window.__solmara = stateDump(state);
    }
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let accumulator = 0;
  let last = performance.now();
  const gesture = () => state.audio.ensure();
  window.addEventListener('keydown', gesture);
  window.addEventListener('mousedown', gesture);

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const input = state.input;
    if (state.screen === SCREEN_TITLE) {
      if (input.wasPressed(ACTION.CONFIRM) || input.consumeClick()) startGame();
    } else if (state.screen === SCREEN_PAUSED) {
      if (input.wasPressed(ACTION.PAUSE)) state.screen = SCREEN_PLAY;
      else if (input.wasPressed(ACTION.CONFIRM)) backToTitle();
    } else if (state.screen === SCREEN_BUSTED || state.screen === SCREEN_WASTED) {
      if (input.wasPressed(ACTION.CONFIRM)) {
        state.screen = SCREEN_PLAY;
        announce('Kembali ke jalanan Solmara.');
      }
    } else if (state.screen === SCREEN_COMPLETE) {
      if (input.wasPressed(ACTION.CONFIRM)) {
        clearSave();
        const fresh = createGame(hashSeed(`solmara-${Date.now()}`));
        fresh.save = null;
        fresh.cash = 250;
        fresh.missions = createMissions();
        fresh.stats = { missionsDone: 0, carsStolen: 0 };
        Object.assign(state, fresh);
        state.screen = SCREEN_PLAY;
      }
    }
    if (state.screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        stepGame(state, STEP);
        accumulator -= STEP;
        if (state.screen !== SCREEN_PLAY) { accumulator = 0; break; }
      }
    } else {
      accumulator = 0;
      if (state.screen === SCREEN_TITLE) {
        // The title vista drifts slowly over the beach.
        state.time += STEP;
        state.camera.x = 1280 + Math.sin(state.time * 0.05) * 120;
      }
    }
    window.__solmara = stateDump(state);
    renderer.draw(state);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.screen === SCREEN_PLAY) {
      state.screen = SCREEN_PAUSED;
      announce('Jeda — tab disembunyikan.');
    }
  });

  announce('SOLMARA: Open City. Tekan Enter untuk mulai.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
