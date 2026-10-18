/* Runnable check for the pure tuning math. node midterm/checks.mjs */
import assert from "node:assert/strict";
import { WAVES, METEOR_TYPES, WEAPONS, HEAT, ABILITIES, SCORE, waveBonus, isBossWave, spawnDirection } from "./src/config.js";

assert.ok(WAVES.length >= 3, "topic needs at least 3 waves");

for (let i = 1; i < WAVES.length; i++) {
  const a = WAVES[i - 1];
  const b = WAVES[i];
  if (!a.boss && !b.boss) {
    assert.ok(b.speed > a.speed, `wave ${i + 1} must be faster than wave ${i}`);
    assert.ok(b.interval < a.interval, `wave ${i + 1} must spawn denser than wave ${i}`);
    assert.ok(b.hp >= a.hp, `wave ${i + 1} must not be weaker than wave ${i}`);
  }
}

const bossWaves = WAVES.filter((w) => w.boss);
assert.equal(bossWaves.length, 1, "exactly one boss wave");
assert.equal(WAVES[WAVES.length - 1].boss, true, "boss wave must be the final wave");

const typeNames = new Set();
for (const wave of WAVES) for (const t of wave.queue) typeNames.add(t);
assert.ok(typeNames.size >= 2, "topic needs at least 2 meteor types");
for (const t of typeNames) assert.ok(METEOR_TYPES[t], `wave references unknown type ${t}`);
for (const [name, t] of Object.entries(METEOR_TYPES)) {
  assert.ok(t.hp >= 1 && t.speed > 0 && t.damage > 0 && t.score > 0, `${name} fields sane`);
}

for (const [name, w] of Object.entries(WEAPONS)) {
  assert.ok(w.damage >= 1 && w.interval > 0 && w.heat > 0 && w.life > 0, `${name} fields sane`);
  assert.ok(w.heat <= HEAT.max, `${name} must not overheat in one shot`);
}
assert.ok(WEAPONS.lance.damage > WEAPONS.pulse.damage, "lance hits harder than pulse");
assert.ok(WEAPONS.pulse.interval < WEAPONS.lance.interval, "pulse fires faster than lance");
assert.ok(HEAT.cool > 0 && HEAT.overheatLock < HEAT.max, "heat recovery sane");
assert.ok(ABILITIES.shield.cooldown > ABILITIES.shield.duration, "shield cooldown exceeds duration");
assert.ok(ABILITIES.focus.cooldown > ABILITIES.focus.duration, "focus cooldown exceeds duration");
assert.ok(ABILITIES.focus.timeScale > 0 && ABILITIES.focus.timeScale < 1, "focus actually slows time");
assert.ok(SCORE.waveClear > 0 && waveBonus(2) > SCORE.waveClear, "wave bonus scales with wave");
assert.equal(isBossWave(WAVES.length), true);
assert.equal(isBossWave(1), false);

const d = spawnDirection(() => 0.5);
assert.ok(Math.abs(Math.hypot(d.x, d.y, d.z) - 1) < 1e-9, "spawn direction normalized");
assert.ok(d.y > 0, "meteors come from above");
let minY = 1;
let maxY = -1;
for (let i = 0; i < 500; i++) {
  const s = spawnDirection();
  assert.ok(Math.abs(Math.hypot(s.x, s.y, s.z) - 1) < 1e-9, "random spawn direction normalized");
  minY = Math.min(minY, s.y);
  maxY = Math.max(maxY, s.y);
}
assert.ok(minY > 0, "every random spawn comes from the upper hemisphere");

console.log("checks passed", { waves: WAVES.length, types: typeNames.size, minY: +minY.toFixed(2), maxY: +maxY.toFixed(2) });
