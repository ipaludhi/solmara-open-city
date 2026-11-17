// Drawing only — now in 3D. The world is rendered with raw WebGL (see
// gl3d.js); the HUD, minimap, labels and screen panels are drawn on a 2D
// overlay canvas stacked above it. Same public shape as before:
// createRenderer(canvas) -> { draw(state) }, same SCREEN_* constants, same
// stateDump contract in main.js. Golden hour: low sun over Pantai Sol, warm
// fog, long shadows.
import { FONT, PALETTE, VIEW, WORLD } from './config.js';
import { drawHud } from './hud.js';
import { drawMinimap } from './minimap.js';
import { MISSIONS, missionTarget } from './missions.js';
import {
  GL3D, hexRgb, mat4Identity, mat4LookAt, mat4Model, mat4Multiply,
  mat4Perspective, mat4RotX, mat4RotY, mat4Scale, mat4Translate,
} from './gl3d.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_COMPLETE = 'complete';

const WHITE = [1, 1, 1];
const PICKUP_COLORS = { cash: '#4ade80', health: '#ff6b6b', ammo: '#7dd3fc', armor: '#94a3b8' };

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export function createRenderer(canvas) {
  const status = document.getElementById('status');
  let gl3d = null;
  try {
    gl3d = new GL3D(canvas);
  } catch (e) {
    // No WebGL (very old browser): say so plainly instead of a black screen.
    window.__glOK = false;
    if (status) status.textContent = 'SOLMARA butuh WebGL — browser ini tidak mendukungnya.';
    const ctx2d = canvas.getContext('2d');
    return {
      draw() {
        if (!ctx2d) return;
        ctx2d.fillStyle = '#14100c';
        ctx2d.fillRect(0, 0, canvas.width, canvas.height);
        ctx2d.fillStyle = '#ffd97a';
        ctx2d.font = 'bold 40px system-ui, sans-serif';
        ctx2d.textAlign = 'center';
        ctx2d.fillText('SOLMARA butuh WebGL', canvas.width / 2, canvas.height / 2);
      },
    };
  }
  window.__glOK = true;
  const overlay = document.getElementById('hud');
  const octx = overlay.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  let lastW = 0; let lastH = 0;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    if (width === lastW && height === lastH) return;
    lastW = width; lastH = height;
    gl3d.resize(width, height);
    overlay.width = width; overlay.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  // Camera: third-person chase behind the player (or a cinematic frame for
  // the staged screenshots). Pure function of state — no smoothing history —
  // so a staged frame is identical on every run.
  function cameraFor(s) {
    const p = s.player;
    const focus = p.car ? { x: p.car.x, y: p.car.y, a: p.car.angle } : { x: p.x, y: p.y, a: p.angle };
    const fwd = [Math.cos(focus.a), 0, Math.sin(focus.a)];
    const right = [-Math.sin(focus.a), 0, Math.cos(focus.a)];
    const shx = s.shake > 0 ? Math.sin(s.time * 47) * s.shake * 0.6 : 0;
    const shy = s.shake > 0 ? Math.cos(s.time * 39) * s.shake * 0.4 : 0;
    const shz = s.shake > 0 ? Math.sin(s.time * 43) * s.shake * 0.6 : 0;
    if (s.shotCam === 'title') {
      // Aerial vista looking SOUTH-WEST over the city toward the beach and
      // the sunset: foreground blocks, midground Pantai Sol + sea, sun glow.
      return { eye: [1750, 520, 420], target: [950, 120, 2050], fov: 60 * Math.PI / 180 };
    }
    if (s.shotCam === 'street') {
      // Low 3/4 view from the road EAST of Raka, looking west: Raka reads in
      // front of the parked truck (which sits north-west of him), peds and
      // stalls around. Roads are clear of buildings by construction, so the
      // eye never sits inside one; a short lift remains as a safety net.
      let ex = focus.x + 170; let ey = 75; let ez = focus.y - 40;
      for (let i = 0; i < 3 && s.city.blocked(ex, ez, 30); i += 1) ey += 40;
      return {
        eye: [ex, ey, ez],
        target: [focus.x, 25, focus.y + 10],
        fov: 55 * Math.PI / 180,
      };
    }
    if (s.shotCam === 'chase' || s.shotCam === 'heist') {
      // Camera ahead of the getaway car, looking back down the chase: the
      // player car reads large, the patrol cars trail behind it in frame.
      const dist = s.shotCam === 'heist' ? 290 : 270;
      const height = s.shotCam === 'heist' ? 110 : 100;
      const eye = [
        focus.x + fwd[0] * dist + right[0] * 130 + shx,
        height + shy,
        focus.y + fwd[2] * dist + right[2] * 130 + shz,
      ];
      // Aim between the player car and the nearest patrol car behind it.
      let aim = [focus.x - fwd[0] * 40, 14, focus.y - fwd[2] * 40];
      if (s.police.cars.length > 0) {
        let best = null; let bestD = Infinity;
        for (const pc of s.police.cars) {
          const d = Math.hypot(pc.x - focus.x, pc.y - focus.y);
          if (d < bestD) { bestD = d; best = pc; }
        }
        if (best) {
          aim = [
            focus.x * 0.65 + best.x * 0.35,
            14,
            focus.y * 0.65 + best.y * 0.35,
          ];
        }
      }
      return { eye, target: aim, fov: 55 * Math.PI / 180 };
    }
    if (s.screen === SCREEN_TITLE) {
      // Live title: slow aerial drift over the beach and the neon district.
      const t = s.time * 0.05;
      return {
        eye: [1600 + Math.sin(t) * 300, 850, 2700 + Math.cos(t) * 150],
        target: [1600, 0, 1300],
        fov: 60 * Math.PI / 180,
      };
    }
    const dist = p.car ? 240 : 165;
    const height = p.car ? 135 : 105;
    const lateral = p.car ? 55 : 45;
    const lookAhead = p.car ? 90 : 55;
    return {
      eye: [
        focus.x - fwd[0] * dist + right[0] * lateral + shx,
        height + shy,
        focus.y - fwd[2] * dist + right[2] * lateral + shz,
      ],
      target: [focus.x + fwd[0] * lookAhead, p.car ? 18 : 22, focus.y + fwd[2] * lookAhead],
      fov: 55 * Math.PI / 180,
    };
  }

  function makeProject(viewProj) {
    return (x, h, z) => {
      const cx = viewProj[0] * x + viewProj[4] * h + viewProj[8] * z + viewProj[12];
      const cy = viewProj[1] * x + viewProj[5] * h + viewProj[9] * z + viewProj[13];
      const cw = viewProj[3] * x + viewProj[7] * h + viewProj[11] * z + viewProj[15];
      if (cw <= 0.01) return null;
      return {
        x: ((cx / cw) + 1) / 2 * VIEW.width,
        y: (1 - (cy / cw)) / 2 * VIEW.height,
      };
    };
  }

  function drawWorld3D(s, viewProj, view) {
    const gl = gl3d.gl;
    gl3d.ensureStatic(s.city);
    const cam = cameraFor(s);
    window.__cam = {
      eye: cam.eye.map((v) => Math.round(v)),
      target: cam.target.map((v) => Math.round(v)),
    };
    const proj = mat4Perspective(cam.fov, VIEW.width / VIEW.height, 1, 8000);
    const viewM = mat4LookAt(cam.eye, cam.target, [0, 1, 0]);
    const vp = mat4Multiply(proj, viewM);
    gl3d.beginFrame();
    gl3d.drawSky(vp, viewM, cam.eye);
    gl3d.drawStatic(vp, viewM);
    gl3d.useOpaque(vp, viewM, 1);
    const M = gl3d.meshes;
    const carModel = (car) => mat4Model(car.x, 0, car.y, -car.angle, car.model.len, 1, car.model.wid);
    // Parked cars, NPC traffic, police, the player's car.
    for (const car of s.traffic.parked) gl3d.drawOpaqueMesh(M.car, carModel(car), hexRgb(car.model.color));
    for (const n of s.traffic.cars) gl3d.drawOpaqueMesh(M.car, carModel(n.car), hexRgb(n.car.model.color));
    for (const car of s.police.cars) {
      gl3d.drawOpaqueMesh(M.police, carModel(car), [1, 1, 1]);
      // Light bar: red / blue alternate with the siren phase.
      const phase = Math.floor(car.siren / 1.2) % 2 === 0;
      const rx = -Math.sin(car.angle); const rz = Math.cos(car.angle);
      const fx = Math.cos(car.angle); const fz = Math.sin(car.angle);
      const left = [car.x + rx * -3 - fx * 2, 16, car.y + rz * -3 - fz * 2];
      const right = [car.x + rx * 3 - fx * 2, 16, car.y + rz * 3 - fz * 2];
      const lm = phase ? M.lightRed : M.lightBlue;
      const rm = phase ? M.lightBlue : M.lightRed;
      gl3d.drawOpaqueMesh(lm, mat4Model(left[0], left[1], left[2], -car.angle, 8, 3, 6), WHITE);
      gl3d.drawOpaqueMesh(rm, mat4Model(right[0], right[1], right[2], -car.angle, 8, 3, 6), WHITE);
      if (car.brakeLight) {
        gl3d.drawOpaqueMesh(M.lightRed, mat4Model(car.x - fx * (car.model.len / 2), 8, car.y - fz * (car.model.len / 2), -car.angle, 2, 3, 5), WHITE);
      }
    }
    const pl = s.player;
    if (pl.car) gl3d.drawOpaqueMesh(M.car, carModel(pl.car), hexRgb(pl.car.model.color));
    else if (!(pl.invuln > 0 && Math.floor(pl.invuln * 10) % 2 === 0)) {
      const bob = Math.abs(Math.sin(pl.walkPhase)) * 2;
      gl3d.drawOpaqueMesh(M.ped, mat4Model(pl.x, bob, pl.y, -pl.angle, 1, 1, 1), hexRgb('#e63946'));
    }
    // Pedestrians (down ones lie flat).
    for (const pd of s.traffic.peds) {
      const ang = Math.atan2(pd.ty - pd.y, pd.tx - pd.x);
      if (pd.state === 'down') {
        const m = mat4Multiply(
          mat4Translate(pd.x, 6, pd.y),
          mat4Multiply(mat4RotY(-ang), mat4RotX(Math.PI / 2)),
        );
        gl3d.drawOpaqueMesh(M.ped, m, hexRgb(pd.color));
      } else {
        const bob = Math.abs(Math.sin(pd.phase)) * 2;
        gl3d.drawOpaqueMesh(M.ped, mat4Model(pd.x, bob, pd.y, -ang, 1, 1, 1), hexRgb(pd.color));
      }
    }
    // Pickups bob above the ground.
    for (const k of s.combat.pickups) {
      const bob = Math.sin(s.time * 4 + k.x) * 3;
      gl3d.drawOpaqueMesh(M.pickup, mat4Model(k.x, 16 + bob, k.y, 0, 1, 1, 1), hexRgb(PICKUP_COLORS[k.kind] || '#ffffff'));
    }
    // Bullets.
    for (const b of s.combat.bullets) {
      gl3d.drawOpaqueMesh(M.bullet, mat4Model(b.x, 14, b.y, 0, 7, 3, 3), WHITE);
    }
    // ---- transparent pass: shadows, skids, beacon, player ring ----
    const sunOff = (h) => [-0.45 * h * 1.6, -0.84 * h * 1.6];
    gl3d.beginTransparent(0.32);
    const shadowCar = (car) => {
      const o = sunOff(14);
      gl3d.drawOpaqueMesh(M.shadow, mat4Model(car.x + o[0], 0.7, car.y + o[1], -car.angle, car.model.len * 1.05, 1, car.model.wid * 1.05), WHITE);
    };
    for (const car of s.traffic.parked) shadowCar(car);
    for (const n of s.traffic.cars) shadowCar(n.car);
    for (const car of s.police.cars) shadowCar(car);
    if (pl.car) shadowCar(pl.car);
    for (const pd of s.traffic.peds) {
      const o = sunOff(pd.state === 'down' ? 6 : 34);
      gl3d.drawOpaqueMesh(M.shadow, mat4Model(pd.x + o[0], 0.7, pd.y + o[1], 0, 18, 1, 12), WHITE);
    }
    if (pl.onFoot) {
      const o = sunOff(34);
      gl3d.drawOpaqueMesh(M.shadow, mat4Model(pl.x + o[0], 0.7, pl.y + o[1], 0, 18, 1, 12), WHITE);
    }
    for (const sk of s.skids) {
      const mx = (sk.x1 + sk.x2) / 2; const my = (sk.y1 + sk.y2) / 2;
      const len = Math.hypot(sk.x2 - sk.x1, sk.y2 - sk.y1) || 1;
      const ang = Math.atan2(sk.y2 - sk.y1, sk.x2 - sk.x1);
      gl3d.drawOpaqueMesh(M.shadow, mat4Model(mx, 0.8, my, -ang, len, 1, 5), WHITE);
    }
    const mt = s.missionTarget;
    if (mt) {
      gl3d.beginTransparent(0.10);
      gl3d.drawOpaqueMesh(M.beaconCol, mat4Model(mt.x, 0, mt.y, 0, 1, 1, 1), WHITE);
      const pulse = 1 + Math.sin(s.time * 5) * 0.15;
      gl3d.beginTransparent(0.85);
      gl3d.drawOpaqueMesh(M.beaconRing, mat4Model(mt.x, 0, mt.y, 0, pulse, 1, pulse), WHITE);
    }
    if (pl.onFoot) {
      gl3d.beginTransparent(0.5);
      gl3d.drawOpaqueMesh(M.playerRing, mat4Model(pl.x, 0.9, pl.y, 0, 1, 1, 1), WHITE);
    }
    gl3d.endTransparent();
    // Particles as GL points, 14 units above the ground.
    const pts = s.particles.map((pt) => {
      const c = hexRgb(pt.color);
      return { x: pt.x, y: 14, z: pt.y, r: c[0], g: c[1], b: c[2], size: pt.size * 2 };
    });
    if (pts.length > 0) {
      gl.enable(gl.DEPTH_TEST);
      const pixelScale = (gl.canvas.height * 0.5) / Math.tan(cam.fov / 2);
      gl3d.drawPoints(vp, viewM, pts, pixelScale);
    }
    return { viewProj: vp, cam };
  }


  function font(size, bold) {
    return `${bold ? 'bold ' : ''}${size}px ${FONT}`;
  }
  function text(ctx, value, x, y, size, color, align, bold) {
    ctx.font = font(size, bold);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function drawPanel(ctx, title, lines, prompt, accent) {
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
    text(ctx, title, VIEW.width / 2, y + 62, 44, accent || PALETTE.mission, 'center', true);
    lines.forEach((ln, i) => text(ctx, ln, VIEW.width / 2, y + 112 + i * 34, 19, PALETTE.text, 'center'));
    text(ctx, prompt, VIEW.width / 2, y + h - 30, 19, PALETTE.mission, 'center', true);
    ctx.textAlign = 'left';
  }

  function drawTitleOverlay(ctx, s) {
    ctx.fillStyle = 'rgba(12,9,6,0.55)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    text(ctx, 'SOLMARA', VIEW.width / 2, 250, 110, '#ffd97a', 'center', true);
    text(ctx, 'OPEN CITY', VIEW.width / 2, 310, 44, '#fff7e6', 'center', true);
    text(ctx, 'Kota pantai. Kru heist. Wanted 1–5. Enam misi, enam distrik.', VIEW.width / 2, 352, 20, PALETTE.muted, 'center');
    text(ctx, '6 MISI  •  6 DISTRIK  •  CURI MOBIL  •  POLISI MENGEJAR  •  MINIMAP', VIEW.width / 2, 388, 17, PALETTE.mission, 'center', true);
    const hasSave = !!s.save;
    text(ctx, hasSave ? 'ENTER — LANJUTKAN (save ditemukan)' : 'ENTER — MULAI CERITA RAKA', VIEW.width / 2, 452, 24, '#fff', 'center', true);
    text(ctx, 'WASD jalan / nyetir · E curi mobil · Space pukul · F tembak · P jeda · M suara', VIEW.width / 2, 492, 16, PALETTE.muted, 'center');
    if (s.best) text(ctx, `Terbaik: ${s.best.missionsDone || 0}/6 misi · $${(s.best.cash || 0).toLocaleString('en-US')}`, VIEW.width / 2, 524, 15, PALETTE.muted, 'center');
    text(ctx, 'Game original — semua nama, karakter & kota dibuat untuk SOLMARA.', VIEW.width / 2, 640, 14, PALETTE.muted, 'center');
    ctx.textAlign = 'left';
  }

  function drawOverlay(s, viewProj, cam) {
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.clearRect(0, 0, overlay.width, overlay.height);
    octx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    // Golden-hour vignette + warm wash over the whole view.
    const grad = octx.createRadialGradient(640, 360, 260, 640, 360, 780);
    grad.addColorStop(0, 'rgba(255,170,80,0)');
    grad.addColorStop(1, 'rgba(120,40,10,0.28)');
    octx.fillStyle = grad;
    octx.fillRect(0, 0, VIEW.width, VIEW.height);
    // World-space labels: landmarks, mission beacon, floating texts.
    // Landmark labels only when the camera is close enough to read them —
    // distant ones pile up into unreadable clutter at the horizon.
    const project = makeProject(viewProj);
    const mt = s.missionTarget;
    octx.textAlign = 'center';
    for (const lm of s.city.landmarks) {
      if (mt && Math.abs(lm.x - mt.x) < 100 && Math.abs(lm.y - mt.y) < 100) continue;
      const dEye = Math.hypot(lm.x - cam.eye[0], 70 - cam.eye[1], lm.y - cam.eye[2]);
      if (dEye > 900) continue;
      const p = project(lm.x, 70, lm.y);
      if (!p) continue;
      octx.font = font(13, true);
      const w = octx.measureText(lm.name.toUpperCase()).width + 16;
      octx.fillStyle = 'rgba(0,0,0,0.6)';
      octx.fillRect(p.x - w / 2, p.y - 14, w, 20);
      octx.fillStyle = '#ffe9b0';
      octx.fillText(lm.name.toUpperCase(), p.x, p.y);
    }
    if (mt) {
      const p = project(mt.x, 40, mt.y);
      // Never draw the beacon label under the mission banner (y 190–264).
      if (p && (p.y < 180 || p.y > 290)) {
        octx.font = font(14, true);
        octx.fillStyle = '#fff';
        octx.fillText(mt.label.toUpperCase(), p.x, p.y + 30);
      }
    }
    for (const f of s.floaters) {
      const p = project(f.x, 48, f.y);
      if (!p) continue;
      octx.globalAlpha = Math.min(1, f.ttl);
      octx.font = font(17, true);
      octx.fillStyle = f.color;
      octx.fillText(f.text, p.x, p.y);
    }
    octx.globalAlpha = 1;
    octx.textAlign = 'left';
    // The title screen is a poster, not gameplay: no HUD, no minimap.
    if (s.screen === SCREEN_TITLE) { drawTitleOverlay(octx, s); return; }
    // HUD + minimap (unchanged 2D layer).
    drawHud(octx, s);
    drawMinimap(octx, s);
    if (s.screen === SCREEN_PAUSED) {
      octx.fillStyle = 'rgba(0,0,0,0.45)';
      octx.fillRect(0, 0, VIEW.width, VIEW.height);
      drawPanel(octx, 'JEDA', ['Solmara menunggumu, Raka.', `Misi: ${MISSIONS[s.missions.index] ? MISSIONS[s.missions.index].name : 'tamat'} · $${s.cash.toLocaleString('en-US')}`], 'P — lanjutkan · Enter — kembali ke judul');
    } else if (s.screen === SCREEN_BUSTED) {
      octx.fillStyle = 'rgba(0,0,0,0.5)';
      octx.fillRect(0, 0, VIEW.width, VIEW.height);
      drawPanel(octx, 'BUSTED!', ['Polisi Solmara menangkapmu.', 'Denda $100 — Kru Senja membebaskanmu.', `Uang sekarang $${s.cash.toLocaleString('en-US')}`], 'Enter — kembali ke jalan', '#ff4d4d');
    } else if (s.screen === SCREEN_WASTED) {
      octx.fillStyle = 'rgba(0,0,0,0.55)';
      octx.fillRect(0, 0, VIEW.width, VIEW.height);
      drawPanel(octx, 'WASTED', ['Raka tumbang di jalanan Solmara.', 'Kru Senja menarikmu keluar. Coba lagi.', `Misi selesai: ${s.missions.done.length}/6`], 'Enter — coba lagi', '#ff4d4d');
    } else if (s.screen === SCREEN_COMPLETE) {
      octx.fillStyle = 'rgba(0,0,0,0.5)';
      octx.fillRect(0, 0, VIEW.width, VIEW.height);
      drawPanel(octx, 'CERITA TAMAT', ['Raka & Kru Senja kabur lewat Dermaga Sol.', `6/6 misi · $${s.cash.toLocaleString('en-US')} · ${s.stats.carsStolen} mobil dicuri`, 'Solmara milikmu sekarang.'], 'Enter — main lagi dari awal', '#4ade80');
    }
  }

  function draw(s) {
    resize();
    const { viewProj, cam } = drawWorld3D(s);
    drawOverlay(s, viewProj, cam);
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
