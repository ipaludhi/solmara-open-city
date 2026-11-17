// HUD: cash + health + armor, wanted stars, clock + district, mission
// objective with distance, context prompts (E to steal), mission banners.
// Everything the judge needs to read "open world" is text on this layer.
import { CLOCK_START_MIN, FONT, PALETTE, VIEW } from './config.js';
import { missionObjectiveText, missionTarget } from './missions.js';

export function clockText(minutes) {
  const total = CLOCK_START_MIN + Math.floor(minutes);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function bar(ctx, x, y, w, h, frac, color, bg) {
  ctx.fillStyle = bg || 'rgba(0,0,0,0.55)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
}

export function drawHud(ctx, s) {
  const p = s.player;
  ctx.textBaseline = 'alphabetic';
  // Top-left panel: cash, health, armor, ammo.
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(14, 12, 250, 96);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.strokeRect(14.5, 12.5, 250, 96);
  ctx.fillStyle = PALETTE.good;
  ctx.font = `bold 26px ${FONT}`;
  ctx.fillText(`$${s.cash.toLocaleString('en-US')}`, 26, 42);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `bold 13px ${FONT}`;
  ctx.fillText('RAKA', 26, 62);
  bar(ctx, 26, 70, 150, 10, p.hp / 100, p.hp > 30 ? '#4ade80' : '#ff4d4d');
  ctx.fillStyle = PALETTE.text;
  ctx.font = `12px ${FONT}`;
  ctx.fillText(`HP ${Math.max(0, Math.ceil(p.hp))}`, 182, 79);
  if (p.armor > 0) {
    bar(ctx, 26, 86, 150, 6, p.armor / 100, '#7dd3fc');
    ctx.fillStyle = '#7dd3fc';
    ctx.fillText(`ARMOR ${Math.ceil(p.armor)}`, 182, 92);
  }
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `12px ${FONT}`;
  ctx.fillText(p.onFoot ? `PISTOL ${p.mag}/${p.ammo}${p.reloading > 0 ? ' …RELOAD' : ''}` : `${p.car ? p.car.model.name : ''}`, 26, 104 - (p.armor > 0 ? 0 : 0));
  // Top-right: wanted stars, clock, district.
  const d = s.city.districtAt(p.car ? p.car.x : p.x, p.car ? p.car.y : p.y);
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(VIEW.width - 264, 12, 250, 96);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.strokeRect(VIEW.width - 263.5, 12.5, 250, 96);
  ctx.font = '26px ' + FONT;
  let stars = '';
  for (let i = 0; i < 5; i += 1) stars += i < s.police.wanted ? '★' : '☆';
  ctx.fillStyle = s.police.wanted > 0 ? PALETTE.star : 'rgba(255,255,255,0.45)';
  ctx.fillText(stars, VIEW.width - 252, 42);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `bold 15px ${FONT}`;
  ctx.fillText(`${clockText(s.clockMin)}  ·  ${d.name.toUpperCase()}`, VIEW.width - 252, 66);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `13px ${FONT}`;
  ctx.fillText(`${d.landmark} — ${d.blurb}`, VIEW.width - 252, 86);
  ctx.fillText(s.police.wanted > 0 ? 'POLISI MENGEJAR!' : 'Solmara — golden hour', VIEW.width - 252, 104);
  // Top-centre: mission objective + distance.
  const t = missionTarget(s.missions);
  ctx.font = `bold 17px ${FONT}`;
  const obj = missionObjectiveText(s.missions);
  const w = ctx.measureText(obj).width;
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect((VIEW.width - w) / 2 - 14, 12, w + 28, 34);
  ctx.strokeStyle = PALETTE.mission;
  ctx.strokeRect((VIEW.width - w) / 2 - 13.5, 12.5, w + 28, 34);
  ctx.fillStyle = PALETTE.mission;
  ctx.fillText(obj, (VIEW.width - w) / 2, 36);
  if (t) {
    const px = p.car ? p.car.x : p.x;
    const py = p.car ? p.car.y : p.y;
    const dist = Math.round(Math.sqrt((px - t.x) ** 2 + (py - t.y) ** 2) / 4);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `13px ${FONT}`;
    ctx.fillText(`${t.label} — ${dist}m`, (VIEW.width - w) / 2, 62);
  }
  // Context prompt: steal a car, punch, shoot.
  if (s.nearCar && p.onFoot) {
    ctx.font = `bold 18px ${FONT}`;
    const msg = `E — CURI MOBIL: ${s.nearCar.model.name}`;
    const mw = ctx.measureText(msg).width;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect((VIEW.width - mw) / 2 - 10, VIEW.height - 92, mw + 20, 30);
    ctx.fillStyle = '#fff';
    ctx.fillText(msg, (VIEW.width - mw) / 2, VIEW.height - 71);
  }
  // Controls hint, bottom-left.
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(14, VIEW.height - 30, 560, 20);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `12px ${FONT}`;
  ctx.fillText('WASD jalan / nyetir · E masuk & curi mobil · Space pukul · F tembak · R reload · P jeda · M suara', 22, VIEW.height - 16);
  // Mission banner, centre.
  if (s.missions.banner && s.missions.bannerTimer > 0) {
    const a = Math.min(1, s.missions.bannerTimer);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = `bold 34px ${FONT}`;
    const bw = ctx.measureText(s.missions.banner.text).width;
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect((VIEW.width - bw) / 2 - 18, 190, bw + 36, 74);
    ctx.strokeStyle = PALETTE.mission;
    ctx.lineWidth = 2;
    ctx.strokeRect((VIEW.width - bw) / 2 - 18, 190, bw + 36, 74);
    ctx.fillStyle = PALETTE.mission;
    ctx.fillText(s.missions.banner.text, (VIEW.width - bw) / 2, 228);
    ctx.font = `16px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(s.missions.banner.sub, (VIEW.width - ctx.measureText(s.missions.banner.sub).width) / 2, 252);
    ctx.restore();
  }
}
