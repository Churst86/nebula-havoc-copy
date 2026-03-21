import React, { useRef, useEffect, useCallback } from 'react';
import MobileControls from './MobileControls';
import { sounds } from '../../hooks/useSound.js';
import { spawnBerserk, spawnEater } from '../../lib/enemySpawners.js';
import { updateBerserkMovement, updateBerserkLaser, drawBerserk } from '../../lib/berserkUtils.js';
import { fireReverseShot, drawReverseFlame } from '../../lib/reverseGunUtils.js';
import { fireMissiles, updateMissiles, drawMissile, getMissileHitDamage, shouldSpawnMissileExplosion } from '../../lib/missileUtils.js';
import { DROPPER_COLORS, DROPPER_LABELS, DROPPER_ROTATION } from '../../lib/powerupConfig.js';
import { drawBlock, drawPiledCells, drawParticle } from '../../lib/drawingUtils.js';
import { loadSprites, getSprite, getBossSpriteKey, BOSS_SPRITE_MAP } from '../../lib/spriteLoader.js';
import {
  createBossWarning, spawnBoss,
  updateBossMovement, updateBossTier1Fire, updateBossTier2Fire,
  updateBossTier3Fire, updateBossTier4Fire, updateBossTier5Fire,
  updateHomingBullets,
  drawBossAnchor, drawBossSweepLaser, drawBossSuperLaser,
  updateBossTier4Armor, drawBossTier4Armor,
} from '../../lib/bossLogic.js';

// Import laser logic
import { updateLaserBeam, LASER_CHARGE_FRAMES, LASER_BEAM_FRAMES, LASER_COOLDOWN_FRAMES } from '../../lib/laserLogic.js';

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

const DROPPER_SPAWN_INTERVAL = 480;
const GUN_TYPES = ['shotgun', 'laser', 'photon', 'bounce', 'missile'];

const STAR_INVINCIBLE_FRAMES = 420;
const DROPPER_ROTATE_FRAMES = 300;
const STAR_SPAWN_INTERVAL = 1800;

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
  };
}

