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
  const lastTimeRef =