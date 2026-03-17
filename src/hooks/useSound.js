// Web Audio API sound engine — no external files needed
let audioCtx = null;

function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playTone({ freq = 440, type = 'sine', duration = 0.1, gain = 0.3, freqEnd, detune = 0 }) {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.detune.setValueAtTime(detune, ctx.currentTime);
    if (freqEnd !== undefined) osc.frequency.linearRampToValueAtTime(freqEnd, ctx.currentTime + duration);
    gainNode.gain.setValueAtTime(gain, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {}
}

function playNoise({ duration = 0.1, gain = 0.2, filterFreq = 1000 }) {
  try {
    const ctx = getCtx();
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(gain, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);
    source.start();
    source.stop(ctx.currentTime + duration);
  } catch {}
}

// Boss music oscillator refs
let bossOscs = [];
let bossPlaying = false;

export const sounds = {
  shoot() { playTone({ freq: 880, type: 'square', duration: 0.06, gain: 0.08, freqEnd: 440 }); },
  hit() { playNoise({ duration: 0.08, gain: 0.15, filterFreq: 800 }); },
  kill() {
    playTone({ freq: 220, type: 'sawtooth', duration: 0.15, gain: 0.2, freqEnd: 80 });
    playNoise({ duration: 0.15, gain: 0.25, filterFreq: 300 });
  },
  killDropper() {
    playTone({ freq: 440, type: 'sawtooth', duration: 0.2, gain: 0.3, freqEnd: 110 });
    playTone({ freq: 660, type: 'square', duration: 0.2, gain: 0.2, freqEnd: 220 });
    playNoise({ duration: 0.25, gain: 0.3, filterFreq: 500 });
  },
  powerup() {
    [0, 0.06, 0.12, 0.18].forEach((t, i) => {
      setTimeout(() => playTone({ freq: 330 + i * 110, type: 'sine', duration: 0.1, gain: 0.25 }), t * 1000);
    });
  },
  shield() {
    playTone({ freq: 200, type: 'sine', duration: 0.3, gain: 0.3, freqEnd: 600 });
    playTone({ freq: 400, type: 'sine', duration: 0.3, gain: 0.2, freqEnd: 1200, detune: 5 });
  },
  shieldHit() {
    playTone({ freq: 600, type: 'triangle', duration: 0.12, gain: 0.3, freqEnd: 200 });
    playNoise({ duration: 0.1, gain: 0.1, filterFreq: 2000 });
  },
  shieldBreak() {
    playNoise({ duration: 0.4, gain: 0.4, filterFreq: 400 });
    playTone({ freq: 150, type: 'sawtooth', duration: 0.4, gain: 0.3, freqEnd: 50 });
  },
  playerHit() {
    playNoise({ duration: 0.3, gain: 0.4, filterFreq: 200 });
    playTone({ freq: 100, type: 'sawtooth', duration: 0.3, gain: 0.3, freqEnd: 40 });
  },
  waveComplete() {
    [0, 0.1, 0.2].forEach((t, i) => {
      setTimeout(() => playTone({ freq: 440 + i * 220, type: 'sine', duration: 0.15, gain: 0.2 }), t * 1000);
    });
  },

  startBossMusic() {
    if (bossPlaying) return;
    bossPlaying = true;
    try {
      const ctx = getCtx();
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.12, ctx.currentTime);
      masterGain.connect(ctx.destination);

      const bassNotes = [55, 55, 73.4, 55, 55, 49, 55, 55];
      const melodyNotes = [220, 246.9, 261.6, 220, 196, 220, 246.9, 261.6];
      let step = 0;
      const tempo = 0.22;

      function tick() {
        if (!bossPlaying) return;
        const t = ctx.currentTime;

        // Bass
        const bass = ctx.createOscillator();
        const bassGain = ctx.createGain();
        bass.type = 'sawtooth';
        bass.frequency.value = bassNotes[step % bassNotes.length];
        bassGain.gain.setValueAtTime(0.4, t);
        bassGain.gain.exponentialRampToValueAtTime(0.001, t + tempo * 0.9);
        bass.connect(bassGain); bassGain.connect(masterGain);
        bass.start(t); bass.stop(t + tempo);

        // Lead melody
        const lead = ctx.createOscillator();
        const leadGain = ctx.createGain();
        lead.type = 'square';
        lead.frequency.value = melodyNotes[step % melodyNotes.length];
        leadGain.gain.setValueAtTime(0.2, t);
        leadGain.gain.exponentialRampToValueAtTime(0.001, t + tempo * 0.7);
        lead.connect(leadGain); leadGain.connect(masterGain);
        lead.start(t); lead.stop(t + tempo);

        step++;
        bossOscs.push(setTimeout(tick, tempo * 1000));
      }
      tick();
    } catch {}
  },

  stopBossMusic() {
    bossPlaying = false;
    bossOscs.forEach(t => clearTimeout(t));
    bossOscs = [];
  },
};