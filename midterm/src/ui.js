import * as THREE from "three";
import { ABILITIES } from "./config.js";

export function createUI({ camera, canvas }) {
  const el = (id) => document.getElementById(id);
  const dom = {
    hud: el("hud"),
    healthBar: el("health-bar"),
    healthValue: el("health-value"),
    scoreValue: el("score-value"),
    waveValue: el("wave-value"),
    remainingValue: el("remaining-value"),
    heatBar: el("heat-bar"),
    overheatTag: el("overheat-tag"),
    banner: el("banner"),
    bannerTitle: el("banner-title"),
    bannerSub: el("banner-sub"),
    popups: el("popups"),
    menu: el("menu"),
    end: el("end"),
    endTitle: el("end-title"),
    endSub: el("end-sub"),
    endStats: el("end-stats"),
    pause: el("pause-overlay"),
    damage: el("damage-flash"),
    fps: el("fps"),
    live: el("sr-live"),
  };

  const last = {};
  const changed = (key, value) => {
    if (last[key] === value) return false;
    last[key] = value;
    return true;
  };

  const vec = new THREE.Vector3();
  function worldToScreen(position) {
    vec.copy(position).project(camera);
    const rect = canvas.getBoundingClientRect();
    return {
      x: (vec.x * 0.5 + 0.5) * rect.width,
      y: (-vec.y * 0.5 + 0.5) * rect.height,
      visible: vec.z < 1,
    };
  }

  function scorePopup(position, text, color) {
    const { x, y, visible } = worldToScreen(position);
    if (!visible) return;
    const node = document.createElement("span");
    node.className = "popup";
    node.textContent = text;
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    node.style.color = color;
    dom.popups.appendChild(node);
    node.addEventListener("animationend", () => node.remove());
  }

  let bannerTimer = 0;
  function banner(title, sub, duration = 2) {
    dom.bannerTitle.textContent = title;
    dom.bannerSub.textContent = sub;
    dom.banner.classList.add("show");
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => dom.banner.classList.remove("show"), duration * 1000);
    announce(`${title}. ${sub}`);
  }

  function announce(text) {
    dom.live.textContent = text;
  }

  function showHud(show) {
    dom.hud.classList.toggle("visible", show);
  }

  function setHealth(ratio) {
    const pct = Math.max(0, Math.round(ratio * 100));
    if (!changed("health", pct)) return;
    dom.healthBar.style.width = `${pct}%`;
    dom.healthValue.textContent = `${pct}%`;
    dom.healthBar.classList.toggle("warn", pct <= 60 && pct > 30);
    dom.healthBar.classList.toggle("danger", pct <= 30);
  }

  function setScore(score) {
    if (!changed("score", score)) return;
    dom.scoreValue.textContent = String(score);
  }

  function setWave(wave, total) {
    if (!changed("wave", wave)) return;
    dom.waveValue.textContent = `${wave}/${total}`;
  }

  function setRemaining(count) {
    if (!changed("remaining", count)) return;
    dom.remainingValue.textContent = String(count);
  }

  function setHeat(ratio, overheated) {
    const pct = Math.round(ratio * 100);
    if (changed("heat", pct)) {
      dom.heatBar.style.width = `${pct}%`;
      dom.heatBar.classList.toggle("hot", pct >= 70);
    }
    if (changed("overheated", overheated)) {
      dom.overheatTag.classList.toggle("visible", overheated);
    }
  }

  function setWeapons(active) {
    if (!changed("weapon", active)) return;
    for (const chip of document.querySelectorAll(".chip[data-weapon]")) {
      chip.classList.toggle("active", chip.dataset.weapon === active);
    }
  }

  function setAbility(name, ability) {
    const btn = el(`${name}-btn`);
    if (!btn) return;
    const key = `ability-${name}`;
    const label = ability.phase === "ready" ? "Ready" : ability.phase === "active" ? "Active" : `${Math.ceil(ability.remaining)}s`;
    const sig = `${ability.phase}-${label}`;
    if (changed(key, sig)) {
      btn.dataset.state = ability.phase;
      btn.querySelector(".ability-state").textContent = label;
    }
    const total = ability.phase === "cooldown" ? ABILITIES[name].cooldown : ability.phase === "active" ? ABILITIES[name].duration : 1;
    const progress = ability.phase === "ready" ? 1 : 1 - ability.remaining / total;
    btn.style.setProperty("--cd", Math.max(0, Math.min(1, progress)).toFixed(2));
  }

  function damageFlash() {
    dom.damage.classList.remove("flash");
    void dom.damage.offsetWidth;
    dom.damage.classList.add("flash");
  }

  function setLowHealth(low) {
    if (!changed("low", low)) return;
    document.body.classList.toggle("low-health", low);
  }

  let fpsAccum = 0;
  let fpsFrames = 0;
  function tickFps(dt) {
    fpsAccum += dt;
    fpsFrames += 1;
    if (fpsAccum < 0.5) return;
    const fps = Math.round(fpsFrames / fpsAccum);
    dom.fps.textContent = `${fps} FPS`;
    fpsAccum = 0;
    fpsFrames = 0;
  }

  function showMenu() {
    dom.menu.classList.add("visible");
  }
  function hideMenu() {
    dom.menu.classList.remove("visible");
  }
  function showEnd(won, stats) {
    const panel = dom.end.querySelector(".end-panel");
    if (panel) panel.classList.toggle("lost", !won);
    dom.endTitle.textContent = won ? "STATION SECURED" : "STATION LOST";
    dom.endSub.textContent = won
      ? "All hostile orbits cleared. The station holds."
      : "Hull health points depleted. The debris field claims another station.";
    const accuracy = stats.shots > 0 ? Math.round((stats.hits / stats.shots) * 100) : 0;
    dom.endStats.innerHTML = `
      <div class="end-stat"><span>Score</span><strong>${stats.score}</strong></div>
      <div class="end-stat"><span>Waves survived</span><strong>${stats.wave}</strong></div>
      <div class="end-stat"><span>Accuracy</span><strong>${accuracy}%</strong></div>
      <div class="end-stat"><span>Health Points left</span><strong>${stats.health}%</strong></div>`;
    dom.end.classList.add("visible");
    announce(won ? "Victory. Station secured." : "Defeat. Station lost.");
  }
  function hideEnd() {
    dom.end.classList.remove("visible");
  }
  function setPaused(paused) {
    dom.pause.classList.toggle("visible", paused);
    if (paused) announce("Game paused");
  }

  return {
    worldToScreen,
    scorePopup,
    banner,
    announce,
    showHud,
    setHealth,
    setScore,
    setWave,
    setRemaining,
    setHeat,
    setWeapons,
    setAbility,
    damageFlash,
    setLowHealth,
    tickFps,
    showMenu,
    hideMenu,
    showEnd,
    hideEnd,
    setPaused,
  };
}
