import React, { useRef, useEffect, useCallback } from 'react';
import MobileControls from './MobileControls';
import { sounds } from '../../hooks/useSound.js';
import { spawnBerserk, spawnEater } from '../../lib/enemySpawners.js';
import { updateBerserkMovement, updateBerserkLaser, drawBerserk } from '../../lib/berserkUtils.js';
import { fireReverseShot, drawReverseFlame } from '../../lib/reverseGunUtils.js';
import { fireMissiles, updateMissiles, drawMissile } from '../../lib/missileUtils.js';
import { DROPPER_COLORS, DROPPER_LABELS, DROPPER_ROTATION } from '../../lib/powerupConfig.js';
import { drawBlock, drawPiledCells, drawParticle } from '../../lib/drawingUtils.js';
import { loadSprites, getSprite, getBossSpriteKey, drawSprite } from '../../lib/spriteLoader.js';
import { useMotionControls } from './useMotionControls.jsx';
import {
  updateBossMovement, updateBossTier1Fire, updateBossTier2Fire,
  updateBossTier3Fire, updateBossTier4Fire, updateBossTier5Fire,
  updateHomingBullets, updateBossTier4Armor, drawBossTier4Armor,
  drawBeholderShield, drawBeholderLasers, drawBossHUD,
} from '../../lib/bossLogic.js';
import { initBeholderMovement, updateBeholderMovement, updateBeholderShield, updateBeholderFire, getBeholderShieldRadius } from '../../lib/beholderLogic.js';
import { tickBossWarning } from '../../lib/bossSpawnController.js';
import { updateLaserBeam, LASER_CHARGE_FRAMES, LASER_BEAM_FRAMES, LASER_COOLDOWN_FRAMES } from '../../lib/laserLogic.js';
import { spawnWave, progressWave } from '../../lib/waveSpawner.js';
import { HITBOX_SIZES } from '../../lib/hitboxConfig.js';
import { updateBlockSettling } from '../../lib/blockSettling.js';

// ====================== CONSTANTS ======================
const SPREAD_SHOTS_PER_RELOAD = 2;
const SPREAD_RELOAD_FRAMES = 80;
const TETRIS_SHAPES = [
  [[0,0],[1,0],[2,0],[3,0]], // I
  [[0,0],[1,0],[0,1],[1,1]], // O
  [[1,0],[0,1],[1,1],[2,1]], // T
  [[0,0],[0,1],[1,1],[2,1]], // L
  [[2,0],[0,1],[1,1],[2,1]], // J
  [[1,0],[2,0],[0,1],[1,1]], // S
  [[0,0],[1,0],[1,1],[2,1]], // Z
];
const BLOCK_SIZE = 18;
const BLOCK_COLORS = ['#00f0ff', '#ff44ff', '#ffdd00', '#44ffaa', '#ff8800', '#aaff00', '#ff4488'];
const DROPPER_SPAWN_INTERVAL = 480;
const STAR_SPAWN_INTERVAL = 1800;
const STAR_INVINCIBLE_FRAMES = 150;
const DROPPER_ROTATE_FRAMES = 90;

const POWERUP_SPRITE_KEYS = {
  shotgun: 'Shotgun Powerup',
  photon: 'Photon Powerup',
  laser: 'Laser Powerup',
  missile: 'Missile Powerup',
  bounce: 'BounceshotPowerup',
  reverse: 'Reverseshot Powerup',
};

// ====================== INIT STATE ======================
function initState() {
  return {
    player: null,
    bullets: [],
    enemyBullets: [],
    enemies: [],
    particles: [],
    powerupItems: [],
    wingmen: [],
    stars: [],
    blocks: [],
    piledCells: [],
    harvesters: [],
    drones: [],
    blockSpawnTimer: 120,
    score: 0,
    blockScore: 0,
    armorHp: 0,
    lives: 3,
    maxLives: 3,
    wave: 1,
    waveTimer: 0,
    fireTimer: 0,
    invincibleTimer: 0,
    spiralAngle: 0,
    laserCharge: 0,
    laserCooldown: 0,
    laserBeamActive: false,
    laserBeamTimer: 0,
    spreadShotsLeft: SPREAD_SHOTS_PER_RELOAD,
    spreadReloadTimer: 0,
    spreadFireTimer: 10,
    wingmanFireTimer: 0,
    superWingmanFireTimer: 0,
    powerups: {},
    lockedPowerups: [],
    shieldHp: 0,
    running: false,
    starInvincibleTimer: 0,
    dropperSpawnTimer: DROPPER_SPAWN_INTERVAL,
    dropperRotationIdx: 0,
    dropperRotateTimer: DROPPER_ROTATE_FRAMES,
    starDropperTimer: STAR_SPAWN_INTERVAL,
    reverseFireTimer: 0,
    bossWarning: null,
    superWingmen: [],
  };
}

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
  return { active: true };
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
    const minCol = Math.floor((e.x - (e.w || 30)) / CELL_SIZE);
    const maxCol = Math.floor((e.x + (e.w || 30)) / CELL_SIZE);
    const minRow = Math.floor((e.y - (e.h || 30)) / CELL_SIZE);
    const maxRow = Math.floor((e.y + (e.h || 30)) / CELL_SIZE);

    for (let c = Math.max(0, minCol); c <= Math.min(cols-1, maxCol); c++) {
      for (let r = Math.max(0, minRow); r <= Math.min(rows-1, maxRow); r++) {
        const key = `${c},${r}`;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(idx);
      }
    }
  });
  return grid;
}

