// Laser beam logic extracted from GameCanvas
import { releaseBullet } from './bulletPool.js';

export const LASER_CHARGE_FRAMES = 90;
export const LASER_BEAM_FRAMES = 180;
export const LASER_COOLDOWN_FRAMES = 180;

export function updateLaserBeam(s, p, W, H, spawnExplosion, sounds, onScoreChange, onPowerupChange, onLivesChange, onMaxLivesChange, BLOCK_SIZE, getBlockCells) {
  if ((s.powerups.laser || 0) === 0) {
    s.laserCharge = 0;
    s.laserCooldown = 0;
    s.laserBeamActive = false;
    s.laserBeamTimer = 0;
    return;
  }

  if (s.laserCooldown > 0) {
    s.laserBeamActive = false;
    s.laserCooldown--;
  } else if (s.laserBeamActive) {
    s.laserBeamTimer--;
    const laserTier = s.powerups.laser;
    const beamW = laserTier >= 10 ? (4 + laserTier * 3) * 2 : 4 + laserTier * 3;

    s.enemyBullets = s.enemyBullets.filter(eb => {
      if (Math.abs(eb.x - p.x) < beamW + 6 && eb.y < p.y) {
        spawnExplosion(s, eb.x, eb.y, '#ff44ff', 3);
        releaseBullet(s, eb);
        return false;
      }
      return true;
    });

    const isPiercing = laserTier >= 10;
    const laserColor = isPiercing ? '#ffffff' : '#ff2200';
    if (s.laserFlareTimer > 0) s.laserFlareTimer--;

    if (s.laserBeamTimer % 4 === 0) {
      let beamBlockY = 0;
      s.blocks.forEach(block => {
        if (block.dead) return;
        getBlockCells(block).forEach(cell => {
          const cx = cell.x + BLOCK_SIZE / 2;
          if (Math.abs(cx - p.x) < beamW + BLOCK_SIZE / 2 && cell.y < p.y) {
            const stopY = cell.y + BLOCK_SIZE;
            if (stopY > beamBlockY) {
              beamBlockY = stopY;
              block._laserHit = true;
            }
          }
        });
      });
      
      s.blocks.forEach(block => {
        if (block._laserHit && !block.dead) {
          block._laserHit = false;
          if (!block.invulnerable) {
            block.hp--;
            sounds.hit();
            spawnExplosion(s, block.x + BLOCK_SIZE / 2, block.y, block.color, 3);
            if (block.hp <= 0) {
              block.dead = true;
              s.score += 50;
              onScoreChange(s.score);
              spawnExplosion(s, block.x + BLOCK_SIZE, block.y, block.color, 8);
            }
          } else {
            spawnExplosion(s, block.x + BLOCK_SIZE / 2, block.y, '#aaaacc', 3);
          }
        } else {
          block._laserHit = false;
        }
      });
      s.blocks = s.blocks.filter(b => !b.dead);

      let beamStopY = beamBlockY;
      const enemiesInBeam = s.enemies
        .filter(e => !e.dead && Math.abs(e.x - p.x) < beamW + (e.w || 18) && e.y < p.y && e.y > beamBlockY)
        .sort((a, b) => b.y - a.y);

      if (isPiercing) {
        enemiesInBeam.forEach(e => {
          e.hp -= 1;
          sounds.hit();
          spawnExplosion(s, e.x, e.y, laserColor, 3);
          if (e.hp <= 0) {
            e.dead = true;
            const pts = e.type === 'boss' ? 5000 : e.type === 'dropper' ? 500 : e.type === 'elite' ? 300 : 100;
            s.score += pts;
            onScoreChange(s.score);
            sounds.kill();
            spawnExplosion(s, e.x, e.y, e.type === 'boss' ? '#ff0066' : laserColor, e.type === 'boss' ? 40 : 14);
            if (e.type === 'dropper') {
              sounds.killDropper();
              s.powerupItems.push({ x: e.x, y: e.y, type: e.dropType, angle: 0 });
            }
            if (e.type === 'boss') {
              sounds.stopBossMusic();
              sounds.waveComplete();
              s.maxLives++;
              s.lives = Math.min(s.lives + 1, s.maxLives);
              onLivesChange(s.lives);
              onMaxLivesChange(s.maxLives);
            }
          }
        });
        beamStopY = beamBlockY;
      } else {
        const firstEnemy = enemiesInBeam[0] || null;
        if (firstEnemy) {
          beamStopY = Math.max(beamBlockY, firstEnemy.y - (firstEnemy.h || 18));
          firstEnemy.hp -= 1;
          sounds.hit();
          spawnExplosion(s, firstEnemy.x, firstEnemy.y, laserColor, 3);
          if (firstEnemy.hp <= 0) {
            firstEnemy.dead = true;
            const pts = firstEnemy.type === 'boss' ? 5000 : firstEnemy.type === 'dropper' ? 500 : firstEnemy.type === 'elite' ? 300 : 100;
            s.score += pts;
            onScoreChange(s.score);
            sounds.kill();
            spawnExplosion(s, firstEnemy.x, firstEnemy.y, firstEnemy.type === 'boss' ? '#ff0066' : laserColor, firstEnemy.type === 'boss' ? 40 : 14);
            if (firstEnemy.type === 'dropper') {
              sounds.killDropper();
              s.powerupItems.push({ x: firstEnemy.x, y: firstEnemy.y, type: firstEnemy.dropType, angle: 0 });
            }
            if (firstEnemy.type === 'boss') {
              sounds.stopBossMusic();
              sounds.waveComplete();
              s.maxLives++;
              s.lives = Math.min(s.lives + 1, s.maxLives);
              onLivesChange(s.lives);
              onMaxLivesChange(s.maxLives);
            }
          }
        }
      }
      s.enemies = s.enemies.filter(e => !e.dead);
      s.laserBeamBlockY = beamStopY;
    }

    if (s.laserBeamTimer <= 0) {
      s.laserBeamActive = false;
      s.laserCharge = 0;
      s.laserCooldown = LASER_COOLDOWN_FRAMES;
    }
  } else {
    s.laserCharge++;
    if (s.laserCharge >= LASER_CHARGE_FRAMES) {
      s.laserBeamActive = true;
      s.laserBeamTimer = LASER_BEAM_FRAMES;
      s.laserFlareTimer = 12;
      sounds.powerup();
    }
  }
}