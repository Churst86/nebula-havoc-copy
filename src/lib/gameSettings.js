// Persistent game settings stored in localStorage
const LS_KEY = 'voidstorm_settings';

const DEFAULTS = {
  musicVolume: 0.8,
  sfxVolume: 0.8,
  brightness: 1.0,
  difficulty: 'normal', // 'easy' | 'normal' | 'hell'
  gameSpeed: 30, // fps: 15–120
  saveFiles: [
    { name: 'Save 1', wave: 0, powerups: {} },
    { name: 'Save 2', wave: 0, powerups: {} },
    { name: 'Save 3', wave: 0, powerups: {} },
  ],
};

export function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY));
    return { ...DEFAULTS, ...saved };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(LS_KEY, JSON.stringify(settings));
}

// Per-difficulty config
export const DIFFICULTY_CONFIG = {
  easy: {
    label: 'Easy',
    color: '#44ffaa',
    desc: 'Enemies have normal HP. Max wave 25.',
    hpMult: 1,
    maxWave: 25,
    blockSpeedMult: 1,
  },
  normal: {
    label: 'Challenging',
    color: '#00f0ff',
    desc: 'Enemies have 2× HP. Max wave 50.',
    hpMult: 2,
    maxWave: 50,
    blockSpeedMult: 1,
  },
  hell: {
    label: 'Hell',
    color: '#ff2244',
    desc: 'Enemies have 2× HP. Faster blocks. Max wave 100.',
    hpMult: 2,
    maxWave: 100,
    blockSpeedMult: 1.8,
  },
};