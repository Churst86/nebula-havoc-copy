import { createBossWarning } from './bossLogic.js';
import { spawnEater } from './enemySpawners.js';
import { sounds } from '../hooks/useSound.js';

function randomBetween(a, b) { return a + Math.random() * (b - a); }

export function spawnWave(W, s, difficultyConfig, bossMode, onBossWarning) {
  const wave = s.wave;
  const cfg = difficultyConfig || { hpMult: 1, maxWave: 100, blockSpeedMult: 1 };
  const hpMult = cfg.hpMult || 1;

  if (cfg.maxWave && wave > cfg.maxWave) {
    sounds.stopAllMusic();
    s.running = false;
    return 'gameover';
  }

  const enemies = [];

  if (wave % 5 === 0) {
    s.bossWarning = createBossWarning(wave);
    if (onBossWarning) onBossWarning(s.bossWarning);
    sounds.startBossMusic();
  } else if (!bossMode) {
    sounds.startWaveMusic(wave);
  }

  // Skip regular enemies in boss mode
  if (!bossMode) {
    const count = 5 + wave * 2;
    for (let i = 0; i < count; i++) {
      const isElite = wave > 3 && Math.random() < 0.25;
      const baseHp = isElite ? 3 : 1;
      const hp = Math.round(baseHp * hpMult);
      enemies.push({
        type: isElite ? 'elite' : 'basic',
        x: randomBetween(40, W - 40),
        y: -60 - i * 40,
        w: isElite ? 34 : 34, h: isElite ? 34 : 34,
        hp, maxHp: hp,
        vx: (isElite ? randomBetween(-1.2, 1.2) : randomBetween(-0.5, 0.5)) * (1 + wave * 0.04),
        vy: (isElite ? (0.7 + wave * 0.08) : (0.35 + wave * 0.06)) * (Math.random() * 0.4 + 0.7),
        fireTimer: randomBetween(60, 120),
      });
    }

    if (wave >= 2) {
      const mineCount = wave >= 6 ? 2 : 1;
      const mineHp = Math.round(3 * hpMult);
      for (let i = 0; i < mineCount; i++) {
        enemies.push({
          type: 'mine',
          x: randomBetween(50, W - 50),
          y: -60 - i * 60,
          w: 32, h: 32,
          hp: mineHp, maxHp: mineHp,
          vx: randomBetween(-0.6, 0.6),
          vy: (0.4 + wave * 0.05),
          fireTimer: 9999,
        });
      }
    }

    const isHell = cfg.maxWave === 100;
    if (wave > 10 && (wave % 2 === 0 || (isHell && wave > 25))) {
      spawnEater(enemies, W, wave, hpMult);
    }
  }
  s.enemies = enemies;
  return null;
}

export function progressWave(bossMode) {
  return bossMode ? 5 : 1;
}