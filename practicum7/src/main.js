/* Nama: Anak Agung Putu Arda Nareswara
NRP: 5025241074
Kelas: B */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import "./style.css";

const $ = (id) => document.getElementById(id);
const CALM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const f2 = (n) => (n < 0 ? "-" : "") + Math.abs(n).toFixed(2).replace("-", "");
const vec3 = (v) => `${f2(v.x)} ${f2(v.y)} ${f2(v.z)}`;

/* dev serves the repo root while build copies public to the dist root. */
const MODEL_URL = import.meta.env.DEV
  ? "/practicum7/public/models/model.glb"
  : import.meta.env.BASE_URL + "models/model.glb";

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

function loadRobot(onReady, onProgress) {
  new GLTFLoader().load(MODEL_URL, onReady, onProgress, (e) => {
    console.error("GLTF loading error", e);
    $("loadingInfo").textContent = "load failed";
  });
}

const RIGS = [];
let fps = 60;

function mkRenderer(canvas) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true });
  r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  r.setSize(canvas.width, canvas.height, false);
  r.shadowMap.enabled = true;
  return r;
}

function addEnv(scene, renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = texture;
  pmrem.dispose();
  return texture;
}

function stdLights(scene) {
  const amb = new THREE.AmbientLight(0xffffff, 0.45);
  scene.add(amb);
  const dir = new THREE.DirectionalLight(0xffffff, 2.5);
  dir.position.set(4, 7, 4);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024);
  Object.assign(dir.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 0.5, far: 25 });
  scene.add(dir);
  return { amb, dir };
}

function stdGround(scene, size = 26) {
  const geometry = new THREE.PlaneGeometry(size, size);
  geometry.rotateX(-Math.PI / 2);
  const ground = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: 0x263449, roughness: 0.85, metalness: 0 })
  );
  ground.receiveShadow = true;
  scene.add(ground);
  const grid = new THREE.GridHelper(size, size, 0x4df3ff, 0x1e3a5f);
  grid.position.y = 0.02;
  scene.add(grid);
  return ground;
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

function toNDC(canvas, event, pointer) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

/* Selectable registry from the module, shared by the stage and the labs. */
function registerSelectable(object, label) {
  object.userData.selectable = true;
  object.userData.label = label;
  object.userData.baseScale = object.scale.clone();
  return object;
}

function findSelectableRoot(object) {
  let current = object;
  while (current) {
    if (current.userData.selectable) return current;
    current = current.parent;
  }
  return null;
}

function applyScaleFeedback(object, hovered, selected) {
  if (!object || !object.userData.baseScale) return;
  const factor = object === selected ? 1.12 : object === hovered ? 1.06 : 1;
  const base = object.userData.baseScale;
  object.scale.set(base.x * factor, base.y * factor, base.z * factor);
}

function restoreScale(object) {
  if (!object || !object.userData.baseScale) return;
  object.scale.copy(object.userData.baseScale);
}

