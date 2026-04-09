// Helper to get global attack bonuses from shop upgrades
function getGlobalAttackBonuses(shopUpgrades) {
  const atkDmg = shopUpgrades?.atkDmg || 0;
  const atkSpd = shopUpgrades?.atkSpd || 0;
  return {
    atkDmgMult: 1 + atkDmg * 0.01,
    atkSpdMult: 1 + atkSpd * 0.01,
  };
}
import React, { useRef, useEffect, useCallback } from 'react';
import MobileControls from './MobileControls';
import { sounds } from '../../hooks/useSound.js';
import { spawnGlutton, spawnEater } from '../../lib/enemySpawners.js';
import { drawGlutton } from '../../lib/gluttonUtils.js';
import { fireReverseShot, drawReverseFlame } from '../../lib/reverseGunUtils.js';
import { initBulletPool, acquireBullet, releaseBullet } from '../../lib/bulletPool.js';
import { loadSprites, getSprite, drawSprite, isSpritesLoaded, getBossSpriteKey, hasDrawableSprite } from '../../lib/spriteLoader.js';
import { updateBeholderMovement, updateBeholderShield, updateBeholderFire, getBeholderShieldRadius } from '../../lib/beholderLogic.js';
import { drawBeholderShield, drawBeholderLasers } from '../../lib/beholderDrawing.js';
import { createBossWaveEnemies } from '../../lib/multiBossSpawner.js';
import { drawBossHUD } from '../../lib/bossHudUtils.js';
import { HITBOX_SIZES } from '../../lib/hitboxConfig.js';

// Laser beam constants
const LASER_CHARGE_FRAMES = 90;      // frames to charge before firing (slower = fires less often)
const LASER_BEAM_FRAMES = 120;       // frames beam stays active (~2 sec)
const LASER_COOLDOWN_FRAMES = 180;   // frames of cooldown after beam ends

// Spread shotgun constants
const SPREAD_SHOTS_PER_RELOAD = 2;
const SPREAD_RELOAD_FRAMES = 80;

// Tetris block shapes (each cell is [col, row])
const TETRIS_SHAPES = [
  [[0,0],[1,0],[2,0],[3,0]],         // I
  [[0,0],[1,0],[0,1],[1,1]],         // O
  [[1,0],[0,1],[1,1],[2,1]],         // T
  [[0,0],[0,1],[1,1],[2,1]],         // L
  [[2,0],[0,1],[1,1],[2,1]],         // J
  [[1,0],[2,0],[0,1],[1,1]],         // S
  [[0,0],[1,0],[1,1],[2,1]],         // Z
];
const BLOCK_SIZE = 18;
const BLOCK_COLORS = ['#00f0ff', '#ff44ff', '#ffdd00', '#44ffaa', '#ff8800', '#aaff00', '#ff4488'];

function randomBetween(a, b) { return a + Math.random() * (b - a); }

const DROPPER_SPAWN_INTERVAL = 480; // spawn a dropper every ~8 seconds (at 60fps), independent of wave

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
    blocks: [],          // falling tetris blocks
    piledCells: [],      // {x, y, color} settled block cells on the bottom
    blockSpawnTimer: 120,
    score: 0,
    blockScore: 0,       // currency earned from destroying blocks
    lives: 3,
    maxLives: 3,
    wave: 1,
    waveTimer: 0,
    fireTimer: 0,
    invincibleTimer: 0,  // frames of invincibility after health damage
    spiralAngle: 0,
    laserCharge: 0,
    laserCooldown: 0,
    laserBeamActive: false,   // beam is firing
    laserBeamTimer: 0,        // frames remaining on beam
    spreadShotsLeft: SPREAD_SHOTS_PER_RELOAD,
    spreadReloadTimer: 0,
    spreadFireTimer: 10,
    wingmanFireTimer: 0,
    superWingmanFireTimer: 0,
    reverseFireTimer: 0,
    missileFireSide: -1,
    missileVolleyShotsLeft: 0,
    missileVolleyTimer: 0,
    missileVolleyCooldown: 0,
    missileVolleyIndex: 0,
    powerups: {},
    lockedPowerups: [],
    shieldHp: 0,
    armorHp: 0,
    running: false,
    starInvincibleTimer: 0,   // frames of star invincibility
    dropperSpawnTimer: DROPPER_SPAWN_INTERVAL, // global recurring timer
    dropperRotateTimer: DROPPER_ROTATE_FRAMES, // countdown to rotate dropper type
    starDropperTimer: STAR_SPAWN_INTERVAL,     // separate timer for rare star dropper
  };
}

// Offensive powerup types that count toward the lock system
const OFFENSIVE_POWERUPS = ['spread', 'laser', 'photon', 'bounce', 'missile', 'reverse'];
// Special powerups that bypass the lock
const SPECIAL_POWERUPS = ['speed', 'shield', 'rapidfire', 'wingman'];
// Auxiliary upgrades (one per wave each)
const AUXILIARY_UPGRADES = ['speed', 'rapidfire', 'wingman', 'shield'];
const BLOCK_CURRENCY_PER_DESTROY = 35;
const BLOCK_CURRENCY_PER_PILED_CELL = 15;
const BLOCK_CURRENCY_PER_HARVESTER_COLLECT = 90;

const STAR_INVINCIBLE_FRAMES = 420; // 7 seconds at 60fps

const WEAPON_COLORS = {
  spread: '#ff9900',
  laser: '#ff2200',
  photon: '#44ffaa',
  bounce: '#aaff00',
  missile: '#ff00ff',
  reverse: '#ffffff', // White core for reverse shot (glow handled in drawing)
  wingman: '#44aaff',
  normal: '#00f0ff',
};

function getProjectileImpactColor(type) {
  if (type === 'spread' || type === 'spreadPellet') return WEAPON_COLORS.spread;
  if (type === 'laser') return WEAPON_COLORS.laser;
  if (type === 'photon') return WEAPON_COLORS.photon;
  if (type === 'bounce') return WEAPON_COLORS.bounce;
  if (type === 'missile') return WEAPON_COLORS.missile;
  if (type === 'reverse') return WEAPON_COLORS.reverse;
  if (type === 'wingman') return WEAPON_COLORS.wingman;
  return WEAPON_COLORS.normal;
}

// Dropper enemy appearance per powerup type
const DROPPER_COLORS = {
  spread: WEAPON_COLORS.spread, laser: WEAPON_COLORS.laser, photon: WEAPON_COLORS.photon,
  wingman: WEAPON_COLORS.wingman, shield: '#00ccff', bounce: WEAPON_COLORS.bounce,
  speed: '#ff8800', rapidfire: '#ff4488', missile: '#ff00ff', reverse: '#ffffff', star: '#ffffff',
};
const DROPPER_LABELS = {
  spread: 'S', laser: 'L', photon: 'P', wingman: 'W',
  shield: '🛡', bounce: 'B', speed: '▶', rapidfire: '⚡', missile: '→', reverse: '↩', star: '★',
};

// All dropper types in random pool (star excluded — spawned separately at low chance)
const DROPPER_TYPES = ['spread', 'laser', 'photon', 'bounce', 'missile', 'reverse', 'wingman', 'shield', 'speed', 'rapidfire'];
const DROPPER_ROTATE_FRAMES = 300; // rotate every 5 seconds at 60fps
// Star spawns separately with a low independent chance
const STAR_SPAWN_INTERVAL = 1800; // ~30 seconds between star dropper spawns

const LEGACY_POWERUP_KEY_MAP = {
  shotgun: 'spread',
};

function normalizePowerupType(type) {
  if (type === ('ray' + 'gun')) return 'photon';
  return LEGACY_POWERUP_KEY_MAP[type] || type;
}

function normalizePowerups(powerups = {}) {
  const normalized = {};
  Object.entries(powerups).forEach(([key, value]) => {
    const mappedKey = normalizePowerupType(key);
    if (typeof value === 'number') {
      normalized[mappedKey] = Math.max(normalized[mappedKey] || 0, value);
    } else {
      normalized[mappedKey] = value;
    }
  });
  return normalized;
}

