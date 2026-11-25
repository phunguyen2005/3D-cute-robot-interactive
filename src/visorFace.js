import * as THREE from 'three';

/**
 * Procedural high-definition OLED Visor Face Renderer.
 * Draws expressive cyberpunk chibi eyes, cursor-tracking pupil shifts,
 * blinks, rosy holographic cheek bars, CRT scanlines, and micro-telemetry.
 */
export class VisorFaceController {
  constructor() {
    this.width = 1024;
    this.height = 512;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx = this.canvas.getContext('2d');

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;

    this.primaryColor = '#00f5ff';
    this.secondaryColor = '#ff2a85';

    // Mode: 'auto' | 'happy' | 'love' | 'curious' | 'focused' | 'glitch'
    this.mode = 'auto';
    this.activeAutoExpr = 'normal';
    this.autoTimer = 3.5;

    // Temporary override reaction (e.g. head boop!)
    this.reactionExpr = null;
    this.reactionTimer = 0;

    // Blink state machine
    this.blinkProgress = 0; // 0 = open, 1 = closed
    this.isBlinking = false;
    this.blinkPhase = 0;
    this.nextBlinkIn = 2.4;

    // Normalized gaze offset [-1, 1]
    this.gazeX = 0;
    this.gazeY = 0;
    this.smoothGazeX = 0;
    this.smoothGazeY = 0;

    this.update(0, 0.016);
  }

  setColors(primary, secondary) {
    this.primaryColor = primary;
    this.secondaryColor = secondary;
  }

  setMode(mode) {
    this.mode = mode;
  }

  triggerBoop() {
    this.reactionExpr = 'boop';
    this.reactionTimer = 2.1;
  }

  setGaze(nx, ny) {
    this.gazeX = THREE.MathUtils.clamp(nx, -1, 1);
    this.gazeY = THREE.MathUtils.clamp(ny, -1, 1);
  }

  update(time, dt) {
    // Smooth eye saccade/tracking
    const ease = 1 - Math.exp(-16 * dt);
    this.smoothGazeX += (this.gazeX - this.smoothGazeX) * ease;
    this.smoothGazeY += (this.gazeY - this.smoothGazeY) * ease;

    // Reaction timer
    if (this.reactionTimer > 0) {
      this.reactionTimer -= dt;
      if (this.reactionTimer <= 0) {
        this.reactionExpr = null;
      }
    }

    // Blink state machine
    this.nextBlinkIn -= dt;
    if (this.nextBlinkIn <= 0 && !this.isBlinking) {
      this.isBlinking = true;
      this.blinkPhase = 0;
      // Occasional cute double-blink!
      this.nextBlinkIn = Math.random() < 0.22 ? 0.32 : 2.2 + Math.random() * 3.4;
    }

    if (this.isBlinking) {
      this.blinkPhase += dt * 11.5;
      if (this.blinkPhase >= Math.PI) {
        this.isBlinking = false;
        this.blinkProgress = 0;
      } else {
        this.blinkProgress = Math.sin(this.blinkPhase);
      }
    }

    // Auto expression subtle variety
    if (this.mode === 'auto') {
      this.autoTimer -= dt;
      if (this.autoTimer <= 0) {
        const pool = ['normal', 'normal', 'normal', 'happy', 'curious'];
        this.activeAutoExpr = pool[Math.floor(Math.random() * pool.length)];
        this.autoTimer = this.activeAutoExpr === 'normal' ? 3.5 + Math.random() * 3.5 : 1.9 + Math.random() * 1.2;
      }
    }

    const expr = this.reactionExpr
      ? this.reactionTimer > 1.65
        ? 'surprised'
        : 'happy'
      : this.mode === 'auto'
      ? this.activeAutoExpr
      : this.mode;

    this.draw(expr, time);
    this.texture.needsUpdate = true;
  }

