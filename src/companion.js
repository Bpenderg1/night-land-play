// The companion: scripted lines, and a trust value (0 to 1) that the player
// raises by answering when called, and lowers by staying silent or by
// lighting the dark like a beacon while the presence hunts.
import { LINES } from './lines.js';

const ANSWER_WINDOW = 12;   // seconds the player has to reply
const MILESTONES = [0.25, 0.5, 0.75];

export function createCompanion(trust, say) {
  const c = {
    trust, awaiting: 0, say,
    cool: 0, idle: 40, checkin: 75, darkT: 0, brightT: 0, darkCool: 0, brightCool: 0,
    said: {}, lastLine: {}, losingCool: 0,
  };
  return c;
}

function speak(c, cat, force) {
  if (!force && c.cool > 0) return false;
  const pool = LINES[cat];
  if (!pool) return false;
  let i = Math.floor(Math.random() * pool.length);
  if (pool.length > 1 && i === c.lastLine[cat]) i = (i + 1) % pool.length;
  c.lastLine[cat] = i;
  c.say(pool[i]);
  c.cool = 6;
  return true;
}

export function say(c, cat, force) { speak(c, cat, force); }

// Call out for an answer now. patient: wait as long as it takes (used by the
// guided start, so a new player is not punished while learning the key).
export function call(c, patient) {
  speak(c, 'checkin', true);
  c.awaiting = patient ? Infinity : ANSWER_WINDOW;
}

// ctx: { phase, progress, level, presencePhase, overwhelm, nearDoor, spent, guide }
// guide: true while the guided start runs; regular check-ins wait until it ends.
export function updateCompanion(c, ctx, events, dt) {
  c.cool = Math.max(0, c.cool - dt);
  c.darkCool = Math.max(0, c.darkCool - dt);
  c.brightCool = Math.max(0, c.brightCool - dt);
  c.losingCool = Math.max(0, c.losingCool - dt);

  for (const e of events) speak(c, e, true);

  // Milestones on the way out and on the way back.
  const prefix = ctx.phase === 'out' ? 'out' : 'back';
  for (const m of MILESTONES) {
    const key = prefix + Math.round(m * 100) + '_' + ctx.phase;
    if (ctx.progress >= m && !c.said[key]) {
      if (speak(c, prefix + Math.round(m * 100), false)) c.said[key] = true;
    }
  }
  if (ctx.phase === 'back' && ctx.nearDoor && !c.said.nearDoor_x) {
    if (speak(c, 'nearDoor', true)) c.said.nearDoor_x = true;
  }

  // Remarks about how the player is using the light.
  c.darkT = ctx.level === 0 && !ctx.spent ? c.darkT + dt : 0;
  c.brightT = ctx.level === 3 && ctx.presencePhase === 'hunting' ? c.brightT + dt : 0;
  if (c.darkT > 20 && c.darkCool === 0) { speak(c, 'dark', false); c.darkCool = 90; }
  if (c.brightT > 6 && c.brightCool === 0) { speak(c, 'bright', false); c.brightCool = 45; }
  if (c.brightT > 0) c.trust = Math.max(0, c.trust - 0.003 * dt);

  // Check-ins: the player answers to build trust.
  if (c.awaiting > 0) {
    c.awaiting -= dt;
    if (c.awaiting <= 0) {
      c.awaiting = 0;
      c.trust = Math.max(0, c.trust - 0.05);
      speak(c, 'timeout', true);
    }
  } else {
    c.checkin -= dt;
    const pressed = ctx.overwhelm > 0.5;
    if (pressed && c.losingCool === 0) {
      speak(c, 'losing', true);
      c.awaiting = ANSWER_WINDOW;
      c.losingCool = 30;
    } else if (c.checkin <= 0 && !ctx.guide) {
      speak(c, 'checkin', true);
      c.awaiting = ANSWER_WINDOW;
      c.checkin = 70 + Math.random() * 25;
    }
  }

  // Idle talk when nothing else is going on.
  c.idle -= dt;
  if (c.idle <= 0) {
    if (c.awaiting === 0 && ctx.presencePhase !== 'hunting') speak(c, 'idle', false);
    c.idle = 45 + Math.random() * 25;
  }
}

// The player answers. Returns how much overwhelm the voice takes off.
export function reply(c) {
  if (c.awaiting <= 0) return 0;
  c.awaiting = 0;
  c.trust = Math.min(1, c.trust + 0.08);
  speak(c, 'reassure', true);
  return 0.07;
}
