// Handles the boss warning countdown and spawning (single or multi-boss)
// Keeps this logic out of GameCanvas to avoid file-size issues.
import { spawnBoss } from './bossLogic.js';
import { spawnMultiBosses, getBossCountForWave } from './multiBossSpawner.js';

/**
 * Call every frame while s.bossWarning is active.
 * Spawns the correct number of bosses when the warning timer expires.
 *
 * @param {object} s        - game state ref
 * @param {number} W        - canvas width
 * @param {object} difficultyConfig
 * @param {function} onBossWarning - React callback
 */
export function tickBossWarning(s, W, difficultyConfig, onBossWarning) {
  if (!s.bossWarning || !s.bossWarning.active) return;

  s.bossWarning.timer--;
  if (onBossWarning) onBossWarning({ ...s.bossWarning });

  if (s.bossWarning.timer <= 0) {
    s.bossWarning.active = false;
    if (onBossWarning) onBossWarning(null);

    const wave = s.wave;
    const hpMult = (difficultyConfig && difficultyConfig.hpMult) || 1;
    const count = getBossCountForWave(wave);

    if (count > 1) {
      const bosses = spawnMultiBosses(W, wave, hpMult);
      s.enemies.push(...bosses);
    } else {
      s.enemies.push(spawnBoss(W, wave, hpMult));
    }
  }
}