// Keyboard + mouse input. Edge-triggered presses are consumed per fixed
// update (wasPressed clears the flag it reads), so one key press is never
// read twice when a slow frame runs two updates — see mistakes log, CANTING
// space double-toggle. Listeners live on window so headless CDP synthetic
// KeyboardEvents dispatched on window are seen exactly like real keys.
export const ACTION = {
  UP: 'KeyW', DOWN: 'KeyS', LEFT: 'KeyA', RIGHT: 'KeyD',
  UP2: 'ArrowUp', DOWN2: 'ArrowDown', LEFT2: 'ArrowLeft', RIGHT2: 'ArrowRight',
  ENTER_CAR: 'KeyE', PUNCH: 'Space', SHOOT: 'KeyF', RELOAD: 'KeyR',
  PAUSE: 'KeyP', MUTE: 'KeyM', CONFIRM: 'Enter', RESTART: 'KeyR',
};

export function createInput(canvas) {
  const down = new Set();
  const pressed = new Set();
  const mouse = { x: 640, y: 360, down: false, clicked: false };

  function onKeyDown(ev) {
    if (ev.repeat) return;
    if (!down.has(ev.code)) pressed.add(ev.code);
    down.add(ev.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(ev.code)) ev.preventDefault();
  }
  function onKeyUp(ev) { down.delete(ev.code); }
  function toLogical(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 1280,
      y: ((clientY - rect.top) / rect.height) * 720,
    };
  }
  function onMouseMove(ev) {
    const p = toLogical(ev.clientX, ev.clientY);
    mouse.x = p.x; mouse.y = p.y;
  }
  function onMouseDown(ev) {
    const p = toLogical(ev.clientX, ev.clientY);
    mouse.x = p.x; mouse.y = p.y; mouse.down = true; mouse.clicked = true;
  }
  function onMouseUp() { mouse.down = false; }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('blur', () => { down.clear(); });

  return {
    mouse,
    isDown(code) { return down.has(code); },
    // Edge read: true only once per physical press.
    wasPressed(code) {
      if (pressed.has(code)) { pressed.delete(code); return true; }
      return false;
    },
    // Movement vector from WASD or arrows, normalised.
    moveVector() {
      let x = 0; let y = 0;
      if (down.has(ACTION.LEFT) || down.has(ACTION.LEFT2)) x -= 1;
      if (down.has(ACTION.RIGHT) || down.has(ACTION.RIGHT2)) x += 1;
      if (down.has(ACTION.UP) || down.has(ACTION.UP2)) y -= 1;
      if (down.has(ACTION.DOWN) || down.has(ACTION.DOWN2)) y += 1;
      if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
      return { x, y };
    },
    // Test helpers: inject a press without a real event (used by autopilot).
    inject(code) { pressed.add(code); down.add(code); },
    release(code) { down.delete(code); },
    consumeClick() {
      const c = mouse.clicked; mouse.clicked = false; return c;
    },
  };
}
