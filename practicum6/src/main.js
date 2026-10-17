/* Nama: Anak Agung Putu Arda Nareswara
NRP: 5025241074
Kelas: B */

import * as THREE from "three";
import "./style.css";

const $ = (id) => document.getElementById(id);
const CALM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const f2 = (n) => (n < 0 ? "-" : "") + Math.abs(n).toFixed(2).replace("-", "");

function row(el, k, v) {
  const d = document.createElement("div");
  d.className = "data-line";
  const s = document.createElement("span");
  s.textContent = k;
  const b = document.createElement("b");
  b.textContent = v;
  d.append(s, b);
  el.append(d);
}

function rows(el, pairs) {
  el.replaceChildren();
  for (const [k, v] of pairs) row(el, k, v);
}

function onBtn(id, fn) {
  $(id).addEventListener("click", fn);
}

function onSelect(id, fn) {
  const el = $(id);
  el.addEventListener("change", () => fn(el.value));
}

// Upgrade to container observers if canvases ever go fluid.
const RIGS = [];
let fps = 60;

function mkRenderer(canvas) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true });
  r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  r.setSize(canvas.width, canvas.height, false);
  r.shadowMap.enabled = true;
  return r;
}

function stdCamera(scene, canvas) {
  const c = new THREE.PerspectiveCamera(60, canvas.width / canvas.height, 0.1, 100);
  c.position.set(4, 3, 6);
  c.lookAt(0, 0.5, 0);
  scene.add(c);
  return c;
}

function stdLights(scene) {
  const amb = new THREE.AmbientLight(0xffffff, 0.35);
  scene.add(amb);
  const dir = new THREE.DirectionalLight(0xffffff, 2.0);
  dir.position.set(3, 5, 2);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024);
  Object.assign(dir.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 0.5, far: 20 });
  scene.add(dir);
  return { amb, dir };
}

function stdGround(scene, color = 0x334155) {
  const g = new THREE.PlaneGeometry(10, 10);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color }));
  m.receiveShadow = true;
  scene.add(m);
  const grid = new THREE.GridHelper(10, 10, 0x4df3ff, 0x1e3a5f);
  grid.position.y = 0.02;
  scene.add(grid);
  return m;
}

function fitCanvas(rig) {
  const w = rig.canvas.clientWidth || rig.canvas.width;
  const h = rig.canvas.clientHeight || rig.canvas.height;
  rig.renderer.setSize(w, h, false);
  return { w, h };
}

function watch(rig) {
  rig.visible = true;
  new IntersectionObserver(([e]) => (rig.visible = e.isIntersecting)).observe(rig.canvas);
  RIGS.push(rig);
}

