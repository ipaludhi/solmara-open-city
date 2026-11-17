// Cars: arcade physics (accelerate, steer, brake, drift), building
// collisions, skid marks. One shared mover serves the player, NPC traffic
// and police — police just steer toward a target instead of keys.
import { WORLD } from './config.js';

export function createCar(model, x, y, angle, opts = {}) {
  return {
    model, x, y, angle, speed: 0, steer: 0,
    parked: !!opts.parked, npc: !!opts.npc, police: !!opts.police,
    stolen: false, hp: 100, brakeLight: false, siren: 0,
    driverFled: false, id: opts.id ?? 0,
  };
}

// Drive with explicit throttle (-1..1) and steering (-1..1). Returns an
// event object when something notable happens (crash / skid).
export function driveCar(car, throttle, steer, dt, city) {
  const m = car.model;
  const events = { crashed: false, skidding: false };
  const target = throttle * m.top;
  const accel = throttle !== 0 ? m.accel : m.accel * 0.9;
  if (car.speed < target) car.speed = Math.min(target, car.speed + accel * dt);
  else if (car.speed > target) car.speed = Math.max(target, car.speed - accel * 1.6 * dt);
  car.brakeLight = throttle < 0 && car.speed > 30;
  const grip = m.grip;
  const turn = steer * grip * dt * Math.min(1, Math.abs(car.speed) / 90 + 0.25);
  car.angle += turn * Math.sign(car.speed || 1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const half = m.len / 2;
  const fx = nx + Math.cos(car.angle) * half;
  const fy = ny + Math.sin(car.angle) * half;
  const bx = nx - Math.cos(car.angle) * half;
  const by = ny - Math.sin(car.angle) * half;
  if (city.blocked(fx, fy, 8) || city.blocked(bx, by, 8) ||
      nx < half || ny < half || nx > WORLD.width - half || ny > WORLD.height - half) {
    if (Math.abs(car.speed) > 120) events.crashed = true;
    car.speed *= -0.25;
  } else {
    car.x = nx; car.y = ny;
  }
  if (Math.abs(steer) > 0.6 && Math.abs(car.speed) > 180) events.skidding = true;
  return events;
}

export function carFront(car) {
  const half = car.model.len / 2;
  return { x: car.x + Math.cos(car.angle) * half, y: car.y + Math.sin(car.angle) * half };
}

export function distToCar(px, py, car) {
  const dx = px - car.x; const dy = py - car.y;
  return Math.sqrt(dx * dx + dy * dy);
}
