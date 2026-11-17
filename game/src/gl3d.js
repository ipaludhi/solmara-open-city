// SOLMARA 3D — a tiny raw-WebGL engine, zero dependencies, no textures.
// The game logic still lives in 2D (x east, y south); this file maps it to
// 3D (X = x, Z = y, Y = up) and draws it: a merged static city mesh (one draw
// call), one draw per car / person / pickup, a sunset sky, fog, particles.
// Shaders are GLSL ES 1.00 so they compile on WebGL1 and WebGL2 alike.
import { DISTRICTS, PALETTE, ROADS_X, ROADS_Y, ROAD_W, WORLD } from './config.js';

// ---------- tiny mat4 (column-major, like WebGL) ----------
export function mat4Identity() {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}
export function mat4Multiply(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c += 1) {
    for (let r = 0; r < 4; r += 1) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return o;
}
export function mat4Perspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2);
  const nf = 1 / (near - far);
  return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
}
export function mat4LookAt(eye, target, up) {
  let zx = eye[0] - target[0]; let zy = eye[1] - target[1]; let zz = eye[2] - target[2];
  let zl = Math.hypot(zx, zy, zz) || 1; zx /= zl; zy /= zl; zz /= zl;
  let xx = up[1] * zz - up[2] * zy; let xy = up[2] * zx - up[0] * zz; let xz = up[0] * zy - up[1] * zx;
  const xl = Math.hypot(xx, xy, xz) || 1; xx /= xl; xy /= xl; xz /= xl;
  const yx = zy * xz - zz * xy; const yy = zz * xx - zx * xz; const yz = zx * xy - zy * xx;
  return [xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0, -(xx * eye[0] + xy * eye[1] + xz * eye[2]), -(yx * eye[0] + yy * eye[1] + yz * eye[2]), -(zx * eye[0] + zy * eye[1] + zz * eye[2]), 1];
}
export function mat4Inverse(m) {
  // General 4x4 inverse (adjugate / determinant), for the sky shader only.
  const a00 = m[0]; const a01 = m[1]; const a02 = m[2]; const a03 = m[3];
  const a10 = m[4]; const a11 = m[5]; const a12 = m[6]; const a13 = m[7];
  const a20 = m[8]; const a21 = m[9]; const a22 = m[10]; const a23 = m[11];
  const a30 = m[12]; const a31 = m[13]; const a32 = m[14]; const a33 = m[15];
  const b00 = a00 * a11 - a01 * a10; const b01 = a00 * a12 - a02 * a10; const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11; const b04 = a01 * a13 - a03 * a11; const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30; const b07 = a20 * a32 - a22 * a30; const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31; const b10 = a21 * a33 - a23 * a31; const b11 = a22 * a33 - a23 * a32;
  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) return mat4Identity();
  det = 1 / det;
  return [
    (a11 * b11 - a12 * b10 + a13 * b09) * det, (a02 * b10 - a01 * b11 - a03 * b09) * det,
    (a31 * b05 - a32 * b04 + a33 * b03) * det, (a22 * b04 - a21 * b05 - a23 * b03) * det,
    (a12 * b08 - a10 * b11 - a13 * b07) * det, (a00 * b11 - a02 * b08 + a03 * b07) * det,
    (a32 * b02 - a30 * b05 - a33 * b01) * det, (a20 * b05 - a22 * b02 + a23 * b01) * det,
    (a10 * b10 - a11 * b08 + a13 * b06) * det, (a01 * b08 - a00 * b10 - a03 * b06) * det,
    (a30 * b04 - a31 * b02 + a33 * b00) * det, (a21 * b02 - a20 * b04 - a23 * b00) * det,
    (a11 * b07 - a10 * b09 - a12 * b06) * det, (a00 * b09 - a01 * b07 + a02 * b06) * det,
    (a31 * b01 - a30 * b03 - a32 * b00) * det, (a20 * b03 - a21 * b01 + a22 * b00) * det,
  ];
}
// Model matrix: translate + rotate about Y + scale. A 2D angle theta (x-y
// plane, from +x) becomes rotationY(-theta) so local +X points along it.
export function mat4Model(px, py, pz, rotY, sx, sy, sz) {
  const c = Math.cos(rotY); const s = Math.sin(rotY);
  return [c * sx, 0, -s * sx, 0, 0, sy, 0, 0, s * sz, 0, c * sz, 0, px, py, pz, 1];
}
export function mat4Translate(x, y, z) {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
}