/* ---------------- STAGE ---------------- */
const stage = (() => {
  const canvas = $("glMain");
  const renderer = mkRenderer(canvas);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1020);
  const camera = stdCamera(scene, canvas);
  scene.add(camera);

  const cubeGeo = new THREE.BoxGeometry(1, 1, 1);
  console.log(cubeGeo);
  console.log(cubeGeo.attributes);
  console.log("Cube position count", cubeGeo.attributes.position.count);
  console.log(cubeGeo.index);

  const basicMat = new THREE.MeshBasicMaterial({ color: 0x00aaff });
  const lambertMat = new THREE.MeshLambertMaterial({ color: 0x22d3ee });
  const phongMat = new THREE.MeshPhongMaterial({ color: 0x4488ff, shininess: 60 });
  const normalMat = new THREE.MeshNormalMaterial();

  const cube = new THREE.Mesh(cubeGeo, lambertMat);
  cube.position.set(-1.2, 0.6, 0);
  cube.castShadow = true;
  scene.add(cube);

  let sphereGeo = new THREE.SphereGeometry(0.7, 32, 16);
  const sphere = new THREE.Mesh(sphereGeo, phongMat);
  sphere.position.set(1.4, 0.75, 0);
  sphere.castShadow = true;
  scene.add(sphere);

  const ground = stdGround(scene);
  const { amb, dir } = stdLights(scene);

  const S = {
    seg: "med", cubeMat: "lambert", normalSph: false, lights: true,
    useDelta: true, projFix: true, paused: CALM,
    spinX: 0, spinY: 0, manRY: 0.8, fps,
  };

  const SEGS = { low: [8, 6], med: [32, 16], high: [64, 32] };
  function setSeg(name) {
    S.seg = name;
    const [ws, hs] = SEGS[name];
    sphereGeo.dispose();
    sphereGeo = new THREE.SphereGeometry(0.7, ws, hs);
    sphere.geometry = sphereGeo;
    console.log("Sphere position count", sphereGeo.attributes.position.count);
  }
  setSeg("med");

  const bindRange = (id, fn) => {
    const el = $(id);
    const out = $(id + "Val");
    const sync = () => { out.textContent = f2(+el.value); fn(+el.value); };
    el.addEventListener("input", sync);
    sync();
    return { el, sync };
  };
  bindRange("sPX", (v) => (cube.position.x = v));
  bindRange("sRY", (v) => (S.manRY = v));
  bindRange("sSY", (v) => cube.scale.set(1, v, 1));
  const rDir = bindRange("sDir", (v) => (dir.intensity = v));
  const rAmb = bindRange("sAmb", (v) => (amb.intensity = v));

  onSelect("selSeg", (v) => setSeg(v));
  onSelect("selCMat", (v) => {
    S.cubeMat = v;
    cube.material = v === "basic" ? basicMat : lambertMat;
    $("teleMat").textContent = v === "basic" ? "Basic" : "Lambert";
  });
  onSelect("selFov", (v) => {
    camera.fov = +v;
    camera.updateProjectionMatrix();
  });
  onSelect("selDir", (v) => {
    dir.intensity = +v;
    rDir.el.value = v;
    rDir.sync();
  });

  const tgl = (id, get, set) => onBtn(id, () => { set(!get()); $(id).classList.toggle("active", get()); });
  tgl("btnNormal", () => S.normalSph, (v) => {
    S.normalSph = v;
    sphere.material = v ? normalMat : phongMat;
    $("btnNormal").textContent = v ? "Sphere. Normal" : "Sphere. Phong";
  });
  tgl("btnLight", () => S.lights, (v) => {
    S.lights = v;
    amb.visible = dir.visible = v;
    $("btnLight").textContent = v ? "Lights. On" : "Lights. Off";
  });
  tgl("btnDelta", () => S.useDelta, (v) => {
    S.useDelta = v;
    $("btnDelta").textContent = v ? "Delta. On" : "Delta. Off";
  });
  tgl("btnProj", () => S.projFix, (v) => {
    S.projFix = v;
    $("btnProj").textContent = v ? "Aspect. On" : "Aspect. Off";
  });
  tgl("btnPause", () => !S.paused, (v) => {
    S.paused = !v;
    $("btnPause").textContent = v ? "Pause" : "Resume";
  });
  tgl("btnShRen", () => renderer.shadowMap.enabled, (v) => {
    renderer.shadowMap.enabled = v;
    $("btnShRen").textContent = v ? "Shadow. On" : "Shadow. Off";
    scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  });
  tgl("btnShCast", () => cube.castShadow, (v) => {
    cube.castShadow = sphere.castShadow = v;
    $("btnShCast").textContent = v ? "Casters. On" : "Casters. Off";
  });
  tgl("btnShRecv", () => ground.receiveShadow, (v) => {
    ground.receiveShadow = v;
    $("btnShRecv").textContent = v ? "Ground. On" : "Ground. Off";
  });

  canvas.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !e.repeat) { e.preventDefault(); $("btnPause").click(); }
  });

  const rig = {
    canvas, renderer, scene, cam: () => camera, visible: true,
    resize() {
      const w = canvas.clientWidth || canvas.width;
      const h = canvas.clientHeight || canvas.height;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      if (S.projFix) camera.updateProjectionMatrix();
    },
    update(d) {
      const step = S.useDelta ? d : 0.01;
      if (!S.paused) {
        S.spinX += 0.35 * step;
        S.spinY += 0.8 * step;
        sphere.rotation.y += 0.5 * step;
      }
      cube.rotation.set(S.spinX, S.spinY + S.manRY, 0);
      sphere.position.y = 0.75 + Math.sin(perfT * 2) * 0.15;
      const n = scene.children.length;
      const p = camera.position;
      $("hudMain").textContent = `Objs ${n} · Cam ${f2(p.x)} ${f2(p.y)} ${f2(p.z)}`;
      rows($("dataMain"), [
        ["Objects", n],
        ["Verts sphere", sphereGeo.attributes.position.count],
        ["Cube mat", S.cubeMat],
        ["Sphere mat", S.normalSph ? "Normal" : "Phong"],
        ["Dir lite", f2(dir.intensity)],
        ["Amb lite", f2(amb.intensity)],
        ["FOV", Math.round(camera.fov)],
        ["Clock", S.useDelta ? "delta" : "fixed"],
        ["FPS", Math.round(fps)],
      ]);
      $("teleVerts").textContent = sphereGeo.attributes.position.count;
      $("teleMat").textContent = S.cubeMat === "basic" ? "Basic" : "Lambert";
      $("teleLight").textContent = S.lights ? `Dir ${f2(dir.intensity)}` : "off";
      $("teleCam").textContent = `FOV ${Math.round(camera.fov)}`;
    },
  };
  watch(rig);
  return { S, rig };
})();

