import * as THREE from 'three';

/**
 * Procedural radial cyber-deck floor texture with hex grid & concentric markings.
 */
function createDeckTexture() {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const cx = size / 2;
  const cy = size / 2;

  ctx.fillStyle = '#0c111d';
  ctx.fillRect(0, 0, size, size);

  // Subtle radial grid lines
  ctx.strokeStyle = 'rgba(0, 245, 255, 0.14)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 110, cy + Math.sin(a) * 110);
    ctx.lineTo(cx + Math.cos(a) * 485, cy + Math.sin(a) * 485);
    ctx.stroke();
  }

  // Concentric technical rings
  [140, 240, 355, 465].forEach((r, idx) => {
    ctx.strokeStyle = idx % 2 === 0 ? 'rgba(0, 245, 255, 0.25)' : 'rgba(255, 42, 133, 0.2)';
    ctx.lineWidth = idx === 3 ? 4 : 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Builds the Cyberpunk Showcase Stage, Lighting Rig, Holo Pedestal, Sonar Ripples & Data Motes.
 */
export function createCyberStage(scene, envMap) {
  const stageGroup = new THREE.Group();
  scene.add(stageGroup);

  // =========================================================================
  // 1. STUDIO + CYBERPUNK RIM LIGHTING RIG
  // =========================================================================
  const hemiLight = new THREE.HemisphereLight(0x8bc8ff, 0x090d1a, 0.52);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xf2f7ff, 1.48);
  keyLight.position.set(2.6, 5.2, 3.8);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 1.0;
  keyLight.shadow.camera.far = 12.0;
  const d = 1.85;
  keyLight.shadow.camera.left = -d;
  keyLight.shadow.camera.right = d;
  keyLight.shadow.camera.top = d + 0.6;
  keyLight.shadow.camera.bottom = -d;
  keyLight.shadow.bias = -0.0005;
  scene.add(keyLight);

  // Electric Cyan Left Rim Light
  const cyanRim = new THREE.DirectionalLight(0x00f5ff, 1.85);
  cyanRim.position.set(-4.2, 2.8, -2.2);
  scene.add(cyanRim);

  // Hot Magenta Right Rim Light
  const pinkRim = new THREE.DirectionalLight(0xff2a85, 1.65);
  pinkRim.position.set(4.2, 2.2, -2.6);
  scene.add(pinkRim);

  // =========================================================================
  // 2. CYBERPUNK PEDESTAL & FLOOR GRID (Top surface strictly at y = 0.000)
  // =========================================================================
  const deckTex = createDeckTexture();
  const deckMat = new THREE.MeshPhysicalMaterial({
    color: 0x3b4c6b,
    map: deckTex,
    metalness: 0.72,
    roughness: 0.28,
    clearcoat: 0.55,
    clearcoatRoughness: 0.2,
    envMap,
    envMapIntensity: 0.85,
  });

  const plinthRadius = 1.55;
  const plinthHeight = 0.14;
  const plinthTop = new THREE.Mesh(
    new THREE.CylinderGeometry(plinthRadius, plinthRadius * 1.06, plinthHeight, 48),
    deckMat
  );
  plinthTop.position.y = -plinthHeight * 0.5;
  plinthTop.receiveShadow = true;
  stageGroup.add(plinthTop);

  // Lower stepped dark metallic base
  const plinthBase = new THREE.Mesh(
    new THREE.CylinderGeometry(plinthRadius * 1.12, plinthRadius * 1.2, 0.1, 48),
    new THREE.MeshStandardMaterial({
      color: 0x0c101a,
      metalness: 0.88,
      roughness: 0.3,
      envMap,
    })
  );
  plinthBase.position.y = -plinthHeight - 0.05;
  plinthBase.receiveShadow = true;
  stageGroup.add(plinthBase);

  // Glowing neon rim around the pedestal edge
  const rimMatPrimary = new THREE.MeshBasicMaterial({ color: 0x00f5ff });
  const rimMatSecondary = new THREE.MeshBasicMaterial({ color: 0xff2a85 });

  const outerRim = new THREE.Mesh(
    new THREE.TorusGeometry(plinthRadius * 1.01, 0.014, 12, 64),
    rimMatPrimary
  );
  outerRim.rotation.x = Math.PI / 2;
  outerRim.position.y = -0.02;
  stageGroup.add(outerRim);

  // Counter-rotating holographic segmented floor rings at y = 0.003
  const holoRingA = new THREE.Mesh(
    new THREE.RingGeometry(0.88, 0.91, 64, 1, 0, Math.PI * 1.45),
    new THREE.MeshBasicMaterial({
      color: 0x00f5ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.72,
    })
  );
  holoRingA.rotation.x = -Math.PI / 2;
  holoRingA.position.y = 0.003;
  stageGroup.add(holoRingA);

  const holoRingB = new THREE.Mesh(
    new THREE.RingGeometry(1.18, 1.205, 64, 1, 0, Math.PI * 1.15),
    new THREE.MeshBasicMaterial({
      color: 0xff2a85,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
    })
  );
  holoRingB.rotation.x = -Math.PI / 2;
  holoRingB.position.y = 0.003;
  stageGroup.add(holoRingB);

  // Subtle infinite-feel surrounding cyber grid below pedestal
  const gridHelper = new THREE.GridHelper(22, 32, 0x00f5ff, 0x132038);
  gridHelper.position.y = -0.24;
  gridHelper.material.transparent = true;
  gridHelper.material.opacity = 0.32;
  stageGroup.add(gridHelper);

  // Invisible broad floor receiver for raycast floor clicks
  const floorHitPlane = new THREE.Mesh(
    new THREE.CircleGeometry(4.5, 32),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  floorHitPlane.rotation.x = -Math.PI / 2;
  floorHitPlane.position.y = 0.001;
  stageGroup.add(floorHitPlane);

  // =========================================================================
  // 3. INTERACTIVE SONAR CLICK RIPPLES
  // =========================================================================
  const ripples = [];
  function spawnRipple(worldPt) {
    const mat = new THREE.MeshBasicMaterial({
      color: rimMatPrimary.color.clone(),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
    });
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.095, 36), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(worldPt.x, 0.006, worldPt.z);
    stageGroup.add(mesh);
    ripples.push({ mesh, age: 0 });
  }

  // =========================================================================
  // 4. FLOATING AMBIENT CYBERPUNK DATA MOTES
  // =========================================================================
  const particleCount = 110;
  const pPositions = new Float32Array(particleCount * 3);
  const pSpeeds = new Float32Array(particleCount);
  for (let i = 0; i < particleCount; i++) {
    const r = 1.1 + Math.random() * 4.2;
    const theta = Math.random() * Math.PI * 2;
    pPositions[i * 3] = Math.cos(theta) * r;
    pPositions[i * 3 + 1] = Math.random() * 3.8;
    pPositions[i * 3 + 2] = Math.sin(theta) * r;
    pSpeeds[i] = 0.14 + Math.random() * 0.28;
  }

  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));

  const pMat = new THREE.PointsMaterial({
    color: 0x00f5ff,
    size: 0.038,
    transparent: true,
    opacity: 0.65,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const particles = new THREE.Points(pGeo, pMat);
  stageGroup.add(particles);

  function setStageTheme(primaryHex, secondaryHex) {
    cyanRim.color.set(primaryHex);
    pinkRim.color.set(secondaryHex);
    rimMatPrimary.color.set(primaryHex);
    rimMatSecondary.color.set(secondaryHex);
    holoRingA.material.color.set(primaryHex);
    holoRingB.material.color.set(secondaryHex);
    pMat.color.set(primaryHex);
  }

  function update(dt, elapsedTime) {
    holoRingA.rotation.z = elapsedTime * 0.35;
    holoRingB.rotation.z = -elapsedTime * 0.24;

    // Animate sonar ripples
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      r.age += dt;
      const scale = 1 + r.age * 7.5;
      r.mesh.scale.setScalar(scale);
      r.mesh.material.opacity = Math.max(0, 1 - r.age * 1.35);
      if (r.age >= 0.75) {
        stageGroup.remove(r.mesh);
        r.mesh.geometry.dispose();
        r.mesh.material.dispose();
        ripples.splice(i, 1);
      }
    }

    // Drift ambient particles upward
    const posAttr = pGeo.attributes.position;
    for (let i = 0; i < particleCount; i++) {
      let y = posAttr.getY(i) + pSpeeds[i] * dt;
      if (y > 3.9) y = 0.0;
      posAttr.setY(i, y);
    }
    posAttr.needsUpdate = true;
  }

  return {
    floorHitPlane,
    plinthTop,
    spawnRipple,
    setStageTheme,
    update,
  };
}
