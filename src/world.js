// The scene: dark plain, the Redoubt, scattered stones, the old installation,
// the player's lantern light, and the presence (kept barely visible on purpose).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CFG } from './config.js';
import { makeRng } from './rng.js';
import { LEVELS } from './lantern.js';

// Load one Poly Haven set (diff, nor_gl, rough, ao) with repeat wrapping.
// Returns null when textures are turned off in the config.
const loader = new THREE.TextureLoader();
function loadSet(name, repeatX, repeatY, maxAniso) {
  if (!CFG.look.textures) return null;
  const get = (kind, srgb) => {
    const t = loader.load(`./assets/textures/${name}_${kind}_1k.jpg`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeatX, repeatY);
    t.anisotropy = maxAniso;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { map: get('diff', true), normalMap: get('nor_gl'), roughnessMap: get('rough'), aoMap: get('ao') };
}

export function createWorld(renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x010101);
  scene.fog = new THREE.FogExp2(0x010101, CFG.look.fogDensity);
  const aniso = renderer ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 1;

  const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 3000);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  scene.add(new THREE.AmbientLight(0x303040, 0.05));

  // Ground follows the player so the plain has no edge.
  // The texture is shifted as the ground moves, so the rock stays put under your feet.
  const tile = CFG.look.textureSize;
  const groundTex = loadSet('rocky_terrain_02', 4000 / tile, 4000 / tile, aniso);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x14110e, roughness: 1 });
  if (groundTex) {
    Object.assign(groundMat, groundTex, { color: new THREE.Color(0x9a8c7e) });
    groundMat.normalScale.set(1.4, 1.4);
  }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), groundMat);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  buildRedoubt(scene, aniso);
  const obstacles = buildStones(scene, aniso);
  const inst = buildInstallation(scene, aniso);

  // The lantern: a warm light carried with the camera.
  const lamp = new THREE.PointLight(0xffb060, 0, 1, 2);
  camera.add(lamp);

  // The presence: a tall dark mass, lit only by whatever light reaches it.
  const mat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1, transparent: true, opacity: 0.6 });
  const presence = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const part = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), mat);
    part.scale.set(3 - i * 0.4, 5 + i * 2, 3 - i * 0.4);
    part.position.set((i % 2 ? 1 : -1) * 0.7, 5 + i * 3.2, 0);
    presence.add(part);
  }
  presence.visible = false;
  scene.add(presence);

  let lampNow = 0;
  let time = 0;

  function update(dt, s) {
    time += dt;
    camera.position.set(s.player.x, CFG.eyeHeight + Math.sin(time * 6) * 0.03 * s.walking, s.player.z);
    camera.rotation.y = s.player.h + Math.PI;
    camera.rotation.x = s.player.pitch;
    ground.position.set(s.player.x, 0, s.player.z);
    if (groundTex) {
      const off = groundMat.map.offset;
      off.set(s.player.x / tile, -s.player.z / tile);
      groundMat.normalMap.offset.copy(off);
      groundMat.roughnessMap.offset.copy(off);
      groundMat.aoMap.offset.copy(off);
    }

    const lv = LEVELS[s.level];
    const flicker = s.level === 3 ? 1 + (Math.random() - 0.5) * 0.06 : 1;
    lampNow += (lv.intensity * flicker - lampNow) * Math.min(1, dt * 6);
    lamp.intensity = lampNow * CFG.look.lampBoost;
    lamp.distance = Math.max(1, lv.range * 1.5);

    presence.visible = s.presence.phase !== 'dormant';
    presence.position.set(s.presence.x, 0, s.presence.z);
    presence.rotation.y = time * 0.1;
    presence.scale.y = 1 + Math.sin(time * 0.5) * 0.08;

    // The installation: a faint cold lamp that wakes when touched.
    const loud = Math.max(s.wake, s.afterglow);
    inst.lamp.intensity = 3 + loud * 90;
    const d = Math.hypot(s.player.x - CFG.installation.x, s.player.z - CFG.installation.z);
    const far = Math.max(0, Math.min(1, (260 - d) / 140));
    inst.beacon.material.opacity = Math.max(far * 0.55, loud);
    inst.core.material.emissiveIntensity = 0.3 + loud * 3;
  }

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }

  return { scene, camera, obstacles, update, resize };
}

