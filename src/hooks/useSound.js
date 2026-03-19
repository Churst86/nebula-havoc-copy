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

// ── External audio track URLs ────────────────────────────────────
const AUDIO_URLS = {
  title:    'https://raw.githubusercontent.com/Churst86/Audio-/main/Brave%20Pilots%20(Menu%20Screen).wav',
  gameover: 'https://raw.githubusercontent.com/Churst86/Audio-/main/Defeated%20(Game%20Over).wav',
  boss:     'https://raw.githubusercontent.com/Churst86/Audio-/main/DeathMatch%20(Boss%20Theme).wav',
  win:      'https://raw.githubusercontent.com/Churst86/Audio-/main/Victory%20Tune%20(Win%20Screen).wav',
  stage:    'https://raw.githubusercontent.com/Churst86/Audio-/main/SkyFire%20(Stage%20Theme).wav',
};

// ── External audio player ────────────────────────────────────────
let currentAudio = null;

function stopExternalAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
}

function playExternalAudio(key, loop = true) {
  stopExternalAudio();
  const url = AUDIO_URLS[key];
  if (!url) return;
  const audio = new Audio(url);
  audio.loop = loop;
  audio.volume = musicEnabled ? musicVolume : 0;
  currentAudio = audio;
  audio.play().catch(err => console.warn('[Music] play failed:', err));
}

// ── Background music state ───────────────────────────────────────
let bgTimeouts = [];
let bgPlaying = false;
let currentWave = 1;
let currentIsBoss = false;

// Pre-baked noise buffer cache to avoid creating buffers every tick
let cachedNoiseBuffer = null;
function getNoiseBuffer(ctx) {
  if (!cachedNoiseBuffer || cachedNoiseBuffer.sampleRate !== ctx.sampleRate) {
    const bufferSize = ctx.sampleRate * 0.5; // 0.5s reusable noise
    cachedNoiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = cachedNoiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  }
  return cachedNoiseBuffer;
}

