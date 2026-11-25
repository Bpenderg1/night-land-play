// Keyboard and mouse on a computer, a thumb stick and buttons on a phone.
//   Move: W A S D or arrows      Look: mouse (click the scene first)
//   Light: R / F, mouse wheel, or keys 0 to 3      Answer companion: T
//   Wake the installation: hold E
// Phone: drag on the left half to walk, drag on the right half to look.
// On a computer the mouse is captured (pointer lock) while you play. Esc frees it.
import { isTouch } from './device.js';

export function createInput(handlers) {
  const keys = new Set();
  let lookX = 0, lookY = 0;
  let stickX = 0, stickY = 0;
  let wakeButton = false;
  let lookTotal = 0;          // radians turned in all, for the guided start
  let everLocked = false, lockFailed = false;
  const touches = new Map();
  let dragging = false;
  const stickEl = document.getElementById('stick');
  const knobEl = document.getElementById('knob');
  const canvas = document.querySelector('canvas');

  const input = {
    get moveX() {
      return Math.max(-1, Math.min(1, stickX + (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0)
        - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0)));
    },
    get moveY() {
      return Math.max(-1, Math.min(1, stickY + (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0)
        - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0)));
    },
    get act() { return keys.has('KeyE') || wakeButton; },
    takeLookX() { const v = lookX; lookX = 0; return v; },
    takeLookY() { const v = lookY; lookY = 0; return v; },
    get lookTotal() { return lookTotal; },
    get locked() { return !!document.pointerLockElement; },
    get lockFailed() { return lockFailed; },   // the browser refused to capture the mouse: drag to look
    get dragging() { return dragging; },
    lock,
  };

  // Capture the mouse. Must run inside a click or key press.
  function lock() {
    if (isTouch || !canvas || !canvas.requestPointerLock) return;
    try {
      const r = canvas.requestPointerLock();
      if (r && r.catch) r.catch(() => {});
    } catch (err) { /* drag fallback */ }
  }
  document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement) everLocked = true; });
  // A refusal right after Esc is the browser's short cooldown, not a lack of support.
  document.addEventListener('pointerlockerror', () => { if (!everLocked) lockFailed = true; });

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'KeyR') handlers.light(+1);
    if (e.code === 'KeyF') handlers.light(-1);
    if (e.code === 'KeyT') handlers.reply();
    if (e.code >= 'Digit0' && e.code <= 'Digit3') handlers.setLight(Number(e.code.slice(5)));
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  // Mouse look: pointer lock when we can get it, otherwise drag.
  window.addEventListener('mousedown', (e) => {
    if (!handlers.isRunning() || e.target.closest('button')) return;
    if (!document.pointerLockElement) lock();
    dragging = true;
  });
  window.addEventListener('mouseup', () => { dragging = false; });
  window.addEventListener('mousemove', (e) => {
    if (!handlers.isRunning()) return;
    if (document.pointerLockElement || dragging) {
      lookX += e.movementX * 0.0024;
      lookY += e.movementY * 0.0024;
      lookTotal += Math.abs(e.movementX * 0.0024) + Math.abs(e.movementY * 0.0024);
    }
  });
  window.addEventListener('wheel', (e) => {
    if (handlers.isRunning()) handlers.light(e.deltaY < 0 ? +1 : -1);
  }, { passive: true });

  // Touch.
  const STICK = 60;
  function onButton(t) { return t.target.closest && t.target.closest('button, .overlay'); }
  window.addEventListener('touchstart', (e) => {
    if (!handlers.isRunning()) return;
    for (const t of e.changedTouches) {
      if (onButton(t)) continue;
      const kind = t.clientX < window.innerWidth / 2 ? 'move' : 'look';
      touches.set(t.identifier, { kind, sx: t.clientX, sy: t.clientY, lx: t.clientX, ly: t.clientY });
      if (kind === 'move' && stickEl) {
        stickEl.style.display = 'block';
        stickEl.style.left = t.clientX - STICK + 'px';
        stickEl.style.top = t.clientY - STICK + 'px';
        knobEl.style.transform = 'translate(0px, 0px)';
      }
    }
  }, { passive: false });
  window.addEventListener('touchmove', (e) => {
    if (!handlers.isRunning()) return;
    for (const t of e.changedTouches) {
      const s = touches.get(t.identifier);
      if (!s) continue;
      e.preventDefault();
      if (s.kind === 'move') {
        let dx = t.clientX - s.sx, dy = t.clientY - s.sy;
        const d = Math.hypot(dx, dy);
        if (d > STICK) { dx *= STICK / d; dy *= STICK / d; }
        stickX = dx / STICK; stickY = -dy / STICK;
        if (knobEl) knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
      } else {
        lookX += (t.clientX - s.lx) * 0.005;
        lookY += (t.clientY - s.ly) * 0.005;
        lookTotal += Math.abs(t.clientX - s.lx) * 0.005 + Math.abs(t.clientY - s.ly) * 0.005;
        s.lx = t.clientX; s.ly = t.clientY;
      }
    }
  }, { passive: false });
  function endTouch(e) {
    for (const t of e.changedTouches) {
      const s = touches.get(t.identifier);
      if (!s) continue;
      if (s.kind === 'move') {
        stickX = 0; stickY = 0;
        if (stickEl) stickEl.style.display = 'none';
      }
      touches.delete(t.identifier);
    }
  }
  window.addEventListener('touchend', endTouch);
  window.addEventListener('touchcancel', endTouch);

  // On-screen buttons (work for mouse and touch).
  function bind(id, down, up) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); down(); });
    if (up) {
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('pointerleave', up);
    }
  }
  bind('btnUp', () => handlers.light(+1));
  bind('btnDown', () => handlers.light(-1));
  bind('btnTalk', () => handlers.reply());
  bind('btnWake', () => { wakeButton = true; }, () => { wakeButton = false; });

  return input;
}
