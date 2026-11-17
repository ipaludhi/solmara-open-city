// Raka on foot: walk, collide with buildings, face the way he moves.
// Driving lives in vehicles.js; entering / leaving a car is wired in main.js.
import { PLAYER, WORLD } from './config.js';

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, hp: PLAYER.hp, armor: 0,
    onFoot: true, car: null, walkPhase: 0, invuln: 0,
    ammo: 24, mag: 12, reloading: 0, fireCooldown: 0,
  };
}

// Axis-separated movement so Raka slides along walls instead of sticking.
export function updateOnFoot(p, input, city, dt) {
  const v = input.moveVector();
  const speed = PLAYER.walkSpeed;
  const nx = p.x + v.x * speed * dt;
  const ny = p.y + v.y * speed * dt;
  if (!city.blocked(nx, p.y, PLAYER.radius)) p.x = nx;
  if (!city.blocked(p.x, ny, PLAYER.radius)) p.y = ny;
  p.x = Math.max(PLAYER.radius, Math.min(WORLD.width - PLAYER.radius, p.x));
  p.y = Math.max(PLAYER.radius, Math.min(WORLD.height - PLAYER.radius, p.y));
  if (v.x !== 0 || v.y !== 0) {
    p.angle = Math.atan2(v.y, v.x);
    p.walkPhase += dt * 11;
  }
  if (p.invuln > 0) p.invuln -= dt;
  if (p.fireCooldown > 0) p.fireCooldown -= dt;
  if (p.reloading > 0) {
    p.reloading -= dt;
    if (p.reloading <= 0) {
      const need = 12 - p.mag;
      const take = Math.min(need, p.ammo);
      p.mag += take; p.ammo -= take;
    }
  }
}

export function damagePlayer(p, amount) {
  if (p.invuln > 0) return 0;
  let left = amount;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, left);
    p.armor -= absorbed; left -= absorbed;
  }
  p.hp -= left;
  p.invuln = 0.6;
  return left;
}