// ---------- colour ----------
export function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
function shade(rgb, f) { return [rgb[0] * f, rgb[1] * f, rgb[2] * f]; }
// Deterministic hash from two numbers (for building heights, lit windows).
export function hash2(x, y) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = (h ^ (h >> 13)) | 0; h = Math.imul(h, 1274126177);
  return (((h ^ (h >> 16)) >>> 0) % 10000) / 10000;
}

// ---------- mesh builder (flat-shaded; one vertex per face corner) ----------
// Per vertex: pos(3) normal(3) colour(3) emit(1) tint(1) = 11 floats.
export class MeshBuilder {
  constructor() {
    this.pos = []; this.nor = []; this.col = []; this.emit = []; this.tint = []; this.idx = [];
  }
  get count() { return this.pos.length / 3; }
  vert(x, y, z, n, c, emit, tint) {
    this.pos.push(x, y, z); this.nor.push(n[0], n[1], n[2]);
    this.col.push(c[0], c[1], c[2]); this.emit.push(emit); this.tint.push(tint);
    return this.count - 1;
  }
  quad(a, b, c, d, n, col, emit = 0, tint = 0) {
    const i0 = this.vert(a[0], a[1], a[2], n, col, emit, tint);
    const i1 = this.vert(b[0], b[1], b[2], n, col, emit, tint);
    const i2 = this.vert(c[0], c[1], c[2], n, col, emit, tint);
    const i3 = this.vert(d[0], d[1], d[2], n, col, emit, tint);
    this.idx.push(i0, i1, i2, i0, i2, i3);
  }
  // Axis-aligned box centred at (cx, cy, cz) with size (sx, sy, sz).
  // Sides use `col`, the top uses `top` (or col), the bottom is darkened.
  box(cx, cy, cz, sx, sy, sz, col, opts = {}) {
    const top = opts.top || col;
    const x0 = cx - sx / 2; const x1 = cx + sx / 2;
    const y0 = cy - sy / 2; const y1 = cy + sy / 2;
    const z0 = cz - sz / 2; const z1 = cz + sz / 2;
    const em = opts.emit || 0; const tn = opts.tint || 0;
    this.quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, 1, 0], top, em, tn); // top
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0], [0, -1, 0], shade(col, 0.4), em, tn); // bottom
    this.quad([x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [x1, y0, z1], [0, 0, 1], col, em, tn); // +z (south, sun-facing)
    this.quad([x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z0], [0, 0, -1], shade(col, 0.75), em, tn); // -z (north)
    this.quad([x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [x1, y0, z0], [1, 0, 0], shade(col, 0.88), em, tn); // +x (east)
    this.quad([x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1], [-1, 0, 0], shade(col, 0.8), em, tn); // -x (west)
  }
  // Low-poly sphere (octahedron), squashed vertically by sy.
  oct(cx, cy, cz, r, col, opts = {}) {
    const sy = opts.sy ?? 1; const em = opts.emit || 0; const tn = opts.tint || 0;
    const top = [cx, cy + r * sy, cz]; const bot = [cx, cy - r * sy, cz];
    const ring = [[cx + r, cy, cz], [cx, cy, cz + r], [cx - r, cy, cz], [cx, cy, cz - r]];
    for (let i = 0; i < 4; i += 1) {
      const a = ring[i]; const b = ring[(i + 1) % 4];
      const n1 = [a[0] - cx + (top[0] - cx), a[1] - cy + (top[1] - cy) * 0.5, a[2] - cz + (top[2] - cz)];
      const nl = Math.hypot(n1[0], n1[1], n1[2]) || 1;
      this.quad(top, a, b, top, [n1[0] / nl, n1[1] / nl, n1[2] / nl], col, em, tn);
      const n2 = [a[0] - cx, (bot[1] - cy) * 0.5 + a[1] - cy, a[2] - cz];
      const nl2 = Math.hypot(n2[0], n2[1], n2[2]) || 1;
      this.quad(bot, b, a, bot, [n2[0] / nl2, n2[1] / nl2, n2[2] / nl2], shade(col, 0.7), em, tn);
    }
  }
  // Flat annulus on the ground (beacon ring), y = 0.6.
  ring(cx, cz, r0, r1, col, emit = 1, segs = 28) {
    for (let i = 0; i < segs; i += 1) {
      const a0 = (i / segs) * Math.PI * 2; const a1 = ((i + 1) / segs) * Math.PI * 2;
      const p = (r, a) => [cx + Math.cos(a) * r, 0.6, cz + Math.sin(a) * r];
      this.quad(p(r0, a0), p(r1, a0), p(r1, a1), p(r0, a1), [0, 1, 0], col, emit, 0);
    }
  }
  finish() {
    return {
      positions: new Float32Array(this.pos), normals: new Float32Array(this.nor),
      colors: new Float32Array(this.col), emits: new Float32Array(this.emit),
      tints: new Float32Array(this.tint), indices: new Uint16Array(this.idx),
    };
  }
}

