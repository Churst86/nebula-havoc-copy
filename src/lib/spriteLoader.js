// Sprite loader — preloads all game sprites from GitHub
const BASE = 'https://raw.githubusercontent.com/Churst86/Sprites/main/';

const SPRITE_NAMES = [
  'PlayerShip',
  'BasicEnemy',
  'EliteEnemy',
  'Berskerker',   // note: typo in repo filename
  'Eater',
  'EaterChomp',
  'Mine',
  'FirstBoss',
  'DreadnoughtBoss',
  'BeholderBoss',
  'PirateBoss',
  'FinalBoss',
  'Shopkeeper',
];

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
  SPRITE_NAMES.forEach(name => {
    const img = new Image();
    img.src = BASE + name + '.png';
    img.onload = () => {
      sprites[name] = img;
      loaded++;
      if (loaded === SPRITE_NAMES.length && onComplete) onComplete(sprites);
    };
    img.onerror = () => {
      loaded++;
      if (loaded === SPRITE_NAMES.length && onComplete) onComplete(sprites);
    };
  });
}

export function getSprite(name) {
  return sprites[name] || null;
}