/* ---------------- STAGE ---------------- */
const stage = (() => {
  const canvas = $("glMain");
  const renderer = mkRenderer(canvas);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1020);
  const envTexture = addEnv(scene, renderer);
  const { dir } = stdLights(scene);
  stdGround(scene);

  const camera = new THREE.PerspectiveCamera(55, canvas.width / canvas.height, 0.1, 100);
  camera.position.set(5, 3.5, 10);
  camera.lookAt(0, 1.2, 0);
  const orthoSize = 3.4;
  const ortho = new THREE.OrthographicCamera(-orthoSize, orthoSize, orthoSize, -orthoSize, 0.1, 100);
  ortho.position.copy(camera.position);
  ortho.lookAt(0, 1.2, 0);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 1.2, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 3;
  controls.maxDistance = 25;
  controls.minZoom = 0.5;
  controls.maxZoom = 3;
  controls.maxPolarAngle = Math.PI / 2 - 0.05;
  controls.update();

  /* Hierarchy demo, local transforms inside one group. */
  const hierarchyGroup = new THREE.Group();
  hierarchyGroup.name = "Hierarchy Demo";
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.6, 1.0),
    new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.45, metalness: 0.15 })
  );
  body.name = "Body";
  body.position.y = 0.8;
  body.castShadow = true;
  hierarchyGroup.add(body);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.5, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x76a8ff, roughness: 0.4, metalness: 0.1 })
  );
  head.name = "Head";
  head.position.set(0, 0.55, 0);
  head.castShadow = true;
  body.add(head);

  const child = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.45, 0.45),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3, metalness: 0.1 })
  );
  child.name = "Child Object";
  child.position.set(1.0, 0, 0);
  child.rotation.z = Math.PI / 4;
  child.castShadow = true;
  body.add(child);

  hierarchyGroup.position.x = -2.5;
  hierarchyGroup.rotation.y = Math.PI / 6;
  scene.add(hierarchyGroup);

  /* PBR experiment sphere. */
  const pbrMaterial = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.25, metalness: 0.1 });
  const pbrSphere = new THREE.Mesh(new THREE.SphereGeometry(0.7, 48, 24), pbrMaterial);
  pbrSphere.name = "PBR Sphere";
  pbrSphere.position.set(0, 0.8, 0.3);
  pbrSphere.castShadow = true;
  scene.add(pbrSphere);

  const interactiveObjects = [];
  registerSelectable(hierarchyGroup, "Hierarchy Group");
  registerSelectable(pbrSphere, "PBR Sphere");
  interactiveObjects.push(hierarchyGroup, pbrSphere);

  /* Imported GLB, shadows, hierarchy report, mixer clips. */
  let importedModel = null;
  let mixer = null;
  let activeAction = null;
  let clips = [];
  let glbMeshes = 0;
  let activeClip = "";
  const actions = {};
  const LOOPING = new Set(["Idle", "Walking", "Running", "Dance"]);
  $("loadingInfo").textContent = "loading model...";

  loadRobot(
    (gltf) => {
      importedModel = gltf.scene;
      importedModel.name = "Imported GLB";
      importedModel.position.set(2.4, 0, 0);
      importedModel.scale.setScalar(1.2);
      const names = [];
      importedModel.traverse((object) => {
        names.push(object.name || object.type);
        if (object.isMesh) {
          object.castShadow = true;
          object.receiveShadow = true;
          glbMeshes++;
        }
      });
      scene.add(importedModel);
      console.log("GLB hierarchy", names.length, "nodes and", glbMeshes, "meshes");
      console.log(names);
      registerSelectable(importedModel, "Imported GLB");
      interactiveObjects.push(importedModel);

      clips = gltf.animations;
      mixer = new THREE.AnimationMixer(importedModel);
      for (const clip of clips) {
        const action = mixer.clipAction(clip);
        if (!LOOPING.has(clip.name)) {
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
        }
        actions[clip.name] = action;
      }
      const sel = $("selClip");
      sel.replaceChildren();
      for (const clip of clips) {
        const option = document.createElement("option");
        option.value = clip.name;
        option.textContent = clip.name;
        sel.append(option);
      }
      fadeTo(clips[0] ? clips[0].name : "");
      $("loadingInfo").textContent = "model loaded";
    },
    (progress) => {
      if (progress.total > 0) {
        $("loadingInfo").textContent = Math.round((progress.loaded / progress.total) * 100) + "%";
      }
    }
  );

  function fadeTo(name) {
    const next = actions[name];
    if (!next) return;
    if (activeAction && activeAction !== next) activeAction.fadeOut(0.3);
    next.reset().setEffectiveWeight(1).fadeIn(0.3).play();
    activeAction = next;
    activeClip = name;
    $("animationInfo").textContent = name;
    $("selClip").value = name;
  }

  /* Raycasting, pointer NDC, hover state, selection state. */
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const worldPosition = new THREE.Vector3();
  let hoveredObject = null;
  let selectedObject = null;

  let selectionGesture = null;
  let suppressSelection = false;
  canvas.addEventListener("pointerdown", (event) => {
    suppressSelection = event.button !== 0 || selectionGesture !== null;
    selectionGesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
  });
  window.addEventListener(
    "pointermove",
    (event) => {
      if (!selectionGesture || event.pointerId !== selectionGesture.id) return;
      if (Math.hypot(event.clientX - selectionGesture.x, event.clientY - selectionGesture.y) > 5) {
        suppressSelection = true;
      }
    },
    true
  );
  window.addEventListener("pointerup", (event) => {
    if (event.pointerId === selectionGesture?.id) selectionGesture = null;
  });
  window.addEventListener("pointercancel", () => {
    selectionGesture = null;
    suppressSelection = true;
  });

  const S = { camMode: "persp", recursive: true, envOn: true, paused: CALM, shadow: true };
  const cameras = { persp: camera, ortho };
  const currentCamera = () => cameras[S.camMode];

  function setCamMode(mode, keepView = true) {
    if (mode === S.camMode) return;
    const from = currentCamera();
    S.camMode = mode;
    const to = currentCamera();
    if (keepView) {
      to.position.copy(from.position);
      to.zoom = from.zoom;
      to.updateProjectionMatrix();
    }
    controls.object = to;
    controls.update();
    $("selCam").value = mode;
  }

  function resetCamera() {
    setCamMode("persp", false);
    camera.fov = 55;
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    camera.position.set(5, 3.5, 10);
    controls.target.set(0, 1.2, 0);
    controls.object = camera;
    controls.update();
    $("selCam").value = "persp";
  }

  canvas.addEventListener("pointermove", (event) => {
    if (selectionGesture) return;
    toNDC(canvas, event, pointer);
    raycaster.setFromCamera(pointer, currentCamera());
    const hits = raycaster.intersectObjects(interactiveObjects, S.recursive);
    const nextHover = hits.length > 0 ? findSelectableRoot(hits[0].object) : null;
    if (nextHover !== hoveredObject) {
      const previous = hoveredObject;
      hoveredObject = nextHover;
      applyScaleFeedback(previous, null, selectedObject);
      applyScaleFeedback(hoveredObject, hoveredObject, selectedObject);
      canvas.style.cursor = hoveredObject ? "pointer" : "default";
      $("hoverInfo").textContent = hoveredObject ? hoveredObject.userData.label : "-";
    }
  });

  canvas.addEventListener("click", (event) => {
    if (suppressSelection || event.button !== 0) return;
    toNDC(canvas, event, pointer);
    raycaster.setFromCamera(pointer, currentCamera());
    const hits = raycaster.intersectObjects(interactiveObjects, S.recursive);
    restoreScale(selectedObject);
    selectedObject = hits.length > 0 ? findSelectableRoot(hits[0].object) : null;
    applyScaleFeedback(hoveredObject, hoveredObject, selectedObject);
    applyScaleFeedback(selectedObject, hoveredObject, selectedObject);
    $("selectedInfo").textContent = selectedObject ? selectedObject.userData.label : "-";
  });

  canvas.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !e.repeat) {
      e.preventDefault();
      $("btnPause").click();
    } else if (e.key === "p" || e.key === "P") {
      setCamMode(S.camMode === "persp" ? "ortho" : "persp");
    } else if (e.key === "e" || e.key === "E") {
      $("btnEnv").click();
    }
  });

  const bindRange = (id, fn) => {
    const el = $(id);
    const out = $(id + "Val");
    const sync = () => {
      out.textContent = f2(+el.value);
      fn(+el.value);
    };
    el.addEventListener("input", sync);
    sync();
    return { el, sync };
  };
  bindRange("sGX", (v) => (hierarchyGroup.position.x = v));
  bindRange("sGY", (v) => (hierarchyGroup.rotation.y = v));
  bindRange("sCX", (v) => (child.position.x = v));
  bindRange("sRough", (v) => (pbrMaterial.roughness = v));
  bindRange("sMetal", (v) => (pbrMaterial.metalness = v));
  bindRange("sDir", (v) => (dir.intensity = v));

  onSelect("selCam", (v) => setCamMode(v));
  onSelect("selClip", (v) => fadeTo(v));

  onBtn("btnEnv", () => {
    S.envOn = !S.envOn;
    scene.environment = S.envOn ? envTexture : null;
    $("btnEnv").textContent = S.envOn ? "Env. On" : "Env. Off";
  });
  onBtn("btnRay", () => {
    S.recursive = !S.recursive;
    $("btnRay").textContent = S.recursive ? "Recursive. On" : "Recursive. Off";
  });
  onBtn("btnShadow", () => {
    S.shadow = !S.shadow;
    renderer.shadowMap.enabled = S.shadow;
    scene.traverse((o) => {
      if (o.material) o.material.needsUpdate = true;
    });
    $("btnShadow").textContent = S.shadow ? "Shadow. On" : "Shadow. Off";
  });
  onBtn("btnPause", () => {
    S.paused = !S.paused;
    $("btnPause").textContent = S.paused ? "Resume" : "Pause";
  });
  onBtn("btnLog", () => {
    child.getWorldPosition(worldPosition);
    console.log("Child local", child.position.clone());
    console.log("Child world", worldPosition.clone());
  });
  onBtn("btnReset", resetCamera);

  const rig = {
    canvas,
    renderer,
    scene,
    cam: currentCamera,
    visible: true,
    resize() {
      const { w, h } = fitCanvas(rig);
      const aspect = w / h;
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      ortho.left = -orthoSize * aspect;
      ortho.right = orthoSize * aspect;
      ortho.top = orthoSize;
      ortho.bottom = -orthoSize;
      ortho.updateProjectionMatrix();
    },
    update(delta) {
      if (mixer) mixer.update(delta);
      if (!S.paused) child.rotation.x += 1.2 * delta;
      controls.update();
      child.getWorldPosition(worldPosition);
      $("hudMain").textContent = `${S.camMode} · objs ${scene.children.length} · clip ${activeClip || "loading"}`;
      rows($("dataMain"), [
        ["Child local", vec3(child.position)],
        ["Child world", vec3(worldPosition)],
        ["Group X", f2(hierarchyGroup.position.x)],
        ["Group rot Y", f2(hierarchyGroup.rotation.y)],
        ["Pointer NDC", `${f2(pointer.x)} ${f2(pointer.y)}`],
        ["Roughness", f2(pbrMaterial.roughness)],
        ["Metalness", f2(pbrMaterial.metalness)],
        ["GLB meshes", glbMeshes || "--"],
        ["Clips", clips.length || "--"],
        ["Camera", S.camMode],
        ["Recursive", S.recursive ? "on" : "off"],
        ["Environment", S.envOn ? "on" : "off"],
        ["Dir light", f2(dir.intensity)],
        ["Objects", scene.children.length],
        ["FPS", Math.round(fps)],
      ]);
    },
  };
  watch(rig);
  return { rig, S };
})();

