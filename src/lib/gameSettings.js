// Persistent game settings stored in localStorage
const LS_KEY = 'voidstorm_settings';
const SAVE_KEY = 'voidstorm_save';
const SAVE_SLOTS = ['slot1', 'slot2', 'slot3'];

const EMPTY_SAVE_STATE = {
  version: 2,
  auto: null,
  slots: {
    slot1: null,
    slot2: null,
    slot3: null,
  },
};

const DEFAULTS = {
  musicVolume: 0.3,
  sfxVolume: 0.8,
  musicEnabled: true,
  brightness: 1.5,
  difficulty: 'easy', // 'easy' | 'normal' | 'hell'
  unlockedDifficulty: 'easy', // progression lock: easy -> normal -> hell
  gameSpeed: 120, // fps: 15–120
  hudSpeedBoostsUnlocked: false,
  bossModeUnlocked: false,
  mobileSpeed: 1.0, // joystick sensitivity multiplier: 0.5–2.0
  joystickVisible: true,
  joystickSize: 1.0,
  autoFireEnabled: true,
  motionControlEnabled: false,
  motionInvertX: true,
  motionInvertY: false,
  accelerometerSpeed: 1.0, // accelerometer speed multiplier: 1–10
};

export function loadAllSaveFiles() {
  const state = readSaveState();
  return {
    auto: state.auto,
    slot1: state.slots.slot1,
    slot2: state.slots.slot2,
    slot3: state.slots.slot3,
  };
}

export function loadSaveFile(slot = 'auto') {
  const state = readSaveState();
  if (slot === 'auto') return state.auto;
  if (!SAVE_SLOTS.includes(slot)) return null;
  return state.slots[slot] || null;
}

export function writeSaveFile(data, slot = 'auto') {
  console.log(`[writeSaveFile] Writing to slot: ${slot}`, data);
  try {
    const state = readSaveState();
    console.log(`[writeSaveFile] Current state:`, state);
    const normalized = normalizeSaveEntry(data);
    console.log(`[writeSaveFile] Normalized entry:`, normalized);
    
    if (slot === 'auto') {
      state.auto = normalized;
    } else if (SAVE_SLOTS.includes(slot)) {
      console.log(`[writeSaveFile] Slot ${slot} is valid (in SAVE_SLOTS)`);
      state.slots[slot] = normalized;
    } else {
      console.error(`[writeSaveFile] Invalid slot: ${slot}. Valid slots: ${SAVE_SLOTS.join(', ')}`);
      return false;
    }
    
    console.log(`[writeSaveFile] Updated state before write:`, state);
    writeSaveState(state);
    console.log(`[writeSaveFile] Successfully wrote to slot ${slot}`);
    return true;
  } catch (err) {
    console.error(`[writeSaveFile] Error writing to slot ${slot}:`, err);
    return false;
  }
}

export function deleteSaveFile(slot = 'auto') {
  try {
    if (slot === 'all') {
      writeSaveState({ ...EMPTY_SAVE_STATE, slots: { ...EMPTY_SAVE_STATE.slots } });
      return true;
    }
    const state = readSaveState();
    if (slot === 'auto') {
      state.auto = null;
    } else if (SAVE_SLOTS.includes(slot)) {
      state.slots[slot] = null;
    } else {
      return false;
    }
    writeSaveState(state);
    return true;
  } catch {
    return false;
  }
}

function readRawSavePayload() {
  let rawDesktop = null;
  if (window?.desktopApp?.isElectron && typeof window.desktopApp.readSaveSync === 'function') {
    try {
      rawDesktop = window.desktopApp.readSaveSync();
    } catch {
      rawDesktop = null;
    }
  }

  if (rawDesktop) {
    try {
      return JSON.parse(rawDesktop);
    } catch {
      // fall through to localStorage backup
    }
  }

  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeRawSavePayload(payload) {
  const raw = JSON.stringify(payload);
  let desktopSuccess = false;
  let localStorageSuccess = false;
  
  // Try to write to desktop file
  if (window?.desktopApp?.isElectron && typeof window.desktopApp.writeSaveSync === 'function') {
    try {
      window.desktopApp.writeSaveSync(raw);
      desktopSuccess = true;
    } catch (err) {
      console.warn('[Save] Desktop file write failed:', err?.message);
    }
  }
  
  // Always write to localStorage as backup
  try {
    localStorage.setItem(SAVE_KEY, raw);
    localStorageSuccess = true;
  } catch (err) {
    console.error('[Save] localStorage write failed:', err?.message);
  }
  
  // Log write status for debugging
  if (desktopSuccess || localStorageSuccess) {
    console.log('[Save] Save written successfully', { desktopSuccess, localStorageSuccess });
  } else {
    console.error('[Save] All write attempts failed!');
  }
  
  return desktopSuccess || localStorageSuccess;
}

function normalizeSaveEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  return {
    wave: Math.max(1, Number(entry.wave) || 1),
    difficulty: typeof entry.difficulty === 'string' ? entry.difficulty : 'easy',
    powerups: entry.powerups && typeof entry.powerups === 'object' ? entry.powerups : {},
    shopUpgrades: entry.shopUpgrades && typeof entry.shopUpgrades === 'object' ? entry.shopUpgrades : {},
    blockScore: Math.max(0, Number(entry.blockScore) || 0),
    savedAt: Number(entry.savedAt) || Date.now(),
  };
}

