import * as THREE from 'three';
import { solveTwoBoneIK } from './ikSolver.js';

const _euler = new THREE.Euler();
const _quat = new THREE.Quaternion();
const _headWorld = new THREE.Vector3();
const _localCursor = new THREE.Vector3();

/**
 * Full-body Procedural + Two-Bone IK Animation & Cursor Tracking Controller.
 */
export class RobotAnimator {
  constructor(robot, visorController, ikDebugger, scene, materials) {
    this.robot = robot;
    this.visor = visorController;
    this.ikDebugger = ikDebugger;

    this.mode = 'idle'; // 'idle' | 'walk' | 'dance' | 'wave' | 'reach' | 'hover'
    this.cursorTrackingEnabled = true;

    // Cursor target in world space (updated from main raycaster)
    this.cursorWorld = new THREE.Vector3(0, 1.55, 2.2);
    this.smoothOrbPos = new THREE.Vector3(0.38, 1.32, 0.58);

    // Spring-damped head & torso look angles
    this.headYaw = 0;
    this.headPitch = 0;
    this.headRoll = 0;
    this.headYawVel = 0;
    this.spineYaw = 0;
    this.spinePitch = 0;
    this.bodyTurnYaw = 0;
    this.targetBodyTurnYaw = 0;

    // Interactive impulse states (boop hop, core overdrive surge, quick wave)
    this.boopTimer = 0;
    this.surgeTimer = 0;
    this.quickWaveTimer = 0;
    this.overdriveBlend = 0;

    // World IK targets & poles for all 4 limbs
    this.targets = {
      legL: new THREE.Vector3(0.245, robot.dims.ankleHeight, 0.02),
      legR: new THREE.Vector3(-0.245, robot.dims.ankleHeight, 0.02),
      armL: new THREE.Vector3(0.54, 0.86, 0.1),
      armR: new THREE.Vector3(-0.54, 0.86, 0.1),
    };

    this.poles = {
      legL: new THREE.Vector3(0.28, 0.52, 0.95),
      legR: new THREE.Vector3(-0.28, 0.52, 0.95),
      armL: new THREE.Vector3(0.75, 1.02, -0.65),
      armR: new THREE.Vector3(-0.75, 1.02, -0.65),
    };

    // Smoothed IK targets for seamless transitions between modes
    this.currentTargets = {
      legL: this.targets.legL.clone(),
      legR: this.targets.legR.clone(),
      armL: this.targets.armL.clone(),
      armR: this.targets.armR.clone(),
    };

    // Register 4 IK debug gizmo chains
    this.debugChains = {
      legL: ikDebugger.registerChain('LegL', 0x00f5ff),
      legR: ikDebugger.registerChain('LegR', 0x00f5ff),
      armL: ikDebugger.registerChain('ArmL', 0x3dffb5),
      armR: ikDebugger.registerChain('ArmR', 0x3dffb5),
    };

    // Floating Holographic IK Target Orb (visible in 'reach' mode)
    this.reachOrb = this.createReachOrb(materials);
    this.reachOrb.visible = false;
    scene.add(this.reachOrb);
  }