export default function GameCanvas({ gameState, setGameState, onScoreChange, onBlockScoreChange, onLivesChange, onMaxLivesChange, onWaveChange, onPowerupChange, onBossWarning, onFpsChange, continuesLeft, onContinueUsed, isPaused, difficultyConfig, gameSpeed = 30, speedBoostMultiplier = 1, autoFireEnabled = true, carryOverPowerups = null, livePowerups = null, startWave = 1, shopUpgrades = {}, bossMode = false, skipBossSignal = 0, setBoss, setTargetEnemy, setAimMode }) {
    // --- Super Eater Boss Mechanic ---
    function tryTriggerSuperEater(s) {
      if (s.superEaterSpawned) return;
      // Find all fully grown eaters (growthStage >= 2, not dead, not mini)
      const grownEaters = s.enemies.filter(e => e && e.type === 'eater' && !e.dead && !e._mini && e._growthStage >= 2);
      if (grownEaters.length < 5) return;
      // Check for a cluster of 5 within 180px of each other (centroid distance)
      for (let i = 0; i <= grownEaters.length - 5; i++) {
        const group = [grownEaters[i]];
        for (let j = 0; j < grownEaters.length && group.length < 5; j++) {
          if (i === j) continue;
          const dist = Math.hypot(grownEaters[i].x - grownEaters[j].x, grownEaters[i].y - grownEaters[j].y);
          if (dist < 180) group.push(grownEaters[j]);
        }
        if (group.length === 5) {
          // Merge: remove all 5, compute centroid, sum HP
          const centroid = group.reduce((acc, e) => ({ x: acc.x + e.x, y: acc.y + e.y }), { x: 0, y: 0 });
          centroid.x /= 5; centroid.y /= 5;
          const totalHp = group.reduce((acc, e) => acc + (e.hp || 0), 0);
          const totalMaxHp = group.reduce((acc, e) => acc + (e.maxHp || 0), 0);
          // Remove merged eaters
          s.enemies = s.enemies.filter(e => !group.includes(e));
          // Spawn Super Eater
          s.enemies.push({
            type: 'superEater',
            x: centroid.x,
            y: centroid.y,
            w: 220,
            h: 220,
            hp: totalHp * 1.5,
            maxHp: totalMaxHp * 1.5,
            vx: (Math.random() - 0.5) * 3.2, // much faster than normal eater
            vy: (Math.random() - 0.5) * 3.2,
            boss: true,
            _superEater: true,
            _regenTimer: 0,
            _fireTimer: 0,
            _mergeAnim: 1,
          });
          s.superEaterSpawned = true;
          // Trigger boss warning
          if (onBossWarningRef.current) onBossWarningRef.current({ name: 'Super Eater', color: '#ff00ff' });
          // Play boss music
          if (sounds && sounds.startBossMusic) sounds.startBossMusic();
          break;
        }
      }
    }
  const canvasRef = useRef(null);
  const keysRef = useRef({});
  const stateRef = useRef(initState());
  const animRef = useRef(null);
  const lastTimeRef = useRef(0);
  const isPausedRef = useRef(isPaused);
  const gameSpeedRef = useRef(gameSpeed);
  const speedBoostMultiplierRef = useRef(speedBoostMultiplier);
  const autoFireEnabledRef = useRef(autoFireEnabled);
  const carryOverPowerupsRef = useRef(carryOverPowerups);
  const livePowerupsRef = useRef(livePowerups);
  const startWaveRef = useRef(startWave);
  const onPowerupChangeRef = useRef(onPowerupChange);
  const onBossWarningRef = useRef(onBossWarning);
  const onFpsChangeRef = useRef(onFpsChange);
  const shopUpgradesRef = useRef(shopUpgrades);
  const bossModeRef = useRef(bossMode);
  const skipBossSignalRef = useRef(skipBossSignal);
  const difficultyConfigRef = useRef(difficultyConfig);
  const fpsTrackerRef = useRef({ lastTs: 0, frameCount: 0, lastReported: 60 });
  const aimModeRef = useRef(false);

  // Initialize bullet pool on component mount
  useEffect(() => {
    initBulletPool(stateRef.current, { player: 300, enemy: 400 });
    // Load sprites from GitHub
    loadSprites();
  }, []);

  // Track boss, targetEnemy, and aimMode for HUD
  useEffect(() => {
    // Find boss (enemy with type 'boss')
    const s = stateRef.current;
    const boss = (s.enemies || []).find(e => e && e.type === 'boss' && !e.dead);
    if (setBoss) setBoss(boss || null);

    // Find target enemy (nearest to player if aimMode)
    let targetEnemy = null;
    if (s.player && s.enemies && aimModeRef.current) {
      targetEnemy = getNearestAimTarget(s.player.x, s.player.y, s.enemies);
    }
    if (setTargetEnemy) setTargetEnemy(targetEnemy || null);

    if (setAimMode) setAimMode(!!aimModeRef.current);
  });

  useEffect(() => { gameSpeedRef.current = gameSpeed; }, [gameSpeed]);
  useEffect(() => { speedBoostMultiplierRef.current = Math.max(1, Math.min(3, Number(speedBoostMultiplier) || 1)); }, [speedBoostMultiplier]);
  useEffect(() => { autoFireEnabledRef.current = autoFireEnabled; }, [autoFireEnabled]);
  useEffect(() => { carryOverPowerupsRef.current = carryOverPowerups; }, [carryOverPowerups]);
  useEffect(() => { livePowerupsRef.current = livePowerups; }, [livePowerups]);
  useEffect(() => { startWaveRef.current = startWave; }, [startWave]);
  useEffect(() => { onPowerupChangeRef.current = onPowerupChange; }, [onPowerupChange]);
  useEffect(() => { onBossWarningRef.current = onBossWarning; }, [onBossWarning]);
  useEffect(() => { onFpsChangeRef.current = onFpsChange; }, [onFpsChange]);
  useEffect(() => { shopUpgradesRef.current = shopUpgrades; }, [shopUpgrades]);
  useEffect(() => { bossModeRef.current = bossMode; }, [bossMode]);
  useEffect(() => { skipBossSignalRef.current = skipBossSignal; }, [skipBossSignal]);
  useEffect(() => { difficultyConfigRef.current = difficultyConfig; }, [difficultyConfig]);
  useEffect(() => {
    isPausedRef.current = isPaused;
    sounds.setPauseVolume(isPaused);
  }, [isPaused]);

  useEffect(() => {
    if (!livePowerups) return;
    const s = stateRef.current;
    if (!s?.running) return;

    const incoming = normalizePowerups(livePowerups);
    const nextPowerups = { ...s.powerups };
    OFFENSIVE_POWERUPS.forEach((key) => {
      const lvl = Math.max(0, Math.min(10, incoming[key] || 0));
      if (lvl > 0) nextPowerups[key] = lvl;
      else delete nextPowerups[key];
    });

    s.powerups = nextPowerups;
    // livePowerups is parent-driven state in boss mode, so do not echo it back
    // through onPowerupChange or React will enter an update feedback loop.
  }, [livePowerups]);

  function initStars(W, H) {
    return Array.from({ length: 120 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 1.5 + 0.3,
      speed: Math.random() * 0.6 + 0.1,
      alpha: Math.random() * 0.7 + 0.3,
    }));
  }

  // ── Wave spawner ─────────────────────────────────────────────
  function spawnWave(W, s) {
    const wave = s.wave;
    const cfg = difficultyConfigRef.current || { hpMult: 1, maxWave: 100, blockSpeedMult: 1 };
    const hpMult = cfg.hpMult || 1;

    // Check max wave cap — trigger congratulations state (Challenger shop will be shown after continue)
    if (cfg.maxWave && wave > cfg.maxWave) {
      sounds.stopAllMusic();
      s.running = false;
      setGameState('congratulations');
      return;
    }

    const enemies = [];
    const isBossWave = bossModeRef.current ? true : wave % 5 === 0;

    if (isBossWave) {
      enemies.push(...createBossWaveEnemies(W, wave, hpMult));

      sounds.startBossMusic();
      s.dropperSpawnTimer = DROPPER_SPAWN_INTERVAL;
      s.starDropperTimer = STAR_SPAWN_INTERVAL;
      s.dropperRotateTimer = DROPPER_ROTATE_FRAMES;
      s.enemies = enemies;
      return;
    }

    sounds.startWaveMusic(wave);

    const count = 5 + wave * 2;
    for (let i = 0; i < count; i++) {
      const isElite = wave > 3 && Math.random() < 0.25;
      const baseHp = isElite ? 3 : 1;
      const hp = Math.round(baseHp * hpMult);
      enemies.push({
        type: isElite ? 'elite' : 'basic',
        x: randomBetween(40, W - 40),
        y: -30 - i * 28,
        w: isElite ? 22 : 18, h: isElite ? 22 : 18,
        hp, maxHp: hp,
        vx: randomBetween(-0.5, 0.5) * (1 + wave * 0.04),
        vy: (0.35 + wave * 0.06) * (Math.random() * 0.4 + 0.7),
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
          y: -50 - i * 40,
          w: 20, h: 20,
          hp: mineHp, maxHp: mineHp,
          vx: randomBetween(-0.6, 0.6),
          vy: (0.4 + wave * 0.05),
          fireTimer: 9999,
        });
      }
    }

    const isHell = cfg.maxWave === 100;
    if (wave > 10 && wave % 2 === 0) {
      spawnEater(enemies, W, wave, hpMult);
      const shouldSpawnExtraEater =
        (wave >= 18 && wave % 4 === 0)
        || (isHell && wave >= 30 && Math.random() < 0.25);
      if (shouldSpawnExtraEater) {
        spawnEater(enemies, W, wave, hpMult);
      }
    }
    if (wave > 18 && (wave % 3 === 0 || (isHell && wave > 35 && wave % 2 === 0))) {
      spawnGlutton(enemies, W, wave, hpMult, isHell);
    }

    s.enemies = enemies;
  }

  function getNextDropperType(s) {
    // Pick a random powerup from available types (prefer non-maxed)
    const available = DROPPER_TYPES.filter(t => (s.powerups[t] || 0) < 10);
    if (available.length > 0) {
      return available[Math.floor(Math.random() * available.length)];
    }
    // All maxed — pick any random one
    return DROPPER_TYPES[Math.floor(Math.random() * DROPPER_TYPES.length)];
  }

  function spawnDreadnoughtWave(s, boss, W, elite = false) {
    const hpMult = (difficultyConfigRef.current && difficultyConfigRef.current.hpMult) || 1;
    const enraged = !!boss?._enraged;
    const count = elite
      ? Math.floor(randomBetween(enraged ? 3 : 2, enraged ? 6 : 4))
      : Math.floor(randomBetween(enraged ? 5 : 3, enraged ? 11 : 6));

    // Launch-bay flare from the center hangar before deploy.
    const lx = boss.x;
    const ly = boss.y + 48;
    spawnExplosion(s, lx, ly, elite ? '#ff66ff' : '#66ccff', elite ? 18 : 14);
    for (let i = 0; i < 20; i++) {
      const a = Math.PI / 2 + randomBetween(-0.4, 0.4);
      const spd = randomBetween(1.4, 4.2);
      s.particles.push({
        x: lx,
        y: ly,
        vx: Math.cos(a) * spd * 0.6,
        vy: Math.sin(a) * spd,
        r: randomBetween(1.8, 3.8),
        alpha: 1,
        color: elite ? '#ff88ff' : '#66ddff',
      });
    }

    for (let i = 0; i < count; i++) {
      const px = Math.max(40, Math.min(W - 40, boss.x + randomBetween(-22, 22)));
      const py = boss.y + randomBetween(44, 60);
      if (elite) {
        const ehp = Math.max(2, Math.round(3 * hpMult));
        if (isBossWave) {
          enemies.push(...createBossWaveEnemies(W, wave, hpMult));

          sounds.startBossMusic();
          s.dropperSpawnTimer = DROPPER_SPAWN_INTERVAL;
          s.starDropperTimer = STAR_SPAWN_INTERVAL;
          s.dropperRotateTimer = DROPPER_ROTATE_FRAMES;
          s.enemies = enemies;
          return;
        }

        sounds.startWaveMusic(wave);

        const count = 5 + wave * 2;
        for (let i = 0; i < count; i++) {
          const isElite = wave > 3 && Math.random() < 0.25;
          const baseHp = isElite ? 3 : 1;
          const hp = Math.round(baseHp * hpMult);
          enemies.push({
            type: isElite ? 'elite' : 'basic',
            x: randomBetween(40, W - 40),
            y: -30 - i * 28,
            w: isElite ? 22 : 18, h: isElite ? 22 : 18,
            hp, maxHp: hp,
            vx: randomBetween(-0.5, 0.5) * (1 + wave * 0.04),
            vy: (0.35 + wave * 0.06) * (Math.random() * 0.4 + 0.7),
            fireTimer: randomBetween(60, 120),
          });
        }

        const isHell = cfg.maxWave === 100;
        if (wave > 10 && wave % 2 === 0) {
          spawnEater(enemies, W, wave, hpMult);
          const shouldSpawnExtraEater =
            (wave >= 18 && wave % 4 === 0)
            || (isHell && wave >= 30 && Math.random() < 0.25);
          if (shouldSpawnExtraEater) {
            spawnEater(enemies, W, wave, hpMult);
          }
        }
        if (wave > 18 && (wave % 3 === 0 || (isHell && wave > 35 && wave % 2 === 0))) {
          spawnGlutton(enemies, W, wave, hpMult, isHell);
        }

        s.enemies = enemies;
      }
      const scatterTimer = 58;
      const scatterDamp = 0.985;
      const targetTravel = Math.max(260, Math.min(W * 0.52, 680));
      const distanceScale = 0.9 + (i / Math.max(1, spawnCount - 1 || 1)) * 0.3;
      const desiredTravel = targetTravel * distanceScale;
      const geometricDen = Math.max(0.0001, 1 - Math.pow(scatterDamp, scatterTimer));
      const baseScatterSpeed = desiredTravel * (1 - scatterDamp) / geometricDen;
      const scatterSpeed = baseScatterSpeed * randomBetween(0.95, 1.08);
      const miniScale = 0.54;
      const mini = {
        type: 'eater',
        _mini: true,
        _growthStage: 0,
        _growthMeter: 0,
        x: parent.x + Math.cos(scatterAngle) * spawnRadius,
        y: parent.y + Math.sin(scatterAngle) * spawnRadius,
        w: Math.round(HITBOX_SIZES.eater.w * miniScale),
        h: Math.round(HITBOX_SIZES.eater.h * miniScale),
        hp: miniHp,
        maxHp: miniHp,
        vx: randomBetween(-0.6, 0.6),
        vy: randomBetween(-0.4, 0.4),
        fireTimer: 9999,
        _chargePlayerTimer: 0,
        _blocksEaten: 0,
        _offspringCount: 0,
        _offspringCap: parent?._lineageDepth >= 1 ? 1 : 2,
        _lineageDepth: Math.min(2, (parent?._lineageDepth || 0) + 1),
        _spawnCooldown: 540,
        _passiveRoamPhase: Math.random() * Math.PI * 2,
        _scatterTimer: scatterTimer,
        _scatterDamp: scatterDamp,
        _scatterVx: Math.cos(scatterAngle) * scatterSpeed,
        _scatterVy: Math.sin(scatterAngle) * scatterSpeed,
      };
      s.enemies.push(mini);
      spawnExplosion(s, mini.x, mini.y, '#44ff88', 8);
      created += 1;
    }
    return created;
  }

  function spawnDropper(W, s, forcedType) {
    const dropType = forcedType || getNextDropperType(s);
    const dc = DROPPER_COLORS[dropType] || '#ffd700';
    s.enemies.push({
      type: 'dropper',
      dropType,
      x: randomBetween(80, W - 80), y: randomBetween(60, 200),
      w: 22, h: 22,
      hp: 1, maxHp: 1,
      vx: randomBetween(-1.2, 1.2), vy: randomBetween(-0.8, 0.8),
      dirTimer: randomBetween(60, 120),
      color: dc,
    });
  }

  function getNearestAimTarget(originX, originY, enemies) {
    let bestTarget = null;
    let bestDist = Infinity;
    (enemies || []).forEach((enemy) => {
      if (!enemy || enemy.dead) return;
      const dist = Math.hypot(enemy.x - originX, enemy.y - originY);
      if (dist < bestDist) {
        bestDist = dist;
        bestTarget = enemy;
      }
    });
    return bestTarget;
  }

  function normalizeAngle(angle) {
    let next = angle;
    while (next <= -Math.PI) next += Math.PI * 2;
    while (next > Math.PI) next -= Math.PI * 2;
    return next;
  }

  function rotateAngleTowards(current, target, maxStep) {
    const delta = normalizeAngle(target - current);
    if (Math.abs(delta) <= maxStep) return target;
    return current + Math.sign(delta) * maxStep;
  }

  function getAimTransformFromRotation(originX, originY, rotation) {
    const facingAngle = rotation - Math.PI / 2;
    const dirX = Math.cos(facingAngle);
    const dirY = Math.sin(facingAngle);
    const rightX = -dirY;
    const rightY = dirX;
    return {
      dirX,
      dirY,
      rightX,
      rightY,
      rotation,
      noseX: originX + dirX * 18,
      noseY: originY + dirY * 18,
    };
  }

  function getAimTransform(originX, originY, enemies, aimMode = false) {
    const target = aimMode ? getNearestAimTarget(originX, originY, enemies) : null;
    let dirX = 0;
    let dirY = -1;
    if (target) {
      const dx = target.x - originX;
      const dy = target.y - originY;
      const len = Math.hypot(dx, dy) || 1;
      dirX = dx / len;
      dirY = dy / len;
    }
    const rightX = -dirY;
    const rightY = dirX;
    return {
      dirX,
      dirY,
      rightX,
      rightY,
      rotation: Math.atan2(dirY, dirX) + Math.PI / 2,
      noseX: originX + dirX * 18,
      noseY: originY + dirY * 18,
    };
  }

  function getBeamHitDistance(originX, originY, dirX, dirY, targetX, targetY, radius, maxDistance) {
    const dx = targetX - originX;
    const dy = targetY - originY;
    const projection = dx * dirX + dy * dirY;
    if (projection < 0 || projection > maxDistance) return null;
    const perpendicular = Math.abs(dx * (-dirY) + dy * dirX);
    if (perpendicular > radius) return null;
    return projection;
  }

  // ── Fire logic ───────────────────────────────────────────────
  function fireSpreadShot(s) {
    const p = s.player;
    const spreadTier = (s.powerups.spread || 0) || (s.powerups.shotgun || 0);
    if (spreadTier === 0) return;
    if (s.spreadReloadTimer > 0) return;
    if (s.spreadShotsLeft <= 0) return;
    // For laser, always use the smoothly swept _aimRotation in face-target mode
    const aim = aimModeRef.current
      ? getAimTransformFromRotation(p.x, p.y, Number.isFinite(p._aimRotation) ? p._aimRotation : 0)
      : getAimTransform(p.x, p.y, s.enemies, false);
    const baseAngle = Math.atan2(aim.dirY, aim.dirX);

    // Fire an immediate forward cone; starts at 2 shots and scales with tier.
    const pelletCount = Math.min(11, 1 + spreadTier);
    const spreadDeg = Math.min(150, 16 + spreadTier * 10);
    let { atkDmgMult } = getGlobalAttackBonuses(shopUpgradesRef.current);
    // New scaling: +1 damage at odd levels (3,5,7,9), special effect at even
    let bonusDmg = 0;
    if (spreadTier >= 3) bonusDmg += 1;
    if (spreadTier >= 5) bonusDmg += 1;
    if (spreadTier >= 7) bonusDmg += 1;
    if (spreadTier >= 9) bonusDmg += 1;
    atkDmgMult *= (1 + bonusDmg);
    if (spreadTier >= 10) atkDmgMult *= 2; // Keep tier 10 double damage
    for (let i = 0; i < pelletCount; i++) {
      const t = pelletCount === 1 ? 0.5 : i / (pelletCount - 1);
      const angle = baseAngle - (spreadDeg * Math.PI / 180) / 2 + (spreadDeg * Math.PI / 180) * t;
      acquireBullet(s, {
        x: aim.noseX,
        y: aim.noseY,
        vx: Math.cos(angle) * 5.8,
        vy: Math.sin(angle) * 8.4,
        type: 'spreadPellet',
        atkDmgMult,
      }, 'player');
    }

    s.spreadShotsLeft--;
    if (s.spreadShotsLeft <= 0) s.spreadReloadTimer = SPREAD_RELOAD_FRAMES;
  }

  function playerFire(s) {
    const p = s.player;
    const pw = s.powerups;
    const aim = aimModeRef.current
      ? getAimTransformFromRotation(p.x, p.y, Number.isFinite(p._aimRotation) ? p._aimRotation : 0)
      : getAimTransform(p.x, p.y, s.enemies, false);
    const laserTier  = pw.laser  || 0;
    const photonTier = pw.photon || 0;
    const bounceTier = pw.bounce || 0;

    // Photon tiers:
    // - Lvl 1-4: single center shot
    // - Lvl 5-9: dual wing shots
    // - Lvl 10: larger infinite-pierce photon that travels until off-screen
    if (photonTier > 0) {
      const isTier10Photon = photonTier >= 10;
      const shotOffsets = isTier10Photon ? [0] : (photonTier >= 5 ? [-26, 26] : [0]);
      const photonSpeed = isTier10Photon ? -12 : -11;
      const photonSize = isTier10Photon ? 18 : 10;
      let photonDmgMult = 1;
      // New scaling: +1 damage at odd levels (3,5,7,9)
      let bonusDmg = 0;
      if (photonTier >= 3) bonusDmg += 1;
      if (photonTier >= 5) bonusDmg += 1;
      if (photonTier >= 7) bonusDmg += 1;
      if (photonTier >= 9) bonusDmg += 1;
      photonDmgMult *= (1 + bonusDmg);
      if (photonTier >= 10) photonDmgMult = 2 * (1 + bonusDmg); // Tier 10: double
      for (let i = 0; i < shotOffsets.length; i++) {
        const xOffset = shotOffsets[i];
        acquireBullet(s, {
          x: aim.noseX + aim.rightX * xOffset,
          y: aim.noseY + aim.rightY * xOffset,
          vx: aim.dirX * Math.abs(photonSpeed),
          vy: aim.dirY * Math.abs(photonSpeed),
          type: 'photon', size: photonSize, orbitAngle: 0,
          pierceCount: isTier10Photon ? Number.POSITIVE_INFINITY : photonTier,
          infinitePierce: isTier10Photon,
          piercedEnemies: [],
          isSuperOrbit: false,
          orbitPhase: 0,
          atkDmgMult: photonDmgMult,
        }, 'player');
      }
    }

    if (bounceTier > 0) {
      // Bounce shot should survive level + 1 impacts.
      const bounces = bounceTier + 1;
      const side = Math.floor(s.spiralAngle * 2) % 2 === 0 ? -1 : 1;
      s.spiralAngle += 0.1;
      const bounceShotCount = bounceTier >= 10 ? 3 : bounceTier >= 6 ? 2 : 1;
      let bounceDmgMult = 1;
      // New scaling: +1 damage at odd levels (3,5,7,9)
      let bonusDmg = 0;
      if (bounceTier >= 3) bonusDmg += 1;
      if (bounceTier >= 5) bonusDmg += 1;
      if (bounceTier >= 7) bonusDmg += 1;
      if (bounceTier >= 9) bonusDmg += 1;
      bounceDmgMult *= (1 + bonusDmg);
      if (bounceTier >= 10) bounceDmgMult = 2 * (1 + bonusDmg);
      for (let i = 0; i < bounceShotCount; i++) {
        const lane = i - (bounceShotCount - 1) / 2;
        const lateralOffset = side * 8 + lane * 9;
        const lateralSpeed = side * 3.5 + lane * 1.35;
        const forwardSpeed = 10 + Math.abs(lane) * 0.15;
        acquireBullet(s, {
          x: aim.noseX + aim.rightX * lateralOffset,
          y: aim.noseY + aim.rightY * lateralOffset,
          vx: aim.dirX * forwardSpeed + aim.rightX * lateralSpeed,
          vy: aim.dirY * forwardSpeed + aim.rightY * lateralSpeed,
          type: 'bounce',
          bouncesLeft: bounces,
          atkDmgMult: bounceDmgMult,
        }, 'player');
      }
    }

    // Always keep the base blue shot active alongside other weapon powerups.
    const { atkDmgMult } = getGlobalAttackBonuses(shopUpgradesRef.current);
    acquireBullet(s, {
      x: aim.noseX,
      y: aim.noseY,
      vx: aim.dirX * 7,
      vy: aim.dirY * 7,
      type: 'normal',
      atkDmgMult,
    }, 'player');
  }

  function fireMissileVolleyShot(s, missileTier) {
    if (!missileTier || missileTier <= 0) return;
    const p = s.player;
    const aim = aimModeRef.current
      ? getAimTransformFromRotation(p.x, p.y, Number.isFinite(p._aimRotation) ? p._aimRotation : 0)
      : getAimTransform(p.x, p.y, s.enemies, false);
    const shotIndex = Math.max(0, s.missileVolleyIndex || 0);
    const baseSpeed = 7.4 + Math.min(missileTier, 10) * 0.22;
    const maxTurnRate = 0.085 + Math.min(missileTier, 10) * 0.011;
    const hardpoints = [-48, -32, -16, 16, 32, 48];
    const maxHardpointAbs = Math.max(...hardpoints.map(v => Math.abs(v)));
    const hardpoint = hardpoints[((shotIndex + (s.missileFireSide > 0 ? 1 : 0)) % hardpoints.length + hardpoints.length) % hardpoints.length];
    const row = Math.floor(shotIndex / hardpoints.length);
    const yOffset = row * 5;
    const laneJitter = ((shotIndex % hardpoints.length) - (hardpoints.length - 1) / 2) * 0.03;
    const lateralBias = (hardpoint / maxHardpointAbs) * 0.48;
    const startAngle = Math.atan2(aim.dirY, aim.dirX) + lateralBias + laneJitter;
    const homingDelay = 12 + Math.floor(Math.abs(hardpoint) / 8) + row * 2;

    let { atkDmgMult } = getGlobalAttackBonuses(shopUpgradesRef.current);
    // New scaling: +1 damage at odd levels (3,5,7,9)
    let bonusDmg = 0;
    if (missileTier >= 3) bonusDmg += 1;
    if (missileTier >= 5) bonusDmg += 1;
    if (missileTier >= 7) bonusDmg += 1;
    if (missileTier >= 9) bonusDmg += 1;
    atkDmgMult *= (1 + bonusDmg);
    if (missileTier >= 10) atkDmgMult *= 2;
    acquireBullet(s, {
      x: aim.noseX + aim.rightX * hardpoint - aim.dirX * yOffset,
      y: aim.noseY + aim.rightY * hardpoint - aim.dirY * yOffset,
      vx: Math.cos(startAngle) * baseSpeed,
      vy: Math.sin(startAngle) * baseSpeed,
      type: 'missile',
      missileTier,
      speed: baseSpeed,
      maxTurnRate,
      homingDelay,
      preferredTarget: null,
      atkDmgMult,
    }, 'player');

    s.missileVolleyIndex = shotIndex + 1;
    s.missileFireSide = (s.missileFireSide || -1) * -1;
  }

  function getFireRate(pw) {
    const speedBonus = (pw.rapidfire || 0) === 1 ? 10 : (pw.rapidfire || 0) * 8;
    const photonTier = pw.photon || 0;
    const spreadTier = (pw.spread || 0) || (pw.shotgun || 0);
    const bounceTier = pw.bounce || 0;
    const { atkSpdMult } = getGlobalAttackBonuses(shopUpgradesRef.current);
    if (photonTier > 0) return Math.max(14, (50 - photonTier * 4 - speedBonus) / atkSpdMult);
    if (spreadTier > 0 && photonTier === 0 && bounceTier === 0) return Math.max(12, (50 - speedBonus) / atkSpdMult);
    if (bounceTier >= 10) return Math.max(7, (24 - speedBonus) / atkSpdMult);
    if (bounceTier > 0) return Math.max(10, (35 - speedBonus) / atkSpdMult);
    return Math.max(10, (35 - speedBonus) / atkSpdMult);
  }

  // ── Tetris block helpers ─────────────────────────────────────
  function spawnBlock(W, wave = 1) {
    const shapeIdx = Math.floor(Math.random() * TETRIS_SHAPES.length);
    const shape = TETRIS_SHAPES[shapeIdx];
    // 8% chance of invulnerable steel block
    const isInvulnerable = Math.random() < 0.08;
    const color = isInvulnerable ? '#aaaacc' : BLOCK_COLORS[Math.floor(Math.random() * BLOCK_COLORS.length)];
    const cols = shape.map(c => c[0]);
    const maxCol = Math.max(...cols);
    const startX = randomBetween(BLOCK_SIZE, W - (maxCol + 1) * BLOCK_SIZE);
    // HP scales with number of cells, then follows the same difficulty hp ratio as enemies.
    const cellCount = shape.length;
    const baseHp = cellCount <= 2 ? 1 : cellCount === 3 ? 2 : 3;
    const cfg = difficultyConfigRef.current || {};
    let hpMult = cfg.hpMult || 1;
    // Mirror enemy over-cap scaling path so blocks keep pace in higher-difficulty progression.
    if (cfg.maxWave && wave > cfg.maxWave) {
      const over = wave - cfg.maxWave;
      hpMult *= 1 + Math.floor(over / 5) * 0.1;
    }
    const hp = Math.max(1, Math.round(baseHp * hpMult));
    const blockSpeedMult = cfg.blockSpeedMult || 1;
    const blockSpinEnabled = cfg.blockSpin !== false;
    const blockSpinMult = cfg.blockSpinMult ?? (blockSpinEnabled ? 1 : 0);
    const tierBoost = cfg.maxWave >= 100 ? 2.1 : cfg.maxWave >= 50 ? 1.55 : 1;
    const baseVy = (0.8 + Math.random() * 0.55) * blockSpeedMult * tierBoost;
    const spinDir = Math.random() < 0.5 ? -1 : 1;
    const spinSpeed = blockSpinEnabled ? (0.01 + Math.random() * 0.014) * tierBoost * blockSpinMult * spinDir : 0;
    return {
      shape,
      color,
      x: startX,
      y: -BLOCK_SIZE * 2,
      vy: baseVy,
      hp,
      maxHp: hp,
      settled: false,
      invulnerable: isInvulnerable,
      rot: 0,
      rotSpeed: spinSpeed,
    };
  }

  function getBlockCells(block) {
    const cols = block.shape.map(([col]) => col);
    const rows = block.shape.map(([, row]) => row);
    const minCol = Math.min(...cols);
    const maxCol = Math.max(...cols);
    const minRow = Math.min(...rows);
    const maxRow = Math.max(...rows);
    const pivotX = block.x + ((minCol + maxCol + 1) * BLOCK_SIZE) / 2;
    const pivotY = block.y + ((minRow + maxRow + 1) * BLOCK_SIZE) / 2;
    const rot = block.rot || 0;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);

    return block.shape.map(([col, row]) => {
      const cx = block.x + col * BLOCK_SIZE + BLOCK_SIZE / 2;
      const cy = block.y + row * BLOCK_SIZE + BLOCK_SIZE / 2;
      const relX = cx - pivotX;
      const relY = cy - pivotY;
      const worldCx = pivotX + relX * cos - relY * sin;
      const worldCy = pivotY + relX * sin + relY * cos;
      return {
        x: worldCx - BLOCK_SIZE / 2,
        y: worldCy - BLOCK_SIZE / 2,
      };
    });
  }

  function isCellOnStage(cell, W, H) {
    return cell.x + BLOCK_SIZE >= 0
      && cell.x <= W
      && cell.y + BLOCK_SIZE >= 0
      && cell.y <= H;
  }

  function drawBlock(ctx, block) {
    const alpha = block.invulnerable ? 1 : (block.hp / block.maxHp);
    const cols = block.shape.map(([col]) => col);
    const rows = block.shape.map(([, row]) => row);
    const minCol = Math.min(...cols);
    const maxCol = Math.max(...cols);
    const minRow = Math.min(...rows);
    const maxRow = Math.max(...rows);
    const pivotX = block.x + ((minCol + maxCol + 1) * BLOCK_SIZE) / 2;
    const pivotY = block.y + ((minRow + maxRow + 1) * BLOCK_SIZE) / 2;
    ctx.save();
    ctx.translate(pivotX, pivotY);
    ctx.rotate(block.rot || 0);
    block.shape.forEach(([col, row]) => {
      const bx = block.x + col * BLOCK_SIZE - pivotX;
      const by = block.y + row * BLOCK_SIZE - pivotY;
      if (block.invulnerable) {
        // Steel look: grey gradient with cross-hatch lines
        ctx.shadowColor = '#8888bb'; ctx.shadowBlur = 6;
        ctx.fillStyle = '#555577';
        ctx.fillRect(bx + 1, by + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
        ctx.strokeStyle = '#9999bb'; ctx.lineWidth = 1.5;
        ctx.strokeRect(bx + 1, by + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
        // Diagonal hatch
        ctx.strokeStyle = 'rgba(180,180,220,0.25)'; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bx + 1, by + 1); ctx.lineTo(bx + BLOCK_SIZE - 1, by + BLOCK_SIZE - 1);
        ctx.moveTo(bx + BLOCK_SIZE / 2, by + 1); ctx.lineTo(bx + BLOCK_SIZE - 1, by + BLOCK_SIZE / 2);
        ctx.stroke();
        // ∞ symbol
        ctx.fillStyle = 'rgba(200,200,255,0.6)';
        ctx.font = `bold ${Math.round(BLOCK_SIZE * 0.55)}px monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('∞', bx + BLOCK_SIZE / 2, by + BLOCK_SIZE / 2);
      } else {
        ctx.shadowColor = block.color; ctx.shadowBlur = 8;
        ctx.fillStyle = block.color + Math.round(alpha * 0xcc).toString(16).padStart(2, '0');
        ctx.fillRect(bx + 1, by + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
        ctx.strokeStyle = block.color; ctx.lineWidth = 1.5;
        ctx.strokeRect(bx + 1, by + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
      }
    });
    ctx.restore();
  }

  function drawPiledCells(ctx, cells) {
    cells.forEach(cell => {
      ctx.save();
      if (cell.invulnerable) {
        ctx.shadowColor = '#8888bb'; ctx.shadowBlur = 6;
        ctx.fillStyle = '#555577';
        ctx.fillRect(cell.x + 1, cell.y + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
        ctx.strokeStyle = '#9999bb';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(cell.x + 1, cell.y + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
        ctx.fillStyle = 'rgba(210,210,255,0.6)';
        ctx.font = `bold ${Math.round(BLOCK_SIZE * 0.5)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('∞', cell.x + BLOCK_SIZE / 2, cell.y + BLOCK_SIZE / 2);
      } else {
        ctx.shadowColor = cell.color; ctx.shadowBlur = 6;
        ctx.fillStyle = cell.color + '99';
        ctx.fillRect(cell.x + 1, cell.y + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
        ctx.strokeStyle = cell.color;
        ctx.lineWidth = 1;
        ctx.strokeRect(cell.x + 1, cell.y + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
      }
      ctx.restore();
    });
  }

  function getPirateShieldPieceOffset(e, piece, time = Date.now()) {
    const facing = e._shieldFacing ?? (-Math.PI / 2);
    const wobble = Math.sin(time * 0.004 + (piece.jitter || 0)) * 3;
    const angle = facing + (piece.angleOffset || 0);
    const dist = (piece.dist || 95) + wobble;
    const baseX = Math.cos(angle) * dist;
    const baseY = Math.sin(angle) * dist;

    // Preserve captured block silhouette by keeping each cell's local offset.
    const localX = piece.localX || 0;
    const localY = piece.localY || 0;
    const c = Math.cos(facing);
    const s = Math.sin(facing);
    const rx = localX * c - localY * s;
    const ry = localX * s + localY * c;

    return { x: baseX + rx, y: baseY + ry };
  }

  function addPirateShieldCells(e, cells, color, invulnerable = false) {
    if (!e._armorBlocks) e._armorBlocks = [];
    const maxPieces = 36;

    // One shared anchor per absorbed block; pieces keep their relative shape.
    // Placement policy:
    // - invulnerable blocks prefer side arcs
    // - normal blocks prefer front arc, then any bins not occupied by invulnerables
    const binCount = 24;
    const sidePreferredBins = [6, 7, 5, 8, 4, 18, 17, 19, 16, 20, 15, 21];
    const frontPreferredBins = [0, 1, 23, 2, 22, 3, 21, 4, 20, 5, 19];

    const invulnBins = new Set(
      e._armorBlocks
        .filter(p => p.invulnerable && Number.isInteger(p.slotBin))
        .map(p => p.slotBin)
    );

    const usedCountByBin = new Map();
    e._armorBlocks.forEach(p => {
      if (!Number.isInteger(p.slotBin)) return;
      usedCountByBin.set(p.slotBin, (usedCountByBin.get(p.slotBin) || 0) + 1);
    });

    const fallbackBins = Array.from({ length: binCount }, (_, i) => i)
      .sort((a, b) => {
        const da = Math.min(Math.abs(a), binCount - Math.abs(a));
        const db = Math.min(Math.abs(b), binCount - Math.abs(b));
        return da - db;
      });

    const chooseLeastCrowded = (bins) => {
      let bestBin = bins[0];
      let bestCount = Number.POSITIVE_INFINITY;
      bins.forEach(bin => {
        const cnt = usedCountByBin.get(bin) || 0;
        if (cnt < bestCount) {
          bestCount = cnt;
          bestBin = bin;
        }
      });
      return bestBin;
    };

    let slotBin;
    if (invulnerable) {
      slotBin = chooseLeastCrowded(sidePreferredBins);
    } else {
      const frontAvailable = frontPreferredBins.filter(bin => !invulnBins.has(bin));
      if (frontAvailable.length > 0) {
        slotBin = chooseLeastCrowded(frontAvailable);
      } else {
        const nonInvulnBins = fallbackBins.filter(bin => !invulnBins.has(bin));
        slotBin = chooseLeastCrowded(nonInvulnBins.length > 0 ? nonInvulnBins : fallbackBins);
      }
    }

    const binAngle = (slotBin / binCount) * Math.PI * 2;
    const angleOffset = binAngle > Math.PI ? binAngle - Math.PI * 2 : binAngle;
    const existingInBin = usedCountByBin.get(slotBin) || 0;
    const ring = Math.floor(existingInBin / 4);
    // Push Pirate defense blocks outside the visible hull.
    const dist = 206 + ring * 18;

    const centers = cells.map(cell => ({
      x: cell.x + BLOCK_SIZE / 2,
      y: cell.y + BLOCK_SIZE / 2,
    }));
    const centroid = centers.reduce((acc, c) => ({ x: acc.x + c.x, y: acc.y + c.y }), { x: 0, y: 0 });
    const cx = centers.length > 0 ? centroid.x / centers.length : 0;
    const cy = centers.length > 0 ? centroid.y / centers.length : 0;

    centers.forEach(center => {
      if (e._armorBlocks.length >= maxPieces) return;
      e._armorBlocks.push({
        color,
        invulnerable,
        slotBin,
        dist,
        angleOffset,
        localX: center.x - cx,
        localY: center.y - cy,
        jitter: Math.random() * Math.PI * 2,
      });
    });
  }

  function updatePirateBlockShield(e, s, p) {
    if ((e.wave || 0) !== 20) return;
    if (!e._armorBlocks) e._armorBlocks = [];

    const toDx = p.x - e.x;
    const toDy = p.y - e.y;
    e._shieldFacing = Math.atan2(toDy, toDx);

    s.blocks.forEach(block => {
      if (block.dead || block._pirateAbsorbed) return;
      const cells = getBlockCells(block);
      let minDist = Infinity;
      cells.forEach(cell => {
        const cx = cell.x + BLOCK_SIZE / 2;
        const cy = cell.y + BLOCK_SIZE / 2;
        minDist = Math.min(minDist, Math.hypot(cx - e.x, cy - e.y));
      });
      if (minDist < 110) {
        addPirateShieldCells(e, cells, block.invulnerable ? '#aaaacc' : block.color, !!block.invulnerable);
        block.dead = true;
        block._pirateAbsorbed = true;
        spawnExplosion(s, e.x, e.y, block.invulnerable ? '#c7d7ff' : block.color, 12);
      }
    });

    let absorbedCells = 0;
    s.piledCells = s.piledCells.filter(cell => {
      if (absorbedCells >= 3) return true;
      const cx = cell.x + BLOCK_SIZE / 2;
      const cy = cell.y + BLOCK_SIZE / 2;
      if (Math.hypot(cx - e.x, cy - e.y) < 102) {
        addPirateShieldCells(e, [cell], cell.color || '#66ddff', false);
        absorbedCells++;
        spawnExplosion(s, cx, cy, cell.color || '#66ddff', 6);
        return false;
      }
      return true;
    });

    if (e._armorBlocks.length > 36) e._armorBlocks = e._armorBlocks.slice(-36);
  }

  function consumePirateShieldPiece(s, e, hitX, hitY, impactColor = '#00ccff') {
    if (e.type !== 'boss' || (e.wave || 0) !== 20) return false;
    if (!e._armorBlocks || e._armorBlocks.length === 0) return false;

    if (typeof hitX !== 'number' || typeof hitY !== 'number') return false;

    // Only intercept if the hit overlaps an actual occupied shield block cell.
    const half = BLOCK_SIZE / 2;
    let idx = -1;
    let bestDist = Infinity;
    e._armorBlocks.forEach((piece, i) => {
      const off = getPirateShieldPieceOffset(e, piece);
      const px = e.x + off.x;
      const py = e.y + off.y;
      const inside = Math.abs(hitX - px) <= half && Math.abs(hitY - py) <= half;
      if (!inside) return;
      const d = Math.hypot(px - hitX, py - hitY);
      if (d < bestDist) {
        bestDist = d;
        idx = i;
      }
    });
    if (idx < 0) return false;

    const piece = e._armorBlocks[idx];
    const off = getPirateShieldPieceOffset(e, piece || {});
    if (piece?.invulnerable) {
      // Keep invulnerable absorbed blocks permanently active as shield pieces.
      spawnExplosion(s, e.x + off.x, e.y + off.y, '#d8e6ff', 6);
      sounds.hit();
      return true;
    }

    e._armorBlocks.splice(idx, 1);
    spawnExplosion(s, e.x + off.x, e.y + off.y, piece?.color || impactColor, 8);
    sounds.hit();
    return true;
  }

  function getDroneOrbitPose(player, droneLvl, now = Date.now()) {
    const level = Math.min(droneLvl || 0, 10);
    const radius = 44 + level * 1.8;
    const angle = now * (0.0016 + level * 0.00012);
    return {
      x: player.x + Math.cos(angle) * radius,
      y: player.y + Math.sin(angle * 1.12) * (radius * 0.72),
      angle,
    };
  }

  function getHarvesterOrbitPose(player, harvesterLvl, now = Date.now()) {
    const level = Math.min(harvesterLvl || 0, 10);
    const radius = 56 + level * 2.2;
    const angle = -now * (0.0013 + level * 0.0001) + Math.PI * 0.6;
    return {
      x: player.x + Math.cos(angle) * radius,
      y: player.y + Math.sin(angle * 1.06) * (radius * 0.7),
      angle,
    };
  }

  // ── Drawing ──────────────────────────────────────────────────
  function drawPlayer(ctx, p, wingmen, shieldHp, enemies, invincibleTimer, keys, starInvincibleTimer, superWingman, superWingmen, reverseTier = 0, droneLvl = 0, harvesterLvl = 0, harvesterUnit = null, droneUnit = null, aimMode = false) {
    wingmen.forEach(w => {
      let angle = -Math.PI / 2;
      let bestDist = Infinity;
      (enemies || []).forEach(e => {
        const d = Math.hypot(e.x - w.x, e.y - w.y);
        if (d < bestDist) { bestDist = d; angle = Math.atan2(e.y - w.y, e.x - w.x) + Math.PI / 2; }
      });
      ctx.save();
      ctx.translate(w.x, w.y);
      ctx.rotate(angle);
      ctx.shadowColor = '#44aaff'; ctx.shadowBlur = 10;
      
      // Try to load wingman sprite
      const wingmanSprite = getSprite('Wingman');
      if (wingmanSprite && isSpritesLoaded()) {
        drawSprite(ctx, wingmanSprite, -37.5, -37.5, 75, 75);
      } else {
        // Fallback: cyan triangle
        ctx.strokeStyle = '#44aaff'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -10); ctx.lineTo(8, 8); ctx.lineTo(0, 4); ctx.lineTo(-8, 8); ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();
    });

    // Super wingmen — drawn as gold player clones
    (superWingmen || (superWingman ? [superWingman] : [])).forEach(sw => {
      let swAngle = 0;
      if (aimMode && (enemies || []).length > 0) {
        swAngle = Number.isFinite(sw._aimRotation) ? sw._aimRotation : 0;
      }
      ctx.save();
      ctx.translate(sw.x, sw.y);
      ctx.rotate(swAngle);
      ctx.shadowColor = '#ffdd00'; ctx.shadowBlur = 22;
      
      // Try to load super wingman sprite
      const superWingmanSprite = getSprite('SuperWingman');
      if (superWingmanSprite && isSpritesLoaded()) {
        drawSprite(ctx, superWingmanSprite, -45, -45, 90, 90);
      } else {
        // Fallback: gold triangle with star
        ctx.strokeStyle = '#ffdd00'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -18); ctx.lineTo(13, 12); ctx.lineTo(0, 6); ctx.lineTo(-13, 12); ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,221,0,0.12)';
        ctx.fill();
        ctx.fillStyle = '#ffdd00';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('★', 0, 0);
      }
      ctx.restore();
    });

    // Shop support units (visual): Drone + Harvester orbit the ship when purchased.
    const now = Date.now();
    if (droneLvl > 0 && (!droneUnit || droneUnit.alive !== false)) {
      const droneSprite = getSprite('Drone');
      const dronePose = (droneUnit && Number.isFinite(droneUnit.x) && Number.isFinite(droneUnit.y))
        ? droneUnit
        : getDroneOrbitPose(p, droneLvl, now);

      ctx.save();
      ctx.translate(dronePose.x, dronePose.y);
      ctx.rotate(dronePose.angle + Math.PI / 2);
      ctx.shadowColor = '#ffdd00';
      ctx.shadowBlur = 12;
      if (droneSprite && isSpritesLoaded()) {
        drawSprite(ctx, droneSprite, -20, -20, 40, 40);
      } else {
        ctx.strokeStyle = '#ffdd00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = '#ffdd00';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('D', 0, 0);
      }
      ctx.restore();
    }

    if (harvesterLvl > 0 && (!harvesterUnit || harvesterUnit.alive !== false)) {
      const harvesterSprite = getSprite('Harvester');
      const harvesterPose = (harvesterUnit && Number.isFinite(harvesterUnit.x) && Number.isFinite(harvesterUnit.y))
        ? harvesterUnit
        : getHarvesterOrbitPose(p, harvesterLvl, now);

      ctx.save();
      ctx.translate(harvesterPose.x, harvesterPose.y);
      ctx.rotate(harvesterPose.angle - Math.PI / 2);
      ctx.shadowColor = '#ff8800';
      ctx.shadowBlur = 12;
      if (harvesterSprite && isSpritesLoaded()) {
        drawSprite(ctx, harvesterSprite, -20, -20, 40, 40);
      } else {
        ctx.strokeStyle = '#ff8800';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-8, 8);
        ctx.lineTo(0, -8);
        ctx.lineTo(8, 8);
        ctx.stroke();
        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = '#ff8800';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('H', 0, 0);
      }
      ctx.restore();
    }

    // Flash when invincible — skip drawing every other 6 frames
    if (invincibleTimer > 0 && Math.floor(invincibleTimer / 6) % 2 === 0) return;

    // Afterburner — show when moving
    const moving = keys['ArrowLeft'] || keys['a'] || keys['A'] ||
                   keys['ArrowRight'] || keys['d'] || keys['D'] ||
                   keys['ArrowUp'] || keys['w'] || keys['W'] ||
                   keys['ArrowDown'] || keys['s'] || keys['S'];
    if (moving) {
      ctx.save();
      ctx.translate(p.x, p.y);
      const flickerLen = 8 + Math.random() * 10;
      // Left nozzle
      const grad1 = ctx.createLinearGradient(-5, 12, -5, 12 + flickerLen);
      grad1.addColorStop(0, 'rgba(0,240,255,0.9)');
      grad1.addColorStop(0.4, 'rgba(255,140,0,0.7)');
      grad1.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = grad1;
      ctx.beginPath(); ctx.ellipse(-5, 12 + flickerLen / 2, 3, flickerLen / 2, 0, 0, Math.PI * 2); ctx.fill();
      // Right nozzle
      const grad2 = ctx.createLinearGradient(5, 12, 5, 12 + flickerLen);
      grad2.addColorStop(0, 'rgba(0,240,255,0.9)');
      grad2.addColorStop(0.4, 'rgba(255,140,0,0.7)');
      grad2.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = grad2;
      ctx.beginPath(); ctx.ellipse(5, 12 + flickerLen / 2, 3, flickerLen / 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(p.x, p.y);
    
    // Aim-mode: rotate toward nearest enemy, else face up (default).
    if (aimMode && (enemies || []).length > 0) {
      ctx.rotate(Number.isFinite(p._aimRotation) ? p._aimRotation : 0);
    }
    // Try to draw sprite, fall back to shape if not loaded
    const playerSprite = getSprite('PlayerShip');
    if (playerSprite && isSpritesLoaded()) {
      ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 18;
      drawSprite(ctx, playerSprite, -45, -45, 90, 90);
    } else {
      // Fallback: cyan triangle
      ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 18;
      ctx.strokeStyle = '#00f0ff'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -18); ctx.lineTo(13, 12); ctx.lineTo(0, 6); ctx.lineTo(-13, 12); ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,240,255,0.15)';
      ctx.fill();
    }

    if (shieldHp > 0) {
      const alpha = 0.3 + shieldHp * 0.2;
      ctx.shadowColor = '#00aaff'; ctx.shadowBlur = 20;
      ctx.strokeStyle = `rgba(0,180,255,${alpha})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < shieldHp; i++) {
        const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
        ctx.fillStyle = '#00ccff';
        ctx.beginPath(); ctx.arc(Math.cos(a) * 26, Math.sin(a) * 26, 3, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Star invincibility rainbow aura
    if (starInvincibleTimer > 0) {
      const hue = (Date.now() * 0.3) % 360;
      ctx.shadowColor = `hsl(${hue},100%,65%)`; ctx.shadowBlur = 30;
      ctx.strokeStyle = `hsla(${hue},100%,65%,0.8)`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.stroke();
    }

    ctx.restore();

    // Reverse gun tier 10 flame effect
    drawReverseFlame(ctx, p, reverseTier, Date.now());
  }

  function drawEnemy(ctx, e) {
    const drawSpriteTintFlash = (image, dx, dy, dw, dh, tintAlpha, tintColor = '#ff2d2d', srcRect = null) => {
      if (!image || !Number.isFinite(dw) || !Number.isFinite(dh) || dw <= 0 || dh <= 0 || tintAlpha <= 0) return;
      if (!drawEnemy._flashCanvas) {
        drawEnemy._flashCanvas = document.createElement('canvas');
      }
      const flashCanvas = drawEnemy._flashCanvas;
      const fw = Math.max(1, Math.round(dw));
      const fh = Math.max(1, Math.round(dh));
      if (flashCanvas.width !== fw || flashCanvas.height !== fh) {
        flashCanvas.width = fw;
        flashCanvas.height = fh;
      }

      const fctx = flashCanvas.getContext('2d');
      if (!fctx) return;
      fctx.clearRect(0, 0, fw, fh);

      if (srcRect) {
        fctx.drawImage(image, srcRect.sx, srcRect.sy, srcRect.sw, srcRect.sh, 0, 0, fw, fh);
      } else {
        fctx.drawImage(image, 0, 0, fw, fh);
      }

      fctx.globalCompositeOperation = 'source-atop';
      fctx.fillStyle = tintColor;
      fctx.globalAlpha = Math.max(0, Math.min(1, tintAlpha));
      fctx.fillRect(0, 0, fw, fh);
      fctx.globalAlpha = 1;
      fctx.globalCompositeOperation = 'source-over';

      ctx.save();
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
      ctx.drawImage(flashCanvas, dx, dy, dw, dh);
      ctx.restore();
    };

    ctx.save();
    ctx.translate(e.x, e.y);

    if (e.type === 'boss') {
      const bt = e.tier || 1;
      // Tier color palette
      const tierIdx = Math.min(bt - 1, 3);
      const tierColor = e._variantHudColor || ['#ff0066','#ff6600','#aa00ff','#00ccff'][tierIdx];
      const tierFill = ['rgba(255,0,102,0.12)','rgba(255,100,0,0.12)','rgba(170,0,255,0.12)','rgba(0,200,255,0.12)'][tierIdx];
      const tierEmoji = ['☠','👁','💀','⬡'][tierIdx];

      ctx.shadowColor = tierColor; ctx.shadowBlur = 30 + bt * 4;
      
      // Try to load boss sprite
      let bossSpriteKey = getBossSpriteKey(e.wave || 1);
      const isDreadnought = (e.wave || 0) === 10;
      if ((e.wave || 0) === 15) {
        const eyeState = e._eyeState || 'normal';
        bossSpriteKey = eyeState === 'resting' ? 'BeholderResting' : eyeState === 'blink' ? 'BeholderBlink' : 'BeholderBoss';
      }
      const bossSprite = getSprite(bossSpriteKey);
      const dreadSheet = isDreadnought ? getSprite('DreadnoughtSpritesheet-table') : null;
      if (bossSprite && isSpritesLoaded()) {
        // Draw sprite with shadow (large size for boss)
        const spriteSize = isDreadnought ? 430 : 360;
        const spriteHalf = spriteSize / 2;
        const shouldShake = (e.wave || 0) === 15 && (e._laserCharging || false);
        const shakePower = shouldShake ? (e._mainBeamShake || 0) : 0;
        const jitterX = shouldShake ? (Math.random() * 2 - 1) * shakePower : 0;
        const jitterY = shouldShake ? (Math.random() * 2 - 1) * shakePower : 0;
        if (isDreadnought && dreadSheet && (e._hangarSheetPlaying || false)) {
          const cols = 6;
          const rows = 6;
          const frameW = Math.max(1, Math.floor(dreadSheet.width / cols));
          const frameH = Math.max(1, Math.floor(dreadSheet.height / rows));
          const totalFrames = Math.max(1, cols * rows);
          const duration = Math.max(1, e._hangarAnimDuration || 360);
          const progress = 1 - Math.max(0, (e._hangarAnimTimer || 0) / duration);
          const frameIdx = Math.min(totalFrames - 1, Math.max(0, Math.floor(progress * totalFrames)));
          const sx = (frameIdx % cols) * frameW;
          const sy = Math.floor(frameIdx / cols) * frameH;

          // Inset sample bounds to prevent neighboring-frame seam lines.
          const sampleInset = 3;
          ctx.drawImage(
            dreadSheet,
            sx + sampleInset,
            sy + sampleInset,
            Math.max(1, frameW - sampleInset * 2),
            Math.max(1, frameH - sampleInset * 2),
            -spriteHalf + jitterX,
            -spriteHalf + jitterY,
            spriteSize,
            spriteSize
          );

          if (e._enraged) {
            const pulse = 0.28 + Math.sin(Date.now() * 0.02) * 0.2;
            drawSpriteTintFlash(
              dreadSheet,
              -spriteHalf + jitterX,
              -spriteHalf + jitterY,
              spriteSize,
              spriteSize,
              pulse,
              '#ff2d2d',
              {
                sx: sx + sampleInset,
                sy: sy + sampleInset,
                sw: Math.max(1, frameW - sampleInset * 2),
                sh: Math.max(1, frameH - sampleInset * 2),
              }
            );
          }
        } else {
          drawSprite(ctx, bossSprite, -spriteHalf + jitterX, -spriteHalf + jitterY, spriteSize, spriteSize);

          if (e._variantTintColor) {
            drawSpriteTintFlash(
              bossSprite,
              -spriteHalf + jitterX,
              -spriteHalf + jitterY,
              spriteSize,
              spriteSize,
              0.28,
              e._variantTintColor
            );
          }

          if (e._enraged) {
            const pulse = 0.28 + Math.sin(Date.now() * 0.02) * 0.2;
            drawSpriteTintFlash(
              bossSprite,
              -spriteHalf + jitterX,
              -spriteHalf + jitterY,
              spriteSize,
              spriteSize,
              pulse,
              '#ff2d2d'
            );
          }
        }
      } else {
        // Fallback to shape drawing
        ctx.strokeStyle = tierColor; ctx.lineWidth = 3;
        if (bt === 1) {
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
            const r = i % 2 === 0 ? 40 : 26;
            i === 0 ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          }
          ctx.closePath();
        } else if (bt === 2) {
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
            i === 0 ? ctx.moveTo(Math.cos(a) * 40, Math.sin(a) * 40) : ctx.lineTo(Math.cos(a) * 40, Math.sin(a) * 40);
          }
          ctx.closePath();
        } else if (bt === 3) {
          ctx.beginPath(); ctx.arc(0, 0, 42, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2);
          ctx.closePath();
        } else {
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2 - Math.PI / 8;
            const r = i % 2 === 0 ? 42 : 30;
            i === 0 ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          }
          ctx.closePath();
        }
        ctx.stroke();
        ctx.fillStyle = tierFill; ctx.fill();

        ctx.fillStyle = tierColor;
        ctx.font = `bold 15px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(tierEmoji, 0, -6);
      }
      
      if (e._enraged && (!bossSprite || !isSpritesLoaded())) {
        const pulse = 0.3 + Math.sin(Date.now() * 0.02) * 0.14;
        ctx.save();
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = `rgba(255,45,45,${pulse})`;
        ctx.beginPath();
        if (isDreadnought) {
          ctx.ellipse(0, 0, 108, 72, 0, 0, Math.PI * 2);
        } else {
          ctx.ellipse(0, 0, 72, 62, 0, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.restore();
      }

      if ((e.wave || 0) === 20 && e._armorBlocks && e._armorBlocks.length > 0) {
        const now = Date.now();
        e._armorBlocks.forEach(piece => {
          const off = getPirateShieldPieceOffset(e, piece, now);
          const sz = BLOCK_SIZE;
          ctx.save();
          ctx.shadowColor = piece.color || '#66ddff';
          ctx.shadowBlur = piece.invulnerable ? 14 : 10;
          ctx.fillStyle = (piece.color || '#66ddff') + 'cc';
          ctx.fillRect(off.x - sz / 2, off.y - sz / 2, sz, sz);
          ctx.strokeStyle = piece.invulnerable ? '#d8e6ff' : '#ffffff66';
          ctx.lineWidth = piece.invulnerable ? 2 : 1;
          ctx.strokeRect(off.x - sz / 2, off.y - sz / 2, sz, sz);
          ctx.restore();
        });
      }
    } else if (e.type === 'dropper') {
      const c = e.color || '#ffd700';
      ctx.shadowColor = c; ctx.shadowBlur = 18;
      
      // Try to load dropper sprite
      const dropperSprite = getSprite('Dropper');
      if (dropperSprite && isSpritesLoaded()) {
        drawSprite(ctx, dropperSprite, -45, -45, 90, 90);
      } else {
        // Fallback to spiky star
        ctx.strokeStyle = c; ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 16; i++) {
          const a = (i/16)*Math.PI*2-Math.PI/2, r = i%2===0?20:10;
          i===0?ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r):ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);
        }
        ctx.closePath(); ctx.fillStyle=c+'22'; ctx.fill(); ctx.stroke();
        ctx.fillStyle=c; ctx.font='bold 11px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(DROPPER_LABELS[e.dropType]||'★',0,1);
      }
    } else if (e.type === 'mine') {
      const damaged = e.hp < e.maxHp;
      const isCharging = e._charging;
      const pulse = 0.7 + Math.sin(Date.now() * (damaged ? 0.022 : 0.008)) * 0.3;
      const mineColor = isCharging ? '#ffffff' : damaged ? `rgba(255,${Math.floor(80 + pulse * 80)},0,1)` : '#ff8800';
      ctx.shadowColor = mineColor;
      ctx.shadowBlur = isCharging ? 0 : 16 + pulse * 10;

      // Try to load mine sprite
      const mineSprite = getSprite('Mine');
      if (mineSprite && isSpritesLoaded()) {
        drawSprite(ctx, mineSprite, -42, -42, 84, 84);
        if (isCharging) {
          const chargeFlash = 0.28 + pulse * 0.24;
          drawSpriteTintFlash(mineSprite, -42, -42, 84, 84, chargeFlash, '#ffffff');
        } else if (damaged) {
          const damageFlash = 0.14 + pulse * 0.14;
          drawSpriteTintFlash(mineSprite, -42, -42, 84, 84, damageFlash, '#ff5a00');
        }
      } else {
        // Fallback to spiky star polygon
        const SPIKES = 8;
        const innerR = 12;
        const outerR = damaged ? 20 + pulse * 3 : 18;
        ctx.fillStyle = isCharging ? 'rgba(255,255,200,0.95)' : damaged ? `rgba(255,${Math.floor(60 + pulse * 60)},0,0.9)` : 'rgba(255,120,0,0.9)';
        ctx.beginPath();
        for (let i = 0; i < SPIKES * 2; i++) {
          const angle = (i / (SPIKES * 2)) * Math.PI * 2 - Math.PI / 2;
          const r = i % 2 === 0 ? outerR : innerR;
          i === 0 ? ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r)
                  : ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
        }
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = mineColor; ctx.lineWidth = 1.5;
        ctx.stroke();

        // Fuse on top (skip when charging)
        if (!isCharging) {
          ctx.strokeStyle = '#ffdd00'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(2, -18); ctx.quadraticCurveTo(10, -28, 6, -34); ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(6, -34, 2.5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#ffff00';
          ctx.beginPath(); ctx.arc(6, -34, 1.5, 0, Math.PI * 2); ctx.fill();
        }

        // HP pips
        for (let hi = 0; hi < e.hp; hi++) {
          const a = (hi / 3) * Math.PI * 2 - Math.PI / 2;
          ctx.fillStyle = isCharging ? '#ff2200' : '#ff8800';
          ctx.beginPath(); ctx.arc(Math.cos(a) * 8, Math.sin(a) * 8, 3, 0, Math.PI * 2); ctx.fill();
        }

        // Face / charge indicator
        ctx.fillStyle = isCharging ? '#ff2200' : damaged ? '#fff' : '#330000';
        ctx.font = `bold ${isCharging ? 13 : damaged ? 13 : 11}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(isCharging ? '!!!' : damaged ? '>_<' : '^_^', 0, 1);
      }
    } else if (e.type === 'superEater') {
      // Super Eater boss rendering
      const t = Date.now();
      const superEaterSprite = getSprite('SuperEater');
      const useSpriteRender = isSpritesLoaded() && hasDrawableSprite(superEaterSprite);
      ctx.save();
      ctx.shadowColor = '#ff00ff';
      ctx.shadowBlur = 48;
      ctx.globalAlpha = 0.97 + Math.sin(t * 0.004) * 0.03;
      ctx.scale(1.35, 1.35);
      if (useSpriteRender) {
        drawSprite(ctx, superEaterSprite, -135, -135, 270, 270);
      } else {
        // Fallback: magenta circle
        ctx.fillStyle = '#ff00ff';
        ctx.beginPath();
        ctx.arc(0, 0, 120, 0, Math.PI * 2);
        ctx.fill();
      }
      // Boss health bar
      const bw = 180, bh = 16;
      ctx.restore();
      ctx.save();
      ctx.translate(0, -160);
      ctx.fillStyle = '#222'; ctx.fillRect(-bw / 2, 0, bw, bh);
      ctx.fillStyle = e.hp / e.maxHp > 0.5 ? '#ff00ff' : e.hp / e.maxHp > 0.25 ? '#ffaa00' : '#ff2200';
      ctx.fillRect(-bw / 2, 0, bw * (e.hp / e.maxHp), bh);
      ctx.strokeStyle = '#ff00ff'; ctx.lineWidth = 2; ctx.strokeRect(-bw / 2, 0, bw, bh);
      ctx.restore();
    } else if (e.type === 'eater') {
      const t = Date.now();
      const stage = e._growthStage === undefined ? (e._mini ? 0 : 1) : e._growthStage;
      const isMini = e._mini;
      const isBreeder = stage >= 2;
      const isEatingVisual = e._eating || (e._eatAnimTimer || 0) > 0;
      const baseScale = stage === 0 ? 0.54 : stage === 1 ? 0.84 : 1.12;
      const eaterColor = isBreeder
        ? '#d3ff8a'
        : isEatingVisual
          ? '#00ff44'
          : stage === 0
            ? '#78ffb0'
            : '#33cc77';

      const eaterSprite = getSprite('Eater');
      const eaterChompSprite = getSprite('EaterChomp');
  const useSpriteRender = isSpritesLoaded() && hasDrawableSprite(eaterSprite);

      if (useSpriteRender) {
        const bob = Math.sin(t * 0.005 + (e._animPhase || 0)) * (stage === 0 ? 1.2 : 2.5);
        const wobble = 1 + Math.sin(t * 0.006 + (e._animPhase || 0)) * 0.03;
        if (e._chewAnimOffset === undefined) e._chewAnimOffset = Math.random() * Math.PI * 2;
        const isChewingTarget = e._eating && (e._targetBlock || Number.isInteger(e._targetCellIdx));
        const chewLoop = 0.22 + (0.78 * (0.5 + Math.sin(t * 0.05 + e._chewAnimOffset) * 0.5));
        const targetChomp = isChewingTarget ? chewLoop : (isEatingVisual ? 0.88 : 0);
        e._chompBlend = (e._chompBlend || 0) + (targetChomp - (e._chompBlend || 0)) * 0.15;
        const pulse = 0.55 + Math.sin(t * 0.02) * 0.45;
        const chompAlpha = eaterChompSprite ? Math.max(0, Math.min(1, e._chompBlend * (0.35 + pulse * 0.65))) : 0;

        ctx.translate(0, bob);
        ctx.scale(baseScale * wobble, baseScale * wobble);
        ctx.shadowColor = eaterColor;
        ctx.shadowBlur = isBreeder ? 34 : 20;

        drawSprite(ctx, eaterSprite, -135, -135, 270, 270);
        if (eaterChompSprite && chompAlpha > 0.02) {
          ctx.save();
          ctx.globalAlpha = chompAlpha;
          drawSprite(ctx, eaterChompSprite, -135, -135, 270, 270);
          ctx.restore();
        }
        // Draw enemy name above health bar
        ctx.save();
        ctx.translate(0, -110);
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = eaterColor;
        let name = e.name || (isMini ? 'Mini Eater' : stage >= 2 ? 'Eater' : 'Eater');
        ctx.fillText(name, 0, 0);
        ctx.restore();
      } else {
        const pulse = 0.7 + Math.sin(t * 0.012) * 0.3;
        ctx.scale(baseScale, baseScale);
        ctx.shadowColor = eaterColor;
        ctx.shadowBlur = (isBreeder ? 35 : 20) + pulse * 12;
        ctx.fillStyle = isBreeder ? 'rgba(211,255,138,0.26)' : 'rgba(51,204,119,0.24)';
        ctx.strokeStyle = eaterColor;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 24 + pulse * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        if (isMini) {
          // Mini eaters use a crisp fallback look so they remain visible even when sprite loading fails.
          const jawPulse = 0.6 + Math.sin(t * 0.03) * 0.4;
          ctx.strokeStyle = '#d9ffd6';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-8, -2);
          ctx.lineTo(0, 7 + jawPulse * 2);
          ctx.lineTo(8, -2);
          ctx.stroke();
          ctx.fillStyle = '#d9ffd6';
          ctx.beginPath();
          ctx.arc(-5, -5, 1.8, 0, Math.PI * 2);
          ctx.arc(5, -5, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (!isMini) {
        const bw = 60, bh = 5;
        ctx.fillStyle = '#222'; ctx.fillRect(-bw / 2, -44, bw, bh);
        ctx.fillStyle = e.hp / e.maxHp > 0.5 ? '#33cc77' : e.hp / e.maxHp > 0.25 ? '#ffaa00' : '#ff2200';
        ctx.fillRect(-bw / 2, -44, bw * (e.hp / e.maxHp), bh);
        ctx.strokeStyle = eaterColor; ctx.lineWidth = 1; ctx.strokeRect(-bw / 2, -44, bw, bh);
      }
     } else if (e.type === 'glutton') {
       const t = Date.now();
       drawGlutton(ctx, e, t);
     } else if (e.type === 'elite') {
       ctx.shadowColor = '#ff44ff'; ctx.shadowBlur = 14;
       
       // Try to load elite sprite
       const eliteSprite = getSprite('EliteEnemy');
       if (eliteSprite && isSpritesLoaded()) {
         drawSprite(ctx, eliteSprite, -52.5, -52.5, 105, 105);
       } else {
         // Fallback: magenta triangle
         ctx.strokeStyle = '#ff44ff'; ctx.lineWidth = 2;
         ctx.beginPath();
         ctx.moveTo(0, -11); ctx.lineTo(11, 11); ctx.lineTo(-11, 11); ctx.closePath();
         ctx.stroke();
         ctx.fillStyle = 'rgba(255,68,255,0.1)'; ctx.fill();
       }
     } else {
      ctx.shadowColor = '#ff4444'; ctx.shadowBlur = 10;
      
      // Try to load basic enemy sprite
      const basicSprite = getSprite('BasicEnemy');
      if (basicSprite && isSpritesLoaded()) {
        drawSprite(ctx, basicSprite, -45, -45, 90, 90);
      } else {
        // Fallback: red triangle
        ctx.strokeStyle = '#ff4444'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, 9); ctx.lineTo(9, -9); ctx.lineTo(-9, -9); ctx.closePath();
        ctx.stroke();
      }
    }

    // Health bars removed for non-boss enemies
    ctx.restore();
  }

  function drawBullet(ctx, b, isEnemy) {
    ctx.save();
    if (b.type === 'spreadPellet') {
      ctx.shadowColor = WEAPON_COLORS.spread; ctx.shadowBlur = 10;
      ctx.fillStyle = WEAPON_COLORS.spread;
      ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
    } else if (b.type === 'wingman') {
      ctx.shadowColor = WEAPON_COLORS.wingman; ctx.shadowBlur = 8;
      ctx.fillStyle = WEAPON_COLORS.wingman;
      ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
    } else if (b.type === 'spread') {
      // Shotgun slug: bright yellow tracer with hot white core.
      ctx.shadowColor = WEAPON_COLORS.spread; ctx.shadowBlur = 14;
      ctx.fillStyle = WEAPON_COLORS.spread;
      ctx.fillRect(b.x - 2.5, b.y - 10, 5, 20);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(b.x - 1, b.y - 9, 2, 18);
      ctx.fillStyle = 'rgba(255,153,0,0.45)';
      ctx.beginPath();
      ctx.moveTo(b.x - 4, b.y + 8);
      ctx.lineTo(b.x + 4, b.y + 8);
      ctx.lineTo(b.x, b.y + 14);
      ctx.closePath();
      ctx.fill();
    } else if (b.type === 'bounce') {
      // Bounce shot: green plasma orb with pulsing halo (or cyan for Fang bounces).
      const pulse = 0.75 + Math.sin(Date.now() * 0.025) * 0.25;
      const isFangBounce = b.fangBounce;
      const baseColor = isFangBounce ? '#44aaff' : WEAPON_COLORS.bounce; // Cyan for Fang, green for normal
      const rgbaColor = isFangBounce ? `rgba(68,170,255,${0.22 + pulse * 0.25})` : `rgba(170,255,0,${0.22 + pulse * 0.25})`;
      ctx.shadowColor = baseColor; ctx.shadowBlur = 16;
      ctx.fillStyle = rgbaColor;
      ctx.beginPath(); ctx.arc(b.x, b.y, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = baseColor;
      ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(b.x - 1.2, b.y - 1.2, 2, 0, Math.PI * 2); ctx.fill();
    } else if (b.type === 'laser') {
      const w = 3 + (b.fat || 1) * 2;
      ctx.shadowColor = WEAPON_COLORS.laser; ctx.shadowBlur = 14 + (b.fat || 1) * 4;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(b.x - w * 0.3, b.y - 12, w * 0.6, 22);
      ctx.fillStyle = WEAPON_COLORS.laser;
      ctx.fillRect(b.x - w, b.y - 12, w * 2, 22);
    } else if (b.type === 'missile') {
      // Missile: magenta rocket body with rear flame.
      const travelA = Math.atan2(b.vy || -1, b.vx || 0) + Math.PI / 2;
      ctx.translate(b.x, b.y);
      ctx.rotate(travelA);
      ctx.shadowColor = WEAPON_COLORS.missile; ctx.shadowBlur = 12;
      ctx.fillStyle = WEAPON_COLORS.missile;
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(5, 2);
      ctx.lineTo(3, 10);
      ctx.lineTo(-3, 10);
      ctx.lineTo(-5, 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-1, -6, 2, 6);
      ctx.fillStyle = '#ff8800';
      ctx.beginPath();
      ctx.moveTo(-2.5, 10);
      ctx.lineTo(2.5, 10);
      ctx.lineTo(0, 16);
      ctx.closePath();
      ctx.fill();
    } else if (b.type === 'photon') {
      // Photon: energetic orb with orbiting charge particles.
      const sz = b.size || 10;
      const isSuperOrbit = b.isSuperOrbit;
      const hue = isSuperOrbit ? (Date.now() * 0.4) % 360 : 150;
      const orbColor = isSuperOrbit ? `hsl(${hue},100%,65%)` : WEAPON_COLORS.photon;
      const orbColorA = isSuperOrbit ? `hsla(${hue},100%,65%,0.3)` : 'rgba(68,255,170,0.25)';

      ctx.shadowColor = orbColor; ctx.shadowBlur = sz * 2;
      ctx.fillStyle = orbColorA;
      ctx.beginPath(); ctx.arc(b.x, b.y, sz + 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = orbColor;
      ctx.beginPath(); ctx.arc(b.x, b.y, sz, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(b.x, b.y, sz * 0.4, 0, Math.PI * 2); ctx.fill();

      if (isSuperOrbit) {
        const ORBIT_COUNT = 6;
        const ORBIT_R = sz + 10;
        for (let oi = 0; oi < ORBIT_COUNT; oi++) {
          const oa = (b.orbitPhase || 0) + (oi / ORBIT_COUNT) * Math.PI * 2;
          const hue2 = ((hue + oi * 60) % 360);
          const c2 = `hsl(${hue2},100%,70%)`;
          const ox = b.x + Math.cos(oa) * ORBIT_R;
          const oy = b.y + Math.sin(oa) * ORBIT_R;
          ctx.shadowColor = c2; ctx.shadowBlur = 10;
          ctx.fillStyle = c2;
          ctx.beginPath(); ctx.arc(ox, oy, 4, 0, Math.PI * 2); ctx.fill();
        }
      } else {
        for (let oi = 0; oi < 2; oi++) {
          const oa = (b.orbitAngle || 0) + (oi / 2) * Math.PI * 2;
          const ox = b.x + Math.cos(oa) * (sz + 8);
          const oy = b.y + Math.sin(oa) * (sz + 8);
          ctx.shadowColor = orbColor; ctx.shadowBlur = 8;
          ctx.fillStyle = orbColor;
          ctx.beginPath(); ctx.arc(ox, oy, 3, 0, Math.PI * 2); ctx.fill();
        }
      }
    } else if (b.type === 'reverse') {
      // Reverse shot: purple bolt matching HUD color.
      ctx.shadowColor = WEAPON_COLORS.reverse; ctx.shadowBlur = 12;
      ctx.fillStyle = WEAPON_COLORS.reverse;
      ctx.fillRect(b.x - 2, b.y - 8, 4, 16);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(b.x - 0.8, b.y - 6, 1.6, 12);
      ctx.fillStyle = 'rgba(204,68,255,0.35)';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (isEnemy) {
      const isBoss = b.boss;
      const r = b.big ? 12 : isBoss ? 6 : 4;
      const enemyColor = b.dreadMissile ? (b.dreadMissileColor || '#66ff66') : isBoss ? '#ff0066' : '#ff6600';
      ctx.shadowColor = enemyColor; ctx.shadowBlur = b.big ? 24 : isBoss ? 14 : 8;
      ctx.fillStyle = b.big ? '#ff44aa' : enemyColor;
      ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.fill();
      if (b.big) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI * 2); ctx.fill(); }
    } else {
      ctx.shadowColor = WEAPON_COLORS.normal; ctx.shadowBlur = 8;
      ctx.fillStyle = WEAPON_COLORS.normal;
      ctx.fillRect(b.x - 1.5, b.y - 7, 3, 14);
    }
    ctx.restore();
  }

  function drawPowerupItem(ctx, item) {
    const type = normalizePowerupType(item.type);
    const colors = { spread: WEAPON_COLORS.spread, laser: WEAPON_COLORS.laser, photon: WEAPON_COLORS.photon, wingman: WEAPON_COLORS.wingman, shield: '#00ccff', bounce: WEAPON_COLORS.bounce, speed: '#ff8800', rapidfire: '#ff4488', reverse: WEAPON_COLORS.reverse, star: '#ffffff', missile: WEAPON_COLORS.missile };
    const labels = { spread: 'S', laser: 'L', photon: 'P', wingman: 'W', shield: '🛡', bounce: 'B', speed: '▶', rapidfire: '⚡', reverse: '↩', star: '★', missile: '→' };
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(item.angle || 0);

    if (type === 'missile') {
      const missileSprite = getSprite('Missile Powerup');
      if (missileSprite && isSpritesLoaded()) {
        drawSprite(ctx, missileSprite, -16, -16, 32, 32);
      } else {
        const c = '#ff00ff';
        ctx.shadowColor = c; ctx.shadowBlur = 16;
        ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2);
        ctx.fillStyle = c + '33'; ctx.fill();
        ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = c;
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('→', 0, 0);
      }
    } else if (type === 'star') {
      // Rainbow rotating star
      const hue = (Date.now() * 0.2) % 360;
      const c1 = `hsl(${hue},100%,70%)`;
      ctx.shadowColor = c1; ctx.shadowBlur = 22;
      ctx.strokeStyle = c1; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = c1 + '33'; ctx.fill();
      ctx.fillStyle = c1;
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('★', 0, 1);
    } else {
      const c = colors[type] || '#fff';
      ctx.shadowColor = c; ctx.shadowBlur = 16;
          // Draw enemy name above health bar
          ctx.save();
          ctx.translate(0, -38);
          ctx.font = 'bold 13px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillStyle = '#d9ffd6';
          ctx.fillText('Mini Eater', 0, 0);
          ctx.restore();
      // Plain glowing circle — no spikes (distinct from the spiky dropper enemy)
      ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fillStyle = c + '33'; ctx.fill();
      ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.stroke();
      // Inner bright ring
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.strokeStyle = c + '88'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = c;
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(labels[type], 0, 0);
    }
    ctx.restore();
  }

  function drawParticle(ctx, pt) {
    ctx.save();
    ctx.globalAlpha = pt.alpha;
    if (pt.shockwave) {
      ctx.shadowColor = pt.color; ctx.shadowBlur = 12;
      ctx.strokeStyle = pt.color;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.shockwaveR, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.shadowColor = pt.color; ctx.shadowBlur = 6;
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2); ctx.fill();
    }
          // Draw enemy name above health bar
          ctx.save();
          ctx.translate(0, -38);
          ctx.font = 'bold 13px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillStyle = '#d9ffd6';
          ctx.fillText('Mini Eater', 0, 0);
          ctx.restore();
    ctx.restore();
  }

  function spawnExplosion(s, x, y, color = '#ff4444', count = 10) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = randomBetween(0.5, 3);
      s.particles.push({ x, y, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd, r: randomBetween(1, 3.5), alpha: 1, color });
    }
  }

  function spawnFloatingPowerup(s, x, y, type, motion = {}) {
    const launchAngle = motion.launchAngle ?? randomBetween(0, Math.PI * 2);
    const launchSpeed = motion.launchSpeed ?? randomBetween(0.7, 1.5);
    s.powerupItems.push({
      x,
      y,
      type,
      angle: motion.angle ?? 0,
      vx: motion.vx ?? Math.cos(launchAngle) * launchSpeed,
      vy: motion.vy ?? Math.sin(launchAngle) * launchSpeed,
      spin: motion.spin ?? randomBetween(-0.03, 0.03),
      floatT: motion.floatT ?? randomBetween(0, Math.PI * 2),
      floatSpeed: motion.floatSpeed ?? randomBetween(0.045, 0.085),
      floatAmpX: motion.floatAmpX ?? randomBetween(0.08, 0.22),
      floatAmpY: motion.floatAmpY ?? randomBetween(0.08, 0.22),
    });
  }

  function takeDamage(s) {
    // Invincibility frames — ignore ALL damage (including shield/armor) while active
    if (s.invincibleTimer > 0 || s.starInvincibleTimer > 0) return;
    if (s.shieldHp > 0) {
      s.shieldHp--;
      sounds.shieldHit();
      if (s.shieldHp === 0) { sounds.shieldBreak(); delete s.powerups.shield; }
      onPowerupChangeRef.current?.({ ...s.powerups, shieldHp: s.shieldHp, armorHp: s.armorHp, starInvincible: s.starInvincibleTimer > 0 });
      s.invincibleTimer = 60; // brief invincibility after shield hit
      return;
    }
    if ((s.armorHp || 0) > 0) {
      s.armorHp = Math.max(0, (s.armorHp || 0) - 1);
      sounds.shieldHit();
      onPowerupChangeRef.current?.({ ...s.powerups, shieldHp: s.shieldHp, armorHp: s.armorHp, starInvincible: s.starInvincibleTimer > 0 });
      s.invincibleTimer = 60;
      return;
    }
    s.lives--;
    s.invincibleTimer = 120; // 2 seconds at 60fps
    onLivesChange(s.lives);
    sounds.playerHit();
    if (s.lives <= 0) { sounds.stopAllMusic(); s.running = false; setGameState('continue'); }
  }

  function grantBossLifeReward(s) {
    s.maxLives += 1;
    s.lives = s.maxLives;
    onLivesChange(s.lives);
    onMaxLivesChange(s.maxLives);
  }

  // ── Main loop ────────────────────────────────────────────────
  const loop = useCallback((timestamp, scheduleNext = true, ignoreThrottle = false, chainedStepsRemaining = 0) => {
    // Super Eater trigger check (before enemy update)
    tryTriggerSuperEater(stateRef.current);
    // Super Eater eats other eaters for health gain
    for (const enemy of stateRef.current.enemies) {
      if (enemy && enemy.type === 'superEater') {
        for (let j = stateRef.current.enemies.length - 1; j >= 0; j--) {
          const e = stateRef.current.enemies[j];
          if (e && e !== enemy && e.type === 'eater' && !e.dead) {
            const dist = Math.hypot(enemy.x - e.x, enemy.y - e.y);
            if (dist < 120) {
              enemy.hp = Math.min(enemy.hp + (e.hp || 0), enemy.maxHp);
              stateRef.current.enemies.splice(j, 1);
            }
          }
        }
        // Super Eater regenerates on eating a block
        for (let k = stateRef.current.blocks.length - 1; k >= 0; k--) {
          const block = stateRef.current.blocks[k];
          if (!block.dead) {
            const blockCells = getBlockCells(block);
            for (let cell of blockCells) {
              const dist = Math.hypot(enemy.x - (cell.x + 9), enemy.y - (cell.y + 9));
              if (dist < 60) {
                enemy.hp = Math.min(enemy.hp + Math.max(2, Math.round(block.maxHp * 0.5)), enemy.maxHp);
                block.dead = true;
                break;
              }
            }
          }
        }
        // Super Eater fires every shot type (not rapid fire)
        if (!enemy._fireTimer) enemy._fireTimer = 0;
        enemy._fireTimer++;
        if (enemy._fireTimer > 90) { // fire every 1.5s
          const px = stateRef.current.player?.x || enemy.x;
          const py = stateRef.current.player?.y || enemy.y;
          const angleToPlayer = Math.atan2(py - enemy.y, px - enemy.x);
          const fireTypes = [
            { type: 'spreadPellet', color: '#ff9900', speed: 6.5 },
            { type: 'laser', color: '#ff2200', speed: 8 },
            { type: 'photon', color: '#44ffaa', speed: 7 },
            { type: 'bounce', color: '#aaff00', speed: 6 },
            { type: 'missile', color: '#ff00ff', speed: 5 },
            { type: 'reverse', color: '#ffffff', speed: 7 },
          ];
          for (let i = 0; i < fireTypes.length; i++) {
            const t = fireTypes[i];
            stateRef.current.enemyBullets.push({
              type: t.type,
              x: enemy.x,
              y: enemy.y,
              vx: Math.cos(angleToPlayer + i * 0.18 - 0.45) * t.speed,
              vy: Math.sin(angleToPlayer + i * 0.18 - 0.45) * t.speed,
              color: t.color,
              fromSuperEater: true,
            });
          }
          enemy._fireTimer = 0;
        }
      }
    }
    const fpsTracker = fpsTrackerRef.current;
    if (scheduleNext) {
      if (!fpsTracker.lastTs) fpsTracker.lastTs = timestamp;
      fpsTracker.frameCount += 1;
      const fpsElapsed = timestamp - fpsTracker.lastTs;
      if (fpsElapsed >= 500) {
        const fps = Math.max(1, Math.round((fpsTracker.frameCount * 1000) / fpsElapsed));
        onFpsChangeRef.current?.(fps);
        fpsTracker.lastReported = fps;
        fpsTracker.lastTs = timestamp;
        fpsTracker.frameCount = 0;
      }
    }

    if (!stateRef.current.running || isPausedRef.current) {
      if (scheduleNext) animRef.current = requestAnimationFrame(loop);
      return;
    }
    // Frame-rate throttle based on gameSpeed setting.
    // Boss mode uses a higher floor to avoid slow-motion feel during heavy fights.
    const effectiveFps = bossModeRef.current
      ? Math.max(60, gameSpeedRef.current || 30)
      : (gameSpeedRef.current || 30);
    const targetInterval = 1000 / effectiveFps;
    if (!ignoreThrottle && timestamp - lastTimeRef.current < targetInterval) {
      if (scheduleNext) animRef.current = requestAnimationFrame(loop);
      return;
    }
    if (!ignoreThrottle) lastTimeRef.current = timestamp;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const s = stateRef.current;
    const keys = keysRef.current;

    // Boss-mode testing: allow external skip signal to remove current boss.
    if (s._lastSkipBossSignal === undefined) s._lastSkipBossSignal = skipBossSignalRef.current;
    if (skipBossSignalRef.current !== s._lastSkipBossSignal) {
      s._lastSkipBossSignal = skipBossSignalRef.current;
      const currentBoss = s.enemies.find(e => e.type === 'boss' && !e.dead);
      if (currentBoss) {
        currentBoss.dead = true;
        spawnExplosion(s, currentBoss.x, currentBoss.y, '#66ff66', 36);
        sounds.stopBossMusic();
        sounds.waveComplete();
      }
    }

    // Keep boss music alive during active boss fights.
    const bossAliveNow = s.enemies.some(e => e.type === 'boss' && !e.dead);
    if (bossAliveNow) {
      s._bossMusicHealthcheck = (s._bossMusicHealthcheck || 0) - 1;
      if (s._bossMusicHealthcheck <= 0) {
        sounds.ensureBossMusic?.();
        s._bossMusicHealthcheck = 180;
      }
    } else {
      s._bossMusicHealthcheck = 0;
    }

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

    const p = s.player;
    const isEnemyVisibleForTargeting = (enemy) => {
      const halfW = Math.max(10, enemy?.w || 18);
      const halfH = Math.max(10, enemy?.h || 18);
      return enemy.x + halfW >= 0
        && enemy.x - halfW <= W
        && enemy.y + halfH >= 0
        && enemy.y - halfH <= H;
    };

    const speedTier = s.powerups.speed || 0;
    const spd = 4.5 + speedTier * 1.5;
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) p.x = Math.max(16, p.x - spd);
    if (keys['ArrowRight'] || keys['d'] || keys['D']) p.x = Math.min(W - 16, p.x + spd);
    if (keys['ArrowUp'] || keys['w'] || keys['W']) p.y = Math.max(16, p.y - spd);
    if (keys['ArrowDown'] || keys['s'] || keys['S']) p.y = Math.min(H - 16, p.y + spd);
    if (aimModeRef.current) {
      const desiredPlayerAim = getAimTransform(p.x, p.y, s.enemies, true).rotation;
      p._aimRotation = rotateAngleTowards(Number.isFinite(p._aimRotation) ? p._aimRotation : 0, desiredPlayerAim, 0.075);
    } else {
      p._aimRotation = 0;
    }

    // Wingmen follow:
    // tier 1-4: basic wingmen only (1-4)
    // tier 5: 1 super wingman, no basics
    // tier 6-9: 1 super wingman + 1-4 basic wingmen
    // tier 10: 2 super wingmen, no basics
    const wingmanTier = s.powerups.wingman || 0;
    const superWingmanCount = wingmanTier >= 10 ? 2 : wingmanTier >= 5 ? 1 : 0;
    const basicWingmanCount = wingmanTier >= 10 ? 0 : wingmanTier >= 5 ? (wingmanTier - 5) : wingmanTier;
    if (wingmanTier > 0) {
      const allOffsets = [
        { x: -40, y: 10 }, { x: 40, y: 10 }, { x: 0, y: 25 }, { x: -65, y: 20 },
      ];
      // Basic wingmen (only when no super wingman)
      const basicOffsets = allOffsets.slice(0, basicWingmanCount);
      const basicTargets = basicOffsets.map(o => ({ x: p.x + o.x, y: p.y + o.y }));
      while (s.wingmen.length < basicTargets.length) s.wingmen.push({ ...basicTargets[s.wingmen.length] });
      while (s.wingmen.length > basicTargets.length) s.wingmen.pop();
      s.wingmen.forEach((w, i) => {
        w.x += (basicTargets[i].x - w.x) * 0.1;
        w.y += (basicTargets[i].y - w.y) * 0.1;
      });
      // Super wingmen: autonomous escorts that hunt enemies instead of mirroring player movement.
      if (!s.superWingmen) s.superWingmen = [];
      while (s.superWingmen.length < superWingmanCount) {
        const side = s.superWingmen.length % 2 === 0 ? -1 : 1;
        s.superWingmen.push({
          x: p.x + side * 90,
          y: p.y - 30,
          vx: 0,
          vy: 0,
          patrolPhase: Math.random() * Math.PI * 2,
          autonomySeed: Math.random() * Math.PI * 2,
          targetRef: null,
          retargetTimer: 0,
          aimTarget: null,
        });
      }
      while (s.superWingmen.length > superWingmanCount) s.superWingmen.pop();
      s._swPatrolTime = (s._swPatrolTime || 0) + 1;
      const liveCombatEnemies = s.enemies.filter(e => !e.dead && e.type !== 'dropper' && isEnemyVisibleForTargeting(e));
      s.superWingmen.forEach((sw, i) => {
        sw.retargetTimer = (sw.retargetTimer || 0) - 1;
        const hasLiveTarget = sw.targetRef
          && !sw.targetRef.dead
          && isEnemyVisibleForTargeting(sw.targetRef)
          && liveCombatEnemies.includes(sw.targetRef);
        if (!hasLiveTarget || sw.retargetTimer <= 0) {
          let bestEnemy = null;
          let bestScore = Infinity;
          liveCombatEnemies.forEach(enemy => {
            const dist = Math.hypot(enemy.x - sw.x, enemy.y - sw.y);
            const playerDist = Math.hypot(enemy.x - p.x, enemy.y - p.y);
            const hpWeight = (enemy.hp || 1) * 3;
            const proximityBias = playerDist * 0.25;
            const score = dist + hpWeight + proximityBias;
            if (score < bestScore) {
              bestScore = score;
              bestEnemy = enemy;
            }
          });
          sw.targetRef = bestEnemy;
          sw.retargetTimer = 16 + Math.floor(Math.random() * 20);
        }

        let targetX = p.x;
        let targetY = p.y - 46;
        if (sw.targetRef) {
          const enemy = sw.targetRef;
          const orbitAngle = s._swPatrolTime * 0.055 + i * Math.PI + (sw.autonomySeed || 0);
          const escortRadius = 62 + i * 14;
          const strafeSway = Math.sin(s._swPatrolTime * 0.11 + (sw.autonomySeed || 0)) * 16;
          const leadX = (enemy.vx || 0) * 14;
          const leadY = (enemy.vy || 0) * 14;
          targetX = enemy.x + leadX + Math.cos(orbitAngle) * escortRadius + strafeSway;
          targetY = Math.max(60, enemy.y + leadY + 42 + Math.sin(orbitAngle * 1.3) * 24);
          sw.aimTarget = enemy;
        } else {
          const patrolAngle = s._swPatrolTime * 0.03 + (sw.patrolPhase || 0);
          targetX = p.x + Math.cos(patrolAngle) * (78 + i * 10);
          targetY = p.y - 44 + Math.sin(patrolAngle * 1.35) * 22;
          sw.aimTarget = null;
        }

        // Keep super wingmen closer to the player while still autonomous.
        const leashRadius = 170 + i * 14;
        const toTargetFromPlayerX = targetX - p.x;
        const toTargetFromPlayerY = targetY - p.y;
        const targetFromPlayerDist = Math.hypot(toTargetFromPlayerX, toTargetFromPlayerY);
        if (targetFromPlayerDist > leashRadius) {
          const scale = leashRadius / (targetFromPlayerDist || 1);
          targetX = p.x + toTargetFromPlayerX * scale;
          targetY = p.y + toTargetFromPlayerY * scale;
        }

        if (aimModeRef.current) {
          const desiredSuperAim = getAimTransform(sw.x, sw.y, liveCombatEnemies, true).rotation;
          sw._aimRotation = rotateAngleTowards(Number.isFinite(sw._aimRotation) ? sw._aimRotation : 0, desiredSuperAim, 0.09);
        } else {
          sw._aimRotation = 0;
        }

        const dx = targetX - sw.x;
        const dy = targetY - sw.y;
        const len = Math.hypot(dx, dy) || 1;
        const accel = 0.22;
        const maxSpeed = 3.0 + Math.min(wingmanTier, 10) * 0.1;
        sw.vx = (sw.vx || 0) + (dx / len) * accel;
        sw.vy = (sw.vy || 0) + (dy / len) * accel;
        const spdNow = Math.hypot(sw.vx, sw.vy) || 1;
        if (spdNow > maxSpeed) {
          sw.vx = (sw.vx / spdNow) * maxSpeed;
          sw.vy = (sw.vy / spdNow) * maxSpeed;
        }
        sw.x += sw.vx;
        sw.y += sw.vy;
        sw.vx *= 0.93;
        sw.vy *= 0.93;
        sw.x = Math.max(24, Math.min(W - 24, sw.x));
        sw.y = Math.max(24, Math.min(H - 24, sw.y));
      });
      // Legacy single superWingman ref (for fire logic)
      s.superWingman = s.superWingmen[0] || null;
    } else {
      s.wingmen = [];
      s.superWingmen = [];
      s.superWingman = null;
    }

    // Spread reload tick
    if (s.spreadReloadTimer > 0) {
      s.spreadReloadTimer--;
      if (s.spreadReloadTimer <= 0) s.spreadShotsLeft = SPREAD_SHOTS_PER_RELOAD;
    }

    const autoFireOn = autoFireEnabledRef.current !== false;
    const manualFirePressed = !!(keys[' '] || keys.Space || keys.Spacebar);
    const wantsToFire = autoFireOn || manualFirePressed;

    // Primary fire: auto or manual (Space when auto-fire is off).
    // Still blocked during active beam (not during charge/cooldown).
    if (!s.laserBeamActive && wantsToFire) {
      s.fireTimer--;
      if (s.fireTimer <= 0) { playerFire(s); s.fireTimer = getFireRate(s.powerups); }
    }

    // Spread timer
    if (wantsToFire && ((s.powerups.spread || 0) > 0 || (s.powerups.shotgun || 0) > 0)) {
      s.spreadFireTimer--;
      if (s.spreadFireTimer <= 0) {
        fireSpreadShot(s);
        const spreadTier = (s.powerups.spread || 0) || (s.powerups.shotgun || 0);
        const rapidfireBonus = (s.powerups.rapidfire || 0) === 1 ? 10 : (s.powerups.rapidfire || 0) * 8;
        s.spreadFireTimer = Math.max(12, 55 - spreadTier * 4 - rapidfireBonus);
      }
    }

    // Missile volleys: fire `missile tier` shots per volley, then cool down.
    const missileTier = s.powerups.missile || 0;
    if (missileTier > 0 && wantsToFire) {
      const rapidfireBonus = (s.powerups.rapidfire || 0) === 1 ? 10 : (s.powerups.rapidfire || 0) * 8;
      const volleyCadence = Math.max(2, 7 - Math.floor(Math.min(missileTier, 10) / 3));
      const volleyCooldown = Math.max(22, 95 - Math.min(missileTier, 10) * 6 - Math.floor(rapidfireBonus * 0.6));

      s.missileVolleyCooldown = Math.max(0, (s.missileVolleyCooldown || 0) - 1);
      s.missileVolleyTimer = Math.max(0, (s.missileVolleyTimer || 0) - 1);

      if ((s.missileVolleyShotsLeft || 0) <= 0 && s.missileVolleyCooldown <= 0) {
        s.missileVolleyShotsLeft = Math.max(1, missileTier);
        s.missileVolleyIndex = 0;
      }

      if ((s.missileVolleyShotsLeft || 0) > 0 && s.missileVolleyTimer <= 0) {
        fireMissileVolleyShot(s, missileTier);
        s.missileVolleyShotsLeft -= 1;
        if (s.missileVolleyShotsLeft > 0) {
          s.missileVolleyTimer = volleyCadence;
        } else {
          s.missileVolleyCooldown = volleyCooldown;
          s.missileVolleyTimer = 0;
        }
      }
    } else if (missileTier <= 0) {
      s.missileVolleyShotsLeft = 0;
      s.missileVolleyTimer = 0;
      s.missileVolleyCooldown = 0;
      s.missileVolleyIndex = 0;
    }

    // Reverse shotgun timer
    if (wantsToFire && (s.powerups.reverse || 0) > 0) {
      s.reverseFireTimer--;
      if (s.reverseFireTimer <= 0) {
        // Always use the same aim logic as other weapons
        const aim = aimModeRef.current
          ? getAimTransformFromRotation(p.x, p.y, Number.isFinite(p._aimRotation) ? p._aimRotation : 0)
          : getAimTransform(p.x, p.y, s.enemies, false);
        fireReverseShot(s, aim);
        const reverseTier = s.powerups.reverse || 0;
        const rapidfireBonus = (s.powerups.rapidfire || 0) === 1 ? 10 : (s.powerups.rapidfire || 0) * 8;
        const baseDelay = Math.max(12, 55 - (reverseTier > 3 ? (reverseTier - 3) * 3 : 0) - rapidfireBonus);
        s.reverseFireTimer = baseDelay;
      }
    }

    // Wingmen independent fire timer
    if (wantsToFire && (s.powerups.wingman || 0) > 0 && s.wingmen.length > 0) {
      s.wingmanFireTimer--;
      if (s.wingmanFireTimer <= 0) {
        // Find non-invulnerable blocks as fallback targets
        const blockTargets = [];
        s.blocks.forEach(block => {
          if (!block.invulnerable) {
            const cells = getBlockCells(block);
            if (cells.length > 0) blockTargets.push({ x: cells[0].x + BLOCK_SIZE / 2, y: cells[0].y + BLOCK_SIZE / 2 });
          }
        });
        s.piledCells.forEach(cell => blockTargets.push({ x: cell.x + BLOCK_SIZE / 2, y: cell.y + BLOCK_SIZE / 2 }));

        s.wingmen.forEach(w => {
          let target = null, bestDist = Infinity;
          s.enemies.forEach(e => {
            const d = Math.hypot(e.x - w.x, e.y - w.y);
            if (d < bestDist) { bestDist = d; target = { x: e.x, y: e.y }; }
          });
          // Fall back to nearest non-invulnerable block if no enemies
          if (!target && blockTargets.length > 0) {
            blockTargets.forEach(bt => {
              const d = Math.hypot(bt.x - w.x, bt.y - w.y);
              if (d < bestDist) { bestDist = d; target = bt; }
            });
          }
          if (target) {
            const dx = target.x - w.x, dy = target.y - w.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            acquireBullet(s, { x: w.x, y: w.y - 10, vx: (dx / len) * 7, vy: (dy / len) * 7, type: 'wingman' }, 'player');
          } else {
            acquireBullet(s, { x: w.x, y: w.y - 10, vx: 0, vy: -7, type: 'wingman' }, 'player');
          }
        });
        const rapidfireBonus = (s.powerups.rapidfire || 0) === 1 ? 10 : (s.powerups.rapidfire || 0) * 8;
        s.wingmanFireTimer = Math.max(12, 45 - rapidfireBonus);
      }
    }

    // Super wingmen fire one random gun from the player's currently unlocked weapon pool.
    if (wantsToFire && s.superWingmen && s.superWingmen.length > 0) {
      s.superWingmanFireTimer = (s.superWingmanFireTimer || 0) - 1;
      if (s.superWingmanFireTimer <= 0) {
        const pw = s.powerups;
        const spreadTier = (pw.spread || 0) || (pw.shotgun || 0);
        const availableSuperGuns = [];
        if ((pw.laser || 0) > 0) availableSuperGuns.push('laser');
        if ((pw.bounce || 0) > 0) availableSuperGuns.push('bounce');
        if (spreadTier > 0) availableSuperGuns.push('spread');
        if ((pw.missile || 0) > 0) availableSuperGuns.push('missile');
        if ((pw.reverse || 0) > 0) availableSuperGuns.push('reverse');
        if ((pw.photon || 0) > 0) availableSuperGuns.push('photon');
        if (availableSuperGuns.length === 0) availableSuperGuns.push('normal');

        const liveTargets = s.enemies.filter(e => !e.dead && e.type !== 'dropper' && isEnemyVisibleForTargeting(e));
        s.superWingmen.forEach(sw => {
          let target = sw.aimTarget && !sw.aimTarget.dead && isEnemyVisibleForTargeting(sw.aimTarget) ? sw.aimTarget : null;
          if (!target && liveTargets.length > 0) {
            let best = null;
            let bestDist = Infinity;
            liveTargets.forEach(e => {
              const d = Math.hypot(e.x - sw.x, e.y - sw.y);
              if (d < bestDist) { bestDist = d; best = e; }
            });
            target = best;
          }
          const aimAngle = aimModeRef.current && Number.isFinite(sw._aimRotation)
            ? (sw._aimRotation - Math.PI / 2)
            : (target
                ? Math.atan2(target.y - sw.y, target.x - sw.x) + randomBetween(-0.09, 0.09)
                : -Math.PI / 2);
          const aimDirX = Math.cos(aimAngle);
          const aimDirY = Math.sin(aimAngle);

          const selectedGun = availableSuperGuns[Math.floor(Math.random() * availableSuperGuns.length)];
          if (selectedGun === 'laser') {
            const laserTier = Math.max(1, pw.laser || 1);
            const laserSpeed = 9.2;
            acquireBullet(s, {
              x: sw.x,
              y: sw.y - 14,
              vx: aimDirX * laserSpeed,
              vy: aimDirY * laserSpeed,
              type: 'laser',
              fat: Math.min(2, 1 + Math.floor(laserTier / 5)),
            }, 'player');
          } else if (selectedGun === 'bounce') {
            const bounceSpeed = 8.2;
            acquireBullet(s, {
              x: sw.x,
              y: sw.y - 14,
              vx: aimDirX * bounceSpeed,
              vy: aimDirY * bounceSpeed,
              type: 'bounce',
              bouncesLeft: Math.max(1, (pw.bounce || 0) + 1),
            }, 'player');
          } else if (selectedGun === 'spread') {
            const pelletCount = Math.min(5, 2 + Math.floor(Math.max(1, spreadTier) / 3));
            const spreadDeg = Math.min(80, 24 + spreadTier * 4);
            for (let i = 0; i < pelletCount; i++) {
              const t = pelletCount === 1 ? 0.5 : i / (pelletCount - 1);
              const a = aimAngle - (spreadDeg * Math.PI / 180) / 2 + (spreadDeg * Math.PI / 180) * t;
              acquireBullet(s, {
                x: sw.x,
                y: sw.y - 12,
                vx: Math.cos(a) * 6.8,
                vy: Math.sin(a) * 6.8,
                type: 'spreadPellet',
              }, 'player');
            }
          } else if (selectedGun === 'missile') {
            const missileTier = Math.max(1, pw.missile || 1);
            const missileSpeed = 7.2 + Math.min(missileTier, 10) * 0.16;
            acquireBullet(s, {
              x: sw.x,
              y: sw.y - 14,
              vx: aimDirX * missileSpeed,
              vy: aimDirY * missileSpeed,
              type: 'missile',
              missileTier,
              speed: missileSpeed,
              maxTurnRate: 0.08 + Math.min(missileTier, 10) * 0.008,
              homingDelay: 10,
              preferredTarget: target || null,
            }, 'player');
          } else if (selectedGun === 'reverse') {
            const reverseTier = Math.max(1, pw.reverse || 1);
            const pelletCount = Math.max(1, Math.min(5, reverseTier));
            const spreadDeg = pelletCount === 1 ? 0 : Math.min(90, 12 + reverseTier * 8);
            const reverseBaseAngle = aimAngle + Math.PI;
            for (let i = 0; i < pelletCount; i++) {
              const t = pelletCount === 1 ? 0.5 : i / (pelletCount - 1);
              const a = reverseBaseAngle - (spreadDeg * Math.PI / 180) / 2 + (spreadDeg * Math.PI / 180) * t;
              acquireBullet(s, {
                x: sw.x,
                y: sw.y + 12,
                vx: Math.cos(a) * 6.7,
                vy: Math.sin(a) * 6.7,
                type: 'reverse',
              }, 'player');
            }
          } else if (selectedGun === 'photon') {
            const photonTier = Math.max(1, pw.photon || 1);
            const size = Math.min(12, 6 + photonTier);
            const photonSpeed = 9.2;
            acquireBullet(s, {
              x: sw.x,
              y: sw.y - 14,
              vx: aimDirX * photonSpeed,
              vy: aimDirY * photonSpeed,
              type: 'photon',
              size,
              orbitAngle: 0,
            }, 'player');
          } else {
            const normalSpeed = 6.4;
            acquireBullet(s, { x: sw.x, y: sw.y - 18, vx: aimDirX * normalSpeed, vy: aimDirY * normalSpeed, type: 'normal' }, 'player');
          }
        });
        // Intentionally slower than player fire rate so super wingmen assist instead of dominate.
        s.superWingmanFireTimer = Math.max(18, getFireRate(pw) + 12);
      }
    }

    // ── Laser continuous beam / charge / cooldown ────────────
    if ((s.powerups.laser || 0) > 0) {
      if (s.laserCooldown > 0) {
        s.laserBeamActive = false;
        s.laserCooldown--;
      } else if (s.laserBeamActive) {
        s.laserBeamTimer--;
        const laserAim = aimModeRef.current
          ? getAimTransformFromRotation(p.x, p.y, Number.isFinite(p._aimRotation) ? p._aimRotation : 0)
          : getAimTransform(p.x, p.y, s.enemies, false);
        const beamOriginX = laserAim.noseX;
        const beamOriginY = laserAim.noseY;
        const beamDirX = laserAim.dirX;
        const beamDirY = laserAim.dirY;
        const maxBeamDistance = Math.hypot(W, H) + 120;
        const laserTier = s.powerups.laser;
        const isPiercing = laserTier >= 10;
        const laserColor = isPiercing ? '#ffffff' : WEAPON_COLORS.laser;
        const beamW = laserTier >= 10 ? (4 + laserTier * 3) * 2 : 4 + laserTier * 3;
        s.enemyBullets = s.enemyBullets.filter(eb => {
          const hitDistance = getBeamHitDistance(beamOriginX, beamOriginY, beamDirX, beamDirY, eb.x, eb.y, beamW + 6, maxBeamDistance);
          if (hitDistance !== null) {
            spawnExplosion(s, eb.x, eb.y, laserColor, 3);
            releaseBullet(s, eb);
            return false;
          }
          return true;
        });

        if (s.laserFlareTimer > 0) s.laserFlareTimer--;

        if (s.laserBeamTimer % 4 === 0) { // damage tick every 4 frames
          // Find the closest blocking tetris block in beam path.
          let beamBlockDistance = maxBeamDistance;
          s.blocks.forEach(block => {
            if (block.dead) return;
            getBlockCells(block).forEach(cell => {
              const cx = cell.x + BLOCK_SIZE / 2;
              const cy = cell.y + BLOCK_SIZE / 2;
              const hitDistance = getBeamHitDistance(
                beamOriginX,
                beamOriginY,
                beamDirX,
                beamDirY,
                cx,
                cy,
                beamW + BLOCK_SIZE * 0.72,
                maxBeamDistance
              );
              if (hitDistance !== null && hitDistance < beamBlockDistance) {
                beamBlockDistance = hitDistance;
                block._laserHit = true;
              }
            });
          });
          s.blocks.forEach(block => {
            if (block._laserHit && !block.dead) {
              block._laserHit = false;
              if (!block.invulnerable) {
                block.hp--;
                sounds.hit();
                spawnExplosion(s, block.x + BLOCK_SIZE / 2, block.y, laserColor, 3);
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

          // Beam hits enemies — piercing at tier 10 (hits all), otherwise first only
          let beamStopDistance = beamBlockDistance;
          const enemiesInBeam = s.enemies
            .map(e => {
              if (e.dead) return null;
              const hitDistance = getBeamHitDistance(
                beamOriginX,
                beamOriginY,
                beamDirX,
                beamDirY,
                e.x,
                e.y,
                beamW + Math.max(e.w || 18, e.h || 18),
                beamBlockDistance
              );
              if (hitDistance === null) return null;
              return { enemy: e, hitDistance };
            })
            .filter(Boolean)
            .sort((a, b) => a.hitDistance - b.hitDistance); // closest to player first

          if (isPiercing) {
            enemiesInBeam.forEach(({ enemy: e }) => {
              if (consumePirateShieldPiece(s, e, beamOriginX, beamOriginY, laserColor)) return;
              e.hp -= 1;
              sounds.hit();
              spawnExplosion(s, e.x, e.y, laserColor, 3);
              if (e.hp <= 0) {
                e.dead = true;
                const pts = e.type === 'boss' ? 5000 : e.type === 'dropper' ? 500 : e.type === 'elite' ? 300 : 100;
                s.score += pts; onScoreChange(s.score); sounds.kill();
                spawnExplosion(s, e.x, e.y, e.type === 'boss' ? '#ff0066' : laserColor, e.type === 'boss' ? 40 : 14);
                if (e.type === 'dropper') { sounds.killDropper(); spawnFloatingPowerup(s, e.x, e.y, e.dropType); }
                if (e.type === 'boss') { sounds.stopBossMusic(); sounds.waveComplete(); grantBossLifeReward(s); }
              }
            });
            beamStopDistance = beamBlockDistance;
          } else {
            const firstEnemy = enemiesInBeam[0] || null;
            if (firstEnemy) {
              beamStopDistance = Math.min(beamBlockDistance, firstEnemy.hitDistance);
              if (consumePirateShieldPiece(s, firstEnemy.enemy, beamOriginX, beamOriginY, laserColor)) {
                s.laserBeamEndX = beamOriginX + beamDirX * beamStopDistance;
                s.laserBeamEndY = beamOriginY + beamDirY * beamStopDistance;
                return;
              }
              firstEnemy.enemy.hp -= 1;
              sounds.hit();
              spawnExplosion(s, firstEnemy.enemy.x, firstEnemy.enemy.y, laserColor, 3);
              if (firstEnemy.enemy.hp <= 0) {
                firstEnemy.enemy.dead = true;
                const pts = firstEnemy.enemy.type === 'boss' ? 5000 : firstEnemy.enemy.type === 'dropper' ? 500 : firstEnemy.enemy.type === 'elite' ? 300 : 100;
                s.score += pts; onScoreChange(s.score); sounds.kill();
                spawnExplosion(s, firstEnemy.enemy.x, firstEnemy.enemy.y, firstEnemy.enemy.type === 'boss' ? '#ff0066' : laserColor, firstEnemy.enemy.type === 'boss' ? 40 : 14);
                if (firstEnemy.enemy.type === 'dropper') { sounds.killDropper(); spawnFloatingPowerup(s, firstEnemy.enemy.x, firstEnemy.enemy.y, firstEnemy.enemy.dropType); }
                if (firstEnemy.enemy.type === 'boss') { sounds.stopBossMusic(); sounds.waveComplete(); grantBossLifeReward(s); }
              }
            }
          }
          s.enemies = s.enemies.filter(e => !e.dead);
          s.laserBeamEndX = beamOriginX + beamDirX * beamStopDistance;
          s.laserBeamEndY = beamOriginY + beamDirY * beamStopDistance;
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
          s.laserBeamTimer = LASER_BEAM_FRAMES; // fixed duration regardless of tier
          s.laserFlareTimer = 12; // brief muzzle flare frames
          sounds.powerup();
        }
      }
    } else {
      s.laserCharge = 0; s.laserCooldown = 0; s.laserBeamActive = false; s.laserBeamTimer = 0;
    }

    // ── Dropper timer-based spawn (independent of wave) ──────
    if (!bossModeRef.current) {
      // Rotate displayed powerup type every 5 seconds
      s.dropperRotateTimer--;
      if (s.dropperRotateTimer <= 0) {
        // Advance to next non-maxed type
        s.dropperRotationIdx = (s.dropperRotationIdx + 1) % DROPPER_TYPES.length;
        // Skip types already at max tier
        for (let i = 0; i < DROPPER_TYPES.length; i++) {
          const t = DROPPER_TYPES[s.dropperRotationIdx];
          if ((s.powerups[t] || 0) < 10) break;
          s.dropperRotationIdx = (s.dropperRotationIdx + 1) % DROPPER_TYPES.length;
        }
        s.dropperRotateTimer = DROPPER_ROTATE_FRAMES;
        // Update existing droppers to new type
        s.enemies.forEach(e => {
          if (e.type === 'dropper' && e.dropType === 'star') {
            // Star droppers sparkle
            e.color = DROPPER_COLORS.star;
          }
        });
      }

      s.dropperSpawnTimer--;
      if (s.dropperSpawnTimer <= 0) {
        spawnDropper(W, s);
        s.dropperSpawnTimer = DROPPER_SPAWN_INTERVAL;
      }

      // Rare star dropper on its own independent timer
      s.starDropperTimer--;
      if (s.starDropperTimer <= 0) {
        spawnDropper(W, s, 'star');
        s.starDropperTimer = STAR_SPAWN_INTERVAL + Math.floor(randomBetween(0, 600));
      }
    }

    // ── Enemy movement ────────────────────────────────────────
    const eaterDifficultyTier = (difficultyConfigRef.current?.maxWave || 25) >= 100
      ? 'hell'
      : (difficultyConfigRef.current?.maxWave || 25) >= 50
        ? 'normal'
        : 'easy';
    const eaterTuning = eaterDifficultyTier === 'hell'
      ? {
          moveMult: 1.26,
          roamMult: 1.22,
          biteMult: 1.35,
          stage0GrowthNeed: 1,
          stage1GrowthNeed: 2,
          stage2SpawnCooldown: 260,
          stage1SpawnCooldown: 320,
          miniHitDamage: 0.5,
        }
      : eaterDifficultyTier === 'normal'
        ? {
            moveMult: 1.14,
            roamMult: 1.12,
            biteMult: 1.18,
            stage0GrowthNeed: 1,
            stage1GrowthNeed: 2,
            stage2SpawnCooldown: 300,
            stage1SpawnCooldown: 360,
            miniHitDamage: 0.6,
          }
        : {
            moveMult: 1,
            roamMult: 1,
            biteMult: 1,
            stage0GrowthNeed: 1,
            stage1GrowthNeed: 3,
            stage2SpawnCooldown: 360,
            stage1SpawnCooldown: 420,
            miniHitDamage: 0.7,
          };

    const basicCoverCrowding = new Map();
    s.enemies.forEach((enemy) => {
      if (!enemy || enemy.dead || enemy.type !== 'basic') return;
      const blockIdx = enemy._coverBlockIdx;
      if (!Number.isInteger(blockIdx) || blockIdx < 0) return;
      basicCoverCrowding.set(blockIdx, (basicCoverCrowding.get(blockIdx) || 0) + 1);
    });

    s.enemies.forEach(e => {
      if (e.type === 'boss') {
        const bt = e.tier || 1;
        const bossWave = e.wave || (bt * 5);
        const enraged = e.hp <= e.maxHp / 3;
        e._enraged = enraged;
        e.phase = (e.phase || 0) + (enraged ? 0.05 : 0.015);

        if (bossWave === 5) {
          // Fang: quick side sweeps with short dives.
          const targetY = H * 0.22 + Math.sin(e.phase * 2.7) * (enraged ? 20 : 14);
          e.y += (targetY - e.y) * (enraged ? 0.22 : 0.1);
          e.x += Math.sin(e.phase * 2.2) * (enraged ? 10.5 : 5.2);
        } else if (bossWave === 10) {
          // Dreadnought: heavy drifting arc, slower but wider path.
          const targetY = H * 0.26 + Math.sin(e.phase * 0.95) * (enraged ? 30 : 24);
          e.y += (targetY - e.y) * (enraged ? 0.16 : 0.08);
          e.x = W / 2 + Math.sin(e.phase * (enraged ? 1.15 : 0.9)) * (W * (enraged ? 0.48 : 0.34));

          // Mothership behavior: faster, more frequent deploy waves.
          if (e._spawnWaveTimer === undefined) e._spawnWaveTimer = 170;
          if (e._eliteSpawnTimer === undefined) e._eliteSpawnTimer = 250;
          if (e._hangarAnimCycleTimer === undefined) e._hangarAnimCycleTimer = 140;
          if (e._hangarAnimDuration === undefined) e._hangarAnimDuration = 180; // about half previous duration
          if (e._hangarAnimTimer === undefined) e._hangarAnimTimer = 0;
          if (e._hangarSheetPlaying === undefined) e._hangarSheetPlaying = false;
          if (e._queuedBasicSpawn === undefined) e._queuedBasicSpawn = false;
          if (e._queuedEliteSpawn === undefined) e._queuedEliteSpawn = false;
          if (e._spawnWindowTriggered === undefined) e._spawnWindowTriggered = false;
          if (e.y > 30) {
            e._spawnWaveTimer--;
            e._eliteSpawnTimer--;

            if (e._spawnWaveTimer <= 0) {
              e._queuedBasicSpawn = true;
              e._spawnWaveTimer = 150 + Math.floor(randomBetween(0, 45));
            }
            if (e._eliteSpawnTimer <= 0) {
              e._queuedEliteSpawn = true;
              e._eliteSpawnTimer = 220 + Math.floor(randomBetween(0, 55));
            }

            // Play hangar open/close sheet: sooner and much more often.
            if (!e._hangarSheetPlaying) {
              e._hangarAnimCycleTimer--;
              if (e._hangarAnimCycleTimer <= 0) {
                e._hangarSheetPlaying = true;
                e._hangarAnimTimer = e._hangarAnimDuration;
                e._hangarAnimCycleTimer = 260;
                e._spawnWindowTriggered = false;
              }
            } else {
              const duration = Math.max(1, e._hangarAnimDuration || 180);
              const progress = 1 - Math.max(0, e._hangarAnimTimer / duration);
              const inSpawnWindow = progress >= 0.4 && progress <= 0.62;

              // Trigger hangar launch once during the open-frame window.
              if (inSpawnWindow && !e._spawnWindowTriggered) {
                const activeCount = s.enemies.filter(en => en.type !== 'boss' && !en.dead).length;
                if (e._queuedBasicSpawn && activeCount < 36) {
                  spawnDreadnoughtWave(s, e, W, false);
                  e._queuedBasicSpawn = false;
                }
                if (e._queuedEliteSpawn && s.enemies.filter(en => en.type !== 'boss' && !en.dead).length < 38) {
                  spawnDreadnoughtWave(s, e, W, true);
                  e._queuedEliteSpawn = false;
                }
                e._spawnWindowTriggered = true;
              }

              e._hangarAnimTimer--;
              if (e._hangarAnimTimer <= 0) {
                e._hangarSheetPlaying = false;
                e._hangarAnimTimer = 0;
              }
            }
          }
        } else if (bossWave === 15) {
          // Beholder: dedicated movement, lasers, and shield logic.
          const liveFps = fpsTrackerRef.current?.lastReported || 60;
          e._performanceMode = liveFps <= 14 ? 'very-low' : liveFps <= 24 ? 'low' : 'normal';
          updateBeholderMovement(e, W, H);
          if (enraged) updateBeholderMovement(e, W, H);
          updateBeholderShield(e);
          updateBeholderFire(e, p, s, sounds);
          if (e._laserHitsPlayer) {
            e._laserDamageTick = (e._laserDamageTick || 0) - 1;
            if (e._laserDamageTick <= 0) {
              takeDamage(s);
              if (e._performanceMode === 'very-low') {
                e._laserDamageTick = enraged ? 9 : 13;
              } else if (e._performanceMode === 'low') {
                e._laserDamageTick = enraged ? 7 : 10;
              } else {
                e._laserDamageTick = enraged ? 5 : 8;
              }
            }
          } else {
            e._laserDamageTick = 0;
          }
        } else if (bossWave === 20) {
          // Pirate: opening behavior is an immediate bottom swoop, then harvest mode.
          if (!e._pirateMovePhase) e._pirateMovePhase = 'swoop';

          const bottomY = H - 86;
          const lowBandY = H * 0.72;
          const hasPiles = s.piledCells.length > 0;

          if (e._pirateMovePhase === 'swoop') {
            // Aim the dive toward built-up piles so collection begins as soon as it arrives.
            let targetX = W / 2;
            if (hasPiles) {
              let nearest = null;
              let nearestDist = Infinity;
              s.piledCells.forEach(cell => {
                const cx = cell.x + BLOCK_SIZE / 2;
                const cy = cell.y + BLOCK_SIZE / 2;
                const d = Math.hypot(cx - e.x, cy - e.y);
                if (d < nearestDist) {
                  nearestDist = d;
                  nearest = { x: cx, y: cy };
                }
              });
              if (nearest) targetX = nearest.x;
            }

            const dx = targetX - e.x;
            const diveXStep = Math.max(-4.2, Math.min(4.2, dx * 0.09));
            e.x += diveXStep;
            e.y += enraged ? 4.8 : 4.1;

            if (e.y >= lowBandY) {
              e._pirateMovePhase = 'harvest';
            }
          }

          if (e._pirateMovePhase === 'harvest') {
            let target = null;
            let bestDist = Infinity;

            // Prefer built-up stage cells first, then active falling blocks.
            s.piledCells.forEach(cell => {
              const cx = cell.x + BLOCK_SIZE / 2;
              const cy = cell.y + BLOCK_SIZE / 2;
              const d = Math.hypot(cx - e.x, cy - e.y);
              if (d < bestDist) {
                bestDist = d;
                target = { x: cx, y: cy };
              }
            });

            if (!target) {
              s.blocks.forEach(block => {
                if (block.dead) return;
                const cells = getBlockCells(block);
                cells.forEach(cell => {
                  const cx = cell.x + BLOCK_SIZE / 2;
                  const cy = cell.y + BLOCK_SIZE / 2;
                  const d = Math.hypot(cx - e.x, cy - e.y);
                  if (d < bestDist) {
                    bestDist = d;
                    target = { x: cx, y: cy };
                  }
                });
              });
            }

            if (target) {
              const dx = target.x - e.x;
              const dy = target.y - e.y;
              const len = Math.hypot(dx, dy) || 1;
              const seekSpd = enraged ? 4.0 : 2.8;
              e.x += (dx / len) * seekSpd;
              e.y += (dy / len) * seekSpd;
            } else {
              // Keep pressure in the lower half when no food is available.
              const targetY = H * 0.78;
              e.y += (targetY - e.y) * (enraged ? 0.18 : 0.12);
              e.x += e.vx * (enraged ? 3.8 : 2.0);
              if (e.x < 70 || e.x > W - 70) e.vx *= -1;
            }
          }

          if (e.y < 60) e.y = 60;
          if (e.y > bottomY) e.y = bottomY;
          updatePirateBlockShield(e, s, p);
        } else {
          // Final: orbital pattern with vertical breathing.
          const targetY = H * 0.3;
          e.y += (targetY - e.y) * (enraged ? 0.13 : 0.06);
          e.x = W / 2 + Math.cos(e.phase * (enraged ? 1.2 : 0.95)) * (W * (enraged ? 0.42 : 0.28));
          e.y += Math.sin(e.phase * 1.9) * (enraged ? 3.1 : 1.2);
        }

        if (e.x < 55) e.x = 55;
        if (e.x > W - 55) e.x = W - 55;
      } else if (e.type === 'mine') {
        // Mine: slow drift, periodically charges far at player, recharges after cooldown
        e._chargeTimer = (e._chargeTimer === undefined ? randomBetween(30, 60) : e._chargeTimer) - 1;
        e._rechargeCooldown = Math.max(0, (e._rechargeCooldown || 0) - 1);
        if (e._charging) {
          // Mid-charge: fast rocket toward player
          e.x += e._chargeDx * 7;
          e.y += e._chargeDy * 7;
          e._chargeDuration = (e._chargeDuration || 0) - 1;
          if (e._chargeDuration <= 0) {
            e._charging = false;
            e._rechargeCooldown = randomBetween(60, 120); // ~1-2s cooldown before next charge
            e.vx = randomBetween(-0.8, 0.8);
            e.vy = randomBetween(0.3, 0.8);
          }
          if (e.x < 20) { e.x = 20; e._charging = false; e._rechargeCooldown = 180; }
          if (e.x > W - 20) { e.x = W - 20; e._charging = false; e._rechargeCooldown = 180; }
          if (e.y < 20) { e.y = 20; e._charging = false; e._rechargeCooldown = 180; }
          if (e.y > H - 20) { e.y = H - 20; e._charging = false; e._rechargeCooldown = 180; }
        } else {
          // Idle drift
          e.x += e.vx; e.y += e.vy;
          if (e.x < 20 || e.x > W - 20) e.vx *= -1;
          if (e.y < 20) { e.y = 20; e.vy = Math.abs(e.vy); }
          if (e.y > H - 20) { e.y = H - 20; e.vy = -Math.abs(e.vy); }
          // Trigger charge when timer expires AND recharge cooldown done
          if (e._chargeTimer <= 0 && e._rechargeCooldown <= 0) {
            const dx = p.x - e.x, dy = p.y - e.y;
            const len = Math.hypot(dx, dy) || 1;
            e._chargeDx = dx / len;
            e._chargeDy = dy / len;
            e._charging = true;
            e._chargeDuration = 60; // full screen charge
            e._chargeTimer = randomBetween(30, 60);
          }
        }
      } else if (e.type === 'eater') {
        if (e._eatAnimTimer === undefined) e._eatAnimTimer = 0;
        e._eatAnimTimer = Math.max(0, e._eatAnimTimer - 1);
        e._eating = e._eatAnimTimer > 0;
        e._chargingPlayer = false;
        if (e._growthStage === undefined) e._growthStage = e._mini ? 0 : 1;
        if (e._growthMeter === undefined) e._growthMeter = 0;
        if (e._blocksEaten === undefined) e._blocksEaten = 0;
        if (e._offspringCount === undefined) e._offspringCount = 0;
        if (e._offspringCap === undefined) e._offspringCap = e._lineageDepth >= 1 ? 1 : 2;
        if (e._lineageDepth === undefined) e._lineageDepth = e._mini ? 1 : 0;
        if (e._spawnCooldown === undefined) e._spawnCooldown = 0;
        e._spawnCooldown = Math.max(0, (e._spawnCooldown || 0) - 1);
        if (e._biteCooldown === undefined) e._biteCooldown = 0;
        e._biteCooldown = Math.max(0, (e._biteCooldown || 0) - 1);
        if (e._scatterTimer === undefined) e._scatterTimer = 0;
        if (e._scatterDamp === undefined) e._scatterDamp = 0.96;
        if (e._scatterVx === undefined) e._scatterVx = 0;
        if (e._scatterVy === undefined) e._scatterVy = 0;

        const stageScale = e._growthStage === 0 ? 0.54 : e._growthStage === 1 ? 0.84 : 1.12;
        const targetW = HITBOX_SIZES.eater.w * stageScale;
        const targetH = HITBOX_SIZES.eater.h * stageScale;
        e.w = Number.isFinite(e.w) ? e.w + (targetW - e.w) * 0.18 : targetW;
        e.h = Number.isFinite(e.h) ? e.h + (targetH - e.h) * 0.18 : targetH;

        const bound = Math.max(15, Math.round(Math.max(e.w || 0, e.h || 0) * 0.3));
        const maxReachableTargetY = H - bound - 6;
        const isEnemyOnStage = e.x >= -80 && e.x <= W + 80 && e.y >= -80 && e.y <= H + 80;
        let targetX = null;
        let targetY = null;
        let distToTarget = Infinity;
        let bestTargetDist = Infinity;
        e._targetBlock = null;
        e._targetCellIdx = undefined;

        // Prioritize the closest block/cell to reduce wandering and make eaters commit to targets.
        s.blocks.forEach(block => {
          if (block.dead) return;
          if (block.invulnerable) return;
          getBlockCells(block).forEach(cell => {
            const cx = cell.x + BLOCK_SIZE / 2;
            const cy = Math.min(cell.y + BLOCK_SIZE / 2, maxReachableTargetY);
            const dEater = Math.hypot(cx - e.x, cy - e.y);
            if (dEater < bestTargetDist) {
              bestTargetDist = dEater;
              targetX = cx;
              targetY = cy;
              distToTarget = dEater;
              e._targetBlock = block;
              e._targetCellIdx = undefined;
            }
          });
        });

        s.piledCells.forEach((cell, idx) => {
          if (cell.invulnerable) return;
          const cx = cell.x + BLOCK_SIZE / 2;
          const cy = Math.min(cell.y + BLOCK_SIZE / 2, maxReachableTargetY);
          const dEater = Math.hypot(cx - e.x, cy - e.y);
          if (dEater < bestTargetDist) {
            bestTargetDist = dEater;
            targetX = cx;
            targetY = cy;
            distToTarget = dEater;
            e._targetBlock = null;
            e._targetCellIdx = idx;
          }
        });

        if (targetX !== null && targetY !== null) {
          // Passive ecosystem behavior: eat blocks first and grow through stages.
          if (e._scatterTimer > 0) {
            e.x += e._scatterVx;
            e.y += e._scatterVy;
            e._scatterVx *= e._scatterDamp;
            e._scatterVy *= e._scatterDamp;
            e._scatterTimer -= 1;
          } else if (distToTarget > 10) {
            const dx2 = targetX - e.x;
            const dy2 = targetY - e.y;
            const len2 = Math.hypot(dx2, dy2) || 1;
            const eSpd = ((e._growthStage === 0 ? 1.8 : e._growthStage === 1 ? 2.3 : 2.05) + (s.wave * 0.03)) * eaterTuning.moveMult;
            e.x += (dx2 / len2) * eSpd;
            e.y += (dy2 / len2) * eSpd;
          } else if (isEnemyOnStage) {
            e._eating = true;
            e._eatAnimTimer = Math.max(e._eatAnimTimer || 0, 18);
            const biteInterval = Math.max(2, Math.round((e._growthStage === 0 ? 9 : e._growthStage === 1 ? 7 : 6) / eaterTuning.biteMult));
            let justAte = false;
            if (e._targetBlock && !e._targetBlock.dead) {
              if (e._targetBlock.invulnerable) {
                e._targetBlock = null;
              } else if (e._biteCooldown <= 0) {
                const biteDamage = (e._growthStage === 0 ? 0.11 : e._growthStage === 1 ? 0.15 : 0.19) * eaterTuning.biteMult;
                e._targetBlock.hp -= biteDamage;
                e._biteCooldown = biteInterval;
                if (e._targetBlock.hp <= 0) {
                  e._targetBlock.dead = true;
                  e.hp = Math.min(e.hp + 3, e.maxHp + 5);
                  e.maxHp = Math.max(e.maxHp, e.hp);
                  spawnExplosion(s, e.x, e.y, '#44ff88', 10);
                  justAte = true;
                  e._blocksEaten = (e._blocksEaten || 0) + 1;
                }
              }
            } else if (e._targetCellIdx !== undefined && s.piledCells[e._targetCellIdx] && e._biteCooldown <= 0) {
              s.piledCells.splice(e._targetCellIdx, 1);
              e._biteCooldown = biteInterval;
              e.hp = Math.min(e.hp + 2, e.maxHp + 5);
              e.maxHp = Math.max(e.maxHp, e.hp);
              spawnExplosion(s, e.x, e.y, '#44ff88', 6);
              justAte = true;
              e._blocksEaten = (e._blocksEaten || 0) + 1;
            }
            if (justAte) {
              e._growthMeter = (e._growthMeter || 0) + 1;

              if (e._growthStage === 0 && e._growthMeter >= eaterTuning.stage0GrowthNeed) {
                e._growthStage = 1;
                e._mini = false;
                e.hp += 4;
                e.maxHp += 6;
                e._growthMeter = 0;
                spawnExplosion(s, e.x, e.y, '#99ffbb', 16);
              } else if (e._growthStage === 1 && e._growthMeter >= eaterTuning.stage1GrowthNeed) {
                e._growthStage = 2;
                e.hp += 6;
                e.maxHp += 8;
                e._growthMeter = 0;
                e._spawnCooldown = eaterTuning.stage2SpawnCooldown;
                spawnExplosion(s, e.x, e.y, '#d2ffd9', 20);
              }

              if (e._growthStage >= 2 && e._spawnCooldown <= 0) {
                const spawned = spawnMiniEaters(W, s, e);
                if (spawned > 0) e._spawnCooldown = eaterTuning.stage2SpawnCooldown;
              } else if (e._growthStage === 1 && !e._mini && e._blocksEaten >= 3 && e._spawnCooldown <= 0) {
                const spawned = spawnMiniEaters(W, s, e);
                if (spawned > 0) e._spawnCooldown = eaterTuning.stage1SpawnCooldown;
              }

            }
          }
        } else {
          // No blocks available: roam passively instead of hunting the player.
          e._passiveRoamPhase = (e._passiveRoamPhase || Math.random() * Math.PI * 2) + 0.035;
          if (!Number.isFinite(e._roamDirX) || !Number.isFinite(e._roamDirY) || (e._retargetRoamTimer || 0) <= 0) {
            const roamAngle = Math.random() * Math.PI * 2;
            e._roamDirX = Math.cos(roamAngle);
            e._roamDirY = Math.sin(roamAngle);
            e._retargetRoamTimer = randomBetween(30, 80);
          }
          e._retargetRoamTimer -= 1;
          const roamSpeed = ((e._growthStage === 0 ? 1.1 : e._growthStage === 1 ? 1.45 : 1.3) + (s.wave * 0.015)) * eaterTuning.roamMult;
          const driftBiasX = Math.cos(e._passiveRoamPhase) * 0.35;
          const driftBiasY = Math.sin(e._passiveRoamPhase * 1.2) * 0.28;
          e.x += (e._roamDirX + driftBiasX) * roamSpeed;
          e.y += (e._roamDirY + driftBiasY) * roamSpeed;
        }

        if (e.x < bound) { e.x = bound; }
        if (e.x > W - bound) { e.x = W - bound; }
        if (e.y < bound) { e.y = bound; }
        if (e.y > H - bound) { e.y = H - bound; }
      } else if (e.type === 'dropper') {
        // Random wander — bounce off all walls, never leave screen
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
      } else if (e.type === 'glutton') {
        if (e._baseW === undefined) e._baseW = e.w || 44;
        if (e._baseH === undefined) e._baseH = e.h || 44;
        if (e._gluttonGrowthMeter === undefined) e._gluttonGrowthMeter = 0;
        if (e._segmentCount === undefined) e._segmentCount = 0;
        if (e._maxSegments === undefined) e._maxSegments = e._isHell ? 7 : 5;
        if (!Array.isArray(e._trailPoints)) e._trailPoints = [{ x: e.x, y: e.y, angle: e._angle || Math.PI / 2 }];
        if (!Array.isArray(e._segmentPositions)) e._segmentPositions = [];
        if (e._consumeCooldown === undefined) e._consumeCooldown = 0;
        if (e._targetRetargetTimer === undefined) e._targetRetargetTimer = 0;
        if (e._chargeCooldown === undefined) e._chargeCooldown = Math.floor(randomBetween(160, 280));
        if (e._chargeFrames === undefined) e._chargeFrames = 0;
        if (e._eatingFrames === undefined) e._eatingFrames = 0;
        if (e._bitePauseFrames === undefined) e._bitePauseFrames = 0;

        e._consumeCooldown = Math.max(0, (e._consumeCooldown || 0) - 1);
        e._targetRetargetTimer = Math.max(0, (e._targetRetargetTimer || 0) - 1);
        e._eatingFrames = Math.max(0, (e._eatingFrames || 0) - 1);
        e._bitePauseFrames = Math.max(0, (e._bitePauseFrames || 0) - 1);

        const consumeCandidates = [];

        s.blocks.forEach(block => {
          if (block.dead || block.invulnerable) return;
          const cells = getBlockCells(block);
          if (cells.length === 0) return;
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          let cxSum = 0, cySum = 0;
          cells.forEach(cell => {
            cxSum += cell.x + BLOCK_SIZE / 2;
            cySum += cell.y + BLOCK_SIZE / 2;
            if (cell.x < minX) minX = cell.x;
            if (cell.y < minY) minY = cell.y;
            if (cell.x + BLOCK_SIZE > maxX) maxX = cell.x + BLOCK_SIZE;
            if (cell.y + BLOCK_SIZE > maxY) maxY = cell.y + BLOCK_SIZE;
          });
          const sourceW = Math.max(BLOCK_SIZE, maxX - minX);
          const sourceH = Math.max(BLOCK_SIZE, maxY - minY);
          const mass = Math.max(1, (sourceW + sourceH) / 24 + (block.hp || 1) * 0.6 + (block.invulnerable ? 1.8 : 0));
          consumeCandidates.push({
            kind: 'block',
            target: block,
            x: cxSum / cells.length,
            y: cySum / cells.length,
            sourceW,
            sourceH,
            mass,
            color: block.invulnerable ? '#c7d7ff' : block.color,
          });
        });

        s.piledCells.forEach((cell) => {
          if (cell.invulnerable) return;
          consumeCandidates.push({
            kind: 'piledCell',
            target: cell,
            x: cell.x + BLOCK_SIZE / 2,
            y: cell.y + BLOCK_SIZE / 2,
            sourceW: BLOCK_SIZE,
            sourceH: BLOCK_SIZE,
            mass: 1,
            color: cell.color || '#66ddff',
          });
        });

        const applyGluttonGrowth = (mass, sourceW, sourceH) => {
          const maxGrowthPerConsume = 7;
          const rawGainW = Math.max(1.4, sourceW * 0.24);
          const rawGainH = Math.max(1.4, sourceH * 0.24);
          const sizeGainW = Math.min(rawGainW, maxGrowthPerConsume);
          const sizeGainH = Math.min(rawGainH, maxGrowthPerConsume);
          // Write to target rather than instant-set so the per-frame lerp below
          // produces a smooth visual grow instead of a jarring size pop.
          e._targetW = Math.min((e._targetW || e.w || e._baseW || 94) + sizeGainW, 180);
          e._targetH = Math.min((e._targetH || e.h || e._baseH || 94) + sizeGainH, 180);

          const currentMax = e.maxHp || e.hp || 1;
          const cap = e._isHell ? 1050 : 900;
          const growthScale = Math.max(0.22, 1 - (currentMax / cap) * 0.78);
          const absorbedPressure = Math.min(e._absorbedUnits || 0, 24) * 0.28;
          const rawHpGain = (4 + (sourceW + sourceH) * 0.18 + mass * 2.1 + absorbedPressure + (e._isHell ? 3 : 0)) * growthScale;
          const hpGain = Math.max(2, Math.ceil(rawHpGain));
          e.maxHp = Math.min(currentMax + hpGain, cap);

          const heal = Math.max(1, Math.ceil(hpGain * 0.45));
          e.hp = Math.min((e.hp || 1) + heal, e.maxHp);

          e._absorbedUnits = Math.min((e._absorbedUnits || 0) + mass, 36);
          e._gluttonGrowthMeter = (e._gluttonGrowthMeter || 0) + Math.max(1.6, mass * 1.9 + (sourceW + sourceH) / 18);

          const segmentThreshold = 4 + (e._segmentCount || 0) * 1.65;
          if ((e._segmentCount || 0) < (e._maxSegments || 0) && e._gluttonGrowthMeter >= segmentThreshold) {
            const newSegIndex = e._segmentCount || 0;
            e._segmentCount = Math.min((e._maxSegments || 0), newSegIndex + 1);
            e._gluttonGrowthMeter = Math.max(0, e._gluttonGrowthMeter - segmentThreshold);
            // Give the new segment its own HP pool — tougher as the Glutton grows.
            if (!Array.isArray(e._segmentHp)) e._segmentHp = [];
            const segHp = Math.max(8, Math.min(28, Math.round((e.maxHp || e.hp || 80) * 0.12)));
            e._segmentHp[newSegIndex] = segHp;
          }
        };

        e._chargeFrames = 0;
        e._chargingPlayer = false;
        const patrolSpeed = (e._isHell ? 4.35 : 3.75) + Math.min((e._segmentCount || 0) * 0.08, 0.75);
        const visualHalf = Math.max((e.w || e._baseW || 94) * 0.9, (e.h || e._baseH || 94) * 0.9, 36) + Math.min(e._absorbedUnits || 0, 36) * 1.4;
        const margin = Math.max(20, visualHalf + 6);
        const hasConsumables = consumeCandidates.length > 0;
        const foodMaxY = hasConsumables
          ? consumeCandidates.reduce((best, candidate) => Math.max(best, candidate.y || 0), 0)
          : H * 0.48;
        const patrolBottomCap = hasConsumables
          ? Math.min(H - margin, Math.max(margin + 70, foodMaxY + Math.max(80, margin * 0.45)))
          : Math.min(H - margin, Math.max(margin + 60, H * 0.62));
        // Concentric inward spiral — starts at the perimeter, each completed lap tightens inward,
        // then resets to perimeter when the innermost ring is complete.
        const maxInset = Math.max(0, Math.min(W, H) * 0.5 - margin - 60);
        const insetStep = Math.max(30, Math.min(W, H) * 0.12);
        const buildLapRoute = (inset) => {
          const xl = inset, xr = W - inset;
          const yt = inset, yb = Math.min(H - inset, patrolBottomCap);
          return [
            { x: xl, y: yt }, { x: W * 0.5, y: yt }, { x: xr, y: yt },
            { x: xr, y: (yt + yb) * 0.5 }, { x: xr, y: yb },
            { x: W * 0.5, y: yb }, { x: xl, y: yb }, { x: xl, y: (yt + yb) * 0.5 },
          ];
        };
        if (!Number.isFinite(e._patrolVx) || !Number.isFinite(e._patrolVy)) { e._patrolVx = patrolSpeed; e._patrolVy = 0; }
        if (!Number.isInteger(e._patrolWaypointIndex)) e._patrolWaypointIndex = 0;
        if (e._patrolInset === undefined) e._patrolInset = 0;
        if (!hasConsumables) {
          // With nothing to eat, keep the route in upper/mid lanes instead of drifting to deep-bottom patrol.
          e._patrolInset = 0;
        }

        const isEnemyOnStageNow = e.x >= -80 && e.x <= W + 80 && e.y >= -80 && e.y <= H + 80;
        if (e._bitePauseFrames <= 0 && e._consumeCooldown <= 0 && isEnemyOnStageNow && consumeCandidates.length > 0) {
          let biteTarget = null;
          let biteDist = Infinity;
          consumeCandidates.forEach(c => {
            const d = Math.hypot(c.x - e.x, c.y - e.y);
            if (d < biteDist) {
              biteDist = d;
              biteTarget = c;
            }
          });
          const consumeRange = Math.max(28, ((e.w || 80) + (e.h || 80)) * 0.21);
          if (biteTarget && biteDist <= consumeRange) {
            let consumed = false;
            if (biteTarget.kind === 'block' && biteTarget.target && !biteTarget.target.dead) {
              biteTarget.target.dead = true;
              consumed = true;
            } else if (biteTarget.kind === 'piledCell' && biteTarget.target) {
              const idx = s.piledCells.indexOf(biteTarget.target);
              if (idx >= 0) {
                s.piledCells.splice(idx, 1);
                consumed = true;
              }
            }

            if (consumed) {
              applyGluttonGrowth(biteTarget.mass || 1, biteTarget.sourceW || BLOCK_SIZE, biteTarget.sourceH || BLOCK_SIZE);
              spawnExplosion(s, biteTarget.x || e.x, biteTarget.y || e.y, biteTarget.color || '#ff6666', 14);
              e._consumeCooldown = 20;
              e._bitePauseFrames = 8;
              e._eatingFrames = 16;
            }
          }
        }

        const currentLapRoute = buildLapRoute(margin + e._patrolInset);
        if (e._patrolWaypointIndex >= currentLapRoute.length) e._patrolWaypointIndex = 0;
        let patrolTarget = currentLapRoute[e._patrolWaypointIndex];
        let patrolDx = patrolTarget.x - e.x;
        let patrolDy = patrolTarget.y - e.y;
        let patrolDist = Math.hypot(patrolDx, patrolDy);
        const arrivalThreshold = Math.max(24, patrolSpeed * 8);
        if (patrolDist <= arrivalThreshold) {
          e._patrolWaypointIndex += 1;
          if (e._patrolWaypointIndex >= currentLapRoute.length) {
            e._patrolWaypointIndex = 0;
            e._patrolInset = e._patrolInset + insetStep > maxInset ? 0 : e._patrolInset + insetStep;
          }
          const refreshedRoute = buildLapRoute(margin + e._patrolInset);
          patrolTarget = refreshedRoute[e._patrolWaypointIndex] || refreshedRoute[0];
          patrolDx = patrolTarget.x - e.x;
          patrolDy = patrolTarget.y - e.y;
          patrolDist = Math.hypot(patrolDx, patrolDy);
        }
        const toTargetX = patrolDist > 0.001 ? patrolDx / patrolDist : 1;
        const toTargetY = patrolDist > 0.001 ? patrolDy / patrolDist : 0;
        const steerRate = e._bitePauseFrames > 0 ? 0.06 : 0.14;
        e._patrolVx += (toTargetX * patrolSpeed - e._patrolVx) * steerRate;
        e._patrolVy += (toTargetY * patrolSpeed - e._patrolVy) * steerRate;
        const velocityMag = Math.hypot(e._patrolVx, e._patrolVy) || 1;
        e._patrolVx = (e._patrolVx / velocityMag) * patrolSpeed;
        e._patrolVy = (e._patrolVy / velocityMag) * patrolSpeed;

        const biteSlow = e._bitePauseFrames > 0 ? 0.2 : 1;
        e.x += e._patrolVx * biteSlow;
        e.y += e._patrolVy * biteSlow;

        if (e.x < margin) {
          e.x = margin;
          e._patrolVx = Math.abs(e._patrolVx);
        }
        if (e.x > W - margin) {
          e.x = W - margin;
          e._patrolVx = -Math.abs(e._patrolVx);
        }
        if (e.y < margin) {
          e.y = margin;
          e._patrolVy = Math.abs(e._patrolVy);
        }
        if (e.y > H - margin) {
          e.y = H - margin;
          e._patrolVy = -Math.abs(e._patrolVy);
        }
        if (!Number.isFinite(e.x) || !Number.isFinite(e.y)) {
          e.x = Math.min(W - margin, Math.max(margin, W * 0.5));
          e.y = Math.min(H - margin, Math.max(margin, H * 0.25));
          e._patrolVx = patrolSpeed;
          e._patrolVy = 0;
        }
        const headingX = Number(e.x) - Number(e._prevX ?? e.x - (e.vx || 0));
        const headingY = Number(e.y) - Number(e._prevY ?? e.y - (e.vy || 1));
        if (Math.hypot(headingX, headingY) > 0.001) {
          e._angle = Math.atan2(headingY, headingX);
        }

        // Smoothly lerp toward the target size set by applyGluttonGrowth.
        if (e._targetW !== undefined) e.w = e.w + (e._targetW - e.w) * 0.04;
        if (e._targetH !== undefined) e.h = e.h + (e._targetH - e.h) * 0.04;

        const segmentCount = e._segmentCount || 0;
        const gluttonBodySize = Math.max(e.w || 94, e.h || 94);
        const segmentGap = Math.max(56, gluttonBodySize * 0.66);
        e._gluttonSegmentGap = segmentGap;
        // Dense trail points so turns are faithfully reproduced by rear segments.
        const trailPointSpacing = 3;
        const trailHead = e._trailPoints[0];
        if (!trailHead || Math.hypot((trailHead.x || 0) - e.x, (trailHead.y || 0) - e.y) >= trailPointSpacing) {
          e._trailPoints.unshift({ x: e.x, y: e.y, angle: e._angle || Math.PI / 2 });
        }

        // Keep enough history for every segment + tail at max train length.
        const requiredTrailDistance = segmentGap * ((e._maxSegments || 24) + 2.5) + 400;
        let accumulatedTrailDistance = 0;
        for (let i = 0; i < e._trailPoints.length - 1; i += 1) {
          const a = e._trailPoints[i];
          const b = e._trailPoints[i + 1];
          accumulatedTrailDistance += Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0));
          if (accumulatedTrailDistance >= requiredTrailDistance) {
            e._trailPoints.length = Math.max(i + 2, 2);
            break;
          }
        }

        const interpolateAngle = (from, to, mix) => {
          const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
          return from + delta * mix;
        };

        const sampleTrailPoint = (distance, out = {}) => {
          const trail = e._trailPoints;
          if (!trail.length) {
            out.x = e.x;
            out.y = e.y;
            out.angle = e._angle || Math.PI / 2;
            return out;
          }
          if (trail.length === 1) {
            out.x = trail[0].x;
            out.y = trail[0].y;
            out.angle = trail[0].angle || e._angle || Math.PI / 2;
            return out;
          }

          let traversed = 0;
          for (let i = 0; i < trail.length - 1; i += 1) {
            const a = trail[i];
            const b = trail[i + 1];
            const segLen = Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0));
            if (traversed + segLen >= distance) {
              const remain = Math.max(0, distance - traversed);
              const mix = segLen > 0.0001 ? (remain / segLen) : 0;
              out.x = a.x + (b.x - a.x) * mix;
              out.y = a.y + (b.y - a.y) * mix;
              out.angle = interpolateAngle(a.angle || e._angle || Math.PI / 2, b.angle || a.angle || e._angle || Math.PI / 2, mix);
              return out;
            }
            traversed += segLen;
          }

          const last = trail[trail.length - 1] || trail[0];
          out.x = last.x;
          out.y = last.y;
          out.angle = last.angle || e._angle || Math.PI / 2;
          return out;
        };

        // Pure trail following — each segment snaps directly to its historic trail position.
        // No spring, no separation clamp: this guarantees correct facing and no clustering.
        if (!Array.isArray(e._segmentPositions)) e._segmentPositions = [];
        e._segmentPositions.length = segmentCount;
        const sampled = {};
        for (let index = 0; index < segmentCount; index += 1) {
          const existing = e._segmentPositions[index] || {};
          sampleTrailPoint(segmentGap * (index + 1), sampled);
          existing.x = sampled.x;
          existing.y = sampled.y;
          existing.angle = sampled.angle;
          existing.sizeScale = Math.max(0.78, 0.94 - index * 0.025);
          e._segmentPositions[index] = existing;
        }

        if (segmentCount > 0) {
          const tail = e._tailPosition || {};
          sampleTrailPoint(segmentGap * (segmentCount + 1), sampled);
          tail.x = sampled.x;
          tail.y = sampled.y;
          tail.angle = sampled.angle;
          e._tailPosition = tail;
        } else {
          e._tailPosition = null;
        }
        e._tailVelocity = null;

        e._prevX = e.x;
        e._prevY = e.y;
      } else if (e.type === 'elite') {
        // Elite: aggressive sine-wave weaving, periodic dash — fixed speed (no wall acceleration)
        e.movePhase = (e.movePhase || 0) + 0.07;
        e.dashTimer = (e.dashTimer || 0) - 1;
        // Init base speed once
        if (!e._baseSpd) e._baseSpd = Math.hypot(e.vx, e.vy) || 1.5;
        if (e.dashTimer <= 0) {
          const dx = p.x - e.x, dy = p.y - e.y;
          const len = Math.hypot(dx, dy) || 1;
          e.vx = (dx / len) * e._baseSpd * 2.5;
          e.vy = (dy / len) * e._baseSpd * 1.2;
          e.dashTimer = randomBetween(120, 200);
        }
        const weaveMag = 2.2;
        e.x += e.vx + Math.sin(e.movePhase) * weaveMag;
        e.y += e.vy;
        // Wall bounce: preserve sign of velocity but reset to base speed (no snowball)
        if (e.x < 20) { e.x = 20; e.vx = Math.abs(e._baseSpd); }
        if (e.x > W - 20) { e.x = W - 20; e.vx = -Math.abs(e._baseSpd); }
        if (e.y < 20) { e.y = 20; e.vy = Math.abs(e._baseSpd); }
        if (e.y > H - 20) { e.y = H - 20; e.vy = -Math.abs(e._baseSpd); }
      } else {
        // Basic: smart cover-seeking. Dart toward block cover points and keep repositioning.
        const hasCover = s.blocks.some(block => !block.dead && !block.invulnerable);
        e._hideCooldown = Math.max(0, (e._hideCooldown || 0) - 1);
        if (hasCover) e.hideMode = true;

        if (e.hideMode && e._hideCooldown <= 0 && hasCover) {
          e._coverRetarget = (e._coverRetarget || 0) - 1;
          if (e._coverRetarget <= 0 || !e._coverTarget) {
            const coverCandidates = [];
            s.blocks.forEach((block, blockIdx) => {
              if (block.dead || block.invulnerable) return;
              const crowdedCount = basicCoverCrowding.get(blockIdx) || 0;
              const cells = getBlockCells(block);
              cells.forEach(cell => {
                const cx = cell.x + BLOCK_SIZE / 2;
                const cy = cell.y + BLOCK_SIZE / 2;
                const awayX = cx - p.x;
                const awayY = cy - p.y;
                const awayLen = Math.hypot(awayX, awayY) || 1;

                // Far side of block relative to player = better cover.
                const coverX = cx + (awayX / awayLen) * (BLOCK_SIZE * 0.9);
                const coverY = cy + (awayY / awayLen) * (BLOCK_SIZE * 0.9);

                const toEnemy = Math.hypot(coverX - e.x, coverY - e.y);
                const playerToCell = Math.hypot(cx - p.x, cy - p.y);
                const enemyToPlayer = Math.hypot(e.x - p.x, e.y - p.y);
                const isBetween = playerToCell < enemyToPlayer;
                const crowdPenalty = crowdedCount * 26 + (crowdedCount >= 3 ? 80 : 0);
                const score = toEnemy - (isBetween ? 26 : 0) + crowdPenalty;

                coverCandidates.push({ x: coverX, y: coverY, score, blockIdx });
              });
            });

            if (coverCandidates.length > 0) {
              coverCandidates.sort((a, b) => a.score - b.score);
              const selected = coverCandidates[0];
              if (Number.isInteger(e._coverBlockIdx) && e._coverBlockIdx >= 0) {
                const prev = basicCoverCrowding.get(e._coverBlockIdx) || 0;
                if (prev > 0) basicCoverCrowding.set(e._coverBlockIdx, prev - 1);
              }
              e._coverTarget = selected;
              e._coverBlockIdx = selected.blockIdx;
              basicCoverCrowding.set(selected.blockIdx, (basicCoverCrowding.get(selected.blockIdx) || 0) + 1);
              e._coverRetarget = 28 + Math.floor(Math.random() * 22);
              e._coverDashTimer = 5 + Math.floor(Math.random() * 6);
            }
          }

          if (e._coverTarget) {
            const dx = e._coverTarget.x - e.x;
            const dy = e._coverTarget.y - e.y;
            const len = Math.hypot(dx, dy) || 1;
            const baseSpd = Math.hypot(e.vx, e.vy) || 1;
            const dashMult = (e._coverDashTimer || 0) > 0 ? 1.7 : 1.18;
            const targetVx = (dx / len) * (baseSpd * dashMult);
            const targetVy = (dy / len) * (baseSpd * dashMult);
            e._coverVx = Number.isFinite(e._coverVx) ? e._coverVx + (targetVx - e._coverVx) * 0.22 : targetVx;
            e._coverVy = Number.isFinite(e._coverVy) ? e._coverVy + (targetVy - e._coverVy) * 0.22 : targetVy;
            e.x += e._coverVx;
            e.y += e._coverVy;

            e._coverDashTimer = Math.max(0, (e._coverDashTimer || 0) - 1);
            if (len < 10) {
              // Gentle drift while in cover to avoid visible jitter.
              const idlePhase = (e._coverIdlePhase || Math.random() * Math.PI * 2) + 0.18;
              e._coverIdlePhase = idlePhase;
              e.x += Math.sin(idlePhase) * 0.28;
              e.y += 0.08;
            }
          } else {
            e._coverVx = (e._coverVx || 0) * 0.78;
            e._coverVy = (e._coverVy || 0) * 0.78;
            e.x += e.vx;
            e.y += e.vy;
          }

          const moved = Math.hypot((e.x - (e._prevX ?? e.x)), (e.y - (e._prevY ?? e.y)));
          e._stuckFrames = moved < 0.35 ? (e._stuckFrames || 0) + 1 : 0;
          if ((e._stuckFrames || 0) > 45) {
            e._coverTarget = null;
            e._coverBlockIdx = null;
            e._coverRetarget = 0;
            e._coverDashTimer = 0;
            e._coverVx = 0;
            e._coverVy = 0;
            e._coverIdlePhase = undefined;
            e._stuckFrames = 0;
            e.hideMode = false;
            e._hideCooldown = 55;
          }
        } else {
          e.x += e.vx;
          e.y += e.vy;
          if (e._hideCooldown <= 0 && hasCover && Math.random() < 0.04) e.hideMode = true;
        }
        e._prevX = e.x;
        e._prevY = e.y;
        if (e.x < 20) { e.x = 20; e.vx = Math.abs(e.vx); }
        else if (e.x > W - 20) { e.x = W - 20; e.vx = -Math.abs(e.vx); }
        if (e.y < 20) { e.y = 20; e.vy = Math.abs(e.vy); }
        if (e.y > H - 20) { e.y = H - 20; e.vy = -Math.abs(e.vy); }
      }
    });

    const consumeBounceCharge = (b) => {
      if (b.type !== 'bounce') return true;
      if (b._bounceChargeSpent) return true;
      const remaining = Number(b.bouncesLeft) || 0;
      if (remaining <= 0) {
        b.hit = true;
        return false;
      }
      b.bouncesLeft = remaining - 1;
      b._bounceChargeSpent = true;
      return true;
    };

    // Move bullets
    s.bullets = s.bullets.filter(b => {
      b._bounceChargeSpent = false;
      b.prevX = b.x;
      b.prevY = b.y;
      b.x += b.vx; b.y += b.vy;
      if (b.type === 'photon') {
        b.orbitAngle = ((b.orbitAngle || 0) + 0.25);
        // Tier 10 super orbit: orbiting mini-orbs that spin around the bullet as it moves forward
        if (b.isSuperOrbit) b.orbitPhase = ((b.orbitPhase || 0) + 0.18);
      }
      if (b.type === 'missile') {
        if ((b.homingDelay || 0) > 0) {
          b.homingDelay = Math.max(0, (b.homingDelay || 0) - 1);
        } else {
          const liveEnemies = s.enemies.filter(e => !e.dead && e.type !== 'dropper' && isEnemyVisibleForTargeting(e));
          if (liveEnemies.length > 0) {
            let target = b.preferredTarget && !b.preferredTarget.dead && isEnemyVisibleForTargeting(b.preferredTarget) ? b.preferredTarget : null;
            if (!target) {
              let best = Infinity;
              liveEnemies.forEach(e => {
                const d = Math.hypot(e.x - b.x, e.y - b.y);
                if (d < best) { best = d; target = e; }
              });
              b.preferredTarget = target || null;
            }
            if (target) {
              const speed = b.speed || Math.hypot(b.vx, b.vy) || 7;
              const desired = Math.atan2(target.y - b.y, target.x - b.x);
              const current = Math.atan2(b.vy, b.vx);
              let delta = desired - current;
              while (delta > Math.PI) delta -= Math.PI * 2;
              while (delta < -Math.PI) delta += Math.PI * 2;
              const maxTurn = b.maxTurnRate || 0.13;
              const next = current + Math.max(-maxTurn, Math.min(maxTurn, delta));
              b.vx = Math.cos(next) * speed;
              b.vy = Math.sin(next) * speed;
              b.speed = speed;
            }
          }
        }
      }
      if (b.type === 'bounce') {
        let bounced = false;
        if (b.x <= 0 || b.x >= W) {
          b.vx *= -1;
          b.x = Math.max(1, Math.min(W - 1, b.x));
          bounced = true;
        }
        if (b.y <= 0) {
          b.vy *= -1;
          b.y = Math.max(1, b.y);
          bounced = true;
        } else if (b.y >= H) {
          b.vy *= -1;
          b.y = Math.min(H - 1, b.y);
          bounced = true;
        }
        if (bounced && !consumeBounceCharge(b)) {
          releaseBullet(s, b);
          return false;
        }
      }
      const keep = b.y > -20 && b.y < H + 20 && b.x > -20 && b.x < W + 20;
      if (!keep) releaseBullet(s, b);
      return keep;
    });

    // Enemy fire — dropper, mine, eater, and glutton do NOT fire.
    s.enemies.forEach(e => {
      if (e.type === 'dropper' || e.type === 'mine' || e.type === 'eater' || e.type === 'glutton') return;
      e.fireTimer--;
      if (e.fireTimer <= 0) {
        const dx = p.x - e.x, dy = p.y - e.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        if (e.type === 'boss') {
          if ((e.wave || 0) === 15) {
            // Beholder lasers are updated continuously in the movement block.
            e.fireTimer = e._enraged ? 10 : 16;
            return;
          } else if ((e.wave || 0) === 10) {
            // Dreadnought: top-mounted curving missiles, strong curve but dodgeable.
            const count = e._enraged ? 5 : 3;
            for (let mi = 0; mi < count; mi++) {
              const lane = mi - (count - 1) / 2;
              const a = -Math.PI / 2 + lane * (e._enraged ? 0.2 : 0.14);
              acquireBullet(s, {
                x: e.x + lane * 16,
                y: e.y - 28,
                vx: Math.cos(a) * (e._enraged ? 5.1 : 4.2),
                vy: Math.sin(a) * (e._enraged ? 5.1 : 4.2),
                boss: true,
                dreadMissile: true,
                dreadMissileColor: '#66ff66',
                missileTurnRate: 0.055,
                missileDrift: (Math.random() * 2 - 1) * 0.03,
              }, 'enemy');
            }
          } else {
            const gun = e.gun || 'spread';
            if (gun === 'spread') {
            // Wide spread shotgun burst
            const spreadAngles = e._enraged
              ? ((e.wave || 0) === 5
                  ? [-85, -70, -55, -40, -25, -10, 0, 10, 25, 40, 55, 70, 85]
                  : [-60, -45, -30, -15, 0, 15, 30, 45, 60])
              : ((e.wave || 0) === 5
                  ? [-70, -50, -30, -15, 0, 15, 30, 50, 70]
                  : [-40, -25, -10, 0, 10, 25, 40]);
            spreadAngles.forEach(angle => {
              const rad = (angle * Math.PI) / 180;
              const bvx = (dx / len) * 4;
              const bvy = (dy / len) * 4;
              const sidePower = (e.wave || 0) === 5 ? 3.8 : 3;
              const forwardSpread = (e.wave || 0) === 5 ? 0.8 : 0.5;
              acquireBullet(s, { x: e.x, y: e.y, vx: bvx + Math.sin(rad) * sidePower, vy: bvy + Math.cos(rad) * forwardSpread, boss: true }, 'enemy');
            });
            // Fang boss occasionally starts a spiraling bounce attack
            if ((e.wave || 0) === 5 && Math.random() < 0.35) {
              e._fangSpiralActive = true;
              e._fangSpiralAngle = 0;
              e._fangSpiralCount = 0;
            }
            } else if (gun === 'laser') {
            // Tight laser burst — enraged adds side channels
            const lanes = e._enraged ? [-2, -1, 0, 1, 2] : [0, 1, 2];
            lanes.forEach((lane, li) => {
              const angle = Math.atan2(dy, dx) + lane * (e._enraged ? 0.12 : 0.05);
              const spd = e._enraged ? 7.5 : 6.5;
              acquireBullet(s, { x: e.x + lane * 4, y: e.y + li * 4, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd, boss: true }, 'enemy');
            });
            } else if (gun === 'photon') {
            // Big slow plasma orb (enraged: twin orbs)
            const orbCount = e._enraged ? 2 : 1;
            for (let oi = 0; oi < orbCount; oi++) {
              const side = orbCount === 1 ? 0 : (oi === 0 ? -14 : 14);
              acquireBullet(s, { x: e.x + side, y: e.y, vx: (dx / len) * 2.8, vy: (dy / len) * 2.8, boss: true, big: true }, 'enemy');
            }
            } else if (gun === 'bounce') {
            // Bouncing bullets at wide angles
            (e._enraged ? [-70, -45, -20, 0, 20, 45, 70] : [-50, -20, 0, 20, 50]).forEach(angle => {
              const rad = (angle * Math.PI) / 180;
              acquireBullet(s, { x: e.x, y: e.y, vx: (dx / len) * 4 + Math.sin(rad) * 3.5, vy: (dy / len) * 4, boss: true, bouncing: true, bouncesLeft: 3 }, 'enemy');
            });
            }
          }

          if (e._enraged && (e.wave || 0) !== 15) {
            [-35, 0, 35].forEach(angle => {
              const base = Math.atan2(dy, dx);
              const a = base + (angle * Math.PI) / 180;
              acquireBullet(s, {
                x: e.x,
                y: e.y,
                vx: Math.cos(a) * 5.2,
                vy: Math.sin(a) * 5.2,
                boss: true,
              }, 'enemy');
            });
          }

          const bt2 = e.tier || 1;
          if ((e.wave || 0) === 5) {
            e.fireTimer = Math.max(30, 72 - bt2 * 3) - (e._enraged ? 18 : 0);
          } else if ((e.wave || 0) === 10) {
            e.fireTimer = Math.max(24, 62 - bt2 * 2) - (e._enraged ? 14 : 0);
          } else if ((e.wave || 0) === 15) {
            e.fireTimer = e._enraged ? 7 : 16;
          } else {
            e.fireTimer = Math.max(10, 35 - bt2 * 4) - (e._enraged ? 12 : 0);
          }
        } else {
          const bspd = 2;
          acquireBullet(s, { x: e.x, y: e.y, vx: (dx / len) * bspd, vy: (dy / len) * bspd }, 'enemy');
          e._elitePhotonTimer = (e._elitePhotonTimer || randomBetween(80, 150)) - 1;
          if (e.type === 'elite' && e._elitePhotonTimer <= 0) {
            acquireBullet(s, {
              x: e.x,
              y: e.y,
              vx: (dx / len) * 3.4,
              vy: (dy / len) * 3.4,
              elitePhoton: true,
              big: true,
            }, 'enemy');
            e._elitePhotonTimer = randomBetween(100, 170);
          }
          e.fireTimer = s.wave > 3 ? 50 : 70;
        }

        // Fang spiral attack: fire one bouncing shot per frame in a spiral
        if (e._fangSpiralActive && e.type === 'boss' && (e.wave || 0) === 5) {
          const dx = p.x - e.x;
          const dy = p.y - e.y;
          const baseAngle = Math.atan2(dy, dx);
          const spiralAngle = baseAngle + e._fangSpiralAngle;
          const speed = 4.5;
          acquireBullet(s, {
            x: e.x + Math.cos(spiralAngle) * 20,
            y: e.y + Math.sin(spiralAngle) * 20,
            vx: Math.cos(spiralAngle) * speed,
            vy: Math.sin(spiralAngle) * speed,
            type: 'bounce',
            boss: true,
            bouncing: true,
            bouncesLeft: Infinity,
            fangBounce: true,
          }, 'enemy');
          e._fangSpiralAngle += Math.PI / 6; // 30 degree increments for spiral
          e._fangSpiralCount++;
          if (e._fangSpiralCount >= 12) {
            e._fangSpiralActive = false; // Stop after 12 shots
          }
        }
      }
    });

    s.enemyBullets = s.enemyBullets.filter(b => {
      b.x += b.vx; b.y += b.vy;
      if (b.beholderTrack) {
        const tdx = p.x - b.x;
        const tdy = p.y - b.y;
        const desired = Math.atan2(tdy, tdx);
        const current = Math.atan2(b.vy, b.vx);
        let delta = desired - current;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        const turn = b.trackStrength || 0.06;
        const speed = Math.hypot(b.vx, b.vy) || 4.2;
        const nextA = current + Math.max(-turn, Math.min(turn, delta));
        b.vx = Math.cos(nextA) * speed;
        b.vy = Math.sin(nextA) * speed;
      }
      if (b.dreadMissile) {
        const tdx = p.x - b.x;
        const tdy = p.y - b.y;
        const desired = Math.atan2(tdy, tdx);
        const current = Math.atan2(b.vy, b.vx);
        let delta = desired - current;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        const turn = b.missileTurnRate || 0.05;
        const speed = Math.hypot(b.vx, b.vy) || 4.2;
        const drift = b.missileDrift || 0;
        const nextA = current + Math.max(-turn, Math.min(turn, delta)) + drift;
        b.vx = Math.cos(nextA) * speed;
        b.vy = Math.sin(nextA) * speed;
      }
      if (b.bouncing) {
        const unlimitedBounce = b.fangBounce || b.bouncesLeft === Infinity;
        const canBounce = unlimitedBounce || b.bouncesLeft > 0;
        if (canBounce && (b.x < 0 || b.x > W)) {
          b.vx *= -1;
          b.x = Math.max(0, Math.min(W, b.x));
          if (!unlimitedBounce) b.bouncesLeft--;
        }
        if (canBounce && (b.y < 0 || b.y > H)) {
          b.vy *= -1;
          b.y = Math.max(0, Math.min(H, b.y));
          if (!unlimitedBounce) b.bouncesLeft--;
        }
      }
      const keep = b.y < H + 20 && b.x > -20 && b.x < W + 20 && b.y > -20;
      if (!keep) releaseBullet(s, b);
      return keep;
    });

    // ── Tetris blocks ─────────────────────────────────────────
    s.blockSpawnTimer--;
    if (s.blockSpawnTimer <= 0) {
      s.blocks.push(spawnBlock(W, s.wave));
      const blockSpeedMult = (difficultyConfigRef.current && difficultyConfigRef.current.blockSpeedMult) || 1;
      const blockSpawnMult = (difficultyConfigRef.current && difficultyConfigRef.current.blockSpawnMult) || (blockSpeedMult > 2 ? 2.2 : blockSpeedMult > 1 ? 1.6 : 1);
      s.blockSpawnTimer = Math.max(18, Math.round((160 - s.wave * 8) / (blockSpeedMult * blockSpawnMult)));
    }

    // Move blocks, check piling
    s.blocks.forEach(block => {
      if (block.settled) return;
      block.y += block.vy;
      const blockSpinEnabled = (difficultyConfigRef.current?.blockSpin) !== false;
      block.rot = blockSpinEnabled
        ? (block.rot || 0) + ((block.rotSpeed || 0) * (0.8 + block.vy * 0.12))
        : (block.rot || 0) * 0.85; // smoothly snap to 0 when spin is disabled

      // Check if any cell would land on bottom or on a piled cell
      const cells = getBlockCells(block);
      let shouldSettle = false;
      cells.forEach(cell => {
        if (cell.y + BLOCK_SIZE >= H) { shouldSettle = true; }
        // Check collision with piled cells
        s.piledCells.forEach(pc => {
          if (Math.abs(cell.x - pc.x) < BLOCK_SIZE * 0.8 && Math.abs((cell.y + BLOCK_SIZE) - pc.y) < 4) {
            shouldSettle = true;
          }
        });
      });

      if (shouldSettle) {
        block.settled = true;
        // Push cells to piledCells, snapped to grid
        cells.forEach(cell => {
          // Snap y to bottom
          const snappedY = Math.min(Math.round(cell.y / BLOCK_SIZE) * BLOCK_SIZE, H - BLOCK_SIZE);
          s.piledCells.push({
            x: Math.round(cell.x / BLOCK_SIZE) * BLOCK_SIZE,
            y: snappedY,
            color: block.color,
            invulnerable: !!block.invulnerable,
          });
        });
      }
    });
    s.blocks = s.blocks.filter(b => !b.settled);

    // Piled cells — cap at 200 to prevent memory/perf issues at high waves (remove oldest)
    if (s.piledCells.length > 200) s.piledCells = s.piledCells.slice(-200);
    s.piledCells = s.piledCells.filter(c => c.y < H);

    // Helper: explode a spread bullet into pellets
    function explodeSpread(b, newBullets) {
      if (b.type !== 'spread') return;
      const { pelletCount = 7, spreadDeg = 50 } = b;
      for (let i = 0; i < pelletCount; i++) {
        const angle = -spreadDeg / 2 + (spreadDeg / (pelletCount - 1)) * i;
        const rad = (angle * Math.PI) / 180;
        newBullets.push({ x: b.x, y: b.y, vx: Math.sin(rad) * 5, vy: -Math.cos(rad) * 6, type: 'spreadPellet' });
      }
    }

    // Consume one photon pierce charge on non-enemy impacts.
    // Returns true when the projectile should continue traveling.
    function consumePhotonPierce(b) {
      if (b.type !== 'photon') return false;
      if (b.infinitePierce) return true;
      const remaining = Number(b.pierceCount) || 0;
      if (remaining <= 0) return false;
      b.pierceCount = remaining - 1;
      return true;
    }

    function segmentHitsCell(x1, y1, x2, y2, cell) {
      const left = cell.x;
      const right = cell.x + BLOCK_SIZE;
      const top = cell.y;
      const bottom = cell.y + BLOCK_SIZE;

      if (x2 >= left && x2 <= right && y2 >= top && y2 <= bottom) return true;

      let t0 = 0;
      let t1 = 1;
      const dx = x2 - x1;
      const dy = y2 - y1;

      const clip = (p, q) => {
        if (p === 0) return q >= 0;
        const r = q / p;
        if (p < 0) {
          if (r > t1) return false;
          if (r > t0) t0 = r;
        } else {
          if (r < t0) return false;
          if (r < t1) t1 = r;
        }
        return true;
      };

      return clip(-dx, x1 - left)
        && clip(dx, right - x1)
        && clip(-dy, y1 - top)
        && clip(dy, bottom - y1)
        && t1 >= t0;
    }

    // ── Bullet vs enemy ───────────────────────────────────────
    const piercingTypes = [];
    const newSpreadPellets = [];
    const isEnemyVisibleForBulletCollision = (enemy) => {
      const halfW = Math.max(10, enemy?.w || 18);
      const halfH = Math.max(10, enemy?.h || 18);
      return enemy.x + halfW >= 0
        && enemy.x - halfW <= W
        && enemy.y + halfH >= 0
        && enemy.y - halfH <= H;
    };

    const isBulletHittingEnemy = (bullet, enemy) => {
      const dx = bullet.x - enemy.x;
      const dy = bullet.y - enemy.y;

      if (enemy.type === 'glutton') {
        // Glutton uses a circular collision area to match the sprite body
        // and avoid oversized square clipping around transparent sprite edges.
        const baseRadius = Math.max(16, Math.max(enemy.w || 94, enemy.h || 94) * 0.36);
        const consumeBonus = Math.min(enemy._absorbedUnits || 0, 36) * 0.45;
        const radius = baseRadius + consumeBonus;
        return (dx * dx + dy * dy) <= radius * radius;
      }

      return Math.abs(dx) < (enemy.w || 18) && Math.abs(dy) < (enemy.h || 18);
    };

    const ricochetBounceFromEnemy = (bullet, enemy) => {
      const dx = bullet.x - enemy.x;
      const dy = bullet.y - enemy.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = dx / len;
      const ny = dy / len;
      const dot = bullet.vx * nx + bullet.vy * ny;
      bullet.vx = bullet.vx - 2 * dot * nx;
      bullet.vy = bullet.vy - 2 * dot * ny;
      const pushOut = Math.max(enemy.w || 20, enemy.h || 20) + 8;
      bullet.x = enemy.x + nx * pushOut;
      bullet.y = enemy.y + ny * pushOut;
      return consumeBounceCharge(bullet);
    };

    s.bullets.forEach(b => {
      if (b.hit) return;
      s.enemies.forEach(e => {
        if (b.hit) return;
        if (e.dead) return;
        if (!isEnemyVisibleForBulletCollision(e)) return;
        if (e.type === 'boss' && (e.wave || 0) === 15 && e._shieldActive) {
          const shieldRadius = getBeholderShieldRadius(e);
          const distToBoss = Math.hypot(b.x - e.x, b.y - e.y);
          if (distToBoss < shieldRadius && distToBoss > Math.max(e.w, e.h)) {
            if (b.type === 'bounce' && (b.bouncesLeft || 0) > 0) {
              const chargeLeft = ricochetBounceFromEnemy(b, e);
              spawnExplosion(s, b.x, b.y, '#ff6633', 5);
              if (!chargeLeft) b.hit = true;
            } else {
              b.hit = true;
              spawnExplosion(s, b.x, b.y, '#ff6633', 5);
            }
            return;
          }
        }
        // Pirate shield pre-check — intercept bullets while they are in the
        // shield zone (~206px out), before they ever reach the boss body.
        if (e.type === 'boss' && (e.wave || 0) === 20 && e._armorBlocks?.length > 0) {
          if (consumePirateShieldPiece(s, e, b.x, b.y, getProjectileImpactColor(b.type))) {
            if (b.type === 'bounce' && (b.bouncesLeft || 0) > 0) {
              const chargeLeft = ricochetBounceFromEnemy(b, e);
              spawnExplosion(s, b.x, b.y, getProjectileImpactColor(b.type), 4);
              if (!chargeLeft) b.hit = true;
            } else {
              b.hit = true;
            }
            return;
          }
        }
        if (isBulletHittingEnemy(b, e)) {
          if (b.type === 'spread') { explodeSpread(b, newSpreadPellets); b.hit = true; return; }
          // Photon pierce: skip enemies already pierced, consume one pierce count.
          // Tier 10 photons are infinite-pierce and never consume this count.
          if (b.type === 'photon' && (b.infinitePierce || b.pierceCount > 0)) {
            if (b.piercedEnemies && b.piercedEnemies.includes(e)) return;
            b.piercedEnemies = b.piercedEnemies || [];
            b.piercedEnemies.push(e);
            if (!b.infinitePierce) b.pierceCount--;
            if (consumePirateShieldPiece(s, e, b.x, b.y, getProjectileImpactColor(b.type))) {
              if (b.type === 'bounce' && (b.bouncesLeft || 0) > 0) {
                const chargeLeft = ricochetBounceFromEnemy(b, e);
                spawnExplosion(s, b.x, b.y, getProjectileImpactColor(b.type), 4);
                if (!chargeLeft) b.hit = true;
              } else {
                b.hit = true;
              }
              return;
            }
            const hitDamage = (e.type === 'eater' && (e._growthStage === 0 || e._mini)) ? eaterTuning.miniHitDamage : 1;
            e.hp -= hitDamage;
            sounds.hit();
            spawnExplosion(s, e.x, e.y, getProjectileImpactColor(b.type), 4);
            if (e.hp <= 0) {
              e.dead = true;
              const pts = e.type === 'boss' ? 5000 : e.type === 'dropper' ? 500 : e.type === 'elite' ? 300 : e.type === 'mine' ? 300 : e.type === 'eater' ? 800 : 100;
              s.score += pts; onScoreChange(s.score); sounds.kill();
              spawnExplosion(s, e.x, e.y, e.type === 'boss' ? '#ff0066' : getProjectileImpactColor(b.type), e.type === 'boss' ? 40 : 14);
              if (e.type === 'dropper') { sounds.killDropper(); spawnFloatingPowerup(s, e.x, e.y, e.dropType); }
              if (e.type === 'boss') { 
                sounds.stopBossMusic(); sounds.waveComplete(); grantBossLifeReward(s);
                // In boss mode, drop 3 random gun powerups after defeating a boss
                if (bossModeRef.current) {
                  const guns = ['spread', 'laser', 'photon', 'bounce', 'missile'];
                  const shuffled = [...guns].sort(() => Math.random() - 0.5);
                  const splitPaths = [
                    { xOff: -28, vx: -1.9, vy: -1.1, floatSpeed: 0.092, spin: -0.022 },
                    { xOff: 0, vx: 0.0, vy: -1.35, floatSpeed: 0.071, spin: 0.0 },
                    { xOff: 28, vx: 1.9, vy: -1.1, floatSpeed: 0.086, spin: 0.022 },
                  ];
                  shuffled.slice(0, 3).forEach((gunType, idx) => {
                    const path = splitPaths[idx] || splitPaths[1];
                    spawnFloatingPowerup(s, e.x + path.xOff, e.y - 20, gunType, {
                      vx: path.vx,
                      vy: path.vy,
                      floatSpeed: path.floatSpeed,
                      spin: path.spin,
                      floatAmpX: 0.2,
                      floatAmpY: 0.16,
                    });
                  });
                }
              }
            }
            return; // don't mark b.hit, allow continued travel
          }
          if (consumePirateShieldPiece(s, e, b.x, b.y, getProjectileImpactColor(b.type))) {
            if (b.type === 'bounce' && (b.bouncesLeft || 0) > 0) {
              const chargeLeft = ricochetBounceFromEnemy(b, e);
              spawnExplosion(s, b.x, b.y, getProjectileImpactColor(b.type), 4);
              if (!chargeLeft) b.hit = true;
            } else {
              b.hit = true;
            }
            return;
          }
          const hitDamage = (e.type === 'eater' && (e._growthStage === 0 || e._mini)) ? eaterTuning.miniHitDamage : 1;
          e.hp -= hitDamage;
          sounds.hit();
          if (b.type === 'missile') {
            // Missile impact: brighter, larger burst so the hit reads as intentional.
            spawnExplosion(s, b.x, b.y, '#ff00ff', 12);
            spawnExplosion(s, b.x, b.y, '#ffd6ff', 8);
            s.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, r: 8, alpha: 0.85, color: '#ff66ff', shockwave: true, shockwaveR: 5 });
            b.hit = true;
          } else {
            spawnExplosion(s, b.x, b.y, getProjectileImpactColor(b.type), 3);
          }
          if (b.type === 'bounce' && (b.bouncesLeft || 0) > 0) {
            const chargeLeft = ricochetBounceFromEnemy(b, e);
            b.vx += (Math.random() - 0.5) * 0.8;
            if (!chargeLeft) b.hit = true;
          } else if (b.type !== 'missile') {
            b.hit = true;
          }
          // Mine: immediately charge at player on first hit (hp goes from 3 to 2)
          if (e.type === 'mine' && e.hp === e.maxHp - 1 && !e._charging) {
            const dx = p.x - e.x, dy = p.y - e.y;
            const len = Math.hypot(dx, dy) || 1;
            e._chargeDx = dx / len; e._chargeDy = dy / len;
            e._charging = true; e._chargeDuration = 45;
            e._chargeTimer = randomBetween(60, 120);
            e._rechargeCooldown = 0;
          }
          if (e.hp <= 0) {
            e.dead = true;
            // Mine AoE explosion on death
            if (e.type === 'mine') {
              const MINE_RADIUS = 160;
              spawnExplosion(s, e.x, e.y, '#ff8800', 60);
              spawnExplosion(s, e.x, e.y, '#ffdd00', 35);
              spawnExplosion(s, e.x, e.y, '#ffffff', 15);
              s.particles.push({ x: e.x, y: e.y, vx: 0, vy: 0, r: 10, alpha: 1, color: '#ff8800', shockwave: true, shockwaveR: 10 });
              s.particles.push({ x: e.x, y: e.y, vx: 0, vy: 0, r: 10, alpha: 0.7, color: '#ffdd00', shockwave: true, shockwaveR: 5 });
              s.enemies.forEach(ne => {
                if (ne === e || ne.dead) return;
                if (Math.hypot(ne.x - e.x, ne.y - e.y) < MINE_RADIUS) {
                  ne.hp -= 3;
                  spawnExplosion(s, ne.x, ne.y, '#ff8800', 12);
                  if (ne.hp <= 0) ne.dead = true;
                }
              });
              if (Math.hypot(p.x - e.x, p.y - e.y) < MINE_RADIUS) {
                const savedStar = s.starInvincibleTimer;
                s.starInvincibleTimer = 0;
                takeDamage(s);
                s.starInvincibleTimer = savedStar;
                spawnExplosion(s, p.x, p.y, '#ff8800', 18);
              }
            }
            const pts = e.type === 'boss' ? 5000 : e.type === 'dropper' ? 500 : e.type === 'elite' ? 300 : e.type === 'mine' ? 300 : e.type === 'eater' ? 800 : 100;
            s.score += pts;
            onScoreChange(s.score);
            sounds.kill();
            spawnExplosion(s, e.x, e.y,
              e.type === 'boss' ? '#ff0066' : getProjectileImpactColor(b.type),
              e.type === 'boss' ? 40 : e.type === 'mine' ? 30 : e.type === 'eater' ? 20 : 14
            );
            if (e.type === 'dropper') {
              sounds.killDropper();
              spawnFloatingPowerup(s, e.x, e.y, e.dropType);
            }
            if (e.type === 'boss') {
              sounds.stopBossMusic();
              sounds.waveComplete();
              grantBossLifeReward(s);
            }
          }
        }
      });
    });

    // Glutton segment hit detection — separate from head so each link has its own HP.
    s.bullets.forEach(b => {
      if (b.hit) return;
      s.enemies.forEach(e => {
        if (e.dead || e.type !== 'glutton') return;
        if (!Array.isArray(e._segmentPositions)) return;
        if (!Array.isArray(e._segmentHp)) e._segmentHp = [];
        const segRadius = Math.max(14, (e.w || 94) * 0.34);
        const segRadiusSq = segRadius * segRadius;
        for (let si = 0; si < e._segmentPositions.length; si++) {
          const seg = e._segmentPositions[si];
          if (!seg) continue;
          const sdx = b.x - seg.x;
          const sdy = b.y - seg.y;
          if (sdx * sdx + sdy * sdy > segRadiusSq) continue;
          // Initialise HP lazily in case the segment pre-dates this feature.
          if (!(e._segmentHp[si] > 0)) e._segmentHp[si] = Math.max(8, Math.min(28, Math.round((e.maxHp || 80) * 0.12)));
          e._segmentHp[si] -= 1;
          sounds.hit();
          spawnExplosion(s, b.x, b.y, '#7cff6a', 5);
          if (b.type === 'photon') {
            if (!consumePhotonPierce(b)) b.hit = true;
          } else if (b.type === 'bounce' && (b.bouncesLeft || 0) > 0) {
            const chargeLeft = ricochetBounceFromEnemy(b, e);
            b.vx += (Math.random() - 0.5) * 0.8;
            if (!chargeLeft) b.hit = true;
          } else if (b.type !== 'missile') {
            b.hit = true;
          } else {
            spawnExplosion(s, b.x, b.y, '#ff00ff', 12);
            spawnExplosion(s, b.x, b.y, '#ffd6ff', 8);
            b.hit = true;
          }
          if (e._segmentHp[si] <= 0) {
            spawnExplosion(s, seg.x, seg.y, '#7cff6a', 20);
            spawnExplosion(s, seg.x, seg.y, '#ffffff', 8);
            s.score += 200;
            onScoreChange(s.score);
            sounds.kill();
            e._segmentPositions.splice(si, 1);
            e._segmentHp.splice(si, 1);
            e._segmentCount = Math.max(0, (e._segmentCount || 1) - 1);
          }
          return; // one segment hit per bullet per enemy
        }
      });
    });

    // Add spread pellets spawned from enemy hits
    newSpreadPellets.forEach(p => acquireBullet(s, p, 'player'));

    // Bullet vs tetris blocks
    const newSpreadPelletsFromBlocks = [];
    s.bullets.forEach(b => {
      if (b.hit) return;
      s.blocks.forEach(block => {
        if (block.dead) return;
        const cells = getBlockCells(block);
        cells.forEach(cell => {
          if (b.hit) return;
          if (!isCellOnStage(cell, W, H)) return;
          const directHit = b.x >= cell.x && b.x <= cell.x + BLOCK_SIZE && b.y >= cell.y && b.y <= cell.y + BLOCK_SIZE;
          const sweptHit = b.type === 'missile' && segmentHitsCell(b.prevX ?? b.x, b.prevY ?? b.y, b.x, b.y, cell);
          if (directHit || sweptHit) {
            if (b.type === 'spread') { explodeSpread(b, newSpreadPelletsFromBlocks); b.hit = true; return; }
            if (block.invulnerable) {
              if (b.type === 'missile') {
                spawnExplosion(s, b.x, b.y, '#ff00ff', 12);
                spawnExplosion(s, b.x, b.y, '#ffd6ff', 8);
                s.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, r: 8, alpha: 0.85, color: '#ff66ff', shockwave: true, shockwaveR: 5 });
                b.hit = true;
              } else if (b.type === 'bounce') {
                const leftDist = Math.abs(b.x - cell.x);
                const rightDist = Math.abs((cell.x + BLOCK_SIZE) - b.x);
                const topDist = Math.abs(b.y - cell.y);
                const bottomDist = Math.abs((cell.y + BLOCK_SIZE) - b.y);
                const minSide = Math.min(leftDist, rightDist, topDist, bottomDist);

                if (minSide === leftDist || minSide === rightDist) {
                  b.vx *= -1;
                  b.x += Math.sign(b.vx || 1) * 2;
                } else {
                  b.vy *= -1;
                  b.y += Math.sign(b.vy || -1) * 2;
                }

                consumeBounceCharge(b);
                spawnExplosion(s, b.x, b.y, getProjectileImpactColor(b.type), 4);
              } else {
                spawnExplosion(s, b.x, b.y, getProjectileImpactColor(b.type), 3);
                if (b.type === 'photon') {
                  if (!consumePhotonPierce(b)) b.hit = true;
                } else {
                  b.hit = true;
                }
              }
              return;
            } else {
              // Photon deals 2 damage to blocks; others deal 1
              if (b.type === 'missile') {
                block.hp -= 2;
                spawnExplosion(s, b.x, b.y, '#ff00ff', 12);
                spawnExplosion(s, b.x, b.y, '#ffd6ff', 8);
                s.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, r: 8, alpha: 0.85, color: '#ff66ff', shockwave: true, shockwaveR: 5 });
                b.hit = true;
              } else {
                block.hp -= b.type === 'photon' ? 2 : 1;
                spawnExplosion(s, b.x, b.y, getProjectileImpactColor(b.type), 3);
              }
              if (b.type === 'bounce' && (b.bouncesLeft || 0) > 0) {
                const leftDist = Math.abs(b.x - cell.x);
                const rightDist = Math.abs((cell.x + BLOCK_SIZE) - b.x);
                const topDist = Math.abs(b.y - cell.y);
                const bottomDist = Math.abs((cell.y + BLOCK_SIZE) - b.y);
                const minSide = Math.min(leftDist, rightDist, topDist, bottomDist);
                if (minSide === leftDist || minSide === rightDist) {
                  b.vx *= -1;
                  b.x += Math.sign(b.vx || 1) * 3;
                } else {
                  b.vy *= -1;
                  b.y += Math.sign(b.vy || -1) * 3;
                }
                consumeBounceCharge(b);
              } else if (b.type === 'photon') {
                if (!consumePhotonPierce(b)) b.hit = true;
              } else if (b.type !== 'missile' && !piercingTypes.includes(b.type)) {
                b.hit = true;
              }
              if (block.hp <= 0) {
                block.dead = true;
                s.score += 50;
                s.blockScore += BLOCK_CURRENCY_PER_DESTROY;
                onScoreChange(s.score);
                onBlockScoreChange(s.blockScore);
                spawnExplosion(s, block.x + BLOCK_SIZE, block.y, block.color, 8);
              }
            }
          }
        });
      });
    });
    newSpreadPelletsFromBlocks.forEach(p => acquireBullet(s, p, 'player'));
    s.blocks = s.blocks.filter(b => !b.dead);

    // Bullet vs piled cells
    const newSpreadPelletsFromPiled = [];
    s.bullets.forEach(b => {
      if (b.hit) return;
      s.piledCells = s.piledCells.filter(cell => {
        if (!isCellOnStage(cell, W, H)) return true;
        const directHit = b.x >= cell.x && b.x <= cell.x + BLOCK_SIZE && b.y >= cell.y && b.y <= cell.y + BLOCK_SIZE;
        const sweptHit = b.type === 'missile' && segmentHitsCell(b.prevX ?? b.x, b.prevY ?? b.y, b.x, b.y, cell);
        if (directHit || sweptHit) {
          if (cell.invulnerable) {
            if (b.type === 'bounce' && (b.bouncesLeft || 0) > 0) {
              b.vy *= -1;
              b.y += Math.sign(b.vy || -1) * 3;
              consumeBounceCharge(b);
            } else if (b.type === 'photon') {
              if (!consumePhotonPierce(b)) b.hit = true;
            } else {
              b.hit = true;
            }
            spawnExplosion(s, b.x, b.y, getProjectileImpactColor(b.type), 4);
            return true;
          }
          if (b.type === 'spread') { explodeSpread(b, newSpreadPelletsFromPiled); b.hit = true; }
          else if (b.type === 'missile') {
            spawnExplosion(s, b.x, b.y, '#ff00ff', 12);
            spawnExplosion(s, b.x, b.y, '#ffd6ff', 8);
            s.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, r: 8, alpha: 0.85, color: '#ff66ff', shockwave: true, shockwaveR: 5 });
            b.hit = true;
          }
          else if (b.type === 'bounce' && (b.bouncesLeft || 0) > 0) {
            b.vy *= -1;
            b.y += Math.sign(b.vy) * 3;
            consumeBounceCharge(b);
          } else if (b.type === 'photon') {
            if (!consumePhotonPierce(b)) b.hit = true;
          } else if (!piercingTypes.includes(b.type)) {
            b.hit = true;
          }
          spawnExplosion(s, b.x, b.y, getProjectileImpactColor(b.type), 4);
          return false;
        }
        return true;
      });
    });
    newSpreadPelletsFromPiled.forEach(p => acquireBullet(s, p, 'player'));

    s.bullets = s.bullets.filter(b => {
      if (!b.hit) return true;
      releaseBullet(s, b);
      return false;
    });
    s.enemies = s.enemies.filter(e => !e.dead);

    // Star invincibility countdown
    if (s.starInvincibleTimer > 0) s.starInvincibleTimer--;

    // Keep armor HP in sync with purchased armor upgrade capacity.
    // When armor level increases in the shop, refill to full immediately.
    const armorLevel = shopUpgradesRef.current?.armor || 0;
    const maxArmorFromUpgrade = armorLevel * 3;
    if (s._lastArmorMax === undefined) s._lastArmorMax = maxArmorFromUpgrade;
    if (maxArmorFromUpgrade !== s._lastArmorMax) {
      if (maxArmorFromUpgrade > s._lastArmorMax) {
        s.armorHp = maxArmorFromUpgrade;
      } else {
        s.armorHp = Math.min(s.armorHp || 0, maxArmorFromUpgrade);
      }
      s._lastArmorMax = maxArmorFromUpgrade;
      onPowerupChangeRef.current?.({ ...s.powerups, shieldHp: s.shieldHp, armorHp: s.armorHp, starInvincible: s.starInvincibleTimer > 0 });
    }

    // Floating powerups drift and bounce in both normal and boss modes.
    s.powerupItems.forEach(item => {
      if (item.vx === undefined) item.vx = randomBetween(-1.1, 1.1);
      if (item.vy === undefined) item.vy = randomBetween(-0.9, 0.9);
      if (item.spin === undefined) item.spin = randomBetween(-0.03, 0.03);
      if (item.floatT === undefined) item.floatT = randomBetween(0, Math.PI * 2);
      if (item.floatSpeed === undefined) item.floatSpeed = randomBetween(0.045, 0.085);
      if (item.floatAmpX === undefined) item.floatAmpX = randomBetween(0.08, 0.22);
      if (item.floatAmpY === undefined) item.floatAmpY = randomBetween(0.08, 0.22);

      item.floatT += item.floatSpeed;
      item.angle = (item.angle || 0) + item.spin;

      item.x += item.vx + Math.cos(item.floatT) * item.floatAmpX;
      item.y += item.vy + Math.sin(item.floatT * 1.3) * item.floatAmpY;

      const margin = 16;
      if (item.x < margin) { item.x = margin; item.vx = Math.abs(item.vx); }
      if (item.x > W - margin) { item.x = W - margin; item.vx = -Math.abs(item.vx); }
      if (item.y < margin) { item.y = margin; item.vy = Math.abs(item.vy); }
      if (item.y > H - margin) { item.y = H - margin; item.vy = -Math.abs(item.vy); }

      item.vx *= 0.998;
      item.vy *= 0.998;
    });

    // Shop upgrade effects
    const upgrades = shopUpgradesRef.current || {};
    const droneLvl = upgrades.drone || 0;
    if (droneLvl > 0) {
      if (!s._droneUnit) {
        const orbitStart = getDroneOrbitPose(p, droneLvl, Date.now());
        s._droneUnit = {
          x: orbitStart.x,
          y: orbitStart.y,
          angle: orbitStart.angle,
          targetIndex: null,
          carryingIndex: null,
          alive: true,
          respawnTimer: 0,
          _respawnFrames: 140,
        };
      }

      const drone = s._droneUnit;
      const maxDroneLevel = Math.min(droneLvl, 10);
      const moveSpeed = 2.3 + maxDroneLevel * 0.48;
      drone._respawnFrames = Math.max(60, 220 - maxDroneLevel * 14);

      if (!drone.alive) {
        drone.respawnTimer = Math.max(0, (drone.respawnTimer || 0) - 1);
        if (drone.respawnTimer <= 0) {
          const respawnPose = getDroneOrbitPose(p, droneLvl, Date.now());
          drone.x = respawnPose.x;
          drone.y = respawnPose.y;
          drone.angle = respawnPose.angle;
          drone.targetIndex = null;
          drone.carryingIndex = null;
          drone.alive = true;
        }
      }

      if (drone.alive) {
        if (drone.carryingIndex != null && !s.powerupItems[drone.carryingIndex]) {
          drone.carryingIndex = null;
        }
        if (drone.targetIndex != null && !s.powerupItems[drone.targetIndex]) {
          drone.targetIndex = null;
        }

        if (drone.carryingIndex != null) {
          const carried = s.powerupItems[drone.carryingIndex];
          const toX = p.x - drone.x;
          const toY = p.y - drone.y;
          const dist = Math.hypot(toX, toY) || 1;
          const step = Math.min(dist, moveSpeed * 1.15);
          drone.x += (toX / dist) * step;
          drone.y += (toY / dist) * step;
          drone.angle = Math.atan2(toY, toX) + Math.PI / 2;

          if (carried) {
            carried.x = drone.x;
            carried.y = drone.y;
            carried.vx = 0;
            carried.vy = 0;
          }

          if (dist < 26) {
            drone.carryingIndex = null;
          }
        } else {
          if (s.powerupItems.length > 0) {
            let bestIdx = -1;
            let bestDist = Infinity;
            s.powerupItems.forEach((item, idx) => {
              const d = Math.hypot(item.x - drone.x, item.y - drone.y);
              if (d < bestDist) {
                bestDist = d;
                bestIdx = idx;
              }
            });

            if (bestIdx >= 0) drone.targetIndex = bestIdx;

            if (drone.targetIndex != null && s.powerupItems[drone.targetIndex]) {
              const target = s.powerupItems[drone.targetIndex];
              const toX = target.x - drone.x;
              const toY = target.y - drone.y;
              const dist = Math.hypot(toX, toY) || 1;
              const step = Math.min(dist, moveSpeed);
              drone.x += (toX / dist) * step;
              drone.y += (toY / dist) * step;
              drone.angle = Math.atan2(toY, toX) + Math.PI / 2;

              if (dist < 14) {
                drone.carryingIndex = drone.targetIndex;
                drone.targetIndex = null;
              }
            }
          } else {
            const orbit = getDroneOrbitPose(p, droneLvl, Date.now());
            const toX = orbit.x - drone.x;
            const toY = orbit.y - drone.y;
            const dist = Math.hypot(toX, toY) || 1;
            const step = Math.min(dist, moveSpeed * 0.7);
            drone.x += (toX / dist) * step;
            drone.y += (toY / dist) * step;
            drone.angle = Math.atan2(toY, toX) + Math.PI / 2;
          }
        }
      }
    } else {
      s._droneUnit = null;
    }

    const harvesterLvl = upgrades.harvester || 0;
    if (harvesterLvl > 0) {
      if (!s._harvesterUnit) {
        const orbitStart = getHarvesterOrbitPose(p, harvesterLvl, Date.now());
        s._harvesterUnit = {
          x: orbitStart.x,
          y: orbitStart.y,
          angle: orbitStart.angle,
          targetType: null,
          targetRef: null,
          targetX: orbitStart.x,
          targetY: orbitStart.y,
          progress: 0,
          collectTimer: 0,
          pendingReward: 0,
          alive: true,
          respawnTimer: 0,
          _respawnFrames: 180,
        };
      }

      const harvester = s._harvesterUnit;
      const maxHarvesterLevel = Math.min(harvesterLvl, 10);
      harvester._respawnFrames = Math.max(90, 260 - maxHarvesterLevel * 10);

      if (!harvester.alive) {
        harvester.respawnTimer = Math.max(0, (harvester.respawnTimer || 0) - 1);
        if (harvester.respawnTimer <= 0) {
          const respawnPose = getHarvesterOrbitPose(p, harvesterLvl, Date.now());
          harvester.x = respawnPose.x;
          harvester.y = respawnPose.y;
          harvester.angle = respawnPose.angle;
          harvester.targetType = null;
          harvester.targetRef = null;
          harvester.progress = 0;
          harvester.collectTimer = 0;
          harvester.pendingReward = 0;
          harvester.alive = true;
        }
      }

      if (harvester.alive && harvester.collectTimer > 0) {
        harvester.collectTimer--;
        if (harvester.collectTimer <= 0 && harvester.pendingReward > 0) {
          s.blockScore += harvester.pendingReward;
          onBlockScoreChange(s.blockScore);
          sounds.powerup();
          harvester.pendingReward = 0;
        }
      }

      if (harvester.alive && harvester.collectTimer <= 0) {
      const hasBlockTarget = harvester.targetType === 'block' && harvester.targetRef && !harvester.targetRef.dead && !harvester.targetRef.invulnerable;
      const hasCellTarget = harvester.targetType === 'cell' && harvester.targetRef && s.piledCells.includes(harvester.targetRef);

      if (!hasBlockTarget && !hasCellTarget) {
        harvester.targetType = null;
        harvester.targetRef = null;
        harvester.progress = 0;

        let best = null;
        let bestDist = Infinity;

        s.blocks.forEach(block => {
          if (block.dead || block.invulnerable) return;
          const cells = getBlockCells(block);
          if (cells.length === 0) return;
          const cx = cells.reduce((sum, c) => sum + c.x + BLOCK_SIZE / 2, 0) / cells.length;
          const cy = cells.reduce((sum, c) => sum + c.y + BLOCK_SIZE / 2, 0) / cells.length;
          const d = Math.hypot(cx - harvester.x, cy - harvester.y);
          if (d < bestDist) {
            bestDist = d;
            best = { type: 'block', ref: block, x: cx, y: cy };
          }
        });

        s.piledCells.forEach(cell => {
          if (cell.invulnerable) return;
          const cx = cell.x + BLOCK_SIZE / 2;
          const cy = cell.y + BLOCK_SIZE / 2;
          const d = Math.hypot(cx - harvester.x, cy - harvester.y);
          if (d < bestDist) {
            bestDist = d;
            best = { type: 'cell', ref: cell, x: cx, y: cy };
          }
        });

        if (best) {
          harvester.targetType = best.type;
          harvester.targetRef = best.ref;
          harvester.targetX = best.x;
          harvester.targetY = best.y;
        }
      }

      if (harvester.targetType === 'block' && harvester.targetRef) {
        const cells = getBlockCells(harvester.targetRef);
        if (cells.length > 0) {
          harvester.targetX = cells.reduce((sum, c) => sum + c.x + BLOCK_SIZE / 2, 0) / cells.length;
          harvester.targetY = cells.reduce((sum, c) => sum + c.y + BLOCK_SIZE / 2, 0) / cells.length;
        }
      } else if (harvester.targetType === 'cell' && harvester.targetRef) {
        harvester.targetX = harvester.targetRef.x + BLOCK_SIZE / 2;
        harvester.targetY = harvester.targetRef.y + BLOCK_SIZE / 2;
      } else {
        const orbit = getHarvesterOrbitPose(p, harvesterLvl, Date.now());
        harvester.targetX = orbit.x;
        harvester.targetY = orbit.y;
      }

      const toX = harvester.targetX - harvester.x;
      const toY = harvester.targetY - harvester.y;
      const dist = Math.hypot(toX, toY) || 1;
      const moveSpeed = 1.8 + Math.min(harvesterLvl, 10) * 0.45;
      const step = Math.min(dist, moveSpeed);
      harvester.x += (toX / dist) * step;
      harvester.y += (toY / dist) * step;
      harvester.angle = Math.atan2(toY, toX) + Math.PI / 2;

      if (harvester.targetType && dist < 16) {
        const harvestRate = 0.6 + Math.min(harvesterLvl, 10) * 0.22;
        const harvestNeed = 12;
        harvester.progress += harvestRate;
        if (harvester.progress >= harvestNeed) {
          if (harvester.targetType === 'block' && harvester.targetRef && !harvester.targetRef.dead && !harvester.targetRef.invulnerable) {
            const cells = getBlockCells(harvester.targetRef);
            const cx = cells.length > 0 ? (cells.reduce((sum, c) => sum + c.x + BLOCK_SIZE / 2, 0) / cells.length) : harvester.x;
            const cy = cells.length > 0 ? (cells.reduce((sum, c) => sum + c.y + BLOCK_SIZE / 2, 0) / cells.length) : harvester.y;
            harvester.targetRef.hp -= 1;
            spawnExplosion(s, cx, cy, '#ff8800', 5);
            if (harvester.targetRef.hp <= 0) {
              harvester.targetRef.dead = true;
              s.score += 50;
              s.blockScore += BLOCK_CURRENCY_PER_DESTROY;
              onScoreChange(s.score);
              onBlockScoreChange(s.blockScore);
              harvester.pendingReward += BLOCK_CURRENCY_PER_HARVESTER_COLLECT;
              harvester.collectTimer = Math.max(12, 32 - Math.min(harvesterLvl, 10));
            }
          } else if (harvester.targetType === 'cell' && harvester.targetRef) {
            const cellIndex = s.piledCells.indexOf(harvester.targetRef);
            if (cellIndex >= 0) {
              const cell = s.piledCells[cellIndex];
              spawnExplosion(s, cell.x + BLOCK_SIZE / 2, cell.y + BLOCK_SIZE / 2, '#ff8800', 4);
              s.piledCells.splice(cellIndex, 1);
              s.score += 20;
              s.blockScore += BLOCK_CURRENCY_PER_PILED_CELL;
              onScoreChange(s.score);
              onBlockScoreChange(s.blockScore);
              harvester.pendingReward += Math.round(BLOCK_CURRENCY_PER_HARVESTER_COLLECT * 0.45);
              harvester.collectTimer = Math.max(10, 28 - Math.min(harvesterLvl, 10));
            }
          }

          harvester.progress = 0;
          harvester.targetType = null;
          harvester.targetRef = null;
        }
      }
      }
    } else {
      s._harvesterUnit = null;
    }

    // Player picks up powerup
    s.powerupItems = s.powerupItems.filter(item => {
      const dx = item.x - p.x, dy = item.y - p.y;
      if (Math.sqrt(dx * dx + dy * dy) < 36) {
        const pickupType = normalizePowerupType(item.type);
        if (pickupType === 'star') {
          s.starInvincibleTimer = STAR_INVINCIBLE_FRAMES;
          sounds.powerup();
        } else if (pickupType === 'shield') {
          s.shieldHp = Math.min(s.shieldHp + 1, 10);
          sounds.shield();
        } else if (pickupType === 'speed') {
          s.powerups.speed = Math.min((s.powerups.speed || 0) + 1, 10);
          sounds.powerup();
        } else if (pickupType === 'rapidfire') {
          s.powerups.rapidfire = Math.min((s.powerups.rapidfire || 0) + 1, 10);
          sounds.powerup();
        } else if (pickupType === 'wingman') {
          s.powerups.wingman = Math.min((s.powerups.wingman || 0) + 1, 10);
          sounds.powerup();
        } else {
          const isLocked = s.lockedPowerups.includes(pickupType);
          const canAdd = s.lockedPowerups.length < 6;
          if (!isLocked && !canAdd) return true;
          if (!isLocked) s.lockedPowerups.push(pickupType);
          s.powerups[pickupType] = Math.min((s.powerups[pickupType] || 0) + 1, 10);
          sounds.powerup();
        }
        onPowerupChangeRef.current?.({ ...s.powerups, shieldHp: s.shieldHp, armorHp: s.armorHp, starInvincible: s.starInvincibleTimer > 0 });
        return false;
      }
      return true;
    });

    // Player bullets vs enemy bullets collision
    const destroyedEnemyBullets = new Set();
    s.bullets.forEach(pb => {
      if (pb.hit) return;
      s.enemyBullets.forEach((eb, idx) => {
        if (pb.hit) return;
        const dx = pb.x - eb.x, dy = pb.y - eb.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (pb.type === 'photon') {
          if (dist < (pb.size || 9) + 6) {
            spawnExplosion(s, eb.x, eb.y, getProjectileImpactColor(pb.type), 3);
            destroyedEnemyBullets.add(idx);
          }
        } else if (pb.type === 'bounce' && dist < 8) {
          const canBounce = pb.bouncesLeft === Infinity || (pb.bouncesLeft || 0) > 0;
          if (canBounce) {
            if (dist > 0.0001) {
              // Reflect away from the enemy bullet so it visibly ricochets.
              const nx = dx / dist;
              const ny = dy / dist;
              const dot = pb.vx * nx + pb.vy * ny;
              pb.vx = pb.vx - 2 * dot * nx;
              pb.vy = pb.vy - 2 * dot * ny;
            } else {
              pb.vx *= -1;
              pb.vy *= -1;
            }
            pb.x += pb.vx * 0.08;
            pb.y += pb.vy * 0.08;
            consumeBounceCharge(pb);
          } else {
            pb.hit = true;
          }
          spawnExplosion(s, (pb.x + eb.x) / 2, (pb.y + eb.y) / 2, getProjectileImpactColor(pb.type), 3);
          destroyedEnemyBullets.add(idx);
        } else if (dist < 8) {
          spawnExplosion(s, (pb.x + eb.x) / 2, (pb.y + eb.y) / 2, getProjectileImpactColor(pb.type), 3);
          pb.hit = true;
          destroyedEnemyBullets.add(idx);
        }
      });
    });
    s.enemyBullets = s.enemyBullets.filter((b, idx) => {
      if (!destroyedEnemyBullets.has(idx)) return true;
      releaseBullet(s, b);
      return false;
    });

    // Enemy bullet hits player (remaining bullets after collision)
    s.enemyBullets = s.enemyBullets.filter(b => {
      const enemyBulletRadius = b.big ? 12 : b.boss ? 6 : 4;

      if (s._droneUnit?.alive) {
        const ddx = b.x - s._droneUnit.x;
        const ddy = b.y - s._droneUnit.y;
        if (Math.hypot(ddx, ddy) < 14 + enemyBulletRadius) {
          spawnExplosion(s, s._droneUnit.x, s._droneUnit.y, '#ffdd00', 10);
          s._droneUnit.alive = false;
          s._droneUnit.respawnTimer = s._droneUnit._respawnFrames || 140;
          s._droneUnit.targetIndex = null;
          s._droneUnit.carryingIndex = null;
          releaseBullet(s, b);
          return false;
        }
      }

      if (s._harvesterUnit?.alive) {
        const hdx = b.x - s._harvesterUnit.x;
        const hdy = b.y - s._harvesterUnit.y;
        if (Math.hypot(hdx, hdy) < 14 + enemyBulletRadius) {
          spawnExplosion(s, s._harvesterUnit.x, s._harvesterUnit.y, '#ff8800', 10);
          s._harvesterUnit.alive = false;
          s._harvesterUnit.respawnTimer = s._harvesterUnit._respawnFrames || 180;
          s._harvesterUnit.targetType = null;
          s._harvesterUnit.targetRef = null;
          s._harvesterUnit.progress = 0;
          s._harvesterUnit.collectTimer = 0;
          s._harvesterUnit.pendingReward = 0;
          releaseBullet(s, b);
          return false;
        }
      }

      const dx = b.x - p.x, dy = b.y - p.y;
      if (Math.sqrt(dx * dx + dy * dy) < 14) {
        spawnExplosion(s, p.x, p.y, '#00f0ff', 10);
        releaseBullet(s, b);
        takeDamage(s);
        return false;
      }
      return true;
    });

    // Enemy body hits player
    s.enemies.forEach(e => {
      if (e.dead) return;
      const dx = e.x - p.x, dy = e.y - p.y;
      const hitRangeX = e.type === 'glutton'
        ? Math.max(18, (e.w || 80) * 0.27)
        : e.type === 'eater'
          ? Math.max(14, (e.w || 50) * 0.2)
          : 18;
      const hitRangeY = e.type === 'glutton'
        ? Math.max(18, (e.h || 80) * 0.27)
        : e.type === 'eater'
          ? Math.max(14, (e.h || 50) * 0.2)
          : 18;
      if (Math.abs(dx) < hitRangeX && Math.abs(dy) < hitRangeY) {
        // Star invincibility: don't kill bosses on contact, just push them away
        if (s.starInvincibleTimer > 0 && e.type === 'boss') {
          e.x += (e.x - p.x) * 0.3;
          e.y += (e.y - p.y) * 0.3;
          return;
        }
        if (e.type === 'boss') {
          // Bosses are immune to body-collision kills.
          spawnExplosion(s, p.x, p.y, '#ff4444', 12);
          takeDamage(s);
          const bdx = e.x - p.x, bdy = e.y - p.y;
          const blen = Math.hypot(bdx, bdy) || 1;
          e.x += (bdx / blen) * 20;
          e.y += (bdy / blen) * 20;
          return;
        }
        if (e.type === 'mine') {
          const MINE_RADIUS = 160;
          spawnExplosion(s, e.x, e.y, '#ff8800', 60);
          spawnExplosion(s, e.x, e.y, '#ffdd00', 35);
          spawnExplosion(s, e.x, e.y, '#ffffff', 15);
          s.particles.push({ x: e.x, y: e.y, vx: 0, vy: 0, r: 10, alpha: 1, color: '#ff8800', shockwave: true, shockwaveR: 10 });
          s.particles.push({ x: e.x, y: e.y, vx: 0, vy: 0, r: 10, alpha: 0.7, color: '#ffdd00', shockwave: true, shockwaveR: 5 });
          s.enemies.forEach(ne => {
            if (ne === e || ne.dead) return;
            if (Math.hypot(ne.x - e.x, ne.y - e.y) < MINE_RADIUS) {
              ne.hp -= 2;
              spawnExplosion(s, ne.x, ne.y, '#ff8800', 8);
              if (ne.hp <= 0) ne.dead = true;
            }
          });
          s.score += 300; onScoreChange(s.score);
          takeDamage(s);
          spawnExplosion(s, p.x, p.y, '#ff8800', 12);
          e.dead = true;
        } else if (e.type === 'eater') {
          // Eaters are passive hazards: contact still hurts, then they recoil.
          spawnExplosion(s, p.x, p.y, '#44ff88', 12);
          takeDamage(s);
          const edx = e.x - p.x, edy = e.y - p.y;
          const elen = Math.hypot(edx, edy) || 1;
          const eaterShove = e._growthStage >= 2 ? 36 : e._growthStage === 0 ? 24 : 30;
          e.x += (edx / elen) * eaterShove;
          e.y += (edy / elen) * eaterShove;
          e._chargingPlayer = false;
        } else if (e.type === 'glutton') {
          // Glutton body contact: moderate shove to avoid unfair overlap chains.
          spawnExplosion(s, p.x, p.y, '#ff6644', 14);
          takeDamage(s);
          const bdx = e.x - p.x, bdy = e.y - p.y;
          const blen = Math.hypot(bdx, bdy) || 1;
          const shove = 16 + Math.min(12, (e._segmentCount || 0) * 2);
          e.x += (bdx / blen) * shove;
          e.y += (bdy / blen) * shove;
          const gluttonMargin = Math.max(18, ((e.w || 44) + (e.h || 44)) * 0.24);
          e.x = Math.min(W - gluttonMargin, Math.max(gluttonMargin, e.x));
          e.y = Math.min(H - gluttonMargin, Math.max(gluttonMargin, e.y));
        } else {
          e.dead = true;
          spawnExplosion(s, e.x, e.y, '#ff4444', 12);
          takeDamage(s);
        }
      }
    });
    s.enemies = s.enemies.filter(e => !e.dead);

    // Player touches falling block cell
    s.blocks.forEach(block => {
      getBlockCells(block).forEach(cell => {
        if (!isCellOnStage(cell, W, H)) return;
        if (p.x >= cell.x - 10 && p.x <= cell.x + BLOCK_SIZE + 10 &&
            p.y >= cell.y - 10 && p.y <= cell.y + BLOCK_SIZE + 10) {
          if (!block._dmgCooldown || block._dmgCooldown <= 0) {
            takeDamage(s);
            spawnExplosion(s, p.x, p.y, block.color, 8);
            block._dmgCooldown = 60;
          }
        }
      });
      if (block._dmgCooldown > 0) block._dmgCooldown--;
    });

    // Player touches piled cell
    s.piledCells.forEach(cell => {
      if (!isCellOnStage(cell, W, H)) return;
      if (!cell._dmgCooldown) cell._dmgCooldown = 0;
      if (p.x >= cell.x - 8 && p.x <= cell.x + BLOCK_SIZE + 8 &&
          p.y >= cell.y - 8 && p.y <= cell.y + BLOCK_SIZE + 8) {
        if (cell._dmgCooldown <= 0) {
          takeDamage(s);
          spawnExplosion(s, p.x, p.y, cell.color, 8);
          cell._dmgCooldown = 60;
        }
      }
      cell._dmgCooldown = Math.max(0, (cell._dmgCooldown || 0) - 1);
    });

    // Wave clear — only count combat enemies; droppers survive into the next wave
    const combatEnemies = s.enemies.filter(e => e.type !== 'dropper');
    if (combatEnemies.length === 0) {
      s.waveTimer++;
      const nextWave = s.wave + (bossModeRef.current ? 5 : 1);
      const targetFps = Math.max(30, gameSpeedRef.current || 30);
      const cleanupDelayFrames = Math.round(targetFps * 3); // ~3 seconds
      const isBossWaveClear = bossModeRef.current || (s.wave % 5 === 0);
      const waveAdvanceDelay = isBossWaveClear ? cleanupDelayFrames : 90;
      if (s.waveTimer === 1 && nextWave % 5 === 0) {
        onBossWarningRef.current?.({ active: true, timer: 120 });
      }
      if (s.waveTimer > waveAdvanceDelay) {
        const survivingDroppers = s.enemies.filter(e => e.type === 'dropper');
        const repairLvl = (shopUpgradesRef.current?.repair || 0);
        const maxArmor = (shopUpgradesRef.current?.armor || 0) * 3;
        if (repairLvl > 0 && maxArmor > 0) {
          s.armorHp = Math.min(maxArmor, (s.armorHp || 0) + repairLvl);
          onPowerupChangeRef.current?.({ ...s.powerups, shieldHp: s.shieldHp, armorHp: s.armorHp, starInvincible: s.starInvincibleTimer > 0 });
        }

        s.wave += bossModeRef.current ? 5 : 1;
        s.waveTimer = 0;
        onWaveChange(s.wave);
        sounds.waveComplete();
        // Restore per-wave passives from shop upgrades
        const wavePassiveUpgrades = shopUpgradesRef.current || {};
        ['speed', 'rapidfire', 'wingman'].forEach(key => {
          const shopLvl = wavePassiveUpgrades[key] || 0;
          if (shopLvl > 0) s.powerups[key] = Math.max(s.powerups[key] || 0, shopLvl);
        });
        const waveShieldLvl = wavePassiveUpgrades.shield || 0;
        if (waveShieldLvl > 0) {
          s.shieldHp = Math.max(s.shieldHp, waveShieldLvl * 3);
          if (s.shieldHp > 0) s.powerups.shield = Math.max(s.powerups.shield || 0, waveShieldLvl);
        }
        spawnWave(W, s);
        if (!bossModeRef.current) {
          // Re-add surviving droppers after wave spawn (spawnWave replaces s.enemies)
          s.enemies.push(...survivingDroppers);
        }
      }
    } else {
      s.waveTimer = 0;
    }

    // Invincibility countdown
    if (s.invincibleTimer > 0) s.invincibleTimer--;

    // Particles
    s.particles.forEach(pt => {
      if (pt.shockwave) {
        pt.shockwaveR += 4;
        pt.alpha -= 0.04;
      } else {
        pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.04; pt.alpha -= 0.025;
      }
    });
    s.particles = s.particles.filter(pt => pt.alpha > 0);
    if (s.particles.length > 500) s.particles = s.particles.slice(-500);

    // ── Draw ─────────────────────────────────────────────────
    s.particles.forEach(pt => drawParticle(ctx, pt));
    drawPiledCells(ctx, s.piledCells);
    s.blocks.forEach(b => drawBlock(ctx, b));
    s.powerupItems.forEach(item => drawPowerupItem(ctx, item));
    s.enemies.forEach(e => drawEnemy(ctx, e));
    s.enemies.forEach(e => {
      if (e.type === 'boss' && (e.wave || 0) === 15) {
        drawBeholderLasers(ctx, e);
        drawBeholderShield(ctx, e);
      }
    });
    
    s.bullets.forEach(b => drawBullet(ctx, b, false));
    s.enemyBullets.forEach(b => drawBullet(ctx, b, true));
    // Aim-mode HUD indicator
    if (aimModeRef.current) {
      ctx.save();
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(0,240,255,0.85)';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 8;
      ctx.fillText('\u2295 AIM', 10, 10);
      ctx.restore();
    }
    const supportUpgrades = shopUpgradesRef.current || {};
    drawPlayer(
      ctx,
      p,
      s.wingmen,
      s.shieldHp,
      s.enemies,
      s.invincibleTimer,
      keys,
      s.starInvincibleTimer,
      s.superWingman,
      s.superWingmen,
      s.powerups.reverse || 0,
      supportUpgrades.drone || 0,
      supportUpgrades.harvester || 0,
      s._harvesterUnit,
      s._droneUnit,
      aimModeRef.current
    );

    // Laser charge indicator + continuous beam draw
    if ((s.powerups.laser || 0) > 0) {
      const laserTier = s.powerups.laser;
      const beamW = laserTier >= 10 ? (4 + laserTier * 3) * 2 : 4 + laserTier * 3;

      const isPiercingDraw = laserTier >= 10;
      const beamColor = isPiercingDraw ? '#ffffff' : '#ff44ff';
      const beamColorRgb = isPiercingDraw ? '255,255,255' : '255,68,255';
      const beamCenterRgb = isPiercingDraw ? '255,255,255' : '255,200,255';

      if (s.laserBeamActive) {
        const laserAim = aimModeRef.current
          ? getAimTransformFromRotation(p.x, p.y, Number.isFinite(p._aimRotation) ? p._aimRotation : 0)
          : getAimTransform(p.x, p.y, s.enemies, false);
        const beamStartX = laserAim.noseX;
        const beamStartY = laserAim.noseY;
        const beamEndX = Number.isFinite(s.laserBeamEndX) ? s.laserBeamEndX : beamStartX + laserAim.dirX * (Math.hypot(W, H) + 120);
        const beamEndY = Number.isFinite(s.laserBeamEndY) ? s.laserBeamEndY : beamStartY + laserAim.dirY * (Math.hypot(W, H) + 120);
        const beamAlpha = 0.7 + Math.sin(Date.now() * 0.03) * 0.3;
        ctx.save();
        // Outer glow
        ctx.shadowColor = beamColor; ctx.shadowBlur = 30;
        ctx.strokeStyle = `rgba(${beamColorRgb},${beamAlpha * 0.4})`;
        ctx.lineWidth = beamW * 3;
        ctx.beginPath(); ctx.moveTo(beamStartX, beamStartY); ctx.lineTo(beamEndX, beamEndY); ctx.stroke();
        // Core beam
        ctx.shadowBlur = 20;
        ctx.strokeStyle = `rgba(${beamColorRgb},${beamAlpha})`;
        ctx.lineWidth = beamW;
        ctx.beginPath(); ctx.moveTo(beamStartX, beamStartY); ctx.lineTo(beamEndX, beamEndY); ctx.stroke();
        // Bright center
        ctx.strokeStyle = `rgba(${beamCenterRgb},${beamAlpha})`;
        ctx.lineWidth = beamW * 0.3;
        ctx.beginPath(); ctx.moveTo(beamStartX, beamStartY); ctx.lineTo(beamEndX, beamEndY); ctx.stroke();

        // Muzzle flare at beam origin
        if (s.laserFlareTimer > 0) {
          const flarePct = s.laserFlareTimer / 12;
          ctx.shadowColor = beamColor; ctx.shadowBlur = 40 * flarePct;
          ctx.fillStyle = `rgba(${beamColorRgb},${flarePct * 0.9})`;
          const flareR = beamW * 3 * flarePct;
          ctx.beginPath(); ctx.arc(beamStartX, beamStartY, flareR, 0, Math.PI * 2); ctx.fill();
          // Cross spokes
          ctx.strokeStyle = `rgba(${beamCenterRgb},${flarePct})`;
          ctx.lineWidth = 2;
          for (let fi = 0; fi < 4; fi++) {
            const fa = (fi / 4) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(beamStartX + Math.cos(fa) * flareR * 0.4, beamStartY + Math.sin(fa) * flareR * 0.4);
            ctx.lineTo(beamStartX + Math.cos(fa) * flareR * 1.6, beamStartY + Math.sin(fa) * flareR * 1.6);
            ctx.stroke();
          }
        }

        ctx.restore();
        // Beam timer ring
        const beamPct = s.laserBeamTimer / LASER_BEAM_FRAMES;
        ctx.save();
        ctx.strokeStyle = `rgba(${beamColorRgb},0.6)`; ctx.lineWidth = 3; ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 32, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * beamPct);
        ctx.stroke(); ctx.restore();
      } else if (s.laserCooldown > 0) {
        ctx.save();
        ctx.strokeStyle = 'rgba(180,180,180,0.3)'; ctx.lineWidth = 3; ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - s.laserCooldown / LASER_COOLDOWN_FRAMES));
        ctx.stroke(); ctx.restore();
      } else {
        const pct = Math.min(s.laserCharge / LASER_CHARGE_FRAMES, 1);
        ctx.save();
        ctx.strokeStyle = `rgba(${beamColorRgb},${0.4 + pct * 0.6})`;
        ctx.shadowColor = beamColor; ctx.shadowBlur = 8 + pct * 16; ctx.lineWidth = 2 + pct * 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 28 + pct * 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
        ctx.stroke(); ctx.restore();
      }
    }

    // Boss HUD — HP bars and names for actual bosses only (not eaters/gluttons)
    // Include Super Eater as a boss for HUD
    const activeBosses = s.enemies.filter(e => e && !e.dead && (e.type === 'boss' || e.type === 'superEater'));
    if (activeBosses.length > 0) {
      // Patch in a display name for Super Eater
      activeBosses.forEach(boss => {
        if (boss.type === 'superEater') boss.tier = 99; // Use a unique tier to avoid default names
        if (boss.type === 'superEater') boss._variantProfile = { label: 'Super Eater', hudColor: '#ff00ff' };
      });
      drawBossHUD(ctx, W, activeBosses);
    }

    if (chainedStepsRemaining > 0) {
      loop(timestamp, false, true, chainedStepsRemaining - 1);
    }

    if (scheduleNext) {
      const extraSimulationSteps = Math.max(0, Math.floor(speedBoostMultiplierRef.current || 1) - 1);
      if (extraSimulationSteps > 0) {
        loop(timestamp, false, true, extraSimulationSteps - 1);
      }
      animRef.current = requestAnimationFrame(loop);
    }
  }, [onScoreChange, onLivesChange, onMaxLivesChange, onWaveChange, onPowerupChange, setGameState]);

  // ── Start / stop ─────────────────────────────────────────────
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
      s.wave = Math.max(1, startWaveRef.current || 1);
      const carry = carryOverPowerupsRef.current;
      const armorLvl = shopUpgradesRef.current?.armor || 0;
      s.armorHp = armorLvl * 3;
      if (carry && Object.keys(carry).length > 0) {
        s.powerups = normalizePowerups(carry);
        s.shieldHp = carry.shieldHp || 0;
        s.starInvincibleTimer = carry.starInvincible ? STAR_INVINCIBLE_FRAMES : 0;
        if (typeof carry.armorHp === 'number') {
          s.armorHp = Math.max(s.armorHp, carry.armorHp);
        }
      }
      // Apply passive shop upgrades as permanent baselines
      const passiveUpgrades = shopUpgradesRef.current || {};
      ['speed', 'rapidfire', 'wingman'].forEach(key => {
        const shopLvl = passiveUpgrades[key] || 0;
        if (shopLvl > 0) s.powerups[key] = Math.max(s.powerups[key] || 0, shopLvl);
      });
      const shieldShopLvl = passiveUpgrades.shield || 0;
      if (shieldShopLvl > 0) {
        s.shieldHp = Math.max(s.shieldHp, shieldShopLvl * 3);
        if (s.shieldHp > 0) s.powerups.shield = Math.max(s.powerups.shield || 0, shieldShopLvl);
      }
      onPowerupChangeRef.current?.({ ...s.powerups, shieldHp: s.shieldHp, armorHp: s.armorHp, starInvincible: s.starInvincibleTimer > 0 });
      s.running = true;
      spawnWave(W, s);
      lastTimeRef.current = performance.now();
      animRef.current = requestAnimationFrame(loop);
    } else if (gameState === 'resuming') {
      // Continue: restore lives and keep all state
      const s = stateRef.current;
      s.lives = 3;
      s.player = s.player || { x: canvas.width / 2, y: canvas.height - 80 };
      s.running = true;
      onLivesChange(3);
      if (onContinueUsed) onContinueUsed();
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
  }, [gameState]);

  // ── Keyboard ─────────────────────────────────────────────────
  useEffect(() => {
    const down = e => {
      keysRef.current[e.key] = true;
      if (e.code) keysRef.current[e.code] = true;
      if (e.code === 'Space') e.preventDefault();
      // Shift toggles aim-tracking mode for the player + super wingmen.
      if ((e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat) {
        aimModeRef.current = !aimModeRef.current;
      }
    };
    const up = e => {
      keysRef.current[e.key] = false;
      if (e.code) keysRef.current[e.code] = false;
      if (e.code === 'Space') e.preventDefault();
    };
    const clearKeys = () => { keysRef.current = {}; };
    const onVisibilityChange = () => {
      if (document.hidden) clearKeys();
    };

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clearKeys);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clearKeys);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      <MobileControls keysRef={keysRef} />
    </>
  );
}