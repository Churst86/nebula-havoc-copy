// Boss Mode — sequential boss rush, then double bosses after all defeated
export const BOSS_MODE_SEQUENCE = [5, 10, 15, 20, 25]; // wave numbers for each boss tier

export function getBossModeWave(bossIndex) {
  // First 5 bosses in sequence, then random pairs
  if (bossIndex < BOSS_MODE_SEQUENCE.length) {
    return BOSS_MODE_SEQUENCE[bossIndex];
  }
  return null; // signals "endless double boss" phase
}

export function isBossModeComplete(bossesDefeated) {
  return bossesDefeated >= BOSS_MODE_SEQUENCE.length;
}