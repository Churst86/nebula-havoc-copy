import React, { useRef, useEffect, useCallback } from 'react';
import MobileControls from './MobileControls';
import { sounds } from '../../hooks/useSound.js';
import { spawnBerserk, spawnEater } from '../../lib/enemySpawners.js';
import { updateBerserkMovement, updateBerserkLaser, drawBerserk } from '../../lib/berserkUtils.js';
import { fireReverseShot, drawReverseFlame } from '../../lib/reverseGunUtils.js';
import { fireMissiles, updateMissiles, drawMissile, getMissileHitDamage, shouldSpawnMissileExplosion } from '../../lib/missileUtils.js';
import { DROPPER_COLORS, DROPPER_LABELS, DROPPER_ROTATION } from '../../lib/powerupConfig.js';
import { drawBlock, drawPiledCells, drawParticle } from '../../lib/drawingUtils.js';
import { fireSpreadShot, getFireRate } from '../../lib/powerups/gunPowerups.js';
import { drawPowerupItem } from '../../lib/powerupVisuals.js';
import { applyUtilityPowerup } from '../../lib/powerups/utilityPowerups.js';
import { drawEnemy, updateEnemyPositions } from './EnemyRenderer.jsx';
import { drawBerserk } from '../../lib/berserkUtils.js';

const LASER_CHARGE_FRAMES = 90;
const LASER_BEAM_FRAMES = 180;
const LASER_COOLDOWN_FRAMES = 180;
const SPREAD_SHOTS_PER_RELOAD = 2;
const SPREAD_RELOAD_FRAMES = 80;

const TETRIS_SHAPES = [
  [[0,0],[1,0],[2,0],[3,0]], [[0,0],[1,0],[0,1],[1,1]], [[1,0],[0,1],[1,1],[2,1]],
  [[0,0],[0,1],[1,1],[2,1]], [[2,0],[0,1],[1,1],[2,1]], [[1,0],[2,0],[0,1],[1,1]],
  [[0,0],[1,0],[1,1],[2,1]],
];
const BLOCK_SIZE = 18;
const BLOCK_COLORS = ['#00f0ff', '#ff44ff', '#ffdd00', '#44ffaa', '#ff8800', '#aaff00', '#ff4488'];

function randomBetween(a, b) { return a + Math.random() * (b - a); }

const DROPPER_SPAWN_INTERVAL = 480;
const DROPPER_ROTATE_FRAMES = 300;
const STAR_SPAWN_INTERVAL = 1800;
const STAR_INVINCIBLE_FRAMES = 420;

function initState() {
  return {
    player: null, bullets: [], enemyBullets: [], enemies: [], particles: [], powerupItems: [],
    wingmen: [], stars: [], blocks: [], piledCells: [], blockSpawnTimer: 120,
    score: 0, lives: 3, maxLives: 3, wave: 1, waveTimer: 0, fireTimer: 0, invincibleTimer: 0,
    spiralAngle: 0, laserCharge: 0, laserCooldown: 0, laserBeamActive: false, laserBeamTimer: 0,
    spreadShotsLeft: SPREAD_SHOTS_PER_RELOAD, spreadReloadTimer: 0, spreadFireTimer: 10,
    wingmanFireTimer: 0, superWingmanFireTimer: 0, powerups: {}, lockedPowerups: [],
    shieldHp: 0, running: false, starInvincibleTimer: 0, dropperSpawnTimer: DROPPER_SPAWN_INTERVAL,
    dropperRotationIdx: 0, dropperRotateTimer: DROPPER_ROTATE_FRAMES, starDropperTimer: STAR_SPAWN_INTERVAL,
    reverseFireTimer: 0, waveEnemiesCleared: false,
  };
}

