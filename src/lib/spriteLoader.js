// Sprite loader — preloads all game sprites from GitHub
import { removeWhiteBackground } from './spriteProcessor.js';

const BASE = 'https://raw.githubusercontent.com/Churst86/Sprites/main/';

const SPRITE_NAMES = [
  'PlayerShip',
  'BasicEnemy',
  'EliteEnemy',
  'Berskerker',   // note: typo in repo filename
  'Eater',
  'EaterChomp',
  'Mine',
  'MineExplosion',
  'Wingman',
  'SuperWingman',
  'FirstBoss',
  'DreadnoughtBoss',
  'BeholderBoss',
  'PirateBoss',
  'FinalBoss',
  'Shopkeeper',
];

// Sprites with non-png extensions (key = sprite name, value = extension)
const SPRITE_EXTENSIONS = {
  'Drone': 'jpg',
  'Harvester': 'jpg',
  'Dropper': 'jpg',
  'Shotgun Powerup': 'jpg',
  'Photon Powerup': 'jpg',
  'BounceshotPowerup': 'jpg',
  'Laser Powerup': 'png',
  'Missile Powerup': 'png',
};

const EXTRA_SPRITE_NAMES = [
  'Drone',
  'Harvester',
  'Dropper',
  'Shotgun Powerup',
  'Photon Powerup',
  'BounceshotPowerup',
  'Laser Powerup',
  'Missile Powerup',
];

// Sprites that need white background removal (JPEGs or PNGs with white bg)
const NEEDS_BG_REMOVAL = new Set([
  'Drone', 'Harvester', 'Dropper',
  'Shotgun Powerup', 'Photon Powerup', 'BounceshotPowerup', 'Laser Powerup', 'Missile Powerup',
  'Eater', 'EaterChomp',
]);

// Map of wave number → boss sprite name
export const BOSS_SPRITE_MAP = {
  5:  'FirstBoss',
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

export function loadSprites(onComplete) {
  const allNames = [...SPRITE_NAMES, ...EXTRA_SPRITE_NAMES];
  let loaded = 0;

  function finish(name, imgOrCanvas) {
    sprites[name] = imgOrCanvas;
    loaded++;
    if (loaded === allNames.length && onComplete) onComplete(sprites);
  }

  allNames.forEach(name => {
    const ext = SPRITE_EXTENSIONS[name] || 'png';
    const img = new Image();
    img.crossOrigin = 'anonymous';
    // Cache-bust JPEGs to always fetch fresh from GitHub
    const bust = SPRITE_EXTENSIONS[name] ? `?t=${Date.now()}` : '';
    img.src = BASE + name + '.' + ext + bust;
    img.onload = () => {
      if (NEEDS_BG_REMOVAL.has(name)) {
        const result = removeWhiteBackground(img);
        if (result) {
          // Successfully processed — transparent canvas
          finish(name, result);
        } else {
          // Cross-origin tainted — store raw img with a flag to use multiply blend
          img._needsMultiply = true;
          finish(name, img);
        }
      } else {
        finish(name, img);
      }
    };
    img.onerror = () => {
      loaded++;
      if (loaded === allNames.length && onComplete) onComplete(sprites);
    };
  });
}

export function getSprite(name) {
  return sprites[name] || null;
}

/**
 * Draw a sprite onto ctx, automatically applying 'multiply' blend if needed
 * to remove white backgrounds on cross-origin JPEGs.
 */
export function drawSprite(ctx, sprite, x, y, w, h) {
  if (!sprite) return;
  if (sprite._needsMultiply) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(sprite, x, y, w, h);
    ctx.restore();
  } else {
    ctx.drawImage(sprite, x, y, w, h);
  }
}