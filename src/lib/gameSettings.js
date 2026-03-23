// Persistent game settings stored in localStorage
const LS_KEY = 'voidstorm_settings';
const SAVE_KEY = 'voidstorm_save';

const DEFAULTS = {
  musicVolume: 0.8,
  sfxVolume: 0.8,
  musicEnabled: true,
  brightness: 1.0,
  difficulty: 'normal', // 'easy' | 'normal' | 'hell'
  gameSpeed: 30, // fps: 15–120
  mobileSpeed: 1.0, // joystick sensitivity multiplier: 0.5–2.0
  joystickVisible: true,
  joystickSize: 1.0,
  motionControlEnabled: false,
};

export function loadSaveFile() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeSaveFile(data) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

export function deleteSaveFile() {
  localStorage.removeItem(SAVE_KEY);
}

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
    desc: 'Enemies have 5× HP. Max wave 50.',
    hpMult: 5,
    maxWave: 50,
    blockSpeedMult: 1.8,
    blockSpawnMult: 1.6,
  },
  hell: {
    label: 'Hell',
    color: '#ff2244',
    desc: 'Enemies have 10× HP. Faster blocks. Max wave 100.',
    hpMult: 10,
    maxWave: 100,
    blockSpeedMult: 2.8,
    blockSpawnMult: 2.2,
  },
};