/* ---------------- LAB HELPER ---------------- */
function miniLab(id, camPos, lookAt, build) {
  const canvas = $(id);
  const renderer = mkRenderer(canvas);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1020);
  const camera = new THREE.PerspectiveCamera(50, canvas.width / canvas.height, 0.1, 100);
  camera.position.set(...camPos);
  camera.lookAt(...lookAt);
  const ctx = build(scene, camera, renderer, canvas) || {};
  const rig = {
    canvas,
    renderer,
    scene,
    cam: () => camera,
    visible: true,
    resize() {
      const { w, h } = fitCanvas(rig);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    update(d) {
      ctx.update?.(d);
    },
  };
  watch(rig);
  return ctx;
}

/* A. clip switchboard */
miniLab("glA", [0, 2.4, 10], [0, 1.1, 0], (scene, camera, renderer, canvas) => {
  addEnv(scene, renderer);
  stdLights(scene);
  stdGround(scene);
  let mixer = null;
  const actions = {};
  let active = "";

  function fadeTo(name) {
    const next = actions[name];
    if (!next) return;
    const previous = actions[active];
    if (previous && previous !== next) previous.fadeOut(0.3);
    next.reset().setEffectiveWeight(1).fadeIn(0.3).play();
    active = name;
  }

  loadRobot((gltf) => {
    const model = gltf.scene;
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    scene.add(model);
    mixer = new THREE.AnimationMixer(model);
    for (const clip of gltf.animations) actions[clip.name] = mixer.clipAction(clip);
    fadeTo("Idle");
  });
  onBtn("btnA1", () => fadeTo("Idle"));
  onBtn("btnA2", () => fadeTo("Walking"));
  onBtn("btnA3", () => fadeTo("Running"));
  canvas.addEventListener("keydown", (e) => {
    if (e.key === "1") fadeTo("Idle");
    if (e.key === "2") fadeTo("Walking");
    if (e.key === "3") fadeTo("Running");
  });
  return {
    update(d) {
      if (mixer) mixer.update(d);
      $("hudA").textContent = active ? "clip " + active : "loading";
      rows($("dataA"), [
        ["Clips", Object.keys(actions).length || "--"],
        ["Active", active || "--"],
        ["Keys", "1 2 3"],
      ]);
    },
  };
});

