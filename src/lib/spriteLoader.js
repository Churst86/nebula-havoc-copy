// Sprite loader — preloads all game sprites from GitHub
import { removeWhiteBackground } from './spriteProcessor.js';
import { removeBlackBackground } from './spriteProcessor.js';

const BASE = 'https://raw.githubusercontent.com/Churst86/Sprites/main/';

/**
 * Loads an image by fetching it as a blob (bypasses canvas CORS tainting),
 * then calls onLoad with the img element ready for pixel manipulation.
 */
function loadImageViaBlobUrl(url, onLoad, onError) {
  fetch(url)
    .then(res => {
      if (!res.ok) throw new Error('fetch failed');
      return res.blob();
    })
    .then(blob => {
      const objectUrl = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        onLoad(img);
        URL.revokeObjectURL(objectUrl);
      };
      img.onerror = onError;
      img.src = objectUrl;
    })
    .catch(onError);
}

function loadSpriteByCandidates(nameCandidates, onLoad, onError) {
  const candidates = Array.isArray(nameCandidates) ? nameCandidates : [nameCandidates];

  const tryNext = (idx) => {
    if (idx >= candidates.length) {
      onError();
      return;
    }

    const candidate = candidates[idx];
    const url = BASE + encodeURIComponent(candidate) + '.png?t=' + Date.now();
    loadImageViaBlobUrl(url, onLoad, () => tryNext(idx + 1));
  };

  tryNext(0);
}

// All sprites are now PNG
const SPRITE_NAMES = [
  'PlayerShip',
  'BasicEnemy',
  'EliteEnemy',
  'GluttonHead',
  'GluttonTail',
  'GluttonBinder',
  'Eater',
  'EaterChomp',
  'Mine',
  'MineExplosion',
  'Wingman',
  'SuperWingman',
  'FangBoss',
  'DreadnoughtBoss',
  'DreadnoughtSpritesheet-table',
  'DreadnoughtHangerDoorOpening',
  'DreadnoughtHangerDoorOpen',
  'BeholderBoss',
  'BeholderBlink',
  'BeholderResting',
  'PirateBoss',
  'FinalBoss',
  'Shopkeeper',
  'Drone',
  'Harvester',
  'Dropper',
  'Spacestation',
  'Shotgun Powerup',
  'Photon Powerup',
  'BounceshotPowerup',
  'Laser Powerup',
  'Missile Powerup',
  'ReverseShot Powerup',
];

const NEEDS_BG_REMOVAL = new Set([
  'Drone', 'Harvester', 'Dropper',
  'Shotgun Powerup', 'BounceshotPowerup', 'Missile Powerup', 'ReverseShot Powerup',
  'GluttonHead', 'GluttonTail', 'GluttonBinder',
  'Eater', 'EaterChomp',
]);

const NEEDS_DARK_BG_REMOVAL = new Set([
  'DreadnoughtSpritesheet-table',
]);

const SPRITE_NAME_ALIASES = {
  GluttonHead: ['GluttonChompingSpritesheet-table-162-240', 'GluttonChompingSpritesheet-table', 'GluttonHead'],
  GluttonTail: ['GluttonTailSpritesheet-table-240-240', 'GluttonTailSpritesheet-table', 'GluttonTail'],
  GluttonBinder: ['GluttonBinderv2', 'GluttonBinder'],
  Eater: ['Eater', 'EaterEnemy'],
  EaterChomp: ['EaterChomp', 'Eater Chomp', 'EaterChomping', 'Eater_Chomp'],
  BeholderBlink: ['BeholderBlink2', 'BeholderBlink'],
  'DreadnoughtSpritesheet-table': ['DreadnoughtSpritesheet-table', 'DreadnoughtSpritesheet-table-430-638'],
  // Prefer corrected/active repo filenames first; keep a small fallback list.
  DreadnoughtHangerDoorOpening: ['DreadnoughtHangerDoorOpening', 'DreadnoughtHangerDoorOpen'],
  DreadnoughtHangerDoorOpen: ['DreadnoughtHangerDoorOpen', 'DreadnoughtHangarDoorOpen'],
};

// Map of wave number → boss sprite name
export const BOSS_SPRITE_MAP = {
  5:  'FangBoss',
  10: 'DreadnoughtBoss',
  15: 'BeholderBoss',
  20: 'PirateBoss',
  25: 'FinalBoss',
};

// Fallback: cycle through bosses for waves beyond 25 (every 5 waves)
export function getBossSpriteKey(wave) {
  const keys = [5, 10, 15, 20, 25];
  const idx = ((Math.floor(wave / 5) - 1) % keys.length + keys.length) % keys.length;
  return BOSS_SPRITE_MAP[keys[idx]];
}

const sprites = {};
let _loadStarted = false;
let _loadComplete = false;
const _completionCallbacks = [];
const _progressCallbacks = [];
const _retryingSprites = new Set();
const _spriteRetryAttempts = {};

