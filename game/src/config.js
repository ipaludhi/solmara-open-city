// SOLMARA: Open City — every tuning number, name and colour in one place.
// The world is 3200x2400 logical units; the camera shows a 1280x720 window of it.
// All names, characters, vehicles, districts and story are original — nothing
// from any commercial game. Golden hour on a fictional coast: Solmara.
export const VIEW = { width: 1280, height: 720 };
export const WORLD = { width: 3200, height: 2400 };
export const STEP = 1 / 60;
export const SAVE_KEY = 'solmara.save.v1';
export const BEST_KEY = 'solmara.best.v1';
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

// Roads: vertical x-centres and horizontal y-centres, each 120 wide.
export const ROADS_X = [400, 1000, 1600, 2200, 2800];
export const ROADS_Y = [350, 800, 1250, 1700, 2050];
export const ROAD_W = 120;

// Six named districts, each with its own ground palette and landmark.
export const DISTRICTS = [
  { name: 'Pelabuhan Tua', short: 'PELABUHAN', x: 0, y: 0, w: 1050, h: 800, ground: '#8a7a5c', road: '#5c5344', accent: '#d9a441', landmark: 'Dermaga Tua', blurb: 'dermaga & gudang' },
  { name: 'Kota Lama', short: 'KOTA LAMA', x: 1050, y: 0, w: 1050, h: 800, ground: '#9c8f7a', road: '#6b6156', accent: '#c96f3f', landmark: 'Menara Jam', blurb: 'menara jam 1890' },
  { name: 'Distrik Neon', short: 'NEON', x: 2100, y: 0, w: 1100, h: 1700, ground: '#3d3a55', road: '#2c2a40', accent: '#ff2e88', landmark: 'Menara Neon', blurb: 'kasino & klub' },
  { name: 'Pasar Malam', short: 'PASAR', x: 0, y: 800, w: 1050, h: 900, ground: '#7a5a44', road: '#574233', accent: '#ffc233', landmark: 'Pasar Malam', blurb: 'kios & lampion' },
  { name: 'Bukit Vila', short: 'BUKIT VILA', x: 1050, y: 800, w: 1050, h: 900, ground: '#5f7a4e', road: '#46593a', accent: '#a8d94a', landmark: 'Vila Senja', blurb: 'vila & taman' },
  { name: 'Pantai Sol', short: 'PANTAI SOL', x: 0, y: 1700, w: 3200, h: 700, ground: '#d9b878', road: '#a8895a', accent: '#2ea8c9', landmark: 'Dermaga Sol', blurb: 'pantai & laut' },
];

// Original vehicle models (names invented for this game).
export const CAR_MODELS = [
  { name: 'Kancil GT', color: '#e8b73a', top: 340, accel: 260, grip: 3.4, len: 46, wid: 22 },
  { name: 'Elang Sedan', color: '#3f7fd9', top: 300, accel: 230, grip: 3.2, len: 46, wid: 22 },
  { name: 'Komodo Pickup', color: '#c9502e', top: 280, accel: 210, grip: 3.0, len: 50, wid: 23 },
  { name: 'Cendrawasih Sport', color: '#22c55e', top: 380, accel: 300, grip: 3.8, len: 44, wid: 21 },
  { name: 'Banteng Van', color: '#8b5cf6', top: 250, accel: 180, grip: 2.8, len: 54, wid: 24 },
  { name: 'Badak Truck', color: '#64748b', top: 230, accel: 160, grip: 2.6, len: 60, wid: 25 },
];
export const POLICE_MODEL = { name: 'Patroli Solmara', color: '#1e293b', top: 360, accel: 300, grip: 3.6, len: 48, wid: 22 };

export const PLAYER = { radius: 13, walkSpeed: 230, hp: 100, punchRange: 34, punchDamage: 12 };
export const PISTOL = { damage: 34, range: 460, fireInterval: 0.28, reloadTime: 1.1, magSize: 12 };
export const WANTED_MAX = 5;
export const CLOCK_START_MIN = 17 * 60 + 42; // 17:42 golden hour

export const PALETTE = {
  sky: '#f2a35e', skyTop: '#e2703a', sun: '#ffd97a',
  sidewalk: '#b9a98c', line: '#e8e0c8', curb: '#8f8271',
  buildingRoof: '#6d5a49', buildingWall: '#cbb79a', window: '#ffd97a',
  tree: '#3f6b34', treeDark: '#2f5226', water: '#2e7fa8', sand: '#e0c184',
  text: '#fff7e6', muted: '#d8c9a8', panel: 'rgba(20,16,12,0.78)',
  police: '#2563eb', policeLight: '#ff2e2e', star: '#ffd23e',
  mission: '#ffd23e', danger: '#ff4d4d', good: '#4ade80',
};