/* B. click plays animation */
miniLab("glB", [0, 2.4, 10], [0, 1.1, 0], (scene, camera, renderer, canvas) => {
  addEnv(scene, renderer);
  stdLights(scene);
  stdGround(scene);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let model = null;
  let mixer = null;
  const actions = {};
  let active = "";
  let selected = false;

  loadRobot((gltf) => {
    model = gltf.scene;
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    scene.add(model);
    mixer = new THREE.AnimationMixer(model);
    for (const clip of gltf.animations) actions[clip.name] = mixer.clipAction(clip);
    actions.Idle.play();
    active = "Idle";
  });

  function backToIdle() {
    mixer.removeEventListener("finished", backToIdle);
    actions.Wave.fadeOut(0.2);
    actions.Idle.reset().fadeIn(0.2).play();
    active = "Idle";
  }

  function playGesture() {
    if (!mixer || !actions.Wave) return;
    actions.Idle.fadeOut(0.2);
    actions.Wave.reset();
    actions.Wave.setLoop(THREE.LoopOnce, 1);
    actions.Wave.clampWhenFinished = true;
    actions.Wave.fadeIn(0.2).play();
    active = "Wave";
    selected = true;
    mixer.removeEventListener("finished", backToIdle);
    mixer.addEventListener("finished", backToIdle);
  }

  canvas.addEventListener("click", (event) => {
    if (!model) return;
    toNDC(canvas, event, pointer);
    raycaster.setFromCamera(pointer, camera);
    if (raycaster.intersectObject(model, true).length > 0) playGesture();
  });
  onBtn("btnBWave", playGesture);
  return {
    update(d) {
      if (mixer) mixer.update(d);
      $("hudB").textContent = !model ? "loading" : active === "Wave" ? "gesture " + active : "click the robot";
      rows($("dataB"), [
        ["Model", model ? "loaded" : "loading"],
        ["Active clip", active || "--"],
        ["Selected", selected ? "robot" : "none"],
      ]);
    },
  };
});

