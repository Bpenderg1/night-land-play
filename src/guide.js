// The guided start: one instruction at a time, before the presence can
// notice you. main.js feeds it running totals of what the player has done:
// { looked (radians turned), walked (metres), lightChanges, answered }.
// Each step is done when the player has done enough since the step began.
const STEPS = [
  {
    desk: 'Move the mouse to look around.',
    touch: 'Drag your right thumb to look around.',
    done: (s, b) => s.looked - b.looked > 1.2,
  },
  {
    desk: 'Walk with W A S D or the arrow keys.',
    touch: 'Drag your left thumb to walk.',
    done: (s, b) => s.walked - b.walked > 6,
  },
  {
    desk: 'Press R to brighten your light and F to dim it. Try both.',
    touch: 'Tap Light + and Light − to change your light. Try both.',
    done: (s, b) => s.lightChanges - b.lightChanges >= 2,
  },
  {
    desk: 'Your companion will call to you now and then. Answer, and the bond between you helps hold off the dark.',
    touch: 'Your companion will call to you now and then. Answer, and the bond between you helps hold off the dark.',
    call: true,
    done: (s) => s.answered,
  },
  {
    desk: 'Follow the arrow to the old installation. Bright light draws what waits out there. The dark hides you.',
    touch: 'Follow the arrow to the old installation. Bright light draws what waits out there. The dark hides you.',
    done: (s, b, t) => t > 9,
  },
];

const PAUSE = 0.9;   // seconds between a step being done and the next one showing

export function createGuide(on, s) {
  return { on, i: 0, t: 0, pause: 0, base: { ...s }, entered: on };
}

// Advance the guide. Returns { text, done, call } while it runs, or null once
// it is over. done is true for the short pause after a step is completed.
// call is true only on the frame the companion should call out.
export function stepGuide(gd, s, dt, touch) {
  if (!gd.on) return null;
  const step = STEPS[gd.i];
  let call = false;
  if (gd.entered) { gd.entered = false; call = !!step.call; }
  if (gd.pause > 0) {
    gd.pause -= dt;
    if (gd.pause <= 0) {
      gd.i += 1;
      if (gd.i >= STEPS.length) { gd.on = false; return null; }
      gd.t = 0; gd.base = { ...s }; gd.entered = true;
    }
    return { text: touch ? step.touch : step.desk, done: true, call: false };
  }
  gd.t += dt;
  if (step.done(s, gd.base, gd.t)) gd.pause = PAUSE;
  return { text: touch ? step.touch : step.desk, done: false, call };
}
