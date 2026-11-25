import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const _posA = new THREE.Vector3();
const _posB = new THREE.Vector3();

function enableShadows(obj) {
  obj.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

/**
 * Creates an exposed CNC mechanical joint drum (anodized gold barrel + copper stator + end bolts).
 */
function createServoDrum(radius, length, materials, axis = 'x') {
  const g = new THREE.Group();

  const mainDrum = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, 24),
    materials.innerFrame
  );
  const copperBand = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.02, radius * 1.02, length * 0.42, 24),
    materials.copperCoil
  );
  const goldCapA = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.78, radius * 0.78, length * 1.12, 20),
    materials.jointGold
  );
  const centerPin = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.34, radius * 0.34, length * 1.24, 16),
    materials.chromeRod
  );

  // Glowing neon ring groove
  const neonRing = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.98, radius * 0.075, 10, 24),
    materials.neonPrimary
  );
  neonRing.rotation.x = Math.PI / 2;
  neonRing.position.y = length * 0.36;

  const neonRing2 = neonRing.clone();
  neonRing2.position.y = -length * 0.36;

  g.add(mainDrum, copperBand, goldCapA, centerPin, neonRing, neonRing2);

  if (axis === 'x') g.rotation.z = Math.PI / 2;
  else if (axis === 'z') g.rotation.x = Math.PI / 2;

  return g;
}

/**
 * Creates a telescoping hydraulic damper piston between two moving bones.
 */
function createHydraulicPiston(parentA, offsetA, parentB, offsetB, sleeveLen, radius, materials, pistonList) {
  const anchorA = new THREE.Group();
  anchorA.position.copy(offsetA);
  parentA.add(anchorA);

  const anchorB = new THREE.Group();
  anchorB.position.copy(offsetB);
  parentB.add(anchorB);

  // Ball clevis mounts
  const ballGeo = new THREE.SphereGeometry(radius * 1.35, 12, 12);
  anchorA.add(new THREE.Mesh(ballGeo, materials.jointGold));
  anchorB.add(new THREE.Mesh(ballGeo, materials.jointGold));

  // Outer cylinder housing oriented along +Z
  const sleeveMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, sleeveLen, 14),
    materials.jointGold
  );
  sleeveMesh.rotation.x = Math.PI / 2;
  sleeveMesh.position.z = sleeveLen * 0.5;

  const collarMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.18, radius * 1.18, sleeveLen * 0.22, 14),
    materials.innerFrame
  );
  collarMesh.rotation.x = Math.PI / 2;
  collarMesh.position.z = sleeveLen * 0.92;

  anchorA.add(sleeveMesh, collarMesh);

  // Inner mirror-chrome piston rod oriented along +Z back into sleeve
  const rodLen = sleeveLen * 1.35;
  const rodMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.54, radius * 0.54, rodLen, 12),
    materials.chromeRod
  );
  rodMesh.rotation.x = Math.PI / 2;
  rodMesh.position.z = rodLen * 0.5;
  anchorB.add(rodMesh);

  pistonList.push({ anchorA, anchorB });
}

/**
 * Builds a flexible curved power cable from 3D control points.
 */
function createFlexCable(points, radius, material) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, 20, radius, 10, false);
  return new THREE.Mesh(geo, material);
}

/**
 * Constructs Unit K1-B0: Chibi Cyberpunk Robot with full IK rig & mechanical joints.
 */
