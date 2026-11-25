// The rules of one play, with no graphics: phases, waking the installation,
// the two endings. Phases: 'out' (go to the installation), 'back' (return to
// the door), then ended = 'won' or 'lost'.
import { CFG } from './config.js';
import { GEAR } from './endings.js';
import { createLantern, setLevel, stepLantern } from './lantern.js';
import { createPresence, stepPresence } from './presence.js';
import { createCompanion, updateCompanion, reply, say, call } from './companion.js';

export function createGame(gearId, sayLine) {
  const gear = GEAR[gearId] || GEAR.cell;
  const g = {
    phase: 'out', ended: null, elapsed: 0,
    lantern: createLantern(gear.power),
    presence: createPresence(),
    companion: createCompanion(gear.trust, sayLine),
    stealthMul: gear.stealthMul,
    wake: 0, afterglow: 0, arrived: false, startDist: 0,
    guide: false,   // main.js sets this while the guided start runs
  };
  g.startDist = distTo(CFG.start, CFG.installation);
  say(g.companion, 'begin', true);
  return g;
}

function distTo(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }

export function targetOf(g) {
  return g.phase === 'out' ? CFG.installation : CFG.door;
}

export function progressOf(g, p) {
  const d = distTo(p, targetOf(g));
  const total = g.phase === 'out' ? g.startDist : distTo(CFG.installation, CFG.door);
  return Math.max(0, Math.min(1, 1 - d / total));
}

export function changeLight(g, delta) { return setLevel(g.lantern, g.lantern.level + delta); }
export function setLight(g, n) { return setLevel(g.lantern, n); }

// Returns true if the companion was waiting for an answer.
export function answer(g) {
  const relief = reply(g.companion);
  g.presence.overwhelm = Math.max(0, g.presence.overwhelm - relief);
  return relief > 0;
}

// The guided start asks the companion to call out once, and waits for the answer.
export function callCompanion(g) { call(g.companion, true); }

// Advance one frame. p is the player {x, z, h}; actHeld is true while waking.
export function stepGame(g, p, actHeld, dt) {
  if (g.ended) return;
  g.elapsed += dt;
  const events = [];

  if (stepLantern(g.lantern, dt) === 'spent') say(g.companion, 'spent', true);

  // Waking the installation.
  const dInst = distTo(p, CFG.installation);
  const nearInst = g.phase === 'out' && dInst < CFG.installReach;
  if (g.phase === 'out' && !g.arrived && dInst < 40) {
    g.arrived = true;
    say(g.companion, 'arrive', true);
  }
  if (nearInst && actHeld) {
    if (g.wake === 0) say(g.companion, 'waking', true);
    g.wake = Math.min(1, g.wake + dt / CFG.wakeSeconds);
    g.afterglow = CFG.wakeAfterglow;
  } else if (g.phase === 'out') {
    g.wake = Math.max(0, g.wake - dt / 3);
    g.afterglow = Math.max(0, g.afterglow - dt);
  } else {
    g.afterglow = Math.max(0, g.afterglow - dt);
  }
  if (g.phase === 'out' && g.wake >= 1) {
    g.phase = 'back';
    g.afterglow = CFG.wakeAfterglow;
    say(g.companion, 'woke', true);
  }

  const loud = g.afterglow > 0 || (nearInst && actHeld);
  const pres = g.presence;
  events.push(...stepPresence(pres, {
    px: p.x, pz: p.z, heading: p.h,
    level: g.lantern.level, trust: g.companion.trust,
    boost: loud ? 1 : 0, stealthMul: g.stealthMul, held: g.guide,
  }, dt));

  const doorDist = distTo(p, CFG.door);
  updateCompanion(g.companion, {
    phase: g.phase, progress: progressOf(g, p), level: g.lantern.level,
    spent: g.lantern.spent, presencePhase: pres.phase, overwhelm: pres.overwhelm,
    nearDoor: doorDist < 140, guide: g.guide,
  }, events, dt);

  // The two endings.
  if (pres.overwhelm >= 1) g.ended = 'lost';
  else if (g.phase === 'back' && doorDist < CFG.doorWinRadius) g.ended = 'won';
}