function buildRedoubt(scene, aniso) {
  // The Redoubt is a model built in Blender (tools/blender/redoubt.py): stepped
  // dark stone with thousands of lit windows. Its materials are replaced here so
  // the stone takes the brick texture and only the windows glow through the bloom.
  const L = CFG.look;
  const stone = new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.95,
    emissive: 0xff9a40, emissiveIntensity: L.redoubtStone, fog: false });
  const tex = loadSet('castle_brick_07', 6, 6, aniso);
  if (tex) Object.assign(stone, tex, { emissiveMap: tex.map });
  const lit = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb060).multiplyScalar(L.redoubtWindows),
    fog: false, side: THREE.DoubleSide });
  const crown = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd9a0).multiplyScalar(L.redoubtWindows * 2), fog: false });
  new GLTFLoader().load('./assets/models/redoubt.glb', (gltf) => {
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      o.material = o.name.startsWith('windows') ? lit : o.name.startsWith('crown') ? crown : stone;
    });
    scene.add(gltf.scene);
  });

  // A hot door, well above the bloom threshold so it blooms into the dark.
  const door = new THREE.Mesh(new THREE.PlaneGeometry(9, 13),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb65a).multiplyScalar(L.redoubtDoor), fog: false }));
  door.position.set(CFG.door.x, 6.5, CFG.door.z + 0.7);
  scene.add(door);

  const glow = new THREE.PointLight(0xffa64d, 6, 160, 1.4);
  glow.position.set(0, 14, 62);
  scene.add(glow);
}

// Stones scattered along the way give the eye something to hold onto, and
// something to bump into in the dark.
function buildStones(scene, aniso) {
  const rng = makeRng(1912);
  const count = 1050;
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x241e18, roughness: 1, flatShading: true });
  const stoneTex = loadSet('rocky_terrain_02', 1, 1, aniso);
  if (stoneTex) {
    // Flat shading ignores the normal map, so only colour and roughness are used.
    stoneMat.map = stoneTex.map;
    stoneMat.roughnessMap = stoneTex.roughnessMap;
    stoneMat.color.set(0x8a8078);
  }
  const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), stoneMat, count);
  const obstacles = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  let n = 0;
  while (n < count) {
    const x = -250 + rng() * 900;
    const z = 20 + rng() * 1150;
    if (Math.hypot(x - CFG.start.x, z - CFG.start.z) < 25) continue;
    if (Math.hypot(x - CFG.installation.x, z - CFG.installation.z) < 32) continue;
    const r = 0.7 + rng() * rng() * 3.2;
    e.set(rng() * 3, rng() * 3, rng() * 3);
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(x, r * 0.5, z), q, new THREE.Vector3(r, r * 0.8, r));
    mesh.setMatrixAt(n++, m);
    obstacles.push({ x, z, r: r * 0.85 });
  }
  scene.add(mesh);
  return obstacles;
}

function buildInstallation(scene, aniso) {
  const g = new THREE.Group();
  g.position.set(CFG.installation.x, 0, CFG.installation.z);
  const stone = new THREE.MeshStandardMaterial({ color: 0x3a3a38, roughness: 1 });
  const metal = loadSet('metal_plate', 2, 2, aniso);
  if (metal) {
    Object.assign(stone, metal, { color: new THREE.Color(0x8a8a88), roughness: 1, metalness: 0.5 });
  }
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(4, 5.5, 15, 8), stone);
  tower.position.y = 7.5;
  g.add(tower);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 10 + (i % 3) * 2, 1.6), stone);
    pillar.position.set(Math.cos(a) * 15, 5 + (i % 3), Math.sin(a) * 15);
    g.add(pillar);
  }
  const core = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0x225544, emissive: 0x66ffcc, emissiveIntensity: 0.3 }));
  core.position.y = 16.5;
  g.add(core);
  const lamp = new THREE.PointLight(0x66ffcc, 3, 90, 1.6);
  lamp.position.y = 14;
  g.add(lamp);
  // A faint far glow, seen from a distance, that does not take the fog.
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.3, 8, 6),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0x4fbf9f).multiplyScalar(2.5), transparent: true, opacity: 0, fog: false }));
  beacon.position.y = 16.5;
  g.add(beacon);
  scene.add(g);
  return { lamp, core, beacon };
}
