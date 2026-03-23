// Multi-boss spawning logic for waves 30+ (extended difficulty runs)
import { spawnBoss } from './bossLogic.js';

// Color profiles for variant bosses (index 0 = second boss, 1 = third boss)
const VARIANT_COLOR_PROFILES = [
  { hudColor: '#ff6600', label: 'ALPHA' },
  { hudColor: '#00ffaa', label: 'BETA' },
];

// The 5 boss tiers
const BOSS_TIERS = [1, 2, 3, 4, 5];

/**
 * How many bosses spawn at this wave.
 * waves 30-50 (every 5th): 2 bosses
 * waves 55-100 (every 5th): 3 bosses
 */
export function getBossCountForWave(wave) {
  if (wave >= 55) return 3;
  if (wave >= 30) return 2;
  return 1;
}

/**
 * Spawn 1, 2, or 3 bosses for the given wave.
 * Extra bosses get a variant color profile and suffix name.
 */
export function spawnMultiBosses(W, wave, hpMult) {
  const count = getBossCountForWave(wave);

  // Build the tier list for each boss slot (duplicates allowed for 30+)
  let tierPool;
  if (count === 1) {
    tierPool = [Math.min(Math.floor(wave / 5), 5)];
  } else if (count === 2) {
    const primaryTier = Math.min(Math.floor(wave / 5), 5);
    // Secondary: any random tier, duplicates allowed
    const secondaryTier = BOSS_TIERS[Math.floor(Math.random() * BOSS_TIERS.length)];
    tierPool = [primaryTier, secondaryTier];
  } else {
    // 3 bosses: all random tiers, duplicates allowed
    tierPool = [
      BOSS_TIERS[Math.floor(Math.random() * BOSS_TIERS.length)],
      BOSS_TIERS[Math.floor(Math.random() * BOSS_TIERS.length)],
      BOSS_TIERS[Math.floor(Math.random() * BOSS_TIERS.length)],
    ];
  }

  // Horizontal positions
  const positions = count === 1
    ? [W / 2]
    : count === 2
      ? [W * 0.3, W * 0.7]
      : [W * 0.2, W * 0.5, W * 0.8];

  return tierPool.map((tier, i) => {
    const bossWave = tier * 5;
    const boss = spawnBoss(W, bossWave, hpMult);
    boss.x = positions[i];
    boss._multiBossIndex = i;
    boss._multiBossTotal = count;
    // Variant styling for 2nd and 3rd boss
    if (i > 0) {
      const profile = VARIANT_COLOR_PROFILES[i - 1];
      boss._variantProfile = profile;
    }
    return boss;
  });
}