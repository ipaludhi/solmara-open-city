// The screenshot scenes behind ?shot=chase|street|title|heist. Each one plays
// the real rules forward from a fresh game for a fixed number of steps,
// steered by a simple autopilot, so the frame is what a short game really
// looks like and the same seed always gives the same frame. The cover is the
// chase: the densest frame, never a bare menu (GAP4 lesson from CANTING).
import { CAR_MODELS, STEP } from './config.js';
import { createCar } from './vehicles.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stepGame } from './main.js';

export const SHOT_NAMES = ['chase', 'street', 'title', 'heist'];

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// Drive forward along a road, steering gently back to its centre line.
function roadAutopilot(state, roadY) {
  const car = state.player.car;
  state.autopilot = {
    throttle: 1,
    steer: car ? clamp((roadY - car.y) / 90, -1, 1) : 0,
  };
}

function runSteps(state, n, hook) {
  for (let i = 0; i < n; i += 1) {
    if (hook) hook(state, i);
    stepGame(state, STEP);
    if (state.screen !== SCREEN_PLAY) break;
  }
  state.autopilot = null;
  state.autopilotHook = null;
}

function placePoliceBehind(state, count, gap) {
  const car = state.player.car;
  for (let i = 0; i < count; i += 1) {
    const pc = createCar(state.police.cars[0] ? state.police.cars[0].model : { name: 'Patroli Solmara', color: '#1e293b', top: 360, accel: 300, grip: 3.6, len: 48, wid: 22 }, car.x - gap * (i + 1), car.y + (i % 2 === 0 ? -34 : 34), 0, { police: true, id: 200 + i });
    pc.speed = 300;
    state.police.cars.push(pc);
  }
}

function stageChase(state) {
  // Cover: Raka in the green Cendrawasih Sport, wanted 3 stars, three patrol
  // cars on his tail, mission 5 (Heist Bank Solmara) on the HUD, traffic
  // ahead, minimap live. Distrik Neon at golden hour.
  state.shotCam = 'chase';
  state.screen = SCREEN_PLAY;
  state.missions.index = 4;
  state.missions.phase = 1;
  state.missions.started = true;
  state.cash = 2480;
  const car = createCar(CAR_MODELS[3], 2200, 1250, 0, { id: 4 });
  car.stolen = true;
  state.player.car = car;
  state.player.onFoot = false;
  state.player.x = car.x; state.player.y = car.y;
  state.police.wanted = 3;
  state.traffic.cars[0].car.x = 2600; state.traffic.cars[0].car.y = 1250;
  state.traffic.cars[1].car.x = 2500; state.traffic.cars[1].car.y = 1190;
  state.traffic.cars[2].car.x = 2750; state.traffic.cars[2].car.y = 1310;
  placePoliceBehind(state, 3, 190);
  state.floaters.push({ x: 2350, y: 1150, text: 'POLISI MENGEJAR!', color: '#ff4d4d', ttl: 99 });
  state.missions.banner = { text: 'KABUR KE DERMAGA SOL!', sub: 'MISI 5: Heist Bank Solmara — polisi mengejar' };
  state.missions.bannerTimer = 99;
  runSteps(state, 300, (s) => roadAutopilot(s, 1250));
  state.missions.bannerTimer = 99; // keep the banner readable in the frame
  return { screen: SCREEN_PLAY };
}

function stageStreet(state) {
  // On foot in Pasar Malam: Raka beside a parked Kancil GT, prompt to steal,
  // pedestrians and traffic around, mission 3 marker ahead.
  state.shotCam = 'street';
  state.screen = SCREEN_PLAY;
  state.missions.index = 2;
  state.missions.started = true;
  state.cash = 550;
  // Raka stands OFF the mission-3 target (500,1200) so the mission stays
  // active in the frame, clearly beside (not under) the parked car so both
  // read in the frame; the "E — CURI MOBIL" prompt names the car.
  state.player.x = 720; state.player.y = 1380;
  state.player.angle = Math.PI / 2;
  const near = state.traffic.parked[1];
  near.x = 745; near.y = 1320; near.angle = Math.PI / 2;
  for (let i = 0; i < 8; i += 1) {
    const p = state.traffic.peds[i];
    p.x = 600 + i * 46; p.y = 1290 + (i % 3) * 26;
    p.tx = 900; p.ty = 1200;
  }
  state.traffic.cars[0].car.x = 1000; state.traffic.cars[0].car.y = 1250;
  state.traffic.cars[1].car.x = 1600; state.traffic.cars[1].car.y = 1250;
  runSteps(state, 30);
  return { screen: SCREEN_PLAY };
}

function stageTitle(state) {
  // Poster over a living city vista: beach, roads, traffic, neon district.
  state.shotCam = 'title';
  state.screen = SCREEN_TITLE;
  state.time = 30;
  state.camera = { x: 1280, y: 1680 };
  runSteps(state, 0);
  return { screen: SCREEN_TITLE };
}

function stageHeist(state) {
  // Mission 5 done: the getaway, banner +$2,500, police far behind.
  state.shotCam = 'heist';
  state.screen = SCREEN_PLAY;
  state.missions.index = 5;
  state.missions.done = [1, 2, 3, 4, 5];
  state.missions.started = true;
  state.cash = 2750 + 2500;
  state.stats.missionsDone = 5;
  const car = createCar(CAR_MODELS[3], 2600, 2050, Math.PI, { id: 4 });
  car.stolen = true;
  state.player.car = car;
  state.player.onFoot = false;
  state.player.x = car.x; state.player.y = car.y;
  state.police.wanted = 2;
  // Police start far back (600) and only close in a little: visible chase,
  // no pile-up on top of the getaway car.
  placePoliceBehind(state, 2, 600);
  state.missions.banner = { text: 'MISI SELESAI: HEIST BANK SOLMARA', sub: '+$2,500 — misi 6 dibuka: Pelarian Terakhir' };
  state.missions.bannerTimer = 99;
  runSteps(state, 100, (s) => roadAutopilot(s, 2050));
  state.missions.bannerTimer = 99;
  return { screen: SCREEN_PLAY };
}

/** Set `state` to the named scene and return the screen to draw. */
export function stageShot(name, state) {
  if (name === 'street') return stageStreet(state);
  if (name === 'title') return stageTitle(state);
  if (name === 'heist') return stageHeist(state);
  return stageChase(state);
}
