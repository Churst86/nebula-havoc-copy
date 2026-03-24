import React, { useRef, useEffect, useCallback } from 'react';
import MobileControls from './MobileControls';
import { sounds } from '../../hooks/useSound.js';
import { spawnBerserk, spawnEater } from '../../lib/enemySpawners.js';
import { updateBerserkMovement, updateBerserkLaser, drawBerserk } from '../../lib/berserkUtils.js';
import { fireReverseShot, drawReverseFlame } from '../../lib/reverseGunUtils.js';
import { fireMissiles, updateMissiles, drawMissile, getMissileHitDamage, shouldSpawnMissileExplosion } from '../../lib/missileUtils.js';
import { DROPPER_COLORS, DROPPER_LABELS, DROPPER_ROTATION } from '../../lib/powerupConfig.js';
import { drawBlock, drawPiledCells, drawParticle } from '../../lib/drawingUtils.js';
import { loadSprites, getSprite, getBossSpriteKey, BOSS_SPRITE_MAP, drawSprite } from '../../lib/spriteLoader.js';
import { useMotionControls } from './useMotionControls.jsx';
import {
  createBossWarning, spawnBoss,
  updateBossMovement, updateBossTier1Fire, updateBossTier2Fire,
  updateBossTier3Fire, updateBossTier4Fire, updateBossTier5Fire,
  updateHomingBullets,
  drawBossAnchor, drawBossSweepLaser, drawBossSuperLaser,
  updateBossTier4Armor, drawBossTier4Armor,
} from '../../lib/bossLogic.js';
import { initBeholderMovement, updateBeholderMovement, updateBeholderShield, updateBeholderFire, getBeholderShieldRadius } from '../../lib/beholderLogic.js';
import { drawBeholderShield, drawBeholderLasers } from '../../lib/beholderDrawing.js';
import { drawBossHUD } from '../../lib/bossHudUtils.js';
import { tickBossWarning } from '../../lib/bossSpawnController.js';
import { updateLaserBeam, LASER_CHARGE_FRAMES, LASER_BEAM_FRAMES, LASER_COOLDOWN_FRAMES } from '../../lib/laserLogic.js';
import { spawnWave, progressWave } from '../../lib/waveSpawner.js';
import { HITBOX_SIZES } from '../../lib/hitboxConfig.js';
import { updateBlockSettling } from '../../lib/blockSettling.js';

// ====================== OBJECT POOLS ======================
const BULLET_POOL_SIZE = 1500;
const ENEMY_POOL_SIZE = 300;
const PARTICLE_POOL_SIZE = 1000;

let bulletPool = [];
let enemyPool = [];
let particlePool = [];

function initPools() {
  bulletPool = Array.from({ length: BULLET_POOL_SIZE }, () => ({ active: false }));
  enemyPool = Array.from({ length: ENEMY_POOL_SIZE }, () => ({ active: false }));
  particlePool = Array.from({ length: PARTICLE_POOL_SIZE }, () => ({ active: false }));
}

function getBullet() {
  for (let b of bulletPool) if (!b.active) { b.active = true; return b; }
  return { active: true }; // fallback
}

function releaseBullet(b) {
  if (b) b.active = false;
}

function getEnemy() {
  for (let e of enemyPool) if (!e.active) { e.active = true; return e; }
  return { active: true };
}

function releaseEnemy(e) {
  if (e) e.active = false;
}

function getParticle() {
  for (let p of particlePool) if (!p.active) { p.active = true; return p; }
  return { active: true };
}

function releaseParticle(p) {
  if (p) p.active = false;
}

// ====================== SPATIAL GRID ======================
const CELL_SIZE = 64;

