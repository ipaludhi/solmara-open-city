// Wanted level 1–5 and the police who respond to it: patrol cars spawn,
// chase Raka, ram his car, and bust him on foot. Lose them (stay out of
// sight) and the heat cools one star at a time.
import { POLICE_MODEL, WANTED_MAX } from './config.js';
import { createCar, driveCar } from './vehicles.js';

export function createPolice() {
  return { cars: [], wanted: 0, unseenTimer: 0, bustTimer: 0, sirenPhase: 0 };
}

export function wantedCount(pol) { return pol.wanted; }

export function addWanted(pol, n, state) {
  const before = pol.wanted;
  pol.wanted = Math.max(0, Math.min(WANTED_MAX, pol.wanted + n));
  if (pol.wanted > before && state) {
    state.floaters.push({ x: state.player.x, y: state.player.y - 30, text: `WANTED ★${pol.wanted}`, color: '#ff4d4d', ttl: 1.6 });
  }
  return pol.wanted;
}

function spawnSpot(state, rng) {
  // On a road 450–700 units from the player, so the chase is visible.
  const a = rng.range(0, Math.PI * 2);
  const d = rng.range(450, 700);
  let x = state.player.x + Math.cos(a) * d;
  let y = state.player.y + Math.sin(a) * d;
  x = Math.max(80, Math.min(3120, x));
  y = Math.max(80, Math.min(2320, y));
  return { x, y };
}

export function updatePolice(pol, dt, state, rng) {
  const player = state.player;
  const px = player.car ? player.car.x : player.x;
  const py = player.car ? player.car.y : player.y;
  pol.sirenPhase += dt * 6;
  // Target patrol count grows with the wanted level (max 4 cars).
  const target = pol.wanted === 0 ? 0 : Math.min(pol.wanted + 1, 4);
  while (pol.cars.length < target) {
    const s = spawnSpot(state, rng);
    const car = createCar(POLICE_MODEL, s.x, s.y, 0, { police: true, id: 200 + pol.cars.length });
    pol.cars.push(car);
  }
  while (pol.cars.length > target) pol.cars.pop();
  // Chase: steer toward the player, ram when close.
  let nearest = Infinity;
  for (const car of pol.cars) {
    const dx = px - car.x; const dy = py - car.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    nearest = Math.min(nearest, d);
    const want = Math.atan2(dy, dx);
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, diff * 2.2));
    const ev = driveCar(car, 1, steer, dt, state.city);
    if (ev.crashed) state.shake = Math.max(state.shake, 6);
    if (d < 60 && player.car) {
      // Ram: shove the player's car and hurt it.
      player.car.speed *= 0.92;
      player.car.hp -= 6 * dt * 10;
      state.shake = Math.max(state.shake, 5);
    }
    if (d < 52 && player.onFoot) {
      pol.bustTimer += dt;
    }
    car.siren = pol.sirenPhase;
  }
  if (nearest > 52 || !player.onFoot) pol.bustTimer = Math.max(0, pol.bustTimer - dt * 2);
  // Heat cools when no patrol car can see the player for 8 seconds.
  if (pol.wanted > 0) {
    if (nearest > 700) {
      pol.unseenTimer += dt;
      if (pol.unseenTimer > 8) {
        pol.wanted -= 1;
        pol.unseenTimer = 0;
        if (state) state.floaters.push({ x: px, y: py - 30, text: 'PANAS MEREDA — ★ turun', color: '#4ade80', ttl: 1.6 });
      }
    } else pol.unseenTimer = 0;
  }
  return { busted: pol.bustTimer > 1.5, nearest };
}
