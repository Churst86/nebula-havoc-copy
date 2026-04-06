// Multi-boss spawning logic for boss waves.
const BOSS_TYPES = [
  { wave: 5, name: 'Fang', gun: 'spread' },
  { wave: 10, name: 'Dreadnought', gun: 'missile' },
  { wave: 15, name: 'Beholder', gun: 'laser' },
  { wave: 20, name: 'Pirate', gun: 'bounce' },
  { wave: 25, name: 'Final', gun: 'photon' },
];

/**
 * How many bosses spawn at this wave.
 * waves 30-50 (every 5th): 2 bosses
 * waves 55-100 (every 5th): 3 bosses
 */
export function getBossCountForWave(wave) {
  if (wave >= 30) return 2;
  return 1;
}

/**
 * Build boss entities for the given boss wave.
 * Wave 30+ spawns a second random boss.
 * If that random roll matches the primary boss type, it gets a variant name/color.
 */
export function createBossWaveEnemies(W, wave, hpMult) {
  const count = getBossCountForWave(wave);
  const bossHp = Math.round((20 + wave * 5) * hpMult * 2);
  const primaryType = BOSS_TYPES[Math.min(Math.max(1, Math.floor(wave / 5)) - 1, BOSS_TYPES.length - 1)];

  const createBossFromType = (typeDef, x, variant = null) => {
    const isDreadnought = typeDef.wave === 10;
    const boss = {
      type: 'boss',
      x,
      y: -60,
      w: isDreadnought ? 62 : 45,
      h: isDreadnought ? 62 : 45,
      hp: bossHp,
      maxHp: bossHp,
      vx: 1.8,
      vy: 0.4,
      fireTimer: 20,
      phase: 0,
      gun: typeDef.gun,
      tier: Math.max(1, Math.floor(typeDef.wave / 5)),
      wave: typeDef.wave,
      name: variant?.name || typeDef.name,
    };

    if (typeDef.wave === 20) {
      // Pirate uses a full-sprite collision box so hits match visible art.
      boss.w = 180;
      boss.h = 180;
    }
    if (variant?.hudColor) boss._variantHudColor = variant.hudColor;
    if (variant?.tintColor) boss._variantTintColor = variant.tintColor;
    return boss;
  };

  if (count === 1) {
    return [createBossFromType(primaryType, W / 2)];
  }

  const secondaryType = BOSS_TYPES[Math.floor(Math.random() * BOSS_TYPES.length)];
  const sameType = secondaryType.wave === primaryType.wave;
  return [
    createBossFromType(primaryType, W * 0.34),
    createBossFromType(
      secondaryType,
      W * 0.66,
      sameType ? { name: `${secondaryType.name} Alpha`, hudColor: '#00ffaa', tintColor: '#00ffaa' } : null
    ),
  ];
}

// Backward-compatible export name used by older callers.
export function spawnMultiBosses(W, wave, hpMult) {
  return createBossWaveEnemies(W, wave, hpMult);
}