import * as THREE from "three";

const PARTICLE_MAX = 900;
const SPRITE_MAX = 28;
const BEAM_MAX = 8;
const UP = new THREE.Vector3(0, 1, 0);

export function createEffects({ scene, glow, ringTex }) {
  /* One additive particle pool covers sparks, debris and trails. */
  const pPos = new Float32Array(PARTICLE_MAX * 3);
  const pCol = new Float32Array(PARTICLE_MAX * 3);
  const baseCol = new Float32Array(PARTICLE_MAX * 3);
  const vel = new Float32Array(PARTICLE_MAX * 3);
  const life = new Float32Array(PARTICLE_MAX);
  const maxLife = new Float32Array(PARTICLE_MAX);
  const drag = new Float32Array(PARTICLE_MAX);
  const gravity = new Float32Array(PARTICLE_MAX);
  let alive = 0;

  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
  pGeo.setDrawRange(0, 0);
  const points = new THREE.Points(
    pGeo,
    new THREE.PointsMaterial({
      size: 0.22,
      sizeAttenuation: true,
      map: glow,
      transparent: true,
      vertexColors: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  points.frustumCulled = false;
  scene.add(points);

  const tmpColor = new THREE.Color();
  function emit(x, y, z, vx, vy, vz, colorHex, lifeSec, dragK, gravityK) {
    if (alive >= PARTICLE_MAX) return;
    const i = alive++;
    pPos.set([x, y, z], i * 3);
    vel.set([vx, vy, vz], i * 3);
    tmpColor.set(colorHex);
    const bright = 0.65 + Math.random() * 0.35;
    baseCol.set([tmpColor.r * bright, tmpColor.g * bright, tmpColor.b * bright], i * 3);
    pCol.set([tmpColor.r * bright, tmpColor.g * bright, tmpColor.b * bright], i * 3);
    life[i] = lifeSec;
    maxLife[i] = lifeSec;
    drag[i] = dragK;
    gravity[i] = gravityK;
  }

  const scatter = new THREE.Vector3();
  function burst(pos, opts) {
    const {
      count = 24,
      colors = [0xffc48a],
      speed = [1.5, 5],
      life: lifeRange = [0.35, 0.8],
      drag: dragK = 0.05,
      gravity = 0,
      dir = null,
      spread = 1,
    } = opts;
    for (let i = 0; i < count; i++) {
      scatter.randomDirection();
      if (dir) scatter.multiplyScalar(spread).add(dir).normalize();
      const s = speed[0] + Math.random() * (speed[1] - speed[0]);
      emit(
        pos.x, pos.y, pos.z,
        scatter.x * s, scatter.y * s, scatter.z * s,
        colors[(Math.random() * colors.length) | 0],
        lifeRange[0] + Math.random() * (lifeRange[1] - lifeRange[0]),
        dragK, gravity
      );
    }
  }

  function trail(pos, colorHex, lifeSec = 0.45) {
    emit(
      pos.x + (Math.random() - 0.5) * 0.3,
      pos.y + (Math.random() - 0.5) * 0.3,
      pos.z + (Math.random() - 0.5) * 0.3,
      (Math.random() - 0.5) * 0.3, 0.1, (Math.random() - 0.5) * 0.3,
      colorHex, lifeSec, 0.12, 0
    );
  }

  /* Sprite flashes and expanding rings. */
  const sprites = [];
  for (let i = 0; i < SPRITE_MAX; i++) {
    const mat = new THREE.SpriteMaterial({
      map: glow,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.visible = false;
    scene.add(sprite);
    sprites.push({ sprite, life: 0, maxLife: 1, s0: 1, s1: 1, fade: 1 });
  }

  function sprite(kind, pos, colorHex, s0, s1, lifeSec, fade = 1) {
    const slot = sprites.find((s) => s.life <= 0);
    if (!slot) return;
    slot.sprite.material.map = kind === "ring" ? ringTex : glow;
    slot.sprite.material.color.set(colorHex);
    slot.sprite.position.copy(pos);
    slot.life = lifeSec;
    slot.maxLife = lifeSec;
    slot.s0 = s0;
    slot.s1 = s1;
    slot.fade = fade;
    slot.sprite.visible = true;
    slot.sprite.scale.setScalar(s0);
  }
  const flash = (pos, colorHex, s0, s1, lifeSec) => sprite("flash", pos, colorHex, s0, s1, lifeSec, 1);
  const ring = (pos, colorHex, s0, s1, lifeSec, fade = 0.9) => sprite("ring", pos, colorHex, s0, s1, lifeSec, fade);

  /* Beam pool, a stretched additive cylinder per shot. */
  const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
  const beams = [];
  for (let i = 0; i < BEAM_MAX; i++) {
    const mesh = new THREE.Mesh(
      beamGeo,
      new THREE.MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      })
    );
    mesh.visible = false;
    scene.add(mesh);
    beams.push({ mesh, life: 0, maxLife: 1 });
  }
  const mid = new THREE.Vector3();
  const dirV = new THREE.Vector3();
  function beam(from, to, colorHex, radius, lifeSec) {
    const slot = beams.find((b) => b.life <= 0) || beams[0];
    mid.copy(from).lerp(to, 0.5);
    dirV.copy(to).sub(from);
    const len = dirV.length();
    if (len < 0.001) return;
    dirV.normalize();
    slot.mesh.position.copy(mid);
    slot.mesh.quaternion.setFromUnitVectors(UP, dirV);
    slot.mesh.scale.set(radius, len, radius);
    slot.mesh.material.color.set(colorHex);
    slot.life = lifeSec;
    slot.maxLife = lifeSec;
    slot.mesh.visible = true;
  }

  function update(dt) {
    for (let i = 0; i < alive; i++) {
      life[i] -= dt;
      if (life[i] <= 0) {
        const last = --alive;
        if (i !== last) {
          pPos.copyWithin(i * 3, last * 3, last * 3 + 3);
          pCol.copyWithin(i * 3, last * 3, last * 3 + 3);
          baseCol.copyWithin(i * 3, last * 3, last * 3 + 3);
          vel.copyWithin(i * 3, last * 3, last * 3 + 3);
          life[i] = life[last];
          maxLife[i] = maxLife[last];
          drag[i] = drag[last];
          gravity[i] = gravity[last];
          i--;
        }
        continue;
      }
      const d = Math.pow(drag[i], dt);
      vel[i * 3] *= d;
      vel[i * 3 + 1] = vel[i * 3 + 1] * d - gravity[i] * dt;
      vel[i * 3 + 2] *= d;
      pPos[i * 3] += vel[i * 3] * dt;
      pPos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pPos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      const f = life[i] / maxLife[i];
      const fade = f * f;
      pCol[i * 3] = baseCol[i * 3] * fade;
      pCol[i * 3 + 1] = baseCol[i * 3 + 1] * fade;
      pCol[i * 3 + 2] = baseCol[i * 3 + 2] * fade;
    }
    pGeo.setDrawRange(0, alive);
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.color.needsUpdate = true;

    for (const s of sprites) {
      if (s.life <= 0) continue;
      s.life -= dt;
      if (s.life <= 0) {
        s.sprite.visible = false;
        continue;
      }
      const t = 1 - s.life / s.maxLife;
      s.sprite.scale.setScalar(s.s0 + (s.s1 - s.s0) * t);
      s.sprite.material.opacity = Math.pow(s.life / s.maxLife, s.fade);
    }

    for (const b of beams) {
      if (b.life <= 0) continue;
      b.life -= dt;
      if (b.life <= 0) {
        b.mesh.visible = false;
        continue;
      }
      b.mesh.material.opacity = Math.pow(b.life / b.maxLife, 0.5);
    }
  }

  return { burst, trail, flash, ring, beam, update };
}
