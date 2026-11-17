// Traffic: NPC cars that follow the road grid (lane, turn at intersections)
// and pedestrians on the sidewalks who flee from a speeding car. Parked cars
// wait by the kerb to be stolen.
import { CAR_MODELS, ROADS_X, ROADS_Y, WORLD } from './config.js';
import { createCar, driveCar } from './vehicles.js';

export function createTraffic(rng, city) {
  const cars = [];
  for (let i = 0; i < 14; i += 1) {
    const p = city.roadPoint();
    const vertical = rng.chance(0.5);
    const model = rng.pick(CAR_MODELS);
    const car = createCar(model, p.x, p.y, vertical ? Math.PI / 2 : 0, { npc: true, id: 100 + i });
    car.speed = rng.range(90, 160);
    cars.push({ car, vertical, dir: rng.pick([-1, 1]), cruise: rng.range(90, 170), turnAt: null });
  }
  const peds = [];
  const shirts = ['#e8e8e8', '#f2c94c', '#7dd3fc', '#fda4af', '#a7f3d0', '#fca5a5'];
  for (let i = 0; i < 24; i += 1) {
    const p = city.sidewalkPoint();
    const t = city.sidewalkPoint();
    peds.push({ x: p.x, y: p.y, tx: t.x, ty: t.y, speed: rng.range(45, 80), state: 'walk', down: 0, color: rng.pick(shirts), phase: rng.range(0, 6) });
  }
  // Parked cars along the kerb; the green Cendrawasih Sport in Distrik Neon
  // is mission 4's target — always there, always stealable.
  const parked = [];
  // Parked ON road x=2200 so the stolen car can actually drive away
  // (a car parked inside a block would ram a building on its first metre).
  const sportSpot = { x: 2200, y: 500 };
  parked.push(createCar(CAR_MODELS[3], sportSpot.x, sportSpot.y, Math.PI / 2, { parked: true, id: 4 }));
  for (let i = 0; i < 7; i += 1) {
    const p = city.roadPoint();
    const model = rng.pick(CAR_MODELS);
    parked.push(createCar(model, p.x + rng.pick([-70, 70]), p.y + rng.pick([-70, 70]), rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]), { parked: true, id: 10 + i }));
  }
  return { cars, peds, parked };
}

function onRoadCentre(v, roads) {
  for (const r of roads) if (Math.abs(v - r) < 14) return r;
  return null;
}

export function updateTraffic(t, dt, city, rng, player, playerCar) {
  for (const n of t.cars) {
    const c = n.car;
    // At an intersection, sometimes turn onto the crossing road.
    const cross = n.vertical ? onRoadCentre(c.x, ROADS_X) : onRoadCentre(c.y, ROADS_Y);
    if (cross !== null && rng.chance(0.012)) {
      n.vertical = !n.vertical;
      n.dir = rng.pick([-1, 1]);
      c.angle = n.vertical ? (n.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (n.dir > 0 ? 0 : Math.PI);
    }
    // Brake for the player's car ahead.
    let throttle = 1;
    if (playerCar) {
      const dx = playerCar.x - c.x; const dy = playerCar.y - c.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      const ahead = dx * Math.cos(c.angle) + dy * Math.sin(c.angle);
      if (d < 130 && ahead > 0) throttle = 0.2;
    }
    const target = n.cruise * throttle;
    if (c.speed < target) c.speed += 120 * dt;
    else if (c.speed > target) c.speed -= 200 * dt;
    const step = c.speed * n.dir * dt;
    if (n.vertical) c.y += step; else c.x += step;
    c.angle = n.vertical ? (n.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (n.dir > 0 ? 0 : Math.PI);
    // Wrap around the city edge instead of vanishing.
    if (c.x < -60) c.x = WORLD.width + 50;
    if (c.x > WORLD.width + 60) c.x = -50;
    if (c.y < -60) c.y = WORLD.height + 50;
    if (c.y > WORLD.height + 60) c.y = -50;
  }
  for (const p of t.peds) {
    if (p.state === 'down') { p.down -= dt; if (p.down <= 0) p.state = 'walk'; continue; }
    // Flee a fast car bearing down on the sidewalk.
    let fx = 0; let fy = 0; let fleeing = false;
    if (playerCar && Math.abs(playerCar.speed) > 90) {
      const dx = p.x - playerCar.x; const dy = p.y - playerCar.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 150) { fx = dx / (d || 1); fy = dy / (d || 1); fleeing = true; }
    }
    let mx; let my;
    if (fleeing) { mx = fx; my = fy; }
    else {
      const dx = p.tx - p.x; const dy = p.ty - p.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 12) { const t = city.sidewalkPoint(); p.tx = t.x; p.ty = t.y; continue; }
      mx = dx / d; my = dy / d;
    }
    const sp = fleeing ? p.speed * 2.2 : p.speed;
    const nx = p.x + mx * sp * dt;
    const ny = p.y + my * sp * dt;
    if (!city.blocked(nx, p.y, 8)) p.x = nx;
    if (!city.blocked(p.x, ny, 8)) p.y = ny;
    p.phase += dt * 8;
  }
}

// A pedestrian hit by a fast car goes down and drops cash. Returns events.
export function hitPedestrians(t, playerCar, state) {
  const events = [];
  if (!playerCar || Math.abs(playerCar.speed) < 80) return events;
  for (const p of t.peds) {
    if (p.state !== 'walk') continue;
    const dx = p.x - playerCar.x; const dy = p.y - playerCar.y;
    if (dx * dx + dy * dy < 34 * 34) {
      p.state = 'down'; p.down = 6;
      state.combat.pickups.push({ kind: 'cash', x: p.x, y: p.y, amount: 25, ttl: 20 });
      events.push({ type: 'pedHit', x: p.x, y: p.y });
    }
  }
  return events;
}
export { driveCar };
