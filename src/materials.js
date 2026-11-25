import * as THREE from 'three';

export const COLOR_THEMES = {
  cyber: {
    armorPrimary: '#8a9bb5',
    armorSecondary: '#182032',
    innerFrame: '#121722',
    neonPrimary: '#00f5ff',
    neonSecondary: '#ff2a85',
    visorTint: '#050b16',
    jointGold: '#d8a648',
  },
  crimson: {
    armorPrimary: '#222733',
    armorSecondary: '#10131a',
    innerFrame: '#141720',
    neonPrimary: '#ff244c',
    neonSecondary: '#ff9d00',
    visorTint: '#120408',
    jointGold: '#cf9640',
  },
  gold: {
    armorPrimary: '#9c9484',
    armorSecondary: '#1e232e',
    innerFrame: '#161a22',
    neonPrimary: '#ffd000',
    neonSecondary: '#00ffa6',
    visorTint: '#0d0c06',
    jointGold: '#e5b342',
  },
  mint: {
    armorPrimary: '#8ba8a8',
    armorSecondary: '#202838',
    innerFrame: '#151c28',
    neonPrimary: '#2effb5',
    neonSecondary: '#b35cff',
    visorTint: '#051212',
    jointGold: '#d4ae5c',
  },
};

/**
 * Generates a rich cyberpunk studio reflection cubemap via PMREMGenerator
 * so metallic PBR surfaces exhibit crisp multi-toned specular reflections.
 */
export function createCyberEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x060913);

  const makeLightPanel = (w, h, color, intensity, pos, lookAtPos) => {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(intensity),
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.copy(pos);
    mesh.lookAt(lookAtPos);
    envScene.add(mesh);
  };

  const origin = new THREE.Vector3(0, 0, 0);
  // Overhead studio softbox for crisp top metallic sheen without blowout
  makeLightPanel(12, 12, 0xbfdcf5, 1.65, new THREE.Vector3(0, 12, 2), origin);
  // Left electric-cyan neon strip
  makeLightPanel(3.5, 14, 0x00f5ff, 2.5, new THREE.Vector3(-11, 3, 4), origin);
  // Right hot-magenta cyberpunk sign strip
  makeLightPanel(3.5, 14, 0xff2a85, 2.4, new THREE.Vector3(11, 3, -2), origin);
  // Cool cyber-indigo rim panel behind for dark metallic reflections
  makeLightPanel(10, 6, 0x3b4cca, 1.5, new THREE.Vector3(0, 4, -12), origin);
  // Subtle dark-blue floor bounce
  makeLightPanel(18, 18, 0x081526, 0.9, new THREE.Vector3(0, -8, 0), origin);

  const envRT = pmrem.fromScene(envScene, 0.035);
  pmrem.dispose();
  return envRT.texture;
}

/**
 * Procedural fine brushed alloy bump + roughness maps for realistic CNC metal.
 */
function createBrushedMetalTextures() {
  const size = 512;
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d');

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  for (let i = 0; i < 3600; i++) {
    const y = Math.random() * size;
    const x = Math.random() * size;
    const len = 18 + Math.random() * 90;
    const shade = 105 + Math.floor(Math.random() * 50);
    bCtx.strokeStyle = `rgba(${shade},${shade},${shade},0.22)`;
    bCtx.lineWidth = 0.7 + Math.random() * 1.1;
    bCtx.beginPath();
    bCtx.moveTo(x, y);
    bCtx.lineTo((x + len) % size, y + (Math.random() - 0.5) * 1.2);
    bCtx.stroke();
  }

  // Subtle panel seam grid
  bCtx.strokeStyle = 'rgba(40,40,40,0.32)';
  bCtx.lineWidth = 2;
  bCtx.strokeRect(4, 4, size - 8, size - 8);

  const bumpTex = new THREE.CanvasTexture(bumpCanvas);
  bumpTex.wrapS = THREE.RepeatWrapping;
  bumpTex.wrapT = THREE.RepeatWrapping;
  bumpTex.repeat.set(2, 2);

  return { bumpTex };
}

/**
 * Procedural micro-hexagon / carbon weave bump texture for inner skeleton & joints.
 */
function createHexSkeletonTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#555555';
  ctx.fillRect(0, 0, size, size);

  const r = 10;
  const dx = r * 1.732;
  const dy = r * 1.5;

  ctx.strokeStyle = '#9e9e9e';
  ctx.lineWidth = 1.6;

  for (let row = -1; row < size / dy + 2; row++) {
    for (let col = -1; col < size / dx + 2; col++) {
      const cx = col * dx + (row % 2 ? dx * 0.5 : 0);
      const cy = row * dy;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = (Math.PI / 3) * i + Math.PI / 6;
        const px = cx + Math.cos(ang) * (r - 1.5);
        const py = cy + Math.sin(ang) * (r - 1.5);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

/**
 * Dynamic animated neon circuit trace CanvasTexture.
 * Renders crisp 45-degree PCB traces, solder pads, and real-time travelling data pulses!
 */
export class AnimatedCircuitTexture {
  constructor() {
    this.size = 512;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.size;
    this.canvas.height = this.size;
    this.ctx = this.canvas.getContext('2d');

    this.primaryColor = '#00f5ff';
    this.secondaryColor = '#ff2a85';
    this.pulseSpeed = 1.2;

    // Predefine clean 45-degree cyber circuit paths
    this.paths = [
      [
        [32, 480],
        [32, 340],
        [96, 276],
        [96, 130],
        [156, 70],
        [156, 24],
      ],
      [
        [76, 490],
        [76, 370],
        [146, 300],
        [240, 300],
        [296, 244],
        [296, 40],
      ],
      [
        [196, 492],
        [196, 396],
        [256, 336],
        [256, 176],
        [320, 112],
        [440, 112],
      ],
      [
        [330, 488],
        [330, 360],
        [398, 292],
        [398, 180],
        [462, 116],
        [462, 28],
      ],
      [
        [448, 490],
        [448, 390],
        [484, 354],
        [484, 210],
        [430, 156],
      ],
      [
        [26, 210],
        [110, 210],
        [164, 156],
        [256, 156],
        [304, 204],
        [372, 204],
      ],
      [
        [48, 92],
        [116, 92],
        [168, 40],
        [360, 40],
        [412, 92],
      ],
    ];

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.wrapS = THREE.RepeatWrapping;
    this.texture.wrapT = THREE.RepeatWrapping;
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.update(0);
  }

  setColors(primary, secondary) {
    this.primaryColor = primary;
    this.secondaryColor = secondary;
  }

  update(time) {
    const { ctx, size, paths } = this;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, size, size);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Base glowing circuit traces
    paths.forEach((pts, idx) => {
      const col = idx % 3 === 2 ? this.secondaryColor : this.primaryColor;
      ctx.strokeStyle = col;
      ctx.globalAlpha = 0.42;
      ctx.lineWidth = 3.2;

      ctx.beginPath();
      pts.forEach(([x, y], i) => {
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Via pads at vertices
      ctx.globalAlpha = 0.78;
      ctx.fillStyle = col;
      pts.forEach(([x, y], i) => {
        if (i === 0 || i === pts.length - 1) {
          ctx.beginPath();
          ctx.arc(x, y, 5.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.arc(x, y, 2.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = col;
        }
      });

      // Travelling bright data packet along the polyline
      const totalSegs = pts.length - 1;
      const tRaw = (time * 0.55 * this.pulseSpeed + idx * 0.27) % 1.35;
      if (tRaw <= 1.0) {
        const segFloat = tRaw * totalSegs;
        const segIdx = Math.min(totalSegs - 1, Math.floor(segFloat));
        const localT = segFloat - segIdx;
        const [x0, y0] = pts[segIdx];
        const [x1, y1] = pts[segIdx + 1];
        const px = x0 + (x1 - x0) * localT;
        const py = y0 + (y1 - y0) * localT;

        const grad = ctx.createRadialGradient(px, py, 1, px, py, 24);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.35, col);
        grad.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.globalAlpha = 1.0;
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(px, py, 24, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Subtle micro-IC parallel bus bars
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = this.primaryColor;
    for (let i = 0; i < 6; i++) {
      const pulse = 0.35 + 0.65 * Math.max(0, Math.sin(time * 3.5 * this.pulseSpeed + i * 0.8));
      ctx.globalAlpha = pulse * 0.75;
      ctx.fillRect(216 + i * 12, 434, 7, 22);
    }

    ctx.globalAlpha = 1.0;
    this.texture.needsUpdate = true;
  }
}

/**
 * Builds the complete shared PBR material palette for the robot.
 */
export function createRobotMaterialSystem(envMap) {
  const { bumpTex } = createBrushedMetalTextures();
  const hexBump = createHexSkeletonTexture();
  const circuitSystem = new AnimatedCircuitTexture();
  const initTheme = COLOR_THEMES.cyber;

  const materials = {
    armorPrimary: new THREE.MeshPhysicalMaterial({
      color: initTheme.armorPrimary,
      metalness: 0.72,
      roughness: 0.27,
      clearcoat: 0.45,
      clearcoatRoughness: 0.18,
      bumpMap: bumpTex,
      bumpScale: 0.005,
      envMap,
      envMapIntensity: 0.92,
    }),

    armorSecondary: new THREE.MeshPhysicalMaterial({
      color: initTheme.armorSecondary,
      metalness: 0.82,
      roughness: 0.28,
      clearcoat: 0.35,
      clearcoatRoughness: 0.2,
      bumpMap: bumpTex,
      bumpScale: 0.005,
      envMap,
      envMapIntensity: 1.05,
    }),

    circuitArmor: new THREE.MeshPhysicalMaterial({
      color: initTheme.armorSecondary,
      metalness: 0.78,
      roughness: 0.25,
      clearcoat: 0.5,
      clearcoatRoughness: 0.16,
      bumpMap: bumpTex,
      bumpScale: 0.004,
      emissive: new THREE.Color('#ffffff'),
      emissiveMap: circuitSystem.texture,
      emissiveIntensity: 3.3,
      envMap,
      envMapIntensity: 1.0,
    }),

    innerFrame: new THREE.MeshStandardMaterial({
      color: initTheme.innerFrame,
      metalness: 0.88,
      roughness: 0.36,
      bumpMap: hexBump,
      bumpScale: 0.014,
      envMap,
      envMapIntensity: 1.05,
    }),

    jointGold: new THREE.MeshStandardMaterial({
      color: initTheme.jointGold,
      metalness: 0.95,
      roughness: 0.2,
      envMap,
      envMapIntensity: 1.15,
    }),

    chromeRod: new THREE.MeshStandardMaterial({
      color: 0xdce6f5,
      metalness: 1.0,
      roughness: 0.09,
      envMap,
      envMapIntensity: 1.2,
    }),

    copperCoil: new THREE.MeshStandardMaterial({
      color: 0xc96832,
      metalness: 0.94,
      roughness: 0.23,
      envMap,
      envMapIntensity: 1.15,
    }),

    darkRubber: new THREE.MeshStandardMaterial({
      color: 0x0f131c,
      metalness: 0.15,
      roughness: 0.78,
      bumpMap: hexBump,
      bumpScale: 0.015,
      envMap,
      envMapIntensity: 0.55,
    }),

    visorGlass: new THREE.MeshPhysicalMaterial({
      color: initTheme.visorTint,
      metalness: 0.08,
      roughness: 0.05,
      transparent: true,
      opacity: 0.34,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      reflectivity: 1.0,
      envMap,
      envMapIntensity: 1.65,
    }),

    neonPrimary: new THREE.MeshStandardMaterial({
      color: initTheme.neonPrimary,
      emissive: new THREE.Color(initTheme.neonPrimary),
      emissiveIntensity: 3.4,
      metalness: 0.2,
      roughness: 0.2,
    }),

    neonSecondary: new THREE.MeshStandardMaterial({
      color: initTheme.neonSecondary,
      emissive: new THREE.Color(initTheme.neonSecondary),
      emissiveIntensity: 3.2,
      metalness: 0.2,
      roughness: 0.2,
    }),
  };

  function applyTheme(themeKey) {
    const t = COLOR_THEMES[themeKey] || COLOR_THEMES.cyber;
    materials.armorPrimary.color.set(t.armorPrimary);
    materials.armorSecondary.color.set(t.armorSecondary);
    materials.circuitArmor.color.set(t.armorSecondary);
    materials.innerFrame.color.set(t.innerFrame);
    materials.jointGold.color.set(t.jointGold);
    materials.visorGlass.color.set(t.visorTint);

    materials.neonPrimary.color.set(t.neonPrimary);
    materials.neonPrimary.emissive.set(t.neonPrimary);

    materials.neonSecondary.color.set(t.neonSecondary);
    materials.neonSecondary.emissive.set(t.neonSecondary);

    circuitSystem.setColors(t.neonPrimary, t.neonSecondary);
    return t;
  }

  function update(elapsedTime) {
    circuitSystem.update(elapsedTime);
  }

  return {
    materials,
    circuitSystem,
    applyTheme,
    update,
  };
}