// ---------- shaders ----------
const OPAQUE_VS = `
attribute vec3 aPos; attribute vec3 aNorm; attribute vec3 aCol;
attribute float aEmit; attribute float aTint;
uniform mat4 uMVP; uniform mat4 uModel; uniform mat4 uView; uniform vec3 uTint;
uniform vec3 uSun;
varying vec3 vCol; varying float vLight; varying float vDist; varying float vEmit;
void main() {
  vec4 wp = uModel * vec4(aPos, 1.0);
  vec3 n = normalize((uModel * vec4(aNorm, 0.0)).xyz);
  float diff = max(dot(n, uSun), 0.0);
  vLight = 0.42 + 0.58 * diff;
  vCol = aCol * (aTint > 0.5 ? uTint : vec3(1.0));
  vEmit = aEmit;
  vec4 vp = uView * wp;
  vDist = -vp.z;
  gl_Position = uMVP * vec4(aPos, 1.0);
}`;
const OPAQUE_FS = `
precision mediump float;
uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar; uniform float uAlpha;
varying vec3 vCol; varying float vLight; varying float vDist; varying float vEmit;
void main() {
  vec3 c = vCol * (vEmit > 0.5 ? 1.0 : vLight);
  float f = smoothstep(uFogNear, uFogFar, vDist);
  gl_FragColor = vec4(mix(c, uFogColor, f), uAlpha);
}`;
const SKY_VS = `attribute vec2 aPos; varying vec2 vNdc; void main(){ vNdc = aPos; gl_Position = vec4(aPos, 0.0, 1.0); }`;
const SKY_FS = `
precision mediump float;
uniform mat4 uInvPV; uniform vec3 uEye; uniform vec3 uSun;
varying vec2 vNdc;
void main() {
  vec4 wp = uInvPV * vec4(vNdc, 1.0, 1.0);
  vec3 dir = normalize(wp.xyz / wp.w - uEye);
  float t = clamp(dir.y, 0.0, 1.0);
  vec3 horizon = vec3(0.95, 0.62, 0.32);
  vec3 mid = vec3(0.85, 0.42, 0.30);
  vec3 top = vec3(0.23, 0.16, 0.38);
  vec3 c = mix(horizon, mid, smoothstep(0.0, 0.25, t));
  c = mix(c, top, smoothstep(0.2, 0.75, t));
  if (dir.y < 0.0) c = mix(horizon, vec3(0.55, 0.35, 0.30), clamp(-dir.y * 4.0, 0.0, 1.0));
  float s = max(dot(dir, uSun), 0.0);
  c += vec3(1.0, 0.85, 0.55) * pow(s, 220.0) * 1.6;
  c += vec3(1.0, 0.55, 0.22) * pow(s, 10.0) * 0.45;
  gl_FragColor = vec4(c, 1.0);
}`;
const POINTS_VS = `
attribute vec3 aPos; attribute vec3 aCol; attribute float aSize;
uniform mat4 uMVP; uniform mat4 uView; uniform float uScale;
varying vec3 vCol;
void main() {
  vec4 vp = uView * vec4(aPos, 1.0);
  gl_PointSize = aSize * uScale / max(1.0, -vp.z);
  vCol = aCol;
  gl_Position = uMVP * vec4(aPos, 1.0);
}`;
const POINTS_FS = `
precision mediump float;
varying vec3 vCol;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  if (dot(d, d) > 0.25) discard;
  gl_FragColor = vec4(vCol, 1.0);
}`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(`shader: ${gl.getShaderInfoLog(sh)}`);
  }
  return sh;
}
function program(gl, vsSrc, fsSrc) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fsSrc));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(`program: ${gl.getProgramInfoLog(p)}`);
  }
  return p;
}
function makeMeshGL(gl, data) {
  const vbo = gl.createBuffer();
  const stride = 11 * 4;
  const interleaved = new Float32Array(data.positions.length + data.normals.length + data.colors.length + data.emits.length + data.tints.length);
  const n = data.positions.length / 3;
  for (let i = 0; i < n; i += 1) {
    interleaved.set(data.positions.subarray(i * 3, i * 3 + 3), i * 11);
    interleaved.set(data.normals.subarray(i * 3, i * 3 + 3), i * 11 + 3);
    interleaved.set(data.colors.subarray(i * 3, i * 3 + 3), i * 11 + 6);
    interleaved[i * 11 + 9] = data.emits[i];
    interleaved[i * 11 + 10] = data.tints[i];
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, interleaved, gl.STATIC_DRAW);
  const ibo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.indices, gl.STATIC_DRAW);
  return { vbo, ibo, count: data.indices.length };
}


