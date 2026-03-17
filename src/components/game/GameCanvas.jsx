import React, { useRef, useEffect, useCallback } from 'react';

// --- Constants ---
const PLAYER_SPEED = 5;
const PLAYER_BULLET_SPEED = 8;
const PLAYER_FIRE_RATE = 100; // ms
const ENEMY_BULLET_SPEED = 3;
const PLAYER_SIZE = 12;
const INVINCIBILITY_TIME = 2000;

// --- Helpers ---
function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

// --- Draw functions ---
function drawPlayer(ctx, player, time) {
  const { x, y } = player;
  const glow = Math.sin(time * 0.005) * 0.3 + 0.7;

  // Engine flame
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

  // Ship body
  ctx.save();
  if (player.invincible && Math.floor(time / 80) % 2 === 0) {
    ctx.globalAlpha = 0.3;
  }
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

  // Cockpit
  ctx.fillStyle = '#ffffff';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(x, y - 2, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBullet(ctx, b) {
  ctx.save();
  ctx.fillStyle = b.color || '#00ffff';
  ctx.shadowColor = b.color || '#00ffff';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.radius || 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEnemy(ctx, e, time) {
  ctx.save();
  const pulse = Math.sin(time * 0.004 + e.x) * 0.2 + 0.8;
  ctx.fillStyle = e.color || `rgba(255, 50, 100, ${pulse})`;
  ctx.shadowColor = e.color || '#ff3264';
  ctx.shadowBlur = 12;

  if (e.type === 'spinner') {
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
    // Boss eye
    ctx.fillStyle = '#fff';
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.arc(e.x, e.y, 6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Diamond shape
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

function drawStars(ctx, stars, w, h) {
  stars.forEach(s => {
    ctx.fillStyle = `rgba(255,255,255,${s.alpha})`;
    ctx.fillRect(s.x, s.y, s.size, s.size);
  });
}

// --- Bullet patterns ---
function circularBurst(enemy, count, speed, color) {
  const bullets = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    bullets.push({
      x: enemy.x,
      y: enemy.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 4,
      color: color || '#ff6090',
    });
  }
  return bullets;
}

function aimedShot(enemy, playerX, playerY, speed, color) {
  const angle = Math.atan2(playerY - enemy.y, playerX - enemy.x);
  return {
    x: enemy.x,
    y: enemy.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: 4,
    color: color || '#ffaa00',
  };
}

function spiralBurst(enemy, time, count, speed, color) {
  const bullets = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + time * 0.002;
    bullets.push({
      x: enemy.x,
      y: enemy.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 3.5,
      color: color || '#aa66ff',
    });
  }
  return bullets;
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

  // Boss every 5 waves
  if (wave % 5 === 0 && wave > 0) {
    enemies.push({
      x: W / 2,
      y: -50,
      vx: 1,
      vy: 0.2,
      hp: 30 + wave * 5,
      maxHp: 30 + wave * 5,
      type: 'boss',
      radius: 30,
      color: '#ff2244',
      fireTimer: 0,
      fireRate: 300,
      pattern: 0,
    });
  }

  return enemies;
}

export default function GameCanvas({ gameState, setGameState, onScoreChange, onLivesChange, onWaveChange }) {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const keysRef = useRef({});
  const animRef = useRef(null);

  const initGame = useCallback((W, H) => {
    const stars = Array.from({ length: 120 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      size: Math.random() * 2 + 0.5,
      speed: Math.random() * 1.5 + 0.5,
      alpha: Math.random() * 0.6 + 0.2,
    }));

    gameRef.current = {
      player: { x: W / 2, y: H - 60, invincible: false, invincibleTimer: 0 },
      playerBullets: [],
      enemyBullets: [],
      enemies: [],
      particles: [],
      stars,
      score: 0,
      lives: 3,
      wave: 1,
      lastFireTime: 0,
      waveTimer: 0,
      waveCooldown: false,
      time: 0,
      W,
      H,
    };
    gameRef.current.enemies = generateWave(1, W, H);
    onScoreChange(0);
    onLivesChange(3);
    onWaveChange(1);
  }, [onScoreChange, onLivesChange, onWaveChange]);

  const spawnParticles = useCallback((x, y, color, count = 8) => {
    if (!gameRef.current) return;
    for (let i = 0; i < count; i++) {
      gameRef.current.particles.push({
        x, y,
        vx: randomRange(-3, 3),
        vy: randomRange(-3, 3),
        radius: randomRange(1, 3),
        alpha: 1,
        color,
        decay: randomRange(0.02, 0.05),
      });
    }
  }, []);

  const gameLoop = useCallback((timestamp) => {
    const g = gameRef.current;
    if (!g) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { W, H } = g;
    const dt = 1; // fixed timestep
    g.time = timestamp;
    const keys = keysRef.current;

    // --- Update stars ---
    g.stars.forEach(s => {
      s.y += s.speed;
      if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
    });

    // --- Player movement ---
    let dx = 0, dy = 0;
    if (keys['ArrowLeft'] || keys['KeyA']) dx -= 1;
    if (keys['ArrowRight'] || keys['KeyD']) dx += 1;
    if (keys['ArrowUp'] || keys['KeyW']) dy -= 1;
    if (keys['ArrowDown'] || keys['KeyS']) dy += 1;
    if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }
    g.player.x = Math.max(15, Math.min(W - 15, g.player.x + dx * PLAYER_SPEED));
    g.player.y = Math.max(15, Math.min(H - 15, g.player.y + dy * PLAYER_SPEED));

    // Invincibility
    if (g.player.invincible) {
      g.player.invincibleTimer -= 16;
      if (g.player.invincibleTimer <= 0) g.player.invincible = false;
    }

    // --- Auto-fire ---
    if (timestamp - g.lastFireTime > PLAYER_FIRE_RATE) {
      g.lastFireTime = timestamp;
      g.playerBullets.push(
        { x: g.player.x - 5, y: g.player.y - 14, vy: -PLAYER_BULLET_SPEED, radius: 2.5, color: '#00ffff' },
        { x: g.player.x + 5, y: g.player.y - 14, vy: -PLAYER_BULLET_SPEED, radius: 2.5, color: '#00ffff' },
      );
    }

    // --- Update player bullets ---
    g.playerBullets = g.playerBullets.filter(b => {
      b.y += b.vy;
      return b.y > -10;
    });

    // --- Update enemies ---
    let allDead = true;
    g.enemies = g.enemies.filter(e => {
      e.x += e.vx;
      e.y += e.vy;

      // Bounce off walls
      if (e.x < e.radius || e.x > W - e.radius) e.vx *= -1;
      // Boss stays near top
      if (e.type === 'boss' && e.y > H * 0.25) e.vy = -Math.abs(e.vy) * 0.5;
      if (e.y > H + 50) return false;

      // Enemy shooting
      e.fireTimer += 16;
      if (e.fireTimer >= e.fireRate && e.y > 0) {
        e.fireTimer = 0;
        const p = e.pattern;
        if (e.type === 'boss') {
          // Boss shoots all patterns
          g.enemyBullets.push(...circularBurst(e, 12 + g.wave, ENEMY_BULLET_SPEED * 0.8, '#ff4466'));
          if (g.wave >= 5) {
            g.enemyBullets.push(...spiralBurst(e, g.time, 8, ENEMY_BULLET_SPEED * 0.6, '#ffaa00'));
          }
        } else if (p === 0) {
          g.enemyBullets.push(aimedShot(e, g.player.x, g.player.y, ENEMY_BULLET_SPEED, '#ffaa00'));
        } else if (p === 1) {
          g.enemyBullets.push(...circularBurst(e, 6 + Math.floor(g.wave / 2), ENEMY_BULLET_SPEED * 0.7, '#ff6090'));
        } else {
          g.enemyBullets.push(...spiralBurst(e, g.time, 5, ENEMY_BULLET_SPEED * 0.6, '#aa66ff'));
        }
      }

      // Hit detection with player bullets
      for (let i = g.playerBullets.length - 1; i >= 0; i--) {
        const b = g.playerBullets[i];
        if (dist(b, e) < e.radius + 4) {
          g.playerBullets.splice(i, 1);
          e.hp--;
          spawnParticles(b.x, b.y, e.color, 4);
          if (e.hp <= 0) {
            spawnParticles(e.x, e.y, e.color, 20);
            g.score += e.type === 'boss' ? 500 : e.type === 'spinner' ? 50 : 25;
            onScoreChange(g.score);
            return false;
          }
        }
      }

      allDead = false;
      return true;
    });

    // --- Update enemy bullets ---
    g.enemyBullets = g.enemyBullets.filter(b => {
      b.x += b.vx;
      b.y += b.vy;
      if (b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) return false;

      // Collision with player
      if (!g.player.invincible && dist(b, g.player) < PLAYER_SIZE * 0.6 + b.radius) {
        g.lives--;
        onLivesChange(g.lives);
        g.player.invincible = true;
        g.player.invincibleTimer = INVINCIBILITY_TIME;
        spawnParticles(g.player.x, g.player.y, '#00ffff', 15);

        if (g.lives <= 0) {
          setGameState('gameover');
        }
        return false;
      }
      return true;
    });

    // --- Particles ---
    g.particles = g.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;
      p.vx *= 0.97;
      p.vy *= 0.97;
      return p.alpha > 0;
    });

    // --- Wave management ---
    if (allDead && g.enemies.length === 0 && !g.waveCooldown) {
      g.waveCooldown = true;
      g.waveTimer = timestamp;
    }
    if (g.waveCooldown && timestamp - g.waveTimer > 1500) {
      g.wave++;
      onWaveChange(g.wave);
      g.enemies = generateWave(g.wave, W, H);
      g.waveCooldown = false;
      // Clear enemy bullets between waves
      g.enemyBullets = [];
    }

    // --- Draw ---
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, W, H);

    drawStars(ctx, g.stars, W, H);

    g.particles.forEach(p => drawParticle(ctx, p));
    g.playerBullets.forEach(b => drawBullet(ctx, b));
    g.enemyBullets.forEach(b => drawBullet(ctx, b));
    g.enemies.forEach(e => {
      drawEnemy(ctx, e, g.time);
      // HP bar for boss
      if (e.type === 'boss') {
        const barW = 60;
        const barH = 4;
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(e.x - barW / 2, e.y - e.radius - 12, barW, barH);
        ctx.fillStyle = '#ff2244';
        ctx.fillRect(e.x - barW / 2, e.y - e.radius - 12, barW * (e.hp / e.maxHp), barH);
      }
    });
    drawPlayer(ctx, g.player, g.time);

    animRef.current = requestAnimationFrame(gameLoop);
  }, [onScoreChange, onLivesChange, onWaveChange, setGameState, spawnParticles]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      if (gameRef.current) {
        gameRef.current.W = canvas.width;
        gameRef.current.H = canvas.height;
      }
    };

    resize();
    window.addEventListener('resize', resize);

    const handleKeyDown = (e) => {
      keysRef.current[e.code] = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
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
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [gameState, initGame, gameLoop]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      tabIndex={0}
    />
  );
}