export function loadSprites(onComplete, onProgress) {
  // If already fully loaded, fire callbacks immediately
  if (_loadComplete) {
    if (onProgress) onProgress(1);
    if (onComplete) onComplete(sprites);
    return;
  }

  if (onComplete) _completionCallbacks.push(onComplete);
  if (onProgress) _progressCallbacks.push(onProgress);

  // Only kick off the actual fetch once
  if (_loadStarted) return;
  _loadStarted = true;

  let loaded = 0;

  function finish(name, imgOrCanvas) {
    sprites[name] = imgOrCanvas;
    loaded++;
    const progress = loaded / SPRITE_NAMES.length;
    _progressCallbacks.forEach(cb => cb(progress));
    if (loaded === SPRITE_NAMES.length) {
      _loadComplete = true;
      _completionCallbacks.forEach(cb => cb(sprites));
    }
  }

  SPRITE_NAMES.forEach(name => {
    const candidates = SPRITE_NAME_ALIASES[name] || [name];

    if (NEEDS_BG_REMOVAL.has(name)) {
      loadSpriteByCandidates(candidates, (img) => {
        const result = removeWhiteBackground(img);
        finish(name, result || img);
      }, () => {
        finish(name, null);
      });
    } else if (NEEDS_DARK_BG_REMOVAL.has(name)) {
      loadSpriteByCandidates(candidates, (img) => {
        const result = removeBlackBackground(img);
        finish(name, result || img);
      }, () => {
        finish(name, null);
      });
    } else {
      loadSpriteByCandidates(candidates, (img) => {
        finish(name, img);
      }, () => {
        finish(name, null);
      });
    }
  });
}

export function getSprite(name) {
  const sprite = sprites[name] || null;

  // If a sprite failed earlier (null), retry in the background once.
  if (!sprite && _loadComplete && !_retryingSprites.has(name) && (_spriteRetryAttempts[name] || 0) < 1) {
    _retryingSprites.add(name);
    _spriteRetryAttempts[name] = (_spriteRetryAttempts[name] || 0) + 1;
    const candidates = SPRITE_NAME_ALIASES[name] || [name];
    const needsBgRemoval = NEEDS_BG_REMOVAL.has(name);
    const needsDarkBgRemoval = NEEDS_DARK_BG_REMOVAL.has(name);
    loadSpriteByCandidates(candidates, (img) => {
      if (needsBgRemoval) {
        sprites[name] = removeWhiteBackground(img) || img;
      } else if (needsDarkBgRemoval) {
        sprites[name] = removeBlackBackground(img) || img;
      } else {
        sprites[name] = img;
      }
      _retryingSprites.delete(name);
    }, () => {
      _retryingSprites.delete(name);
    });
  }

  return sprite;
}

export function isSpritesLoaded() {
  return _loadComplete;
}

export function getSpritesProgress() {
  // Count how many are loaded (non-null or explicitly set)
  return _loadComplete ? 1 : 0;
}

export function hasDrawableSprite(sprite) {
  if (!sprite) return false;
  const width = Number(sprite.naturalWidth || sprite.videoWidth || sprite.width || 0);
  const height = Number(sprite.naturalHeight || sprite.videoHeight || sprite.height || 0);
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
}

/**
 * Draw a sprite onto ctx.
 */
export function drawSprite(ctx, sprite, x, y, w, h) {
  if (!hasDrawableSprite(sprite)) return false;
  try {
    ctx.drawImage(sprite, x, y, w, h);
    return true;
  } catch {
    return false;
  }
}

export function getSpriteFrameCount(sprite, frameWidth, frameHeight) {
  if (!hasDrawableSprite(sprite)) return 0;
  const width = Number(sprite.naturalWidth || sprite.videoWidth || sprite.width || 0);
  const height = Number(sprite.naturalHeight || sprite.videoHeight || sprite.height || 0);
  const safeFrameWidth = Math.max(1, Number(frameWidth) || width || 1);
  const safeFrameHeight = Math.max(1, Number(frameHeight) || height || 1);
  const columns = Math.max(1, Math.floor(width / safeFrameWidth));
  const rows = Math.max(1, Math.floor(height / safeFrameHeight));
  return columns * rows;
}

export function drawSpriteFrame(ctx, sprite, frameWidth, frameHeight, frameIndex, x, y, w, h) {
  if (!hasDrawableSprite(sprite)) return false;

  const width = Number(sprite.naturalWidth || sprite.videoWidth || sprite.width || 0);
  const height = Number(sprite.naturalHeight || sprite.videoHeight || sprite.height || 0);
  const safeFrameWidth = Math.max(1, Number(frameWidth) || width || 1);
  const safeFrameHeight = Math.max(1, Number(frameHeight) || height || 1);
  const columns = Math.max(1, Math.floor(width / safeFrameWidth));
  const rows = Math.max(1, Math.floor(height / safeFrameHeight));
  const totalFrames = Math.max(1, columns * rows);
  const normalizedIndex = ((Math.floor(frameIndex || 0) % totalFrames) + totalFrames) % totalFrames;
  const sx = (normalizedIndex % columns) * safeFrameWidth;
  const sy = Math.floor(normalizedIndex / columns) * safeFrameHeight;

  try {
    ctx.drawImage(sprite, sx, sy, safeFrameWidth, safeFrameHeight, x, y, w, h);
    return true;
  } catch {
    return false;
  }
}