// ---------- extra matrix helpers ----------
export function mat4RotX(a) {
  const c = Math.cos(a); const s = Math.sin(a);
  return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1];
}
export function mat4RotY(a) {
  const c = Math.cos(a); const s = Math.sin(a);
  return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
}
export function mat4Scale(sx, sy, sz) {
  return [sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, sz, 0, 0, 0, 0, 1];
}
// Sun: low over the sea (south-west), warm. Points from a surface toward it.
export const SUN_DIR = (() => {
  const v = [-0.45, 0.30, 0.84];
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
})();
export const FOG_COLOR = hexRgb('#e8a06a');
export const FOG_NEAR = 900;
export const FOG_FAR = 4200;

// ---------- static city mesh ----------
function buildStaticMesh(city) {
  const b = new MeshBuilder();
  const ground = (x0, z0, x1, z1, y, col, emit = 0) => {
    b.quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [0, 1, 0], hexRgb(col), emit, 0);
  };
  for (const d of DISTRICTS) ground(d.x, d.y, d.x + d.w, d.y + d.h, 0, d.ground);
  ground(0, 2280, WORLD.width, 2400, 0.4, PALETTE.water);
  ground(0, 2200, WORLD.width, 2280, 0.3, PALETTE.sand);
  // Foam lines on the water (deterministic drift from time is added by the
  // renderer via a tiny x offset; here they are static).
  for (let i = 0; i < 8; i += 1) {
    const wx = (i * 397) % WORLD.width;
    ground(wx, 2286 + (i % 3) * 22, wx + 90, 2289 + (i % 3) * 22, 0.8, '#ffffff', 1);
  }
  // Roads + sidewalks + dashed centre lines.
  const asphalt = hexRgb('#3a332a'); const walk = hexRgb(PALETTE.sidewalk); const line = hexRgb(PALETTE.line);
  for (const rx of ROADS_X) {
    ground(rx - ROAD_W / 2, 0, rx + ROAD_W / 2, WORLD.height, 0.5, '#3a332a');
    ground(rx - ROAD_W / 2 - 10, 0, rx - ROAD_W / 2, WORLD.height, 0.55, PALETTE.sidewalk);
    ground(rx + ROAD_W / 2, 0, rx + ROAD_W / 2 + 10, WORLD.height, 0.55, PALETTE.sidewalk);
    for (let z = 24; z < WORLD.height; z += 48) ground(rx - 2, z, rx + 2, z + 26, 0.7, PALETTE.line);
  }
  for (const ry of ROADS_Y) {
    ground(0, ry - ROAD_W / 2, WORLD.width, ry + ROAD_W / 2, 0.5, '#3a332a');
    ground(0, ry - ROAD_W / 2 - 10, WORLD.width, ry - ROAD_W / 2, 0.55, PALETTE.sidewalk);
    ground(0, ry + ROAD_W / 2, WORLD.width, ry + ROAD_W / 2 + 10, 0.55, PALETTE.sidewalk);
    for (let x = 24; x < WORLD.width; x += 48) ground(x, ry - 2, x + 26, ry + 2, 0.7, PALETTE.line);
  }
  // Buildings: box + lit/dark window grids on the sun and shade faces.
  for (const bd of city.buildings) {
    const h = bd.tall ? 240 + hash2(bd.x, bd.y) * 170 : 46 + hash2(bd.x, bd.y) * 120;
    const cx = bd.x + bd.w / 2; const cz = bd.y + bd.h / 2;
    const wall = shade(hexRgb(bd.wall), 0.68);
    b.box(cx, h / 2, cz, bd.w, h, bd.h, wall, { top: hexRgb(bd.roof) });
    // Roof parapet lip so the top edge reads instead of vanishing.
    b.box(cx, h + 2, cz, bd.w + 6, 5, bd.h + 6, hexRgb(bd.roof));
    const cols = bd.windows; const rows = Math.max(2, Math.floor(h / 40));
    for (let i = 0; i < cols; i += 1) {
      for (let j = 0; j < rows; j += 1) {
        const wx = bd.x + ((i + 1) * bd.w) / (cols + 1);
        const wy = 20 + ((j + 1) * (h - 24)) / (rows + 1);
        const lit = hash2(bd.x + i * 7 + 3, bd.y + j * 13 + 5) > 0.45;
        const wc = lit ? hexRgb('#ffd97a') : hexRgb('#2a2438');
        // South face (sun side): lit warm windows.
        b.quad([wx - 5, wy - 6, bd.y + bd.h + 0.8], [wx + 5, wy - 6, bd.y + bd.h + 0.8], [wx + 5, wy + 6, bd.y + bd.h + 0.8], [wx - 5, wy + 6, bd.y + bd.h + 0.8], [0, 0, 1], wc, lit ? 1 : 0, 0);
        // North face: dark windows.
        b.quad([wx + 5, wy - 6, bd.y - 0.8], [wx - 5, wy - 6, bd.y - 0.8], [wx - 5, wy + 6, bd.y - 0.8], [wx + 5, wy + 6, bd.y - 0.8], [0, 0, -1], hexRgb('#2a2438'), 0, 0);
      }
    }
    // East / west faces: a column of windows each, so a building never reads
    // as a blank box from the side.
    const sideCols = 2;
    for (let i = 0; i < sideCols; i += 1) {
      for (let j = 0; j < rows; j += 1) {
        const wz = bd.y + ((i + 1) * bd.h) / (sideCols + 1);
        const wy = 20 + ((j + 1) * (h - 24)) / (rows + 1);
        const lit = hash2(bd.x + i * 11 + 9, bd.y + j * 13 + 7) > 0.5;
        const wc = lit ? hexRgb('#ffd97a') : hexRgb('#2a2438');
        b.quad([bd.x + bd.w + 0.8, wy - 6, wz - 5], [bd.x + bd.w + 0.8, wy - 6, wz + 5], [bd.x + bd.w + 0.8, wy + 6, wz + 5], [bd.x + bd.w + 0.8, wy + 6, wz - 5], [1, 0, 0], wc, lit ? 1 : 0, 0);
        b.quad([bd.x - 0.8, wy - 6, wz + 5], [bd.x - 0.8, wy - 6, wz - 5], [bd.x - 0.8, wy + 6, wz - 5], [bd.x - 0.8, wy + 6, wz + 5], [-1, 0, 0], hexRgb('#2a2438'), 0, 0);
      }
    }
    if (bd.tall) {
      const pink = hexRgb('#ff2e88');
      b.box(cx, h + 13, cz, 6, 26, 6, pink, { emit: 1 });
      b.oct(cx, h + 32, cz, 8, pink, { emit: 1 });
    }
  }
  // Trees: trunk + low-poly foliage.
  for (const t of city.trees) {
    b.box(t.x, 7, t.y, 6, 14, 6, hexRgb('#6b4a2f'));
    b.oct(t.x, 14 + t.r * 0.7, t.y, t.r, hexRgb(PALETTE.tree), { sy: 0.75 });
  }
  // Market stalls: coloured box + white awning.
  for (const st of city.stalls) {
    b.box(st.x, 10, st.y, 32, 20, 24, hexRgb(st.color));
    b.quad([st.x - 18, 21, st.y - 14], [st.x + 18, 21, st.y - 14], [st.x + 18, 21, st.y + 14], [st.x - 18, 21, st.y + 14], [0, 1, 0], hexRgb('#fff7e6'), 0, 0);
  }
  // Landmarks (labels are drawn as overlay text; these are the silhouettes).
  const lm = (name) => city.landmarks.find((l) => l.name === name);
  const jam = lm('Menara Jam');
  if (jam) {
    b.box(jam.x, 130, jam.y, 56, 260, 56, hexRgb('#cbb79a'), { top: hexRgb('#7a5c46') });
    b.quad([jam.x - 17, 193, jam.y + 28.8], [jam.x + 17, 193, jam.y + 28.8], [jam.x + 17, 227, jam.y + 28.8], [jam.x - 17, 227, jam.y + 28.8], [0, 0, 1], hexRgb('#fff7e6'), 1, 0);
  }
  const bank = lm('Bank Solmara');
  if (bank) {
    b.box(bank.x, 35, bank.y, 170, 70, 100, hexRgb('#d9c9a8'), { top: hexRgb('#8a6d4b') });
    for (let i = 0; i < 4; i += 1) b.box(bank.x - 60 + i * 40, 30, bank.y + 55, 10, 60, 10, hexRgb('#f2e8d5'));
  }
  const neon = lm('Menara Neon');
  if (neon) {
    const pink = hexRgb('#ff2e88');
    b.box(neon.x, 160, neon.y, 64, 320, 64, hexRgb('#2c2a40'), { top: hexRgb('#1e1c30') });
    b.box(neon.x, 305, neon.y, 68, 6, 68, pink, { emit: 1 });
    b.box(neon.x, 318, neon.y, 68, 6, 68, pink, { emit: 1 });
    b.box(neon.x, 340, neon.y, 6, 40, 6, pink, { emit: 1 });
    b.oct(neon.x, 365, neon.y, 8, pink, { emit: 1 });
  }
  const pier = lm('Dermaga Sol');
  if (pier) {
    for (let i = 0; i < 10; i += 1) {
      ground(pier.x - 15, 2210 + i * 15, pier.x + 15, 2222 + i * 15, 2, '#8a6d4b');
    }
  }
  const vila = lm('Vila Senja');
  if (vila) b.box(vila.x, 25, vila.y, 120, 50, 80, hexRgb('#f2e8d5'), { top: hexRgb('#7a5c46') });
  return b.finish();
}