export default function GameCanvas({ gameState, setGameState, onScoreChange, onBlockScoreChange, onLivesChange, onMaxLivesChange, onWaveChange, onPowerupChange, onBossWarning, continuesLeft, onContinueUsed, isPaused, difficultyConfig, gameSpeed = 30, carryOverPowerups = null, shopUpgrades = null, startWave = 1 }) {
  const canvasRef = useRef(null);
  const keysRef = useRef({});
  const stateRef = useRef(initState());
  const animRef = useRef(null);
  const lastTimeRef = useRef(0);
  const playerShipImageRef = useRef(null);
  const shopUpgradesRef = useRef(shopUpgrades);
  useEffect(() => { shopUpgradesRef.current = shopUpgrades; }, [shopUpgrades]);

  useEffect(() => {
    loadSprites((sprites) => {
      playerShipImageRef.current = sprites['PlayerShip'] || null;
    });
    const BASE = 'https://raw.githubusercontent.com/Churst86/Sprites/main/';
    const extraSprites = ['FinalBoss', 'BeholderBoss', 'PirateBoss', 'DreadnoughtBoss', 'FirstBoss'];
    extraSprites.forEach(name => {
      const existing = getSprite(name);
      if (!existing) {
        const img = new Image();
        img.src = BASE + name + '.png?t=' + Date.now();
        img.onload = () => {
          img._loaded = true;
          window.__spriteCache = window.__spriteCache || {};
          window.__spriteCache[name] = img;
        };
      }
    });
  }, []);

  const isPausedRef = useRef(isPaused);
  const gameSpeedRef = useRef(gameSpeed);
  useEffect(() => { gameSpeedRef.current = gameSpeed; }, [gameSpeed]);
  useEffect(() => {
    isPausedRef.current = isPaused;
    sounds.setPauseVolume(isPaused);
  }, [isPaused]);

  function initStars(W, H) {
    return Array.from({ length: 120 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 1.5 + 0.3,
      speed: Math.random() * 0.6 + 0.1,
      alpha: Math.random() * 0.7 + 0.3,
    }));
  }

  function spawnWave(W, s) {
    const wave = s.wave;
    const cfg = difficultyConfig || { hpMult: 1, maxWave: 100, blockSpeedMult: 1 };
    const hpMult = cfg.hpMult || 1;

    if (cfg.maxWave && wave > cfg.maxWave) {
      sounds.stopAllMusic();
      s.running = false;
      setGameState('gameover');
      return;
    }

    const count = 5 + wave * 2;
    const enemies = [];

    if (wave % 5 === 0) {
      s.bossWarning = createBossWarning(wave);
      if (onBossWarning) onBossWarning(s.bossWarning);
      sounds.startBossMusic();
    } else {
      sounds.startWaveMusic(wave);
    }

    for (let i = 0; i < count; i++) {
      const isElite = wave > 3 && Math.random() < 0.25;
      const baseHp = isElite ? 3 : 1;
      const hp = Math.round(baseHp * hpMult);
      enemies.push({
        type: isElite ? 'elite' : 'basic',
        x: randomBetween(40, W - 40),
        y: -30 - i * 28,
        w: isElite ? 14 : 18, h: isElite ? 14 : 18,
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
    if (wave > 10 && (wave % 2 === 0 || (isHell && wave > 25))) {
      spawnEater(enemies, W, wave, hpMult);
    }
    if (wave > 15 && (wave % 2 === 1 || (isHell && wave > 25))) {
      spawnBerserk(enemies, W, wave, hpMult, isHell);
    }
    s.enemies = enemies;
  }

  function getNextDropperType(s) {
    const lockedGuns = s.lockedPowerups.filter(p => GUN_TYPES.includes(p));
    const atGunLimit = lockedGuns.length >= 3;

    for (let i = 0; i < DROPPER_ROTATION.length; i++) {
      const idx = (s.dropperRotationIdx + i) % DROPPER_ROTATION.length;
      const t = DROPPER_ROTATION[idx];
      if ((s.powerups[t] || 0) >= 10) continue;
      if (atGunLimit && GUN_TYPES.includes(t) && !s.lockedPowerups.includes(t)) continue;
      s.dropperRotationIdx = idx;
      return t;
    }
    const nonGuns = DROPPER_ROTATION.filter(t => !GUN_TYPES.includes(t));
    return nonGuns[0] || DROPPER_ROTATION[0];
  }

  function spawnMiniEaters(W, s, parent) {
    const miniHp = Math.max(1, Math.floor(parent._spawnHp / 2));
    for (let i = 0; i < 2; i++) {
      const mini = {
        type: 'eater',
        _mini: true,
        x: parent.x + (i === 0 ? -30 : 30),
        y: parent.y,
        w: 10, h: 10,
        hp: miniHp,
        maxHp: miniHp,
        vx: randomBetween(-0.6, 0.6),
        vy: randomBetween(-0.4, 0.4),
        fireTimer: 9999,
        _chargePlayerTimer: 0,
        _blocksEaten: 0,
      };
      s.enemies.push(mini);
      spawnExplosion(s, mini.x, mini.y, '#44ff88', 8);
    }
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

  function fireSpreadShot(s) {
    const p = s.player;
    const shotgunTier = s.powerups.shotgun || 0;
    if (shotgunTier === 0) return;
    if (s.spreadReloadTimer > 0) return;
    if (s.spreadShotsLeft <= 0) return;
    const pelletCount = shotgunTier === 1 ? 7 : shotgunTier === 2 ? 9 : 11;
    const spreadDeg = shotgunTier === 1 ? 50 : shotgunTier === 2 ? 100 : 150;
    const extraShots = Math.floor((shotgunTier - 1) / 3);
    s.bullets.push({ x: p.x, y: p.y - 18, vx: 0, vy: -10, type: 'spread', spreadTier: shotgunTier, pelletCount, spreadDeg, armed: false });
    for (let i = 0; i < extraShots; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      s.bullets.push({ x: p.x + side * 12, y: p.y - 18, vx: side * 2, vy: -10, type: 'spread', spreadTier: shotgunTier, pelletCount, spreadDeg, armed: false });
    }
    s.spreadShotsLeft--;
    if (s.spreadShotsLeft <= 0) s.spreadReloadTimer = SPREAD_RELOAD_FRAMES;
  }

  function playerFire(s) {
    const p = s.player;
    const pw = s.powerups;
    const photonTier = pw.photon || 0;
    const bounceTier = pw.bounce || 0;
    const missileTier = pw.missile || 0;

    if (missileTier > 0) fireMissiles(s, p, missileTier);

    if (photonTier > 0 && s.bullets.filter(b => b.type === 'photon').length < 2) {
      const PHOTON_BASE_SIZE = 10;
      const pierceCount = photonTier >= 2 ? photonTier - 1 : 0;
      const isSuperOrbit = photonTier >= 10;
      s.bullets.push({
        x: p.x, y: p.y - 14, vx: 0, vy: -11,
        type: 'photon', size: PHOTON_BASE_SIZE, orbitAngle: 0,
        pierceCount, piercedEnemies: [],
        isSuperOrbit, orbitPhase: 0,
      });
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

  function getFireRate(pw) {
    const speedBonus = (pw.rapidfire || 0) === 1 ? 10 : (pw.rapidfire || 0) * 8;
    if ((pw.photon || 0) > 0) return Math.max(14, 50 - (pw.photon || 0) * 4 - speedBonus);
    if ((pw.shotgun || 0) > 0 && (pw.raygun || 0) === 0 && (pw.bounce || 0) === 0) return Math.max(12, 50 - speedBonus);
    if ((pw.bounce || 0) > 0) return Math.max(10, 35 - speedBonus);
    return Math.max(10, 35 - speedBonus);
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
    return { shape, color, x: startX, y: -BLOCK_SIZE * 2, vy: (0.8 + Math.random() * 0.5) * blockSpeedMult, hp, maxHp: hp, settled: false, invulnerable: isInvulnerable };
  }

  function getBlockCells(block) {
    return block.shape.map(([col, row]) => ({
      x: block.x + col * BLOCK_SIZE,
      y: block.y + row * BLOCK_SIZE,
    }));
  }

  function drawPlayer(ctx, p, wingmen, shieldHp, enemies, invincibleTimer, keys, starInvincibleTimer, superWingman, superWingmen, armorHp) {
    const wingmanImg = getSprite('Wingman');
    const superWingmanImg = getSprite('SuperWingman');

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
      if (wingmanImg) {
        ctx.shadowColor = '#44aaff'; ctx.shadowBlur = 10;
        ctx.drawImage(wingmanImg, -30, -30, 60, 60);
      } else {
        ctx.shadowColor = '#44aaff'; ctx.shadowBlur = 10;
        ctx.strokeStyle = '#44aaff'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -10); ctx.lineTo(8, 8); ctx.lineTo(0, 4); ctx.lineTo(-8, 8); ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();
    });

    (superWingmen || (superWingman ? [superWingman] : [])).forEach(sw => {
      let angle = -Math.PI / 2;
      let bestDist = Infinity;
      (enemies || []).forEach(e => {
        const d = Math.hypot(e.x - sw.x, e.y - sw.y);
        if (d < bestDist) { bestDist = d; angle = Math.atan2(e.y - sw.y, e.x - sw.x) + Math.PI / 2; }
      });
      ctx.save();
      ctx.translate(sw.x, sw.y);
      ctx.rotate(angle);
      if (superWingmanImg) {
        ctx.shadowColor = '#ffdd00'; ctx.shadowBlur = 22;
        ctx.drawImage(superWingmanImg, -42, -42, 84, 84);
      } else {
        ctx.shadowColor = '#ffdd00'; ctx.shadowBlur = 22;
        ctx.strokeStyle = '#ffdd00'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -18); ctx.lineTo(13, 12); ctx.lineTo(0, 6); ctx.lineTo(-13, 12); ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,221,0,0.12)'; ctx.fill();
      }
      ctx.restore();
    });

    if (invincibleTimer > 0 && Math.floor(invincibleTimer / 6) % 2 === 0) return;

    const moving = keys['ArrowLeft'] || keys['a'] || keys['A'] ||
                   keys['ArrowRight'] || keys['d'] || keys['D'] ||
                   keys['ArrowUp'] || keys['w'] || keys['W'] ||
                   keys['ArrowDown'] || keys['s'] || keys['S'];
    if (moving) {
      ctx.save();
      ctx.translate(p.x, p.y);
      const flickerLen = 8 + Math.random() * 10;
      const grad1 = ctx.createLinearGradient(-5, 12, -5, 12 + flickerLen);
      grad1.addColorStop(0, 'rgba(0,240,255,0.9)');
      grad1.addColorStop(0.4, 'rgba(255,140,0,0.7)');
      grad1.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = grad1;
      ctx.beginPath(); ctx.ellipse(-5, 12 + flickerLen / 2, 3, flickerLen / 2, 0, 0, Math.PI * 2); ctx.fill();
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
    const playerImage = playerShipImageRef.current;
    if (playerImage) {
      ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 18;
      ctx.drawImage(playerImage, -60, -60, 120, 120);
    } else {
      ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 18;
      ctx.strokeStyle = '#00f0ff'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -18); ctx.lineTo(13, 12); ctx.lineTo(0, 6); ctx.lineTo(-13, 12); ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,240,255,0.15)';
      ctx.fill();
    }

    if (shieldHp > 0) {
      const alpha = 0.3 + Math.min(shieldHp * 0.15, 0.7);
      ctx.shadowColor = '#00aaff'; ctx.shadowBlur = 28;
      ctx.strokeStyle = `rgba(0,180,255,${alpha})`;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, 38, 0, Math.PI * 2); ctx.stroke();
      // Outer shimmer ring
      ctx.strokeStyle = `rgba(0,220,255,${alpha * 0.4})`;
      ctx.lineWidth = 8;
      ctx.beginPath(); ctx.arc(0, 0, 38, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < Math.min(shieldHp, 10); i++) {
        const a = (i / Math.min(shieldHp, 10)) * Math.PI * 2 - Math.PI / 2;
        ctx.fillStyle = '#00ccff';
        ctx.beginPath(); ctx.arc(Math.cos(a) * 38, Math.sin(a) * 38, 3.5, 0, Math.PI * 2); ctx.fill();
      }
    }

    if (starInvincibleTimer > 0) {
      const hue = (Date.now() * 0.3) % 360;
      ctx.shadowColor = `hsl(${hue},100%,65%)`; ctx.shadowBlur = 40;
      ctx.strokeStyle = `hsla(${hue},100%,65%,0.85)`;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, 46, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = `hsla(${hue},100%,75%,0.3)`;
      ctx.lineWidth = 10;
      ctx.beginPath(); ctx.arc(0, 0, 46, 0, Math.PI * 2); ctx.stroke();
    }

    // Armor shoulder pads
    if (armorHp > 0) {
      const armorAlpha = Math.min(0.4 + (armorHp / 30) * 0.6, 1.0);
      ctx.shadowColor = '#4488ff'; ctx.shadowBlur = 12 + armorHp;
      ctx.fillStyle = `rgba(68,136,255,${armorAlpha * 0.7})`;
      ctx.strokeStyle = `rgba(100,180,255,${armorAlpha})`;
      ctx.lineWidth = 2;
      // Left shoulder pad
      ctx.beginPath();
      ctx.moveTo(-14, -8); ctx.lineTo(-24, -4); ctx.lineTo(-26, 6); ctx.lineTo(-18, 10); ctx.lineTo(-12, 4); ctx.closePath();
      ctx.fill(); ctx.stroke();
      // Right shoulder pad
      ctx.beginPath();
      ctx.moveTo(14, -8); ctx.lineTo(24, -4); ctx.lineTo(26, 6); ctx.lineTo(18, 10); ctx.lineTo(12, 4); ctx.closePath();
      ctx.fill(); ctx.stroke();
    }

    ctx.restore();
  }

  function drawEnemy(ctx, e) {
    ctx.save();
    ctx.translate(e.x, e.y);

    if (e.type === 'boss') {
      const wave = e._wave || 5;
      const spriteKey = getBossSpriteKey(wave);
      const img = getSprite(spriteKey) || (window.__spriteCache && window.__spriteCache[spriteKey]);
      const sz = 440;
      if (img) {
        ctx.shadowColor = '#ff0066'; ctx.shadowBlur = 48;
        ctx.drawImage(img, -sz / 2, -sz / 2, sz, sz);
      } else {
        ctx.shadowColor = '#ff0066'; ctx.shadowBlur = 32;
        ctx.strokeStyle = '#ff0066'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, 60, 0, Math.PI * 2); ctx.stroke();
      }
      // Single health bar — no duplicate
      const bw = 120, bh = 7, by = sz / 2 + 8;
      ctx.fillStyle = '#222'; ctx.fillRect(-bw / 2, by, bw, bh);
      const bossBarColor = ['#ff0066','#ff6600','#aa00ff','#00ccff'][Math.min((e.tier || 1) - 1, 3)];
      ctx.fillStyle = bossBarColor; ctx.fillRect(-bw / 2, by, bw * (e.hp / e.maxHp), bh);
    } else if (e.type === 'dropper') {
      const c = e.color || '#ffd700';
      ctx.shadowColor = c; ctx.shadowBlur = 18;
      ctx.strokeStyle = c; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i/16)*Math.PI*2-Math.PI/2, r = i%2===0?20:10;
        i===0?ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r):ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);
      }
      ctx.closePath(); ctx.fillStyle=c+'22'; ctx.fill(); ctx.stroke();
      ctx.fillStyle=c; ctx.font='bold 11px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(DROPPER_LABELS[e.dropType]||'★',0,1);
    } else if (e.type === 'mine') {
      const mineImg = getSprite('Mine');
      const isCharging = e._charging;
      const damaged = e.hp < e.maxHp;
      const sz = 64;
      // Flash when damaged (charging after first hit)
      const flashOn = damaged && Math.floor(Date.now() / 120) % 2 === 0;
      if (mineImg) {
        if (isCharging) {
          ctx.shadowColor = '#ff2200'; ctx.shadowBlur = 50;
          ctx.globalAlpha = 0.7 + Math.sin(Date.now() * 0.06) * 0.3;
        } else if (flashOn) {
          ctx.shadowColor = '#ff2200'; ctx.shadowBlur = 30;
          ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.08) * 0.5;
        } else {
          ctx.shadowColor = '#ff8800'; ctx.shadowBlur = 12;
        }
        ctx.drawImage(mineImg, -sz / 2, -sz / 2, sz, sz);
        ctx.globalAlpha = 1;
      } else {
        ctx.shadowColor = isCharging ? '#ff2200' : '#ff8800'; ctx.shadowBlur = 20;
        ctx.fillStyle = isCharging ? '#ff2200' : damaged ? '#ff4400' : '#ff8800';
        ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();
      }
      // HP pips
      for (let hi = 0; hi < e.hp; hi++) {
        const a = (hi / 3) * Math.PI * 2 - Math.PI / 2;
        ctx.fillStyle = isCharging ? '#ff2200' : '#ff8800';
        ctx.beginPath(); ctx.arc(Math.cos(a) * 10, Math.sin(a) * 10, 3, 0, Math.PI * 2); ctx.fill();
      }
    } else if (e.type === 'eater') {
      const isMini = e._mini;
      const isEating = e._eating;
      const baseImg = getSprite('Eater');
      const chompImg = getSprite('EaterChomp');
      const eImg = (isEating && chompImg) ? chompImg : baseImg;
      const eSz = isMini ? 80 : 160;
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
      if (eImg) {
        ctx.drawImage(eImg, -eSz / 2, -eSz / 2, eSz, eSz);
        ctx.shadowColor = isEating ? '#00ff44' : '#33cc77';
        ctx.shadowBlur = 12;
        ctx.strokeStyle = isEating ? 'rgba(0,255,68,0.5)' : 'rgba(51,204,119,0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, eSz / 2 - 4, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.shadowColor = isEating ? '#00ff44' : '#33cc77';
        ctx.shadowBlur = 12;
        ctx.fillStyle = 'rgba(51,204,119,0.5)';
        ctx.beginPath(); ctx.arc(0, 0, eSz / 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
      if (!isMini) {
        const bw = 50, bh = 4;
        ctx.fillStyle = '#111'; ctx.fillRect(-bw / 2, eSz / 2 + 6, bw, bh);
        ctx.fillStyle = e.hp / e.maxHp > 0.5 ? '#33cc77' : e.hp / e.maxHp > 0.25 ? '#ffaa00' : '#ff2200';
        ctx.fillRect(-bw / 2, eSz / 2 + 6, bw * (e.hp / e.maxHp), bh);
      }
    } else if (e.type === 'berserk') {
      const bImg = getSprite('Berskerker');
      const bSz = (e._mini ? 120 : 200);
      const t = Date.now();
      if (bImg) {
        ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 12;
        ctx.drawImage(bImg, -bSz / 2, -bSz / 2, bSz, bSz);
        ctx.shadowBlur = 0;
        if (e._laserActive) {
          const spinSpeed = e._isHell ? 0.12 : 0.07;
          e._spinAngle = (e._spinAngle || 0) + spinSpeed;
          const orbitR = 60;
          const laserLen = e._isHell ? 220 : 160;
          const laserW = e._isHell ? 7 : 5;
          const beamCount = e._isHell ? 2 : 1;
          // Set shadow once before loop
          ctx.shadowColor = e._isHell ? '#ff6600' : '#ff4400'; ctx.shadowBlur = 14;
          for (let bi = 0; bi < beamCount; bi++) {
            const angle = e._spinAngle + (bi / beamCount) * Math.PI * 2;
            const startX = Math.cos(angle) * orbitR;
            const startY = Math.sin(angle) * orbitR;
            const endX = Math.cos(angle) * (orbitR + laserLen);
            const endY = Math.sin(angle) * (orbitR + laserLen);
            const laserColor = bi === 0 ? 'rgba(255,100,0,0.9)' : 'rgba(0,150,255,0.8)';
            ctx.strokeStyle = laserColor; ctx.lineWidth = laserW; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(endX, endY); ctx.stroke();
          }
          ctx.shadowBlur = 0;
        }
      } else {
        drawBerserk(ctx, e, t);
      }
      if (!e._mini) {
        const bw = 50, bh = 4;
        ctx.fillStyle = '#222'; ctx.fillRect(-bw / 2, bSz / 2 + 4, bw, bh);
        ctx.fillStyle = e.hp / e.maxHp > 0.5 ? '#ff6600' : '#ff2200';
        ctx.fillRect(-bw / 2, bSz / 2 + 4, bw * (e.hp / e.maxHp), bh);
      }
    } else if (e.type === 'elite') {
      const eImg = getSprite('EliteEnemy');
      const eSz = 100;
      if (eImg) {
        ctx.shadowColor = '#ff44ff'; ctx.shadowBlur = 10;
        ctx.drawImage(eImg, -eSz / 2, -eSz / 2, eSz, eSz);
      } else {
        ctx.shadowColor = '#ff44ff'; ctx.shadowBlur = 10;
        ctx.strokeStyle = '#ff44ff'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -8); ctx.lineTo(8, 8); ctx.lineTo(-8, 8); ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,68,255,0.1)'; ctx.fill();
      }
    } else {
      const basicImg = getSprite('BasicEnemy');
      const bSz = 100;
      if (basicImg) {
        ctx.shadowColor = '#ff4444'; ctx.shadowBlur = 10;
        ctx.drawImage(basicImg, -bSz / 2, -bSz / 2, bSz, bSz);
      } else {
        ctx.shadowColor = '#ff4444'; ctx.shadowBlur = 10;
        ctx.strokeStyle = '#ff4444'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, 9); ctx.lineTo(9, -9); ctx.lineTo(-9, -9); ctx.closePath();
        ctx.stroke();
      }
    }

    // Health bar for non-boss, non-mine, non-eater enemies
    if (e.maxHp > 1 && e.type !== 'boss' && e.type !== 'mine' && e.type !== 'eater') {
      const bw = 28, bh = 3;
      const bx = -bw / 2, by = 22;
      ctx.fillStyle = '#333'; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = e.color || '#ff44ff';
      ctx.fillRect(bx, by, bw * (e.hp / e.maxHp), bh);
    }
    ctx.restore();
  }

  function drawBullet(ctx, b, isEnemy) {
    ctx.save();
    if (b.type === 'spreadPellet') {
      ctx.shadowColor = '#ff6600'; ctx.shadowBlur = 8;
      ctx.fillStyle = '#ff6600';
      ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
    } else if (b.type === 'wingman') {
      ctx.shadowColor = '#aaddff'; ctx.shadowBlur = 8;
      ctx.fillStyle = '#aaddff';
      ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
    } else if (b.type === 'spread') {
      ctx.shadowColor = '#ff6600'; ctx.shadowBlur = 12;
      ctx.fillStyle = '#ff6600';
      ctx.fillRect(b.x - 2, b.y - 9, 4, 18);
      ctx.fillStyle = '#ffcc88';
      ctx.fillRect(b.x - 1, b.y - 9, 2, 18);
    } else if (b.type === 'bounce') {
      if (b.isSuper) {
        const sz = b.size || 8;
        ctx.shadowColor = '#ffff00'; ctx.shadowBlur = 20;
        ctx.fillStyle = '#aaff00';
        ctx.beginPath(); ctx.arc(b.x, b.y, sz, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ffff00'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(b.x, b.y, sz * 0.4, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.shadowColor = '#aaff00'; ctx.shadowBlur = 12;
        ctx.fillStyle = '#aaff00';
        ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(b.x, b.y, 2, 0, Math.PI * 2); ctx.fill();
      }
    } else if (b.type === 'laser') {
      const w = 3 + (b.fat || 1) * 2;
      ctx.shadowColor = '#ff44ff'; ctx.shadowBlur = 14 + (b.fat || 1) * 4;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(b.x - w * 0.3, b.y - 12, w * 0.6, 22);
      ctx.fillStyle = '#ff44ff';
      ctx.fillRect(b.x - w, b.y - 12, w * 2, 22);
    } else if (b.type === 'photon') {
      const sz = b.size || 10;
      const isSuperOrbit = b.isSuperOrbit;
      const hue = isSuperOrbit ? (Date.now() * 0.4) % 360 : 150;
      const orbColor = isSuperOrbit ? `hsl(${hue},100%,65%)` : '#44ffaa';
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
    } else if (b.type === 'missile') {
      drawMissile(ctx, b);
    } else if (isEnemy) {
      const isBoss = b.boss;
      if (b.photonOrb) {
        const sz = b.orbSize || 14;
        ctx.shadowColor = '#44ffaa'; ctx.shadowBlur = sz * 2;
        ctx.fillStyle = 'rgba(68,255,170,0.3)';
        ctx.beginPath(); ctx.arc(b.x, b.y, sz + 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#44ffaa';
        ctx.beginPath(); ctx.arc(b.x, b.y, sz, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(b.x, b.y, sz * 0.35, 0, Math.PI * 2); ctx.fill();
      } else {
        const r = b.big ? 16 : isBoss ? 9 : 4;
        ctx.shadowColor = isBoss ? '#ff0066' : '#ff6600'; ctx.shadowBlur = b.big ? 30 : isBoss ? 18 : 8;
        ctx.fillStyle = b.big ? '#ff44aa' : isBoss ? '#ff0066' : '#ff6600';
        ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.fill();
        if (b.big) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, Math.PI * 2); ctx.fill(); }
      }
    } else {
      ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 8;
      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(b.x - 1.5, b.y - 7, 3, 14);
    }
    ctx.restore();
  }

  function drawPowerupItem(ctx, item) {
    const colors = { spread: '#ff6600', shotgun: '#ff6600', laser: '#ff44ff', photon: '#44ffaa', wingman: '#44aaff', shield: '#00ccff', bounce: '#aaff00', speed: '#ff8800', rapidfire: '#ff4488', star: '#ffffff', missile: '#aa22ff' };
    const labels = { shotgun: 'S', laser: 'L', photon: 'P', wingman: 'W', shield: '🛡', bounce: 'B', speed: '▶', rapidfire: '⚡', star: '★', missile: 'M' };
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(item.angle || 0);
    if (item.type === 'star') {
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
      const c = colors[item.type] || '#fff';
      ctx.shadowColor = c; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fillStyle = c + '33'; ctx.fill();
      ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.strokeStyle = c + '88'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = c;
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(labels[item.type], 0, 0);
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
    if (s.armorHp > 0) {
      s.armorHp--;
      sounds.shieldHit && sounds.shieldHit();
      s.invincibleTimer = 45;
      onPowerupChange({ ...s.powerups, shieldHp: s.shieldHp, armorHp: s.armorHp });
      return;
    }
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
    if (s.lives <= 0) { sounds.stopBossMusic(); sounds.stopAllMusic(); s.running = false; setGameState('continue'); }
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

    const wingmanTier = s.powerups.wingman || 0;
    const superWingmanCount = wingmanTier >= 10 ? 2 : wingmanTier >= 5 ? 1 : 0;
    const basicWingmanCount = wingmanTier >= 10 ? 0 : wingmanTier >= 5 ? (wingmanTier - 5) : wingmanTier;
    if (wingmanTier > 0) {
      const allOffsets = [
        { x: -40, y: 10 }, { x: 40, y: 10 }, { x: 0, y: 25 }, { x: -65, y: 20 },
      ];
      const basicOffsets = allOffsets.slice(0, basicWingmanCount);
      const basicTargets = basicOffsets.map(o => ({ x: p.x + o.x, y: p.y + o.y }));
      while (s.wingmen.length < basicTargets.length) s.wingmen.push({ ...basicTargets[s.wingmen.length] });
      while (s.wingmen.length > basicTargets.length) s.wingmen.pop();
      s.wingmen.forEach((w, i) => {
        w.x += (basicTargets[i].x - w.x) * 0.1;
        w.y += (basicTargets[i].y - w.y) * 0.1;
      });
      const superOffsets = [{ x: -80, y: 0 }, { x: 80, y: 0 }];
      if (!s.superWingmen) s.superWingmen = [];
      while (s.superWingmen.length < superWingmanCount) {
        const off = superOffsets[s.superWingmen.length];
        s.superWingmen.push({ x: p.x + off.x, y: p.y + off.y });
      }
      while (s.superWingmen.length > superWingmanCount) s.superWingmen.pop();
      s.superWingmen.forEach((sw, i) => {
        sw.x += (p.x + superOffsets[i].x - sw.x) * 0.08;
        sw.y += (p.y + superOffsets[i].y - sw.y) * 0.08;
      });
      s.superWingman = s.superWingmen[0] || null;
    } else {
      s.wingmen = [];
      s.superWingmen = [];
      s.superWingman = null;
    }

    if (s.spreadReloadTimer > 0) {
      s.spreadReloadTimer--;
      if (s.spreadReloadTimer <= 0) s.spreadShotsLeft = SPREAD_SHOTS_PER_RELOAD;
    }

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

    if ((s.powerups.reverse || 0) > 0) {
      s.reverseFireTimer--;
      if (s.reverseFireTimer <= 0) {
        fireReverseShot(s);
        const reverseTier = s.powerups.reverse || 0;
        const rapidfireBonus = (s.powerups.rapidfire || 0) === 1 ? 10 : (s.powerups.rapidfire || 0) * 8;
        const baseDelay = Math.max(12, 55 - (reverseTier > 3 ? (reverseTier - 3) * 3 : 0) - rapidfireBonus);
        s.reverseFireTimer = baseDelay;
      }
    }

    if ((s.powerups.wingman || 0) > 0 && s.wingmen.length > 0) {
      s.wingmanFireTimer--;
      if (s.wingmanFireTimer <= 0) {
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
          if (!target && blockTargets.length > 0) {
            blockTargets.forEach(bt => {
              const d = Math.hypot(bt.x - w.x, bt.y - w.y);
              if (d < bestDist) { bestDist = d; target = bt; }
            });
          }
          if (target) {
            const dx = target.x - w.x, dy = target.y - w.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            s.bullets.push({ x: w.x, y: w.y - 10, vx: (dx / len) * 7, vy: (dy / len) * 7, type: 'wingman' });
          } else {
            s.bullets.push({ x: w.x, y: w.y - 10, vx: 0, vy: -7, type: 'wingman' });
          }
        });
        const rapidfireBonus = (s.powerups.rapidfire || 0) === 1 ? 10 : (s.powerups.rapidfire || 0) * 8;
        s.wingmanFireTimer = Math.max(12, 45 - rapidfireBonus);
      }
    }

    if (s.superWingmen && s.superWingmen.length > 0) {
      s.superWingmanFireTimer = (s.superWingmanFireTimer || 0) - 1;
      if (s.superWingmanFireTimer <= 0) {
        const pw = s.powerups;
        const rapidfireBonus = (pw.rapidfire || 0) === 1 ? 10 : (pw.rapidfire || 0) * 8;
        const gunOptions = ['shotgun', 'laser', 'photon', 'bounce', 'missile'].filter(g => (pw[g] || 0) > 0);
        const activeGun = gunOptions.length > 0 ? gunOptions[Math.floor(Math.random() * gunOptions.length)] : null;
        s.superWingmen.forEach(sw => {
          if (activeGun === 'photon') {
            const size = 6 + (pw.photon) * 3;
            s.bullets.push({ x: sw.x, y: sw.y - 14, vx: 0, vy: -11, type: 'photon', size, orbitAngle: 0 });
          } else if (activeGun === 'bounce') {
            const side = Math.floor(s.spiralAngle * 2) % 2 === 0 ? -1 : 1;
            s.bullets.push({ x: sw.x + side * 8, y: sw.y - 14, vx: side * 3.5, vy: -10, type: 'bounce', bouncesLeft: (pw.bounce) * 2 });
          } else if (activeGun === 'missile') {
            const missileTier = pw.missile || 0;
            const count = Math.min(missileTier, 3);
            for (let i = 0; i < count; i++) {
              const angle = (i / count) * Math.PI * 0.8 - Math.PI * 0.4;
              s.bullets.push({ x: sw.x, y: sw.y - 14, vx: Math.sin(angle) * 2, vy: -8 + Math.cos(angle) * 1, type: 'missile', target: null });
            }
          } else if (activeGun === 'shotgun') {
            const tier = pw.shotgun || 0;
            const pelletCount = tier === 1 ? 7 : tier === 2 ? 9 : 11;
            const spreadDeg = tier === 1 ? 50 : tier === 2 ? 100 : 150;
            s.bullets.push({ x: sw.x, y: sw.y - 14, vx: 0, vy: -10, type: 'spread', spreadTier: tier, pelletCount, spreadDeg, armed: false });
          } else {
            s.bullets.push({ x: sw.x, y: sw.y - 18, vx: 0, vy: -7, type: 'normal' });
          }
        });
        s.superWingmanFireTimer = Math.max(10, getFireRate(pw) + 5 - rapidfireBonus);
      }
    }

    updateLaserBeam(s, p, W, H, spawnExplosion, sounds, onScoreChange, onPowerupChange, onLivesChange, onMaxLivesChange, BLOCK_SIZE, getBlockCells);

    s.dropperRotateTimer--;
    if (s.dropperRotateTimer <= 0) {
      s.dropperRotationIdx = (s.dropperRotationIdx + 1) % DROPPER_ROTATION.length;
      for (let i = 0; i < DROPPER_ROTATION.length; i++) {
        const t = DROPPER_ROTATION[s.dropperRotationIdx];
        if ((s.powerups[t] || 0) < 10) break;
        s.dropperRotationIdx = (s.dropperRotationIdx + 1) % DROPPER_ROTATION.length;
      }
      s.dropperRotateTimer = DROPPER_ROTATE_FRAMES;
      const nextType = getNextDropperType(s);
      s.enemies.forEach(e => {
        if (e.type === 'dropper' && e.dropType !== 'star') {
          e.dropType = nextType;
          e.color = DROPPER_COLORS[e.dropType] || '#ffd700';
        }
      });
    }

    s.dropperSpawnTimer--;
    if (s.dropperSpawnTimer <= 0) {
      spawnDropper(W, s);
      s.dropperSpawnTimer = DROPPER_SPAWN_INTERVAL;
    }

    s.starDropperTimer--;
    if (s.starDropperTimer <= 0) {
      spawnDropper(W, s, 'star');
      s.starDropperTimer = STAR_SPAWN_INTERVAL + Math.floor(randomBetween(0, 600));
    }

    if (s.bossWarning && s.bossWarning.active) {
      s.bossWarning.timer--;
      if (onBossWarning) onBossWarning({ ...s.bossWarning });
      if (s.bossWarning.timer <= 0) {
        s.bossWarning.active = false;
        if (onBossWarning) onBossWarning(null);
        const wave = s.wave;
        const cfg = difficultyConfig || { hpMult: 1 };
        const hpMult = cfg.hpMult || 1;
        s.enemies.push(spawnBoss(W, wave, hpMult));
      }
    }

    s.enemies.forEach(e => {
      if (e.type === 'boss') {
        updateBossMovement(e, W, H);
        const bossTargetY = (e.tier || 1) >= 3 ? H * 0.30 : H * 0.22;
        if (e.y >= bossTargetY - 5) {
          const bt = e.tier || 1;
          if (bt === 1) updateBossTier1Fire(e, p, s, sounds);
          else if (bt === 2) updateBossTier2Fire(e, p, s, sounds);
          else if (bt === 3) updateBossTier3Fire(e, p, s, W, H, spawnExplosion, sounds, onScoreChange, BLOCK_SIZE, getBlockCells);
          else if (bt === 4) { updateBossTier4Fire(e, p, s, sounds, W, H, spawnExplosion); updateBossTier4Armor(e, s, BLOCK_SIZE, getBlockCells, spawnExplosion); }
          else updateBossTier5Fire(e, p, s, sounds, W, H, spawnExplosion);
        }
        if ((e.tier || 1) === 3 && e._sweepHitsPlayer) takeDamage(s);
        if ((e.tier || 1) === 3 && e._superHitsPlayer) takeDamage(s);
      } else if (e.type === 'mine') {
        e._chargeTimer = (e._chargeTimer === undefined ? randomBetween(30, 60) : e._chargeTimer) - 1;
        e._rechargeCooldown = Math.max(0, (e._rechargeCooldown || 0) - 1);
        if (e._charging) {
          e.x += e._chargeDx * 7; e.y += e._chargeDy * 7;
          e._chargeDuration = (e._chargeDuration || 0) - 1;
          if (e._chargeDuration <= 0) {
            e._charging = false;
            e._rechargeCooldown = randomBetween(60, 120);
            e.vx = randomBetween(-0.8, 0.8); e.vy = randomBetween(0.3, 0.8);
          }
          if (e.x < 20) { e.x = 20; e._charging = false; e._rechargeCooldown = 180; }
          if (e.x > W - 20) { e.x = W - 20; e._charging = false; e._rechargeCooldown = 180; }
          if (e.y < 20) { e.y = 20; e._charging = false; e._rechargeCooldown = 180; }
          if (e.y > H - 20) { e.y = H - 20; e._charging = false; e._rechargeCooldown = 180; }
        } else {
          e.x += e.vx; e.y += e.vy;
          if (e.x < 20 || e.x > W - 20) e.vx *= -1;
          if (e.y < 20) { e.y = 20; e.vy = Math.abs(e.vy); }
          if (e.y > H - 20) { e.y = H - 20; e.vy = -Math.abs(e.vy); }
          if (e._chargeTimer <= 0 && e._rechargeCooldown <= 0) {
            const dx = p.x - e.x, dy = p.y - e.y;
            const len = Math.hypot(dx, dy) || 1;
            e._chargeDx = dx / len; e._chargeDy = dy / len;
            e._charging = true; e._chargeDuration = 60;
            e._chargeTimer = randomBetween(30, 60);
          }
        }
      } else if (e.type === 'eater') {
        e._chompTimer = (e._chompTimer || 0) + 1;
        e._eating = false;
        const bound = e._mini ? 15 : 25;
        if (e._chargingPlayer) {
          e._eating = Math.floor(e._chompTimer / 8) % 2 === 0;
          e.x += e._cpDx * (e._mini ? 5 : 7); e.y += e._cpDy * (e._mini ? 5 : 7);
          if (e.x < bound) { e.x = bound; e._chargingPlayer = false; e.vx = Math.abs(randomBetween(0.4,0.8)); e.vy = randomBetween(-0.5,0.5); }
          if (e.x > W-bound) { e.x = W-bound; e._chargingPlayer = false; e.vx = -Math.abs(randomBetween(0.4,0.8)); e.vy = randomBetween(-0.5,0.5); }
          if (e.y < bound) { e.y = bound; e._chargingPlayer = false; e.vx = randomBetween(-0.5,0.5); e.vy = Math.abs(randomBetween(0.4,0.8)); }
          if (e.y > H-bound) { e.y = H-bound; e._chargingPlayer = false; e.vx = randomBetween(-0.5,0.5); e.vy = -Math.abs(randomBetween(0.4,0.8)); }
        } else {
          let targetX = null, targetY = null, bestDist = Infinity;
          s.blocks.forEach(block => {
            if (block.dead) return;
            if (e._mini && block.invulnerable) return;
            getBlockCells(block).forEach(cell => {
              const d = Math.hypot(cell.x+BLOCK_SIZE/2-e.x, cell.y+BLOCK_SIZE/2-e.y);
              if (d < bestDist) { bestDist=d; targetX=cell.x+BLOCK_SIZE/2; targetY=cell.y+BLOCK_SIZE/2; e._targetBlock=block; e._targetCellIdx=undefined; }
            });
          });
          s.piledCells.forEach((cell, idx) => {
            const d = Math.hypot(cell.x+BLOCK_SIZE/2-e.x, cell.y+BLOCK_SIZE/2-e.y);
            if (d < bestDist) { bestDist=d; targetX=cell.x+BLOCK_SIZE/2; targetY=cell.y+BLOCK_SIZE/2; e._targetBlock=null; e._targetCellIdx=idx; }
          });
          if (targetX !== null && bestDist > 10) {
            const dx2=targetX-e.x, dy2=targetY-e.y, len2=Math.hypot(dx2,dy2)||1;
            const eSpd=(e._mini?0.8:1.2)+(s.wave*0.04);
            e.x+=(dx2/len2)*eSpd; e.y+=(dy2/len2)*eSpd;
          } else if (targetX !== null && bestDist <= 30) {
            e._eating = true;
            let justAte=false, ateInvuln=false;
            if (e._targetBlock && !e._targetBlock.dead) {
              e._targetBlock.hp -= e._targetBlock.invulnerable ? 0.02 : 0.06;
              if (e._targetBlock.hp <= 0) {
                ateInvuln=!!e._targetBlock.invulnerable; e._targetBlock.dead=true;
                e.hp=Math.min(e.hp+3,e.maxHp+5); e.maxHp=Math.max(e.maxHp,e.hp);
                spawnExplosion(s,e.x,e.y,ateInvuln?'#aaaacc':'#44ff88',10);
                justAte=true; e._blocksEaten=(e._blocksEaten||0)+1;
              }
            } else if (e._targetCellIdx!==undefined && s.piledCells[e._targetCellIdx]) {
              s.piledCells.splice(e._targetCellIdx,1);
              e.hp=Math.min(e.hp+2,e.maxHp+5); e.maxHp=Math.max(e.maxHp,e.hp);
              spawnExplosion(s,e.x,e.y,'#44ff88',6);
              justAte=true; e._blocksEaten=(e._blocksEaten||0)+1;
            }
            if (justAte) {
              if (ateInvuln && !e._mini && !e._superEater) { e._superEater=true; e._miniSpawnTimer=300; spawnExplosion(s,e.x,e.y,'#ffffff',30); }
              if (!e._mini && e._blocksEaten>=2) { e._blocksEaten=0; spawnMiniEaters(W,s,e); }
              const dxp=p.x-e.x, dyp=p.y-e.y, lenp=Math.hypot(dxp,dyp)||1;
              e._cpDx=dxp/lenp; e._cpDy=dyp/lenp; e._chargingPlayer=true; e._cpDuration=35;
            }
          } else { e.x+=e.vx; e.y+=e.vy; }
          if (e.x<bound){e.x=bound;e.vx=Math.abs(e.vx);} if (e.x>W-bound){e.x=W-bound;e.vx=-Math.abs(e.vx);}
          if (e.y<bound){e.y=bound;e.vy=Math.abs(e.vy);} if (e.y>H-bound){e.y=H-bound;e.vy=-Math.abs(e.vy);}
        }
        if (e._superEater) { e._miniSpawnTimer=(e._miniSpawnTimer||300)-1; if(e._miniSpawnTimer<=0){spawnMiniEaters(W,s,e);e._miniSpawnTimer=300;} }
      } else if (e.type === 'dropper') {
        e.dirTimer = (e.dirTimer || 60) - 1;
        if (e.dirTimer <= 0) {
          e.vx = randomBetween(-1.5, 1.5); e.vy = randomBetween(-1.2, 1.2);
          e.dirTimer = randomBetween(60, 150);
        }
        e.x += e.vx; e.y += e.vy;
        if (e.x < 30) { e.x = 30; e.vx = Math.abs(e.vx); }
        if (e.x > W - 30) { e.x = W - 30; e.vx = -Math.abs(e.vx); }
        if (e.y < 30) { e.y = 30; e.vy = Math.abs(e.vy); }
        if (e.y > H * 0.7) { e.y = H * 0.7; e.vy = -Math.abs(e.vy); }
      } else if (e.type === 'berserk') {
        updateBerserkMovement(e, p, W, H);
        updateBerserkLaser(e, s, p, W, H);
      } else if (e.type === 'elite') {
        e.movePhase = (e.movePhase || 0) + 0.07;
        e.dashTimer = (e.dashTimer || 0) - 1;
        if (!e._baseSpd) e._baseSpd = Math.hypot(e.vx, e.vy) || 1.5;
        if (e.dashTimer <= 0) {
          const dx = p.x - e.x, dy = p.y - e.y;
          const len = Math.hypot(dx, dy) || 1;
          e.vx = (dx / len) * e._baseSpd * 2.5;
          e.vy = (dy / len) * e._baseSpd * 1.2;
          e.dashTimer = randomBetween(120, 200);
        }
        e.x += e.vx + Math.sin(e.movePhase) * 2.2; e.y += e.vy;
        if (e.x < 20) { e.x = 20; e.vx = Math.abs(e._baseSpd); }
        if (e.x > W - 20) { e.x = W - 20; e.vx = -Math.abs(e._baseSpd); }
        if (e.y < 20) { e.y = 20; e.vy = Math.abs(e._baseSpd); }
        if (e.y > H - 20) { e.y = H - 20; e.vy = -Math.abs(e._baseSpd); }
      } else {
        if (!e.hideMode) e.hideMode = Math.random() < 0.20;
        if (e.hideMode && s.blocks.length > 0) {
          let bestBlock = null, bestDist = Infinity;
          s.blocks.forEach(block => {
            if (block.invulnerable) return;
            const cells = getBlockCells(block);
            cells.forEach(cell => {
              const cx = cell.x + BLOCK_SIZE / 2, cy = cell.y + BLOCK_SIZE / 2;
              if (cy < e.y) {
                const d = Math.hypot(cx - e.x, cy - e.y);
                if (d < bestDist) { bestDist = d; bestBlock = { cx, cy }; }
              }
            });
          });
          if (bestBlock && bestDist > 8) {
            const dx = bestBlock.cx - e.x, dy = bestBlock.cy - e.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const spd2 = Math.hypot(e.vx, e.vy) || 1;
            e.x += (dx / len) * spd2; e.y += (dy / len) * spd2;
          } else { e.x += e.vx; e.y += e.vy; }
        } else { e.x += e.vx; e.y += e.vy; }
        if (e.x < 20) { e.x = 20; e.vx = Math.abs(e.vx); }
        else if (e.x > W - 20) { e.x = W - 20; e.vx = -Math.abs(e.vx); }
        if (e.y < 20) { e.y = 20; e.vy = Math.abs(e.vy); }
        if (e.y > H - 20) { e.y = H - 20; e.vy = -Math.abs(e.vy); }
      }
    });

    // ─── In-stage Harvesters (shop upgrade) ──────────────────────────────────
    const harvesterLevel = shopUpgradesRef.current?.harvester || 0;
    const harvesterCount = Math.min(harvesterLevel, 3);
    while (s.harvesters.length < harvesterCount) {
      s.harvesters.push({ x: p.x + (s.harvesters.length % 2 === 0 ? -60 : 60), y: p.y + 30, angle: Math.random() * Math.PI * 2, state: 'orbit', orbitAngle: (s.harvesters.length / harvesterCount) * Math.PI * 2, targetBlock: null, targetCell: null, carryScore: 0 });
    }
    while (s.harvesters.length > harvesterCount) s.harvesters.pop();
    const harvSpeed = harvesterLevel <= 3 ? 1.5 : harvesterLevel <= 6 ? 2.5 : 3.5;
    s.harvesters.forEach(h => {
      if (h.state === 'orbit') {
        // Slowly orbit the player looking for blocks
        h.orbitAngle += 0.04;
        const orbitR = 80;
        const tx = p.x + Math.cos(h.orbitAngle) * orbitR;
        const ty = p.y + Math.sin(h.orbitAngle) * orbitR;
        h.x += (tx - h.x) * 0.08; h.y += (ty - h.y) * 0.08;
        // Find a block to target
        let best = null, bestDist = Infinity;
        s.blocks.forEach(block => {
          if (block.dead || block.invulnerable || block._harvesterClaimed) return;
          const cx = block.x + BLOCK_SIZE, cy = block.y + BLOCK_SIZE / 2;
          const d = Math.hypot(cx - h.x, cy - h.y);
          if (d < bestDist) { bestDist = d; best = block; }
        });
        if (!best) {
          s.piledCells.forEach((cell, idx) => {
            const cx = cell.x + BLOCK_SIZE / 2, cy = cell.y + BLOCK_SIZE / 2;
            const d = Math.hypot(cx - h.x, cy - h.y);
            if (d < bestDist) { bestDist = d; best = null; h.targetCell = idx; }
          });
        }
        if (best) { best._harvesterClaimed = true; h.targetBlock = best; h.state = 'harvest'; }
        else if (bestDist < 200) { h.state = 'harvest'; }
      } else if (h.state === 'harvest') {
        if (h.targetBlock && !h.targetBlock.dead) {
          const cx = h.targetBlock.x + BLOCK_SIZE, cy = h.targetBlock.y + BLOCK_SIZE / 2;
          const dx = cx - h.x, dy = cy - h.y, len = Math.hypot(dx, dy) || 1;
          h.x += (dx / len) * harvSpeed * 1.5; h.y += (dy / len) * harvSpeed * 1.5;
          if (len < 12) {
            h.targetBlock.hp -= 0.03;
            if (h.targetBlock.hp <= 0) {
              spawnExplosion(s, h.targetBlock.x, h.targetBlock.y, '#ff8800', 5);
              h.targetBlock.dead = true; h.carryScore += 15; h.targetBlock = null;
              h.state = 'return';
            }
          }
        } else if (h.targetCell !== null && s.piledCells[h.targetCell]) {
          const cell = s.piledCells[h.targetCell];
          const cx = cell.x + BLOCK_SIZE / 2, cy = cell.y + BLOCK_SIZE / 2;
          const dx = cx - h.x, dy = cy - h.y, len = Math.hypot(dx, dy) || 1;
          h.x += (dx / len) * harvSpeed * 1.5; h.y += (dy / len) * harvSpeed * 1.5;
          if (len < 10) {
            s.piledCells.splice(h.targetCell, 1); h.carryScore += 3; h.targetCell = null;
            h.state = 'return';
          }
        } else { h.targetBlock = null; h.targetCell = null; h.state = 'orbit'; }
      } else if (h.state === 'return') {
        const dx = p.x - h.x, dy = p.y - h.y, len = Math.hypot(dx, dy) || 1;
        h.x += (dx / len) * harvSpeed * 2; h.y += (dy / len) * harvSpeed * 2;
        if (len < 20 && h.carryScore > 0) {
          s.blockScore = (s.blockScore || 0) + h.carryScore;
          if (onBlockScoreChange) onBlockScoreChange(s.blockScore);
          h.carryScore = 0; h.state = 'orbit';
        }
      }
    });

    // ─── In-stage Drones (shop upgrade) ──────────────────────────────────────
    const droneLevel = shopUpgradesRef.current?.drone || 0;
    const droneCount = Math.min(droneLevel, 3);
    while (s.drones.length < droneCount) {
      s.drones.push({ x: p.x + (s.drones.length % 2 === 0 ? 50 : -50), y: p.y, orbitAngle: (s.drones.length / droneCount) * Math.PI * 2 + Math.PI * 0.5, state: 'orbit', target: null });
    }
    while (s.drones.length > droneCount) s.drones.pop();
    s.drones.forEach(d => {
      if (d.state === 'orbit') {
        d.orbitAngle += 0.025;
        const orbitR = 60 + s.drones.indexOf(d) * 20;
        const tx = p.x + Math.cos(d.orbitAngle) * orbitR;
        const ty = p.y + Math.sin(d.orbitAngle) * orbitR;
        d.x += (tx - d.x) * 0.05; d.y += (ty - d.y) * 0.05;
        // Look for dropper or powerup item nearby
        let best = null, bestDist = 999;
        s.enemies.forEach(e => {
          if (e.type !== 'dropper') return;
          const dist = Math.hypot(e.x - d.x, e.y - d.y);
          if (dist < bestDist) { bestDist = dist; best = { isDropper: true, ref: e }; }
        });
        s.powerupItems.forEach((item, idx) => {
          const dist = Math.hypot(item.x - d.x, item.y - d.y);
          if (dist < bestDist) { bestDist = dist; best = { isPowerup: true, idx }; }
        });
        if (best) { d.target = best; d.state = 'fetch'; }
      } else if (d.state === 'fetch') {
        let tx, ty, valid = false;
        if (d.target.isDropper && d.target.ref && !d.target.ref.dead) {
          tx = d.target.ref.x; ty = d.target.ref.y; valid = true;
        } else if (d.target.isPowerup) {
          const item = s.powerupItems[d.target.idx];
          if (item) { tx = item.x; ty = item.y; valid = true; }
        }
        if (!valid) { d.target = null; d.state = 'orbit'; return; }
        const dx = tx - d.x, dy = ty - d.y, len = Math.hypot(dx, dy) || 1;
        d.x += (dx / len) * 4.5; d.y += (dy / len) * 4.5;
        if (len < 16) {
          if (d.target.isDropper) {
            const dropper = d.target.ref;
            dropper._droneKillTimer = (dropper._droneKillTimer || 0) + 1;
            if (dropper._droneKillTimer >= 120) {
              dropper.dead = true; sounds.killDropper && sounds.killDropper();
              s.powerupItems.push({ x: dropper.x, y: dropper.y, type: dropper.dropType, angle: 0 });
              d.target = { isPowerup: true, idx: s.powerupItems.length - 1 };
              d._returnTimer = 0;
            }
          } else {
            // Push powerup toward player
            const item = s.powerupItems[d.target.idx];
            if (item) {
              const pdx = p.x - item.x, pdy = p.y - item.y, plen = Math.hypot(pdx, pdy) || 1;
              item.vx = (pdx / plen) * 5;
              item.vy = (pdy / plen) * 5;
              d._returnTimer = (d._returnTimer || 0) + 1;
              if (d._returnTimer >= 60) {
                item.x = p.x; item.y = p.y;
                d.target = null; d.state = 'orbit'; d._returnTimer = 0;
              }
            }
          }
        }
      }
    });

    if ((s.powerups.missile || 0) > 0) updateMissiles(s.bullets, s.enemies, W, H);
    updateHomingBullets(s.enemyBullets);

    s.bullets = s.bullets.filter(b => {
      b.x += b.vx; b.y += b.vy;
      if (b.type === 'photon') {
        b.orbitAngle = ((b.orbitAngle || 0) + 0.25);
        if (b.isSuperOrbit) b.orbitPhase = ((b.orbitPhase || 0) + 0.18);
      }
      if (b.type === 'bounce') {
        if (b.x <= 0 || b.x >= W) {
          if (b.bouncesLeft > 0) { b.vx *= -1; b.x = Math.max(1, Math.min(W - 1, b.x)); b.bouncesLeft--; }
          else return false;
        }
        if (b.y <= 0) {
          if (b.bouncesLeft > 0) { b.vy *= -1; b.y = Math.max(1, b.y); b.bouncesLeft--; }
          else return false;
        }
      }
      if (b.type === 'missile') return !b._outOfBounds;
      return b.y > -20 && b.y < H + 20 && b.x > -20 && b.x < W + 20;
    });

    s.enemies.forEach(e => {
      if (e.type === 'dropper' || e.type === 'mine' || e.type === 'eater' || e.type === 'berserk' || e.type === 'boss') return;
      e.fireTimer--;
      if (e.fireTimer <= 0) {
        const dx = p.x - e.x, dy = p.y - e.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        s.enemyBullets.push({ x: e.x, y: e.y, vx: (dx / len) * 2, vy: (dy / len) * 2 });
        e.fireTimer = s.wave > 3 ? 50 : 70;
      }
    });

    s.enemyBullets = s.enemyBullets.filter(b => {
      b.x += b.vx; b.y += b.vy;
      if (b.bouncing && b.bouncesLeft > 0) {
        if (b.x < 0 || b.x > W) { b.vx *= -1; b.x = Math.max(0, Math.min(W, b.x)); b.bouncesLeft--; }
        if (b.y < 0) { b.vy *= -1; b.y = Math.max(0, b.y); b.bouncesLeft--; }
      }
      for (let block of s.blocks) {
        if (!block.invulnerable) continue;
        const cells = getBlockCells(block);
        for (let cell of cells) {
          if (b.x >= cell.x && b.x <= cell.x + BLOCK_SIZE && b.y >= cell.y && b.y <= cell.y + BLOCK_SIZE) return false;
        }
      }
      return b.y < H + 20 && b.x > -20 && b.x < W + 20 && b.y > -20;
    });

    // Powerup items bounce off walls and never leave the screen
    s.powerupItems.forEach(item => {
      if (!item.vx) item.vx = (Math.random() - 0.5) * 1.5;
      if (!item.vy) item.vy = 1.2;
      item.x += item.vx;
      item.y += item.vy;
      item.angle = (item.angle || 0) + 0.04;
      // Bounce off left/right walls
      if (item.x < 16) { item.x = 16; item.vx = Math.abs(item.vx); }
      if (item.x > W - 16) { item.x = W - 16; item.vx = -Math.abs(item.vx); }
      // Bounce off top, and bounce off bottom wall
      if (item.y < 16) { item.y = 16; item.vy = Math.abs(item.vy); }
      if (item.y > H - 16) { item.y = H - 16; item.vy = -Math.abs(item.vy); }
    });
    // Never remove powerup items — they stay until collected

    s.blockSpawnTimer--;
    if (s.blockSpawnTimer <= 0) {
      s.blocks.push(spawnBlock(W));
      const blockSpeedMult = (difficultyConfig && difficultyConfig.blockSpeedMult) || 1;
      const blockSpawnMult = (difficultyConfig && difficultyConfig.blockSpawnMult) || 1;
      s.blockSpawnTimer = Math.max(20, Math.round((160 - s.wave * 8) / blockSpawnMult));
    }

    s.blocks.forEach(block => {
      if (block.settled) return;
      block.y += block.vy;
      const cells = getBlockCells(block);
      let shouldSettle = false;
      cells.forEach(cell => {
        if (cell.y + BLOCK_SIZE >= H) { shouldSettle = true; }
        s.piledCells.forEach(pc => {
          if (Math.abs(cell.x - pc.x) < BLOCK_SIZE * 0.8 && Math.abs((cell.y + BLOCK_SIZE) - pc.y) < 4) shouldSettle = true;
        });
      });
      if (shouldSettle) {
        block.settled = true;
        cells.forEach(cell => {
          const snappedY = Math.min(Math.round(cell.y / BLOCK_SIZE) * BLOCK_SIZE, H - BLOCK_SIZE);
          s.piledCells.push({ x: Math.round(cell.x / BLOCK_SIZE) * BLOCK_SIZE, y: snappedY, color: block.color });
        });
      }
    });
    s.blocks = s.blocks.filter(b => !b.settled);

    if (s.piledCells.length > 200) s.piledCells = s.piledCells.slice(-200);
    s.piledCells = s.piledCells.filter(c => c.y < H);

    function explodeSpread(b, newBullets) {
      if (b.type !== 'spread') return;
      const { pelletCount = 7, spreadDeg = 50 } = b;
      for (let i = 0; i < pelletCount; i++) {
        const angle = -spreadDeg / 2 + (spreadDeg / (pelletCount - 1)) * i;
        const rad = (angle * Math.PI) / 180;
        newBullets.push({ x: b.x, y: b.y, vx: Math.sin(rad) * 5, vy: -Math.cos(rad) * 6, type: 'spreadPellet' });
      }
    }

    // Bullet vs tier-4 boss armor
    s.enemies.forEach(e => {
      if (e.type !== 'boss' || (e.tier || 1) !== 4 || !e._armorBlocks || e._armorBlocks.length === 0) return;
      s.bullets.forEach(b => {
        if (b.hit) return;
        const armSz = BLOCK_SIZE / 2;
        for (let i = e._armorBlocks.length - 1; i >= 0; i--) {
          const piece = e._armorBlocks[i];
          const ax = e.x + piece.dx, ay = e.y + piece.dy;
          if (b.x >= ax - armSz && b.x <= ax + armSz && b.y >= ay - armSz && b.y <= ay + armSz) {
            piece.hp--;
            sounds.hit();
            spawnExplosion(s, ax, ay, piece.color, 4);
            if (piece.hp <= 0) e._armorBlocks.splice(i, 1);
            if (b.type !== 'photon') b.hit = true;
            break;
          }
        }
      });
    });

    const piercingTypes = [];
    const newSpreadPellets = [];
    s.bullets.forEach(b => {
      if (b.hit) return;
      s.enemies.forEach(e => {
        if (e.dead) return;
        const dx = b.x - e.x, dy = b.y - e.y;
        if (Math.abs(dx) < e.w && Math.abs(dy) < e.h) {
          if (b.type === 'spread') { explodeSpread(b, newSpreadPellets); b.hit = true; return; }
          if (b.type === 'photon') {
            const canPierce = !b.piercedEnemies?.includes(e) && (b.pierceCount > 0);
            if (b.piercedEnemies?.includes(e) && b.pierceCount <= 0) return;
            if (canPierce) { (b.piercedEnemies ||= []).push(e); b.pierceCount--; }
            e.hp--; sounds.hit();
            spawnExplosion(s, e.x, e.y, '#44ffaa', 4);
            if (e.hp <= 0) {
              e.dead = true;
              const pts = e.type === 'boss' ? 5000 : e.type === 'dropper' ? 500 : e.type === 'elite' ? 300 : e.type === 'mine' ? 300 : e.type === 'eater' ? 800 : 100;
              s.score += pts; onScoreChange(s.score); sounds.kill();
              spawnExplosion(s, e.x, e.y, e.type === 'boss' ? '#ff0066' : '#44ffaa', e.type === 'boss' ? 40 : 14);
              if (e.type === 'dropper') { sounds.killDropper(); s.powerupItems.push({ x: e.x, y: e.y, type: e.dropType, angle: 0 }); }
              if (e.type === 'boss') {
                sounds.stopBossMusicOnClear(); sounds.waveComplete();
                s.maxLives++; s.lives = Math.min(s.lives + 1, s.maxLives); onLivesChange(s.lives); onMaxLivesChange(s.maxLives);
                const milestoneBossWaves = [25, 50, 100];
                if (milestoneBossWaves.includes(s.wave)) { sounds.stopAllMusic(); s.running = false; setGameState('congratulations'); return; }
              }
            }
            return;
          }
          e.hp--; sounds.hit(); b.hit = true;
          if (e.type === 'mine' && e.hp === e.maxHp - 1 && !e._charging) {
            const dx2 = p.x - e.x, dy2 = p.y - e.y;
            const len = Math.hypot(dx2, dy2) || 1;
            e._chargeDx = dx2 / len; e._chargeDy = dy2 / len;
            e._charging = true; e._chargeDuration = 45;
            e._chargeTimer = randomBetween(60, 120); e._rechargeCooldown = 0;
          }
          if (e.hp <= 0) {
            e.dead = true;
            if (e.type === 'mine') {
              const MINE_RADIUS = 120;
              // Sprite-based explosion
              s.particles.push({ x: e.x, y: e.y, vx: 0, vy: 0, r: 10, alpha: 1, color: '#ff8800', shockwave: true, shockwaveR: 10, mineExplosion: true, mineExplosionTimer: 40 });
              spawnExplosion(s, e.x, e.y, '#ff8800', 40);
              spawnExplosion(s, e.x, e.y, '#ffdd00', 20);
              s.enemies.forEach(ne => {
                if (ne === e || ne.dead) return;
                if (Math.hypot(ne.x - e.x, ne.y - e.y) < MINE_RADIUS) {
                  ne.hp -= 3; spawnExplosion(s, ne.x, ne.y, '#ff8800', 12);
                  if (ne.hp <= 0) ne.dead = true;
                }
              });
              if (Math.hypot(p.x - e.x, p.y - e.y) < MINE_RADIUS) {
                const savedStar = s.starInvincibleTimer;
                s.starInvincibleTimer = 0; takeDamage(s); s.starInvincibleTimer = savedStar;
                spawnExplosion(s, p.x, p.y, '#ff8800', 18);
              }
            }
            const pts = e.type === 'boss' ? 5000 : e.type === 'dropper' ? 500 : e.type === 'elite' ? 300 : e.type === 'mine' ? 300 : e.type === 'eater' ? 800 : 100;
            s.score += pts; onScoreChange(s.score); sounds.kill();
            spawnExplosion(s, e.x, e.y,
              e.type === 'boss' ? '#ff0066' : e.type === 'dropper' ? (e.color || '#ffd700') : e.type === 'elite' ? '#ff44ff' : e.type === 'mine' ? '#ff8800' : e.type === 'eater' ? '#44ff88' : '#ff4444',
              e.type === 'boss' ? 40 : e.type === 'mine' ? 30 : e.type === 'eater' ? 20 : 14
            );
            if (e.type === 'dropper') { sounds.killDropper(); s.powerupItems.push({ x: e.x, y: e.y, type: e.dropType, angle: 0 }); }
            if (e.type === 'boss') {
              sounds.stopBossMusicOnClear(); sounds.waveComplete();
              s.maxLives++; s.lives = Math.min(s.lives + 1, s.maxLives); onLivesChange(s.lives); onMaxLivesChange(s.maxLives);
              const milestoneBossWaves = [25, 50, 100];
              if (milestoneBossWaves.includes(s.wave)) { sounds.stopAllMusic(); s.running = false; setGameState('congratulations'); }
            }
          }
        }
      });
    });

    s.bullets.push(...newSpreadPellets);

    const newSpreadPelletsFromBlocks = [];
    s.bullets.forEach(b => {
      if (b.hit) return;
      s.blocks.forEach(block => {
        if (block.dead) return;
        const cells = getBlockCells(block);
        cells.forEach(cell => {
          if (b.hit) return;
          if (b.x >= cell.x && b.x <= cell.x + BLOCK_SIZE && b.y >= cell.y && b.y <= cell.y + BLOCK_SIZE) {
            if (b.type === 'spread') { explodeSpread(b, newSpreadPelletsFromBlocks); b.hit = true; return; }
            if (block.invulnerable) { b.hit = true; spawnExplosion(s, b.x, b.y, '#aaaacc', 3); return; }
            block.hp -= b.type === 'photon' ? 2 : 1;
            if (!piercingTypes.includes(b.type)) b.hit = true;
            if (block.hp <= 0) { block.dead = true; s.blockScore = (s.blockScore || 0) + 15; s.score += 15; onScoreChange(s.score); if (onBlockScoreChange) onBlockScoreChange(s.blockScore); spawnExplosion(s, block.x + BLOCK_SIZE, block.y, block.color, 8); }
          }
        });
      });
    });
    s.bullets.push(...newSpreadPelletsFromBlocks);
    s.blocks = s.blocks.filter(b => !b.dead);

    const newSpreadPelletsFromPiled = [];
    s.bullets.forEach(b => {
      if (b.hit) return;
      s.piledCells = s.piledCells.filter(cell => {
        if (b.x >= cell.x && b.x <= cell.x + BLOCK_SIZE && b.y >= cell.y && b.y <= cell.y + BLOCK_SIZE) {
          if (b.type === 'spread') { explodeSpread(b, newSpreadPelletsFromPiled); b.hit = true; }
          else if (!piercingTypes.includes(b.type)) b.hit = true;
          s.blockScore = (s.blockScore || 0) + 3;
          s.score += 3; onScoreChange(s.score); if (onBlockScoreChange) onBlockScoreChange(s.blockScore);
          spawnExplosion(s, cell.x + BLOCK_SIZE / 2, cell.y + BLOCK_SIZE / 2, cell.color, 4);
          return false;
        }
        return true;
      });
    });
    s.bullets.push(...newSpreadPelletsFromPiled);
    s.bullets = s.bullets.filter(b => !b.hit);
    s.enemies = s.enemies.filter(e => !e.dead);

    if (s.starInvincibleTimer > 0) s.starInvincibleTimer--;

    s.powerupItems = s.powerupItems.filter(item => {
      const dx = item.x - p.x, dy = item.y - p.y;
      if (Math.sqrt(dx * dx + dy * dy) < 22) {
        if (item.type === 'star') {
          s.starInvincibleTimer = STAR_INVINCIBLE_FRAMES; sounds.powerup();
        } else if (item.type === 'shield') {
          s.shieldHp = Math.min(s.shieldHp + 1, 10); sounds.shield();
        } else if (item.type === 'speed') {
          s.powerups.speed = Math.min((s.powerups.speed || 0) + 1, 10); sounds.powerup();
        } else if (item.type === 'rapidfire') {
          s.powerups.rapidfire = Math.min((s.powerups.rapidfire || 0) + 1, 10); sounds.powerup();
        } else if (item.type === 'wingman') {
          s.powerups.wingman = Math.min((s.powerups.wingman || 0) + 1, 10); sounds.powerup();
        } else if (item.type === 'reverse') {
          s.powerups.reverse = Math.min((s.powerups.reverse || 0) + 1, 10); sounds.powerup();
        } else {
          const isLocked = s.lockedPowerups.includes(item.type);
          const canAdd = s.lockedPowerups.length < 3;
          if (!isLocked && !canAdd) { onPowerupChange({ ...s.powerups, shieldHp: s.shieldHp }); return false; }
          if (!isLocked) s.lockedPowerups.push(item.type);
          s.powerups[item.type] = Math.min((s.powerups[item.type] || 0) + 1, 10);
          sounds.powerup();
        }
        onPowerupChange({ ...s.powerups, shieldHp: s.shieldHp, armorHp: s.armorHp, starInvincible: s.starInvincibleTimer > 0 });
        return false;
      }
      return true;
    });

    const destroyedEnemyBullets = new Set();
    s.bullets.forEach(pb => {
      if (pb.hit) return;
      s.enemyBullets.forEach((eb, idx) => {
        const dx = pb.x - eb.x, dy = pb.y - eb.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 8) {
          spawnExplosion(s, (pb.x + eb.x) / 2, (pb.y + eb.y) / 2, '#ffaa00', 3);
          pb.hit = true; destroyedEnemyBullets.add(idx);
        }
      });
    });
    s.enemyBullets = s.enemyBullets.filter((_, idx) => !destroyedEnemyBullets.has(idx));

    s.enemyBullets = s.enemyBullets.filter(b => {
      const dx = b.x - p.x, dy = b.y - p.y;
      if (Math.sqrt(dx * dx + dy * dy) < 14) {
        spawnExplosion(s, p.x, p.y, '#00f0ff', 10); takeDamage(s); return false;
      }
      return true;
    });

    s.enemies.forEach(e => {
      if (e.dead) return;
      const dx = e.x - p.x, dy = e.y - p.y;
      if (Math.abs(dx) < 18 && Math.abs(dy) < 18) {
        if (s.starInvincibleTimer > 0 && e.type === 'boss') {
          e.x += (e.x - p.x) * 0.3; e.y += (e.y - p.y) * 0.3; return;
        }
        if (e.type === 'mine') {
          const MINE_RADIUS = 120;
          s.particles.push({ x: e.x, y: e.y, vx: 0, vy: 0, r: 10, alpha: 1, color: '#ff8800', shockwave: true, shockwaveR: 10, mineExplosion: true, mineExplosionTimer: 40 });
          spawnExplosion(s, e.x, e.y, '#ff8800', 40);
          spawnExplosion(s, e.x, e.y, '#ffdd00', 20);
          s.enemies.forEach(ne => {
            if (ne === e || ne.dead) return;
            if (Math.hypot(ne.x - e.x, ne.y - e.y) < MINE_RADIUS) { ne.hp -= 2; spawnExplosion(s, ne.x, ne.y, '#ff8800', 8); if (ne.hp <= 0) ne.dead = true; }
          });
          s.score += 300; onScoreChange(s.score); takeDamage(s); spawnExplosion(s, p.x, p.y, '#ff8800', 12); e.dead = true;
        } else if (e.type === 'eater') {
          spawnExplosion(s, p.x, p.y, '#44ff88', 12); takeDamage(s);
          const edx = e.x - p.x, edy = e.y - p.y;
          const elen = Math.hypot(edx, edy) || 1;
          e.x += (edx / elen) * 30; e.y += (edy / elen) * 30; e._chargingPlayer = false;
        } else {
          e.dead = true; spawnExplosion(s, e.x, e.y, '#ff4444', 12); takeDamage(s);
        }
      }
    });
    s.enemies = s.enemies.filter(e => !e.dead);

    s.blocks.forEach(block => {
      getBlockCells(block).forEach(cell => {
        if (p.x >= cell.x - 10 && p.x <= cell.x + BLOCK_SIZE + 10 &&
            p.y >= cell.y - 10 && p.y <= cell.y + BLOCK_SIZE + 10) {
          if (!block._dmgCooldown || block._dmgCooldown <= 0) { takeDamage(s); spawnExplosion(s, p.x, p.y, block.color, 8); block._dmgCooldown = 60; }
        }
      });
      if (block._dmgCooldown > 0) block._dmgCooldown--;
    });

    s.piledCells.forEach(cell => {
      if (!cell._dmgCooldown) cell._dmgCooldown = 0;
      if (p.x >= cell.x - 8 && p.x <= cell.x + BLOCK_SIZE + 8 && p.y >= cell.y - 8 && p.y <= cell.y + BLOCK_SIZE + 8) {
        if (cell._dmgCooldown <= 0) { takeDamage(s); spawnExplosion(s, p.x, p.y, cell.color, 8); cell._dmgCooldown = 60; }
      }
      cell._dmgCooldown = Math.max(0, (cell._dmgCooldown || 0) - 1);
    });

    const combatEnemies = s.enemies.filter(e => e.type !== 'dropper' && e.type !== 'eater');
    if (combatEnemies.length === 0 && s.bossWarning && s.bossWarning.active) {
      // wait
    } else if (combatEnemies.length === 0) {
      s.waveTimer++;
      if (s.waveTimer > 90) {
        s.wave++; onWaveChange(s.wave); sounds.waveComplete();
        // Milestone levels (25/50/100) are boss waves — congratulations fires when boss dies (handled in kill logic)
        const milestoneLevels = [25, 50, 100];
        if (milestoneLevels.includes(s.wave)) {
          // Don't auto-congratulate here — let boss kill handle it
          // just continue and spawn the boss wave
        }
        s.waveTimer = 0;
        // Restore some armor each wave (repair upgrade)
        const repairLevel = shopUpgradesRef.current?.repair || 0;
        if (repairLevel > 0) {
          const maxArmor = (shopUpgradesRef.current?.armor || 0) * 3;
          s.armorHp = Math.min(s.armorHp + repairLevel, maxArmor);
        }
        const survivingPersistent = s.enemies.filter(e => e.type === 'dropper' || e.type === 'eater');
        spawnWave(W, s);
        s.enemies.push(...survivingPersistent);
      }
    } else {
      s.waveTimer = 0;
    }

    if (s.invincibleTimer > 0) s.invincibleTimer--;

    // Invincible powerdown warning — play sound when ~60 frames left
    if (s.starInvincibleTimer === 60) {
      sounds.invinciblePowerdown && sounds.invinciblePowerdown();
    }

    s.particles.forEach(pt => {
      if (pt.mineExplosion) {
        pt.mineExplosionTimer = (pt.mineExplosionTimer || 0) - 1;
        pt.alpha = Math.max(0, pt.mineExplosionTimer / 40);
      } else if (pt.shockwave) {
        pt.shockwaveR += 4; pt.alpha -= 0.04;
      } else {
        pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.04; pt.alpha -= 0.025;
      }
    });
    s.particles = s.particles.filter(pt => pt.alpha > 0);
    if (s.particles.length > 500) s.particles = s.particles.slice(-500);

    s.particles.forEach(pt => {
      if (pt.mineExplosion) {
        const mineExpImg = getSprite('MineExplosion');
        const sz = 120 + (40 - (pt.mineExplosionTimer || 0)) * 3;
        if (mineExpImg) {
          ctx.save();
          ctx.globalAlpha = pt.alpha;
          ctx.drawImage(mineExpImg, pt.x - sz / 2, pt.y - sz / 2, sz, sz);
          ctx.restore();
        } else {
          ctx.save();
          ctx.globalAlpha = pt.alpha * 0.6;
          ctx.strokeStyle = '#ff8800'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(pt.x, pt.y, sz / 2, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
        }
      } else {
        drawParticle(ctx, pt);
      }
    });
    drawPiledCells(ctx, s.piledCells);
    s.blocks.forEach(b => drawBlock(ctx, b));
    s.powerupItems.forEach(item => drawPowerupItem(ctx, item));
    s.enemies.forEach(e => drawEnemy(ctx, e));
    s.enemies.forEach(e => {
      if (e.type !== 'boss') return;
      const bt = e.tier || 1;
      if (bt === 3) { drawBossSweepLaser(ctx, e); drawBossSuperLaser(ctx, e); }
      if (bt === 4) { drawBossTier4Armor(ctx, e, BLOCK_SIZE); }
    });
    s.bullets.forEach(b => drawBullet(ctx, b, false));
    s.enemyBullets.forEach(b => drawBullet(ctx, b, true));
    // Draw harvesters
    s.harvesters.forEach(h => {
      const harvImg = getSprite('Harvester');
      ctx.save();
      ctx.translate(h.x, h.y);
      if (h.state === 'return' && h.carryScore > 0) {
        ctx.shadowColor = '#ff8800'; ctx.shadowBlur = 16;
      } else {
        ctx.shadowColor = '#ffaa44'; ctx.shadowBlur = 8;
      }
      if (harvImg) {
        ctx.drawImage(harvImg, -18, -18, 36, 36);
      } else {
        // Procedural: mining drill shape
        ctx.strokeStyle = '#ff8800'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#ff880033'; ctx.fill();
        ctx.strokeStyle = '#ffaa44'; ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2;
          ctx.beginPath(); ctx.moveTo(Math.cos(a) * 10, Math.sin(a) * 10); ctx.lineTo(Math.cos(a) * 16, Math.sin(a) * 16); ctx.stroke();
        }
      }
      if (h.carryScore > 0) {
        ctx.fillStyle = '#ffdd00'; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(`+${h.carryScore}`, 0, 12);
      }
      ctx.restore();
    });

    // Draw drones
    s.drones.forEach(d => {
      const droneImg = getSprite('Drone');
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.shadowColor = '#ffdd00'; ctx.shadowBlur = d.state === 'fetch' ? 16 : 8;
      if (droneImg) {
        ctx.drawImage(droneImg, -16, -16, 32, 32);
      } else {
        // Procedural: small round drone
        ctx.strokeStyle = '#ffdd00'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#ffdd0022'; ctx.fill();
        ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fillStyle = '#ffdd00'; ctx.fill();
        // Rotors
        ctx.strokeStyle = '#ffaa00'; ctx.lineWidth = 1;
        [[-12, -12], [12, -12], [-12, 12], [12, 12]].forEach(([rx, ry]) => {
          ctx.save(); ctx.translate(rx, ry);
          ctx.beginPath(); ctx.ellipse(0, 0, 5, 2, d.orbitAngle * 3, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
        });
      }
      ctx.restore();
    });

    drawPlayer(ctx, p, s.wingmen, s.shieldHp, s.enemies, s.invincibleTimer, keys, s.starInvincibleTimer, s.superWingman, s.superWingmen, s.armorHp);

    const reverseTier = s.powerups.reverse || 0;
    if (reverseTier >= 10) drawReverseFlame(ctx, p, reverseTier, Date.now());

    if ((s.powerups.laser || 0) > 0) {
      const laserTier = s.powerups.laser;
      const beamW = laserTier >= 10 ? (4 + laserTier * 3) * 2 : 4 + laserTier * 3;
      const isPiercingDraw = laserTier >= 10;
      const beamColor = isPiercingDraw ? '#ffffff' : '#ff44ff';
      const beamColorRgb = isPiercingDraw ? '255,255,255' : '255,68,255';
      const beamCenterRgb = isPiercingDraw ? '255,255,255' : '255,200,255';

      if (s.laserBeamActive) {
        const beamEndY = (s.laserBeamBlockY || 0);
        const beamAlpha = 0.7 + Math.sin(Date.now() * 0.03) * 0.3;
        ctx.save();
        // Single shadow pass — set once and draw outer + core together
        ctx.shadowColor = beamColor; ctx.shadowBlur = 24;
        ctx.strokeStyle = `rgba(${beamColorRgb},${beamAlpha * 0.35})`; ctx.lineWidth = beamW * 3;
        ctx.beginPath(); ctx.moveTo(p.x, p.y - 18); ctx.lineTo(p.x, beamEndY); ctx.stroke();
        ctx.shadowBlur = 0; // disable for inner pass — no need to redraw glow
        ctx.strokeStyle = `rgba(${beamColorRgb},${beamAlpha})`; ctx.lineWidth = beamW;
        ctx.beginPath(); ctx.moveTo(p.x, p.y - 18); ctx.lineTo(p.x, beamEndY); ctx.stroke();
        ctx.strokeStyle = `rgba(${beamCenterRgb},0.9)`; ctx.lineWidth = beamW * 0.3;
        ctx.beginPath(); ctx.moveTo(p.x, p.y - 18); ctx.lineTo(p.x, beamEndY); ctx.stroke();
        ctx.restore();
        const beamPct = s.laserBeamTimer / LASER_BEAM_FRAMES;
        ctx.save();
        ctx.strokeStyle = `rgba(${beamColorRgb},0.6)`; ctx.lineWidth = 3; ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.arc(p.x, p.y, 32, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * beamPct);
        ctx.stroke(); ctx.restore();
      } else if (s.laserCooldown > 0) {
        ctx.save();
        ctx.strokeStyle = 'rgba(180,180,180,0.3)'; ctx.lineWidth = 3; ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.arc(p.x, p.y, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - s.laserCooldown / LASER_COOLDOWN_FRAMES));
        ctx.stroke(); ctx.restore();
      } else {
        const pct = Math.min(s.laserCharge / LASER_CHARGE_FRAMES, 1);
        ctx.save();
        ctx.strokeStyle = `rgba(${beamColorRgb},${0.4 + pct * 0.6})`;
        ctx.shadowColor = beamColor; ctx.shadowBlur = 6 + pct * 10; ctx.lineWidth = 2 + pct * 3;
        ctx.beginPath(); ctx.arc(p.x, p.y, 28 + pct * 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
        ctx.stroke(); ctx.restore();
      }
    }

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
      if (carryOverPowerups) {
        const shieldHp = carryOverPowerups.shieldHp || 0;
        delete carryOverPowerups.shieldHp;
        delete carryOverPowerups.starInvincible;
        s.powerups = { ...carryOverPowerups };
        s.shieldHp = shieldHp;
        s.lockedPowerups = GUN_TYPES.filter(g => (s.powerups[g] || 0) > 0);
      }
      s.wave = startWave > 1 ? startWave : 1;
      s.armorHp = (shopUpgradesRef.current?.armor || 0) * 3;
      s.harvesters = [];
      s.drones = [];
      s.running = true;
      onWaveChange(s.wave);
      spawnWave(W, s);
      lastTimeRef.current = performance.now();
      animRef.current = requestAnimationFrame(loop);
    } else if (gameState === 'resuming') {
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

  useEffect(() => {
    const down = e => { keysRef.current[e.key] = true; };
    const up = e => { keysRef.current[e.key] = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      <MobileControls keysRef={keysRef} />
    </>
  );
}