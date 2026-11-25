// The lantern: four light levels and a power cell that drains faster when bright.
export const LEVELS = [
  { name: 'Dark',   drain: 0,    intensity: 0,  range: 0 },
  { name: 'Dim',    drain: 0.09, intensity: 7,  range: 20 },
  { name: 'Steady', drain: 0.28, intensity: 24, range: 48 },
  { name: 'Bright', drain: 0.9,  intensity: 75, range: 100 },
];

export function createLantern(power) {
  return { level: 1, power, max: power, spent: false };
}

export function setLevel(l, n) {
  n = Math.max(0, Math.min(LEVELS.length - 1, n));
  if (l.spent && n > 0) return false;
  l.level = n;
  return true;
}

// Returns 'spent' once, on the frame the cell runs out.
export function stepLantern(l, dt) {
  if (l.spent) return null;
  l.power -= LEVELS[l.level].drain * dt;
  if (l.power <= 0) {
    l.power = 0;
    l.level = 0;
    l.spent = true;
    return 'spent';
  }
  return null;
}
