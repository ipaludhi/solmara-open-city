// Story: six named missions for Raka and the Kru Senja heist crew.
// Each mission has a named target on the map, an objective the HUD shows,
// and a cash reward. Missions run in order; finishing one unlocks the next.
export const MISSIONS = [
  { id: 1, name: 'Kurir Pertama', giver: 'Dimas — Kru Senja', kind: 'goto', target: { x: 300, y: 300, r: 70, label: 'Dermaga Tua' }, reward: 150, desc: 'Antar paket pertama ke Dermaga Tua.' },
  { id: 2, name: 'Kabur dari Pelabuhan', giver: 'Dimas — Kru Senja', kind: 'goto', target: { x: 1500, y: 1100, r: 80, label: 'Vila Senja' }, reward: 300, desc: 'Polisi mengejarmu! Kabur ke Vila Senja.', startWanted: 2 },
  { id: 3, name: 'Antar Paket ke Pasar Malam', giver: 'Sari — Pasar Malam', kind: 'goto', target: { x: 500, y: 1200, r: 80, label: 'Pasar Malam' }, reward: 400, desc: 'Antar "paket" Sari ke kios Pasar Malam.' },
  { id: 4, name: 'Curi Mobil Balap', giver: 'Dimas — Kru Senja', kind: 'steal', target: { x: 2200, y: 500, r: 90, label: 'Cendrawasih Sport' }, reward: 600, desc: 'Curi Cendrawasih Sport hijau di Distrik Neon.' },
  { id: 5, name: 'Heist Bank Solmara', giver: 'Kru Senja', kind: 'heist', target: { x: 1300, y: 320, r: 80, label: 'Bank Solmara' }, escape: { x: 2800, y: 2100, r: 100, label: 'Dermaga Sol' }, reward: 2500, desc: 'Rampok Bank Solmara, lalu kabur ke Dermaga Sol.' },
  { id: 6, name: 'Pelarian Terakhir', giver: 'Raka', kind: 'escape', target: { x: 2800, y: 2100, r: 100, label: 'Dermaga Sol' }, reward: 5000, desc: 'Hilangkan wanted, lalu kabur lewat Dermaga Sol.' },
];

export function createMissions() {
  return { index: 0, done: [], banner: null, bannerTimer: 0, phase: 0, started: false };
}

export function currentMission(m) {
  return m.index < MISSIONS.length ? MISSIONS[m.index] : null;
}

export function missionTarget(m) {
  const cur = currentMission(m);
  if (!cur) return null;
  if (cur.kind === 'heist' && m.phase === 1) return cur.escape;
  return cur.target;
}

export function missionObjectiveText(m) {
  const cur = currentMission(m);
  if (!cur) return 'Semua misi selesai — Solmara milikmu, Raka.';
  if (cur.kind === 'heist' && m.phase === 1) return `MISI 5: ${cur.name} — KABUR ke ${cur.escape.label}!`;
  if (cur.kind === 'steal') return `MISI 4: ${cur.name} — curi ${cur.target.label}`;
  if (cur.kind === 'escape') return `MISI 6: ${cur.name} — hilangkan ★ lalu ke ${cur.target.label}`;
  return `MISI ${cur.id}: ${cur.name} — ke ${cur.target.label}`;
}

export function showBanner(m, text, sub) {
  m.banner = { text, sub: sub || '' };
  m.bannerTimer = 3.2;
}

// Checks completion each update. Returns 'complete' | 'phase' | 'story-done' | null.
export function updateMissions(m, state) {
  const cur = currentMission(m);
  if (!cur) return null;
  const p = state.player;
  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;
  if (!m.started) {
    m.started = true;
    showBanner(m, `MISI ${cur.id}: ${cur.name}`, `${cur.giver} — ${cur.desc}`);
    if (cur.startWanted) {
      state.police.wanted = cur.startWanted;
    }
  }
  const dist = (t) => Math.sqrt((px - t.x) ** 2 + (py - t.y) ** 2);
  if (cur.kind === 'steal') {
    if (p.car && p.car.id === 4) {
      return completeMission(m, state, cur);
    }
    return null;
  }
  if (cur.kind === 'heist' && m.phase === 0) {
    if (dist(cur.target) < cur.target.r) {
      m.phase = 1;
      state.police.wanted = Math.max(state.police.wanted, 3);
      showBanner(m, 'BANK DIRAMPOK!', 'Polisi mengejar — kabur ke Dermaga Sol!');
      state.floaters.push({ x: px, y: py - 40, text: '+$0 — KABUR!', color: '#ffd23e', ttl: 1.6 });
      return 'phase';
    }
    return null;
  }
  if (cur.kind === 'escape') {
    if (state.police.wanted > 0) return null;
    if (dist(cur.target) < cur.target.r) return completeMission(m, state, cur);
    return null;
  }
  const t = missionTarget(m);
  if (t && dist(t) < t.r) return completeMission(m, state, cur);
  return null;
}

function completeMission(m, state, cur) {
  state.cash += cur.reward;
  m.done.push(cur.id);
  m.index += 1;
  m.phase = 0;
  m.started = false;
  const p = state.player;
  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;
  state.floaters.push({ x: px, y: py - 40, text: `+$${cur.reward.toLocaleString('en-US')}`, color: '#4ade80', ttl: 2 });
  showBanner(m, `MISI SELESAI: ${cur.name}`, `+$${cur.reward.toLocaleString('en-US')} — ${m.index < MISSIONS.length ? `misi ${m.index + 1} dibuka` : 'cerita tamat!'}`);
  state.stats.missionsDone += 1;
  state.audio.jingle();
  if (m.index >= MISSIONS.length) return 'story-done';
  return 'complete';
}
