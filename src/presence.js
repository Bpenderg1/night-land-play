// The presence in the dark. It is never seen plainly. This file holds its
// behaviour only (no graphics), so it can be tested on its own.
//
// How it works:
//  - It stays dormant until you are well away from the Redoubt, then it notices you.
//    While the guided start runs (c.held) it stays dormant regardless.
//  - Hunting: it moves toward where it believes you are. Bright light tells it
//    exactly, and it moves fast. Darkness leaves it guessing, and it moves slowly.
//  - Within its reach it presses on your mind (overwhelm). A strong bond with
//    the companion slows this.
//  - After a spell of hunting it draws off for a while (a lull), then returns.
//    Bright light during a lull calls it back early.
import { CFG } from './config.js';

const SPEED = [0.6, 2.4, 3.6, 5.0];   // metres per second by effective light level
const NOISE = [130, 30, 6, 0];        // how wrong its idea of your position is
const UPDATE = [16, 3, 0.6, 0.3];     // seconds between updates of that idea
const REACH = 140;                    // distance at which it begins to press on you
const HUNT_SECONDS = 130;
const LULL_SECONDS = 45;
const NOTICE_DISTANCE = 180;          // from the Redoubt door

export function createPresence() {
  return {
    phase: 'dormant', x: 0, z: 0, tx: 0, tz: 0, upd: 0, timer: 0,
    dist: 9999, pressure: 0, overwhelm: 0, brightTime: 0,
    closeSaid: false, nearSaid: false, vx: 0, vz: 0, lx: null, lz: null,
  };
}

function rand(a, b) { return a + Math.random() * (b - a); }

function resume(p) {
  p.phase = 'hunting'; p.timer = 0; p.upd = 0; p.brightTime = 0;
  p.closeSaid = false; p.nearSaid = false;
}

export function stepPresence(p, c, dt) {
  const ev = [];
  const doorDist = Math.hypot(c.px - CFG.door.x, c.pz - CFG.door.z);
  const safe = doorDist < CFG.safeRadius;
  const eff = c.boost > 0 ? 3 : c.level;
  if (p.lx !== null && dt > 0) { p.vx = (c.px - p.lx) / dt; p.vz = (c.pz - p.lz) / dt; }
  p.lx = c.px; p.lz = c.pz;

  if (p.phase === 'dormant') {
    if (!c.held && doorDist > NOTICE_DISTANCE) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const a = c.heading + side * rand(0.6, 1.3);
      p.x = c.px + Math.sin(a) * 160;
      p.z = c.pz + Math.cos(a) * 160;
      p.tx = c.px; p.tz = c.pz;
      resume(p);
      ev.push('noticed');
    }
  } else if (p.phase === 'hunting') {
    p.timer += dt;
    if (safe) {
      p.phase = 'lull'; p.timer = 0; ev.push('driven_back');
    } else if (p.timer > HUNT_SECONDS) {
      p.phase = 'lull'; p.timer = 0; ev.push('lull');
    } else {
      p.upd -= dt;
      if (p.upd <= 0) {
        p.upd = UPDATE[eff];
        const noise = NOISE[eff] * (eff < 2 ? c.stealthMul : 1);
        const ang = rand(0, Math.PI * 2);
        const r = noise * Math.sqrt(Math.random());
        // When it can sense you, it aims a little ahead of where you are going.
        const lead = eff >= 2 ? 6 : eff === 1 ? 3 : 0;
        p.tx = c.px + p.vx * lead + Math.cos(ang) * r;
        p.tz = c.pz + p.vz * lead + Math.sin(ang) * r;
      }
      const dx = p.tx - p.x, dz = p.tz - p.z;
      const d = Math.hypot(dx, dz);
      const sp = SPEED[eff] * (c.boost > 0 ? 1.5 : 1);
      if (d > 6) {
        p.x += (dx / d) * sp * dt;
        p.z += (dz / d) * sp * dt;
      } else {
        // It has reached where it thought you were. It mills about, searching.
        p.x += rand(-1, 1) * 2 * dt;
        p.z += rand(-1, 1) * 2 * dt;
      }
    }
  } else if (p.phase === 'lull') {
    p.timer += dt;
    const dx = p.x - c.px, dz = p.z - c.pz;
    const d = Math.hypot(dx, dz) || 1;
    p.x += (dx / d) * 3 * dt;
    p.z += (dz / d) * 3 * dt;
    p.brightTime = eff === 3 ? p.brightTime + dt : 0;
    if (!safe && p.brightTime > 4 && d < 400) {
      resume(p); ev.push('drawn');
    } else if (p.timer > LULL_SECONDS && !safe) {
      resume(p); ev.push('returns');
    }
  }

  // Pressure on the mind.
  p.dist = Math.hypot(c.px - p.x, c.pz - p.z);
  p.pressure = p.phase === 'dormant' || safe || p.dist >= REACH
    ? 0 : Math.pow(1 - p.dist / REACH, 1.3);

  if (p.pressure > 0) {
    let rate = 0.045 * p.pressure * (1 - 0.6 * c.trust);
    if (eff === 3) rate *= 1.4;
    p.overwhelm += rate * dt;
  } else {
    const heal = (safe ? 0.05 : 0.012) * (0.5 + c.trust);
    p.overwhelm -= heal * dt;
  }
  p.overwhelm = Math.max(0, Math.min(1, p.overwhelm));

  if (p.phase === 'hunting') {
    if (!p.closeSaid && p.dist < 110) { p.closeSaid = true; ev.push('close'); }
    if (!p.nearSaid && p.dist < 45) { p.nearSaid = true; ev.push('near'); }
  }
  return ev;
}
