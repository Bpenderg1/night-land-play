// Sound made live with the Web Audio API. No files. A low hum that grows as
// the presence nears, a slow beat in the chest as the mind is pressed, and
// a thin wind. Phone speakers are weak on very low notes, so the hum also
// has higher partials.
export function createAudio() {
  let ctx = null, master, hum, humGain, pan, wind, windGain, beatT = 0, wail, wailGain;

  function start() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);

    // Hum: two close low notes that beat against each other, plus a higher partial.
    pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    humGain = ctx.createGain();
    humGain.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    const parts = [[41, 'sine', 1], [43.3, 'sine', 1], [82.5, 'triangle', 0.5], [123, 'triangle', 0.25]];
    for (const [f, type, g] of parts) {
      const o = ctx.createOscillator();
      o.type = type; o.frequency.value = f;
      const gg = ctx.createGain(); gg.gain.value = g * 0.5;
      o.connect(gg); gg.connect(lp); o.start();
    }
    lp.connect(humGain);
    if (pan) { humGain.connect(pan); pan.connect(master); } else { humGain.connect(master); }

    // A thin wail that rises in pitch as the mind gives way.
    wail = ctx.createOscillator();
    wail.type = 'sine'; wail.frequency.value = 220;
    wailGain = ctx.createGain(); wailGain.gain.value = 0;
    wail.connect(wailGain); wailGain.connect(master); wail.start();

    // Wind: looped noise through a low filter.
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    wind = ctx.createBufferSource();
    wind.buffer = buf; wind.loop = true;
    const wf = ctx.createBiquadFilter();
    wf.type = 'lowpass'; wf.frequency.value = 380;
    windGain = ctx.createGain(); windGain.gain.value = 0.05;
    wind.connect(wf); wf.connect(windGain); windGain.connect(master); wind.start();
  }

  function thump(amp) {
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(70, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.18);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + 0.35);
  }

  // s: { noticed, nearness (0..1), pressure (0..1), overwhelm (0..1), pan (-1..1) }
  function update(dt, s) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const hear = s.noticed ? 0.03 + 0.5 * Math.pow(s.nearness, 1.3) + 0.25 * s.overwhelm : 0;
    humGain.gain.setTargetAtTime(hear, t, 0.5);
    if (pan) pan.pan.setTargetAtTime(s.pan, t, 0.3);
    wailGain.gain.setTargetAtTime(0.1 * s.overwhelm * s.overwhelm, t, 0.5);
    wail.frequency.setTargetAtTime(200 + 260 * s.overwhelm, t, 0.5);

    if (s.pressure > 0.15 || s.overwhelm > 0.2) {
      beatT -= dt;
      if (beatT <= 0) {
        thump(0.25 + 0.5 * Math.max(s.overwhelm, s.pressure));
        beatT = 1.2 - 0.7 * Math.max(s.overwhelm, s.pressure);
      }
    }
  }

  function stop() {
    if (!ctx) return;
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.6);
  }

  // Pausing silences everything at once; resuming carries on where it was.
  function pause() { if (ctx && ctx.state === 'running') ctx.suspend(); }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

  return { start, update, stop, pause, resume };
}