function buildSpatialGrid(entities, W, H) {
  const grid = new Map();
  const cols = Math.ceil(W / CELL_SIZE);
  const rows = Math.ceil(H / CELL_SIZE);

  entities.forEach((e, idx) => {
    if (!e || e.dead) return;
    const minCol = Math.floor((e.x - (e.w || 20)) / CELL_SIZE);
    const maxCol = Math.floor((e.x + (e.w || 20)) / CELL_SIZE);
    const minRow = Math.floor((e.y - (e.h || 20)) / CELL_SIZE);
    const maxRow = Math.floor((e.y + (e.h || 20)) / CELL_SIZE);

    for (let c = Math.max(0, minCol); c <= Math.min(cols - 1, maxCol); c++) {
      for (let r = Math.max(0, minRow); r <= Math.min(rows - 1, maxRow); r++) {
        const key = `${c},${r}`;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(idx);
      }
    }
  });
  return grid;
}

// ====================== CONSTANTS ======================
const SPREAD_SHOTS_PER_RELOAD = 2;
const SPREAD_RELOAD_FRAMES = 80;
const TETRIS_SHAPES = [ /* ... your existing shapes ... */ ];
const BLOCK_SIZE = 18;
const BLOCK_COLORS = ['#00f0ff', '#ff44ff', '#ffdd00', '#44ffaa', '#ff8800', '#aaff00', '#ff4488'];
const DROPPER_SPAWN_INTERVAL = 480;
const STAR_SPAWN_INTERVAL = 1800;
const STAR_INVINCIBLE_FRAMES = 150;
const POWERUP_SPRITE_KEYS = { /* ... your map ... */ };

function randomBetween(a, b) { return a + Math.random() * (b - a); }

