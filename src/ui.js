// The words and meters drawn over the scene. Every element lives in index.html.
const $ = (id) => document.getElementById(id);

let lineTimer = 0;

export function say(text) {
  const el = $('line');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(lineTimer);
  lineTimer = setTimeout(() => el.classList.remove('show'), 7000 + text.length * 40);
}

// The guide box starts ticked the first time, and unticked once a player has
// been through the guide on this browser.
const GUIDED_KEY = 'nightland.guided';
function guidedBefore() { try { return localStorage.getItem(GUIDED_KEY) === '1'; } catch (e) { return false; } }
export function markGuided() { try { localStorage.setItem(GUIDED_KEY, '1'); } catch (e) { /* private mode */ } }

export function showStart(onBegin) {
  const overlay = $('start');
  overlay.style.display = 'flex';
  $('guideBox').checked = !guidedBefore();
  $('beginBtn').addEventListener('click', () => {
    const chosen = document.querySelector('input[name="gear"]:checked');
    overlay.style.display = 'none';
    onBegin(chosen ? chosen.value : 'cell', $('guideBox').checked);
  });
}

export function showEnding(title, text, stats) {
  $('endTitle').textContent = title;
  $('endText').textContent = text;
  $('endStats').textContent = stats;
  $('end').style.display = 'flex';
  $('hud').style.display = 'none';
  $('lookHint').classList.remove('show');
  $('vignette').style.opacity = 1;
}

export function playAgain() {
  $('againBtn').addEventListener('click', () => window.location.reload());
}

export function showHud() { $('hud').style.display = 'block'; }

// h: { power, levelName, spent, trust, awaiting, objective, arrow (radians or null),
//      prompt, wake (0..1), vignette (0..1 pressure), overwhelm (0..1),
//      guide ({ text, done } or null), callout (text or ''), lookHint (text or '') }
export function updateHud(h, time) {
  $('powerFill').style.width = h.power + '%';
  $('powerFill').classList.toggle('low', h.power < 20);
  $('levelName').textContent = h.spent ? 'Spent' : h.levelName;
  $('bondFill').style.width = h.trust * 100 + '%';
  $('btnTalk').classList.toggle('call', h.awaiting);
  $('objective').textContent = h.objective;

  const arrow = $('arrow');
  if (h.arrow === null) {
    arrow.style.opacity = 0;
  } else {
    arrow.style.opacity = 0.9;
    arrow.style.transform = `rotate(${h.arrow}rad)`;
  }

  $('prompt').textContent = h.prompt;

  const guide = $('guide');
  if (h.guide && h.guide.text) guide.textContent = h.guide.text;   // keep the old text while it fades out
  guide.classList.toggle('show', !!(h.guide && h.guide.text));
  guide.classList.toggle('done', !!(h.guide && h.guide.done));

  if (h.callout) $('callout').textContent = h.callout;
  $('callout').classList.toggle('show', !!h.callout);

  $('lookHint').textContent = h.lookHint;
  $('lookHint').classList.toggle('show', !!h.lookHint);
  $('wakeBar').style.display = h.wake > 0 ? 'block' : 'none';
  $('wakeFill').style.width = h.wake * 100 + '%';

  // The edges darken as the presence presses on the mind, and pulse with it.
  const press = Math.max(h.vignette, h.overwhelm);
  const pulse = 0.5 + 0.5 * Math.sin(time * (2 + 5 * press));
  const clear = 78 - 62 * press - 6 * pulse * press;
  const v = $('vignette');
  v.style.setProperty('--clear', clear + '%');
  v.style.opacity = Math.min(1, 0.15 + press * 1.1);
}
