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
  function updateGame(s, W, H, keys, dt) {
    const p = s.player;
    // ... your existing player movement, wingmen, firing logic, etc. (use dt for speeds) ...

    // Example: movement with dt
    const baseSpd = (4.5 + (s.powerups.speed || 0) * 1.5) * dt;
    // ... apply keys / motion ...

    // Update all active entities with dt
    updateBullets(s, W, H, dt);
    updateEnemies(s, p, W, H, dt);
    updateParticles(s, dt);
    updateHarvestersAndDrones(s, p, dt);
    updateBlocks(s, H, dt);

    // Collisions using spatial grid (much faster)
    const enemyGrid = buildSpatialGrid(s.enemies, W, H);
    handleBulletEnemyCollisions(s, enemyGrid);
    handlePlayerCollisions(s, p);

    // Wave / spawn logic
    // ... your existing waveTimer, dropper spawn, etc. ...

    // Throttled React updates
    scoreUpdateThrottle.current++;
    if (scoreUpdateThrottle.current > 6) { // ~10 times per second
      onScoreChange(s.score);
      onBlockScoreChange(s.blockScore);
      scoreUpdateThrottle.current = 0;
    }
  }

  // ====================== RENDER ======================
  function renderGame(ctx, s, W, H) {
    ctx.fillStyle = 'rgba(5,5,20,0.85)';
    ctx.fillRect(0, 0, W, H);

    // draw stars, blocks, piledCells, powerups, enemies, bullets, particles, player, HUD, etc.
    // (keep your existing draw functions — they are fine)
    s.stars.forEach(/* draw */);
    s.blocks.forEach(b => drawBlock(ctx, b));
    s.piledCells.forEach(/* draw */);
    s.powerupItems.forEach(item => drawPowerupItem(ctx, item));
    s.enemies.forEach(e => drawEnemy(ctx, e));
    s.bullets.forEach(b => drawBullet(ctx, b, false));
    s.enemyBullets.forEach(b => drawBullet(ctx, b, true));
    s.particles.forEach(pt => drawParticle(ctx, pt)); // or your mine explosion logic
    drawPlayer(/* ... */);
    // boss HUD, harvesters, drones, laser beam, etc.
  }
  // ====================== GAME INITIALIZATION ======================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth || 800;
      canvas.height = canvas.offsetHeight || 600;
    };
    resize();
    window.addEventListener('resize', resize);

    if (gameState === 'playing') {
      initPools();

      const W = canvas.width;
      const H = canvas.height;

      stateRef.current = initState();
      const s = stateRef.current;

      s.player = { x: W / 2, y: H - 100 };
      s.stars = Array.from({ length: 120 }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.5 + 0.3,
        speed: Math.random() * 0.6 + 0.1,
        alpha: Math.random() * 0.7 + 0.3,
      }));

      if (carryOverPowerups) {
        const shieldHp = carryOverPowerups.shieldHp || 0;
        delete carryOverPowerups.shieldHp;
        s.powerups = { ...carryOverPowerups };
        s.shieldHp = shieldHp;
      }

      s.wave = startWave > 1 ? startWave : 1;
      s.armorHp = (shopUpgrades?.armor || 0) * 3 || 0;
      s.running = true;

      onWaveChange(s.wave);

      lastTimeRef.current = performance.now();
      accumulatorRef.current = 0;

      animRef.current = requestAnimationFrame(loop);
    } else {
      if (stateRef.current) stateRef.current.running = false;
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
    }

    return () => {
      window.removeEventListener('resize', resize);
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
      }
    };
  }, [gameState, carryOverPowerups, shopUpgrades, startWave, onWaveChange, loop]);
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


  // Keyboard handlers (unchanged)

  return (
    <>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      <MobileControls keysRef={keysRef} /* ... */ />
    </>
  );
}