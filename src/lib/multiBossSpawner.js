// Multi-boss spawning logic for waves 30+ (hell difficulty / extended runs)
import { spawnBoss } from './bossLogic.js';
import { HITBOX_SIZES } from './hitboxConfig.js';

// Color profiles for cloned/variant bosses
const VARIANT_COLOR_PROFILES = [
  { tint: '#ff6600', hudColor: '#ff6600', label: 'ALPHA' },
  { tint: '#00ffaa', hudColor: '#00ffaa', label: 'BETA' },
  { tint: '#ff00ff', hudColor: '#ff00ff', label: 'GAMMA' },
  { tint: '#ffff00', hudColor: '#ffff00', label: 'DELTA' },
  { tint: '#00ccff', hudColor: '#00ccff', label: 'OMEGA' },
];

// The 5 boss tiers mapped to wave multiples
const BOSS_TIERS = [1, 2, 3, 4, 5];

/**
 * Returns how many bosses should spawn for a given wave.
 * wave 30–50: 2 bosses
 * wave 55–100: 3 bosses
 */
export function getBossCountForWave(wave) {
  if (wave >= 55) return 3;
  if (wave >= 30) return 2;
  return 1;
}

/**
 * Spawn multiple bosses for a wave.
 * Each boss after the first gets a variant color profile and slightly different name.
 */
export function spawnMultiBosses(W, wave, hpMult) {
  const count = getBossCountForWave(wave);
  const bosses = [];

  if (count === 1) {
    bosses.push(spawnBoss(W, wave, hpMult));
    return bosses;
  }

  // For 3-boss waves (55+), pick 3 random tiers (any combination)
  let tierPool;
  if (count === 3) {
    // Shuffle tiers and pick 3 unique ones
    const shuffled = [...BOSS_TIERS].sort(() => Math.random() - 0.5);
    tierPool = shuffled.slice(0, 3);
  } else {
    // 2-boss waves: primary tier based on wave, secondary is random different tier
    const primaryTier = Math.min(Math.floor(wave / 5), 5);
    let secondaryTier;
    do { secondaryTier = BOSS_TIERS[Math.floor(Math.random() * BOSS_TIERS.length)]; }
    while (secondaryTier === primaryTier);
    tierPool = [primaryTier, secondaryTier];
  }

  // Spread bosses horizontally
  const positions = count === 2
    ? [W * 0.33, W * 0.67]
    : [W * 0.2, W * 0.5, W * 0.8];

  tierPool.forEach((tier, i) => {
    const bossWave = tier * 5; // wave corresponding to this tier
    const boss = spawnBoss(W, bossWave, hpMult);
    boss.x = positions[i];
    boss._wave = bossWave;
    boss._multiBossIndex = i;
    boss._multiBossTotal = count;

    if (i > 0) {
      // Apply variant color profile
      const profile = VARIANT_COLOR_PROFILES[i - 1];
      boss._variantProfile = profile;
      boss._variantLabel = profile.label;
    }
  });

  return bosses.length ? bosses : tierPool.map((tier, i) => {
    const bossWave = tier * 5;
    const b = spawnBoss(W, bossWave, hpMult);
    b.x = positions[i];
    b._wave = bossWave;
    b._multiBossIndex = i;
    b._multiBossTotal = count;
    if (i > 0) {
      const profile = VARIANT_COLOR_PROFILES[i - 1];
      b._variantProfile = profile;
      b._variantLabel = profile.label;
    }
    return b;
  });
}

// Re-export so callers can use this one file
export { spawnBoss };