// ---------- dynamic meshes (built once, drawn per object) ----------
function carMeshData(police) {
  const b = new MeshBuilder();
  const white = [1, 1, 1];
  b.box(0, 7, 0, 0.96, 12, 0.94, white, { tint: 1 }); // body (tinted per model)
  b.box(-0.02, 16, 0, 0.42, 8, 0.62, hexRgb('#141820')); // cabin glass
  const wheel = hexRgb('#14100c');
  for (const wx of [-0.32, 0.32]) for (const wz of [-0.5, 0.5]) b.box(wx, 4, wz, 0.16, 7, 0.09, wheel);
  const hl = hexRgb('#fff6c9');
  for (const wz of [-0.32, 0.32]) b.box(0.49, 8, wz, 0.02, 3, 0.12, hl, { emit: 1 });
  if (police) {
    b.box(-0.05, 7.2, 0, 0.14, 12.4, 0.96, hexRgb('#1e293b')); // dark band
    b.box(-0.28, 7.2, 0, 0.1, 12.4, 0.96, hexRgb('#2563eb')); // blue front stripe
    b.box(0, 14.5, 0, 0.2, 3, 0.4, hexRgb('#1e293b')); // light-bar base
  }
  return b.finish();
}
function pedMeshData() {
  const b = new MeshBuilder();
  b.box(0, 14, 0, 13, 22, 8, [1, 1, 1], { tint: 1 }); // shirt (tinted)
  b.oct(0, 30, 0, 5.5, hexRgb('#f2c9a0'), { sy: 0.85 }); // head
  const leg = hexRgb('#1f2937');
  b.box(-3, 4, 0, 4.5, 8, 5, leg);
  b.box(3, 4, 0, 4.5, 8, 5, leg);
  return b.finish();
}
function pickupMeshData() {
  const b = new MeshBuilder();
  b.oct(0, 0, 0, 11, [1, 1, 1], { tint: 1, emit: 0 });
  return b.finish();
}
function smallBoxMeshData(color, emit) {
  const b = new MeshBuilder();
  b.box(0, 0, 0, 1, 1, 1, color, { emit });
  return b.finish();
}
function beaconColumnData() {
  const b = new MeshBuilder();
  const col = hexRgb('#ffd23e');
  // Two crossed translucent quads, 28 wide, 180 tall.
  b.quad([-14, 0, 0], [14, 0, 0], [14, 180, 0], [-14, 180, 0], [0, 0, 1], col, 1, 0);
  b.quad([0, 0, -14], [0, 0, 14], [0, 180, 14], [0, 180, -14], [1, 0, 0], col, 1, 0);
  return b.finish();
}
function ringMeshData(r0, r1, col) {
  const b = new MeshBuilder();
  b.ring(0, 0, r0, r1, col, 1);
  return b.finish();
}
function skyMeshData() {
  return { positions: new Float32Array([-1, -1, 3, -1, -1, 3]), count: 3 };
}

