import * as THREE from 'three';

// Reusable scratch math objects to keep per-frame allocations at zero
const _targetLocal = new THREE.Vector3();
const _poleLocal = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _bendDir = new THREE.Vector3();
const _midPos = new THREE.Vector3();
const _clampedTarget = new THREE.Vector3();
const _hingeAxis = new THREE.Vector3();
const _boneDir1 = new THREE.Vector3();
const _boneDir2 = new THREE.Vector3();
const _y1 = new THREE.Vector3();
const _z1 = new THREE.Vector3();
const _y2 = new THREE.Vector3();
const _z2 = new THREE.Vector3();
const _fallback = new THREE.Vector3();
const _mat1 = new THREE.Matrix4();
const _mat2 = new THREE.Matrix4();
const _qUpper = new THREE.Quaternion();
const _qLowerRoot = new THREE.Quaternion();
const _qParentWorld = new THREE.Quaternion();
const _vA = new THREE.Vector3();
const _vB = new THREE.Vector3();
const _vC = new THREE.Vector3();

/**
 * Analytical Two-Bone Inverse Kinematics Solver with Pole Target & Pure Hinge Axis.
 *
 * Convention:
 * - `rootMount` is the fixed socket on the parent body (e.g. hip socket on pelvis, shoulder socket on chest).
 * - `upperBone` is at local (0,0,0) inside `rootMount`, extending along -Y of length `L1`.
 * - `lowerBone` is at local (0,-L1,0) inside `upperBone`, extending along -Y of length `L2`.
 * - `endBone` is at local (0,-L2,0) inside `lowerBone`.
 * - `poleSign`: +1 when the pole is on the local +Z side at rest (knees),
 *               -1 when the pole is on the local -Z side at rest (elbows).
 */
export function solveTwoBoneIK({
  rootMount,
  upperBone,
  lowerBone,
  endBone,
  L1,
  L2,
  targetWorldPos,
  poleWorldPos,
  poleSign = 1,
  endWorldQuat = null,
  blend = 1.0,
}) {
  rootMount.updateWorldMatrix(true, false);

  _targetLocal.copy(targetWorldPos);
  rootMount.worldToLocal(_targetLocal);

  _poleLocal.copy(poleWorldPos);
  rootMount.worldToLocal(_poleLocal);

  const rawDist = _targetLocal.length();
  const minDist = Math.abs(L1 - L2) + 0.025;
  const maxDist = (L1 + L2) * 0.994;
  const d = THREE.MathUtils.clamp(rawDist, minDist, maxDist);

  if (rawDist < 1e-5) {
    _dir.set(0, -1, 0);
  } else {
    _dir.copy(_targetLocal).divideScalar(rawDist);
  }

  // Orthogonalize pole direction relative to target ray
  _bendDir.copy(_poleLocal).addScaledVector(_dir, -_poleLocal.dot(_dir));
  if (_bendDir.lengthSq() < 1e-6) {
    _fallback.set(0, 0, poleSign);
    _bendDir.copy(_fallback).addScaledVector(_dir, -_fallback.dot(_dir));
    if (_bendDir.lengthSq() < 1e-6) {
      _fallback.set(1, 0, 0);
      _bendDir.copy(_fallback).addScaledVector(_dir, -_fallback.dot(_dir));
    }
  }
  _bendDir.normalize();

  // Law of cosines for root interior angle alpha
  const cosAlpha = THREE.MathUtils.clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1);
  const sinAlpha = Math.sqrt(Math.max(0, 1 - cosAlpha * cosAlpha));

  // Middle joint (knee / elbow) position in rootMount space
  _midPos.copy(_dir).multiplyScalar(L1 * cosAlpha).addScaledVector(_bendDir, L1 * sinAlpha);
  _clampedTarget.copy(_dir).multiplyScalar(d);

  // Hinge axis (+X in rest pose) perpendicular to the IK bend plane
  // At rest: _dir = (0,-1,0), _bendDir * poleSign = (0,0,+1) => (-_dir) x (_bendDir*poleSign) = (+1,0,0)
  _vA.copy(_dir).negate();
  _vB.copy(_bendDir).multiplyScalar(poleSign);
  _hingeAxis.crossVectors(_vA, _vB).normalize();

  // Upper bone orthonormal basis in rootMount space
  _boneDir1.copy(_midPos).normalize();
  _y1.copy(_boneDir1).negate();
  _z1.crossVectors(_hingeAxis, _y1).normalize();
  _mat1.makeBasis(_hingeAxis, _y1, _z1);
  _qUpper.setFromRotationMatrix(_mat1);

  // Lower bone orthonormal basis in rootMount space
  _boneDir2.subVectors(_clampedTarget, _midPos).normalize();
  _y2.copy(_boneDir2).negate();
  _z2.crossVectors(_hingeAxis, _y2).normalize();
  _mat2.makeBasis(_hingeAxis, _y2, _z2);
  _qLowerRoot.setFromRotationMatrix(_mat2);

  // Convert lowerBone rotation from rootMount space into upperBone local space
  const qLowerLocal = _qUpper.clone().invert().multiply(_qLowerRoot);

  if (blend >= 0.999) {
    upperBone.quaternion.copy(_qUpper);
    lowerBone.quaternion.copy(qLowerLocal);
  } else {
    upperBone.quaternion.slerp(_qUpper, blend);
    lowerBone.quaternion.slerp(qLowerLocal, blend);
  }

  upperBone.updateWorldMatrix(false, true);

  if (endBone && endWorldQuat) {
    lowerBone.getWorldQuaternion(_qParentWorld);
    const qEndLocal = _qParentWorld.invert().multiply(endWorldQuat);
    if (blend >= 0.999) {
      endBone.quaternion.copy(qEndLocal);
    } else {
      endBone.quaternion.slerp(qEndLocal, blend);
    }
  }
}