export default function GameCanvas({ 
  gameState, setGameState, onScoreChange, onBlockScoreChange, 
  onLivesChange, onMaxLivesChange, onWaveChange, onPowerupChange, 
  onBossWarning, continuesLeft, onContinueUsed, isPaused, 
  difficultyConfig, gameSpeed = 30, carryOverPowerups = null, 
  shopUpgrades = null, startWave = 1, onLoadProgress = null, 
  bossMode = false, mobileSpeed = 1.0, /* ... other props ... */
}) {
  const canvasRef = useRef(null);
  const keysRef = useRef({});
  const stateRef = useRef({ /* your initState without pools */ });
  const animRef = useRef(null);
  const lastTimeRef = useRef(0);
  const accumulatorRef = useRef(0);
  const playerShipImageRef = useRef(null);
  const spritesReadyRef = useRef(false);
  const shopUpgradesRef = useRef(shopUpgrades);
  const scoreUpdateThrottle = useRef(0);

  useEffect(() => { shopUpgradesRef.current = shopUpgrades; }, [shopUpgrades]);

  useMotionControls(keysRef, /* ... */);

  // Load sprites
  useEffect(() => {
    loadSprites((sprites) => {
      playerShipImageRef.current = sprites['PlayerShip'] || null;
      spritesReadyRef.current = true;
    }, onLoadProgress);
  }, []);

  // Paused handling
  const isPausedRef = useRef(isPaused);
  const gameSpeedRef = useRef(gameSpeed);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { gameSpeedRef.current = gameSpeed; }, [gameSpeed]);

  // ====================== MAIN GAME LOOP ======================
  const loop = useCallback((timestamp) => {
    if (!stateRef.current.running || isPausedRef.current || !spritesReadyRef.current) {
      animRef.current = requestAnimationFrame(loop);
      return;
    }

    const delta = Math.min(timestamp - lastTimeRef.current, 100); // cap delta
    lastTimeRef.current = timestamp;
    accumulatorRef.current += delta;

    const fixedDt = 1000 / gameSpeedRef.current;
    const s = stateRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    while (accumulatorRef.current >= fixedDt) {
      updateGame(s, W, H, keysRef.current, fixedDt / 16.666); // normalized dt ~1 at 60fps
      accumulatorRef.current -= fixedDt;
    }

    renderGame(ctx, s, W, H);
    animRef.current = requestAnimationFrame(loop);
  }, []);

  // ====================== UPDATE ======================
   // ====================== UPDATE ======================
  function updateGame(s, W, H, keys, dt) {
    const p = s.player;
    if (!p) return;

    // Player movement with delta time
    const baseSpd = (4.5 + (s.powerups.speed || 0) * 1.5) * dt;
    const motionX = keys['motionX'] || 0;
    const motionY = keys['motionY'] || 0;

    if (Math.abs(motionX) > 0.05) p.x += motionX * baseSpd;
    if (Math.abs(motionY) > 0.05) p.y += motionY * baseSpd;

    if (keys['ArrowLeft'] || keys['a'] || keys['A']) p.x -= baseSpd;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) p.x += baseSpd;
    if (keys['ArrowUp'] || keys['w'] || keys['W']) p.y -= baseSpd;
    if (keys['ArrowDown'] || keys['s'] || keys['S']) p.y += baseSpd;

    p.x = Math.max(16, Math.min(W - 16, p.x));
    p.y = Math.max(16, Math.min(H - 16, p.y));

    // TODO: Add the rest of your update logic (firing, wingmen, dropper spawn, boss logic, etc.)
    // We'll add more in the next step
  }

  // ====================== RENDER ======================
  function renderGame(ctx, s, W, H) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(5,5,20,0.85)';
    ctx.fillRect(0, 0, W, H);

    // Draw stars
    s.stars.forEach(st => {
      st.y += st.speed;
      if (st.y > H) { st.y = 0; st.x = Math.random() * W; }
      ctx.globalAlpha = st.alpha;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    });

    // Draw your existing draw calls (add more as we go)
    s.blocks.forEach(b => drawBlock(ctx, b));
    s.piledCells.forEach(cell => drawPiledCells(ctx, [cell])); // adjust if needed
    s.powerupItems.forEach(item => drawPowerupItem(ctx, item));
    s.enemies.forEach(e => drawEnemy(ctx, e));
    s.bullets.forEach(b => drawBullet(ctx, b, false));
    s.enemyBullets.forEach(b => drawBullet(ctx, b, true));
    s.particles.forEach(pt => drawParticle(ctx, pt));

    drawPlayer(ctx, s.player, s.wingmen, s.shieldHp, s.enemies, s.invincibleTimer, keysRef.current, s.starInvincibleTimer, s.superWingman, s.superWingmen, s.armorHp);

    // Add laser, boss HUD, harvesters, drones, etc. here later
  }

  // ====================== COLLISION HELPERS ======================
  function handleBulletEnemyCollisions(s, grid) {
    // Use the grid to only check nearby enemies for each bullet
    s.bullets.forEach(b => {
      if (b.hit) return;
      const col = Math.floor(b.x / CELL_SIZE);
      const row = Math.floor(b.y / CELL_SIZE);
      const key = `${col},${row}`;
      const candidates = grid.get(key) || [];
      // also check neighboring cells for safety
      for (let dc = -1; dc <= 1; dc++) {
        for (let dr = -1; dr <= 1; dr++) {
          const nkey = `${col+dc},${row+dr}`;
          const list = grid.get(nkey) || [];
          for (let idx of list) {
            const e = s.enemies[idx];
            if (!e || e.dead) continue;
            // your existing hit test logic here
            // if hit → damage, spawn explosion, releaseBullet(b), etc.
          }
        }
      }
    });
  }

  // Add similar helper for player vs enemies if needed

  // ====================== INIT / CLEANUP ======================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    if (gameState === 'playing') {
      initPools(); // important!
      const W = canvas.width, H = canvas.height;
      const s = stateRef.current;
      Object.assign(s, initState()); // your original init
      s.player = { x: W / 2, y: H - 80 };
      s.stars = initStars(W, H);
      // ... carryOverPowerups, armor, wave, etc. ...

      s.running = true;
      onWaveChange(s.wave);
      spawnWaveLocal(W, s);

      lastTimeRef.current = performance.now();
      accumulatorRef.current = 0;
      animRef.current = requestAnimationFrame(loop);
    } else {
      // pause / stop logic
      stateRef.current.running = false;
      if (animRef.current) cancelAnimationFrame(animRef.current);
    }

    return () => {
      window.removeEventListener('resize', resize);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [gameState, loop]);

  // Keyboard handlers (unchanged)

  return (
    <>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      <MobileControls keysRef={keysRef} /* ... */ />
    </>
  );
}