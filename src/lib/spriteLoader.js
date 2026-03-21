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
    const url = BASE + name + '.' + ext;

    if (NEEDS_BG_REMOVAL.has(name)) {
      // Fetch as blob to avoid canvas CORS tainting, then process pixels
      loadImageViaBlobUrl(url, (img) => {
        const result = removeWhiteBackground(img);
        finish(name, result || img);
      }, () => {
        loaded++;
        if (loaded === allNames.length && onComplete) onComplete(sprites);
      });
    } else {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = url;
      img.onload = () => finish(name, img);
      img.onerror = () => {
        loaded++;
        if (loaded === allNames.length && onComplete) onComplete(sprites);
      };
    }
  });
}

export function getSprite(name) {
  return sprites[name] || null;
}

/**
 * Draw a sprite onto ctx.
 * If the sprite has _needsMultiply flag (cross-origin JPEG that couldn't be pixel-processed),
 * uses 'multiply' blend mode — on the near-black game canvas, white areas become invisible.
 * For processed canvases (transparent bg), draws normally.
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