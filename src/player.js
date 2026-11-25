// The player on foot: heading, walking, and bumping into stones.
import { CFG } from './config.js';

const CELL = 40;

export function createPlayer() {
  return { x: CFG.start.x, z: CFG.start.z, h: 0, pitch: 0 };
}

// Put obstacles ({x, z, r}) into a grid so we only test the ones nearby.
export function buildGrid(obstacles) {
  const grid = new Map();
  for (const o of obstacles) {
    const key = Math.floor(o.x / CELL) + ',' + Math.floor(o.z / CELL);
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(o);
  }
  return grid;
}

export function stepPlayer(p, input, dt, grid, level, spent) {
  // Looking. Turning right lowers the heading.
  p.h -= input.takeLookX();
  p.pitch = Math.max(-1.2, Math.min(1.2, p.pitch - input.takeLookY()));

  let mx = input.moveX, my = input.moveY;
  const len = Math.hypot(mx, my);
  if (len > 1) { mx /= len; my /= len; }

  const speed = CFG.walkSpeed * (level === 0 || spent ? CFG.darkSpeedMul : 1);
  const fx = Math.sin(p.h), fz = Math.cos(p.h);
  const rx = -Math.cos(p.h), rz = Math.sin(p.h);
  p.x += (fx * my + rx * mx) * speed * dt;
  p.z += (fz * my + rz * mx) * speed * dt;

  // Bump out of any stone we are inside.
  const cx = Math.floor(p.x / CELL), cz = Math.floor(p.z / CELL);
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      const list = grid.get((cx + i) + ',' + (cz + j));
      if (!list) continue;
      for (const o of list) {
        const dx = p.x - o.x, dz = p.z - o.z;
        const min = o.r + CFG.playerRadius;
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min) {
          const d = Math.sqrt(d2) || 0.001;
          p.x = o.x + (dx / d) * min;
          p.z = o.z + (dz / d) * min;
        }
      }
    }
  }

  // The edge of the world.
  const r = Math.hypot(p.x, p.z);
  if (r > CFG.worldLimit) {
    p.x *= CFG.worldLimit / r;
    p.z *= CFG.worldLimit / r;
  }
}
