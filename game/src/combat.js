// Combat: punch up close, pistol with magazine + reload, bullets that hit
// pedestrians and police cars, and pickups (cash, health, ammo, armor).
// Shooting and hurting people raises the wanted level — the city notices.
import { PISTOL, PLAYER } from './config.js';
import { addWanted } from './police.js';

export function createCombat() {
  return {
    bullets: [],
    pickups: [
      { kind: 'health', x: 600, y: 900, amount: 40, ttl: 999 },
      { kind: 'ammo', x: 1600, y: 600, amount: 24, ttl: 999 },
      { kind: 'armor', x: 2500, y: 1500, amount: 50, ttl: 999 },
      { kind: 'cash', x: 1000, y: 350, amount: 50, ttl: 999 },
      { kind: 'cash', x: 2200, y: 1250, amount: 50, ttl: 999 },
      { kind: 'cash', x: 400, y: 2050, amount: 75, ttl: 999 },
    ],
    lastShotHeat: -10,
  };
}

export function tryShoot(combat, state) {
  const p = state.player;
  if (p.onFoot === false) return false; // no drive-by: shoot on foot only
  if (p.reloading > 0 || p.fireCooldown > 0) return false;
  if (p.mag <= 0) {
    if (p.ammo > 0) { p.reloading = PISTOL.reloadTime; state.audio.blip(); }
    return false;
  }
  p.mag -= 1;
  p.fireCooldown = PISTOL.fireInterval;
  const aim = Math.atan2(state.input.mouse.y - 360, state.input.mouse.x - 640);
  // Aim from the player toward the mouse in world space (camera centred).
  const wx = state.camera.x + state.input.mouse.x;
  const wy = state.camera.y + state.input.mouse.y;
  const ang = Math.atan2(wy - p.y, wx - p.x);
  combat.bullets.push({ x: p.x + Math.cos(ang) * 20, y: p.y + Math.sin(ang) * 20, vx: Math.cos(ang) * 900, vy: Math.sin(ang) * 900, life: PISTOL.range / 900 });
  state.audio.shot();
  // Firing in public raises heat, at most once per 3 seconds.
  if (state.time - combat.lastShotHeat > 3) {
    combat.lastShotHeat = state.time;
    addWanted(state.police, 1, state);
  }
  return true;
}

export function tryPunch(combat, state) {
  const p = state.player;
  if (!p.onFoot || p.fireCooldown > 0) return false;
  p.fireCooldown = 0.35;
  let hit = false;
  for (const ped of state.traffic.peds) {
    if (ped.state !== 'walk') continue;
    const dx = ped.x - p.x; const dy = ped.y - p.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    const facing = Math.cos(Math.atan2(dy, dx) - p.angle);
    if (d < PLAYER.punchRange + 8 && facing > 0.3) {
      ped.state = 'down'; ped.down = 6;
      combat.pickups.push({ kind: 'cash', x: ped.x, y: ped.y, amount: 20, ttl: 20 });
      hit = true;
    }
  }
  if (hit) state.audio.punch();
  return hit;
}

export function updateCombat(combat, dt, state) {
  // Bullets fly, hit pedestrians and police cars.
  for (let i = combat.bullets.length - 1; i >= 0; i -= 1) {
    const b = combat.bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    let dead = b.life <= 0 || state.city.blocked(b.x, b.y, 2);
    if (!dead) {
      for (const ped of state.traffic.peds) {
        if (ped.state !== 'walk') continue;
        const dx = ped.x - b.x; const dy = ped.y - b.y;
        if (dx * dx + dy * dy < 16 * 16) {
          ped.state = 'down'; ped.down = 6;
          combat.pickups.push({ kind: 'cash', x: ped.x, y: ped.y, amount: 20, ttl: 20 });
          addWanted(state.police, 1, state);
          state.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.4, max: 0.4, color: '#ff4d4d', size: 5 });
          dead = true; break;
        }
      }
    }
    if (!dead) {
      for (const car of state.police.cars) {
        const dx = car.x - b.x; const dy = car.y - b.y;
        if (dx * dx + dy * dy < 30 * 30) {
          car.hp -= PISTOL.damage;
          state.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.4, max: 0.4, color: '#ffd23e', size: 5 });
          if (car.hp <= 0) {
            car.hp = 100; car.speed = 0;
            state.cash += 50;
            state.floaters.push({ x: car.x, y: car.y - 30, text: '+$50', color: '#4ade80', ttl: 1.4 });
            addWanted(state.police, 1, state);
          }
          dead = true; break;
        }
      }
    }
    if (dead) combat.bullets.splice(i, 1);
  }
  // Pickups: walk or drive over them.
  const p = state.player;
  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;
  for (let i = combat.pickups.length - 1; i >= 0; i -= 1) {
    const k = combat.pickups[i];
    k.ttl -= dt;
    const dx = k.x - px; const dy = k.y - py;
    if (dx * dx + dy * dy < 32 * 32) {
      if (k.kind === 'cash') { state.cash += k.amount; state.floaters.push({ x: k.x, y: k.y - 20, text: `+$${k.amount}`, color: '#4ade80', ttl: 1.2 }); }
      if (k.kind === 'health') { p.hp = Math.min(100, p.hp + k.amount); state.floaters.push({ x: k.x, y: k.y - 20, text: `+${k.amount} HP`, color: '#4ade80', ttl: 1.2 }); }
      if (k.kind === 'ammo') { p.ammo += k.amount; state.floaters.push({ x: k.x, y: k.y - 20, text: `+${k.amount} AMMO`, color: '#7dd3fc', ttl: 1.2 }); }
      if (k.kind === 'armor') { p.armor = Math.min(100, p.armor + k.amount); state.floaters.push({ x: k.x, y: k.y - 20, text: `+${k.amount} ARMOR`, color: '#7dd3fc', ttl: 1.2 }); }
      state.audio.blip();
      combat.pickups.splice(i, 1);
      continue;
    }
    if (k.ttl <= 0) combat.pickups.splice(i, 1);
  }
}