/* C. information panel */
miniLab("glC", [3.6, 2.8, 10], [0, 1, 0], (scene, camera, renderer, canvas) => {
  addEnv(scene, renderer);
  stdLights(scene);
  stdGround(scene);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const targets = [];

  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.4, metalness: 0.2 })
  );
  cube.position.set(-2.2, 0.5, 0.6);
  cube.rotation.y = 0.5;
  cube.castShadow = true;
  registerSelectable(cube, "Info Cube");
  scene.add(cube);
  targets.push(cube);

  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 40, 20),
    new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.3, metalness: 0.1 })
  );
  sphere.position.set(-0.6, 0.55, -0.5);
  sphere.castShadow = true;
  registerSelectable(sphere, "Info Sphere");
  scene.add(sphere);
  targets.push(sphere);

  loadRobot((gltf) => {
    const model = gltf.scene;
    model.position.set(2, 0, 0);
    model.scale.setScalar(1.1);
    model.rotation.y = -0.6;
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    registerSelectable(model, "Robot Model");
    scene.add(model);
    targets.push(model);
  });

  function firstMesh(root) {
    let found = null;
    root.traverse((o) => {
      if (!found && o.isMesh) found = o;
    });
    return found;
  }

  let selected = null;
  canvas.addEventListener("click", (event) => {
    toNDC(canvas, event, pointer);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(targets, true);
    selected = hits.length > 0 ? findSelectableRoot(hits[0].object) : null;
  });
  return {
    update() {
      const mesh = selected ? firstMesh(selected) : null;
      const material = mesh && mesh.material && !Array.isArray(mesh.material) ? mesh.material.type : "--";
      $("hudC").textContent = selected ? selected.userData.label : "pick one";
      rows($("dataC"), [
        ["Name", selected ? selected.userData.label : "-"],
        ["Position", selected ? vec3(selected.position) : "-"],
        ["Rotation", selected ? vec3(selected.rotation) : "-"],
        ["Scale", selected ? vec3(selected.scale) : "-"],
        ["Material", material],
      ]);
    },
  };
});