export default function GameCanvas({ gameState, setGameState, onScoreChange, onLivesChange, onMaxLivesChange, onWaveChange, onPowerupChange, continuesLeft, onContinueUsed, isPaused, difficultyConfig, gameSpeed = 30 }) {
  const canvasRef = useRef(null);
  const keysRef = useRef({});
  const stateRef = useRef(initState());
  const animRef = useRef(null);
  const lastTimeRef = useRef(0);
  const isPausedRef = useRef(isPaused);
  const gameSpeedRef = useRef(gameSpeed);

  useEffect(() => { gameSpeedRef.current = gameSpeed; }, [gameSpeed]);
  useEffect(() => { isPausedRef.current = isPaused; sounds.setPauseVolume(isPaused); }, [isPaused]);

  function initStars(W, H) {
    return Array.from({ length: 120 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 1.5 + 0.3, speed: Math.random() * 0.6 + 0.1,
      alpha: Math.random() * 0.7 + 0.3,
    }));
  }

  function spawnWave(W, s) {
    const wave = s.wave;
    const cfg = difficultyConfig || { hpMult: 1, maxWave: 100, blockSpeedMult: 1 };
    const hpMult = cfg.hpMult || 1;
    if (cfg.maxWave && wave > cfg.maxWave) { sounds.stopAllMusic(); s.running = false; setGameState('gameover'); return; }

    const count = 5 + wave * 2;
    const enemies = [];
    if (wave % 5 === 0) {
      const bossHp = Math.round((20 + wave * 5) * hpMult);
      const bossGuns = ['spread', 'laser', 'photon', 'bounce'];
      const bossGun = bossGuns[Math.floor(Math.random() * bossGuns.length)];
      const bossTier = Math.floor(wave / 5);
      enemies.push({ type: 'boss', x: W / 2, y: -60, w: 45, h: 45, hp: bossHp, maxHp: bossHp, vx: 1.8, vy: 0.4, fireTimer: 20, phase: 0, gun: bossGun, tier: bossTier });
      sounds.startBossMusic();
    } else {
      sounds.startWaveMusic(wave);
    }

    for (let i = 0; i < count; i++) {
      const isElite = wave > 3 && Math.random() < 0.25;
      const baseHp = isElite ? 3 : 1;
      const hp = Math.round(baseHp * hpMult);
      enemies.push({
        type: isElite ? 'elite' : 'basic', x: randomBetween(40, W - 40), y: -30 - i * 28,
        w: isElite ? 22 : 18, h: isElite ? 22 : 18, hp, maxHp: hp,
        vx: randomBetween(-0.5, 0.5) * (1 + wave * 0.04),
        vy: (0.35 + wave * 0.06) * (Math.random() * 0.4 + 0.7), fireTimer: randomBetween(60, 120),
      });
    }
    if (wave >= 2) {
      const mineCount = wave >= 6 ? 2 : 1;
      const mineHp = Math.round(3 * hpMult);
      for (let i = 0; i < mineCount; i++) {
        enemies.push({ type: 'mine', x: randomBetween(50, W - 50), y: -50 - i * 40, w: 20, h: 20, hp: mineHp, maxHp: mineHp, vx: randomBetween(-0.6, 0.6), vy: (0.4 + wave * 0.05), fireTimer: 9999 });
      }
    }
    const isHell = cfg.maxWave === 100;
    if (wave > 10 && (wave % 2 === 0 || (isHell && wave > 25))) { spawnEater(enemies, W, wave, hpMult); }
    if (wave > 15 && (wave % 2 === 1 || (isHell && wave > 25))) { spawnBerserk(enemies, W, wave, hpMult, isHell); }
    s.enemies = enemies;
    s.waveEnemiesCleared = false;
  }

  function getNextDropperType(s) {
    for (let i = 0; i < DROPPER_ROTATION.length; i++) {
      const idx = (s.dropperRotationIdx + i) % DROPPER_ROTATION.length;
      const t = DROPPER_ROTATION[idx];
      if ((s.powerups[t] || 0) >= 10) continue;
      s.dropperRotationIdx = idx;
      return t;
    }
    return DROPPER_ROTATION[s.dropperRotationIdx % DROPPER_ROTATION.length];
  }

  function spawnMiniEaters(W, s, parent) {
    for (let i = 0; i < 2; i++) {
      const mini = {
        type: 'eater', _mini: true, x: parent.x + (i === 0 ? -30 : 30), y: parent.y,
        w: 15, h: 15, hp: Math.max(1, Math.floor(parent.maxHp / 2)),
        maxHp: Math.max(1, Math.floor(parent.maxHp / 2)),
        vx: randomBetween(-0.6, 0.6), vy: randomBetween(-0.4, 0.4), fireTimer: 9999,
        _chargePlayerTimer: 0, _blocksEaten: 0,
      };
      s.enemies.push(mini);
      spawnExplosion(s, mini.x, mini.y, '#44ff88', 8);
    }
  }

  function spawnDropper(W, s, forcedType) {
    const dropType = forcedType || getNextDropperType(s);
    const dc = DROPPER_COLORS[dropType] || '#ffd700';
    s.enemies.push({
      type: 'dropper', dropType, x: randomBetween(80, W - 80), y: randomBetween(60, 200),
      w: 22, h: 22, hp: 1, maxHp: 1, vx: randomBetween(-1.2, 1.2), vy: randomBetween(-0.8, 0.8),
      dirTimer: randomBetween(60, 120), color: dc,
    });
  }

  function playerFire(s) {
    const p = s.player;
    const pw = s.powerups;
    const laserTier = pw.laser || 0;
    const photonTier = pw.photon || 0;
    const bounceTier = pw.bounce || 0;
    const missileTier = pw.missile || 0;

    if (missileTier > 0) fireMissiles(s, p, missileTier);

    if (photonTier > 0 && s.bullets.filter(b => b.type === 'photon').length < 2) {
      const PHOTON_BASE_SIZE = 10;
      const pierceCount = photonTier >= 2 ? photonTier - 1 : 0;
      const isSuperOrbit = photonTier >= 10;
      s.bullets.push({ x: p.x, y: p.y - 14, vx: 0, vy: -11, type: 'photon', size: PHOTON_BASE_SIZE, orbitAngle: 0, pierceCount, piercedEnemies: [], isSuperOrbit, orbitPhase: 0 });
    }

    if (bounceTier > 0) {
      const bounces = bounceTier * 2 + bounceTier;
      const side = Math.floor(s.spiralAngle * 2) % 2 === 0 ? -1 : 1;
      s.spiralAngle += 0.1;
      if (bounceTier >= 10) {
        s.bullets.push({ x: p.x, y: p.y - 14, vx: 0, vy: -12, type: 'bounce', bouncesLeft: 10, isSuper: true, size: 8 });
      } else {
        s.bullets.push({ x: p.x + side * 8, y: p.y - 14, vx: side * 3.5, vy: -10, type: 'bounce', bouncesLeft: bounces });
        for (let i = 1; i < bounceTier; i++) {
          const angle = Math.random() * Math.PI * 2;
          s.bullets.push({ x: p.x, y: p.y - 14, vx: Math.cos(angle) * 6, vy: Math.sin(angle) * 6 - 2, type: 'bounce', bouncesLeft: bounces });
        }
      }
    }

    s.bullets.push({ x: p.x, y: p.y - 18, vx: 0, vy: -7, type: 'normal' });
  }

  function spawnBlock(W) {
    const shapeIdx = Math.floor(Math.random() * TETRIS_SHAPES.length);
    const shape = TETRIS_SHAPES[shapeIdx];
    const isInvulnerable = Math.random() < 0.08;
    const color = isInvulnerable ? '#aaaacc' : BLOCK_COLORS[Math.floor(Math.random() * BLOCK_COLORS.length)];
    const cols = shape.map(c => c[0]);
    const maxCol = Math.max(...cols);
    const startX = randomBetween(BLOCK_SIZE, W - (maxCol + 1) * BLOCK_SIZE);
    const cellCount = shape.length;
    const hp = cellCount <= 2 ? 1 : cellCount === 3 ? 2 : 3;
    const blockSpeedMult = (difficultyConfig && difficultyConfig.blockSpeedMult) || 1;
    return { shape, color, x: startX, y: -BLOCK_SIZE * 2, vy: (0.6 + Math.random() * 0.4) * blockSpeedMult, hp, maxHp: hp, settled: false, invulnerable: isInvulnerable };
  }

  function getBlockCells(block) {
    return block.shape.map(([col, row]) => ({ x: block.x + col * BLOCK_SIZE, y: block.y + row * BLOCK_SIZE }));
  }

  function drawPlayer(ctx, p, wingmen, shieldHp, enemies, invincibleTimer, keys, starInvincibleTimer, superWingman, superWingmen) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 18;
    ctx.strokeStyle = '#00f0ff'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -18); ctx.lineTo(13, 12); ctx.lineTo(0, 6); ctx.lineTo(-13, 12); ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,240,255,0.15)';
    ctx.fill();
    if (invincibleTimer > 0 && Math.floor(invincibleTimer / 10) % 2 === 0) {
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  function drawBullet(ctx, b, isEnemy) {
    ctx.save();
    if (b.type === 'missile') { drawMissile(ctx, b); }
    else if (isEnemy) {
      const r = b.big ? 12 : 4;
      ctx.shadowColor = '#ff6600'; ctx.shadowBlur = 8;
      ctx.fillStyle = '#ff6600';
      ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 8;
      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(b.x - 1.5, b.y - 7, 3, 14);
    }
    ctx.restore();
  }

  function spawnExplosion(s, x, y, color = '#ff4444', count = 10) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = randomBetween(0.5, 3);
      s.particles.push({ x, y, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd, r: randomBetween(1, 3.5), alpha: 1, color });
    }
  }

  function takeDamage(s) {
    if (s.invincibleTimer > 0 || s.starInvincibleTimer > 0) return;
    if (s.shieldHp > 0) {
      s.shieldHp--;
      sounds.shieldHit();
      if (s.shieldHp === 0) { sounds.shieldBreak(); delete s.powerups.shield; }
      onPowerupChange({ ...s.powerups, shieldHp: s.shieldHp });
      s.invincibleTimer = 60;
      return;
    }
    s.lives--;
    s.invincibleTimer = 120;
    onLivesChange(s.lives);
    sounds.playerHit();
    if (s.lives <= 0) { sounds.stopAllMusic(); s.running = false; setGameState('continue'); }
  }

  const loop = useCallback((timestamp) => {
    if (!stateRef.current.running || isPausedRef.current) {
      animRef.current = requestAnimationFrame(loop);
      return;
    }
    const targetInterval = 1000 / gameSpeedRef.current;
    if (timestamp - lastTimeRef.current < targetInterval) {
      animRef.current = requestAnimationFrame(loop);
      return;
    }
    lastTimeRef.current = timestamp;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const s = stateRef.current;
    const keys = keysRef.current;

    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(5,5,20,0.85)';
    ctx.fillRect(0, 0, W, H);

    s.stars.forEach(st => {
      st.y += st.speed;
      if (st.y > H) { st.y = 0; st.x = Math.random() * W; }
      ctx.globalAlpha = st.alpha;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    });

    const p = s.player;
    const speedTier = s.powerups.speed || 0;
    const spd = 4.5 + speedTier * 1.5;
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) p.x = Math.max(16, p.x - spd);
    if (keys['ArrowRight'] || keys['d'] || keys['D']) p.x = Math.min(W - 16, p.x + spd);
    if (keys['ArrowUp'] || keys['w'] || keys['W']) p.y = Math.max(16, p.y - spd);
    if (keys['ArrowDown'] || keys['s'] || keys['S']) p.y = Math.min(H - 16, p.y + spd);

    // Invincibility/star timers
    if (s.invincibleTimer > 0) s.invincibleTimer--;
    if (s.starInvincibleTimer > 0) s.starInvincibleTimer--;

    // Fire system
    if (s.spreadReloadTimer > 0) s.spreadReloadTimer--;
    if (!s.laserBeamActive) {
      s.fireTimer--;
      if (s.fireTimer <= 0) { playerFire(s); s.fireTimer = getFireRate(s.powerups); }
    }

    if ((s.powerups.shotgun || 0) > 0) {
      s.spreadFireTimer--;
      if (s.spreadFireTimer <= 0) {
        fireSpreadShot(s);
        const shotgunTier = s.powerups.shotgun || 0;
        const rapidfireBonus = (s.powerups.rapidfire || 0) === 1 ? 10 : (s.powerups.rapidfire || 0) * 8;
        s.spreadFireTimer = Math.max(15, 65 - shotgunTier * 4 - rapidfireBonus);
      }
    }

    // Dropper spawning
    s.dropperSpawnTimer--;
    if (s.dropperSpawnTimer <= 0) { spawnDropper(W, s); s.dropperSpawnTimer = DROPPER_SPAWN_INTERVAL; }

    // Enemy movement & behavior
    s.enemies.forEach(e => {
      if (e.type === 'dropper') {
        e.dirTimer = (e.dirTimer || 60) - 1;
        if (e.dirTimer <= 0) {
          e.vx = randomBetween(-1.5, 1.5);
          e.vy = randomBetween(-1.2, 1.2);
          e.dirTimer = randomBetween(60, 150);
        }
        e.x += e.vx; e.y += e.vy;
        if (e.x < 30) { e.x = 30; e.vx = Math.abs(e.vx); }
        if (e.x > W - 30) { e.x = W - 30; e.vx = -Math.abs(e.vx); }
        if (e.y < 30) { e.y = 30; e.vy = Math.abs(e.vy); }
        if (e.y > H * 0.7) { e.y = H * 0.7; e.vy = -Math.abs(e.vy); }
      } else if (e.type === 'berserk') {
        updateBerserkMovement(e, p.x, p.y, W, H);
        updateBerserkLaser(s, e, p);
      } else if (e.type === 'eater') {
        e._chargePlayerTimer = (e._chargePlayerTimer || 0) + 1;
        if (e._chargePlayerTimer > 180) {
          const dx = p.x - e.x, dy = p.y - e.y;
          const len = Math.hypot(dx, dy) || 1;
          e.vx = (dx / len) * 2.5;
          e.vy = (dy / len) * 2.5;
        }
      }
    });

    updateEnemyPositions(s, W, H);

    // Block spawning & movement
    s.blockSpawnTimer--;
    if (s.blockSpawnTimer <= 0) { s.blocks.push(spawnBlock(W)); s.blockSpawnTimer = 120; }
    s.blocks = s.blocks.filter(b => {
      b.y += b.vy;
      return b.y < H;
    });

    // Bullets
    s.bullets = s.bullets.filter(b => {
      b.x += b.vx; b.y += b.vy;
      if (b.type === 'photon') b.orbitAngle = ((b.orbitAngle || 0) + 0.25);
      if (b.type === 'missile') updateMissiles([b], s.enemies);
      return b.y > -20 && b.y < H + 20 && b.x > -20 && b.x < W + 20;
    });

    // Powerup items
    s.powerupItems.forEach(item => { item.y += 1.2; item.angle = (item.angle || 0) + 0.04; });
    s.powerupItems = s.powerupItems.filter(item => item.y < H + 30);

    // Collision: bullets vs enemies
    for (let i = 0; i < s.bullets.length; i++) {
      const b = s.bullets[i];
      for (let j = 0; j < s.enemies.length; j++) {
        const e = s.enemies[j];
        const dist = Math.hypot(b.x - e.x, b.y - e.y);
        if (dist < (b.size || 4) + (e.w / 2)) {
          let damage = 1;
          if (b.type === 'missile') damage = getMissileHitDamage((b.missileTier || 1));
          e.hp -= damage;
          if (e.hp <= 0) {
            sounds.enemyExplode();
            s.score += (e.type === 'boss' ? 500 : e.type === 'elite' ? 50 : 10);
            onScoreChange(s.score);
            spawnExplosion(s, e.x, e.y, e.type === 'eater' ? '#ff00ff' : '#ffff00');
            if (e.type === 'eater' && !e._mini) spawnMiniEaters(W, s, e);
            if (e.dropType || (e.type === 'dropper')) {
              const type = e.dropType || 'shield';
              s.powerupItems.push({ x: e.x, y: e.y, type, angle: 0 });
            }
          }
          if (shouldSpawnMissileExplosion(b.missileTier)) {
            spawnExplosion(s, b.x, b.y, '#ff00ff', 6);
          }
          s.bullets.splice(i, 1); i--;
          break;
        }
      }
    }

    // Collision: player vs enemies
    s.enemies.forEach(e => {
      const dist = Math.hypot(p.x - e.x, p.y - e.y);
      if (dist < 20 + (e.w / 2)) takeDamage(s);
    });

    // Collision: player vs powerups
    s.powerupItems = s.powerupItems.filter(item => {
      const dist = Math.hypot(p.x - item.x, p.y - item.y);
      if (dist < 25) {
        if (['shield', 'star', 'speed', 'rapidfire', 'wingman'].includes(item.type)) {
          applyUtilityPowerup(item, s, p, onPowerupChange, sounds);
        } else {
          s.powerups[item.type] = Math.min((s.powerups[item.type] || 0) + 1, 10);
          sounds.powerup();
          onPowerupChange(s.powerups);
        }
        return false;
      }
      return true;
    });

    // Particles
    s.particles.forEach(pt => {
      if (pt.shockwave) { pt.shockwaveR += 4; pt.alpha -= 0.04; }
      else { pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.04; pt.alpha -= 0.025; }
    });
    s.particles = s.particles.filter(pt => pt.alpha > 0);

    // Wave completion check
    if (s.enemies.length === 0 && !s.waveEnemiesCleared) {
      s.waveEnemiesCleared = true;
      s.wave++;
      onWaveChange(s.wave);
      spawnWave(W, s);
    }

    // Draw everything
    s.particles.forEach(pt => drawParticle(ctx, pt));
    s.powerupItems.forEach(item => drawPowerupItem(ctx, item));
    s.blocks.forEach(b => drawBlock(ctx, b, BLOCK_SIZE));
    s.enemies.forEach(e => {
      if (e.type === 'berserk') drawBerserk(ctx, e);
      else drawEnemy(ctx, e);
    });
    s.bullets.forEach(b => drawBullet(ctx, b, false));
    drawPlayer(ctx, p, s.wingmen, s.shieldHp, s.enemies, s.invincibleTimer, keys, s.starInvincibleTimer, s.superWingman, s.superWingmen);

    animRef.current = requestAnimationFrame(loop);
  }, [onScoreChange, onLivesChange, onMaxLivesChange, onWaveChange, onPowerupChange, setGameState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener('resize', resize);

    if (gameState === 'playing') {
      const W = canvas.width, H = canvas.height;
      const s = stateRef.current;
      Object.assign(s, initState());
      s.player = { x: W / 2, y: H - 80 };
      s.stars = initStars(W, H);
      s.running = true;
      spawnWave(W, s);
      lastTimeRef.current = performance.now();
      animRef.current = requestAnimationFrame(loop);
    } else {
      sounds.stopAllMusic();
      stateRef.current.running = false;
      if (animRef.current) cancelAnimationFrame(animRef.current);
    }

    return () => {
      window.removeEventListener('resize', resize);
      sounds.stopAllMusic();
      stateRef.current.running = false;
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [gameState, loop]);

  useEffect(() => {
    const down = e => { keysRef.current[e.key] = true; };
    const up = e => { keysRef.current[e.key] = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  return <>
    <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    <MobileControls keysRef={keysRef} />
  </>;
}