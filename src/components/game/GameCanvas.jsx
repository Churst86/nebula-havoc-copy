import React, { useRef, useEffect, useCallback } from 'react';

// --- Constants ---
const PLAYER_SPEED = 5;
const PLAYER_BULLET_SPEED = 8;
const PLAYER_FIRE_RATE = 100;
const ENEMY_BULLET_SPEED = 3;
const PLAYER_SIZE = 12;
const INVINCIBILITY_TIME = 2000;
const POWERUP_DURATION = 8000; // ms

// --- Helpers ---
function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

// --- Power-up types ---
const POWERUP_TYPES = ['spread', 'laser', 'raygun', 'wingman'];
const POWERUP_COLORS = {
  spread:  '#ffdd00',
  laser:   '#ff44ff',
  raygun:  '#44ffaa',
  wingman: '#44aaff',
};
const POWERUP_LABELS = {
  spread:  'SPREAD',
  laser:   'LASER',
  raygun:  'RAY GUN',
  wingman: 'WINGMAN',
};

// --- Draw functions ---
function drawPlayer(ctx, player, time) {
  const { x, y } = player;
  const glow = Math.sin(time * 0.005) * 0.3 + 0.7;

  ctx.save();
  const flameLen = 12 + Math.sin(time * 0.02) * 4;
  const grad = ctx.createLinearGradient(x, y + 8, x, y + 8 + flameLen);
  grad.addColorStop(0, 'rgba(0,255,255,0.9)');
  grad.addColorStop(0.5, 'rgba(100,100,255,0.5)');
  grad.addColorStop(1, 'rgba(100,100,255,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(x - 4, y + 8);
  ctx.lineTo(x, y + 8 + flameLen);
  ctx.lineTo(x + 4, y + 8);
  ctx.fill();
  ctx.restore();

  ctx.save();
  if (player.invincible && Math.floor(time / 80) % 2 === 0) ctx.globalAlpha = 0.3;
  ctx.fillStyle = `rgba(0, 255, 255, ${glow})`;
  ctx.shadowColor = '#00ffff';
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.moveTo(x, y - PLAYER_SIZE);
  ctx.lineTo(x - 10, y + 8);
  ctx.lineTo(x - 4, y + 5);
  ctx.lineTo(x, y + 8);
  ctx.lineTo(x + 4, y + 5);
  ctx.lineTo(x + 10, y + 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(x, y - 2, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawWingman(ctx, w, time) {
  const { x, y } = w;
  const glow = Math.sin(time * 0.006 + w.offset) * 0.3 + 0.7;
  ctx.save();
  const flameLen = 8 + Math.sin(time * 0.02 + w.offset) * 3;
  const grad = ctx.createLinearGradient(x, y + 6, x, y + 6 + flameLen);
  grad.addColorStop(0, 'rgba(100,180,255,0.8)');
  grad.addColorStop(1, 'rgba(100,100,255,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(x - 3, y + 6);
  ctx.lineTo(x, y + 6 + flameLen);
  ctx.lineTo(x + 3, y + 6);
  ctx.fill();

  ctx.fillStyle = `rgba(100, 200, 255, ${glow})`;
  ctx.shadowColor = '#44aaff';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(x, y - 9);
  ctx.lineTo(x - 7, y + 6);
  ctx.lineTo(x - 3, y + 4);
  ctx.lineTo(x, y + 6);
  ctx.lineTo(x + 3, y + 4);
  ctx.lineTo(x + 7, y + 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawBullet(ctx, b) {
  ctx.save();
  if (b.isLaser) {
    // Draw laser as a tall rect
    ctx.fillStyle = b.color || '#ff44ff';
    ctx.shadowColor = b.color || '#ff44ff';
    ctx.shadowBlur = 12;
    ctx.fillRect(b.x - (b.width || 2) / 2, b.y - (b.length || 20), b.width || 2, b.length || 20);
  } else if (b.isRay) {
    ctx.fillStyle = b.color || '#44ffaa';
    ctx.shadowColor = b.color || '#44ffaa';
    ctx.shadowBlur = 16;
    ctx.fillRect(b.x - (b.width || 5) / 2, b.y - (b.length || 30), b.width || 5, b.length || 30);
  } else {
    ctx.fillStyle = b.color || '#00ffff';
    ctx.shadowColor = b.color || '#00ffff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius || 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawEnemy(ctx, e, time) {
  ctx.save();
  const pulse = Math.sin(time * 0.004 + e.x) * 0.2 + 0.8;
  ctx.fillStyle = e.color || `rgba(255, 50, 100, ${pulse})`;
  ctx.shadowColor = e.color || '#ff3264';
  ctx.shadowBlur = 12;

  if (e.type === 'dropper') {
    // Shield-like hexagon shape
    const r = e.radius || 13;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
      const px = e.x + Math.cos(a) * r;
      const py = e.y + Math.sin(a) * r;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    // Powerup icon inside
    ctx.fillStyle = '#fff';
    ctx.shadowBlur = 0;
    ctx.font = `bold ${Math.round(r * 0.8)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', e.x, e.y + 1);
  } else if (e.type === 'spinner') {
    const angle = time * 0.003;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = angle + (i * Math.PI * 2) / 5;
      const r = e.radius || 14;
      const px = e.x + Math.cos(a) * r;
      const py = e.y + Math.sin(a) * r;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  } else if (e.type === 'boss') {
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius || 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.arc(e.x, e.y, 6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const r = e.radius || 10;
    ctx.beginPath();
    ctx.moveTo(e.x, e.y - r);
    ctx.lineTo(e.x + r * 0.7, e.y);
    ctx.lineTo(e.x, e.y + r);
    ctx.lineTo(e.x - r * 0.7, e.y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawPowerup(ctx, pu, time) {
  const pulse = Math.sin(time * 0.005) * 0.15 + 0.85;
  const color = POWERUP_COLORS[pu.type];
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  const r = 10;
  ctx.beginPath();
  ctx.arc(pu.x, pu.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#fff';
  ctx.shadowBlur = 0;
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(pu.type === 'wingman' ? 'W' : pu.type === 'spread' ? 'S' : pu.type === 'laser' ? 'L' : 'R', pu.x, pu.y + 1);
  ctx.restore();
}

function drawParticle(ctx, p) {
  ctx.save();
  ctx.globalAlpha = p.alpha;
  ctx.fillStyle = p.color;
  ctx.shadowColor = p.color;
  ctx.shadowBlur = 4;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawStars(ctx, stars) {
  stars.forEach(s => {
    ctx.fillStyle = `rgba(255,255,255,${s.alpha})`;
    ctx.fillRect(s.x, s.y, s.size, s.size);
  });
}

// --- Bullet patterns ---
function circularBurst(enemy, count, speed, color) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2;
    return { x: enemy.x, y: enemy.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: 4, color: color || '#ff6090' };
  });
}
function aimedShot(enemy, playerX, playerY, speed, color) {
  const angle = Math.atan2(playerY - enemy.y, playerX - enemy.x);
  return { x: enemy.x, y: enemy.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: 4, color: color || '#ffaa00' };
}
function spiralBurst(enemy, time, count, speed, color) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + time * 0.002;
    return { x: enemy.x, y: enemy.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: 3.5, color: color || '#aa66ff' };
  });
}

// --- Fire player weapons ---
function firePlayerWeapon(player, powerup, timestamp, lastFireTime, fireRate) {
  if (timestamp - lastFireTime <= fireRate) return null;

  const px = player.x, py = player.y;
  const type = powerup ? powerup.type : 'default';

  if (type === 'spread') {
    const angles = [-0.35, -0.18, 0, 0.18, 0.35];
    return angles.map(a => ({
      x: px, y: py - 14,
      vx: Math.sin(a) * PLAYER_BULLET_SPEED,
      vy: -Math.cos(a) * PLAYER_BULLET_SPEED,
      radius: 3, color: '#ffdd00',
    }));
  } else if (type === 'laser') {
    return [
      { x: px, y: py - 14, vx: 0, vy: -PLAYER_BULLET_SPEED * 1.5, isLaser: true, width: 3, length: 22, radius: 5, color: '#ff44ff', damage: 2 },
    ];
  } else if (type === 'raygun') {
    return [
      { x: px - 6, y: py - 14, vx: 0, vy: -PLAYER_BULLET_SPEED * 1.2, isRay: true, width: 6, length: 30, radius: 6, color: '#44ffaa', damage: 3 },
      { x: px + 6, y: py - 14, vx: 0, vy: -PLAYER_BULLET_SPEED * 1.2, isRay: true, width: 6, length: 30, radius: 6, color: '#44ffaa', damage: 3 },
    ];
  } else {
    // default double shot
    return [
      { x: px - 5, y: py - 14, vx: 0, vy: -PLAYER_BULLET_SPEED, radius: 2.5, color: '#00ffff' },
      { x: px + 5, y: py - 14, vx: 0, vy: -PLAYER_BULLET_SPEED, radius: 2.5, color: '#00ffff' },
    ];
  }
}

function fireWingman(wingman, timestamp, lastFireTime) {
  if (timestamp - lastFireTime <= 150) return null;
  return [
    { x: wingman.x, y: wingman.y - 10, vx: 0, vy: -PLAYER_BULLET_SPEED, radius: 2.5, color: '#44aaff' },
  ];
}

// --- Wave generator ---
function generateWave(wave, W, H) {
  const enemies = [];
  const count = Math.min(3 + wave * 2, 20);

  for (let i = 0; i < count; i++) {
    const types = ['basic', 'spinner'];
    if (wave >= 3) types.push('spinner');
    const type = types[Math.floor(Math.random() * types.length)];

    enemies.push({
      x: randomRange(40, W - 40),
      y: randomRange(-200, -30),
      vx: randomRange(-0.5, 0.5),
      vy: randomRange(0.3, 0.8 + wave * 0.1),
      hp: type === 'spinner' ? 3 + wave : 2 + wave,
      maxHp: type === 'spinner' ? 3 + wave : 2 + wave,
      type,
      radius: type === 'spinner' ? 14 : 10,
      color: type === 'spinner' ? '#aa66ff' : '#ff3264',
      fireTimer: randomRange(0, 1000),
      fireRate: Math.max(600, 1500 - wave * 100),
      pattern: Math.floor(Math.random() * 3),
    });
  }

  // Add 1-2 dropper enemies per wave
  const dropCount = wave >= 2 ? 2 : 1;
  for (let i = 0; i < dropCount; i++) {
    enemies.push({
      x: randomRange(60, W - 60),
      y: randomRange(-180, -40),
      vx: randomRange(-0.4, 0.4),
      vy: randomRange(0.3, 0.6),
      hp: 4 + wave,
      maxHp: 4 + wave,
      type: 'dropper',
      radius: 13,
      color: '#ffe566',
      fireTimer: 0,
      fireRate: 2500,
      pattern: 0,
      powerupType: POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)],
    });
  }

  // Boss every 5 waves
  if (wave % 5 === 0 && wave > 0) {
    enemies.push({
      x: W / 2, y: -50, vx: 1, vy: 0.2,
      hp: 30 + wave * 5, maxHp: 30 + wave * 5,
      type: 'boss', radius: 30, color: '#ff2244',
      fireTimer: 0, fireRate: 300, pattern: 0,
    });
  }

  return enemies;
}

export default function GameCanvas({ gameState, setGameState, onScoreChange, onLivesChange, onWaveChange, onPowerupChange }) {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const keysRef = useRef({});
  const animRef = useRef(null);

  const initGame = useCallback((W, H) => {
    const stars = Array.from({ length: 120 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      size: Math.random() * 2 + 0.5, speed: Math.random() * 1.5 + 0.5, alpha: Math.random() * 0.6 + 0.2,
    }));

    gameRef.current = {
      player: { x: W / 2, y: H - 60, invincible: false, invincibleTimer: 0 },
      wingmen: [],
      playerBullets: [],
      wingmanBullets: [],
      wingmanFireTimers: [],
      enemyBullets: [],
      enemies: [],
      powerups: [],
      particles: [],
      stars,
      score: 0,
      lives: 3,
      wave: 1,
      lastFireTime: 0,
      waveTimer: 0,
      waveCooldown: false,
      time: 0,
      activePowerup: null,
      powerupTimer: 0,
      W, H,
    };
    gameRef.current.enemies = generateWave(1, W, H);
    onScoreChange(0);
    onLivesChange(3);
    onWaveChange(1);
    if (onPowerupChange) onPowerupChange(null);
  }, [onScoreChange, onLivesChange, onWaveChange, onPowerupChange]);

  const spawnParticles = useCallback((x, y, color, count = 8) => {
    if (!gameRef.current) return;
    for (let i = 0; i < count; i++) {
      gameRef.current.particles.push({
        x, y, vx: randomRange(-3, 3), vy: randomRange(-3, 3),
        radius: randomRange(1, 3), alpha: 1, color, decay: randomRange(0.02, 0.05),
      });
    }
  }, []);

  const activatePowerup = useCallback((type, timestamp) => {
    const g = gameRef.current;
    if (!g) return;
    if (type === 'wingman') {
      // Add up to 2 wingmen
      const maxWingmen = 2;
      if (g.wingmen.length < maxWingmen) {
        const side = g.wingmen.length === 0 ? -1 : 1;
        g.wingmen.push({ x: g.player.x + side * 35, y: g.player.y, offset: Math.random() * Math.PI * 2 });
        g.wingmanFireTimers.push(0);
      }
      // Wingmen stay until next powerup replaces them, give a timer too
      g.activePowerup = { type: 'wingman', endTime: timestamp + POWERUP_DURATION };
    } else {
      // Remove wingmen if switching away
      if (g.activePowerup?.type === 'wingman') {
        g.wingmen = [];
        g.wingmanFireTimers = [];
      }
      g.activePowerup = { type, endTime: timestamp + POWERUP_DURATION };
    }
    if (onPowerupChange) onPowerupChange(type);
  }, [onPowerupChange]);

  const gameLoop = useCallback((timestamp) => {
    const g = gameRef.current;
    if (!g) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { W, H } = g;
    g.time = timestamp;
    const keys = keysRef.current;

    // Stars
    g.stars.forEach(s => { s.y += s.speed; if (s.y > H) { s.y = 0; s.x = Math.random() * W; } });

    // Player movement
    let dx = 0, dy = 0;
    if (keys['ArrowLeft'] || keys['KeyA']) dx -= 1;
    if (keys['ArrowRight'] || keys['KeyD']) dx += 1;
    if (keys['ArrowUp'] || keys['KeyW']) dy -= 1;
    if (keys['ArrowDown'] || keys['KeyS']) dy += 1;
    if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }
    g.player.x = Math.max(15, Math.min(W - 15, g.player.x + dx * PLAYER_SPEED));
    g.player.y = Math.max(15, Math.min(H - 15, g.player.y + dy * PLAYER_SPEED));

    if (g.player.invincible) {
      g.player.invincibleTimer -= 16;
      if (g.player.invincibleTimer <= 0) g.player.invincible = false;
    }

    // Powerup expiry
    if (g.activePowerup && timestamp > g.activePowerup.endTime) {
      if (g.activePowerup.type === 'wingman') { g.wingmen = []; g.wingmanFireTimers = []; }
      g.activePowerup = null;
      if (onPowerupChange) onPowerupChange(null);
    }

    // Player fire
    const newBullets = firePlayerWeapon(g.player, g.activePowerup, timestamp, g.lastFireTime, PLAYER_FIRE_RATE);
    if (newBullets) {
      g.playerBullets.push(...newBullets);
      g.lastFireTime = timestamp;
    }

    // Wingmen update and fire
    g.wingmen.forEach((w, i) => {
      // Wingmen follow player with offset
      const targetX = g.player.x + (i === 0 ? -40 : 40);
      const targetY = g.player.y + 10;
      w.x += (targetX - w.x) * 0.1;
      w.y += (targetY - w.y) * 0.1;
      const wBullets = fireWingman(w, timestamp, g.wingmanFireTimers[i] || 0);
      if (wBullets) {
        g.playerBullets.push(...wBullets);
        g.wingmanFireTimers[i] = timestamp;
      }
    });

    // Player bullets
    g.playerBullets = g.playerBullets.filter(b => {
      b.x += b.vx || 0;
      b.y += b.vy || 0;
      return b.y > -40 && b.x > -20 && b.x < W + 20;
    });

    // Enemies
    let allDead = true;
    g.enemies = g.enemies.filter(e => {
      e.x += e.vx;
      e.y += e.vy;
      if (e.x < e.radius || e.x > W - e.radius) e.vx *= -1;
      if (e.type === 'boss' && e.y > H * 0.25) e.vy = -Math.abs(e.vy) * 0.5;
      if (e.y > H + 50) return false;

      e.fireTimer += 16;
      if (e.fireTimer >= e.fireRate && e.y > 0) {
        e.fireTimer = 0;
        if (e.type === 'dropper') {
          // Droppers only shoot simple aimed shots
          g.enemyBullets.push(aimedShot(e, g.player.x, g.player.y, ENEMY_BULLET_SPEED * 0.8, '#ffe566'));
        } else if (e.type === 'boss') {
          g.enemyBullets.push(...circularBurst(e, 12 + g.wave, ENEMY_BULLET_SPEED * 0.8, '#ff4466'));
          if (g.wave >= 5) g.enemyBullets.push(...spiralBurst(e, g.time, 8, ENEMY_BULLET_SPEED * 0.6, '#ffaa00'));
        } else if (e.pattern === 0) {
          g.enemyBullets.push(aimedShot(e, g.player.x, g.player.y, ENEMY_BULLET_SPEED, '#ffaa00'));
        } else if (e.pattern === 1) {
          g.enemyBullets.push(...circularBurst(e, 6 + Math.floor(g.wave / 2), ENEMY_BULLET_SPEED * 0.7, '#ff6090'));
        } else {
          g.enemyBullets.push(...spiralBurst(e, g.time, 5, ENEMY_BULLET_SPEED * 0.6, '#aa66ff'));
        }
      }

      // Hit by player bullets
      for (let i = g.playerBullets.length - 1; i >= 0; i--) {
        const b = g.playerBullets[i];
        const hitRadius = b.isLaser || b.isRay ? (b.width / 2 + e.radius) : (e.radius + (b.radius || 3));
        const bx = b.x, by = b.isLaser || b.isRay ? b.y - (b.length || 20) / 2 : b.y;
        if (dist({ x: bx, y: by }, e) < hitRadius) {
          if (!b.piercing) g.playerBullets.splice(i, 1);
          e.hp -= b.damage || 1;
          spawnParticles(b.x, b.y, e.color, 4);
          if (e.hp <= 0) {
            spawnParticles(e.x, e.y, e.color, 20);
            // Drop powerup if dropper
            if (e.type === 'dropper') {
              g.powerups.push({ x: e.x, y: e.y, vy: 1.2, type: e.powerupType });
            }
            g.score += e.type === 'boss' ? 500 : e.type === 'dropper' ? 75 : e.type === 'spinner' ? 50 : 25;
            onScoreChange(g.score);
            return false;
          }
        }
      }

      allDead = false;
      return true;
    });

    // Powerup pickups
    g.powerups = g.powerups.filter(pu => {
      pu.y += pu.vy;
      if (pu.y > H + 20) return false;
      if (dist(pu, g.player) < PLAYER_SIZE + 12) {
        activatePowerup(pu.type, timestamp);
        spawnParticles(pu.x, pu.y, POWERUP_COLORS[pu.type], 16);
        return false;
      }
      return true;
    });

    // Enemy bullets
    g.enemyBullets = g.enemyBullets.filter(b => {
      b.x += b.vx;
      b.y += b.vy;
      if (b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) return false;
      if (!g.player.invincible && dist(b, g.player) < PLAYER_SIZE * 0.6 + b.radius) {
        g.lives--;
        onLivesChange(g.lives);
        g.player.invincible = true;
        g.player.invincibleTimer = INVINCIBILITY_TIME;
        spawnParticles(g.player.x, g.player.y, '#00ffff', 15);
        if (g.lives <= 0) setGameState('gameover');
        return false;
      }
      return true;
    });

    // Particles
    g.particles = g.particles.filter(p => {
      p.x += p.vx; p.y += p.vy; p.alpha -= p.decay; p.vx *= 0.97; p.vy *= 0.97;
      return p.alpha > 0;
    });

    // Wave management
    if (allDead && g.enemies.length === 0 && !g.waveCooldown) {
      g.waveCooldown = true;
      g.waveTimer = timestamp;
    }
    if (g.waveCooldown && timestamp - g.waveTimer > 1500) {
      g.wave++;
      onWaveChange(g.wave);
      g.enemies = generateWave(g.wave, W, H);
      g.waveCooldown = false;
      g.enemyBullets = [];
    }

    // --- Draw ---
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, W, H);
    drawStars(ctx, g.stars);
    g.particles.forEach(p => drawParticle(ctx, p));
    g.powerups.forEach(pu => drawPowerup(ctx, pu, g.time));
    g.playerBullets.forEach(b => drawBullet(ctx, b));
    g.enemyBullets.forEach(b => drawBullet(ctx, b));
    g.enemies.forEach(e => {
      drawEnemy(ctx, e, g.time);
      // HP bar
      if (e.type === 'boss' || e.type === 'dropper') {
        const barW = e.type === 'boss' ? 60 : 30;
        const barH = 3;
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(e.x - barW / 2, e.y - e.radius - 10, barW, barH);
        ctx.fillStyle = e.type === 'dropper' ? '#ffe566' : '#ff2244';
        ctx.fillRect(e.x - barW / 2, e.y - e.radius - 10, barW * (e.hp / e.maxHp), barH);
      }
    });
    g.wingmen.forEach(w => drawWingman(ctx, w, g.time));
    drawPlayer(ctx, g.player, g.time);

    animRef.current = requestAnimationFrame(gameLoop);
  }, [onScoreChange, onLivesChange, onWaveChange, setGameState, spawnParticles, activatePowerup, onPowerupChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      if (gameRef.current) { gameRef.current.W = canvas.width; gameRef.current.H = canvas.height; }
    };
    resize();
    window.addEventListener('resize', resize);
    const handleKeyDown = (e) => {
      keysRef.current[e.code] = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    };
    const handleKeyUp = (e) => { keysRef.current[e.code] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    if (gameState === 'playing') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      initGame(canvas.width, canvas.height);
      animRef.current = requestAnimationFrame(gameLoop);
    }
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [gameState, initGame, gameLoop]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" tabIndex={0} />;
}