/* ---------------- helpers for small labs ---------------- */
function miniLab(id, build) {
  const canvas = $(id);
  const renderer = mkRenderer(canvas);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1020);
  const camera = stdCamera(scene, canvas);
  const ctx = build(scene, camera, renderer, canvas) || {};
  const rig = {
    canvas, renderer, scene, cam: () => ctx.cam || camera, visible: true,
    resize() {
      const { w, h } = fitCanvas(rig);
      for (const c of ctx.cams || [ctx.cam || camera]) { c.aspect = w / h; c.updateProjectionMatrix(); }
    },
    update(d, e) { ctx.update?.(d, e); },
  };
  watch(rig);
  return ctx;
}

/* A. extra geometry */
miniLab("glA", (scene) => {
  stdGround(scene);
  stdLights(scene);
  const mk = (geo, color, x, phong) => {
    const m = new THREE.Mesh(geo, phong
      ? new THREE.MeshPhongMaterial({ color, shininess: 60 })
      : new THREE.MeshLambertMaterial({ color }));
    m.position.set(x, 0.55, 0);
    m.castShadow = true;
    scene.add(m);
    return m;
  };
  const a = mk(new THREE.CylinderGeometry(0.5, 0.5, 1, 24), 0x22d3ee, -1.8);
  const b = mk(new THREE.ConeGeometry(0.6, 1, 24), 0x4488ff, 0, true);
  const c = mk(new THREE.TorusGeometry(0.45, 0.18, 16, 32), 0x94a3b8, 1.8);
  return {
    update(d) {
      a.rotation.y += 0.6 * d;
      b.rotation.y += 0.8 * d;
      c.rotation.x += 0.5 * d;
      $("hudA").textContent = "3 meshes · 1024 map";
      rows($("dataA"), [["Meshes", 3], ["Spin", "on"], ["Shadow", "on"]]);
    },
  };
});

/* B. material gallery */
miniLab("glB", (scene) => {
  const { amb, dir } = stdLights(scene);
  stdGround(scene);
  const g = new THREE.SphereGeometry(0.55, 24, 16);
  const mats = [
    new THREE.MeshBasicMaterial({ color: 0x00aaff }),
    new THREE.MeshNormalMaterial(),
    new THREE.MeshLambertMaterial({ color: 0x22d3ee }),
    new THREE.MeshPhongMaterial({ color: 0x4488ff, shininess: 60 }),
  ];
  const names = ["Basic", "Normal", "Lambert", "Phong"];
  mats.forEach((m, i) => {
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(-2.1 + i * 1.4, 0.6, 0);
    mesh.castShadow = true;
    scene.add(mesh);
  });
  return {
    update(d) {
      $("hudB").textContent = "Basic Normal Lambert Phong";
      rows($("dataB"), names.map((n, i) => [`Slot ${i + 1}`, n]));
      void amb; void dir;
    },
  };
});

