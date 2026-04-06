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
  gameover: 'https://raw.githubusercontent.com/Churst86/Audio-/main/Defeated%20(Game%20Over%20Tune).wav',
  boss:     'https://raw.githubusercontent.com/Churst86/Audio-/main/DeathMatch%20(Boss%20Theme).wav',
  win:      'https://raw.githubusercontent.com/Churst86/Audio-/main/Victory%20Tune.wav',
  stage:    'https://raw.githubusercontent.com/Churst86/Audio-/main/SkyFire%20(Title%20Screen).wav',
};

// ── External audio player ────────────────────────────────────────
let currentAudio = null;
let fadeOutInterval = null;
let fadeInInterval = null;
let pendingGestureRetryDetach = null;

function clearPendingGestureRetry() {
  if (typeof pendingGestureRetryDetach === 'function') {
    pendingGestureRetryDetach();
    pendingGestureRetryDetach = null;
  }
}

function isAutoplayGestureError(err) {
  const name = err?.name || '';
  const message = String(err?.message || '').toLowerCase();
  return name === 'NotAllowedError' || message.includes('user gesture') || message.includes('not allowed');
}

function attachGestureRetry(audio) {
  clearPendingGestureRetry();
  const retry = () => {
    try {
      getCtx().resume().catch(() => {});
    } catch {}
    audio.play().catch(() => {});
    clearPendingGestureRetry();
  };

  const events = ['pointerdown', 'keydown', 'touchstart', 'click'];
  events.forEach((eventName) => window.addEventListener(eventName, retry, { once: true, capture: true }));
  pendingGestureRetryDetach = () => {
    events.forEach((eventName) => window.removeEventListener(eventName, retry, { capture: true }));
  };
}

function clearFades() {
  if (fadeOutInterval) { clearInterval(fadeOutInterval); fadeOutInterval = null; }
  if (fadeInInterval) { clearInterval(fadeInInterval); fadeInInterval = null; }
}

function stopExternalAudio() {
  clearFades();
  clearPendingGestureRetry();
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
}

function playExternalAudio(key, loop = true) {
  clearFades();
  const url = AUDIO_URLS[key];
  if (!url) return;

  const targetVol = musicEnabled ? musicVolume : 0;

  // Fade out current track, then fade in new one
  if (currentAudio && !currentAudio.paused) {
    const outAudio = currentAudio;
    const step = outAudio.volume / 30;
    fadeOutInterval = setInterval(() => {
      if (outAudio.volume > step) {
        outAudio.volume = Math.max(0, outAudio.volume - step);
      } else {
        outAudio.pause();
        outAudio.currentTime = 0;
        clearInterval(fadeOutInterval);
        fadeOutInterval = null;
        startNewTrack(url, loop, targetVol);
      }
    }, 50);
  } else {
    stopExternalAudio();
    startNewTrack(url, loop, targetVol);
  }
}

