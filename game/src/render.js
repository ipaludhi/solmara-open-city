// Drawing only: the city, the cars, the people, the HUD and the screens in,
// pixels out. The 1280x720 logical view is scaled to the window and centred.
// Golden-hour light: long shadows, warm vignette, sun low over Pantai Sol.
import { DISTRICTS, FONT, PALETTE, ROADS_X, ROADS_Y, ROAD_W, VIEW, WORLD } from './config.js';
import { drawHud } from './hud.js';
import { drawMinimap } from './minimap.js';
import { MISSIONS } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_COMPLETE = 'complete';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();
  function font(size, bold) {
    const key = `${bold ? 'b' : ''}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${bold ? 'bold ' : ''}${size}px ${FONT}`);
    return fonts.get(key);
  }
  function text(value, x, y, size, color, align, bold) {
    ctx.font = font(size, bold);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  function drawCarShape(car) {
    const m = car.model;
    const L = m.len; const W = m.wid;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Long golden-hour shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.fillRect(-L / 2 + 8, -W / 2 + 7, L, W);
    // Wheels.
    ctx.fillStyle = '#14100c';
    const wl = L * 0.28; const ww = 5;
    ctx.fillRect(-wl, -W / 2 - 2, 12, ww);
    ctx.fillRect(-wl, W / 2 - 3, 12, ww);
    ctx.fillRect(wl - 4, -W / 2 - 2, 12, ww);
    ctx.fillRect(wl - 4, W / 2 - 3, 12, ww);
    // Body.
    ctx.fillStyle = car.police ? '#e8e8e8' : m.color;
    rr(ctx, -L / 2, -W / 2, L, W, 6);
    ctx.fill();
    if (car.police) {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-L * 0.08, -W / 2, L * 0.16, W);
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(-L / 2 + 4, -W / 2 + 2, L * 0.22, W - 4);
    }
    // Cabin + windshield.
    ctx.fillStyle = 'rgba(20,24,32,0.85)';
    rr(ctx, -L * 0.18, -W / 2 + 4, L * 0.34, W - 8, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,220,255,0.5)';
    ctx.fillRect(L * 0.16, -W / 2 + 5, 5, W - 10);
    // Headlights.
    ctx.fillStyle = '#fff6c9';
    ctx.fillRect(L / 2 - 2, -W / 2 + 3, 3, 5);
    ctx.fillRect(L / 2 - 2, W / 2 - 8, 3, 5);
    // Police light bar: flashes red / blue with the siren phase.
    if (car.police) {
      const phase = Math.floor(car.siren / 1.2) % 2 === 0;
      ctx.fillStyle = phase ? '#ff2e2e' : '#2563eb';
      ctx.fillRect(-6, -W / 2 - 1, 12, 5);
      ctx.fillStyle = phase ? '#2563eb' : '#ff2e2e';
      ctx.fillRect(-6, W / 2 - 4, 12, 5);
    }
    ctx.restore();
  }

  function drawPerson(x, y, angle, color, phase, down) {
    ctx.save();
    ctx.translate(x, y);
    if (down) {
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.ellipse(0, 0, 13, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      return;
    }
    // Shadow + body + head; legs swing with the walk phase.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(4, 5, 11, 5, 0, 0, Math.PI * 2); ctx.fill();
    const swing = Math.sin(phase) * 4;
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(-swing, 10); ctx.moveTo(0, 2); ctx.lineTo(swing, 10); ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath(); ctx.arc(Math.cos(angle) * 3, Math.sin(angle) * 3 - 7, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawWorld(s) {
    const cam = s.camera;
    const shx = s.shake > 0 ? Math.sin(s.time * 47) * s.shake : 0;
    const shy = s.shake > 0 ? Math.cos(s.time * 39) * s.shake : 0;
    ctx.save();
    ctx.translate(-cam.x + shx, -cam.y + shy);
    // District ground.
    for (const d of DISTRICTS) {
      ctx.fillStyle = d.ground;
      ctx.fillRect(d.x, d.y, d.w, d.h);
    }
    // Sea + sand at the south edge.
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(0, 2280, WORLD.width, 120);
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(0, 2200, WORLD.width, 80);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 8; i += 1) {
      const wx = ((i * 397) % WORLD.width) + Math.sin(s.time * 0.7 + i) * 12;
      ctx.fillRect(wx, 2286 + (i % 3) * 22, 90, 3);
    }
    // Roads: asphalt, sidewalks, dashed centre lines.
    ctx.fillStyle = '#3a332a';
    for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, WORLD.height);
    for (const ry of ROADS_Y) ctx.fillRect(0, ry - ROAD_W / 2, WORLD.width, ROAD_W);
    ctx.fillStyle = PALETTE.sidewalk;
    for (const rx of ROADS_X) {
      ctx.fillRect(rx - ROAD_W / 2 - 10, 0, 10, WORLD.height);
      ctx.fillRect(rx + ROAD_W / 2, 0, 10, WORLD.height);
    }
    for (const ry of ROADS_Y) {
      ctx.fillRect(0, ry - ROAD_W / 2 - 10, WORLD.width, 10);
      ctx.fillRect(0, ry + ROAD_W / 2, WORLD.width, 10);
    }
    ctx.strokeStyle = PALETTE.line;
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 22]);
    for (const rx of ROADS_X) {
      ctx.beginPath(); ctx.moveTo(rx, 0); ctx.lineTo(rx, WORLD.height); ctx.stroke();
    }
    for (const ry of ROADS_Y) {
      ctx.beginPath(); ctx.moveTo(0, ry); ctx.lineTo(WORLD.width, ry); ctx.stroke();
    }
    ctx.setLineDash([]);
    // Trees.
    for (const t of s.city.trees) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(t.x + 6, t.y + 6, t.r, t.r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = PALETTE.tree;
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = PALETTE.treeDark;
      ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, t.r * 0.55, 0, Math.PI * 2); ctx.fill();
    }
    // Market stalls.
    for (const st of s.city.stalls) {
      ctx.fillStyle = st.color;
      ctx.fillRect(st.x - 16, st.y - 12, 32, 24);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(st.x - 16, st.y + 12, 32, 4);
      ctx.fillStyle = '#fff';
      ctx.fillRect(st.x - 10, st.y - 4, 20, 8);
    }
    // Buildings: wall, roof, windows, long shadow.
    for (const b of s.city.buildings) {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(b.x + 10, b.y + 12, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(b.x, b.y, b.w, 8);
      ctx.fillStyle = PALETTE.window;
      const cols = Math.max(1, Math.floor(b.w / 34));
      const rows = Math.max(1, Math.floor(b.h / 34));
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          ctx.fillRect(b.x + 10 + cx * 34, b.y + 10 + cy * 34, 12, 10);
        }
      }
      if (b.tall) {
        ctx.fillStyle = 'rgba(255,46,136,0.85)';
        ctx.fillRect(b.x + b.w / 2 - 4, b.y - 26, 8, 26);
        ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y - 28, 7, 0, Math.PI * 2); ctx.fill();
      }
    }
    // Landmark labels (skipped when the mission beacon already names the place).
    ctx.textAlign = 'center';
    for (const lm of s.city.landmarks) {
      if (s.missionTarget && Math.abs(lm.x - s.missionTarget.x) < 100 && Math.abs(lm.y - s.missionTarget.y) < 100) continue;
      ctx.font = font(13, true);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(lm.x - 52, lm.y - 58, 104, 20);
      ctx.fillStyle = '#ffe9b0';
      ctx.fillText(lm.name.toUpperCase(), lm.x, lm.y - 44);
    }
    ctx.textAlign = 'left';
    // Skid marks.
    ctx.strokeStyle = 'rgba(20,16,12,0.45)';
    ctx.lineWidth = 4;
    for (const sk of s.skids) {
      ctx.globalAlpha = Math.max(0, sk.ttl / 6);
      ctx.beginPath(); ctx.moveTo(sk.x1, sk.y1); ctx.lineTo(sk.x2, sk.y2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Mission target beacon: column of light + pulsing ring.
    const mt = s.missionTarget;
    if (mt) {
      const pulse = 1 + Math.sin(s.time * 5) * 0.15;
      ctx.fillStyle = 'rgba(255,210,62,0.18)';
      ctx.fillRect(mt.x - 14, mt.y - 260, 28, 260);
      ctx.strokeStyle = PALETTE.mission;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(mt.x, mt.y, 46 * pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = PALETTE.mission;
      ctx.beginPath(); ctx.arc(mt.x, mt.y, 8, 0, Math.PI * 2); ctx.fill();
      // Beacon label below the ring: the landmark label (if any) sits above.
      ctx.font = font(14, true);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.fillText(mt.label.toUpperCase(), mt.x, mt.y + 72);
      ctx.textAlign = 'left';
    }
    // Pickups.
    for (const k of s.combat.pickups) {
      const bob = Math.sin(s.time * 4 + k.x) * 3;
      ctx.save();
      ctx.translate(k.x, k.y + bob);
      if (k.kind === 'cash') { ctx.fillStyle = '#4ade80'; ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill(); text('$', -4, 5, 15, '#062b16', 'left', true); }
      if (k.kind === 'health') { ctx.fillStyle = '#fff'; ctx.fillRect(-9, -9, 18, 18); ctx.fillStyle = '#ef4444'; ctx.fillRect(-3, -7, 6, 14); ctx.fillRect(-7, -3, 14, 6); }
      if (k.kind === 'ammo') { ctx.fillStyle = '#7dd3fc'; ctx.fillRect(-8, -8, 16, 16); ctx.fillStyle = '#0c2b3a'; ctx.fillRect(-4, -5, 3, 10); ctx.fillRect(1, -5, 3, 10); }
      if (k.kind === 'armor') { ctx.fillStyle = '#94a3b8'; ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#1e293b'; ctx.fillRect(-5, -6, 10, 12); }
      ctx.restore();
    }
    // Pedestrians.
    for (const p of s.traffic.peds) drawPerson(p.x, p.y, 0, p.color, p.phase, p.state === 'down');
    // Parked cars.
    for (const car of s.traffic.parked) drawCarShape(car);
    // NPC traffic.
    for (const n of s.traffic.cars) drawCarShape(n.car);
    // Police.
    for (const car of s.police.cars) drawCarShape(car);
    // Player: car or on foot.
    const pl = s.player;
    if (pl.car) drawCarShape(pl.car);
    else if (!(pl.invuln > 0 && Math.floor(pl.invuln * 10) % 2 === 0)) {
      drawPerson(pl.x, pl.y, pl.angle, '#e63946', pl.walkPhase, false);
      // Raka's red jacket reads at a glance; a white outline keeps him visible.
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(pl.x, pl.y, 13, 0, Math.PI * 2); ctx.stroke();
    }
    // Bullets.
    ctx.fillStyle = '#ffe066';
    for (const b of s.combat.bullets) {
      ctx.beginPath(); ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    // Particles.
    for (const pt of s.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Floating texts.
    ctx.textAlign = 'center';
    for (const f of s.floaters) {
      ctx.globalAlpha = Math.min(1, f.ttl);
      ctx.font = font(17, true);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    ctx.restore();
    // Golden-hour vignette + warm wash over the whole view.
    const grad = ctx.createRadialGradient(640, 360, 260, 640, 360, 780);
    grad.addColorStop(0, 'rgba(255,170,80,0)');
    grad.addColorStop(1, 'rgba(120,40,10,0.28)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  function drawPanel(title, lines, prompt, accent) {
    const w = 640;
    const h = 150 + lines.length * 34 + 60;
    const x = (VIEW.width - w) / 2;
    const y = (VIEW.height - h) / 2;
    ctx.fillStyle = 'rgba(12,9,6,0.88)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = accent || PALETTE.mission;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    ctx.textAlign = 'center';
    text(title, VIEW.width / 2, y + 62, 44, accent || PALETTE.mission, 'center', true);
    lines.forEach((ln, i) => text(ln, VIEW.width / 2, y + 112 + i * 34, 19, PALETTE.text, 'center'));
    text(prompt, VIEW.width / 2, y + h - 30, 19, PALETTE.mission, 'center', true);
    ctx.textAlign = 'left';
  }

  function drawTitle(s) {
    drawWorld(s);
    // Poster panel over the city vista.
    ctx.fillStyle = 'rgba(12,9,6,0.55)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    text('SOLMARA', VIEW.width / 2, 250, 110, '#ffd97a', 'center', true);
    text('OPEN CITY', VIEW.width / 2, 310, 44, '#fff7e6', 'center', true);
    text('Kota pantai. Kru heist. Wanted 1–5. Enam misi, enam distrik.', VIEW.width / 2, 352, 20, PALETTE.muted, 'center');
    text('6 MISI  •  6 DISTRIK  •  CURI MOBIL  •  POLISI MENGEJAR  •  MINIMAP', VIEW.width / 2, 388, 17, PALETTE.mission, 'center', true);
    const hasSave = !!s.save;
    text(hasSave ? 'ENTER — LANJUTKAN (save ditemukan)' : 'ENTER — MULAI CERITA RAKA', VIEW.width / 2, 452, 24, '#fff', 'center', true);
    text('WASD jalan / nyetir · E curi mobil · Space pukul · F tembak · P jeda · M suara', VIEW.width / 2, 492, 16, PALETTE.muted, 'center');
    if (s.best) text(`Terbaik: ${s.best.missionsDone || 0}/6 misi · $${(s.best.cash || 0).toLocaleString('en-US')}`, VIEW.width / 2, 524, 15, PALETTE.muted, 'center');
    text('Game original — semua nama, karakter & kota dibuat untuk SOLMARA.', VIEW.width / 2, 640, 14, PALETTE.muted, 'center');
    ctx.textAlign = 'left';
  }

  function draw(s) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#14100c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (s.screen === SCREEN_TITLE) { drawTitle(s); return; }
    drawWorld(s);
    drawHud(ctx, s);
    drawMinimap(ctx, s);
    if (s.screen === SCREEN_PAUSED) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      drawPanel('JEDA', ['Solmara menunggumu, Raka.', `Misi: ${MISSIONS[s.missions.index] ? MISSIONS[s.missions.index].name : 'tamat'} · $${s.cash.toLocaleString('en-US')}`], 'P — lanjutkan · Enter — kembali ke judul');
    } else if (s.screen === SCREEN_BUSTED) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      drawPanel('BUSTED!', ['Polisi Solmara menangkapmu.', 'Denda $100 — Kru Senja membebaskanmu.', `Uang sekarang $${s.cash.toLocaleString('en-US')}`], 'Enter — kembali ke jalan', '#ff4d4d');
    } else if (s.screen === SCREEN_WASTED) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      drawPanel('WASTED', ['Raka tumbang di jalanan Solmara.', 'Kru Senja menarikmu keluar. Coba lagi.', `Misi selesai: ${s.missions.done.length}/6`], 'Enter — coba lagi', '#ff4d4d');
    } else if (s.screen === SCREEN_COMPLETE) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      drawPanel('CERITA TAMAT', ['Raka & Kru Senja kabur lewat Dermaga Sol.', `6/6 misi · $${s.cash.toLocaleString('en-US')} · ${s.stats.carsStolen} mobil dicuri`, 'Solmara milikmu sekarang.'], 'Enter — main lagi dari awal', '#4ade80');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
