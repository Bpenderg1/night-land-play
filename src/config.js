// Numbers that shape the game. Change these to tune how it feels.
export const CFG = {
  eyeHeight: 1.7,
  walkSpeed: 3.4,
  darkSpeedMul: 0.75,      // feeling your way without light is slower
  playerRadius: 0.6,

  // Layout. The Redoubt sits at the origin; its door faces +z.
  door: { x: 0, z: 42.4 },
  start: { x: 0, z: 56 },
  installation: { x: 380, z: 950 },
  worldLimit: 1400,        // how far from the Redoubt you can walk

  doorWinRadius: 8,
  safeRadius: 70,          // inside this the presence cannot press on you
  installReach: 14,        // how close to wake the installation
  wakeSeconds: 7,          // how long you hold to wake it
  wakeAfterglow: 12,       // seconds the installation stays loud after waking

  power: 100,
  spareCellBonus: 30,
  trustStart: 0.45,
  trustTokenStart: 0.7,

  // Look. Turn these down if a phone struggles. Set an effect to 0 or false to drop it.
  look: {
    maxPixelRatio: 2,
    fogDensity: 0.013,       // mist: higher swallows the plain sooner
    exposure: 1.0,
    bloom: true,
    bloomStrength: 0.85,
    bloomRadius: 0.7,
    bloomThreshold: 0.55,
    bloomScale: 0.5,         // bloom resolution on large screens (1 full, 0.5 half)
    bloomScaleSmall: 0.35,   // on small screens (phones)
    smallScreen: 820,        // shorter side in CSS pixels counted as small
    grain: 0.22,             // film grain, 0 is off
    vignette: 1.05,          // darkness of the screen edge, 0 is off
    vignetteOffset: 0.95,
    textures: true,          // false falls back to plain colours
    textureSize: 8,          // metres one ground tile covers
    redoubtStone: 0.7,       // how much the Redoubt's bricks glow from within
    redoubtWindows: 2.2,     // brightness of its lit windows (above 1 blooms)
    redoubtDoor: 2.5,
    lampBoost: 10,           // multiplies the lantern's light at every level
        // brightness of its open door
    titleView: { x: 50, y: 3, z: 300, lookY: -18 },  // where the title screen camera stands
  },
};
