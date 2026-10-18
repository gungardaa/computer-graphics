import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { STATION } from "./config.js";

export function loadGLB(url) {
  return new Promise((resolve, reject) => {
    new GLTFLoader().load(url, (gltf) => resolve(gltf.scene), undefined, reject);
  });
}

const lerp = THREE.MathUtils.lerp;

function fitModel(root, target) {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const scale = target / Math.max(size.x, size.y, size.z, 1e-6);
  root.scale.setScalar(scale);
  const center = box.getCenter(new THREE.Vector3()).multiplyScalar(scale);
  root.position.sub(center);
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      if (o.material) o.material.envMapIntensity = 0.9;
    }
  });
  return root;
}

function glowTexture(inner = "rgba(255,255,255,1)", mid = "rgba(255,255,255,0.35)") {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, mid);
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function fadeTexture(stops) {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (const [at, color] of stops) g.addColorStop(at, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function valueNoise(w, h, n) {
  const g = new Float32Array(n * n);
  for (let i = 0; i < g.length; i++) g[i] = Math.random();
  const out = new Float32Array(w * h);
  const s = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const fx = (x / w) * n;
      const fy = (y / h) * n;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const tx = s(fx - x0);
      const ty = s(fy - y0);
      const ix0 = x0 % n;
      const ix1 = (x0 + 1) % n;
      const iy0 = y0 % n;
      const iy1 = (y0 + 1) % n;
      out[y * w + x] = lerp(
        lerp(g[iy0 * n + ix0], g[iy0 * n + ix1], tx),
        lerp(g[iy1 * n + ix0], g[iy1 * n + ix1], tx),
        ty
      );
    }
  }
  return out;
}

function fbmTexture(w, h, seed, octaves = 4, bias = 0) {
  const layers = [];
  let amp = 1;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    layers.push({ data: valueNoise(w, h, 3 * (o + 1) + (seed % 7)), amp });
    total += amp;
    amp *= 0.5;
  }
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    let v = 0;
    for (const l of layers) v += l.data[i] * l.amp;
    v = Math.max(0, Math.min(1, v / total + bias));
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = Math.round(v * 255);
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

function buildTurret() {
  const hull = new THREE.MeshStandardMaterial({ color: 0x93a9c0, metalness: 0.85, roughness: 0.32 });
  const glow = new THREE.MeshStandardMaterial({
    color: 0x0a1420,
    emissive: 0x4df3ff,
    emissiveIntensity: 1.6,
    metalness: 0.4,
    roughness: 0.5,
  });
  const group = new THREE.Group();
  group.name = "DefenseSystem";
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.22, 20), hull);
  base.position.y = 0.11;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.028, 10, 36), glow);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.21;
  const yaw = new THREE.Group();
  yaw.position.y = 0.22;
  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.44), hull);
  housing.position.y = 0.15;
  const pitch = new THREE.Group();
  pitch.position.y = 0.3;
  const barrelGeo = new THREE.CylinderGeometry(0.05, 0.07, 1.0, 10);
  barrelGeo.rotateX(Math.PI / 2);
  barrelGeo.translate(0, 0, 0.52);
  const barrel = new THREE.Mesh(barrelGeo, hull);
  const tipGeo = new THREE.CylinderGeometry(0.054, 0.054, 0.14, 10);
  tipGeo.rotateX(Math.PI / 2);
  tipGeo.translate(0, 0, 1.02);
  const tip = new THREE.Mesh(tipGeo, glow);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0, 1.1);
  pitch.add(barrel, tip, muzzle);
  yaw.add(housing, pitch);
  group.add(base, ring, yaw);
  group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return { group, yaw, pitch, muzzle };
}

function atmosphereMaterial(color, strength) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uStrength: { value: strength } },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vWorld;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uStrength;
      varying vec3 vNormal;
      varying vec3 vWorld;
      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorld);
        float rim = pow(1.0 - abs(dot(normalize(vNormal), viewDir)), 3.0);
        gl_FragColor = vec4(uColor, rim * uStrength);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false,
  });
}

