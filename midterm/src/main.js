import * as THREE from "three";
import "./style.css";
import { initScene, loadGLB } from "./scene.js";
import { createEffects } from "./effects.js";
import { createMeteorManager } from "./meteors.js";
import { createDefense } from "./defense.js";
import { createGame } from "./game.js";
import { createUI } from "./ui.js";
import { createAudio } from "./audio.js";

const MODELS = {
  base: "station-base.glb",
  dome: "station-dome.glb",
  panel: "station-panel.glb",
  radar: "station-radar.glb",
  arm: "station-arm.glb",
  "rock-1": "meteor-rock-1.glb",
  "rock-2": "meteor-rock-2.glb",
  "rock-3": "meteor-rock-3.glb",
};

/* Dev serves the repo root, the build copies public next to dist. */
const assetUrl = (file) =>
  import.meta.env.DEV
    ? `/midterm/public/models/${file}`
    : `${import.meta.env.BASE_URL}models/${file}`;

const canvas = document.getElementById("game-canvas");
const loaderBar = document.getElementById("loader-bar");
const loaderText = document.getElementById("loader-text");
const loader = document.getElementById("loader");

async function boot() {
  const entries = Object.entries(MODELS);
  let done = 0;
  const models = {};
  await Promise.all(
    entries.map(async ([key, file]) => {
      models[key] = await loadGLB(assetUrl(file));
      done += 1;
      loaderBar.style.width = `${Math.round((done / entries.length) * 100)}%`;
      loaderText.textContent = `Preparing the debris belt · ${done}/${entries.length}`;
    })
  );

  const sceneApi = initScene({ canvas, models });
  const ui = createUI({ camera: sceneApi.camera, canvas });
  const audio = createAudio();
  const effects = createEffects({
    scene: sceneApi.scene,
    glow: sceneApi.glow,
    ringTex: sceneApi.ringTex,
  });

  /* Forward declaration, the meteor callbacks fire only after the game exists. */
  let game;

  const meteors = createMeteorManager({
    scene: sceneApi.scene,
    effects,
    templates: models,
    callbacks: {
      onDestroyed: (record, byPlayer) => game.onDestroyed(record, byPlayer),
      onImpact: (record) => game.onImpact(record),
      onShieldHit: () => game.onShieldHit(),
      onBossSpawn: () => game.onBossSpawn(),
      onBossSplit: () => game.onBossSplit(),
    },
  });

  const defense = createDefense({
    canvas,
    camera: sceneApi.camera,
    sceneApi,
    meteors,
    effects,
    audio,
    callbacks: {
      onShot: (hit) => game.onShot(hit),
      onAbility: (name) => game.onAbility(name),
      isPlaying: () =>
        (game.state.phase === "playing" || game.state.phase === "wavecleared"),
    },
  });

  game = createGame({ meteors, defense, sceneApi, ui, audio });

  /* ---------------- UI wiring ---------------- */

  const pauseBtn = document.getElementById("pause-btn");
  const muteBtn = document.getElementById("mute-btn");

  document.getElementById("start-btn").addEventListener("click", () => {
    audio.unlock();
    game.startRun();
  });

  document.getElementById("restart-btn").addEventListener("click", () => {
    audio.unlock();
    paused = false;
    game.setPaused(false);
    game.startRun();
  });

  document.getElementById("resume-btn").addEventListener("click", () => setPaused(false));
  document.getElementById("quit-btn").addEventListener("click", () => {
    setPaused(false);
    game.startRun();
  });

  pauseBtn.addEventListener("click", () => setPaused(!paused));

  muteBtn.addEventListener("click", () => {
    audio.unlock();
    const muted = !audio.isMuted();
    audio.setMuted(muted);
    muteBtn.textContent = muted ? "Sound Off" : "Sound On";
    muteBtn.setAttribute("aria-pressed", String(muted));
  });

  for (const chip of document.querySelectorAll(".chip[data-weapon]")) {
    chip.addEventListener("click", () => defense.setWeapon(chip.dataset.weapon));
  }
  document.getElementById("shield-btn").addEventListener("click", () => defense.activateShield());
  document.getElementById("focus-btn").addEventListener("click", () => defense.activateFocus());

  window.addEventListener("keydown", (event) => {
    if (event.key === "m" || event.key === "M") muteBtn.click();
  });

  /* ---------------- Pause and loop ---------------- */

  let paused = false;
  function setPaused(value) {
    const phase = game.state.phase;
    if (value && phase !== "playing" && phase !== "wavecleared") return;
    if (!value && phase !== "playing" && phase !== "wavecleared") value = false;
    paused = value;
    game.setPaused(value);
  }

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setPaused(!paused);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) setPaused(true);
  });

  window.addEventListener("resize", () => {
    sceneApi.resize(window.innerWidth, window.innerHeight);
  });
  sceneApi.resize(window.innerWidth, window.innerHeight);

  loader.classList.add("hidden");
  ui.showMenu();
  audio.play("click");

  /* Headless verification hooks, harmless in normal play. */
  const params = new URLSearchParams(location.search);
  if (params.has("autostart")) game.startRun();
  if (params.get("end")) {
    game.startRun();
    ui.showEnd(params.get("end") !== "lose", {
      score: 6350, wave: 5, shots: 52, hits: 41, health: 46,
    });
  }
  const clock = new THREE.Clock();
  /* Headless Chrome freezes performance.now between BeginFrames and only
     draws one frame, so ?fixedstep&steps=N runs the loop synchronously. */
  const fixedStep = params.has("fixedstep");
  const steps = Number(params.get("steps")) || 1;

  function frame(render) {
    const realDt = fixedStep ? 1 / 60 : Math.min(clock.getDelta(), 0.05);
    if (!paused) {
      const dt = realDt * game.state.timeScale;
      sceneApi.update(dt, realDt);
      effects.update(dt);
      meteors.update(dt, realDt, sceneApi.getShieldActive());
      defense.update(realDt);
      game.update(realDt);
      ui.tickFps(realDt);
    }
    if (render) sceneApi.renderer.render(sceneApi.scene, sceneApi.camera);
  }

  function animate() {
    frame(true);
    requestAnimationFrame(animate);
  }

  if (fixedStep) {
    for (let i = 0; i < steps; i++) frame(false);
  }
  animate();
}

boot().catch((error) => {
  loaderText.textContent = "Failed to load the debris belt. Check the console.";
  console.error(error);
});