/* C. ortho toggle */
miniLab("glC", (scene, camera, renderer, canvas) => {
  const ground = stdGround(scene);
  stdLights(scene);
  const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0x22d3ee }));
  cube.position.set(-1.2, 0.6, 0);
  cube.castShadow = true;
  scene.add(cube);
  const sph = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 32, 16),
    new THREE.MeshPhongMaterial({ color: 0x4488ff, shininess: 60 })
  );
  sph.position.set(1.4, 0.75, 0);
  sph.castShadow = true;
  scene.add(sph);
  const ortho = new THREE.OrthographicCamera(-3, 3, 3, -3, 0.1, 100);
  ortho.position.set(4, 3, 6);
  ortho.lookAt(0, 0.5, 0);
  const S = { ortho: false };
  const sync = () => {
    const a = canvas.clientWidth / (canvas.clientHeight || 1) || 1;
    ortho.left = -3 * a; ortho.right = 3 * a; ortho.top = 3; ortho.bottom = -3;
    ortho.updateProjectionMatrix();
    $("btnPersp").classList.toggle("active", !S.ortho);
    $("btnOrtho").classList.toggle("active", S.ortho);
    $("hudC").textContent = S.ortho ? "ortho" : "persp";
  };
  onBtn("btnPersp", () => { S.ortho = false; sync(); });
  onBtn("btnOrtho", () => { S.ortho = true; sync(); });
  canvas.addEventListener("keydown", (e) => {
    if (e.key === "p" || e.key === "P") { S.ortho = !S.ortho; sync(); }
  });
  sync();
  return {
    cams: [camera, ortho],
    update(d) {
      cube.rotation.y += 0.8 * d;
      sph.position.y = 0.75 + Math.sin(perfT * 2) * 0.15;
      rows($("dataC"), [["Mode", S.ortho ? "Ortho" : "Persp"], ["Key", "P"]]);
      void ground;
    },
    get cam() { return S.ortho ? ortho : camera; },
  };
});

/* D. orbiting light */
miniLab("glD", (scene) => {
  stdGround(scene);
  const amb = new THREE.AmbientLight(0xffffff, 0.35);
  scene.add(amb);
  const dir = new THREE.DirectionalLight(0xffffff, 2.0);
  dir.position.set(3, 5, 2);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024);
  Object.assign(dir.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 0.5, far: 20 });
  scene.add(dir);
  const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0x22d3ee }));
  cube.position.set(-1.2, 0.6, 0);
  cube.castShadow = true;
  scene.add(cube);
  const sph = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 32, 16),
    new THREE.MeshPhongMaterial({ color: 0x4488ff, shininess: 60 })
  );
  sph.position.set(1.4, 0.75, 0);
  sph.castShadow = true;
  scene.add(sph);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), new THREE.MeshBasicMaterial({ color: 0x4df3ff }));
  scene.add(dot);
  let on = true, ang = 0;
  onBtn("btnOrbit", () => {
    on = !on;
    $("btnOrbit").textContent = on ? "Orbit. On" : "Orbit. Off";
    $("btnOrbit").classList.toggle("active", on);
  });
  return {
    update(d) {
      if (on) ang += d * 0.9;
      dir.position.set(Math.cos(ang) * 4, 3.2, Math.sin(ang) * 4);
      dot.position.copy(dir.position);
      cube.rotation.y += 0.6 * d;
      $("hudD").textContent = on ? "orbit on" : "orbit off";
      rows($("dataD"), [["Light X", f2(dir.position.x)], ["Light Z", f2(dir.position.z)], ["Orbit", on ? "on" : "off"]]);
    },
  };
});

/* E. shadow quality */
miniLab("glE", (scene) => {
  stdGround(scene);
  const { dir } = stdLights(scene);
  const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0x22d3ee }));
  cube.position.set(-1.2, 0.6, 0);
  cube.castShadow = true;
  scene.add(cube);
  const sph = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 32, 16),
    new THREE.MeshPhongMaterial({ color: 0x4488ff, shininess: 60 })
  );
  sph.position.set(1.4, 0.75, 0);
  sph.castShadow = true;
  scene.add(sph);
  let size = 1024;
  document.querySelectorAll('[data-shadow]').forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll('[data-shadow]').forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    size = +b.dataset.shadow;
    dir.shadow.mapSize.set(size, size);
    if (dir.shadow.map) { dir.shadow.map.dispose(); dir.shadow.map = null; }
    $("hudE").textContent = `${size}`;
  }));
  return {
    update(d) {
      cube.rotation.y += 0.8 * d;
      sph.position.y = 0.75 + Math.sin(perfT * 2) * 0.15;
      rows($("dataE"), [["Map", `${size}`], ["Cost", size === 2048 ? "high" : size === 1024 ? "med" : "low"]]);
    },
  };
});