function playNoiseCheap({ duration = 0.1, gain = 0.2, filterFreq = 1000, useMusicBus = false }) {
  try {
    const ctx = getCtx();
    const source = ctx.createBufferSource();
    source.buffer = getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(gain, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(useMusicBus ? getMusicGain(ctx) : getSfxGain(ctx));
    source.start();
    source.stop(ctx.currentTime + duration);
  } catch {}
}

function stopAllBg() {
  bgPlaying = false;
  bgTimeouts.forEach(t => clearTimeout(t));
  bgTimeouts = [];
  stopExternalAudio();
}

// Music era definitions — change style every 10 waves
function getMusicEra(wave) {
  const era = Math.floor((wave - 1) / 10); // 0=waves1-10, 1=waves11-20, 2=waves21-30...
  const eras = [
    // Era 0: Classic arcade (waves 1-10)
    {
      baseNotes: [55, 55, 65.4, 55, 55, 49, 55, 55],
      leadFn: (w) => w <= 3 ? [220,246.9,261.6,220,196,220,246.9,293.7] : w <= 6 ? [220,261.6,311.1,220,207.7,233.1,311.1,349.2] : [220,277.2,329.6,220,185,220,277.2,370],
      harmNotes: [329.6,349.2,392,329.6,311.1,329.6,392,440],
      leadType: (w) => w > 4 ? 'square' : 'triangle',
      bassType: 'sawtooth',
    },
    // Era 1: Dark industrial (waves 11-20)
    {
      baseNotes: [41.2, 41.2, 43.7, 41.2, 36.7, 41.2, 43.7, 49],
      leadFn: () => [174,185,196,174,164.8,174,196,207.7],
      harmNotes: [246.9,261.6,277.2,246.9,233.1,246.9,277.2,311.1],
      leadType: () => 'sawtooth',
      bassType: 'square',
    },
    // Era 2: Cyberpunk synth (waves 21-30)
    {
      baseNotes: [65.4,65.4,73.4,65.4,61.7,65.4,73.4,82.4],
      leadFn: () => [261.6,293.7,329.6,261.6,246.9,261.6,311.1,349.2],
      harmNotes: [392,415.3,440,392,370,392,440,493.9],
      leadType: () => 'square',
      bassType: 'sawtooth',
    },
    // Era 3: Chaotic dissonance (waves 31+)
    {
      baseNotes: [55,58.3,55,51.9,55,58.3,51.9,49],
      leadFn: () => [233.1,261.6,233.1,220,246.9,261.6,220,207.7],
      harmNotes: [349.2,370,349.2,329.6,370,392,329.6,311.1],
      leadType: () => 'sawtooth',
      bassType: 'square',
    },
  ];
  return eras[Math.min(era, eras.length - 1)];
}

// Wave music: plays external SkyFire track
function startWaveMusic(wave) {
  stopAllBg();
  bgPlaying = true;
  currentWave = wave;
  playExternalAudio('stage', true);
  return; // skip synthesized music below
  bgPlaying = true; // unreachable — kept to avoid removing the block below

   try {
     const ctx = getCtx();
     const master = getMusicGain(ctx);

    const intensity = Math.min(wave / 10, 1); // 0..1
    const tempo = Math.max(0.08, 0.22 - intensity * 0.12);
    const masterVol = 0.08 + intensity * 0.06;

    const localGain = ctx.createGain();
    localGain.gain.value = masterVol;
    localGain.connect(master);

    const era = getMusicEra(wave);
    const baseNotes = era.baseNotes;
    const leadNotes = era.leadFn(wave);
    const harmNotes = era.harmNotes;

    let step = 0;

    function tick() {
      if (!bgPlaying) return;
      const t = ctx.currentTime;

      if (step % 2 === 0) {
        playNoiseCheap({ duration: tempo * 0.6, gain: 0.12 + intensity * 0.1, filterFreq: 80, useMusicBus: true });
      }

      const bass = ctx.createOscillator();
      const bassGain = ctx.createGain();
      bass.type = era.bassType;
      bass.frequency.value = baseNotes[step % baseNotes.length];
      bassGain.gain.setValueAtTime(0.35 + intensity * 0.15, t);
      bassGain.gain.exponentialRampToValueAtTime(0.001, t + tempo * 0.85);
      bass.connect(bassGain); bassGain.connect(localGain);
      bass.start(t); bass.stop(t + tempo);

      const lead = ctx.createOscillator();
      const leadGain = ctx.createGain();
      lead.type = era.leadType(wave);
      lead.frequency.value = leadNotes[step % leadNotes.length];
      lead.detune.value = intensity * 12;
      leadGain.gain.setValueAtTime(0.18 + intensity * 0.12, t);
      leadGain.gain.exponentialRampToValueAtTime(0.001, t + tempo * 0.7);
      lead.connect(leadGain); leadGain.connect(localGain);
      lead.start(t); lead.stop(t + tempo);

      if (wave >= 6) {
        const harm = ctx.createOscillator();
        const harmGain = ctx.createGain();
        harm.type = 'sawtooth';
        harm.frequency.value = harmNotes[step % harmNotes.length];
        harm.detune.value = -intensity * 8;
        harmGain.gain.setValueAtTime(0.1 + intensity * 0.08, t);
        harmGain.gain.exponentialRampToValueAtTime(0.001, t + tempo * 0.6);
        harm.connect(harmGain); harmGain.connect(localGain);
        harm.start(t); harm.stop(t + tempo);
      }

      if (wave >= 4) {
        playNoiseCheap({ duration: 0.03, gain: 0.04 + intensity * 0.04, filterFreq: 8000, useMusicBus: true });
        if (wave >= 8) {
          bgTimeouts.push(setTimeout(() => {
            if (bgPlaying) playNoiseCheap({ duration: 0.02, gain: 0.03, filterFreq: 10000, useMusicBus: true });
          }, tempo * 500));
        }
      }

      step++;
      bgTimeouts.push(setTimeout(tick, tempo * 1000));
    }

    tick();
  } catch {}
}

// Boss music: plays external DeathMatch track
function startBossMusic() {
  stopAllBg();
  bgPlaying = true;
  currentIsBoss = true;
  playExternalAudio('boss', true);
  return; // skip synthesized music below
  bgPlaying = true; // unreachable — kept to avoid removing the block below

  try {
    const ctx = getCtx();
    const bossLocalGain = ctx.createGain();
    bossLocalGain.gain.value = 0.14;
    bossLocalGain.connect(getMusicGain(ctx));

    const bassNotes  = [55, 55, 73.4, 55, 55, 49, 55, 55];
    const melNotes   = [220, 246.9, 261.6, 220, 196, 220, 246.9, 261.6];
    const chromatic  = [233.1, 261.6, 277.2, 233.1, 220, 233.1, 277.2, 311.1];
    const tempo = 0.10; // very fast
    let step = 0;

    function tick() {
      if (!bgPlaying) return;
      const t = ctx.currentTime;

      // Heavy kick on every beat
      playNoiseCheap({ duration: 0.12, gain: 0.25, filterFreq: 80, useMusicBus: true });

      const bass = ctx.createOscillator();
      const bassGain = ctx.createGain();
      bass.type = 'sawtooth';
      bass.frequency.value = bassNotes[step % bassNotes.length];
      bassGain.gain.setValueAtTime(0.5, t);
      bassGain.gain.exponentialRampToValueAtTime(0.001, t + tempo * 0.9);
      bass.connect(bassGain); bassGain.connect(bossLocalGain);
      bass.start(t); bass.stop(t + tempo);

      const lead = ctx.createOscillator();
      const leadGain = ctx.createGain();
      lead.type = 'square';
      lead.frequency.value = melNotes[step % melNotes.length];
      leadGain.gain.setValueAtTime(0.25, t);
      leadGain.gain.exponentialRampToValueAtTime(0.001, t + tempo * 0.7);
      lead.connect(leadGain); leadGain.connect(bossLocalGain);
      lead.start(t); lead.stop(t + tempo);

      // Chromatic dissonance layer
      const chrom = ctx.createOscillator();
      const chromGain = ctx.createGain();
      chrom.type = 'sawtooth';
      chrom.frequency.value = chromatic[step % chromatic.length];
      chrom.detune.value = 15;
      chromGain.gain.setValueAtTime(0.15, t);
      chromGain.gain.exponentialRampToValueAtTime(0.001, t + tempo * 0.6);
      chrom.connect(chromGain); chromGain.connect(bossLocalGain);
      chrom.start(t); chrom.stop(t + tempo);

      // 16th hat
      playNoiseCheap({ duration: 0.02, gain: 0.06, filterFreq: 10000, useMusicBus: true });

      step++;
      bgTimeouts.push(setTimeout(tick, tempo * 1000));
    }
    tick();
  } catch {}
}

let musicVolume = 0.8;
let sfxVolume = 0.8;
let isPausedDucked = false;
let musicEnabled = true;

// Separate gain nodes for music vs SFX
let musicGainNode = null;
let sfxGainNode = null;

function getMusicGain(ctx) {
  if (!musicGainNode || musicGainNode.context !== ctx) {
    musicGainNode = ctx.createGain();
    musicGainNode.gain.value = musicVolume;
    musicGainNode.connect(ctx.destination);
  }
  return musicGainNode;
}

function getSfxGain(ctx) {
  if (!sfxGainNode || sfxGainNode.context !== ctx) {
    sfxGainNode = ctx.createGain();
    sfxGainNode.gain.value = sfxVolume;
    sfxGainNode.connect(ctx.destination);
  }
  return sfxGainNode;
}

// Patch playTone/playNoise to route through SFX gain
function playToneSfx({ freq = 440, type = 'sine', duration = 0.1, gain = 0.3, freqEnd, detune = 0 }) {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.connect(gainNode);
    gainNode.connect(getSfxGain(ctx));
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

function playNoiseSfx({ duration = 0.1, gain = 0.2, filterFreq = 1000 }) {
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
    gainNode.connect(getSfxGain(ctx));
    source.start();
    source.stop(ctx.currentTime + duration);
  } catch {}
}

export const sounds = {
  setMusicVolume(vol) {
    musicVolume = Math.max(0, Math.min(1, vol));
    if (currentAudio) currentAudio.volume = musicEnabled ? musicVolume : 0;
    try {
      const ctx = getCtx();
      getMusicGain(ctx).gain.setTargetAtTime(isPausedDucked ? musicVolume * 0.1 : musicVolume, ctx.currentTime, 0.1);
    } catch {}
  },
  setSfxVolume(vol) {
    sfxVolume = Math.max(0, Math.min(1, vol));
    try {
      const ctx = getCtx();
      getSfxGain(ctx).gain.setTargetAtTime(sfxVolume, ctx.currentTime, 0.1);
    } catch {}
  },
  // Legacy compat
  setMasterVolume(vol) { this.setMusicVolume(vol); this.setSfxVolume(vol); },
  setPauseVolume(paused) {
    isPausedDucked = paused;
    try {
      const ctx = getCtx();
      getMusicGain(ctx).gain.setTargetAtTime(paused ? musicVolume * 0.1 : musicVolume, ctx.currentTime, 0.15);
    } catch {}
  },
  shoot()        { playToneSfx({ freq: 880, type: 'square', duration: 0.06, gain: 0.08, freqEnd: 440 }); },
  hit()          { playNoiseSfx({ duration: 0.08, gain: 0.15, filterFreq: 800 }); },
  kill() {
    playToneSfx({ freq: 220, type: 'sawtooth', duration: 0.15, gain: 0.2, freqEnd: 80 });
    playNoiseSfx({ duration: 0.15, gain: 0.25, filterFreq: 300 });
  },
  killDropper() {
    playToneSfx({ freq: 440, type: 'sawtooth', duration: 0.2, gain: 0.3, freqEnd: 110 });
    playToneSfx({ freq: 660, type: 'square', duration: 0.2, gain: 0.2, freqEnd: 220 });
    playNoiseSfx({ duration: 0.25, gain: 0.3, filterFreq: 500 });
  },
  powerup() {
    [0, 0.06, 0.12, 0.18].forEach((t, i) => {
      setTimeout(() => playToneSfx({ freq: 330 + i * 110, type: 'sine', duration: 0.1, gain: 0.25 }), t * 1000);
    });
  },
  shield()       { playToneSfx({ freq: 200, type: 'sine', duration: 0.3, gain: 0.3, freqEnd: 600 }); },
  shieldHit()    { playToneSfx({ freq: 600, type: 'triangle', duration: 0.12, gain: 0.3, freqEnd: 200 }); },
  shieldBreak() {
    playNoiseSfx({ duration: 0.4, gain: 0.4, filterFreq: 400 });
    playToneSfx({ freq: 150, type: 'sawtooth', duration: 0.4, gain: 0.3, freqEnd: 50 });
  },
  playerHit() {
    playNoiseSfx({ duration: 0.3, gain: 0.4, filterFreq: 200 });
    playToneSfx({ freq: 100, type: 'sawtooth', duration: 0.3, gain: 0.3, freqEnd: 40 });
  },
  waveComplete() {
    [0, 0.1, 0.2].forEach((t, i) => {
      setTimeout(() => playToneSfx({ freq: 440 + i * 220, type: 'sine', duration: 0.15, gain: 0.2 }), t * 1000);
    });
  },

  // Called by GameCanvas on every wave start
  startWaveMusic(wave) { startWaveMusic(wave); },
  startBossMusic()     { startBossMusic(); },
  stopBossMusic()      { stopAllBg(); },
  stopAllMusic()       { stopAllBg(); },

  // External track helpers for screens
  playTitleMusic()   { playExternalAudio('title',    true);  },
  playGameOverMusic(){ playExternalAudio('gameover', false); },
  playWinMusic()     { playExternalAudio('win',      false); },

  // Music on/off toggle
  setMusicEnabled(enabled) {
    musicEnabled = enabled;
    if (currentAudio) currentAudio.volume = enabled ? musicVolume : 0;
  },
};