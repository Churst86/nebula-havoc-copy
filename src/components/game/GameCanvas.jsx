import React, { useRef, useEffect, useCallback } from 'react';
import MobileControls from './MobileControls';

const POWERUP_DURATION = 8000; // ms
const POWERUP_TYPES = ['spread', 'laser', 'raygun', 'wingman'];

function randomBetween(a, b) { return a + Math.random() * (b - a); }

export default function GameCanvas({ gameState, setGameState, onScoreChange, onLivesChange, onWaveChange, onPowerupChange }) {
  const canvasRef = useRef(null);
  const keysRef = useRef({});
  const stateRef = useRef({
    player: null,
    bullets: [],
    enemyBullets: [],
    enemies: [],
    particles: [],
    powerupItems: [],
    wingmen: [],
    stars: [],
    score: 0,
    lives: 3,
    wave: 1,
    waveTimer: 0,
    fireTimer: 0,
    activePowerup: null,
    powerupExpiry: 0,
    running: false,
  });
  const animRef = useRef(null);
  const lastTimeRef = useRef(0);

  // ── Init stars ──────────────────────────────────────────────
  function initStars(W, H) {
    return Array.from({ length: 120 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 1.5 + 0.3,
      speed: Math.random() * 0.6 + 0.1,
      alpha: Math.random() * 0.7 + 0.3,
    }));
  }

  // ── Spawn wave ───────────────────────────────────────────────
  function spawnWave(W, state) {
    const wave = state.wave;
    const count = 5 + wave * 2;
    const enemies = [];

    // One dropper per wave (drops a powerup)
    enemies.push({
      type: 'dropper',
      x: randomBetween(60, W - 60), y: -40,
      w: 28, h: 28,
      hp: 5, maxHp: 5,
      vx: randomBetween(-0.5, 0.5), vy: 0.7,
      fireTimer: randomBetween(120, 180),
      drop: POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)],
    });

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
    state.enemies = enemies;
  }

  // ── Drawing helpers ──────────────────────────────────────────
  function drawPlayer(ctx, p, wingmen) {
    // Wingmen
    wingmen.forEach(w => {
      ctx.save();
      ctx.translate(w.x, w.y);
      ctx.shadowColor = '#44aaff';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = '#44aaff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -10); ctx.lineTo(8, 8); ctx.lineTo(0, 4); ctx.lineTo(-8, 8); ctx.closePath();
      ctx.stroke();
      ctx.restore();
    });

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 18;
    // Hull
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -18); ctx.lineTo(13, 12); ctx.lineTo(0, 6); ctx.lineTo(-13, 12); ctx.closePath();
    ctx.stroke();
    // Engine glow
    ctx.fillStyle = 'rgba(0,240,255,0.15)';
    ctx.fill();
    ctx.restore();
  }

  function drawEnemy(ctx, e) {
    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.type === 'dropper') {
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 16;
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        const r = 14;
        i === 0 ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,215,0,0.12)';
      ctx.fill();
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', 0, 0);
    } else if (e.type === 'elite') {
      ctx.shadowColor = '#ff44ff';
      ctx.shadowBlur = 14;
      ctx.strokeStyle = '#ff44ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -11); ctx.lineTo(11, 11); ctx.lineTo(-11, 11); ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,68,255,0.1)';
      ctx.fill();
    } else {
      ctx.shadowColor = '#ff4444';
      ctx.shadowBlur = 10;
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, 9); ctx.lineTo(9, -9); ctx.lineTo(-9, -9); ctx.closePath();
      ctx.stroke();
    }
    // HP bar for multi-hp enemies
    if (e.maxHp > 1) {
      const bw = 24, bh = 3, bx = -bw / 2, by = e.type === 'dropper' ? 18 : 14;
      ctx.fillStyle = '#333';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = e.type === 'dropper' ? '#ffd700' : '#ff44ff';
      ctx.fillRect(bx, by, bw * (e.hp / e.maxHp), bh);
    }
    ctx.restore();
  }

  function drawBullet(ctx, b, isEnemy) {
    ctx.save();
    if (b.type === 'laser') {
      ctx.shadowColor = '#ff44ff';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#ff44ff';
      ctx.fillRect(b.x - 2, b.y - 10, 4, 18);
    } else if (b.type === 'raygun') {
      ctx.shadowColor = '#44ffaa';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = '#44ffaa';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x - 5, b.y); ctx.lineTo(b.x + 5, b.y);
      ctx.moveTo(b.x, b.y - 10); ctx.lineTo(b.x, b.y + 10);
      ctx.stroke();
    } else if (isEnemy) {
      ctx.shadowColor = '#ff6600';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#ff6600';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(b.x - 1.5, b.y - 7, 3, 14);
    }
    ctx.restore();
  }

  function drawPowerupItem(ctx, p) {
    const colors = { spread: '#ffdd00', laser: '#ff44ff', raygun: '#44ffaa', wingman: '#44aaff' };
    const labels = { spread: 'S', laser: 'L', raygun: 'R', wingman: 'W' };
    const c = colors[p.type] || '#fff';
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.shadowColor = c;
    ctx.shadowBlur = 16;
    ctx.strokeStyle = c;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = c + '33';
    ctx.fill();
    ctx.fillStyle = c;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labels[p.type], 0, 0);
    ctx.restore();
  }

  function drawParticle(ctx, p) {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 6;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function spawnExplosion(state, x, y, color = '#ff4444', count = 10) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = randomBetween(0.5, 3);
      state.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: randomBetween(1, 3.5),
        alpha: 1,
        color,
      });
    }
  }

  // ── Player fire ──────────────────────────────────────────────
  function playerFire(state) {
    const p = state.player;
    const pw = state.activePowerup;

    if (pw === 'spread') {
      [-20, -10, 0, 10, 20].forEach(angle => {
        const rad = (angle * Math.PI) / 180;
        state.bullets.push({ x: p.x, y: p.y - 18, vx: Math.sin(rad) * 5, vy: -10, type: 'spread' });
      });
    } else if (pw === 'laser') {
      state.bullets.push({ x: p.x, y: p.y - 18, vx: 0, vy: -18, type: 'laser' });
      state.bullets.push({ x: p.x + 8, y: p.y - 10, vx: 0, vy: -18, type: 'laser' });
    } else if (pw === 'raygun') {
      state.bullets.push({ x: p.x - 10, y: p.y - 12, vx: 0, vy: -8, type: 'raygun' });
      state.bullets.push({ x: p.x + 10, y: p.y - 12, vx: 0, vy: -8, type: 'raygun' });
    } else {
      state.bullets.push({ x: p.x, y: p.y - 18, vx: 0, vy: -12, type: 'normal' });
    }

    // Wingmen fire too
    if (pw === 'wingman') {
      state.wingmen.forEach(w => {
        state.bullets.push({ x: w.x, y: w.y - 10, vx: 0, vy: -12, type: 'normal' });
      });
    }
  }

  // ── Main loop ────────────────────────────────────────────────
  const loop = useCallback((timestamp) => {
    if (!stateRef.current.running) return;
    const dt = Math.min(timestamp - lastTimeRef.current, 32);
    lastTimeRef.current = timestamp;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const s = stateRef.current;
    const keys = keysRef.current;

    // Clear
    ctx.fillStyle = 'rgba(5,5,20,0.85)';
    ctx.fillRect(0, 0, W, H);

    // Stars
    s.stars.forEach(st => {
      st.y += st.speed;
      if (st.y > H) { st.y = 0; st.x = Math.random() * W; }
      ctx.globalAlpha = st.alpha;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    const p = s.player;

    // Player movement
    const speed = 4.5;
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) p.x = Math.max(16, p.x - speed);
    if (keys['ArrowRight'] || keys['d'] || keys['D']) p.x = Math.min(W - 16, p.x + speed);
    if (keys['ArrowUp'] || keys['w'] || keys['W']) p.y = Math.max(16, p.y - speed);
    if (keys['ArrowDown'] || keys['s'] || keys['S']) p.y = Math.min(H - 16, p.y + speed);

    // Wingmen follow player
    if (s.activePowerup === 'wingman') {
      const targets = [{ x: p.x - 40, y: p.y + 10 }, { x: p.x + 40, y: p.y + 10 }];
      s.wingmen.forEach((w, i) => {
        const t = targets[i];
        w.x += (t.x - w.x) * 0.1;
        w.y += (t.y - w.y) * 0.1;
      });
    }

    // Auto fire
    s.fireTimer--;
    const fireRate = s.activePowerup === 'laser' ? 4 : s.activePowerup === 'raygun' ? 10 : 8;
    if (s.fireTimer <= 0) {
      playerFire(s);
      s.fireTimer = fireRate;
    }

    // Powerup expiry
    if (s.activePowerup && Date.now() > s.powerupExpiry) {
      s.activePowerup = null;
      s.wingmen = [];
      onPowerupChange(null);
    }

    // Move bullets
    s.bullets = s.bullets.filter(b => {
      b.x += b.vx; b.y += b.vy;
      return b.y > -20 && b.y < H + 20 && b.x > -20 && b.x < W + 20;
    });

    // Enemy fire
    s.enemies.forEach(e => {
      e.fireTimer--;
      if (e.fireTimer <= 0) {
        const dx = p.x - e.x, dy = p.y - e.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const speed = e.type === 'dropper' ? 2.5 : 2;
        s.enemyBullets.push({ x: e.x, y: e.y, vx: (dx / len) * speed, vy: (dy / len) * speed });
        e.fireTimer = e.type === 'dropper' ? 100 : (s.wave > 3 ? 50 : 70);
      }
    });

    // Move enemy bullets
    s.enemyBullets = s.enemyBullets.filter(b => {
      b.x += b.vx; b.y += b.vy;
      return b.y < H + 20 && b.x > -20 && b.x < W + 20;
    });

    // Move enemies
    s.enemies.forEach(e => {
      e.x += e.vx; e.y += e.vy;
      if (e.x < 20 || e.x > W - 20) e.vx *= -1;
    });

    // Move powerup items
    s.powerupItems.forEach(item => { item.y += 1.2; item.angle = (item.angle || 0) + 0.03; });
    s.powerupItems = s.powerupItems.filter(item => item.y < H + 30);

    // Bullet vs enemy collision
    const piercingTypes = ['laser', 'raygun'];
    s.bullets.forEach(b => {
      if (b.hit) return;
      s.enemies.forEach(e => {
        if (e.dead) return;
        const dx = b.x - e.x, dy = b.y - e.y;
        const hit = Math.abs(dx) < e.w && Math.abs(dy) < e.h;
        if (hit) {
          e.hp--;
          if (!piercingTypes.includes(b.type)) b.hit = true;
          if (e.hp <= 0) {
            e.dead = true;
            const pts = e.type === 'dropper' ? 500 : e.type === 'elite' ? 300 : 100;
            s.score += pts;
            onScoreChange(s.score);
            spawnExplosion(s, e.x, e.y, e.type === 'dropper' ? '#ffd700' : e.type === 'elite' ? '#ff44ff' : '#ff4444', 14);
            // Drop powerup
            if (e.type === 'dropper') {
              s.powerupItems.push({ x: e.x, y: e.y, type: e.drop, angle: 0 });
            }
          }
        }
      });
    });
    s.bullets = s.bullets.filter(b => !b.hit);
    s.enemies = s.enemies.filter(e => !e.dead);

    // Player vs powerup item
    s.powerupItems = s.powerupItems.filter(item => {
      const dx = item.x - p.x, dy = item.y - p.y;
      if (Math.sqrt(dx * dx + dy * dy) < 20) {
        s.activePowerup = item.type;
        s.powerupExpiry = Date.now() + POWERUP_DURATION;
        if (item.type === 'wingman') {
          s.wingmen = [
            { x: p.x - 40, y: p.y + 10 },
            { x: p.x + 40, y: p.y + 10 },
          ];
        } else {
          s.wingmen = [];
        }
        onPowerupChange(item.type);
        return false;
      }
      return true;
    });

    // Enemy bullet vs player
    s.enemyBullets = s.enemyBullets.filter(b => {
      const dx = b.x - p.x, dy = b.y - p.y;
      if (Math.sqrt(dx * dx + dy * dy) < 12) {
        s.lives--;
        onLivesChange(s.lives);
        spawnExplosion(s, p.x, p.y, '#00f0ff', 16);
        if (s.lives <= 0) {
          s.running = false;
          setGameState('gameover');
        }
        return false;
      }
      return true;
    });

    // Enemy vs player collision
    s.enemies = s.enemies.filter(e => {
      const dx = e.x - p.x, dy = e.y - p.y;
      if (Math.abs(dx) < 16 && Math.abs(dy) < 16) {
        e.dead = true;
        s.lives--;
        onLivesChange(s.lives);
        spawnExplosion(s, e.x, e.y, '#ff4444', 12);
        if (s.lives <= 0) {
          s.running = false;
          setGameState('gameover');
        }
        return false;
      }
      return true;
    });

    // Wave clear
    if (s.enemies.length === 0) {
      s.waveTimer++;
      if (s.waveTimer > 90) {
        s.wave++;
        s.waveTimer = 0;
        onWaveChange(s.wave);
        spawnWave(W, s);
      }
    }

    // Update particles
    s.particles.forEach(pt => {
      pt.x += pt.vx; pt.y += pt.vy;
      pt.vy += 0.04;
      pt.alpha -= 0.025;
    });
    s.particles = s.particles.filter(pt => pt.alpha > 0);

    // Draw everything
    s.particles.forEach(pt => drawParticle(ctx, pt));
    s.powerupItems.forEach(item => drawPowerupItem(ctx, item));
    s.enemies.forEach(e => drawEnemy(ctx, e));
    s.bullets.forEach(b => drawBullet(ctx, b, false));
    s.enemyBullets.forEach(b => drawBullet(ctx, b, true));
    drawPlayer(ctx, p, s.wingmen);

    animRef.current = requestAnimationFrame(loop);
  }, [onScoreChange, onLivesChange, onWaveChange, onPowerupChange, setGameState]);

  // ── Start / stop ─────────────────────────────────────────────
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
      const W = canvas.width, H = canvas.height;
      const s = stateRef.current;
      s.player = { x: W / 2, y: H - 80 };
      s.bullets = [];
      s.enemyBullets = [];
      s.particles = [];
      s.powerupItems = [];
      s.wingmen = [];
      s.score = 0;
      s.lives = 3;
      s.wave = 1;
      s.waveTimer = 0;
      s.fireTimer = 0;
      s.activePowerup = null;
      s.powerupExpiry = 0;
      s.stars = initStars(W, H);
      s.running = true;
      spawnWave(W, s);
      lastTimeRef.current = performance.now();
      animRef.current = requestAnimationFrame(loop);
    } else {
      stateRef.current.running = false;
      if (animRef.current) cancelAnimationFrame(animRef.current);
    }

    return () => {
      window.removeEventListener('resize', resize);
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