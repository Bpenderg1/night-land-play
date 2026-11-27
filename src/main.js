// The Night Land. This file wires the pieces together and runs the loop.
import * as THREE from 'three';
import { CFG } from './config.js';
import { createWorld } from './world.js';
import { createPlayer, buildGrid, stepPlayer } from './player.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createGame, stepGame, changeLight, setLight, answer, callCompanion, targetOf } from './game.js';
import { createGuide, stepGuide } from './guide.js';
import { isTouch } from './device.js';
import { LEVELS } from './lantern.js';
import { ENDINGS } from './endings.js';
import * as ui from './ui.js';
import { createPost } from './post.js';

document.body.classList.add(isTouch ? 'touch' : 'desk');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, CFG.look.maxPixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const world = createWorld(renderer);
const player = createPlayer();
const grid = buildGrid(world.obstacles);
const audio = createAudio();
const post = createPost(renderer, world.scene, world.camera);

let game = null;
let running = false;
let paused = false;   // while paused the game does not step: no time passes, nothing moves
let clock = 0;
let startedAt = 0;

// What the player has done so far, for the guided start.
const done = { looked: 0, walked: 0, lightChanges: 0, answered: false };
let guide = createGuide(false, done);

function lightChanged(before) { if (game.lantern.level !== before) done.lightChanges += 1; }
const playing = () => running && !paused;
const input = createInput({
  light: (d) => { if (playing()) { const b = game.lantern.level; changeLight(game, d); lightChanged(b); } },
  setLight: (n) => { if (playing()) { const b = game.lantern.level; setLight(game, n); lightChanged(b); } },
  reply: () => { if (playing() && answer(game)) done.answered = true; },
  pause: () => { if (paused) resume(); else pause(); },
  isRunning: playing,
});

// Pause frees the mouse so the Carry on button can be clicked.
function pause() {
  if (!running || paused) return;
  paused = true;
  audio.pause();
  if (document.exitPointerLock) document.exitPointerLock();
  ui.showPause();
}
function resume() {
  if (!paused) return;
  paused = false;
  audio.resume();
  ui.hidePause();
  input.lock();   // works from the button click or the P key press
  startedAt = clock;   // the short grace before "Click to look around" shows
}
ui.onResume(resume);

ui.playAgain();
ui.showStart((gearId, guideOn) => {
  game = createGame(gearId, ui.say);
  player.h = 0; player.pitch = 0;
  guide = createGuide(guideOn, done);
  game.guide = guideOn;
  input.lock();   // capture the mouse now, inside the Step out click
  audio.start();
  ui.showHud();
  running = true;
  startedAt = clock;
});

// For pictures: ?view=plain stands on the plain facing away with a steady lamp,
// ?view=back looks back at the Redoubt from out on the plain.
const view = new URLSearchParams(location.search).get('view');
if (view === 'plain' || view === 'back') {
  document.getElementById('guideBox').checked = false;
  document.getElementById('beginBtn').click();
  if (view === 'plain') { player.x = 34; player.z = 118; player.h = 0.3; player.pitch = -0.3; setLight(game, 2); }
  else { player.x = 60; player.z = 260; player.h = Math.PI + 0.22; player.pitch = 0.12; setLight(game, 1); }
}

window.addEventListener('resize', () => {
  world.resize();
  renderer.setSize(window.innerWidth, window.innerHeight);
  post.resize();
});

// The direction arrow: relative to where the player faces. Dim light gives a
// wavering arrow, no light gives none. A spent cell leaves the voice to guide.
function arrowFor(g) {
  const lv = g.lantern.level;
  if (lv === 0 && !g.lantern.spent) return null;
  const t = targetOf(g);
  const want = Math.atan2(t.x - player.x, t.z - player.z);   // heading toward target
  let rel = want - player.h;                                  // positive = to the left
  const wobble = lv === 1 ? Math.sin(clock * 0.7) * 0.6 : (g.lantern.spent ? Math.sin(clock * 0.5) * 0.35 : 0);
  return -(rel + wobble);                                     // CSS rotates clockwise
}

function finish(kind) {
  running = false;
  audio.stop();
  if (document.exitPointerLock) document.exitPointerLock();
  const mins = Math.floor(game.elapsed / 60), secs = Math.floor(game.elapsed % 60);
  ui.showEnding(ENDINGS[kind].title, ENDINGS[kind].text, `Time on the plain: ${mins} min ${secs} s`);
}

