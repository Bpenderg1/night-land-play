// Post-processing: bloom for the lit Redoubt, a dark vignette and film grain,
// like an old photograph. All of it is tuned in CFG.look.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';
import { VignetteShader } from 'three/addons/shaders/VignetteShader.js';
import { CFG } from './config.js';

export function createPost(renderer, scene, camera) {
  const L = CFG.look;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = L.exposure;

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  let bloom = null;
  if (L.bloom) {
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), L.bloomStrength, L.bloomRadius, L.bloomThreshold);
    composer.addPass(bloom);
  }
  composer.addPass(new OutputPass());   // tone mapping and colour space

  if (L.vignette > 0) {
    const v = new ShaderPass(VignetteShader);
    v.uniforms.offset.value = L.vignetteOffset;
    v.uniforms.darkness.value = L.vignette;
    composer.addPass(v);
  }
  if (L.grain > 0) composer.addPass(new FilmPass(L.grain, false));

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const pr = Math.min(window.devicePixelRatio, L.maxPixelRatio);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    if (bloom) {
      const k = Math.min(w, h) < L.smallScreen ? L.bloomScaleSmall : L.bloomScale;
      // UnrealBloomPass already halves what it is given, so double the scale.
      bloom.setSize(w * pr * k * 2, h * pr * k * 2);
    }
  }
  resize();

  return { resize, render: (dt) => composer.render(dt) };
}
