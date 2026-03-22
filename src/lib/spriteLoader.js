// Sprite loader — preloads all game sprites from GitHub
import { removeWhiteBackground } from './spriteProcessor.js';

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

// All sprites are now PNG
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
  'Drone',
  'Harvester',
  'Dropper',
  'Shotgun Powerup',
  'Photon Powerup',
  'BounceshotPowerup',
  'Laser Powerup',
  'Missile Powerup',
];

// Sprites that need white background removal (PNGs that may have white bg)
const NEEDS_BG_REMOVAL = new Set([
  'Drone', 'Harvester', 'Dropper',
  'Shotgun Powerup', 'BounceshotPowerup', 'Missile Powerup',
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
  let loaded = 0;

  function finish(name, imgOrCanvas) {
    // Make each sprite available immediately as it loads
    sprites[name] = imgOrCanvas;
    loaded++;
    if (loaded === SPRITE_NAMES.length && onComplete) onComplete(sprites);
  }

  SPRITE_NAMES.forEach(name => {
    const url = BASE + name + '.png?t=' + Date.now();

    if (NEEDS_BG_REMOVAL.has(name)) {
      loadImageViaBlobUrl(url, (img) => {
        const result = removeWhiteBackground(img);
        finish(name, result || img);
      }, () => {
        finish(name, null);
      });
    } else {
      loadImageViaBlobUrl(url, (img) => {
        finish(name, img);
      }, () => {
        finish(name, null);
      });
    }
  });
}

export function getSprite(name) {
  return sprites[name] || null;
}

/**
 * Draw a sprite onto ctx.
 */
export function drawSprite(ctx, sprite, x, y, w, h) {
  if (!sprite) return;
  ctx.drawImage(sprite, x, y, w, h);
}