/**
 * Interactive Debug Visualizer for IK Targets, Pole Vectors, and Bone Chains.
 */
export class IKDebugVisualizer {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);

    this.chains = [];
  }

  registerChain(name, colorHex = 0x00f5ff) {
    const targetMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      wireframe: true,
      depthTest: false,
    });
    const poleMat = new THREE.MeshBasicMaterial({
      color: 0xff2a85,
      depthTest: false,
    });

    const targetMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.065, 0), targetMat);
    targetMesh.renderOrder = 999;

    const poleMesh = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), poleMat);
    poleMesh.renderOrder = 999;

    const boneGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(),
      new THREE.Vector3(),
    ]);
    const boneLine = new THREE.Line(
      boneGeo,
      new THREE.LineBasicMaterial({ color: colorHex, depthTest: false, transparent: true, opacity: 0.9 })
    );
    boneLine.renderOrder = 998;

    const poleGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const poleLine = new THREE.Line(
      poleGeo,
      new THREE.LineBasicMaterial({ color: 0xff2a85, depthTest: false, transparent: true, opacity: 0.65 })
    );
    poleLine.renderOrder = 998;

    this.group.add(targetMesh, poleMesh, boneLine, poleLine);

    const entry = { name, targetMesh, poleMesh, boneLine, poleLine };
    this.chains.push(entry);
    return entry;
  }

  updateChain(entry, upperBone, lowerBone, endBone, targetWorldPos, poleWorldPos) {
    if (!this.group.visible) return;

    entry.targetMesh.position.copy(targetWorldPos);
    entry.poleMesh.position.copy(poleWorldPos);

    upperBone.getWorldPosition(_vA);
    lowerBone.getWorldPosition(_vB);
    endBone.getWorldPosition(_vC);

    const bPos = entry.boneLine.geometry.attributes.position;
    bPos.setXYZ(0, _vA.x, _vA.y, _vA.z);
    bPos.setXYZ(1, _vB.x, _vB.y, _vB.z);
    bPos.setXYZ(2, _vC.x, _vC.y, _vC.z);
    bPos.needsUpdate = true;

    const pPos = entry.poleLine.geometry.attributes.position;
    pPos.setXYZ(0, _vB.x, _vB.y, _vB.z);
    pPos.setXYZ(1, poleWorldPos.x, poleWorldPos.y, poleWorldPos.z);
    pPos.needsUpdate = true;
  }

  setVisible(visible) {
    this.group.visible = visible;
  }
}