export function buildCyberRobot(materials, visorController) {
  const root = new THREE.Group();
  root.name = 'CyberRobotRoot';

  const pistons = [];
  const hitTargets = {
    head: [],
    core: [],
  };

  // Limb constants (used by IK solver & animator)
  const dims = {
    upperArmLen: 0.33,
    lowerArmLen: 0.33,
    upperLegLen: 0.38,
    lowerLegLen: 0.36,
    ankleHeight: 0.15,
    hipRestY: 0.84,
    hipSpacingX: 0.235,
  };

  // =========================================================================
  // 1. PELVIS & FLOATING HIP ARMOR SKIRTS
  // =========================================================================
  const pelvis = new THREE.Group();
  pelvis.position.set(0, dims.hipRestY, 0);
  root.add(pelvis);

  const pelvisCore = new THREE.Mesh(
    new RoundedBoxGeometry(0.46, 0.2, 0.36, 4, 0.055),
    materials.innerFrame
  );
  pelvis.add(pelvisCore);

  // Front codpiece armor + neon status chevron
  const frontCod = new THREE.Mesh(
    new RoundedBoxGeometry(0.22, 0.22, 0.14, 4, 0.04),
    materials.armorPrimary
  );
  frontCod.position.set(0, -0.01, 0.16);
  pelvis.add(frontCod);

  const codNeon = new THREE.Mesh(
    new RoundedBoxGeometry(0.12, 0.032, 0.04, 2, 0.01),
    materials.neonPrimary
  );
  codNeon.position.set(0, 0.03, 0.225);
  pelvis.add(codNeon);

  // Articulated Left & Right Hip Skirt Plates
  const hipSkirts = {};
  ['L', 'R'].forEach((side) => {
    const s = side === 'L' ? 1 : -1;
    const skirtPivot = new THREE.Group();
    skirtPivot.position.set(s * 0.25, 0.05, 0);
    pelvis.add(skirtPivot);

    const hingePin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.14, 12),
      materials.jointGold
    );
    hingePin.rotation.x = Math.PI / 2;
    skirtPivot.add(hingePin);

    const plate = new THREE.Mesh(
      new RoundedBoxGeometry(0.055, 0.22, 0.28, 4, 0.022),
      materials.circuitArmor
    );
    plate.position.set(s * 0.04, -0.09, 0);
    plate.rotation.z = s * 0.18;
    skirtPivot.add(plate);

    const trim = new THREE.Mesh(
      new RoundedBoxGeometry(0.062, 0.026, 0.24, 2, 0.008),
      materials.neonSecondary
    );
    trim.position.set(s * 0.058, -0.18, 0);
    trim.rotation.z = s * 0.18;
    skirtPivot.add(trim);

    hipSkirts[side] = skirtPivot;
  });

  // =========================================================================
  // 2. WAIST GIMBAL, CHEST CORE, JETPACK & LIVE ABDOMEN PISTONS
  // =========================================================================
  const spinePivot = new THREE.Group();
  spinePivot.position.set(0, 0.1, 0);
  pelvis.add(spinePivot);

  // Segmented cyber-spine core
  const waistBall = new THREE.Mesh(new THREE.SphereGeometry(0.155, 20, 20), materials.darkRubber);
   waistBall.position.y = 0.05;
  spinePivot.add(waistBall);

  const waistRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.162, 0.018, 10, 28),
    materials.jointGold
  );
  waistRing.rotation.x = Math.PI / 2;
  waistRing.position.y = 0.05;
  spinePivot.add(waistRing);

  const chest = new THREE.Group();
  chest.position.set(0, 0.13, 0);
  spinePivot.add(chest);

  // Twin abdominal hydraulic pistons (pelvis <-> chest)
  [-1, 1].forEach((s) => {
    createHydraulicPiston(
      pelvis,
      new THREE.Vector3(s * 0.15, 0.06, 0.12),
      chest,
      new THREE.Vector3(s * 0.16, 0.08, 0.13),
      0.13,
      0.02,
      materials,
      pistons
    );
  });

  // Main cute compact torso chassis
  const torsoMain = new THREE.Mesh(
    new RoundedBoxGeometry(0.68, 0.48, 0.46, 5, 0.095),
    materials.armorPrimary
  );
  torsoMain.position.set(0, 0.24, 0);
  chest.add(torsoMain);

  // Left & Right Circuit Pectoral Armor Plates
  [-1, 1].forEach((s) => {
    const pec = new THREE.Mesh(
      new RoundedBoxGeometry(0.22, 0.3, 0.08, 4, 0.03),
      materials.circuitArmor
    );
    pec.position.set(s * 0.21, 0.26, 0.215);
    pec.rotation.y = -s * 0.16;
    chest.add(pec);

    // Collarbone gold vent accents
    const collarVent = new THREE.Mesh(
      new RoundedBoxGeometry(0.15, 0.05, 0.12, 3, 0.015),
      materials.jointGold
    );
    collarVent.position.set(s * 0.2, 0.47, 0.1);
    collarVent.rotation.z = -s * 0.15;
    chest.add(collarVent);

    // Side rib copper coils
    const ribCoil = new THREE.Mesh(
      new THREE.CylinderGeometry(0.048, 0.048, 0.18, 16),
      materials.copperCoil
    );
    ribCoil.position.set(s * 0.33, 0.13, 0.02);
    ribCoil.rotation.z = s * 0.15;
    chest.add(ribCoil);
  });

  // Center Cyber-Core / Arc Turbine Assembly (Clickable!)
  const coreGroup = new THREE.Group();
  coreGroup.position.set(0, 0.26, 0.235);
  chest.add(coreGroup);

  const coreBezel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.135, 0.15, 0.06, 28),
    materials.jointGold
  );
  coreBezel.rotation.x = Math.PI / 2;
  coreGroup.add(coreBezel);

  const coreRecess = new THREE.Mesh(
    new THREE.CylinderGeometry(0.115, 0.115, 0.05, 24),
    materials.innerFrame
  );
  coreRecess.rotation.x = Math.PI / 2;
  coreRecess.position.z = 0.008;
  coreGroup.add(coreRecess);

  // Spinning outer & inner reactor rings
  const coreOuterRing = new THREE.Group();
  coreOuterRing.position.z = 0.025;
  coreGroup.add(coreOuterRing);
  const outerTorus = new THREE.Mesh(
    new THREE.TorusGeometry(0.092, 0.012, 10, 24),
    materials.neonPrimary
  );
  coreOuterRing.add(outerTorus);
  for (let i = 0; i < 6; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.04, 0.016), materials.chromeRod);
    const a = (i / 6) * Math.PI * 2;
    fin.position.set(Math.cos(a) * 0.09, Math.sin(a) * 0.09, 0.005);
    fin.rotation.z = a;
    coreOuterRing.add(fin);
  }

  const coreInnerRing = new THREE.Group();
  coreInnerRing.position.z = 0.032;
  coreGroup.add(coreInnerRing);
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(
      new RoundedBoxGeometry(0.022, 0.11, 0.012, 2, 0.004),
      materials.neonSecondary
    );
    blade.rotation.z = (i / 3) * Math.PI;
    coreInnerRing.add(blade);
  }

  const coreJewel = new THREE.Mesh(new THREE.SphereGeometry(0.042, 16, 16), materials.neonPrimary);
  coreJewel.position.z = 0.035;
  coreGroup.add(coreJewel);

  const coreLens = new THREE.Mesh(
    new THREE.SphereGeometry(0.118, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.36),
    materials.visorGlass
  );
  coreLens.rotation.x = Math.PI / 2;
  coreLens.position.z = -0.02;
  coreGroup.add(coreLens);

  // Subtle chest neon PointLight
  const coreLight = new THREE.PointLight(0x00f5ff, 1.35, 2.2, 2.0);
  coreLight.position.set(0, 0, 0.14);
  coreGroup.add(coreLight);

  hitTargets.core.push(coreBezel, coreLens, torsoMain);

  // Rear Cyberpunk Power-Pack / Mini Thruster Backpack
  const backpack = new THREE.Group();
  backpack.position.set(0, 0.25, -0.27);
  chest.add(backpack);

  const packShell = new THREE.Mesh(
    new RoundedBoxGeometry(0.46, 0.36, 0.18, 4, 0.05),
    materials.armorSecondary
  );
  backpack.add(packShell);

  // Vertical glowing energy cell bars on backpack
  for (let i = -1; i <= 1; i++) {
    const cellBar = new THREE.Mesh(
      new RoundedBoxGeometry(0.045, 0.18, 0.03, 2, 0.01),
      i === 0 ? materials.neonSecondary : materials.neonPrimary
    );
    cellBar.position.set(i * 0.085, 0.03, -0.088);
    backpack.add(cellBar);
  }

  // Dual angled booster nozzles
  const thrusterFlames = [];
  [-1, 1].forEach((s) => {
    const nozzleGroup = new THREE.Group();
    nozzleGroup.position.set(s * 0.14, -0.17, -0.03);
    nozzleGroup.rotation.x = 0.28;
    nozzleGroup.rotation.z = s * 0.14;
    backpack.add(nozzleGroup);

    const bell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.048, 0.072, 0.11, 18),
      materials.innerFrame
    );
    const goldRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.068, 0.009, 8, 18),
      materials.jointGold
    );
    goldRim.rotation.x = Math.PI / 2;
    goldRim.position.y = -0.05;

    const glowCore = new THREE.Mesh(
      new THREE.ConeGeometry(0.048, 0.13, 14),
      materials.neonSecondary
    );
    glowCore.rotation.x = Math.PI;
    glowCore.position.y = -0.085;
    thrusterFlames.push(glowCore);

    nozzleGroup.add(bell, goldRim, glowCore);

    // Braided power cable from backpack to waist
    const cable = createFlexCable(
      [
        new THREE.Vector3(s * 0.18, 0.16, -0.22),
        new THREE.Vector3(s * 0.29, 0.06, -0.18),
        new THREE.Vector3(s * 0.22, -0.02, -0.08),
      ],
      0.018,
      materials.darkRubber
    );
    chest.add(cable);
  });

  // =========================================================================
  // 3. NECK GIMBAL + OVERSIZED CHIBI VISOR HEAD + ARTICULATED CYBER EARS
  // =========================================================================
  const neckBase = new THREE.Group();
  neckBase.position.set(0, 0.49, 0.01);
  chest.add(neckBase);

  // Segmented neck bellows
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(0.105 - i * 0.006, 0.112 - i * 0.006, 0.032, 18),
      i % 2 === 0 ? materials.darkRubber : materials.innerFrame
    );
    ring.position.y = 0.02 + i * 0.034;
    neckBase.add(ring);
  }

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 0.125, 0);
  neckBase.add(headPivot);

  // Twin micro-hydraulic neck pistons (chest collar <-> skull base)
  [-1, 1].forEach((s) => {
    createHydraulicPiston(
      chest,
      new THREE.Vector3(s * 0.13, 0.48, -0.05),
      headPivot,
      new THREE.Vector3(s * 0.15, 0.04, -0.06),
      0.095,
      0.016,
      materials,
      pistons
    );
  });

  // Chibi Helmet Shell (oversized cute rounded silhouette!)
  const helmetCenterY = 0.34;
  const helmetShell = new THREE.Mesh(
    new RoundedBoxGeometry(0.98, 0.72, 0.72, 6, 0.18),
    materials.armorPrimary
  );
  helmetShell.position.set(0, helmetCenterY, -0.02);
  headPivot.add(helmetShell);

  // Top circuit crest plate
  const topCrest = new THREE.Mesh(
    new RoundedBoxGeometry(0.44, 0.08, 0.6, 4, 0.03),
    materials.circuitArmor
  );
  topCrest.position.set(0, helmetCenterY + 0.345, -0.03);
  headPivot.add(topCrest);

  // Forehead glowing sensor jewel
  const browSensor = new THREE.Mesh(
    new RoundedBoxGeometry(0.18, 0.036, 0.05, 3, 0.012),
    materials.neonPrimary
  );
  browSensor.position.set(0, helmetCenterY + 0.27, 0.345);
  headPivot.add(browSensor);

  // Dark Titanium Recessed Visor Bezel
  const visorBezel = new THREE.Mesh(
    new RoundedBoxGeometry(0.84, 0.5, 0.12, 5, 0.11),
    materials.armorSecondary
  );
  visorBezel.position.set(0, helmetCenterY - 0.02, 0.3);
  headPivot.add(visorBezel);

  // Inner Curved OLED Screen Mesh (concentric cylinder patch clear of bezel)
  const oledMat = new THREE.MeshStandardMaterial({
    color: 0x050811,
    emissive: 0xffffff,
    emissiveMap: visorController.texture,
    emissiveIntensity: 2.55,
    roughness: 0.25,
    metalness: 0.1,
  });

  const screenRadius = 1.05;
  const screenArc = 0.72;
  const visorCenterZ = 0.366 - screenRadius * Math.cos(screenArc * 0.5);

  const oledScreen = new THREE.Mesh(
    new THREE.CylinderGeometry(
      screenRadius,
      screenRadius,
      0.4,
      36,
      1,
      true,
      -screenArc * 0.5,
      screenArc
    ),
    oledMat
  );
  oledScreen.position.set(0, helmetCenterY - 0.02, visorCenterZ);
  headPivot.add(oledScreen);

  // Concentric Outer Glossy Curved Smoked-Glass Visor Shield
  const glassRadius = screenRadius + 0.018;
  const glassArc = screenArc + 0.03;
  const outerVisor = new THREE.Mesh(
    new THREE.CylinderGeometry(
      glassRadius,
      glassRadius,
      0.425,
      36,
      1,
      true,
      -glassArc * 0.5,
      glassArc
    ),
    materials.visorGlass
  );
  outerVisor.position.set(0, helmetCenterY - 0.02, visorCenterZ);
  headPivot.add(outerVisor);

  hitTargets.head.push(helmetShell, outerVisor, visorBezel, topCrest);

  // Side Acoustic / Servo "Headphone" Pods
  [-1, 1].forEach((s) => {
    const pod = new THREE.Group();
    pod.position.set(s * 0.5, helmetCenterY - 0.01, 0.01);
    pod.add(createServoDrum(0.155, 0.09, materials, 'x'));

    const outerGlow = new THREE.Mesh(
      new THREE.TorusGeometry(0.115, 0.013, 10, 24),
      materials.neonSecondary
    );
    outerGlow.rotation.y = Math.PI / 2;
    outerGlow.position.x = s * 0.052;
    pod.add(outerGlow);

    headPivot.add(pod);
  });

  // Articulated Cyber Cat/Bunny Sensor Ears!
  const ears = {};
  ['L', 'R'].forEach((side) => {
    const s = side === 'L' ? 1 : -1;
    const earMount = new THREE.Group();
    earMount.position.set(s * 0.32, helmetCenterY + 0.34, -0.02);
    earMount.rotation.z = -s * 0.22;
    headPivot.add(earMount);

    const earPivot = new THREE.Group();
    earMount.add(earPivot);

    // Servo hinge drum at ear base
    earPivot.add(createServoDrum(0.068, 0.09, materials, 'z'));

    // Outer sleek alloy fin
    const earBlade = new THREE.Mesh(
      new RoundedBoxGeometry(0.11, 0.36, 0.14, 4, 0.035),
      materials.armorPrimary
    );
    earBlade.position.set(0, 0.19, 0);
    earBlade.scale.set(0.85, 1.0, 0.75);
    earPivot.add(earBlade);

    // Inner glowing neon waveguide strip
    const earGlow = new THREE.Mesh(
      new RoundedBoxGeometry(0.052, 0.25, 0.04, 3, 0.015),
      materials.neonPrimary
    );
    earGlow.position.set(0, 0.19, 0.045);
    earPivot.add(earGlow);

    // Cute glowing antenna tip bead
    const tipPin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.014, 0.09, 10),
      materials.chromeRod
    );
    tipPin.position.set(0, 0.4, -0.02);
    earPivot.add(tipPin);

    const tipOrb = new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 12), materials.neonSecondary);
    tipOrb.position.set(0, 0.45, -0.02);
    earPivot.add(tipOrb);

    hitTargets.head.push(earBlade);
    ears[side] = earPivot;
  });

  // =========================================================================
  // 4. ARMS: PAULDRONS, HARMONIC DRIVES, ELBOW PISTONS & 3-FINGER HANDS
  // =========================================================================
  const arms = {};
  ['L', 'R'].forEach((side) => {
    const s = side === 'L' ? 1 : -1;
    const L1 = dims.upperArmLen;
    const L2 = dims.lowerArmLen;

    // Fixed socket on chest for IK root
    const rootMount = new THREE.Group();
    rootMount.position.set(s * 0.43, 0.4, 0.0);
    chest.add(rootMount);

    // Floating Shoulder Pauldron Armor (tracks partial arm elevation)
    const pauldronPivot = new THREE.Group();
    pauldronPivot.position.set(s * 0.02, 0.06, 0);
    rootMount.add(pauldronPivot);

    const pauldron = new THREE.Mesh(
      new RoundedBoxGeometry(0.22, 0.16, 0.28, 4, 0.045),
      materials.circuitArmor
    );
    pauldron.position.set(s * 0.06, 0.02, 0);
    pauldron.rotation.z = -s * 0.32;
    pauldronPivot.add(pauldron);

    const pauldronNeon = new THREE.Mesh(
      new RoundedBoxGeometry(0.18, 0.024, 0.24, 2, 0.008),
      materials.neonPrimary
    );
    pauldronNeon.position.set(s * 0.075, -0.045, 0);
    pauldronNeon.rotation.z = -s * 0.32;
    pauldronPivot.add(pauldronNeon);

    // Upper Arm Bone (origin at shoulder center, extends -Y by L1)
    const upperBone = new THREE.Group();
    rootMount.add(upperBone);

    // Exposed shoulder ball + gold harmonic drive
    upperBone.add(new THREE.Mesh(new THREE.SphereGeometry(0.088, 18, 18), materials.jointGold));
    const shoulderCollar = new THREE.Mesh(
      new THREE.TorusGeometry(0.092, 0.015, 10, 22),
      materials.innerFrame
    );
    shoulderCollar.rotation.y = Math.PI / 2;
    upperBone.add(shoulderCollar);

    // Twin chrome humerus struts
    [-0.032, 0.032].forEach((zOff) => {
      const strut = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, L1 * 0.85, 12),
        materials.chromeRod
      );
      strut.position.set(0, -L1 * 0.5, zOff);
      upperBone.add(strut);
    });

    // Bicep armor cuff
    const bicepCuff = new THREE.Mesh(
      new RoundedBoxGeometry(0.145, L1 * 0.52, 0.155, 4, 0.035),
      materials.armorPrimary
    );
    bicepCuff.position.set(0, -L1 * 0.44, 0);
    upperBone.add(bicepCuff);

    // Lower Arm / Forearm Bone (origin at elbow (0, -L1, 0), extends -Y by L2)
    const lowerBone = new THREE.Group();
    lowerBone.position.set(0, -L1, 0);
    upperBone.add(lowerBone);

    // Intricate Exposed Elbow Servo Drum (aligned with +X hinge!)
    lowerBone.add(createServoDrum(0.072, 0.135, materials, 'x'));

    // Working Hydraulic Elbow Piston (upper arm rear <-> forearm olecranon)
    createHydraulicPiston(
      upperBone,
      new THREE.Vector3(s * 0.045, -L1 * 0.32, -0.055),
      lowerBone,
      new THREE.Vector3(s * 0.045, -0.06, -0.068),
      0.13,
      0.016,
      materials,
      pistons
    );

    // Chunky Cute Tapered Forearm Gauntlet
    const gauntlet = new THREE.Mesh(
      new RoundedBoxGeometry(0.195, L2 * 0.72, 0.205, 5, 0.055),
      materials.armorPrimary
    );
    gauntlet.position.set(0, -L2 * 0.54, 0.008);
    lowerBone.add(gauntlet);

    const gauntletPlate = new THREE.Mesh(
      new RoundedBoxGeometry(0.05, L2 * 0.52, 0.13, 3, 0.018),
      materials.circuitArmor
    );
    gauntletPlate.position.set(s * 0.088, -L2 * 0.54, 0.008);
    lowerBone.add(gauntletPlate);

    // Glowing neon wrist cuff ring
    const wristGlow = new THREE.Mesh(
      new THREE.TorusGeometry(0.076, 0.011, 10, 22),
      materials.neonPrimary
    );
    wristGlow.rotation.x = Math.PI / 2;
    wristGlow.position.y = -L2 * 0.92;
    lowerBone.add(wristGlow);

    // Hand & Articulated 3-Finger Assembly
    const handBone = new THREE.Group();
    handBone.position.set(0, -L2, 0);
    lowerBone.add(handBone);

    handBone.add(new THREE.Mesh(new THREE.SphereGeometry(0.052, 14, 14), materials.jointGold));

    const palm = new THREE.Mesh(
      new RoundedBoxGeometry(0.11, 0.105, 0.125, 4, 0.03),
      materials.armorSecondary
    );
    palm.position.set(0, -0.065, 0.005);
    handBone.add(palm);

    // Glowing palm repulsor/emitter pad
    const palmPad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.028, 0.02, 14),
      materials.neonSecondary
    );
    palmPad.rotation.z = Math.PI / 2;
    palmPad.position.set(-s * 0.052, -0.068, 0.005);
    handBone.add(palmPad);

    // Cute 2-segment fingers (Index, Mid, Thumb)
    const fingers = [];
    [-0.034, 0.032].forEach((zF) => {
      const fBase = new THREE.Group();
      fBase.position.set(s * 0.022, -0.115, zF);
      handBone.add(fBase);

      const seg1 = new THREE.Mesh(
        new RoundedBoxGeometry(0.036, 0.058, 0.044, 2, 0.012),
        materials.innerFrame
      );
      seg1.position.y = -0.026;
      fBase.add(seg1);

      const fTip = new THREE.Group();
      fTip.position.y = -0.052;
      fBase.add(fTip);

      const seg2 = new THREE.Mesh(
        new RoundedBoxGeometry(0.034, 0.048, 0.042, 2, 0.012),
        materials.jointGold
      );
      seg2.position.y = -0.022;
      fTip.add(seg2);

      fingers.push({ fBase, fTip, axis: 'z', sign: -s });
    });

    // Opposable Cute Thumb
    const thumbBase = new THREE.Group();
    thumbBase.position.set(-s * 0.035, -0.075, 0.058);
    thumbBase.rotation.x = 0.35;
    handBone.add(thumbBase);
    const thumbMesh = new THREE.Mesh(
      new RoundedBoxGeometry(0.038, 0.062, 0.04, 2, 0.012),
      materials.jointGold
    );
    thumbMesh.position.y = -0.028;
    thumbBase.add(thumbMesh);

    arms[side] = {
      rootMount,
      pauldronPivot,
      upperBone,
      lowerBone,
      handBone,
      fingers,
      thumbBase,
    };
  });

  // =========================================================================
  // 5. LEGS: SPHERICAL HIPS, DOUBLE-HINGE KNEES, PISTONS & CHIBI MECHA BOOTS
  // =========================================================================
  const legs = {};
  ['L', 'R'].forEach((side) => {
    const s = side === 'L' ? 1 : -1;
    const L1 = dims.upperLegLen;
    const L2 = dims.lowerLegLen;

    // Fixed hip socket on pelvis
    const rootMount = new THREE.Group();
    rootMount.position.set(s * dims.hipSpacingX, -0.04, 0);
    pelvis.add(rootMount);

    const upperBone = new THREE.Group();
    rootMount.add(upperBone);

    // Machined Titanium/Gold Hip Ball Bearing
    upperBone.add(new THREE.Mesh(new THREE.SphereGeometry(0.095, 20, 20), materials.jointGold));

    // Twin femur struts
    [-0.038, 0.038].forEach((zOff) => {
      const strut = new THREE.Mesh(
        new THREE.CylinderGeometry(0.024, 0.024, L1 * 0.9, 12),
        materials.innerFrame
      );
      strut.position.set(0, -L1 * 0.5, zOff);
      upperBone.add(strut);
    });

    // Sculpted Thigh Armor Shell
    const thighArmor = new THREE.Mesh(
      new RoundedBoxGeometry(0.21, L1 * 0.64, 0.23, 5, 0.055),
      materials.armorPrimary
    );
    thighArmor.position.set(0, -L1 * 0.46, 0.015);
    upperBone.add(thighArmor);

    const thighNeon = new THREE.Mesh(
      new RoundedBoxGeometry(0.04, L1 * 0.44, 0.08, 2, 0.012),
      materials.neonPrimary
    );
    thighNeon.position.set(s * 0.098, -L1 * 0.46, 0.02);
    upperBone.add(thighNeon);

    // Lower Leg / Shin Bone (origin at knee (0, -L1, 0), extends -Y by L2)
    const lowerBone = new THREE.Group();
    lowerBone.position.set(0, -L1, 0);
    upperBone.add(lowerBone);

    // Exposed Knee Harmonic-Drive Drum
    lowerBone.add(createServoDrum(0.084, 0.165, materials, 'x'));

    // Linked Sliding Mecha Kneecap Shield (rotates at 50% of knee flex!)
    const kneeShieldPivot = new THREE.Group();
    kneeShieldPivot.position.set(0, -L1, 0);
    upperBone.add(kneeShieldPivot);

    const kneeShield = new THREE.Mesh(
      new RoundedBoxGeometry(0.145, 0.16, 0.075, 4, 0.028),
      materials.armorSecondary
    );
    kneeShield.position.set(0, 0.01, 0.105);
    kneeShield.rotation.x = -0.15;
    kneeShieldPivot.add(kneeShield);

    const kneeFin = new THREE.Mesh(
      new RoundedBoxGeometry(0.05, 0.09, 0.03, 2, 0.008),
      materials.neonSecondary
    );
    kneeFin.position.set(0, 0.015, 0.14);
    kneeShieldPivot.add(kneeFin);

    // Rear Thigh-to-Calf Hydraulic Shock Absorber Piston
    createHydraulicPiston(
      upperBone,
      new THREE.Vector3(0, -L1 * 0.36, -0.095),
      lowerBone,
      new THREE.Vector3(0, -0.11, -0.105),
      0.14,
      0.02,
      materials,
      pistons
    );

    // Flared Cute Mecha Shin Greave
    const shinGreave = new THREE.Mesh(
      new RoundedBoxGeometry(0.24, L2 * 0.72, 0.26, 5, 0.065),
      materials.armorPrimary
    );
    shinGreave.position.set(0, -L2 * 0.53, 0.01);
    lowerBone.add(shinGreave);

    const shinCircuit = new THREE.Mesh(
      new RoundedBoxGeometry(0.11, L2 * 0.54, 0.05, 3, 0.015),
      materials.circuitArmor
    );
    shinCircuit.position.set(0, -L2 * 0.52, 0.125);
    lowerBone.add(shinCircuit);

    // Foot / Boot Group (origin at ankle (0, -L2, 0); sole sits flush at y = -0.15!)
    const footBone = new THREE.Group();
    footBone.position.set(0, -L2, 0);
    lowerBone.add(footBone);

    // Exposed Ankle Clevis Joint
    footBone.add(createServoDrum(0.064, 0.13, materials, 'x'));

    // Front Shin-to-Instep Damper Piston
    createHydraulicPiston(
      lowerBone,
      new THREE.Vector3(s * 0.06, -L2 * 0.52, 0.115),
      footBone,
      new THREE.Vector3(s * 0.06, -0.05, 0.13),
      0.11,
      0.015,
      materials,
      pistons
    );

    // Main Boot Chassis (bottom of sole exactly at y = -dims.ankleHeight = -0.15)
    const bootChassis = new THREE.Mesh(
      new RoundedBoxGeometry(0.26, 0.12, 0.3, 4, 0.04),
      materials.armorPrimary
    );
    bootChassis.position.set(0, -0.072, 0.02);
    footBone.add(bootChassis);

    // Dark rubber magnetic tread sole (y from -0.15 to -0.118)
    const bootSole = new THREE.Mesh(
      new RoundedBoxGeometry(0.275, 0.034, 0.39, 3, 0.012),
      materials.darkRubber
    );
    bootSole.position.set(0, -0.133, 0.055);
    footBone.add(bootSole);

    // Glowing Neon Hover/Grip Rim around boot base
    const soleNeon = new THREE.Mesh(
      new RoundedBoxGeometry(0.28, 0.016, 0.37, 3, 0.008),
      materials.neonPrimary
    );
    soleNeon.position.set(0, -0.112, 0.055);
    footBone.add(soleNeon);

    // Heel Stabilizer Spur
    const heelSpur = new THREE.Mesh(
      new RoundedBoxGeometry(0.16, 0.07, 0.1, 3, 0.02),
      materials.armorSecondary
    );
    heelSpur.position.set(0, -0.095, -0.135);
    footBone.add(heelSpur);

    // Articulated Cute Front Toe-Cap
    const toePivot = new THREE.Group();
    toePivot.position.set(0, -0.105, 0.135);
    footBone.add(toePivot);

    const toeCap = new THREE.Mesh(
      new RoundedBoxGeometry(0.25, 0.09, 0.16, 4, 0.036),
      materials.armorSecondary
    );
    toeCap.position.set(0, 0.015, 0.055);
    toePivot.add(toeCap);

    legs[side] = {
      rootMount,
      upperBone,
      lowerBone,
      kneeShieldPivot,
      footBone,
      toePivot,
    };
  });

  enableShadows(root);
  // Prevent outer glass from casting opaque dark shadow over the OLED face
  outerVisor.castShadow = false;
  coreLens.castShadow = false;

  /**
   * Updates all linked mechanical assemblies (10 hydraulic pistons, sliding knee shields,
   * floating shoulder pauldrons, hip skirts, and spinning chest reactor rings).
   */
  function updateMechanicalParts(dt, elapsedTime, overdriveFactor = 0) {
    root.updateMatrixWorld(true);

    // 1. Align all 10 telescoping hydraulic pistons
    for (let i = 0; i < pistons.length; i++) {
      const { anchorA, anchorB } = pistons[i];
      anchorA.getWorldPosition(_posA);
      anchorB.getWorldPosition(_posB);
      anchorA.lookAt(_posB);
      anchorB.lookAt(_posA);
    }

    // 2. Sliding mecha kneecap linkage + hip skirt flare
    ['L', 'R'].forEach((side) => {
      const s = side === 'L' ? 1 : -1;
      const leg = legs[side];
      leg.kneeShieldPivot.quaternion.identity().slerp(leg.lowerBone.quaternion, 0.5);

      // Flare hip skirt outward slightly when thigh swings forward/outward
      const hipPitch = Math.max(0, -leg.upperBone.rotation.x);
      hipSkirts[side].rotation.z = s * (0.06 + hipPitch * 0.35);

      // Subtle shoulder pauldron follow
      const arm = arms[side];
      arm.pauldronPivot.quaternion.identity().slerp(arm.upperBone.quaternion, 0.32);
    });

    // 3. Spin chest cyber-core turbine rings & pulse booster flames
    const rpm = 1.6 + overdriveFactor * 6.5;
    coreOuterRing.rotation.z += dt * rpm;
    coreInnerRing.rotation.z -= dt * rpm * 1.65;
    const corePulse = 1.0 + Math.sin(elapsedTime * (4.0 + overdriveFactor * 8.0)) * 0.12;
    coreJewel.scale.setScalar(corePulse);
    coreLight.intensity = 1.2 + overdriveFactor * 1.8 + Math.sin(elapsedTime * 5) * 0.2;

    const flameScaleY = 0.75 + overdriveFactor * 1.35 + Math.sin(elapsedTime * 28) * 0.15;
    thrusterFlames.forEach((f) => {
      f.scale.set(0.9 + overdriveFactor * 0.3, flameScaleY, 0.9 + overdriveFactor * 0.3);
    });
  }

  function setNeonLightColor(hexColor) {
    coreLight.color.set(hexColor);
  }

  return {
    root,
    dims,
    pelvis,
    spinePivot,
    chest,
    neckBase,
    headPivot,
    ears,
    arms,
    legs,
    hitTargets,
    updateMechanicalParts,
    setNeonLightColor,
  };
}
