/* Procedural WebAudio SFX, no assets. Context unlocks on first gesture. */
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    return true;
  }

  function unlock() {
    if (!ensure()) return;
    if (ctx.state === "suspended") ctx.resume();
  }

  function tone({ freq = 440, freqEnd = null, type = "sine", dur = 0.15, gain = 0.25 }) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqEnd), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  let noiseBuffer = null;
  function noise({ dur = 0.3, cutoff = 900, cutoffEnd = 120, gain = 0.35, q = 0.8 }) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    if (!noiseBuffer) {
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = q;
    filter.frequency.setValueAtTime(cutoff, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, cutoffEnd), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  const names = {
    pulse: () => tone({ freq: 880, freqEnd: 320, type: "square", dur: 0.09, gain: 0.12 }),
    lance: () => {
      tone({ freq: 220, freqEnd: 70, type: "sawtooth", dur: 0.28, gain: 0.2 });
      tone({ freq: 1200, freqEnd: 300, type: "square", dur: 0.12, gain: 0.06 });
    },
    hit: () => tone({ freq: 300, freqEnd: 140, type: "triangle", dur: 0.07, gain: 0.14 }),
    miss: () => tone({ freq: 200, freqEnd: 90, type: "sine", dur: 0.08, gain: 0.05 }),
    explode: () => noise({ dur: 0.45, cutoff: 1400, cutoffEnd: 120, gain: 0.4 }),
    explodeBig: () => {
      noise({ dur: 0.9, cutoff: 1800, cutoffEnd: 60, gain: 0.55 });
      tone({ freq: 120, freqEnd: 40, type: "sine", dur: 0.7, gain: 0.3 });
    },
    shieldOn: () => {
      tone({ freq: 260, freqEnd: 980, type: "sine", dur: 0.35, gain: 0.18 });
    },
    shieldHit: () => tone({ freq: 700, freqEnd: 220, type: "triangle", dur: 0.18, gain: 0.16 }),
    focus: () => tone({ freq: 900, freqEnd: 180, type: "sine", dur: 0.5, gain: 0.14 }),
    overheat: () => tone({ freq: 300, freqEnd: 60, type: "sawtooth", dur: 0.4, gain: 0.2 }),
    alarm: () => {
      tone({ freq: 520, type: "square", dur: 0.16, gain: 0.16 });
      setTimeout(() => tone({ freq: 380, type: "square", dur: 0.22, gain: 0.16 }), 140);
    },
    waveStart: () => {
      tone({ freq: 440, type: "triangle", dur: 0.12, gain: 0.14 });
      setTimeout(() => tone({ freq: 660, type: "triangle", dur: 0.16, gain: 0.14 }), 110);
    },
    boss: () => {
      tone({ freq: 90, freqEnd: 55, type: "sawtooth", dur: 1.1, gain: 0.3 });
      const iv = setInterval(() => tone({ freq: 180, type: "square", dur: 0.1, gain: 0.08 }), 320);
      setTimeout(() => clearInterval(iv), 1400);
    },
    win: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone({ freq: f, type: "triangle", dur: 0.3, gain: 0.16 }), i * 140)),
    lose: () => [392, 330, 262].forEach((f, i) => setTimeout(() => tone({ freq: f, type: "sawtooth", dur: 0.4, gain: 0.16 }), i * 180)),
    click: () => tone({ freq: 600, freqEnd: 400, type: "triangle", dur: 0.06, gain: 0.1 }),
  };

  function play(name) {
    if (!names[name]) return;
    names[name]();
  }

  function setMuted(value) {
    muted = Boolean(value);
    if (master) master.gain.value = muted ? 0 : 0.5;
  }

  return { play, unlock, setMuted, isMuted: () => muted };
}
