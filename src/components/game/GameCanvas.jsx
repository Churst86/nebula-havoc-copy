import React, { useRef, useEffect, useCallback } from 'react';
import MobileControls from './MobileControls';
import { sounds } from '../../hooks/useSound.js';

// Laser beam constants
const LASER_CHARGE_FRAMES = 60;      // frames to charge before firing
const LASER_BEAM_FRAMES = 180;       // frames beam stays active (~3 sec)
const LASER_COOLDOWN_FRAMES = 150;   // frames of cooldown after beam ends

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
    powerups: {},
    lockedPowerups: [],
    shieldHp: 0,
    running: false,
    starInvincibleTimer: 0,   // frames of star invincibility
    dropperSpawnTimer: 0,     // timer to spawn dropper mid-wave
    gunDroppedThisWave: [],   // gun powerup types already dropped this wave
    auxDroppedThisWave: [],   // auxiliary upgrade types already dropped this wave
    starDroppedThisWave: false, // star only drops once per wave
  };
}

// Offensive powerup types that count toward the 2-lock system
const OFFENSIVE_POWERUPS = ['spread', 'laser', 'raygun', 'bounce'];
// Special powerups that bypass the 2-lock
const SPECIAL_POWERUPS = ['speed', 'shield', 'shotspeed', 'wingman'];
// Auxiliary upgrades (one per wave each)
const AUXILIARY_UPGRADES = ['speed', 'shotspeed', 'wingman', 'shield'];

const STAR_INVINCIBLE_FRAMES = 600; // 10 seconds at 60fps

// Dropper enemy appearance per powerup type
const DROPPER_COLORS = {
  spread: '#ffdd00', laser: '#ff44ff', raygun: '#44ffaa',
  wingman: '#44aaff', shield: '#00ccff', bounce: '#aaff00',
  speed: '#ff8800', rapidfire: '#ff4488', star: '#ffffff',
};
const DROPPER_LABELS = {
  spread: 'S', laser: 'L', raygun: 'R', wingman: 'W',
  shield: '🛡', bounce: 'B', speed: '▶', rapidfire: '⚡', star: '★',
};