  draw(expr, time) {
    const { ctx, width: w, height: h } = this;

    // Deep OLED screen background
    ctx.fillStyle = '#03060d';
    ctx.fillRect(0, 0, w, h);

    // Subtle recessed visor vignette glow
    const bgGrad = ctx.createRadialGradient(w * 0.5, h * 0.52, 30, w * 0.5, h * 0.52, w * 0.52);
    bgGrad.addColorStop(0, 'rgba(0, 245, 255, 0.09)');
    bgGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    const shiftX = this.smoothGazeX * 56;
    const shiftY = -this.smoothGazeY * 34;

    const leftEyeX = w * 0.33 + shiftX;
    const rightEyeX = w * 0.67 + shiftX;
    const eyeY = h * 0.5 + shiftY;

    const glitchOffset = expr === 'glitch' ? (Math.random() - 0.5) * 18 : 0;

    ctx.save();
    ctx.shadowColor = this.primaryColor;
    ctx.shadowBlur = 28;
    ctx.fillStyle = this.primaryColor;
    ctx.strokeStyle = this.primaryColor;

    if (expr === 'happy') {
      this.drawHappyArc(leftEyeX, eyeY, 76);
      this.drawHappyArc(rightEyeX, eyeY, 76);
      this.drawCuteMouth(w * 0.5 + shiftX * 0.65, eyeY + 74, 'smile');
      this.drawCheekBlush(leftEyeX - 82, rightEyeX + 82, eyeY + 62, 0.9);
    } else if (expr === 'love') {
      const pulse = 1 + Math.sin(time * 7.5) * 0.08;
      ctx.shadowColor = this.secondaryColor;
      ctx.fillStyle = this.secondaryColor;
      this.drawHeart(leftEyeX, eyeY, 72 * pulse);
      this.drawHeart(rightEyeX, eyeY, 72 * pulse);
      this.drawCuteMouth(w * 0.5 + shiftX * 0.65, eyeY + 76, 'cat');
      this.drawCheekBlush(leftEyeX - 82, rightEyeX + 82, eyeY + 62, 1.0);
    } else if (expr === 'focused') {
      this.drawPillEye(leftEyeX, eyeY + 6, 68, 78 * (1 - this.blinkProgress * 0.9), 0.26);
      this.drawPillEye(rightEyeX, eyeY + 6, 68, 78 * (1 - this.blinkProgress * 0.9), -0.26);
      this.drawTargetBrackets(leftEyeX, rightEyeX, eyeY);
    } else if (expr === 'curious') {
      this.drawPillEye(leftEyeX, eyeY + 4, 68, 62 * (1 - this.blinkProgress * 0.9), -0.1);
      this.drawPillEye(rightEyeX, eyeY - 4, 74, 96 * (1 - this.blinkProgress * 0.9), 0.08);
      this.drawCuteMouth(w * 0.5 + shiftX * 0.6, eyeY + 78, 'o');
      // Floating '?' glyph
      ctx.font = 'bold 46px "JetBrains Mono", monospace';
      ctx.fillStyle = this.secondaryColor;
      ctx.shadowColor = this.secondaryColor;
      ctx.fillText('?', rightEyeX + 95, eyeY - 52 + Math.sin(time * 6) * 6);
    } else if (expr === 'surprised') {
      this.drawRingEye(leftEyeX, eyeY, 64);
      this.drawRingEye(rightEyeX, eyeY, 64);
      this.drawCuteMouth(w * 0.5 + shiftX * 0.6, eyeY + 78, 'o');
      this.drawCheekBlush(leftEyeX - 84, rightEyeX + 84, eyeY + 64, 0.85);
    } else if (expr === 'glitch') {
      // Chromatic aberration twin pass
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#ff2a85';
      ctx.shadowColor = '#ff2a85';
      this.drawPillEye(leftEyeX - 9 + glitchOffset, eyeY, 68, 86, 0);
      this.drawPillEye(rightEyeX - 9 - glitchOffset, eyeY, 68, 86, 0);

      ctx.fillStyle = '#00f5ff';
      ctx.shadowColor = '#00f5ff';
      this.drawPillEye(leftEyeX + 9, eyeY + (Math.random() - 0.5) * 8, 68, 86, 0);
      this.drawPillEye(rightEyeX + 9, eyeY + (Math.random() - 0.5) * 8, 68, 86, 0);
      ctx.globalCompositeOperation = 'source-over';

      ctx.font = '700 24px "JetBrains Mono", monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('SYNC // OVERLOAD', w * 0.5 - 115, h - 46);
    } else {
      // Default adorable rounded chibi LED eyes
      const openFactor = Math.max(0.07, 1 - this.blinkProgress * 0.95);
      const breathe = 1 + Math.sin(time * 2.8) * 0.025;
      this.drawPillEye(leftEyeX, eyeY, 72 * breathe, 94 * openFactor * breathe, 0);
      this.drawPillEye(rightEyeX, eyeY, 72 * breathe, 94 * openFactor * breathe, 0);
      this.drawCheekBlush(leftEyeX - 84, rightEyeX + 84, eyeY + 66, 0.42);
      this.drawCuteMouth(w * 0.5 + shiftX * 0.6, eyeY + 76, 'tiny');
    }

    ctx.restore();

    // Corner micro-HUD telemetry details
    ctx.save();
    ctx.fillStyle = this.primaryColor;
    ctx.globalAlpha = 0.48;
    ctx.font = '600 18px "JetBrains Mono", monospace';
    ctx.fillText('OPTIC_V4.2', 58, 62);
    ctx.fillText(`GAZE ${this.smoothGazeX.toFixed(2)}`, w - 188, 62);

    // Mini equalizer bars bottom-left
    for (let i = 0; i < 6; i++) {
      const barH = 6 + Math.abs(Math.sin(time * 5.2 + i * 1.1)) * 16;
      ctx.fillRect(60 + i * 11, h - 44 - barH, 7, barH);
    }
    ctx.restore();

    // Crisp horizontal OLED scanline overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
    for (let y = 0; y < h; y += 6) {
      ctx.fillRect(0, y, w, 2);
    }
  }