/* D. hierarchical solar system */
miniLab("glD", [0, 4, 7.5], [0, 0, 0], (scene, camera, renderer) => {
  addEnv(scene, renderer);
  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  const sunLight = new THREE.PointLight(0xffe6b0, 25, 0, 1.6);
  scene.add(sunLight);

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(0.8, 48, 24),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.55, roughness: 0.5, metalness: 0 })
  );
  scene.add(sun);

  const earthOrbit = new THREE.Group();
  scene.add(earthOrbit);
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(0.36, 40, 20),
    new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.55, metalness: 0.05 })
  );
  earth.position.set(2.3, 0, 0);
  earthOrbit.add(earth);
  const moonOrbit = new THREE.Group();
  moonOrbit.rotation.z = 0.35;
  earth.add(moonOrbit);
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 32, 16),
    new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.8, metalness: 0 })
  );
  moon.position.set(0.72, 0, 0);
  moonOrbit.add(moon);

  const earthWorld = new THREE.Vector3();
  const moonWorld = new THREE.Vector3();
  return {
    update(d) {
      sun.rotation.y += 0.2 * d;
      earthOrbit.rotation.y += 0.35 * d;
      earth.rotation.y += 0.9 * d;
      moonOrbit.rotation.y += 1.7 * d;
      earth.getWorldPosition(earthWorld);
      moon.getWorldPosition(moonWorld);
      $("hudD").textContent = "one angle per level";
      rows($("dataD"), [
        ["Earth local", vec3(earth.position)],
        ["Earth world", vec3(earthWorld)],
        ["Moon local", vec3(moon.position)],
        ["Moon world", vec3(moonWorld)],
      ]);
    },
  };
});

/* E. PBR material gallery */
miniLab("glE", [0, 2.2, 5.8], [0, 1.1, 0], (scene, camera, renderer) => {
  addEnv(scene, renderer);
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  const dir = new THREE.DirectionalLight(0xffffff, 1.6);
  dir.position.set(3, 5, 4);
  scene.add(dir);

  const group = new THREE.Group();
  const roughs = [0.9, 0.5, 0.1];
  const metals = [0, 0.5, 1];
  const geometry = new THREE.SphereGeometry(0.42, 40, 20);
  roughs.forEach((roughness, r) => {
    metals.forEach((metalness, c) => {
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({ color: 0x70b2e6, roughness, metalness })
      );
      mesh.position.set((c - 1) * 1.15, 2 - r * 1.15, 0);
      group.add(mesh);
    });
  });
  scene.add(group);
  return {
    update(d) {
      group.rotation.y += 0.3 * d;
      $("hudE").textContent = "rows R 0.9 0.5 0.1 top down";
      rows($("dataE"), [
        ["Spheres", 9],
        ["Rows", "0.9 0.5 0.1"],
        ["Cols", "0 0.5 1"],
        ["Environment", "on"],
      ]);
    },
  };
});