function startNewTrack(url, loop, targetVol) {
  clearFades();
  clearPendingGestureRetry();
  const audio = new Audio(url);
  audio.loop = loop;
  audio.volume = 0;
  currentAudio = audio;
  // Skip first 5 seconds for title track
  if (url.includes('Brave%20Pilots')) audio.currentTime = 5;
  audio.play().catch((err) => {
    if (isAutoplayGestureError(err)) {
      attachGestureRetry(audio);
      return;
    }
    console.warn('[Music] play failed:', err);
  });
  // Fade in
  const step = targetVol / 35;
  fadeInInterval = setInterval(() => {
    if (audio.volume < targetVol - step) {
      audio.volume = Math.min(targetVol, audio.volume + step);
    } else {
      audio.volume = targetVol;
      clearInterval(fadeInInterval);
      fadeInInterval = null;
    }
  }, 50);
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
  currentWave = wave;
  // If stage music is already playing (not a boss or title), just let it continue
  if (bgPlaying && !currentIsBoss && currentAudio && currentAudio.src && currentAudio.src.includes('SkyFire')) return;
  stopAllBg();
  bgPlaying = true;
  currentIsBoss = false;
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
  unlockAudio() {
    try {
      const ctx = getCtx();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    } catch {}
    if (currentAudio && currentAudio.paused) {
      currentAudio.play().catch(() => {});
    }
  },
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
  weaponPickup() {
    try {
      const ctx = getCtx();
      const sg = getSfxGain(ctx);
      const now = ctx.currentTime;

      // 1) Heavy metal CLANK — sharp noise burst + low body thud, simultaneous
      // Noise transient (the hard "clank" attack)
      (() => {
        const bufSize = ctx.sampleRate * 0.06;
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 2);
        const src = ctx.createBufferSource(); src.buffer = buf;
        const filt = ctx.createBiquadFilter(); filt.type = 'highpass'; filt.frequency.value = 1800;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.9, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        src.connect(filt); filt.connect(g); g.connect(sg);
        src.start(now);
      })();
      // Body resonance thud
      (() => {
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(120, now); o.frequency.exponentialRampToValueAtTime(30, now + 0.18);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.7, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        o.connect(g); g.connect(sg); o.start(now); o.stop(now + 0.18);
      })();

      // 2) Bolt/ratchet click at 80ms — dry mechanical snap
      setTimeout(() => {
        try {
          const c = getCtx(); const s = getSfxGain(c); const t = c.currentTime;
          const bufSize = c.sampleRate * 0.025;
          const buf = c.createBuffer(1, bufSize, c.sampleRate);
          const d = buf.getChannelData(0);
          for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1) * (i < bufSize * 0.15 ? 1 : Math.pow(1 - i / bufSize, 3));
          const src = c.createBufferSource(); src.buffer = buf;
          const filt = c.createBiquadFilter(); filt.type = 'peaking'; filt.frequency.value = 2800; filt.gain.value = 12;
          const g = c.createGain(); g.gain.setValueAtTime(0.8, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
          src.connect(filt); filt.connect(g); g.connect(s); src.start(t);
        } catch {}
      }, 80);

      // 3) Gritty motor grind — detuned saws through bandpass, 160ms
      setTimeout(() => {
        try {
          const c = getCtx(); const s = getSfxGain(c); const t = c.currentTime;
          [0, 7, -5].forEach(detune => {
            const o = c.createOscillator(); o.type = 'sawtooth';
            o.frequency.setValueAtTime(95, t); o.frequency.linearRampToValueAtTime(340, t + 0.22);
            o.detune.value = detune;
            const filt = c.createBiquadFilter(); filt.type = 'bandpass'; filt.frequency.value = 700; filt.Q.value = 4;
            const g = c.createGain(); g.gain.setValueAtTime(0.0, t); g.gain.linearRampToValueAtTime(0.22, t + 0.04);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
            o.connect(filt); filt.connect(g); g.connect(s); o.start(t); o.stop(t + 0.25);
          });
          // Grinding noise layer
          playNoiseSfx({ duration: 0.22, gain: 0.18, filterFreq: 600 });
        } catch {}
      }, 160);

      // 4) Second hard clank / lock-in at 400ms
      setTimeout(() => {
        try {
          const c = getCtx(); const s = getSfxGain(c); const t = c.currentTime;
          const bufSize = c.sampleRate * 0.05;
          const buf = c.createBuffer(1, bufSize, c.sampleRate);
          const d = buf.getChannelData(0);
          for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 1.5);
          const src = c.createBufferSource(); src.buffer = buf;
          const filt = c.createBiquadFilter(); filt.type = 'bandpass'; filt.frequency.value = 2200; filt.Q.value = 1.5;
          const g = c.createGain(); g.gain.setValueAtTime(0.65, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
          src.connect(filt); filt.connect(g); g.connect(s); src.start(t);
          // Low thud underneath
          const o = c.createOscillator(); o.type = 'square';
          o.frequency.setValueAtTime(80, t); o.frequency.exponentialRampToValueAtTime(25, t + 0.1);
          const og = c.createGain(); og.gain.setValueAtTime(0.5, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
          o.connect(og); og.connect(s); o.start(t); o.stop(t + 0.1);
        } catch {}
      }, 400);

      // 5) Power-on hum rising to a short electronic confirm, 520ms
      setTimeout(() => {
        try {
          const c = getCtx(); const s = getSfxGain(c); const t = c.currentTime;
          // Rising hum
          const hum = c.createOscillator(); hum.type = 'sawtooth';
          hum.frequency.setValueAtTime(60, t); hum.frequency.exponentialRampToValueAtTime(220, t + 0.15);
          const hg = c.createGain(); hg.gain.setValueAtTime(0.0, t); hg.gain.linearRampToValueAtTime(0.18, t + 0.08);
          hg.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
          hum.connect(hg); hg.connect(s); hum.start(t); hum.stop(t + 0.2);
          // Short square blip confirm
          [{ f: 440, d: 0.12 }, { f: 660, d: 0.10 }].forEach(({ f, d }, i) => {
            const o = c.createOscillator(); o.type = 'square';
            o.frequency.value = f;
            const og = c.createGain(); og.gain.setValueAtTime(0.15, t + i * 0.1); og.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + d);
            o.connect(og); og.connect(s); o.start(t + i * 0.1); o.stop(t + i * 0.1 + d);
          });
        } catch {}
      }, 520);
    } catch {}
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
  invinciblePowerdown() {
    // Descending alarm: power winding down
    [0, 0.12, 0.24, 0.36, 0.48].forEach((t, i) => {
      setTimeout(() => {
        playToneSfx({ freq: 600 - i * 80, type: 'sine', duration: 0.18, gain: 0.18, freqEnd: 400 - i * 60 });
      }, t * 1000);
    });
    playNoiseSfx({ duration: 0.6, gain: 0.08, filterFreq: 300 });
  },

  // Called by GameCanvas on every wave start
  startWaveMusic(wave) { startWaveMusic(wave); },
  startBossMusic()     { startBossMusic(); },
  ensureBossMusic() {
    const onBossTrack = !!(currentAudio && currentAudio.src && currentAudio.src.includes('DeathMatch%20(Boss%20Theme).wav'));
    const bossAudioActive = !!(onBossTrack && !currentAudio.paused);
    if (!currentIsBoss || !bgPlaying || !bossAudioActive) startBossMusic();
  },
  stopBossMusic()      { /* keep playing through continue screen */ },
  stopBossMusicOnClear() { stopAllBg(); },
  stopAllMusic()       { stopAllBg(); },

  // External track helpers for screens
  playTitleMusic()   { playExternalAudio('title', true);  },
  playGameOverMusic(){ playExternalAudio('gameover', false); },
  playWinMusic()     { playExternalAudio('win',      false); },

  // Preload a track into browser cache without playing it
  preloadMusic(key) {
    const url = AUDIO_URLS[key];
    if (!url) return;
    const a = new Audio();
    a.preload = 'auto';
    a.src = url;
  },

  // Music on/off toggle
  setMusicEnabled(enabled) {
    musicEnabled = enabled;
    if (currentAudio) currentAudio.volume = enabled ? musicVolume : 0;
  },
};