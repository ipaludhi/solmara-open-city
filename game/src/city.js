// The city of Solmara: road grid, six named districts, seeded buildings,
// trees, market stalls and landmarks. Everything is placed by the seeded RNG,
// so seed 1 always builds the same city.
import { DISTRICTS, ROADS_X, ROADS_Y, ROAD_W, WORLD } from './config.js';

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  return DISTRICTS[0];
}

export function isRoad(x, y) {
  const half = ROAD_W / 2;
  for (const rx of ROADS_X) if (Math.abs(x - rx) <= half) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) <= half) return true;
  return false;
}

export function createCity(rng) {
  const buildings = [];
  const trees = [];
  const stalls = [];
  const roofColors = ['#7a5c46', '#5d6b7a', '#8a6d4b', '#4e5d4a', '#74555f', '#6d5a49'];
  // One building cluster per block between roads.
  for (let bx = 0; bx < ROADS_X.length - 1; bx += 1) {
    for (let by = 0; by < ROADS_Y.length - 1; by += 1) {
      const x0 = ROADS_X[bx] + ROAD_W / 2 + 24;
      const x1 = ROADS_X[bx + 1] - ROAD_W / 2 - 24;
      const y0 = ROADS_Y[by] + ROAD_W / 2 + 24;
      const y1 = ROADS_Y[by + 1] - ROAD_W / 2 - 24;
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      const cx = (x0 + x1) / 2; const cy = (y0 + y1) / 2;
      const d = districtAt(cx, cy);
      // Beach strip stays open: no buildings on Pantai Sol sand.
      if (d.name === 'Pantai Sol') {
        for (let i = 0; i < 3; i += 1) trees.push({ x: rng.range(x0, x1), y: rng.range(y0, y1), r: rng.range(10, 16) });
        continue;
      }
      const count = rng.int(1, 3);
      for (let i = 0; i < count; i += 1) {
        const w = rng.range(90, 170); const h = rng.range(70, 140);
        const x = rng.range(x0, Math.max(x0 + 1, x1 - w));
        const y = rng.range(y0, Math.max(y0 + 1, y1 - h));
        buildings.push({
          x, y, w, h, district: d.name,
          roof: rng.pick(roofColors), wall: d.accent,
          windows: rng.int(2, 5), tall: d.name === 'Distrik Neon' && rng.chance(0.5),
        });
      }
      // Bukit Vila gets gardens; Pasar Malam gets stalls instead of a 3rd building.
      if (d.name === 'Bukit Vila') {
        for (let i = 0; i < 4; i += 1) trees.push({ x: rng.range(x0, x1), y: rng.range(y0, y1), r: rng.range(9, 15) });
      }
      if (d.name === 'Pasar Malam') {
        for (let i = 0; i < 3; i += 1) stalls.push({ x: rng.range(x0 + 20, x1 - 20), y: rng.range(y0 + 20, y1 - 20), color: rng.pick(['#ffc233', '#ff2e88', '#2ea8c9', '#a8d94a']) });
      }
      if (rng.chance(0.6)) trees.push({ x: rng.range(x0, x1), y: rng.range(y0, y1), r: rng.range(9, 14) });
    }
  }

  const landmarks = [
    { name: 'Dermaga Tua', x: 300, y: 300, district: 'Pelabuhan Tua' },
    { name: 'Menara Jam', x: 1400, y: 300, district: 'Kota Lama' },
    { name: 'Bank Solmara', x: 1300, y: 320, district: 'Kota Lama' },
    { name: 'Menara Neon', x: 2500, y: 400, district: 'Distrik Neon' },
    { name: 'Pasar Malam', x: 500, y: 1200, district: 'Pasar Malam' },
    { name: 'Vila Senja', x: 1500, y: 1100, district: 'Bukit Vila' },
    { name: 'Dermaga Sol', x: 2800, y: 2100, district: 'Pantai Sol' },
  ];

  function blocked(x, y, r) {
    if (x < r || y < r || x > WORLD.width - r || y > WORLD.height - r) return true;
    for (const b of buildings) {
      if (x > b.x - r && x < b.x + b.w + r && y > b.y - r && y < b.y + b.h + r) return true;
    }
    return false;
  }

  return {
    buildings, trees, stalls, landmarks,
    districtAt: (x, y) => districtAt(x, y),
    isRoad,
    blocked,
    // A random point on a random road (for spawning traffic / parked cars).
    roadPoint() {
      if (rng.chance(0.5)) return { x: rng.pick(ROADS_X), y: rng.range(80, WORLD.height - 80) };
      return { x: rng.range(80, WORLD.width - 80), y: rng.pick(ROADS_Y) };
    },
    // A random sidewalk point near a road (for pedestrians).
    sidewalkPoint() {
      const p = { x: 0, y: 0 };
      if (rng.chance(0.5)) { p.x = rng.pick(ROADS_X) + rng.pick([-78, 78]); p.y = rng.range(80, WORLD.height - 80); }
      else { p.x = rng.range(80, WORLD.width - 80); p.y = rng.pick(ROADS_Y) + rng.pick([-78, 78]); }
      return p;
    },
  };
}