let last = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  clock += dt;

  if (running && paused) {
    // Hold the scene still. Only the camera's last view is redrawn.
  } else if (running) {
    const walking = Math.hypot(input.moveX, input.moveY) > 0.1 ? 1 : 0;
    const px = player.x, pz = player.z;
    stepPlayer(player, input, dt, grid, game.lantern.level, game.lantern.spent);
    done.walked += Math.hypot(player.x - px, player.z - pz);
    done.looked = input.lookTotal;

    // The guided start. While it runs the presence waits and the companion
    // only calls when the guide asks it to.
    const wasGuiding = guide.on;
    const guideStep = stepGuide(guide, done, dt, isTouch);
    if (guideStep && guideStep.call) callCompanion(game);
    if (wasGuiding && !guide.on) ui.markGuided();
    game.guide = guide.on;

    stepGame(game, player, input.act, dt);
    if (game.ended) finish(game.ended);

    const pr = game.presence;
    const dx = pr.x - player.x, dz = pr.z - player.z;
    const d = Math.hypot(dx, dz) || 1;
    const pan = (dx * -Math.cos(player.h) + dz * Math.sin(player.h)) / d;
    audio.update(dt, {
      noticed: pr.phase !== 'dormant',
      nearness: Math.max(0, 1 - d / 320),
      pressure: pr.pressure, overwhelm: pr.overwhelm, pan,
    });

    const target = targetOf(game);
    const dist = Math.round(Math.hypot(target.x - player.x, target.z - player.z));
    const seeArrow = arrowFor(game);
    const nearInst = game.phase === 'out' && dist < CFG.installReach;

    // The companion is calling: say which key, and how long is left.
    const wait = game.companion.awaiting;
    let callout = '';
    if (wait > 0) {
      callout = isTouch ? 'Tap Answer' : 'Press T to answer';
      if (Number.isFinite(wait)) callout += ` · ${Math.ceil(wait)}`;
    }

    // On a computer, when the mouse is free (after Esc), say how to get back in.
    // A short grace at the start covers the moment before the capture takes hold.
    let lookHint = '';
    if (!isTouch && !input.locked && clock - startedAt > 0.8) {
      if (!input.lockFailed) lookHint = 'Click to look around';
      else if (!input.dragging && input.lookTotal < 3) lookHint = 'Hold the mouse button and drag to look';
    }
    ui.updateHud({
      power: (game.lantern.power / game.lantern.max) * 100,
      levelName: LEVELS[game.lantern.level].name,
      spent: game.lantern.spent,
      trust: game.companion.trust,
      awaiting: game.companion.awaiting > 0,
      objective: (game.phase === 'out' ? 'Reach the old installation' : 'Return to the Redoubt door')
        + (seeArrow === null ? '' : ` · ${dist} m`),
      arrow: seeArrow,
      prompt: nearInst ? (isTouch ? 'Press and hold the Hold button to wake it' : 'Hold E to wake it') : '',
      guide: guideStep, callout, lookHint,
      wake: game.wake,
      vignette: pr.pressure,
      overwhelm: pr.overwhelm,
    }, clock);

    world.update(dt, {
      player, walking, level: game.lantern.level, presence: pr,
      wake: game.wake, afterglow: Math.min(1, game.afterglow / 4),
    });
  } else if (game) {
    // After the end, keep the scene alive but still.
    world.update(dt, { player, walking: 0, level: 0, presence: game.presence, wake: game.wake, afterglow: 0 });
  } else {
    // Title screen: the Redoubt seen from far out on the plain, drifting slowly.
    const v = CFG.look.titleView;
    world.update(dt, { player: { x: v.x, z: v.z, h: 0, pitch: 0 }, walking: 0, level: 0,
      presence: { phase: 'dormant', x: 0, z: 0 }, wake: 0, afterglow: 0 });
    world.camera.position.set(v.x + Math.sin(clock * 0.05) * 20, v.y, v.z);
    // on a wide screen the panel is on the left, so aim left of the Redoubt to put it on the right
    const wide = window.innerWidth >= 900 && window.innerWidth >= window.innerHeight;
    world.camera.lookAt(wide ? -75 : 0, v.lookY, 0);
  }
  post.render(dt);
});
