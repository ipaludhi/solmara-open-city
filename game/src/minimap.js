// Minimap: the whole city at a glance — districts, roads, the player,
// police, mission target and the getaway car. Bottom-right, always on.
import { DISTRICTS, FONT, PALETTE, ROADS_X, ROADS_Y, VIEW, WORLD } from './config.js';
import { missionTarget } from './missions.js';

const MW = 200; const MH = 150;
const SX = MW / WORLD.width; const SY = MH / WORLD.height;
const MX = VIEW.width - MW - 14; const MY = VIEW.height - MH - 14;

export function drawMinimap(ctx, s) {
  ctx.save();
  ctx.fillStyle = 'rgba(10,8,6,0.82)';
  ctx.fillRect(MX, MY, MW, MH);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.strokeRect(MX + 0.5, MY + 0.5, MW, MH);
  ctx.beginPath();
  ctx.rect(MX, MY, MW, MH);
  ctx.clip();
  // Districts as ground tints.
  for (const d of DISTRICTS) {
    ctx.fillStyle = d.ground;
    ctx.fillRect(MX + d.x * SX, MY + d.y * SY, d.w * SX, d.h * SY);
  }
  // Water at the south edge.
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(MX, MY + 2280 * SY, MW, 120 * SY);
  // Roads.
  ctx.strokeStyle = '#2b2620';
  ctx.lineWidth = 5;
  for (const rx of ROADS_X) {
    ctx.beginPath(); ctx.moveTo(MX + rx * SX, MY); ctx.lineTo(MX + rx * SX, MY + MH); ctx.stroke();
  }
  for (const ry of ROADS_Y) {
    ctx.beginPath(); ctx.moveTo(MX, MY + ry * SY); ctx.lineTo(MX + MW, MY + ry * SY); ctx.stroke();
  }
  // Mission target: pulsing yellow diamond.
  const t = missionTarget(s.missions);
  if (t) {
    const pulse = 3 + Math.sin(s.time * 6) * 1.5;
    ctx.fillStyle = PALETTE.mission;
    ctx.beginPath();
    ctx.moveTo(MX + t.x * SX, MY + t.y * SY - pulse - 3);
    ctx.lineTo(MX + t.x * SX + pulse + 3, MY + t.y * SY);
    ctx.lineTo(MX + t.x * SX, MY + t.y * SY + pulse + 3);
    ctx.lineTo(MX + t.x * SX - pulse - 3, MY + t.y * SY);
    ctx.closePath(); ctx.fill();
  }
  // Parked stealable cars: green dots (mission 4 target is the big one).
  for (const car of s.traffic.parked) {
    ctx.fillStyle = '#4ade80';
    ctx.beginPath(); ctx.arc(MX + car.x * SX, MY + car.y * SY, car.id === 4 ? 3.5 : 2, 0, Math.PI * 2); ctx.fill();
  }
  // Police: red dots with a white ring.
  for (const car of s.police.cars) {
    ctx.fillStyle = '#ff2e2e';
    ctx.beginPath(); ctx.arc(MX + car.x * SX, MY + car.y * SY, 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // Player: white arrow pointing where Raka faces.
  const p = s.player;
  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;
  const ang = p.car ? p.car.angle : p.angle;
  ctx.save();
  ctx.translate(MX + px * SX, MY + py * SY);
  ctx.rotate(ang);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(7, 0); ctx.lineTo(-5, -4.5); ctx.lineTo(-5, 4.5);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  // Label + compass.
  ctx.fillStyle = PALETTE.text;
  ctx.font = `bold 11px ${FONT}`;
  ctx.fillText('SOLMARA', MX + 4, MY - 5);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `11px ${FONT}`;
  ctx.fillText('N ↑', MX + MW - 24, MY - 5);
}