/* F. scene readout */
miniLab("glF", (scene, camera, renderer) => {
  stdGround(scene);
  stdLights(scene);
  const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0x22d3ee }));
  cube.position.set(-1.2, 0.6, 0);
  cube.castShadow = true;
  scene.add(cube);
  const sph = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 32, 16),
    new THREE.MeshPhongMaterial({ color: 0x4488ff, shininess: 60 })
  );
  sph.position.set(1.4, 0.75, 0);
  sph.castShadow = true;
  scene.add(sph);
  let tris = 0;
  return {
    update(d) {
      cube.rotation.y += 0.8 * d;
      sph.position.y = 0.75 + Math.sin(perfT * 2) * 0.15;
      const p = camera.position;
      $("hudF").textContent = `tris ${tris} · ${Math.round(fps)} fps`;
      rows($("dataF"), [
        ["Cam", `${f2(p.x)} ${f2(p.y)} ${f2(p.z)}`],
        ["Objects", scene.children.length],
        ["Tris", tris],
        ["FPS", Math.round(fps)],
        ["Mats", "Lambert Phong"],
      ]);
      tris = renderer.info.render.triangles;
    },
  };
});

/* G. pause toggle */
miniLab("glG", (scene, camera, renderer, canvas) => {
  stdGround(scene);
  stdLights(scene);
  const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0x22d3ee }));
  cube.position.set(-1.2, 0.6, 0);
  cube.castShadow = true;
  scene.add(cube);
  let run = !CALM;
  const sync = () => {
    $("btnG").textContent = run ? "Running" : "Held";
    $("hudG").textContent = run ? "run" : "held";
  };
  onBtn("btnG", () => { run = !run; sync(); });
  canvas.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !e.repeat) { e.preventDefault(); run = !run; sync(); }
  });
  sync();
  return {
    update(d) {
      if (run) cube.rotation.y += 0.8 * d;
      rows($("dataG"), [["State", run ? "run" : "held"], ["Key", "Space"]]);
    },
  };
});

/* H. drive the cube */
miniLab("glH", (scene, camera, renderer, canvas) => {
  const ground = stdGround(scene);
  stdLights(scene);
  const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0x22d3ee }));
  const HOME = { x: 0, y: 0.5, z: 0 };
  cube.position.set(HOME.x, HOME.y, HOME.z);
  cube.castShadow = true;
  scene.add(cube);
  const keys = new Set();
  canvas.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", "q", "e", " "].includes(k)) e.preventDefault();
    keys.add(k);
  });
  canvas.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
  canvas.addEventListener("blur", () => keys.clear());
  onBtn("btnHReset", () => { cube.position.set(HOME.x, HOME.y, HOME.z); cube.rotation.set(0, 0, 0); });
  return {
    update(d) {
      const sp = 2.2 * d, rs = 1.8 * d;
      if (keys.has("arrowleft")) cube.position.x -= sp;
      if (keys.has("arrowright")) cube.position.x += sp;
      if (keys.has("arrowup")) cube.position.z -= sp;
      if (keys.has("arrowdown")) cube.position.z += sp;
      if (keys.has("q")) cube.rotation.y -= rs;
      if (keys.has("e")) cube.rotation.y += rs;
      cube.position.x = Math.max(-4, Math.min(4, cube.position.x));
      cube.position.z = Math.max(-3, Math.min(3, cube.position.z));
      $("hudH").textContent = `x ${f2(cube.position.x)} z ${f2(cube.position.z)}`;
      rows($("dataH"), [
        ["Pos X", f2(cube.position.x)],
        ["Pos Z", f2(cube.position.z)],
        ["Rot Y", f2(cube.rotation.y)],
        ["Held", keys.size ? [...keys].join(" ") : "none"],
      ]);
      void ground;
    },
  };
});

/* ---------------- shared loop ---------------- */
let perfT = 0;
const clock = new THREE.Clock();
window.addEventListener("resize", () => RIGS.forEach((r) => r.resize()));

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  if (delta > 0) fps += (1 / delta - fps) * 0.05;
  perfT += delta;
  for (const r of RIGS) {
    if (!r.visible) continue;
    r.update(delta, perfT);
    r.renderer.render(r.scene, r.cam());
  }
}
animate();
