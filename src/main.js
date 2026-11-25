import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { createCyberEnvironment, createRobotMaterialSystem } from './materials.js';
import { VisorFaceController } from './visorFace.js';
import { buildCyberRobot } from './robotBuilder.js';
import { IKDebugVisualizer } from './ikSolver.js';
import { RobotAnimator } from './animator.js';
import { createCyberStage } from './environment.js';

// ===========================================================================
// 1. CORE SCENE, CAMERA & MSAA RENDERER INITIALIZATION
// ===========================================================================
const container = document.getElementById('canvas-container');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070e);
scene.fog = new THREE.FogExp2(0x05070e, 0.068);

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 60);
camera.position.set(0.45, 1.52, 4.82);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
container.appendChild(renderer.domElement);

// ===========================================================================
// 2. SELECTIVE BLOOM POST-PROCESSING WITH 4X MSAA RENDER TARGET
// ===========================================================================
const renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
  type: THREE.HalfFloatType,
  samples: 4,
});

const composer = new EffectComposer(renderer, renderTarget);
composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.46, // strength
  0.36, // radius
  1.38  // selective HDR threshold: ONLY high-emissive circuits, visor eyes, core & neon bloom!
);
composer.addPass(bloomPass);

const outputPass = new OutputPass();
composer.addPass(outputPass);

// ===========================================================================
// 3. ORBIT CONTROLS & CAMERA PRESETS
// ===========================================================================
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.target.set(0.24, 1.24, 0);
controls.minDistance = 1.35;
controls.maxDistance = 8.5;
controls.minPolarAngle = 0.22;
controls.maxPolarAngle = Math.PI * 0.492;

const CAMERA_PRESETS = {
  hero: { pos: new THREE.Vector3(0.45, 1.52, 4.82), target: new THREE.Vector3(0.24, 1.24, 0) },
  closeup: { pos: new THREE.Vector3(0.26, 1.66, 2.05), target: new THREE.Vector3(0.14, 1.56, 0.05) },
  joints: { pos: new THREE.Vector3(1.68, 1.06, 2.05), target: new THREE.Vector3(0.2, 0.86, 0) },
  low: { pos: new THREE.Vector3(-1.05, 0.58, 3.65), target: new THREE.Vector3(0.2, 1.2, 0) },
};

let activeCamTransition = null;
controls.addEventListener('start', () => {
  activeCamTransition = null;
});

// ===========================================================================
// 4. ENVIRONMENT, PBR MATERIALS, ROBOT, STAGE & IK ANIMATOR
// ===========================================================================
const envMap = createCyberEnvironment(renderer);
scene.environment = envMap;

const materialSystem = createRobotMaterialSystem(envMap);
const visorController = new VisorFaceController();
const robot = buildCyberRobot(materialSystem.materials, visorController);
scene.add(robot.root);

const stage = createCyberStage(scene, envMap);
const ikDebugger = new IKDebugVisualizer(scene);
const animator = new RobotAnimator(
  robot,
  visorController,
  ikDebugger,
  scene,
  materialSystem.materials
);

// ===========================================================================
// 5. RAYCASTING CURSOR TRACKING & CLICK INTERACTIONS
// ===========================================================================
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2(0, 0.15);
const gazePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.58);
const cursorIntersect = new THREE.Vector3(0, 1.55, 1.8);
let pointerDownPos = { x: 0, y: 0 };

const clickableMeshes = [
  ...robot.hitTargets.head,
  ...robot.hitTargets.core,
  stage.floorHitPlane,
  stage.plinthTop,
];

function updateCursorTarget(clientX, clientY) {
  pointerNDC.x = (clientX / window.innerWidth) * 2 - 1;
  pointerNDC.y = -(clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(pointerNDC, camera);

  // Project cursor onto an invisible plane in front of the robot for natural 3D gaze & orb reach
  const planeDist = animator.mode === 'reach' ? -0.52 : -1.55;
  gazePlane.constant = planeDist;
  if (raycaster.ray.intersectPlane(gazePlane, cursorIntersect)) {
    animator.setCursorWorld(cursorIntersect);
  }

  // Hover pointer affordance over interactive head/chest
  const hits = raycaster.intersectObjects([...robot.hitTargets.head, ...robot.hitTargets.core], false);
  container.classList.toggle('pointer-hover', hits.length > 0);
}

window.addEventListener('pointermove', (e) => {
  if (e.target.closest('.control-panel')) return;
  updateCursorTarget(e.clientX, e.clientY);
});

renderer.domElement.addEventListener('pointerdown', (e) => {
  pointerDownPos = { x: e.clientX, y: e.clientY };
});

renderer.domElement.addEventListener('pointerup', (e) => {
  const dragDist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
  if (dragDist > 6) return; // Ignore camera orbit drags

  pointerNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointerNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);

  const hits = raycaster.intersectObjects(clickableMeshes, false);
  if (hits.length === 0) return;

  const hitObj = hits[0].object;
  if (robot.hitTargets.head.includes(hitObj)) {
    animator.triggerBoop();
  } else if (robot.hitTargets.core.includes(hitObj)) {
    animator.triggerCoreSurge();
  } else {
    stage.spawnRipple(hits[0].point);
    animator.triggerFloorStep(hits[0].point);
  }
});