function randomBetween(a, b) { return a + Math.random() * (b - a); }

export default function GameCanvas(props) {
  const {
    gameState, setGameState, onScoreChange, onBlockScoreChange,
    onLivesChange, onMaxLivesChange, onWaveChange, onPowerupChange,
    onBossWarning, isPaused, difficultyConfig, gameSpeed = 30,
    carryOverPowerups = null, shopUpgrades = null, startWave = 1,
    onLoadProgress = null, bossMode = false, mobileSpeed = 1.0,
    joystickVisible = true, joystickSize = 1.0,
    motionControlEnabled = false, motionInvertX = false,
    motionInvertY = false, motionAccelSpeed = 1.0
  } = props;

  const canvasRef = useRef(null);
  const keysRef = useRef({});
  const stateRef = useRef(null);
  const animRef = useRef(null);
  const lastTimeRef = useRef(0);
  const accumulatorRef = useRef(0);
  const playerShipImageRef = useRef(null);
  const spritesReadyRef = useRef(false);
  const shopUpgradesRef = useRef(shopUpgrades);
  const scoreUpdateThrottle = useRef(0);

  useEffect(() => { shopUpgradesRef.current = shopUpgrades; }, [shopUpgrades]);

  useMotionControls(keysRef, motionControlEnabled, mobileSpeed * (motionAccelSpeed || 1.0), motionInvertX, motionInvertY);

  // Load sprites
  useEffect(() => {
    loadSprites((sprites) => {
      playerShipImageRef.current = sprites['PlayerShip'] || null;
      spritesReadyRef.current = true;
    }, (progress) => onLoadProgress && onLoadProgress(progress));
  }, [onLoadProgress]);

  const isPausedRef = useRef(isPaused);
  const gameSpeedRef = useRef(gameSpeed);

  useEffect(() => { 
    isPausedRef.current = isPaused; 
    sounds.setPauseVolume(isPaused); 
  }, [isPaused]);

  useEffect(() => { 
    gameSpeedRef.current = gameSpeed; 
  }, [gameSpeed]);

  // ====================== MAIN LOOP ======================
  const loop = useCallback((timestamp) => {
    if (!stateRef.current?.running || isPausedRef.current || !spritesReadyRef.current) {
      animRef.current = requestAnimationFrame(loop);
      return;
    }

    const delta = Math.min(timestamp - lastTimeRef.current, 100);
    lastTimeRef.current = timestamp;
    accumulatorRef.current += delta;

    const fixedDt = 1000 / gameSpeedRef.current;
    const s = stateRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;

    while (accumulatorRef.current >= fixedDt) {
      updateGame(s, canvas.width, canvas.height, keysRef.current, fixedDt / 16.666);
      accumulatorRef.current -= fixedDt;
    }

    renderGame(canvas.getContext('2d'), s, canvas.width, canvas.height);
    animRef.current = requestAnimationFrame(loop);
  }, []);

  // ====================== UPDATE ======================
  function updateGame(s, W, H, keys, dt) {
    const p = s.player;
    if (!p) return;

    // Player movement
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

    // TODO: Add the rest of your update logic here in the next step (firing, enemies, collisions, etc.)
    // For now we keep it minimal to get past title screen
  }

  // ====================== RENDER ======================
  function renderGame(ctx, s, W, H) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(5,5,20,0.85)';
    ctx.fillRect(0, 0, W, H);

    // Stars
    s.stars.forEach(st => {
      st.y += st.speed;
      if (st.y > H) { st.y = 0; st.x = Math.random() * W; }
      ctx.globalAlpha = st.alpha;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    });

    // Basic drawing
    s.blocks.forEach(b => drawBlock && drawBlock(ctx, b));
    s.piledCells.forEach(cell => drawPiledCells && drawPiledCells(ctx, [cell]));
    s.powerupItems.forEach(item => drawPowerupItem && drawPowerupItem(ctx, item));
    s.enemies.forEach(e => drawEnemy && drawEnemy(ctx, e));
    s.bullets.forEach(b => drawBullet && drawBullet(ctx, b, false));
    s.enemyBullets.forEach(b => drawBullet && drawBullet(ctx, b, true));
    s.particles.forEach(pt => drawParticle && drawParticle(ctx, pt));

    if (s.player) {
      drawPlayer && drawPlayer(ctx, s.player, s.wingmen, s.shieldHp, s.enemies, s.invincibleTimer, keysRef.current, s.starInvincibleTimer, s.superWingman, s.superWingmen, s.armorHp);
    }
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
        x: Math.random() * W, y: Math.random() * H,
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
      if (animRef.current) cancelAnimationFrame(animRef.current);
    }

    return () => {
      window.removeEventListener('resize', resize);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [gameState, carryOverPowerups, shopUpgrades, startWave, onWaveChange, loop]);

  // Keyboard
  useEffect(() => {
    const down = e => keysRef.current[e.key] = true;
    const up = e => keysRef.current[e.key] = false;
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      <MobileControls 
        keysRef={keysRef} 
        mobileSpeed={mobileSpeed} 
        joystickVisible={joystickVisible} 
        joystickSize={joystickSize} 
      />
    </>
  );
}