# UNIT K1-B0 // Interactive Cyberpunk Chibi Robot (Three.js)

An interactive 3D cyberpunk mecha companion built with **Three.js** and **Vite**, featuring cute chibi proportions, intricate mechanical joints, procedural PBR metals, animated neon PCB circuits, full-body two-bone inverse kinematics (IK), spring-damped cursor tracking, orbit controls, and selective HDR bloom.

## Features

- **Cute Chibi Mecha Chassis & Mechanical Joints**: Oversized curved-glass visor head, articulated cyber-ear servo antennas, spinning chest reactor turbine, dual-nozzle thruster backpack, 3-fingered articulated hands, Gunpla-style sliding knee shields, and **10 live telescoping hydraulic pistons** (neck, waist, elbows, knees, ankles).
- **Procedural PBR Metal & Animated Neon Circuits**: Custom `PMREMGenerator` cyberpunk reflection studio, brushed alloy & hex-weave bump maps, real-time data-packet PCB circuit traces, and 4 instant color specs (`Cyber`, `Ronin`, `Solar`, `Holo`).
- **Analytical 4-Limb Two-Bone IK Solver**: Quaternion two-bone IK with pole vectors and pure hinge-axis preservation, plus an optional live **IK Gizmo** debug overlay (`Show IK Gizmos`).
- **6 Kinematic Routines**: `Idle + Track`, `IK Strut` walk cycle, `Cyber Groove` dance, `Wave Hi!`, `IK Orb Reach` (interactive 3D cursor target orb), and jetpack `Overdrive` levitation.
- **Interactive Cursor Gaze & Click Reactions**:
  - Move cursor to drive layered OLED eye, head-tilt, and upper-torso tracking.
  - Click the **head** for a happy "boop" reaction (`^ ‿ ^` + hop), click the **chest core** for an overdrive surge, or click the **pedestal** for neon sonar ripples.
- **Selective MSAA HDR Bloom**: `4x` MSAA `EffectComposer` + `UnrealBloomPass` + `ACESFilmicToneMapping`.

## Getting Started

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
npm run preview
```