// ===========================================================================
// 6. CYBERNETICS HUD CONTROLS WIRING
// ===========================================================================
const hudStateEl = document.getElementById('hud-state');
const hudFpsEl = document.getElementById('hud-fps');

// Collapse / Expand Panel
const togglePanelBtn = document.getElementById('toggle-panel-btn');
const panelBody = document.getElementById('panel-body');
togglePanelBtn.addEventListener('click', () => {
  const collapsed = panelBody.classList.toggle('collapsed');
  togglePanelBtn.textContent = collapsed ? '▸' : '▾';
});

// Kinematic Mode Buttons
document.querySelectorAll('[data-mode]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-mode]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const mode = btn.dataset.mode;
    animator.setMode(mode);
    hudStateEl.textContent = `MODE: ${mode.toUpperCase()}`;
  });
});

// Visor Expression Buttons
document.querySelectorAll('[data-expr]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-expr]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    visorController.setMode(btn.dataset.expr);
  });
});

// Chassis & Neon Color Theme Swatches
document.querySelectorAll('[data-theme]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-theme]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    const theme = materialSystem.applyTheme(btn.dataset.theme);
    visorController.setColors(theme.neonPrimary, theme.neonSecondary);
    robot.setNeonLightColor(theme.neonPrimary);
    stage.setStageTheme(theme.neonPrimary, theme.neonSecondary);

    document.documentElement.style.setProperty('--neon-cyan', theme.neonPrimary);
    document.documentElement.style.setProperty('--neon-pink', theme.neonSecondary);
  });
});

// Camera Rig Presets
document.querySelectorAll('[data-cam]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-cam]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const preset = CAMERA_PRESETS[btn.dataset.cam];
    if (preset) {
      activeCamTransition = {
        pos: preset.pos.clone(),
        target: preset.target.clone(),
      };
    }
  });
});

// Bloom Slider
const bloomSlider = document.getElementById('bloom-slider');
const bloomVal = document.getElementById('bloom-val');
bloomSlider.addEventListener('input', () => {
  const v = parseFloat(bloomSlider.value);
  bloomPass.strength = v;
  bloomVal.textContent = v.toFixed(2);
});

// Circuit Pulse Slider
const pulseSlider = document.getElementById('pulse-slider');
const pulseVal = document.getElementById('pulse-val');
pulseSlider.addEventListener('input', () => {
  const v = parseFloat(pulseSlider.value);
  materialSystem.circuitSystem.pulseSpeed = v;
  pulseVal.textContent = `${v.toFixed(1)}x`;
});

// Toggles
document.getElementById('cursor-track-toggle').addEventListener('change', (e) => {
  animator.cursorTrackingEnabled = e.target.checked;
});

document.getElementById('ik-debug-toggle').addEventListener('change', (e) => {
  ikDebugger.setVisible(e.target.checked);
});

// Responsive Resize
window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloomPass.resolution.set(w, h);
});

// ===========================================================================
// 7. MAIN ANIMATION LOOP
// ===========================================================================
const clock = new THREE.Clock();
let fpsFrames = 0;
let fpsAccum = 0;

function animate() {
  requestAnimationFrame(animate);

  const dt = clock.getDelta();
  const elapsed = clock.elapsedTime;

  // Smooth camera preset glide if active
  if (activeCamTransition) {
    const t = 1 - Math.exp(-5.5 * dt);
    camera.position.lerp(activeCamTransition.pos, t);
    controls.target.lerp(activeCamTransition.target, t);
    if (
      camera.position.distanceTo(activeCamTransition.pos) < 0.015 &&
      controls.target.distanceTo(activeCamTransition.target) < 0.015
    ) {
      activeCamTransition = null;
    }
  }

  controls.update();

  // Update animated neon PCB traces, OLED visor face, full-body IK & stage
  materialSystem.update(elapsed);
  visorController.update(elapsed, dt);
  animator.update(dt, elapsed);
  stage.update(dt, elapsed);

  composer.render();

  // Telemetry FPS counter
  fpsFrames++;
  fpsAccum += dt;
  if (fpsAccum >= 0.5) {
    hudFpsEl.textContent = `${Math.round(fpsFrames / fpsAccum)} FPS`;
    fpsFrames = 0;
    fpsAccum = 0;
  }
}

animate();
