import * as THREE from "three";
import { WEAPONS, HEAT, ABILITIES } from "./config.js";

/* Pointer aim, hitscan weapons, heat, shield and focus abilities. */
export function createDefense({ canvas, camera, sceneApi, meteors, effects, audio, callbacks }) {
  const { onShot, onAbility, isPlaying } = callbacks;

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(0, 0);
  let pointerType = "mouse";

  const state = {
    weapon: "pulse",
    heat: 0,
    overheated: false,
    fireTimer: 0,
    shield: { phase: "ready", remaining: 0 },
    focus: { phase: "ready", remaining: 0 },
    hovered: null,
  };

  const hitPoint = new THREE.Vector3();
  const rayPoint = new THREE.Vector3();
  const flashPoint = new THREE.Vector3();

  const reticle = document.getElementById("reticle");
  let overheatShown = false;

  function moveReticle(x, y) {
    reticle.style.transform = `translate(${x}px, ${y}px)`;
  }

  function setHover(record) {
    if (state.hovered === record) return;
    if (state.hovered) setHighlight(state.hovered, false);
    state.hovered = record;
    if (record) setHighlight(record, true);
    reticle.classList.toggle("target", Boolean(record));
  }

  function setHighlight(record, on) {
    record.root.traverse((o) => {
      if (!o.isMesh) return;
      const mat = o.material;
      if (on) {
        mat.userData = mat.userData || {};
        mat.userData.hoverSaved = mat.userData.hoverSaved || {
          emissive: mat.emissive.getHex(),
          intensity: mat.emissiveIntensity,
        };
        mat.emissive.setHex(record.type === "ice" ? 0x9fe9ff : 0x4dd8ff);
        mat.emissiveIntensity = 1.1;
      } else if (mat.userData && mat.userData.hoverSaved) {
        mat.emissive.setHex(mat.userData.hoverSaved.emissive);
        mat.emissiveIntensity = mat.userData.hoverSaved.intensity;
      }
    });
  }

  function meteorFromObject(object) {
    let o = object;
    while (o) {
      if (o.userData && o.userData.meteor) return o.userData.meteor;
      o = o.parent;
    }
    return null;
  }

  function pick() {
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(meteors.targets(), true);
    if (hits.length === 0) return null;
    const record = meteorFromObject(hits[0].object);
    return record ? { record, point: hits[0].point } : null;
  }

  function fire() {
    if (!isPlaying() || state.overheated || state.fireTimer > 0) return;
    const weapon = WEAPONS[state.weapon];
    state.fireTimer = weapon.interval;
    state.heat = Math.min(HEAT.max, state.heat + weapon.heat);
    if (state.heat >= HEAT.max) {
      state.overheated = true;
      audio.play("overheat");
    }

    const muzzle = sceneApi.aim();
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(meteors.targets(), true);
    let hitRecord = null;
    if (hits.length > 0) {
      hitRecord = meteorFromObject(hits[0].object);
      hitPoint.copy(hits[0].point);
    } else {
      raycaster.ray.at(34, rayPoint);
      hitPoint.copy(rayPoint);
    }

    sceneApi.aimAt(hitPoint);
    effects.beam(muzzle, hitPoint, weapon.beam, weapon.radius, weapon.life);
    effects.flash(muzzle, weapon.beam, 0.35, 0.05, 0.09);
    sceneApi.pulseLight(muzzle, weapon.beam, state.weapon === "lance" ? 26 : 12, 0.1);

    const killPoint = flashPoint.copy(hitPoint);
    if (hitRecord) {
      const killed = meteors.damage(hitRecord, weapon.damage, killPoint);
      effects.flash(killPoint, 0x9fe9ff, 0.4, 1.6, 0.14);
      effects.burst(killPoint, {
        count: 12,
        colors: [weapon.beam, 0xffffff],
        speed: [1, 4],
        life: [0.15, 0.4],
      });
      if (weapon.splash > 0) {
        meteors.damageNearby(killPoint, weapon.splash, 4, hitRecord);
        effects.ring(killPoint, weapon.beam, 0.3, weapon.splash * 2, 0.3);
        sceneApi.addShake(0.12);
      }
      audio.play("hit");
      onShot(true, killed);
    } else {
      audio.play("miss");
      onShot(false, false);
    }
  }

  function setWeapon(name) {
    if (!WEAPONS[name]) return;
    state.weapon = name;
    audio.play("click");
  }

  function activateShield() {
    const s = state.shield;
    if (s.phase !== "ready") return;
    s.phase = "active";
    s.remaining = ABILITIES.shield.duration;
    sceneApi.setShield(true);
    effects.ring(sceneApi.shieldPoint(), 0x4df3ff, 1, 7, 0.5, 0.6);
    audio.play("shieldOn");
    onAbility("shield");
  }

  function activateFocus() {
    const f = state.focus;
    if (f.phase !== "ready") return;
    f.phase = "active";
    f.remaining = ABILITIES.focus.duration;
    audio.play("focus");
    onAbility("focus");
  }

  function update(realDt) {
    state.fireTimer = Math.max(0, state.fireTimer - realDt);

    /* The turret follows the crosshair so barrel, cursor and beam always
       agree before the shot. Same raycast the hover pick already did. */
    if (isPlaying()) {
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(meteors.targets(), true);
      if (hits.length > 0) rayPoint.copy(hits[0].point);
      else raycaster.ray.at(34, rayPoint);
      sceneApi.aimAt(rayPoint);
    }

    if (state.overheated !== overheatShown) {
      overheatShown = state.overheated;
      reticle.classList.toggle("overheated", overheatShown);
    }

    const heat = state.heat;
    if (state.overheated) {
      state.heat = Math.max(0, heat - HEAT.coolBoost * realDt);
      if (state.heat <= HEAT.overheatLock) state.overheated = false;
    } else {
      state.heat = Math.max(0, heat - HEAT.cool * realDt);
    }

    for (const key of ["shield", "focus"]) {
      const a = state[key];
      if (a.phase === "active") {
        a.remaining -= realDt;
        if (a.remaining <= 0) {
          a.phase = "cooldown";
          a.remaining = ABILITIES[key].cooldown;
          if (key === "shield") sceneApi.setShield(false);
        }
      } else if (a.phase === "cooldown") {
        a.remaining -= realDt;
        if (a.remaining <= 0) {
          a.phase = "ready";
          a.remaining = 0;
        }
      }
    }
  }

  /* Input wiring. */
  function toNDC(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  canvas.addEventListener("pointermove", (event) => {
    pointerType = event.pointerType;
    toNDC(event);
    moveReticle(event.clientX, event.clientY);
    if (pointerType !== "mouse") return;
    const hit = pick();
    setHover(hit ? hit.record : null);
  });
  canvas.addEventListener("pointerleave", () => setHover(null));
  canvas.addEventListener("pointerdown", (event) => {
    toNDC(event);
    moveReticle(event.clientX, event.clientY);
    if (event.button === 2) {
      activateShield();
      return;
    }
    if (event.button !== 0) return;
    if (pointerType !== "mouse") {
      const hit = pick();
      setHover(hit ? hit.record : null);
    }
    fire();
  });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());

  window.addEventListener("keydown", (event) => {
    if (event.repeat) return;
    if (event.key === "1") setWeapon("pulse");
    else if (event.key === "2") setWeapon("lance");
    else if (event.key === " ") {
      event.preventDefault();
      activateShield();
    } else if (event.key === "f" || event.key === "F") activateFocus();
  });

  /* Passive aim parallax from the pointer position. */
  window.addEventListener("pointermove", (event) => {
    const x = (event.clientX / window.innerWidth) * 2 - 1;
    const y = (event.clientY / window.innerHeight) * 2 - 1;
    sceneApi.setParallax(x, y);
  });

  function reset() {
    setHover(null);
    overheatShown = false;
    reticle.classList.remove("overheated");
    state.heat = 0;
    state.overheated = false;
    state.fireTimer = 0;
    state.weapon = "pulse";
    state.shield = { phase: "ready", remaining: 0 };
    state.focus = { phase: "ready", remaining: 0 };
  }

  return { fire, setWeapon, activateShield, activateFocus, update, reset, state };
}
