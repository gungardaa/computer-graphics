import * as THREE from "three";
import { METEOR_TYPES, STATION, WAVES, spawnDirection } from "./config.js";

const ORIGIN = new THREE.Vector3();

function firstMaterial(root) {
  let found = null;
  root.traverse((o) => {
    if (!found && o.isMesh) found = o.material;
  });
  return found || new THREE.MeshStandardMaterial();
}

export function createMeteorManager({ scene, effects, templates, callbacks }) {
  const { onDestroyed, onImpact, onShieldHit, onBossSpawn, onBossSplit } = callbacks;

  /* Per type material recipe cloned per instance so hit flashes stay local. */
  const recipes = {};
  for (const [name, def] of Object.entries(METEOR_TYPES)) {
    const source = templates[def.model];
    const base = firstMaterial(source).clone();
    base.color.set(def.color);
    base.roughness = name === "ice" ? 0.35 : 0.92;
    base.metalness = name === "ice" ? 0.08 : 0.12;
    base.emissive = new THREE.Color(name === "ice" ? 0x265e91 : name === "rock" ? 0x000000 : 0xff5a2a);
    base.emissiveIntensity = name === "rock" ? 0 : name === "ice" ? 0.7 : 0.55;
    recipes[name] = base;
  }

  const alive = [];
  const wave = { active: false, index: 0, queue: [], spawnTimer: 0, bossPending: false, bossTimer: 0 };

  function spawn(type) {
    const def = METEOR_TYPES[type];
    const root = templates[def.model].clone(true);
    root.traverse((o) => {
      if (o.isMesh) {
        o.material = recipes[type].clone();
        o.castShadow = true;
        o.receiveShadow = true;
        o.userData.baseEmissive = o.material.emissive.getHex();
        o.userData.baseIntensity = o.material.emissiveIntensity;
      }
    });
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const scale = def.size / Math.max(size.x, size.y, size.z, 1e-6);
    root.scale.multiplyScalar(scale);
    root.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);

    const dir = spawnDirection();
    const radius = STATION.spawnRadius[0] + Math.random() * (STATION.spawnRadius[1] - STATION.spawnRadius[0]);
    root.position.set(dir.x * radius, dir.y * radius, dir.z * radius);

    const hp = type === "boss" ? def.hp : Math.max(1, Math.round(def.hp * WAVES[wave.index].hp));
    const record = {
      root,
      type,
      def,
      hp,
      maxHp: hp,
      radius: def.size * 0.55,
      speed: def.speed * WAVES[wave.index].speed * (0.9 + Math.random() * 0.2),
      target: new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.3 + Math.random() * 0.6, (Math.random() - 0.5) * 1.2),
      tumble: new THREE.Vector3(
        (Math.random() - 0.5) * 1.4,
        (Math.random() - 0.5) * 1.4,
        (Math.random() - 0.5) * 1.4
      ),
      flash: 0,
      trailTimer: 0,
      splitDone: false,
      alive: true,
    };
    root.userData.meteor = record;
    scene.add(root);
    alive.push(record);
    return record;
  }

  function explode(record, big) {
    const pos = record.root.position;
    if (record.type === "ice") {
      effects.burst(pos, { count: 30, colors: [0x9fd8ff, 0xdff2ff, 0x4d9fff], speed: [1.5, 5] });
      effects.flash(pos, 0x9fd8ff, 0.6, 2.0, 0.18);
      effects.ring(pos, 0x6fc4ff, 0.4, 2.4, 0.3);
    } else if (record.type === "boss") {
      effects.burst(pos, { count: 130, colors: [0xffc48a, 0xff8a4d, 0x8f6a4d, 0xfff0d0], speed: [2, 9], life: [0.5, 1.3], gravity: 0.6 });
      effects.flash(pos, 0xffd9a0, 2.5, 7.5, 0.35);
      effects.ring(pos, 0xffa24d, 1, 8, 0.55);
      effects.ring(pos, 0xffe2b0, 0.5, 5, 0.4);
    } else {
      const count = big ? 46 : 26;
      effects.burst(pos, { count, colors: [0xffb24d, 0xff8a4d, 0x9a8468], speed: [1.5, big ? 7 : 5], gravity: 0.5 });
      effects.flash(pos, 0xffd9a0, big ? 1.6 : 1.0, big ? 3.4 : 2.2, 0.2);
      effects.ring(pos, 0xffc48a, 0.4, big ? 3.2 : 2.0, 0.32);
    }
  }

  function despawn(record) {
    scene.remove(record.root);
    record.root.traverse((o) => {
      if (o.isMesh) o.material.dispose();
    });
    const i = alive.indexOf(record);
    if (i >= 0) alive.splice(i, 1);
    record.alive = false;
  }

  function kill(record, byPlayer) {
    explode(record, record.type === "hulk" || record.type === "boss");
    despawn(record);
    onDestroyed(record, byPlayer);
  }

  function splitBoss(record) {
    record.splitDone = true;
    effects.burst(record.root.position, { count: 40, colors: [0xff8a4d, 0xffe2b0], speed: [2, 6] });
    for (let i = 0; i < 3; i++) {
      const shard = spawn("rock");
      shard.root.position.copy(record.root.position).addScaledVector(
        new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
        record.def.size * 0.8
      );
      shard.hp = 2;
      shard.maxHp = 2;
      shard.speed *= 1.6;
    }
    onBossSplit(record);
  }

  function damage(record, amount, point) {
    if (!record.alive) return false;
    record.hp -= amount;
    record.flash = 0.14;
    if (record.type === "boss" && !record.splitDone && record.hp <= record.maxHp * 0.4) {
      splitBoss(record);
    }
    if (record.hp <= 0) {
      kill(record, true);
      return true;
    }
    return false;
  }

  function startWave(index) {
    wave.active = true;
    wave.index = index;
    wave.queue = [...WAVES[index].queue];
    wave.spawnTimer = 1.2;
    wave.bossPending = Boolean(WAVES[index].boss);
    wave.bossTimer = 3.5;
  }

  function clear() {
    for (const record of [...alive]) despawn(record);
    wave.active = false;
    wave.queue = [];
    wave.bossPending = false;
  }

  function pending() {
    return wave.queue.length + (wave.bossPending ? 1 : 0);
  }

  function isCleared() {
    return wave.active && pending() === 0 && alive.length === 0;
  }

  function project(point) {
    return point.clone().setLength(STATION.shieldRadius);
  }

  const tmp = new THREE.Vector3();
  function update(dt, realDt, shieldActive) {
    if (wave.active) {
      wave.spawnTimer -= dt;
      if (wave.queue.length > 0 && wave.spawnTimer <= 0) {
        spawn(wave.queue.shift());
        wave.spawnTimer = WAVES[wave.index].interval;
      }
      if (wave.bossPending) {
        wave.bossTimer -= dt;
        if (wave.bossTimer <= 0) {
          wave.bossPending = false;
          const boss = spawn("boss");
          onBossSpawn(boss);
        }
      }
    }

    for (const record of [...alive]) {
      record.root.position.addScaledVector(
        tmp.copy(record.target).sub(record.root.position).normalize(),
        record.speed * dt
      );
      record.root.rotation.x += record.tumble.x * dt;
      record.root.rotation.y += record.tumble.y * dt;
      record.root.rotation.z += record.tumble.z * dt;

      if (record.flash > 0) {
        record.flash -= realDt;
        const on = record.flash > 0;
        record.root.traverse((o) => {
          if (!o.isMesh) return;
          o.material.emissive.setHex(on ? 0xffffff : o.userData.baseEmissive);
          o.material.emissiveIntensity = on ? 2.4 : o.userData.baseIntensity;
        });
      }
      if (record.type === "boss") {
        record.root.traverse((o) => {
          if (o.isMesh && record.flash <= 0) {
            o.material.emissiveIntensity = 0.55 + Math.sin(performance.now() * 0.004) * 0.35;
          }
        });
      }

      if (record.type === "ice" || record.type === "hulk" || record.type === "boss") {
        record.trailTimer -= dt;
        if (record.trailTimer <= 0) {
          record.trailTimer = record.type === "boss" ? 0.02 : 0.06;
          effects.trail(record.root.position, record.type === "ice" ? 0x6fc4ff : 0xff8a4d, 0.5);
        }
      }

      const dist = record.root.position.length();
      if (shieldActive && dist < STATION.shieldRadius + record.radius) {
        const contact = project(record.root.position);
        effects.ring(contact, 0x4df3ff, 0.6, 2.6, 0.28, 0.7);
        effects.burst(contact, { count: 14, colors: [0x4df3ff, 0xbff6ff], speed: [1, 3.5] });
        if (record.type !== "boss") {
          despawn(record);
          onShieldHit(record);
          continue;
        }
      }
      if (dist < STATION.impactRadius + record.radius) {
        explode(record, true);
        despawn(record);
        onImpact(record);
      }
    }
  }

  function damageNearby(point, radius, amount, exclude) {
    for (const record of [...alive]) {
      if (record === exclude) continue;
      if (record.root.position.distanceTo(point) <= radius + record.radius) {
        damage(record, amount, point);
      }
    }
  }

  return {
    startWave,
    update,
    damage,
    damageNearby,
    clear,
    pending,
    isCleared,
    aliveCount: () => alive.length,
    targets: () => alive.map((r) => r.root),
    remaining: () => pending() + alive.length,
  };
}
