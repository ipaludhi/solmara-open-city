// Sound: everything is synthesised with WebAudio — engine hum, two-tone
// siren, pickup blips, mission jingle, gunshot. No audio files, no network.
// The context is created on the first user gesture; until then every call
// is a safe no-op, so headless screenshots never throw.
export function createAudio() {
  const a = {
    ctx: null, master: null, engineOsc: null, engineGain: null,
    sirenOsc: null, sirenGain: null, sirenHigh: false, sirenTimer: 0,
    muted: false,
    ensure() {
      if (a.ctx) { if (a.ctx.state === 'suspended') a.ctx.resume().catch(() => {}); return; }
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        a.ctx = new AC();
        a.master = a.ctx.createGain();
        a.master.gain.value = a.muted ? 0 : 0.35;
        a.master.connect(a.ctx.destination);
        a.engineOsc = a.ctx.createOscillator();
        a.engineOsc.type = 'sawtooth';
        a.engineOsc.frequency.value = 55;
        a.engineGain = a.ctx.createGain();
        a.engineGain.gain.value = 0;
        a.engineOsc.connect(a.engineGain);
        a.engineGain.connect(a.master);
        a.engineOsc.start();
        a.sirenOsc = a.ctx.createOscillator();
        a.sirenOsc.type = 'square';
        a.sirenOsc.frequency.value = 720;
        a.sirenGain = a.ctx.createGain();
        a.sirenGain.gain.value = 0;
        a.sirenOsc.connect(a.sirenGain);
        a.sirenGain.connect(a.master);
        a.sirenOsc.start();
      } catch { a.ctx = null; }
    },
    setMuted(m) {
      a.muted = m;
      if (a.master) a.master.gain.value = m ? 0 : 0.35;
    },
    engine(speed01) {
      if (!a.ctx || !a.engineOsc) return;
      a.engineOsc.frequency.setTargetAtTime(55 + speed01 * 110, a.ctx.currentTime, 0.08);
      a.engineGain.gain.setTargetAtTime(0.02 + speed01 * 0.05, a.ctx.currentTime, 0.1);
    },
    siren(on, dt) {
      if (!a.ctx || !a.sirenOsc) return;
      a.sirenTimer += dt;
      if (a.sirenTimer > 0.45) {
        a.sirenTimer = 0;
        a.sirenHigh = !a.sirenHigh;
        a.sirenOsc.frequency.value = a.sirenHigh ? 950 : 700;
      }
      a.sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, a.ctx.currentTime, 0.1);
    },
    tone(freq, dur, type, vol) {
      if (!a.ctx) return;
      try {
        const o = a.ctx.createOscillator();
        const g = a.ctx.createGain();
        o.type = type || 'sine';
        o.frequency.value = freq;
        g.gain.setValueAtTime(vol || 0.2, a.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, a.ctx.currentTime + dur);
        o.connect(g); g.connect(a.master);
        o.start(); o.stop(a.ctx.currentTime + dur);
      } catch { /* ignore */ }
    },
    blip() { a.tone(880, 0.12, 'sine', 0.22); },
    punch() { a.tone(160, 0.12, 'square', 0.25); },
    shot() { a.tone(220, 0.09, 'square', 0.3); a.tone(90, 0.14, 'sawtooth', 0.25); },
    crash() { a.tone(70, 0.25, 'sawtooth', 0.3); },
    jingle() {
      if (!a.ctx) return;
      [523, 659, 784, 1047].forEach((f, i) => {
        setTimeout(() => a.tone(f, 0.22, 'triangle', 0.25), i * 110);
      });
    },
  };
  return a;
}