  createReachOrb(materials) {
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.055, 1), materials.neonSecondary);
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.006, 8, 28), materials.neonPrimary);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.005, 8, 28), materials.jointGold);
    ring2.rotation.x = Math.PI / 2;
    g.add(core, ring1, ring2);
    g.userData = { core, ring1, ring2 };
    return g;
  }

  setMode(mode) {
    this.mode = mode;
    this.reachOrb.visible = mode === 'reach';
  }

  setCursorWorld(pt) {
    this.cursorWorld.copy(pt);
  }

  triggerBoop() {
    this.boopTimer = 0.85;
    this.visor.triggerBoop();
  }

  triggerCoreSurge() {
    this.surgeTimer = 2.6;
  }

  triggerFloorStep(worldPt) {
    // Subtle turn toward the clicked floor point + friendly wave
    const angle = Math.atan2(worldPt.x, Math.max(0.4, worldPt.z));
    this.targetBodyTurnYaw = THREE.MathUtils.clamp(angle * 0.45, -0.5, 0.5);
    this.quickWaveTimer = 1.6;
  }

  update(dt, time) {
    const { robot } = this;
    const { dims } = robot;
    const clampedDt = Math.min(dt, 0.05);

    if (this.boopTimer > 0) this.boopTimer = Math.max(0, this.boopTimer - clampedDt);
    if (this.surgeTimer > 0) this.surgeTimer = Math.max(0, this.surgeTimer - clampedDt);
    if (this.quickWaveTimer > 0) this.quickWaveTimer = Math.max(0, this.quickWaveTimer - clampedDt);

    const wantOverdrive = this.mode === 'hover' || this.surgeTimer > 0 ? 1.0 : 0.0;
    this.overdriveBlend += (wantOverdrive - this.overdriveBlend) * (1 - Math.exp(-5.5 * clampedDt));

    // Smooth root turn toward floor click
    this.bodyTurnYaw += (this.targetBodyTurnYaw - this.bodyTurnYaw) * (1 - Math.exp(-4.5 * clampedDt));
    this.targetBodyTurnYaw *= 1 - clampedDt * 0.6;
    robot.root.rotation.y = this.bodyTurnYaw;

    // Hop offset when booped on the head!
    const boopHop =
      this.boopTimer > 0 ? Math.sin(((0.85 - this.boopTimer) / 0.85) * Math.PI) * 0.14 : 0;

    // Foot orientation defaults (flat on ground aligned with robot root yaw)
    let footPitchL = 0;
    let footPitchR = 0;
    let toePitchL = 0;
    let toePitchR = 0;
    let fingerCurlL = 0.35;
    let fingerCurlR = 0.35;

    // Reset baseline torso & pelvis transforms before layering mode + gaze
    let pelvisX = 0;
    let pelvisY = dims.hipRestY;
    let pelvisZ = 0;
    let pelvisRoll = 0;
    let pelvisYaw = 0;
    let pelvisPitch = 0;
    let chestRoll = 0;
    let chestYaw = 0;

    // =======================================================================
    // KINEMATIC MODE GENERATION
    // =======================================================================
    if (this.mode === 'walk') {
      const speed = 5.4;
      const phaseL = time * speed;
      const phaseR = phaseL + Math.PI;

      const strideLen = 0.21;
      const stepLift = 0.13;

      const calcFootStep = (ph, xBase) => {
        const s = Math.sin(ph);
        const c = Math.cos(ph);
        // Swing forward when sin(ph) > 0, stance slide back when sin(ph) <= 0
        const lift = s > 0 ? Math.pow(s, 0.85) * stepLift : 0;
        const z = -c * strideLen;
        // Heel-strike on forward descent, toe-off on rear push
        const pitch = s > 0 ? -c * 0.28 : Math.max(0, -c) * 0.18;
        const toe = s <= 0 && c > 0.2 ? (c - 0.2) * 0.55 : 0;
        return { x: xBase, y: dims.ankleHeight + lift, z, pitch, toe };
      };

      const stepL = calcFootStep(phaseL, 0.245);
      const stepR = calcFootStep(phaseR, -0.245);

      this.targets.legL.set(stepL.x, stepL.y, stepL.z);
      this.targets.legR.set(stepR.x, stepR.y, stepR.z);
      footPitchL = stepL.pitch;
      footPitchR = stepR.pitch;
      toePitchL = stepL.toe;
      toePitchR = stepR.toe;

      // Double-frequency pelvis bounce + lateral weight shift + counter-twist
      pelvisY = dims.hipRestY - 0.03 + Math.abs(Math.cos(phaseL)) * 0.045;
      pelvisX = Math.sin(phaseL) * -0.042;
      pelvisRoll = Math.sin(phaseL) * 0.065;
      pelvisYaw = Math.cos(phaseL) * 0.12;
      pelvisPitch = 0.04;
      chestYaw = -pelvisYaw * 1.15;

      // Counter-swinging arms via IK
      this.targets.armL.set(0.52, 0.92 + Math.abs(Math.sin(phaseR)) * 0.05, Math.cos(phaseL) * 0.22 + 0.06);
      this.targets.armR.set(-0.52, 0.92 + Math.abs(Math.sin(phaseL)) * 0.05, -Math.cos(phaseL) * 0.22 + 0.06);
      fingerCurlL = 0.55;
      fingerCurlR = 0.55;
    } else if (this.mode === 'dance') {
      const beat = time * 6.4;
      const halfBeat = beat * 0.5;

      // Bouncy chibi groove with planted IK feet & alternating heel pops
      pelvisX = Math.sin(halfBeat) * 0.11;
      pelvisY = dims.hipRestY - 0.055 + Math.abs(Math.sin(beat)) * 0.075;
      pelvisRoll = Math.sin(halfBeat) * 0.14;
      pelvisYaw = Math.sin(halfBeat) * 0.22;
      chestRoll = -Math.sin(halfBeat) * 0.1;
      chestYaw = -Math.sin(halfBeat) * 0.18;

      const tapL = Math.max(0, Math.sin(halfBeat)) * 0.065;
      const tapR = Math.max(0, -Math.sin(halfBeat)) * 0.065;
      this.targets.legL.set(0.27, dims.ankleHeight + tapL, 0.03 + tapL * 0.8);
      this.targets.legR.set(-0.27, dims.ankleHeight + tapR, 0.03 + tapR * 0.8);
      footPitchL = -tapL * 2.2;
      footPitchR = -tapR * 2.2;

      // Upbeat alternating cyber arm pumps!
      this.targets.armL.set(
        0.54 + Math.sin(halfBeat) * 0.08,
        1.18 + Math.sin(beat) * 0.18,
        0.24 + Math.cos(halfBeat) * 0.12
      );
      this.targets.armR.set(
        -0.54 + Math.sin(halfBeat) * 0.08,
        1.18 - Math.sin(beat) * 0.18,
        0.24 - Math.cos(halfBeat) * 0.12
      );
      fingerCurlL = 0.2 + 0.25 * Math.sin(beat);
      fingerCurlR = 0.2 + 0.25 * Math.cos(beat);
    } else if (this.mode === 'hover') {
      // Zero-G Jetpack Overdrive Levitation!
      const hoverBob = Math.sin(time * 3.1) * 0.055;
      const hoverSway = Math.sin(time * 1.7) * 0.04;

      pelvisX = hoverSway;
      pelvisY = dims.hipRestY + 0.26 + hoverBob;
      pelvisPitch = 0.1;
      pelvisRoll = hoverSway * 0.6;

      // Tucked airborne mecha leg pose with pointed toes
      this.targets.legL.set(0.25 + hoverSway * 0.7, 0.36 + hoverBob * 0.85, -0.06);
      this.targets.legR.set(-0.25 + hoverSway * 0.7, 0.43 + hoverBob * 0.85, -0.14);
      footPitchL = 0.42;
      footPitchR = 0.52;

      // Stabilizer flight arm spread
      this.targets.armL.set(0.62 + hoverSway * 0.5, 1.08 + hoverBob, -0.06);
      this.targets.armR.set(-0.62 + hoverSway * 0.5, 1.08 + hoverBob, -0.06);
      fingerCurlL = 0.15;
      fingerCurlR = 0.15;
    } else {
      // 'idle', 'wave', or 'reach' — Planted IK Feet with organic breathing & subtle sway!
      const breath = Math.sin(time * 2.3);
      const sway = Math.sin(time * 1.15);

      pelvisX = sway * 0.028 + (this.mode === 'wave' ? 0.045 : 0);
      pelvisY = dims.hipRestY - 0.018 + breath * 0.022 + this.overdriveBlend * 0.08 + boopHop;
      pelvisRoll = sway * 0.03;

      this.targets.legL.set(0.245, dims.ankleHeight + (boopHop > 0.02 ? boopHop * 0.65 : 0), 0.02);
      this.targets.legR.set(-0.245, dims.ankleHeight + (boopHop > 0.02 ? boopHop * 0.65 : 0), 0.02);

      // Default relaxed cute arm stance
      this.targets.armL.set(0.53 + sway * 0.015, 0.87 + breath * 0.025 + boopHop, 0.09);
      this.targets.armR.set(-0.53 + sway * 0.015, 0.87 + breath * 0.025 + boopHop, 0.09);
      fingerCurlL = 0.38 + breath * 0.06;
      fingerCurlR = 0.38 + breath * 0.06;

      // Cheerful Right-Hand Wave Emote (either dedicated mode or floor-click quick wave)
      if (this.mode === 'wave' || this.quickWaveTimer > 0) {
        const waveOsc = Math.sin(time * 9.5);
        this.targets.armR.set(-0.54 + waveOsc * 0.13, 1.56 + Math.abs(waveOsc) * 0.04, 0.34);
        fingerCurlR = 0.05; // Wide open friendly hand!
        chestRoll = 0.07;
      }

      // Interactive 3D Holographic Orb Reach via Two-Bone Arm IK!
      if (this.mode === 'reach') {
        const clampedOrbX = THREE.MathUtils.clamp(this.cursorWorld.x, -0.82, 0.82);
        const clampedOrbY = THREE.MathUtils.clamp(this.cursorWorld.y, 0.68, 1.78);
        const clampedOrbZ = THREE.MathUtils.clamp(this.cursorWorld.z, 0.32, 0.78);

        const orbLerp = 1 - Math.exp(-10 * clampedDt);
        this.smoothOrbPos.x += (clampedOrbX - this.smoothOrbPos.x) * orbLerp;
        this.smoothOrbPos.y += (clampedOrbY - this.smoothOrbPos.y) * orbLerp;
        this.smoothOrbPos.z += (clampedOrbZ - this.smoothOrbPos.z) * orbLerp;

        this.reachOrb.position.copy(this.smoothOrbPos);
        this.reachOrb.userData.core.rotation.y = time * 2.8;
        this.reachOrb.userData.ring1.rotation.x = time * 2.1;
        this.reachOrb.userData.ring2.rotation.z = -time * 1.8;

        // Pick closest arm (x >= 0 => Left arm, x < 0 => Right arm) to reach smoothly
        if (this.smoothOrbPos.x >= 0) {
          this.targets.armL.copy(this.smoothOrbPos);
          fingerCurlL = 0.12;
          chestYaw = 0.14;
        } else {
          this.targets.armR.copy(this.smoothOrbPos);
          fingerCurlR = 0.12;
          chestYaw = -0.14;
        }
      }
    }

    // Apply Pelvis transform
    robot.pelvis.position.set(pelvisX, pelvisY, pelvisZ);
    robot.pelvis.rotation.set(pelvisPitch, pelvisYaw + this.bodyTurnYaw * 0.25, pelvisRoll);

    // =======================================================================
    // SPRING-DAMPED CURSOR TRACKING (EYES -> HEAD + TILT -> SPINE)
    // =======================================================================
    robot.headPivot.getWorldPosition(_headWorld);
    _headWorld.y += 0.32;

    let desiredYaw = 0;
    let desiredPitch = 0;

    if (this.cursorTrackingEnabled || this.mode === 'reach') {
      _localCursor.copy(this.cursorWorld).sub(_headWorld);
      // Account for robot root rotation
      _localCursor.applyAxisAngle(new THREE.Vector3(0, 1, 0), -robot.root.rotation.y);

      const distZ = Math.max(0.45, _localCursor.z);
      desiredYaw = THREE.MathUtils.clamp(Math.atan2(_localCursor.x, distZ), -0.68, 0.68);
      desiredPitch = THREE.MathUtils.clamp(Math.atan2(_localCursor.y, distZ), -0.45, 0.45);

      this.visor.setGaze(desiredYaw / 0.58, desiredPitch / 0.42);
    } else {
      this.visor.setGaze(Math.sin(time * 0.9) * 0.18, Math.sin(time * 0.6) * 0.08);
    }

    // Critically-damped spring on headYaw for lifelike momentum & cute tilt
    const stiffness = 68;
    const damping = 12.5;
    const accelYaw = (desiredYaw - this.headYaw) * stiffness - this.headYawVel * damping;
    this.headYawVel += accelYaw * clampedDt;
    this.headYaw += this.headYawVel * clampedDt;

    const headLerp = 1 - Math.exp(-9.5 * clampedDt);
    this.headPitch += (-desiredPitch - this.headPitch) * headLerp;

    // Adorable inquisitive head-tilt (roll) driven by gaze & angular velocity!
    const waveTilt = this.mode === 'wave' || this.quickWaveTimer > 0 ? 0.18 : 0;
    const danceBop = this.mode === 'dance' ? Math.sin(time * 3.2) * 0.14 : 0;
    const targetRoll = -this.headYaw * 0.22 - this.headYawVel * 0.055 + waveTilt + danceBop;
    this.headRoll += (targetRoll - this.headRoll) * headLerp;

    // Partial torso/spine follow so the upper body turns organically with gaze
    this.spineYaw += (this.headYaw * 0.32 + chestYaw - this.spineYaw) * (1 - Math.exp(-7 * clampedDt));
    this.spinePitch +=
      (this.headPitch * 0.22 + (this.mode === 'hover' ? 0.08 : 0) - this.spinePitch) *
      (1 - Math.exp(-7 * clampedDt));

    robot.spinePivot.rotation.set(this.spinePitch, this.spineYaw, chestRoll);
    robot.headPivot.rotation.set(
      this.headPitch * 0.78 + (this.mode === 'dance' ? Math.abs(Math.sin(time * 6.4)) * 0.1 : 0),
      this.headYaw * 0.72,
      this.headRoll
    );

    // =======================================================================
    // EXPRESSIVE CYBER EARS & FINGER CURLS
    // =======================================================================
    const earFlap =
      this.boopTimer > 0
        ? Math.sin(time * 34) * 0.32
        : this.mode === 'dance'
        ? Math.sin(time * 6.4) * 0.2
        : Math.sin(time * 2.1) * 0.06;

    const earSweepBack = this.overdriveBlend * -0.35 + this.headPitch * 0.25;
    robot.ears.L.rotation.set(earSweepBack, 0, earFlap + Math.max(0, this.headYaw) * 0.18);
    robot.ears.R.rotation.set(earSweepBack, 0, -earFlap + Math.min(0, this.headYaw) * 0.18);

    // Update articulated fingers on both hands
    [
      ['L', fingerCurlL],
      ['R', fingerCurlR],
    ].forEach(([side, curl]) => {
      const arm = robot.arms[side];
      arm.fingers.forEach(({ fBase, fTip, sign }, idx) => {
        const c = curl + idx * 0.06;
        fBase.rotation.z = sign * c * 0.85;
        fTip.rotation.z = sign * c * 0.95;
      });
      arm.thumbBase.rotation.z = (side === 'L' ? 1 : -1) * curl * 0.5;
    });

    // =======================================================================
    // SOLVE ALL 4 TWO-BONE IK CHAINS (2 LEGS + 2 ARMS)
    // =======================================================================
    const ikSmooth = 1 - Math.exp(-18 * clampedDt);
    ['legL', 'legR', 'armL', 'armR'].forEach((k) => {
      this.currentTargets[k].lerp(this.targets[k], ikSmooth);
    });

    // Update dynamic pole positions relative to pelvis/chest so poles track body turns
    const rootYaw = robot.root.rotation.y;
    this.poles.legL.set(0.28, pelvisY - 0.3, 0.95).applyAxisAngle(new THREE.Vector3(0, 1, 0), rootYaw);
    this.poles.legR.set(-0.28, pelvisY - 0.3, 0.95).applyAxisAngle(new THREE.Vector3(0, 1, 0), rootYaw);
    this.poles.armL.set(0.78, pelvisY + 0.15, -0.65).applyAxisAngle(new THREE.Vector3(0, 1, 0), rootYaw);
    this.poles.armR.set(-0.78, pelvisY + 0.15, -0.65).applyAxisAngle(new THREE.Vector3(0, 1, 0), rootYaw);

    robot.root.updateMatrixWorld(true);

    // Solve Left & Right Legs
    const footQuatL = _quat.setFromEuler(_euler.set(footPitchL, rootYaw, 0)).clone();
    solveTwoBoneIK({
      rootMount: robot.legs.L.rootMount,
      upperBone: robot.legs.L.upperBone,
      lowerBone: robot.legs.L.lowerBone,
      endBone: robot.legs.L.footBone,
      L1: dims.upperLegLen,
      L2: dims.lowerLegLen,
      targetWorldPos: this.currentTargets.legL,
      poleWorldPos: this.poles.legL,
      poleSign: 1,
      endWorldQuat: footQuatL,
    });
    robot.legs.L.toePivot.rotation.x = -toePitchL;

    const footQuatR = _quat.setFromEuler(_euler.set(footPitchR, rootYaw, 0)).clone();
    solveTwoBoneIK({
      rootMount: robot.legs.R.rootMount,
      upperBone: robot.legs.R.upperBone,
      lowerBone: robot.legs.R.lowerBone,
      endBone: robot.legs.R.footBone,
      L1: dims.upperLegLen,
      L2: dims.lowerLegLen,
      targetWorldPos: this.currentTargets.legR,
      poleWorldPos: this.poles.legR,
      poleSign: 1,
      endWorldQuat: footQuatR,
    });
    robot.legs.R.toePivot.rotation.x = -toePitchR;

    // Solve Left & Right Arms
    solveTwoBoneIK({
      rootMount: robot.arms.L.rootMount,
      upperBone: robot.arms.L.upperBone,
      lowerBone: robot.arms.L.lowerBone,
      endBone: robot.arms.L.handBone,
      L1: dims.upperArmLen,
      L2: dims.lowerArmLen,
      targetWorldPos: this.currentTargets.armL,
      poleWorldPos: this.poles.armL,
      poleSign: -1,
    });

    solveTwoBoneIK({
      rootMount: robot.arms.R.rootMount,
      upperBone: robot.arms.R.upperBone,
      lowerBone: robot.arms.R.lowerBone,
      endBone: robot.arms.R.handBone,
      L1: dims.upperArmLen,
      L2: dims.lowerArmLen,
      targetWorldPos: this.currentTargets.armR,
      poleWorldPos: this.poles.armR,
      poleSign: -1,
    });

    // Align wave hand nicely toward viewer when waving
    if (this.mode === 'wave' || this.quickWaveTimer > 0) {
      robot.arms.R.handBone.rotation.set(-0.25, 0.35, Math.sin(time * 9.5) * 0.32);
    } else {
      robot.arms.R.handBone.rotation.set(0, 0, 0);
    }
    robot.arms.L.handBone.rotation.set(0, 0, 0);

    // Update all 10 live hydraulic pistons, sliding knee shields & chest reactor
    robot.updateMechanicalParts(clampedDt, time, this.overdriveBlend);

    // Update IK Debug Gizmos if visible
    this.ikDebugger.updateChain(
      this.debugChains.legL,
      robot.legs.L.upperBone,
      robot.legs.L.lowerBone,
      robot.legs.L.footBone,
      this.currentTargets.legL,
      this.poles.legL
    );
    this.ikDebugger.updateChain(
      this.debugChains.legR,
      robot.legs.R.upperBone,
      robot.legs.R.lowerBone,
      robot.legs.R.footBone,
      this.currentTargets.legR,
      this.poles.legR
    );
    this.ikDebugger.updateChain(
      this.debugChains.armL,
      robot.arms.L.upperBone,
      robot.arms.L.lowerBone,
      robot.arms.L.handBone,
      this.currentTargets.armL,
      this.poles.armL
    );
    this.ikDebugger.updateChain(
      this.debugChains.armR,
      robot.arms.R.upperBone,
      robot.arms.R.lowerBone,
      robot.arms.R.handBone,
      this.currentTargets.armR,
      this.poles.armR
    );
  }
}
