/* Meteor Defense tuning. Pure data, no DOM and no THREE, checked by checks.mjs. */

export const STATION = {
  maxHealth: 100,
  impactRadius: 3.6,
  shieldRadius: 5.0,
  spawnRadius: [26, 32],
};

export const METEOR_TYPES = {
  rock: { model: "rock-1", size: 1.15, hp: 2, speed: 1, damage: 8, score: 100, color: 0x9aa4b2 },
  ice: { model: "rock-2", size: 0.8, hp: 1, speed: 1.4, damage: 5, score: 150, color: 0x7fc4ff },
  hulk: { model: "rock-3", size: 1.9, hp: 5, speed: 0.62, damage: 16, score: 250, color: 0xff8a4d },
  boss: { model: "rock-3", size: 4.4, hp: 60, speed: 0.34, damage: 40, score: 1500, color: 0xffa24d },
};

export const WAVES = [
  { queue: ["rock", "rock", "rock", "rock", "ice", "rock", "rock", "ice"], interval: 2.3, speed: 3.2, hp: 1.0 },
  { queue: ["rock", "ice", "rock", "ice", "rock", "hulk", "rock", "ice", "rock", "ice"], interval: 1.8, speed: 3.9, hp: 1.1 },
  { queue: ["rock", "ice", "hulk", "ice", "rock", "ice", "rock", "hulk", "ice", "rock", "ice", "hulk"], interval: 1.45, speed: 4.6, hp: 1.25 },
  { queue: ["rock", "ice", "hulk", "ice", "rock", "ice", "hulk", "ice", "rock", "ice", "hulk", "ice", "rock", "ice"], interval: 1.2, speed: 5.3, hp: 1.4 },
  { boss: true, queue: ["ice", "rock", "ice", "rock", "ice", "ice"], interval: 1.35, speed: 5.6, hp: 1.5 },
];

export const WEAPONS = {
  pulse: { damage: 1, heat: 8, interval: 0.15, beam: 0x4df3ff, radius: 0.035, splash: 0, life: 0.11 },
  lance: { damage: 9, heat: 26, interval: 0.65, beam: 0xffb24d, radius: 0.105, splash: 2.2, life: 0.24 },
};

export const HEAT = { max: 100, cool: 26, coolBoost: 42, overheatLock: 34 };
export const ABILITIES = {
  shield: { duration: 4.5, cooldown: 16 },
  focus: { duration: 4, cooldown: 20, timeScale: 0.35 },
};

export const SCORE = { hit: 10, lanceHit: 25, waveClear: 500 };

export const waveBonus = (wave) => SCORE.waveClear * wave;
export const isBossWave = (wave) => Boolean(WAVES[wave - 1]?.boss);
export const waveCount = () => WAVES.length;

/* Same spread the visuals use, abstracted so the check can stay headless. */
export function spawnDirection(rng = Math.random) {
  const x = (rng() * 2 - 1) * 15;
  const y = 7 + rng() * 9;
  const z = (rng() * 2 - 1) * 14 - 4;
  const len = Math.hypot(x, y, z) || 1;
  return { x: x / len, y: y / len, z: z / len };
}