// ---------- the engine ----------
export class GL3D {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: true })
      || canvas.getContext('webgl', { preserveDrawingBuffer: true, antialias: true });
    if (!gl) throw new Error('WebGL unavailable');
    this.gl = gl;
    this.opaque = program(gl, OPAQUE_VS, OPAQUE_FS);
    this.skyProg = program(gl, SKY_VS, SKY_FS);
    this.pointsProg = program(gl, POINTS_VS, POINTS_FS);
    this.u = {};
    for (const name of ['uMVP', 'uModel', 'uView', 'uTint', 'uSun', 'uFogColor', 'uFogNear', 'uFogFar', 'uAlpha']) {
      this.u[name] = gl.getUniformLocation(this.opaque, name);
    }
    this.uSky = {
      uInvPV: gl.getUniformLocation(this.skyProg, 'uInvPV'),
      uEye: gl.getUniformLocation(this.skyProg, 'uEye'),
      uSun: gl.getUniformLocation(this.skyProg, 'uSun'),
    };
    this.uPts = {
      uMVP: gl.getUniformLocation(this.pointsProg, 'uMVP'),
      uView: gl.getUniformLocation(this.pointsProg, 'uView'),
      uScale: gl.getUniformLocation(this.pointsProg, 'uScale'),
    };
    this.a = {};
    for (const name of ['aPos', 'aNorm', 'aCol', 'aEmit', 'aTint']) {
      this.a[name] = gl.getAttribLocation(this.opaque, name);
    }
    this.staticMesh = null; this.staticCity = null;
    this.meshes = {
      car: makeMeshGL(gl, carMeshData(false)),
      police: makeMeshGL(gl, carMeshData(true)),
      ped: makeMeshGL(gl, pedMeshData()),
      pickup: makeMeshGL(gl, pickupMeshData()),
      bullet: makeMeshGL(gl, smallBoxMeshData(hexRgb('#ffe066'), 1)),
      lightRed: makeMeshGL(gl, smallBoxMeshData(hexRgb('#ff2e2e'), 1)),
      lightBlue: makeMeshGL(gl, smallBoxMeshData(hexRgb('#2563eb'), 1)),
      shadow: makeMeshGL(gl, smallBoxMeshData([0, 0, 0], 1)),
      beaconCol: makeMeshGL(gl, beaconColumnData()),
      beaconRing: makeMeshGL(gl, ringMeshData(40, 46, hexRgb('#ffd23e'))),
      playerRing: makeMeshGL(gl, ringMeshData(13, 16, hexRgb('#ffffff'))),
    };
    // Sky fullscreen triangle (positions only).
    const sky = skyMeshData();
    this.skyVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.skyVbo);
    gl.bufferData(gl.ARRAY_BUFFER, sky.positions, gl.STATIC_DRAW);
    // Particle point buffer (rewritten every frame).
    this.ptsVbo = gl.createBuffer();
    this.ptsCount = 0;
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
  }
  resize(w, h) {
    this.canvas.width = w; this.canvas.height = h;
    this.gl.viewport(0, 0, w, h);
  }
  ensureStatic(city) {
    if (this.staticCity !== city) {
      this.staticCity = city;
      if (this.staticMesh) { this.gl.deleteBuffer(this.staticMesh.vbo); this.gl.deleteBuffer(this.staticMesh.ibo); }
      this.staticMesh = makeMeshGL(this.gl, buildStaticMesh(city));
    }
  }
  bindOpaque(mesh) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ibo);
    const stride = 44;
    const set = (loc, off) => {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, off === 9 || off === 10 ? 1 : 3, gl.FLOAT, false, stride, off * 4);
    };
    set(this.a.aPos, 0); set(this.a.aNorm, 3); set(this.a.aCol, 6); set(this.a.aEmit, 9); set(this.a.aTint, 10);
  }
  useOpaque(viewProj, view, alpha) {
    const gl = this.gl;
    gl.useProgram(this.opaque);
    gl.uniformMatrix4fv(this.u.uView, false, new Float32Array(view));
    gl.uniform3fv(this.u.uSun, new Float32Array(SUN_DIR));
    gl.uniform3fv(this.u.uFogColor, new Float32Array(FOG_COLOR));
    gl.uniform1f(this.u.uFogNear, FOG_NEAR);
    gl.uniform1f(this.u.uFogFar, FOG_FAR);
    gl.uniform1f(this.u.uAlpha, alpha);
    this.viewProj = viewProj;
  }
  drawOpaqueMesh(mesh, model, tint) {
    const gl = this.gl;
    const mvp = mat4Multiply(this.viewProj, model);
    gl.uniformMatrix4fv(this.u.uMVP, false, new Float32Array(mvp));
    gl.uniformMatrix4fv(this.u.uModel, false, new Float32Array(model));
    gl.uniform3fv(this.u.uTint, new Float32Array(tint));
    this.bindOpaque(mesh);
    gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
  }
  drawStatic(viewProj, view) {
    this.useOpaque(viewProj, view, 1);
    this.drawOpaqueMesh(this.staticMesh, mat4Identity(), [1, 1, 1]);
  }
  drawSky(viewProj, view, eye) {
    const gl = this.gl;
    const invPV = mat4Inverse(viewProj);
    gl.useProgram(this.skyProg);
    gl.uniformMatrix4fv(this.uSky.uInvPV, false, new Float32Array(invPV));
    gl.uniform3fv(this.uSky.uEye, new Float32Array(eye));
    gl.uniform3fv(this.uSky.uSun, new Float32Array(SUN_DIR));
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.skyVbo);
    const loc = gl.getAttribLocation(this.skyProg, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.depthMask(true);
    gl.enable(gl.DEPTH_TEST);
  }
  drawPoints(viewProj, view, points, pixelScale) {
    // points: [{x, y(world), z, r, g, b, size}] — y here is height above ground.
    const gl = this.gl;
    const n = points.length;
    if (n === 0) return;
    const arr = new Float32Array(n * 7);
    for (let i = 0; i < n; i += 1) {
      const p = points[i];
      arr[i * 7] = p.x; arr[i * 7 + 1] = p.y; arr[i * 7 + 2] = p.z;
      arr[i * 7 + 3] = p.r; arr[i * 7 + 4] = p.g; arr[i * 7 + 5] = p.b;
      arr[i * 7 + 6] = p.size;
    }
    gl.useProgram(this.pointsProg);
    gl.uniformMatrix4fv(this.uPts.uMVP, false, new Float32Array(viewProj));
    gl.uniformMatrix4fv(this.uPts.uView, false, new Float32Array(view));
    gl.uniform1f(this.uPts.uScale, pixelScale);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.ptsVbo);
    gl.bufferData(gl.ARRAY_BUFFER, arr, gl.DYNAMIC_DRAW);
    const locP = gl.getAttribLocation(this.pointsProg, 'aPos');
    const locC = gl.getAttribLocation(this.pointsProg, 'aCol');
    const locS = gl.getAttribLocation(this.pointsProg, 'aSize');
    gl.enableVertexAttribArray(locP);
    gl.vertexAttribPointer(locP, 3, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(locC);
    gl.vertexAttribPointer(locC, 3, gl.FLOAT, false, 28, 12);
    gl.enableVertexAttribArray(locS);
    gl.vertexAttribPointer(locS, 1, gl.FLOAT, false, 28, 24);
    gl.drawArrays(gl.POINTS, 0, n);
  }
  beginFrame() {
    const gl = this.gl;
    gl.clearColor(FOG_COLOR[0], FOG_COLOR[1], FOG_COLOR[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.BLEND);
    gl.depthMask(true);
  }
  beginTransparent(alpha) {
    const gl = this.gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.uniform1f(this.u.uAlpha, alpha);
  }
  endTransparent() {
    const gl = this.gl;
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    gl.uniform1f(this.u.uAlpha, 1);
  }
}
