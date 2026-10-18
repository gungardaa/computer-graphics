import { STATION, SCORE, METEOR_TYPES, ABILITIES, waveBonus, isBossWave, waveCount } from "./config.js";

export function createGame({ meteors, defense, sceneApi, ui, audio }) {
  const state = {
    phase: "menu",
    wave: -1,
    integrity: STATION.maxIntegrity,
    score: 0,
    shots: 0,
    hits: 0,
    perfect: true,
    timeScale: 1,
  };
  let clearTimer = 0;

  const shake = (v) => sceneApi.addShake(v);

  function resetRun() {
    meteors.clear();
    defense.reset();
    sceneApi.reset();
    state.integrity = STATION.maxIntegrity;
    state.score = 0;
    state.shots = 0;
    state.hits = 0;
    state.perfect = true;
    state.wave = -1;
    state.timeScale = 1;
    ui.setIntegrity(1);
    ui.setScore(0);
    ui.setWave(1, waveCount());
    ui.setRemaining(0);
    ui.setLowIntegrity(false);
  }

  function startRun() {
    resetRun();
    state.phase = "playing";
    ui.hideMenu();
    ui.hideEnd();
    ui.showHud(true);
    nextWave();
  }

  function nextWave() {
    state.wave += 1;
    state.perfect = true;
    meteors.startWave(state.wave);
    ui.setWave(state.wave + 1, waveCount());
    if (isBossWave(state.wave + 1)) {
      ui.banner("WARNING", "Massive asteroid inbound", 2.2);
    } else {
      ui.banner(`WAVE ${state.wave + 1}`, "Meteoroids detected, defend the station", 1.8);
    }
    audio.play("waveStart");
  }

  function endRun(won) {
    state.phase = won ? "won" : "lost";
    audio.play(won ? "win" : "lose");
    ui.setLowIntegrity(false);
    ui.showHud(false);
    ui.showEnd(won, {
      score: state.score,
      wave: Math.min(state.wave + 1, waveCount()),
      shots: state.shots,
      hits: state.hits,
      integrity: Math.max(0, Math.round(state.integrity)),
    });
  }

  function onDestroyed(record, byPlayer) {
    if (!byPlayer || state.phase !== "playing") return;
    const def = METEOR_TYPES[record.type];
    state.score += def.score;
    ui.setScore(state.score);
    ui.scorePopup(record.root.position, `+${def.score}`, record.type === "boss" ? "#FFD9A0" : "#6BE4D2");
    if (record.type === "boss") {
      shake(0.9);
      audio.play("explodeBig");
    } else {
      shake(record.type === "hulk" ? 0.3 : 0.12);
      audio.play("explode");
    }
  }

  function onImpact(record) {
    if (state.phase !== "playing") return;
    state.integrity -= METEOR_TYPES[record.type].damage;
    state.perfect = false;
    ui.setIntegrity(Math.max(0, state.integrity) / STATION.maxIntegrity);
    ui.setLowIntegrity(state.integrity <= STATION.maxIntegrity * 0.3);
    ui.damageFlash();
    shake(record.type === "boss" ? 0.9 : 0.5);
    audio.play("alarm");
    if (state.integrity <= 0) endRun(false);
  }

  function onShieldHit() {
    audio.play("shieldHit");
  }

  function onBossSpawn() {
    ui.banner("BOSS", "Asteroid tripling mass on approach", 2.4);
    audio.play("boss");
    shake(0.4);
  }

  function onBossSplit() {
    audio.play("explode");
    ui.banner("HULL BREACH", "The asteroid broke apart", 1.6);
  }

  function onShot(hit) {
    state.shots += 1;
    if (hit) state.hits += 1;
    audio.play(hit ? "hit" : "miss");
  }

  function onAbility(name) {
    if (name === "focus") state.timeScale = ABILITIES.focus.timeScale;
    ui.setAbility(name, defense.state[name]);
  }

  function update(realDt) {
    if (state.phase !== "playing" && state.phase !== "wavecleared") return;

    if (state.timeScale < 1 && defense.state.focus.phase !== "active") state.timeScale = 1;

    ui.setRemaining(meteors.remaining());
    ui.setHeat(defense.state.heat / 100, defense.state.overheated);
    ui.setWeapons(defense.state.weapon);
    ui.setAbility("shield", defense.state.shield);
    ui.setAbility("focus", defense.state.focus);

    if (state.phase === "playing" && meteors.isCleared()) {
      if (state.wave >= waveCount() - 1) {
        endRun(true);
        return;
      }
      const bonus = waveBonus(state.wave + 1);
      state.score += bonus;
      const heal = state.perfect ? 30 : 18;
      state.integrity = Math.min(STATION.maxIntegrity, state.integrity + heal);
      ui.setScore(state.score);
      ui.setIntegrity(state.integrity / STATION.maxIntegrity);
      ui.setLowIntegrity(state.integrity <= STATION.maxIntegrity * 0.3);
      ui.banner(
        `WAVE ${state.wave + 1} CLEARED`,
        `${state.perfect ? "Flawless orbit +40 bonus, " : ""}hull restored`,
        2.4
      );
      audio.play("waveStart");
      state.phase = "wavecleared";
      clearTimer = 2.6;
      return;
    }

    if (state.phase === "wavecleared") {
      clearTimer -= realDt;
      if (clearTimer <= 0) {
        state.phase = "playing";
        nextWave();
      }
    }
  }

  function setPaused(paused) {
    ui.setPaused(paused);
  }

  return {
    state,
    startRun,
    update,
    setPaused,
    onDestroyed,
    onImpact,
    onShieldHit,
    onBossSpawn,
    onBossSplit,
    onShot,
    onAbility,
  };
}