/* F. hover emissive */
miniLab("glF", [0, 1.7, 5], [0, 0.9, 0], (scene, camera, renderer, canvas) => {
  addEnv(scene, renderer);
  stdLights(scene);
  stdGround(scene);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const spheres = [0x70b2e6, 0x6be4d2, 0x76a8ff].map((color, i) => {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 40, 20),
      new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.2 })
    );
    mesh.position.set((i - 1) * 1.5, 0.85, 0);
    mesh.castShadow = true;
    mesh.name = ["Sphere A", "Sphere B", "Sphere C"][i];
    mesh.userData.baseColor = new THREE.Color(color);
    scene.add(mesh);
    return mesh;
  });

  function restoreEmissive(mesh) {
    if (!mesh) return;
    mesh.material.emissive.setHex(0x000000);
    mesh.material.emissiveIntensity = 1;
  }

  let hovered = null;
  canvas.addEventListener("pointermove", (event) => {
    toNDC(canvas, event, pointer);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(spheres, false);
    const next = hits.length > 0 ? hits[0].object : null;
    if (next !== hovered) {
      restoreEmissive(hovered);
      hovered = next;
      if (hovered) {
        hovered.material.emissive.setHex(0x4df3ff);
        hovered.material.emissiveIntensity = 0.45;
      }
      canvas.style.cursor = hovered ? "pointer" : "default";
    }
  });
  return {
    update() {
      $("hudF").textContent = hovered ? "hover " + hovered.name : "hover";
      rows($("dataF"), [
        ["Hovered", hovered ? hovered.name : "-"],
        ["Emissive", hovered ? "on" : "off"],
        ["Base color", hovered ? "#" + hovered.userData.baseColor.getHexString() : "-"],
      ]);
    },
  };
});

/* G. selection rotation */
miniLab("glG", [0, 2.6, 6], [0, 0.9, 0], (scene, camera, renderer, canvas) => {
  addEnv(scene, renderer);
  stdLights(scene);
  stdGround(scene);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const shapes = [
    new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.4, metalness: 0.2 })
    ),
    new THREE.Mesh(
      new THREE.SphereGeometry(0.6, 40, 20),
      new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.3, metalness: 0.1 })
    ),
    new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.18, 18, 40),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35, metalness: 0.3 })
    ),
  ];
  shapes.forEach((mesh, i) => {
    mesh.position.set((i - 1) * 1.7, i === 2 ? 1.0 : 0.75, 0);
    mesh.castShadow = true;
    mesh.name = ["Spin Cube", "Spin Sphere", "Spin Ring"][i];
    scene.add(mesh);
  });

  let selected = null;
  canvas.addEventListener("click", (event) => {
    toNDC(canvas, event, pointer);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(shapes, false);
    selected = hits.length > 0 ? hits[0].object : null;
  });
  return {
    update(d) {
      if (selected) selected.rotation.y += 1.2 * d;
      $("hudG").textContent = selected ? "spinning " + selected.name : "pick one";
      rows($("dataG"), [
        ["Selected", selected ? selected.name : "-"],
        ["Rot Y", selected ? f2(selected.rotation.y) : "-"],
        ["State", selected ? "spinning" : "stopped"],
      ]);
    },
  };
});

/* H. environment toggle */
miniLab("glH", [0, 1.8, 5.2], [0, 0.9, 0], (scene, camera, renderer, canvas) => {
  const envTexture = addEnv(scene, renderer);
  stdLights(scene);
  stdGround(scene);

  const metal = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 48, 24),
    new THREE.MeshStandardMaterial({ color: 0xd9e6f2, roughness: 0.15, metalness: 0.95 })
  );
  metal.position.set(-0.9, 0.9, 0);
  metal.castShadow = true;
  scene.add(metal);

  const matte = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 48, 24),
    new THREE.MeshStandardMaterial({ color: 0x8fb3d1, roughness: 0.9, metalness: 0.05 })
  );
  matte.position.set(0.9, 0.9, 0);
  matte.castShadow = true;
  scene.add(matte);

  let on = true;
  function sync() {
    scene.environment = on ? envTexture : null;
    $("btnHEnv").textContent = on ? "Env. On" : "Env. Off";
    $("hudH").textContent = on ? "Environment ON" : "Environment OFF";
  }
  onBtn("btnHEnv", () => {
    on = !on;
    sync();
  });
  canvas.addEventListener("keydown", (e) => {
    if (e.key === "e" || e.key === "E") {
      on = !on;
      sync();
    }
  });
  sync();
  return {
    update() {
      rows($("dataH"), [
        ["Environment", on ? "ON" : "OFF"],
        ["Metal sphere", "metalness 0.95"],
        ["Matte sphere", "roughness 0.9"],
      ]);
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
    r.update(delta);
    r.renderer.render(r.scene, r.cam());
  }
}
animate();
