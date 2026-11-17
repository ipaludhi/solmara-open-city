// Save / continue: cash, mission progress and best run live in localStorage.
// Everything is guarded — a browser without storage just plays fresh.
import { BEST_KEY, SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return data;
  } catch { return null; }
}

export function saveGame(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: state.cash,
      missionIndex: state.missions.index,
      done: state.missions.done,
      missionsDone: state.stats.missionsDone,
      carsStolen: state.stats.carsStolen,
      savedAtStep: state.time,
    }));
  } catch { /* storage unavailable: play on without saving */ }
}

export function loadBest() {
  try {
    const raw = window.localStorage.getItem(BEST_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function saveBest(best) {
  try { window.localStorage.setItem(BEST_KEY, JSON.stringify(best)); } catch { /* ignore */ }
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}