export function initScene({ canvas, models }) {
  /* preserveDrawingBuffer keeps headless screenshots reliable. */
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x040b18);
  scene.fog = new THREE.FogExp2(0x040b18, 0.0034);

  const cameraRig = new THREE.Group();
  scene.add(cameraRig);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);
  camera.position.set(0, 4.8, 19.6);
  camera.lookAt(0, 0.5, 0);
  cameraRig.add(camera);

  /* Environment light from a tiny procedural space room so PBR metal reads. */
  const envScene = new THREE.Scene();
  const envShell = new THREE.Mesh(
    new THREE.SphereGeometry(30, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: "varying vec3 vP; void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `
        varying vec3 vP;
        void main() {
          float h = clamp(vP.y / 30.0 * 0.5 + 0.5, 0.0, 1.0);
          vec3 top = vec3(0.03, 0.09, 0.19);
          vec3 bottom = vec3(0.01, 0.02, 0.05);
          gl_FragColor = vec4(mix(bottom, top, h), 1.0);
        }`,
    })
  );
  envScene.add(envShell);
  const envPlanet = new THREE.Mesh(
    new THREE.SphereGeometry(7, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0x1d4470 })
  );
  envPlanet.position.set(6, -10, -14);
  envScene.add(envPlanet);
  const envStars = new THREE.Points(
    new THREE.BufferGeometry().setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        new Array(120).fill(0).map(() => (Math.random() - 0.5) * 56),
        3
      )
    ),
    new THREE.PointsMaterial({ color: 0xbfe4ff, size: 2, sizeAttenuation: false })
  );
  envScene.add(envStars);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(envScene, 0.04).texture;
  pmrem.dispose();

  /* Lighting. Hemisphere ambient plus one shadow sun plus VFX point lights. */
  scene.add(new THREE.HemisphereLight(0x5f8fc0, 0x0a1424, 0.5));
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.6);
  sun.position.set(-16, 26, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 90 });
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  const rimLight = new THREE.DirectionalLight(0x4df3ff, 0.55);
  rimLight.position.set(10, -6, -18);
  scene.add(rimLight);

  /* Starfield, two pixel-size layers plus nebula sprites. */
  const glow = glowTexture();
  const ringTex = fadeTexture([
    [0, "rgba(255,255,255,0)"],
    [0.62, "rgba(255,255,255,0)"],
    [0.78, "rgba(255,255,255,1)"],
    [1, "rgba(255,255,255,0)"],
  ]);
  function stars(count, radius, size, tint) {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const base = new THREE.Color(tint);
    for (let i = 0; i < count; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(radius * (0.85 + Math.random() * 0.3));
      v.y = Math.abs(v.y) * (Math.random() < 0.75 ? 1 : -1);
      pos.set([v.x, v.y, v.z], i * 3);
      const c = base.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.35);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size,
      sizeAttenuation: false,
      map: glow,
      transparent: true,
      vertexColors: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    return points;
  }
  const starsNear = stars(1500, 90, 1.7, 0xdfeaff);
  const starsFar = stars(420, 130, 2.8, 0xffffff);
  scene.add(starsNear, starsFar);

  const nebula = new THREE.Group();
  const nebulaData = [
    [0x3b5bdb, 0.13, [-42, 26, -118], 150],
    [0x2fa8b8, 0.10, [58, 8, -132], 170],
    [0x7a4fd8, 0.09, [-8, -32, -110], 160],
  ];
  for (const [color, opacity, pos, scale] of nebulaData) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glow,
        color,
        opacity,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      })
    );
    sprite.position.set(...pos);
    sprite.scale.setScalar(scale);
    nebula.add(sprite);
  }
  scene.add(nebula);

  /* Planet with procedural texture, clouds and atmosphere rim. */
  const planetMat = new THREE.MeshStandardMaterial({
    color: 0x27506e,
    roughness: 0.92,
    metalness: 0.02,
    roughnessMap: fbmTexture(512, 256, 3, 5, 0.25),
  });
  const planet = new THREE.Mesh(new THREE.SphereGeometry(42, 64, 32), planetMat);
  planet.position.set(0, -54, -14);
  /* ponytail: distant station shadow lands 10+ units off on the planet, so no receiver. */
  planet.receiveShadow = false;
  scene.add(planet);

  const cloudTex = fbmTexture(512, 256, 11, 5, -0.12);
  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(42.5, 48, 24),
    new THREE.MeshStandardMaterial({
      color: 0xcfe4f5,
      transparent: true,
      opacity: 0.22,
      roughness: 1,
      metalness: 0,
      alphaMap: cloudTex,
      depthWrite: false,
    })
  );
  clouds.position.copy(planet.position);
  scene.add(clouds);

  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(43.6, 48, 24),
    atmosphereMaterial(0x4df3ff, 0.55)
  );
  atmosphere.position.copy(planet.position);
  scene.add(atmosphere);

  /* Station hierarchy. GLB modules under one group, turret nested inside.
     Clone before fitting so the raw models stay untouched for other users. */
  const station = new THREE.Group();
  station.name = "Station";
  const core = fitModel(models.base.clone(true), 3.0);
  core.name = "Core";
  const dome = fitModel(models.dome.clone(true), 1.0);
  dome.name = "Dome";
  dome.position.set(0, 1.0, 0.35);
  const wings = new THREE.Group();
  wings.name = "SolarWings";
  const panelL = fitModel(models.panel.clone(true), 1.7);
  panelL.position.set(-2.05, -0.7, 0.2);
  const panelR = fitModel(models.panel.clone(true), 1.7);
  panelR.position.set(2.05, -0.7, 0.2);
  panelR.rotation.y = Math.PI;
  wings.add(panelL, panelR);
  const armL = fitModel(models.arm.clone(true), 1.25);
  armL.rotation.z = Math.PI / 2;
  armL.position.set(-1.9, -0.95, 0.55);
  const armR = fitModel(models.arm.clone(true), 1.25);
  armR.rotation.z = Math.PI / 2;
  armR.position.set(1.9, -0.95, 0.55);
  const radarPivot = new THREE.Group();
  radarPivot.name = "RadarPivot";
  radarPivot.position.set(-0.55, 1.18, -0.35);
  const radar = fitModel(models.radar.clone(true), 0.7);
  radar.rotation.x = -0.75;
  radarPivot.add(radar);
  const turret = buildTurret();
  turret.group.scale.setScalar(1.6);
  turret.group.position.set(0.75, 0.95, 0.75);
  const shieldMat = atmosphereMaterial(0x4df3ff, 0.0);
  const shield = new THREE.Mesh(new THREE.SphereGeometry(STATION.shieldRadius, 40, 20), shieldMat);
  shield.name = "ShieldBubble";
  shield.visible = false;
  station.add(core, dome, wings, armL, armR, radarPivot, turret.group, shield);
  scene.add(station);

  /* Impact flash lights, pooled. */
  const flashLights = [];
  for (let i = 0; i < 3; i++) {
    const l = new THREE.PointLight(0x9fe9ff, 0, 14, 2);
    l.visible = false;
    scene.add(l);
    flashLights.push({ light: l, life: 0 });
  }
  function pulseLight(position, color, intensity, life) {
    const slot = flashLights.find((f) => f.life <= 0) || flashLights[0];
    slot.light.position.copy(position);
    slot.light.color.set(color);
    slot.light.intensity = intensity;
    slot.light.visible = true;
    slot.life = life;
    slot.maxLife = life;
    return slot;
  }

  /* Turret aiming state. */
  const aim = { target: null, hold: 0, yaw: 0, pitch: 0.3 };
  const REST_PITCH = 0.3;
  function lerpAngle(a, b, t) {
    const d = (((b - a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    return a + d * t;
  }
  const muzzleWorld = new THREE.Vector3();
  const yawWorld = new THREE.Vector3();
  const tmpDir = new THREE.Vector3();
  function aimAt(point) {
    turret.yaw.getWorldPosition(yawWorld);
    tmpDir.copy(point).sub(yawWorld);
    aim.target = { yaw: Math.atan2(tmpDir.x, tmpDir.z), pitch: Math.atan2(tmpDir.y, Math.hypot(tmpDir.x, tmpDir.z)) };
    aim.hold = 1.6;
  }

  /* Shield state. */
  const shieldState = { active: false, t: 0 };
  function setShield(active) {
    shieldState.active = active;
    shield.visible = active;
    shieldMat.uniforms.uStrength.value = active ? 0.9 : 0;
    shield.scale.setScalar(active ? 0.6 : 1);
  }

  /* Camera shake and pointer parallax. */
  const parallax = { x: 0, y: 0, tx: 0, ty: 0 };
  let shake = 0;
  function addShake(amount) {
    shake = Math.min(0.8, shake + amount);
  }
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const shieldRipplePos = new THREE.Vector3();
  function shieldPoint() {
    return shield.getWorldPosition(shieldRipplePos).setY(0);
  }

  let time = 0;
  function update(dt, realDt) {
    time += dt;
    planet.rotation.y += dt * 0.012;
    clouds.rotation.y += dt * 0.02;
    radarPivot.rotation.y += dt * 1.3;
    wings.rotation.z = Math.sin(time * 0.6) * 0.05;
    starsNear.material.opacity = 0.75 + Math.sin(time * 1.7) * 0.18;
    starsFar.material.opacity = 0.85 + Math.sin(time * 2.3 + 1) * 0.12;
    station.position.y = Math.sin(time * 0.5) * 0.08;

    aim.hold -= realDt;
    const desiredYaw = aim.target ? aim.target.yaw : 0;
    const desiredPitch = aim.target ? Math.max(-0.25, Math.min(1.35, aim.target.pitch)) : REST_PITCH;    if (aim.hold <= 0) aim.target = null;
    aim.yaw = lerpAngle(aim.yaw, desiredYaw, Math.min(1, 7 * dt));
    aim.pitch = lerp(aim.pitch, desiredPitch, Math.min(1, 9 * dt));
    turret.yaw.rotation.y = aim.yaw;
    turret.pitch.rotation.x = -aim.pitch;

    if (shieldState.active) {
      shieldState.t += dt;
      shieldMat.uniforms.uStrength.value = 0.7 + Math.sin(shieldState.t * 7) * 0.22;
      shield.scale.setScalar(lerp(shield.scale.x, 1 + Math.sin(shieldState.t * 5) * 0.012, Math.min(1, 8 * dt)));
    }

    for (const f of flashLights) {
      if (f.life > 0) {
        f.life -= realDt;
        f.light.intensity = Math.max(0, f.light.intensity) * Math.pow(0.0001, realDt);
        if (f.life <= 0) {
          f.light.visible = false;
          f.light.intensity = 0;
        }
      }
    }

    parallax.x = lerp(parallax.x, parallax.tx, Math.min(1, 4 * realDt));
    parallax.y = lerp(parallax.y, parallax.ty, Math.min(1, 4 * realDt));
    let sx = 0;
    let sy = 0;
    let roll = 0;
    if (shake > 0.002 && !reduced) {
      sx = (Math.random() - 0.5) * shake * 0.5;
      sy = (Math.random() - 0.5) * shake * 0.4;
      roll = (Math.random() - 0.5) * shake * 0.03;
      shake *= Math.pow(0.002, realDt);
    } else if (shake <= 0.002) {
      shake = 0;
    }
    cameraRig.position.set(parallax.x + sx, parallax.y + sy, 0);
    camera.rotation.z = roll;
  }

  function reset() {
    setShield(false);
    shieldState.t = 0;
    aim.yaw = 0;
    aim.pitch = REST_PITCH;
    aim.target = null;
    shake = 0;
    parallax.x = parallax.y = parallax.tx = parallax.ty = 0;
  }

  return {
    renderer,
    scene,
    camera,
    cameraRig,
    glow,
    ringTex,
    planet,
    station,
    shield,
    setShield,
    getShieldActive: () => shieldState.active,
    aimAt,
    aim: () => {
      turret.muzzle.getWorldPosition(muzzleWorld);
      return muzzleWorld.clone();
    },
    addShake,
    pulseLight,
    shieldPoint,
    setParallax: (x, y) => {
      parallax.tx = x * 0.9;
      parallax.ty = y * 0.55;
    },
    update,
    reset,
    resize(w, h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
  };
}