  drawPillEye(cx, cy, rw, rh, browTilt = 0) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(cx, cy);

    // Rounded pill eye
    const r = Math.min(rw, rh) * 0.88;
    ctx.beginPath();
    ctx.roundRect(-rw, -rh, rw * 2, rh * 2, r);
    ctx.fill();

    // Bright white-hot inner core for realistic LED luminance gradient
    if (rh > 18) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
      ctx.beginPath();
      ctx.arc(rw * 0.3 + this.smoothGazeX * 8, -rh * 0.34, Math.min(20, rh * 0.24), 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.beginPath();
      ctx.arc(-rw * 0.34, rh * 0.34, Math.min(10, rh * 0.13), 0, Math.PI * 2);
      ctx.fill();
    }

    // Optional angled brow mask for focused / curious expressions
    if (Math.abs(browTilt) > 0.01) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#03060d';
      ctx.rotate(browTilt);
      ctx.fillRect(-rw * 1.4, -rh * 1.55, rw * 2.8, rh * 0.95);
    }

    ctx.restore();
  }

  drawHappyArc(cx, cy, radius) {
    const { ctx } = this;
    ctx.save();
    ctx.lineWidth = 22;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy + 24, radius, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(cx, cy + 24, radius, Math.PI * 1.22, Math.PI * 1.78);
    ctx.stroke();
    ctx.restore();
  }

  drawRingEye(cx, cy, radius) {
    const { ctx } = this;
    ctx.save();
    ctx.lineWidth = 20;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawHeart(cx, cy, size) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(cx, cy - size * 0.18);
    ctx.beginPath();
    ctx.moveTo(0, size * 0.35);
    ctx.bezierCurveTo(0, -size * 0.15, -size, -size * 0.15, -size, size * 0.35);
    ctx.bezierCurveTo(-size, size * 0.82, 0, size * 1.08, 0, size * 1.32);
    ctx.bezierCurveTo(0, size * 1.08, size, size * 0.82, size, size * 0.35);
    ctx.bezierCurveTo(size, -size * 0.15, 0, -size * 0.15, 0, size * 0.35);
    ctx.fill();
    ctx.restore();
  }

  drawCheekBlush(leftX, rightX, y, alpha) {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = this.secondaryColor;
    ctx.shadowColor = this.secondaryColor;
    ctx.shadowBlur = 16;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';

    [leftX, rightX].forEach((bx) => {
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(bx + i * 16 - 8, y + 12);
        ctx.lineTo(bx + i * 16 + 8, y - 12);
        ctx.stroke();
      }
    });
    ctx.restore();
  }

  drawCuteMouth(cx, cy, style) {
    const { ctx } = this;
    ctx.save();
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.strokeStyle = this.primaryColor;
    if (style === 'smile') {
      ctx.beginPath();
      ctx.arc(cx, cy - 10, 26, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    } else if (style === 'cat') {
      ctx.beginPath();
      ctx.arc(cx - 16, cy - 6, 16, 0.1 * Math.PI, 0.95 * Math.PI);
      ctx.arc(cx + 16, cy - 6, 16, 0.05 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
    } else if (style === 'o') {
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(cx, cy - 8, 16, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawTargetBrackets(lx, rx, y) {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = this.secondaryColor;
    ctx.shadowColor = this.secondaryColor;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 5;
    [lx, rx].forEach((cx) => {
      const s = 96;
      // Top-left & bottom-right HUD reticle corners
      ctx.beginPath();
      ctx.moveTo(cx - s, y - s + 24);
      ctx.lineTo(cx - s, y - s);
      ctx.lineTo(cx - s + 24, y - s);
      ctx.moveTo(cx + s, y + s - 24);
      ctx.lineTo(cx + s, y + s);
      ctx.lineTo(cx + s - 24, y + s);
      ctx.stroke();
    });
    ctx.restore();
  }
}