function normalizeSaveState(payload) {
  const base = { ...EMPTY_SAVE_STATE, slots: { ...EMPTY_SAVE_STATE.slots } };
  if (!payload || typeof payload !== 'object') return base;

  // Legacy migration: old single-save format becomes autosave slot.
  if (Object.prototype.hasOwnProperty.call(payload, 'wave')) {
    base.auto = normalizeSaveEntry(payload);
    return base;
  }

  const auto = normalizeSaveEntry(payload.auto);
  const slotsPayload = payload.slots && typeof payload.slots === 'object' ? payload.slots : {};
  const slots = { ...base.slots };
  SAVE_SLOTS.forEach((slot) => {
    slots[slot] = normalizeSaveEntry(slotsPayload[slot]);
  });

  return {
    version: 2,
    auto,
    slots,
  };
}

function readSaveState() {
  const payload = readRawSavePayload();
  return normalizeSaveState(payload);
}

// ── Cross-platform save portability ──────────────────────────────────────────

/**
 * Export all save slots to a JSON string for download.
 */
export function exportSavesAsJson() {
  try {
    return JSON.stringify(readSaveState(), null, 2);
  } catch {
    return null;
  }
}

/**
 * Export a single save slot to JSON.
 */
export function exportSaveSlotAsJson(slot = 'slot1') {
  const validSlots = ['auto', ...SAVE_SLOTS];
  if (!validSlots.includes(slot)) return null;

  try {
    const state = readSaveState();
    const slotData = slot === 'auto' ? state.auto : state.slots[slot];
    if (!slotData) return null;

    return JSON.stringify(
      {
        version: 1,
        exportedAt: new Date().toISOString(),
        slot,
        save: slotData,
      },
      null,
      2,
    );
  } catch {
    return null;
  }
}

/**
 * Import saves from a JSON string (e.g. from a file upload).
 * Merge mode (default): only overwrite slots that have data in the import.
 * Replace mode: take every slot from the import, including clearing non-empty ones.
 */
export function importSavesFromJson(jsonString, { replace = false } = {}) {
  if (!jsonString || typeof jsonString !== 'string') {
    return { ok: false, message: 'No data provided.' };
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    return { ok: false, message: 'File is not valid JSON.' };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, message: 'Save file format is unrecognised.' };
  }

  const incoming = normalizeSaveState(parsed);
  let current = readSaveState();

  if (replace) {
    current = incoming;
  } else {
    // Merge: only import slots that have data in the incoming file.
    if (incoming.auto) current.auto = incoming.auto;
    SAVE_SLOTS.forEach((slot) => {
      if (incoming.slots[slot]) current.slots[slot] = incoming.slots[slot];
    });
  }

  try {
    writeSaveState(current);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err?.message || 'Write failed.' };
  }
}

function writeSaveState(state) {
  const success = writeRawSavePayload(normalizeSaveState(state));
  return success;
}

export function verifySaveExists(slot = 'auto') {
  const save = loadSaveFile(slot);
  return save !== null && typeof save === 'object';
}

export function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY));
    const merged = { ...DEFAULTS, ...saved };
    const order = { easy: 1, normal: 2, hell: 3 };
    const unlockedDifficulty = order[merged.unlockedDifficulty] ? merged.unlockedDifficulty : 'easy';
    const requestedDifficulty = order[merged.difficulty] ? merged.difficulty : 'easy';
    const difficulty = order[requestedDifficulty] <= order[unlockedDifficulty]
      ? requestedDifficulty
      : unlockedDifficulty;
    return {
      ...merged,
      unlockedDifficulty,
      difficulty,
      hudSpeedBoostsUnlocked: merged.hudSpeedBoostsUnlocked === true,
      bossModeUnlocked: merged.bossModeUnlocked === true,
    };
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
    blockSpin: false,
    blockSpinMult: 0,
  },
  normal: {
    label: 'Challenging',
    color: '#00f0ff',
    desc: 'Enemies have 5× HP. Max wave 50.',
    hpMult: 5,
    maxWave: 50,
    blockSpeedMult: 1.8,
    blockSpawnMult: 1.6,
    blockSpin: true,
    blockSpinMult: 1,
  },
  hell: {
    label: 'Hell',
    color: '#ff2244',
    desc: 'Enemies have 10× HP. Faster blocks. Max wave 100.',
    hpMult: 10,
    maxWave: 100,
    blockSpeedMult: 2.8,
    blockSpawnMult: 2.2,
    blockSpin: true,
    blockSpinMult: 2.2,
  },
};