export default function GameCanvas({ gameState, setGameState, onScoreChange, onLivesChange, onMaxLivesChange, onWaveChange, onPowerupChange, continuesLeft, onContinueUsed }) {
  const canvasRef = useRef(null);
  const keysRef = useRef({});
  const stateRef = useRef(initState());
  const animRef = useRef(null);
  const lastTimeRef = useRef(0);

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
    const count = 5 + wave * 2;
    const enemies = [];

    if (wave % 5 === 0) {
      const bossHp = 200 + wave * 25;
      enemies.push({
        type: 'boss', x: W / 2, y: -60, w: 45, h: 45,
        hp: bossHp, maxHp: bossHp, vx: 1.8, vy: 0.4, fireTimer: 20, phase: 0,
      });
      sounds.startBossMusic();
    } else {
      sounds.startWaveMusic(wave);
    }

    for (let i = 0; i < count; i++) {
      const isElite = wave > 3 && Math.random() < 0.25;
      enemies.push({
        type: isElite ? 'elite' : 'basic',
        x: randomBetween(40, W - 40),
        y: -30 - i * 28,
        w: isElite ? 22 : 18, h: isElite ? 22 : 18,
        hp: isElite ? 3 : 1, maxHp: isElite ? 3 : 1,
        vx: randomBetween(-0.8, 0.8) * (1 + wave * 0.05),
        vy: (0.5 + wave * 0.08) * (Math.random() * 0.5 + 0.75),
        fireTimer: randomBetween(60, 120),
      });
    }
    // Spawn 1-2 bomb enemies starting wave 2
    if (wave >= 2) {
      const bombCount = wave >= 6 ? 2 : 1;
      for (let i = 0; i < bombCount; i++) {
        enemies.push({
          type: 'bomb',
          x: randomBetween(50, W - 50),
          y: -50 - i * 40,
          w: 20, h: 20,
          hp: 2, maxHp: 2,
          vx: randomBetween(-0.6, 0.6),
          vy: (0.4 + wave * 0.05),
          fireTimer: 9999, // bombs don't shoot
        });
      }
    }
    s.enemies = enemies;

    // Reset per-wave dropper state — dropper will appear mid-wave
    s.dropperSpawnTimer = randomBetween(200, 400); // ~3-6 seconds in
    s.gunDroppedThisWave = [];
    s.auxDroppedThisWave = [];
    s.starDroppedThisWave = false;
  }

  function spawnDropper(W, s) {
    // Guns: only if not already dropped this wave (one per gun type)
    const availableGuns = OFFENSIVE_POWERUPS.filter(g => !s.gunDroppedThisWave.includes(g));
    const gunPool = s.lockedPowerups.length >= 2
      ? s.lockedPowerups.filter(g => !s.gunDroppedThisWave.includes(g))
      : availableGuns;
    // Aux upgrades: only if not already dropped this wave
    const auxPool = AUXILIARY_UPGRADES.filter(a => !s.auxDroppedThisWave.includes(a));
    // Star: once per wave
    const starPool = s.starDroppedThisWave ? [] : ['star'];

    const dropPool = [...gunPool, ...auxPool, ...starPool];
    if (dropPool.length === 0) return;

    const dropType = dropPool[Math.floor(Math.random() * dropPool.length)];
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

  // ── Fire logic ───────────────────────────────────────────────
  function fireSpreadShot(s) {
    const p = s.player;
    const spreadTier = s.powerups.spread || 0;
    if (spreadTier === 0) return;
    if (s.spreadReloadTimer > 0) return;
    if (s.spreadShotsLeft <= 0) return;
    // Fire a single fast bullet straight up — it explodes into spread on hit
    const pelletCount = spreadTier === 1 ? 7 : spreadTier === 2 ? 9 : 11;
    const spreadDeg = spreadTier === 1 ? 50 : spreadTier === 2 ? 100 : 150;
    s.bullets.push({ x: p.x, y: p.y - 18, vx: 0, vy: -10, type: 'spread', spreadTier, pelletCount, spreadDeg, armed: false });
    s.spreadShotsLeft--;
    if (s.spreadShotsLeft <= 0) s.spreadReloadTimer = SPREAD_RELOAD_FRAMES;
  }

  function playerFire(s) {
    const p = s.player;
    const pw = s.powerups;
    const laserTier  = pw.laser  || 0;
    const raygunTier = pw.raygun || 0;
    const bounceTier = pw.bounce || 0;

    // Raygun: fires a single large plasma orb straight up (bigger with tier), max 2 on screen
    if (raygunTier > 0 && s.bullets.filter(b => b.type === 'raygun').length < 2) {
      const size = 6 + raygunTier * 3; // 9, 12, 15
      s.bullets.push({ x: p.x, y: p.y - 14, vx: 0, vy: -11, type: 'raygun', size, orbitAngle: 0 });
    }

    if (bounceTier > 0) {
      const bounces = bounceTier * 2;
      const side = Math.floor(s.spiralAngle * 2) % 2 === 0 ? -1 : 1;
      s.spiralAngle += 0.1;
      s.bullets.push({ x: p.x + side * 8, y: p.y - 14, vx: side * 3.5, vy: -10, type: 'bounce', bouncesLeft: bounces });
    }

    // Basic gun always fires (laser beam is the only exception — handled by laserBeamActive guard above)
    s.bullets.push({ x: p.x, y: p.y - 18, vx: 0, vy: -7, type: 'normal' });
  }

  function getFireRate(pw) {
    const speedBonus = (pw.rapidfire || 0) === 1 ? 10 : (pw.rapidfire || 0) * 8;
    if ((pw.raygun || 0) > 0) return Math.max(14, 50 - (pw.raygun || 0) * 4 - speedBonus);
    if ((pw.spread || 0) > 0 && (pw.raygun || 0) === 0 && (pw.bounce || 0) === 0) return Math.max(12, 50 - speedBonus);
    if ((pw.bounce || 0) > 0) return Math.max(10, 35 - speedBonus);
    return Math.max(10, 35 - speedBonus);
  }

  // ── Tetris block helpers ─────────────────────────────────────
  function spawnBlock(W) {
    const shapeIdx = Math.floor(Math.random() * TETRIS_SHAPES.length);
    const shape = TETRIS_SHAPES[shapeIdx];
    // 8% chance of invulnerable steel block
    const isInvulnerable = Math.random() < 0.08;
    const color = isInvulnerable ? '#aaaacc' : BLOCK_COLORS[Math.floor(Math.random() * BLOCK_COLORS.length)];
    const cols = shape.map(c => c[0]);
    const maxCol = Math.max(...cols);
    const startX = randomBetween(BLOCK_SIZE, W - (maxCol + 1) * BLOCK_SIZE);
    // HP scales with number of cells: 2 cells=1hp, 3 cells=2hp, 4 cells=3hp
    const cellCount = shape.length;
    const hp = cellCount <= 2 ? 1 : cellCount === 3 ? 2 : 3;
    return { shape, color, x: startX, y: -BLOCK_SIZE * 2, vy: 0.6 + Math.random() * 0.4, hp, maxHp: hp, settled: false, invulnerable: isInvulnerable };
  }

  function getBlockCells(block) {
    return block.shape.map(([col, row]) => ({
      x: block.x + col * BLOCK_SIZE,
      y: block.y + row * BLOCK_SIZE,
    }));
  }

  function drawBlock(ctx, block) {
    const alpha = block.invulnerable ? 1 : (block.hp / block.maxHp);
    ctx.save();
    block.shape.forEach(([col, row]) => {
      const bx = block.x + col * BLOCK_SIZE;
      const by = block.y + row * BLOCK_SIZE;
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
      ctx.shadowColor = cell.color; ctx.shadowBlur = 6;
      ctx.fillStyle = cell.color + '99';
      ctx.fillRect(cell.x + 1, cell.y + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
      ctx.strokeStyle = cell.color;
      ctx.lineWidth = 1;
      ctx.strokeRect(cell.x + 1, cell.y + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
      ctx.restore();
    });
  }

  // ── Drawing ──────────────────────────────────────────────────
  function drawPlayer(ctx, p, wingmen, shieldHp, enemies, invincibleTimer, keys, starInvincibleTimer) {
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
      ctx.strokeStyle = '#44aaff'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -10); ctx.lineTo(8, 8); ctx.lineTo(0, 4); ctx.lineTo(-8, 8); ctx.closePath();
      ctx.stroke();
      ctx.restore();
    });

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
    ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 18;
    ctx.strokeStyle = '#00f0ff'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -18); ctx.lineTo(13, 12); ctx.lineTo(0, 6); ctx.lineTo(-13, 12); ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,240,255,0.15)';
    ctx.fill();

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
  }

  function drawEnemy(ctx, e) {
    ctx.save();
    ctx.translate(e.x, e.y);

    if (e.type === 'boss') {
      ctx.shadowColor = '#ff0066'; ctx.shadowBlur = 30;
      ctx.strokeStyle = '#ff0066'; ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 === 0 ? 40 : 28;
        i === 0 ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,0,102,0.1)'; ctx.fill();
      ctx.fillStyle = '#ff0066';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('☠', 0, 0);
    } else if (e.type === 'dropper') {
      const c = e.color || '#ffd700';
      ctx.shadowColor = c; ctx.shadowBlur = 18;
      ctx.strokeStyle = c; ctx.lineWidth = 2;
      // Diamond shape
      ctx.beginPath();
      ctx.moveTo(0, -18); ctx.lineTo(14, 0); ctx.lineTo(0, 18); ctx.lineTo(-14, 0); ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = c + '22'; ctx.fill();
      ctx.fillStyle = c;
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(DROPPER_LABELS[e.dropType] || '★', 0, 1);
    } else if (e.type === 'bomb') {
      const mad = e.hp < e.maxHp; // hit once = mad
      const pulse = 0.7 + Math.sin(Date.now() * (mad ? 0.018 : 0.008)) * 0.3;
      const bombColor = mad ? `rgba(255,${Math.floor(80 + pulse * 80)},0,1)` : '#ff8800';
      ctx.shadowColor = bombColor; ctx.shadowBlur = 16 + pulse * 10;
      // Body — circle
      ctx.fillStyle = mad ? `rgba(255,${Math.floor(60 + pulse * 60)},0,0.85)` : 'rgba(255,136,0,0.85)';
      ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = bombColor; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.stroke();
      // Fuse on top
      ctx.strokeStyle = '#ffdd00'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(2, -16); ctx.quadraticCurveTo(10, -26, 6, -32); ctx.stroke();
      // Fuse spark
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(6, -32, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffff00';
      ctx.beginPath(); ctx.arc(6, -32, 1.5, 0, Math.PI * 2); ctx.fill();
      // Face
      ctx.fillStyle = mad ? '#fff' : '#330000';
      ctx.font = `bold ${mad ? 14 : 12}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(mad ? '>_<' : '^_^', 0, 2);
    } else if (e.type === 'elite') {
      ctx.shadowColor = '#ff44ff'; ctx.shadowBlur = 14;
      ctx.strokeStyle = '#ff44ff'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -11); ctx.lineTo(11, 11); ctx.lineTo(-11, 11); ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,68,255,0.1)'; ctx.fill();
    } else {
      ctx.shadowColor = '#ff4444'; ctx.shadowBlur = 10;
      ctx.strokeStyle = '#ff4444'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, 9); ctx.lineTo(9, -9); ctx.lineTo(-9, -9); ctx.closePath();
      ctx.stroke();
    }

    if (e.maxHp > 1) {
      const bw = e.type === 'boss' ? 70 : 28, bh = 3;
      const bx = -bw / 2, by = e.type === 'boss' ? 48 : 22;
      ctx.fillStyle = '#333'; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = e.type === 'boss' ? '#ff0066' : (e.color || '#ff44ff');
      ctx.fillRect(bx, by, bw * (e.hp / e.maxHp), bh);
    }
    ctx.restore();
  }

  function drawBullet(ctx, b, isEnemy) {
    ctx.save();
    if (b.type === 'spreadPellet') {
      ctx.shadowColor = '#ffdd00'; ctx.shadowBlur = 8;
      ctx.fillStyle = '#ffdd00';
      ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
    } else if (b.type === 'wingman') {
      ctx.shadowColor = '#aaddff'; ctx.shadowBlur = 8;
      ctx.fillStyle = '#aaddff';
      ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
    } else if (b.type === 'spread') {
      ctx.shadowColor = '#ffdd00'; ctx.shadowBlur = 12;
      ctx.fillStyle = '#ffdd00';
      ctx.fillRect(b.x - 2, b.y - 9, 4, 18);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(b.x - 1, b.y - 9, 2, 18);
    } else if (b.type === 'bounce') {
      ctx.shadowColor = '#aaff00'; ctx.shadowBlur = 12;
      ctx.fillStyle = '#aaff00';
      ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(b.x, b.y, 2, 0, Math.PI * 2); ctx.fill();
    } else if (b.type === 'laser') {
      const w = 3 + (b.fat || 1) * 2;
      ctx.shadowColor = '#ff44ff'; ctx.shadowBlur = 14 + (b.fat || 1) * 4;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(b.x - w * 0.3, b.y - 12, w * 0.6, 22);
      ctx.fillStyle = '#ff44ff';
      ctx.fillRect(b.x - w, b.y - 12, w * 2, 22);
    } else if (b.type === 'raygun') {
      const sz = b.size || 9;
      // Outer glow
      ctx.shadowColor = '#44ffaa'; ctx.shadowBlur = sz * 2;
      ctx.fillStyle = 'rgba(68,255,170,0.25)';
      ctx.beginPath(); ctx.arc(b.x, b.y, sz + 4, 0, Math.PI * 2); ctx.fill();
      // Main orb
      ctx.fillStyle = '#44ffaa';
      ctx.beginPath(); ctx.arc(b.x, b.y, sz, 0, Math.PI * 2); ctx.fill();
      // Bright core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(b.x, b.y, sz * 0.4, 0, Math.PI * 2); ctx.fill();
      // Orbiting orbs (count = tier)
      const orbitCount = Math.round((sz - 6) / 3) + 2; // 2–4
      for (let oi = 0; oi < orbitCount; oi++) {
        const oa = (b.orbitAngle || 0) + (oi / orbitCount) * Math.PI * 2;
        const ox = b.x + Math.cos(oa) * (sz + 8);
        const oy = b.y + Math.sin(oa) * (sz + 8);
        ctx.shadowColor = '#44ffaa'; ctx.shadowBlur = 8;
        ctx.fillStyle = '#44ffaa';
        ctx.beginPath(); ctx.arc(ox, oy, 3, 0, Math.PI * 2); ctx.fill();
      }
    } else if (isEnemy) {
      const isBoss = b.boss;
      ctx.shadowColor = isBoss ? '#ff0066' : '#ff6600'; ctx.shadowBlur = isBoss ? 14 : 8;
      ctx.fillStyle = isBoss ? '#ff0066' : '#ff6600';
      ctx.beginPath(); ctx.arc(b.x, b.y, isBoss ? 6 : 4, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 8;
      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(b.x - 1.5, b.y - 7, 3, 14);
    }
    ctx.restore();
  }

  function drawPowerupItem(ctx, item) {
    const colors = { spread: '#ffdd00', laser: '#ff44ff', raygun: '#44ffaa', wingman: '#44aaff', shield: '#00ccff', bounce: '#aaff00', speed: '#ff8800', shotspeed: '#ff4488', star: '#ffffff' };
    const labels = { spread: 'S', laser: 'L', raygun: 'R', wingman: 'W', shield: '🛡', bounce: 'B', speed: '▶', shotspeed: '⚡', star: '★' };
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(item.angle || 0);

    if (item.type === 'star') {
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
      const c = colors[item.type] || '#fff';
      ctx.shadowColor = c; ctx.shadowBlur = 16;
      ctx.strokeStyle = c; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = c + '33'; ctx.fill();
      ctx.fillStyle = c;
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(labels[item.type], 0, 0);
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
    if (s.shieldHp > 0) {
      s.shieldHp--;
      sounds.shieldHit();
      if (s.shieldHp === 0) { sounds.shieldBreak(); delete s.powerups.shield; }
      onPowerupChange({ ...s.powerups, shieldHp: s.shieldHp });
      return;
    }
    // Invincibility frames — ignore health damage while active (damage invincibility or star)
    if (s.invincibleTimer > 0 || s.starInvincibleTimer > 0) return;
    s.lives--;
    s.invincibleTimer = 120; // 2 seconds at 60fps
    onLivesChange(s.lives);
    sounds.playerHit();
    if (s.lives <= 0) { sounds.stopAllMusic(); s.running = false; setGameState('continue'); }
  }

  // ── Main loop ────────────────────────────────────────────────
  const loop = useCallback((timestamp) => {
    if (!stateRef.current.running) return;
    lastTimeRef.current = timestamp;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const s = stateRef.current;
    const keys = keysRef.current;

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
    const speedTier = s.powerups.speed || 0;
    const spd = 4.5 + speedTier * 1.5;
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) p.x = Math.max(16, p.x - spd);
    if (keys['ArrowRight'] || keys['d'] || keys['D']) p.x = Math.min(W - 16, p.x + spd);
    if (keys['ArrowUp'] || keys['w'] || keys['W']) p.y = Math.max(16, p.y - spd);
    if (keys['ArrowDown'] || keys['s'] || keys['S']) p.y = Math.min(H - 16, p.y + spd);

    // Wingmen follow — tier 1 = 1 wingman, tier 2 = 2, tier 3 = 3
    if ((s.powerups.wingman || 0) > 0) {
      const tier = s.powerups.wingman;
      const offsets = [
        { x: -40, y: 10 }, { x: 40, y: 10 }, { x: 0, y: 25 },
      ].slice(0, tier);
      const targets = offsets.map(o => ({ x: p.x + o.x, y: p.y + o.y }));
      while (s.wingmen.length < targets.length) s.wingmen.push({ ...targets[s.wingmen.length] });
      while (s.wingmen.length > targets.length) s.wingmen.pop();
      s.wingmen.forEach((w, i) => {
        w.x += (targets[i].x - w.x) * 0.1;
        w.y += (targets[i].y - w.y) * 0.1;
      });
    } else {
      s.wingmen = [];
    }

    // Spread reload tick
    if (s.spreadReloadTimer > 0) {
      s.spreadReloadTimer--;
      if (s.spreadReloadTimer <= 0) s.spreadShotsLeft = SPREAD_SHOTS_PER_RELOAD;
    }

    // Auto fire — only block firing during active beam (not during charge/cooldown)
    if (!s.laserBeamActive) {
      s.fireTimer--;
      if (s.fireTimer <= 0) { playerFire(s); s.fireTimer = getFireRate(s.powerups); }
    }

    // Spread timer
    if ((s.powerups.spread || 0) > 0) {
      s.spreadFireTimer--;
      if (s.spreadFireTimer <= 0) {
        fireSpreadShot(s);
        const spreadTier = s.powerups.spread || 0;
        const rapidfireBonus = (s.powerups.rapidfire || 0) === 1 ? 10 : (s.powerups.rapidfire || 0) * 8;
        s.spreadFireTimer = Math.max(12, 55 - spreadTier * 4 - rapidfireBonus);
      }
    }

    // Wingmen independent fire timer
    if ((s.powerups.wingman || 0) > 0 && s.wingmen.length > 0) {
      s.wingmanFireTimer--;
      if (s.wingmanFireTimer <= 0) {
        s.wingmen.forEach(w => {
          let target = null, bestDist = Infinity;
          s.enemies.forEach(e => {
            const d = Math.hypot(e.x - w.x, e.y - w.y);
            if (d < bestDist) { bestDist = d; target = e; }
          });
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

    // ── Laser continuous beam / charge / cooldown ────────────
    if ((s.powerups.laser || 0) > 0) {
      if (s.laserCooldown > 0) {
        s.laserBeamActive = false;
        s.laserCooldown--;
      } else if (s.laserBeamActive) {
        s.laserBeamTimer--;
        // Beam deals damage each frame to enemies it overlaps
        const laserTier = s.powerups.laser;
        const beamW = 6 + laserTier * 4; // width of beam
        if (s.laserBeamTimer % 4 === 0) { // damage tick every 4 frames
          // Find the closest blocking tetris block in beam path
          let beamBlockY = 0; // beam stops at this Y (0 = top of screen)
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
          // Damage the first block hit by the beam
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

          // Beam only hits enemies above the first block
          s.enemies.forEach(e => {
            if (e.dead) return;
            if (Math.abs(e.x - p.x) < beamW + (e.w || 18) && e.y < p.y && e.y > beamBlockY) {
              e.hp -= 1;
              sounds.hit();
              spawnExplosion(s, e.x, e.y, '#ff44ff', 3);
              if (e.hp <= 0) {
                e.dead = true;
                const pts = e.type === 'boss' ? 5000 : e.type === 'dropper' ? 500 : e.type === 'elite' ? 300 : 100;
                s.score += pts;
                onScoreChange(s.score);
                sounds.kill();
                spawnExplosion(s, e.x, e.y, e.type === 'boss' ? '#ff0066' : '#ff44ff', e.type === 'boss' ? 40 : 14);
                if (e.type === 'dropper') { sounds.killDropper(); s.powerupItems.push({ x: e.x, y: e.y, type: e.dropType, angle: 0 }); }
                if (e.type === 'boss') { sounds.stopBossMusic(); sounds.waveComplete(); s.maxLives++; s.lives = Math.min(s.lives + 1, s.maxLives); onLivesChange(s.lives); onMaxLivesChange(s.maxLives); }
              }
            }
          });
          s.enemies = s.enemies.filter(e => !e.dead);
          // Store beam stop Y for drawing
          s.laserBeamBlockY = beamBlockY;
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
          s.laserBeamTimer = LASER_BEAM_FRAMES + (s.powerups.laser - 1) * 60;
          sounds.powerup();
        }
      }
    } else {
      s.laserCharge = 0; s.laserCooldown = 0; s.laserBeamActive = false; s.laserBeamTimer = 0;
    }

    // ── Dropper mid-wave spawn ────────────────────────────────
    if (s.dropperSpawnTimer > 0) {
      s.dropperSpawnTimer--;
      if (s.dropperSpawnTimer <= 0) {
        spawnDropper(W, s);
      }
    }

    // ── Enemy movement ────────────────────────────────────────
    s.enemies.forEach(e => {
      if (e.type === 'boss') {
        e.phase = (e.phase || 0) + 0.01;
        e.x += Math.sin(e.phase) * 2;
        e.y = Math.min(e.y + 0.15, H * 0.25);
        if (e.x < 50 || e.x > W - 50) e.vx *= -1;
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
      } else {
        // Hiding behaviour: ~20% chance per enemy to seek cover behind a block
        if (!e.hideMode) e.hideMode = Math.random() < 0.20;
        if (e.hideMode && s.blocks.length > 0) {
          // Find nearest block cell that's between enemy and player (above enemy)
          let bestBlock = null, bestDist = Infinity;
          s.blocks.forEach(block => {
            if (block.invulnerable) return; // prefer solid blocks but any works
            const cells = getBlockCells(block);
            cells.forEach(cell => {
              const cx = cell.x + BLOCK_SIZE / 2, cy = cell.y + BLOCK_SIZE / 2;
              // Only hide behind blocks that are between enemy and player (higher up)
              if (cy < e.y) {
                const d = Math.hypot(cx - e.x, cy - e.y);
                if (d < bestDist) { bestDist = d; bestBlock = { cx, cy }; }
              }
            });
          });
          if (bestBlock && bestDist > 8) {
            const dx = bestBlock.cx - e.x, dy = bestBlock.cy - e.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const spd = Math.hypot(e.vx, e.vy) || 1;
            e.x += (dx / len) * spd;
            e.y += (dy / len) * spd;
          } else {
            e.x += e.vx; e.y += e.vy;
          }
        } else {
          e.x += e.vx; e.y += e.vy;
        }
        // Bounce off side walls
        if (e.x < 20 || e.x > W - 20) e.vx *= -1;
        // Bounce off top/bottom — never leave screen
        if (e.y < 20) { e.y = 20; e.vy = Math.abs(e.vy); }
        if (e.y > H - 20) { e.y = H - 20; e.vy = -Math.abs(e.vy); }
      }
    });

    // Move bullets
    s.bullets = s.bullets.filter(b => {
      b.x += b.vx; b.y += b.vy;
      if (b.type === 'raygun') b.orbitAngle = ((b.orbitAngle || 0) + 0.25);
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
      return b.y > -20 && b.y < H + 20 && b.x > -20 && b.x < W + 20;
    });

    // Enemy fire — dropper and bomb do NOT fire
    s.enemies.forEach(e => {
      if (e.type === 'dropper' || e.type === 'bomb') return;
      e.fireTimer--;
      if (e.fireTimer <= 0) {
        const dx = p.x - e.x, dy = p.y - e.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        if (e.type === 'boss') {
          [-30, -20, -10, 0, 10, 20, 30].forEach(angle => {
            const rad = (angle * Math.PI) / 180;
            const bvx = (dx / len) * 4;
            const bvy = (dy / len) * 4;
            s.enemyBullets.push({ x: e.x, y: e.y, vx: bvx + Math.sin(rad) * 2.5, vy: bvy + Math.cos(rad) * 0.5, boss: true });
          });
          e.fireTimer = 35;
        } else {
          const bspd = 2;
          s.enemyBullets.push({ x: e.x, y: e.y, vx: (dx / len) * bspd, vy: (dy / len) * bspd });
          e.fireTimer = s.wave > 3 ? 50 : 70;
        }
      }
    });

    s.enemyBullets = s.enemyBullets.filter(b => {
      b.x += b.vx; b.y += b.vy;
      return b.y < H + 20 && b.x > -20 && b.x < W + 20 && b.y > -20;
    });

    // Powerup items drift down
    s.powerupItems.forEach(item => { item.y += 1.2; item.angle = (item.angle || 0) + 0.04; });
    s.powerupItems = s.powerupItems.filter(item => item.y < H + 30);

    // ── Tetris blocks ─────────────────────────────────────────
    s.blockSpawnTimer--;
    if (s.blockSpawnTimer <= 0) {
      s.blocks.push(spawnBlock(W));
      s.blockSpawnTimer = Math.max(80, 160 - s.wave * 8);
    }

    // Move blocks, check piling
    s.blocks.forEach(block => {
      if (block.settled) return;
      block.y += block.vy;

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
          s.piledCells.push({ x: Math.round(cell.x / BLOCK_SIZE) * BLOCK_SIZE, y: snappedY, color: block.color });
        });
      }
    });
    s.blocks = s.blocks.filter(b => !b.settled);

    // Piled cells — if stack reaches top portion, game over from block pressure isn't needed,
    // but player touching them causes damage (handled below).
    // Clean up piled cells that are off screen bottom (shouldn't happen but safety)
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

    // ── Bullet vs enemy ───────────────────────────────────────
    const piercingTypes = [];
    const newSpreadPellets = [];
    s.bullets.forEach(b => {
      if (b.hit) return;
      s.enemies.forEach(e => {
        if (e.dead) return;
        const dx = b.x - e.x, dy = b.y - e.y;
        if (Math.abs(dx) < e.w && Math.abs(dy) < e.h) {
          if (b.type === 'spread') { explodeSpread(b, newSpreadPellets); b.hit = true; return; }
          e.hp--;
          sounds.hit();
          b.hit = true;
          if (e.hp <= 0) {
            e.dead = true;
            // Bomb AoE explosion on death
            if (e.type === 'bomb') {
              const BOMB_RADIUS = 80;
              spawnExplosion(s, e.x, e.y, '#ff8800', 35);
              spawnExplosion(s, e.x, e.y, '#ffdd00', 20);
              // Draw shockwave ring via a particle with special flag
              s.particles.push({ x: e.x, y: e.y, vx: 0, vy: 0, r: 10, alpha: 1, color: '#ff8800', shockwave: true, shockwaveR: 10 });
              // Damage nearby enemies
              s.enemies.forEach(ne => {
                if (ne === e || ne.dead) return;
                if (Math.hypot(ne.x - e.x, ne.y - e.y) < BOMB_RADIUS) {
                  ne.hp -= 2;
                  spawnExplosion(s, ne.x, ne.y, '#ff8800', 8);
                  if (ne.hp <= 0) {
                    ne.dead = true;
                    s.score += ne.type === 'boss' ? 5000 : ne.type === 'dropper' ? 500 : ne.type === 'elite' ? 300 : ne.type === 'bomb' ? 200 : 100;
                    onScoreChange(s.score);
                  }
                }
              });
              // Damage player if nearby (unless invincible)
              if (Math.hypot(p.x - e.x, p.y - e.y) < BOMB_RADIUS) {
                takeDamage(s);
                spawnExplosion(s, p.x, p.y, '#ff8800', 12);
              }
            }
            const pts = e.type === 'boss' ? 5000 : e.type === 'dropper' ? 500 : e.type === 'elite' ? 300 : e.type === 'bomb' ? 200 : 100;
            s.score += pts;
            onScoreChange(s.score);
            sounds.kill();
            spawnExplosion(s, e.x, e.y,
              e.type === 'boss' ? '#ff0066' : e.type === 'dropper' ? (e.color || '#ffd700') : e.type === 'elite' ? '#ff44ff' : e.type === 'bomb' ? '#ff8800' : '#ff4444',
              e.type === 'boss' ? 40 : e.type === 'bomb' ? 30 : 14
            );
            if (e.type === 'dropper') {
              sounds.killDropper();
              s.powerupItems.push({ x: e.x, y: e.y, type: e.dropType, angle: 0 });
              if (OFFENSIVE_POWERUPS.includes(e.dropType)) {
                s.gunDroppedThisWave = [...(s.gunDroppedThisWave || []), e.dropType];
              } else if (AUXILIARY_UPGRADES.includes(e.dropType)) {
                s.auxDroppedThisWave = [...(s.auxDroppedThisWave || []), e.dropType];
              } else if (e.dropType === 'star') {
                s.starDroppedThisWave = true;
              }
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
        }
      });
    });

    // Add spread pellets spawned from enemy hits
    s.bullets.push(...newSpreadPellets);

    // Bullet vs tetris blocks
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
            if (block.invulnerable) {
              b.hit = true;
              spawnExplosion(s, b.x, b.y, '#aaaacc', 3);
              return;
            } else {
              // Raygun deals 2 damage to blocks; others deal 1
              block.hp -= b.type === 'raygun' ? 2 : 1;
              if (!piercingTypes.includes(b.type)) b.hit = true;
              if (block.hp <= 0) {
                block.dead = true;
                s.score += 50;
                onScoreChange(s.score);
                spawnExplosion(s, block.x + BLOCK_SIZE, block.y, block.color, 8);
              }
            }
          }
        });
      });
    });
    s.bullets.push(...newSpreadPelletsFromBlocks);
    s.blocks = s.blocks.filter(b => !b.dead);

    // Bullet vs piled cells
    const newSpreadPelletsFromPiled = [];
    s.bullets.forEach(b => {
      if (b.hit) return;
      s.piledCells = s.piledCells.filter(cell => {
        if (b.x >= cell.x && b.x <= cell.x + BLOCK_SIZE && b.y >= cell.y && b.y <= cell.y + BLOCK_SIZE) {
          if (b.type === 'spread') { explodeSpread(b, newSpreadPelletsFromPiled); b.hit = true; }
          else if (!piercingTypes.includes(b.type)) b.hit = true;
          spawnExplosion(s, cell.x + BLOCK_SIZE / 2, cell.y + BLOCK_SIZE / 2, cell.color, 4);
          return false;
        }
        return true;
      });
    });
    s.bullets.push(...newSpreadPelletsFromPiled);

    s.bullets = s.bullets.filter(b => !b.hit);
    s.enemies = s.enemies.filter(e => !e.dead);

    // Star invincibility countdown
    if (s.starInvincibleTimer > 0) s.starInvincibleTimer--;

    // Player picks up powerup
    s.powerupItems = s.powerupItems.filter(item => {
      const dx = item.x - p.x, dy = item.y - p.y;
      if (Math.sqrt(dx * dx + dy * dy) < 22) {
        if (item.type === 'star') {
          s.starInvincibleTimer = STAR_INVINCIBLE_FRAMES;
          sounds.powerup();
        } else if (item.type === 'shield') {
          s.shieldHp++;
          sounds.shield();
        } else if (item.type === 'speed') {
          s.powerups.speed = Math.min((s.powerups.speed || 0) + 1, 5);
          sounds.powerup();
        } else if (item.type === 'shotspeed') {
          s.powerups.shotspeed = Math.min((s.powerups.shotspeed || 0) + 1, 5);
          sounds.powerup();
        } else if (item.type === 'wingman') {
          s.powerups.wingman = Math.min((s.powerups.wingman || 0) + 1, 3);
          sounds.powerup();
        } else {
          const isLocked = s.lockedPowerups.includes(item.type);
          const canAdd = s.lockedPowerups.length < 2;
          if (!isLocked && !canAdd) return true;
          if (!isLocked) s.lockedPowerups.push(item.type);
          s.powerups[item.type] = Math.min((s.powerups[item.type] || 0) + 1, 3);
          sounds.powerup();
        }
        onPowerupChange({ ...s.powerups, shieldHp: s.shieldHp, starInvincible: s.starInvincibleTimer > 0 });
        return false;
      }
      return true;
    });

    // Enemy bullet hits player
    s.enemyBullets = s.enemyBullets.filter(b => {
      const dx = b.x - p.x, dy = b.y - p.y;
      if (Math.sqrt(dx * dx + dy * dy) < 14) {
        spawnExplosion(s, p.x, p.y, '#00f0ff', 10);
        takeDamage(s);
        return false;
      }
      return true;
    });

    // Enemy body hits player
    s.enemies = s.enemies.filter(e => {
      const dx = e.x - p.x, dy = e.y - p.y;
      if (Math.abs(dx) < 18 && Math.abs(dy) < 18) {
        if (e.type === 'bomb') {
          if (!e._dmgCooldown || e._dmgCooldown <= 0) {
            const BOMB_RADIUS = 80;
            spawnExplosion(s, e.x, e.y, '#ff8800', 35);
            spawnExplosion(s, e.x, e.y, '#ffdd00', 20);
            s.particles.push({ x: e.x, y: e.y, vx: 0, vy: 0, r: 10, alpha: 1, color: '#ff8800', shockwave: true, shockwaveR: 10 });
            s.enemies.forEach(ne => {
              if (ne === e || ne.dead) return;
              if (Math.hypot(ne.x - e.x, ne.y - e.y) < BOMB_RADIUS) {
                ne.hp -= 2;
                spawnExplosion(s, ne.x, ne.y, '#ff8800', 8);
                if (ne.hp <= 0) {
                  ne.dead = true;
                  s.score += ne.type === 'boss' ? 5000 : ne.type === 'dropper' ? 500 : ne.type === 'elite' ? 300 : ne.type === 'bomb' ? 200 : 100;
                  onScoreChange(s.score);
                }
              }
            });
            s.score += 200; onScoreChange(s.score);
            takeDamage(s);
            spawnExplosion(s, p.x, p.y, '#ff8800', 12);
            e._dmgCooldown = 60;
          }
          e.dead = true;
        } else {
          e.dead = true;
          spawnExplosion(s, e.x, e.y, '#ff4444', 12);
          takeDamage(s);
        }
        return false;
      }
      return true;
    });

    // Player touches falling block cell
    s.blocks.forEach(block => {
      getBlockCells(block).forEach(cell => {
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

    // Wave clear — only count combat enemies (not dropper for wave end, dropper is optional kill)
    const combatEnemies = s.enemies.filter(e => e.type !== 'dropper');
    if (combatEnemies.length === 0) {
      s.waveTimer++;
      if (s.waveTimer > 90) {
        s.enemies = [];
        s.wave++;
        s.waveTimer = 0;
        onWaveChange(s.wave);
        sounds.waveComplete();
        spawnWave(W, s);
      }
    } else {
      s.waveTimer = 0; // reset timer if enemies come back (e.g. dropper spawned mid-wave)
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

    // ── Draw ─────────────────────────────────────────────────
    s.particles.forEach(pt => drawParticle(ctx, pt));
    drawPiledCells(ctx, s.piledCells);
    s.blocks.forEach(b => drawBlock(ctx, b));
    s.powerupItems.forEach(item => drawPowerupItem(ctx, item));
    s.enemies.forEach(e => drawEnemy(ctx, e));
    s.bullets.forEach(b => drawBullet(ctx, b, false));
    s.enemyBullets.forEach(b => drawBullet(ctx, b, true));
    drawPlayer(ctx, p, s.wingmen, s.shieldHp, s.enemies, s.invincibleTimer, keys, s.starInvincibleTimer);

    // Laser charge indicator + continuous beam draw
    if ((s.powerups.laser || 0) > 0) {
      const laserTier = s.powerups.laser;
      const beamW = 6 + laserTier * 4;

      if (s.laserBeamActive) {
        // Draw beam from player to first block (or top of screen)
        const beamEndY = (s.laserBeamBlockY || 0);
        const beamAlpha = 0.7 + Math.sin(Date.now() * 0.03) * 0.3;
        ctx.save();
        // Outer glow
        ctx.shadowColor = '#ff44ff'; ctx.shadowBlur = 30;
        ctx.strokeStyle = `rgba(255,68,255,${beamAlpha * 0.4})`;
        ctx.lineWidth = beamW * 3;
        ctx.beginPath(); ctx.moveTo(p.x, p.y - 18); ctx.lineTo(p.x, beamEndY); ctx.stroke();
        // Core beam
        ctx.shadowBlur = 20;
        ctx.strokeStyle = `rgba(255,68,255,${beamAlpha})`;
        ctx.lineWidth = beamW;
        ctx.beginPath(); ctx.moveTo(p.x, p.y - 18); ctx.lineTo(p.x, beamEndY); ctx.stroke();
        // Bright center
        ctx.strokeStyle = `rgba(255,200,255,${beamAlpha})`;
        ctx.lineWidth = beamW * 0.3;
        ctx.beginPath(); ctx.moveTo(p.x, p.y - 18); ctx.lineTo(p.x, beamEndY); ctx.stroke();
        ctx.restore();
        // Beam timer ring
        const beamPct = s.laserBeamTimer / (LASER_BEAM_FRAMES + (laserTier - 1) * 60);
        ctx.save();
        ctx.strokeStyle = `rgba(255,68,255,0.6)`; ctx.lineWidth = 3; ctx.shadowBlur = 0;
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
        ctx.strokeStyle = `rgba(255,68,255,${0.4 + pct * 0.6})`;
        ctx.shadowColor = '#ff44ff'; ctx.shadowBlur = 8 + pct * 16; ctx.lineWidth = 2 + pct * 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 28 + pct * 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
        ctx.stroke(); ctx.restore();
      }
    }

    animRef.current = requestAnimationFrame(loop);
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
  }, [gameState, loop]);

  // ── Keyboard ─────────────────────────────────────────────────
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