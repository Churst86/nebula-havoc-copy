import React, { useRef, useEffect, useCallback } from 'react';
import MobileControls from './MobileControls';
import { sounds } from '../../hooks/useSound.js';

// Power-up types (no timer — permanent until replaced/stacked)
const POWERUP_TYPES = ['spread', 'laser', 'raygun', 'wingman', 'shield'];

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
    score: 0,
    lives: 3,
    wave: 1,
    waveTimer: 0,
    fireTimer: 0,
    // Stacking power-ups: { spread: 2, laser: 1, ... }
    powerups: {},
    shieldHp: 0,   // 0 = no shield, 1-3 = active
    running: false,
  };
}

export default function GameCanvas({ gameState, setGameState, onScoreChange, onLivesChange, onWaveChange, onPowerupChange }) {
  const canvasRef = useRef(null);
  const keysRef = useRef({});
  const stateRef = useRef(initState());
  const animRef = useRef(null);
  const lastTimeRef = useRef(0);

  // ── Stars ────────────────────────────────────────────────────
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

    // Boss every 5 waves
    if (wave % 5 === 0) {
      enemies.push({
        type: 'boss',
        x: W / 2, y: -60,
        w: 45, h: 45,
        hp: 30 + wave * 5, maxHp: 30 + wave * 5,
        vx: 1.2, vy: 0.3,
        fireTimer: 40,
        phase: 0,
      });
      sounds.startBossMusic();
    } else {
      sounds.stopBossMusic();
    }

    // Dropper (powerup carrier)
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
    s.enemies = enemies;
  }

  // ── Fire logic (stacked tiers) ───────────────────────────────
  function playerFire(s) {
    const p = s.player;
    const pw = s.powerups;

    const spreadTier = pw.spread || 0;
    const laserTier  = pw.laser  || 0;
    const raygunTier = pw.raygun || 0;

    if (spreadTier > 0) {
      const angles = spreadTier === 1 ? [-20, -10, 0, 10, 20]
                   : spreadTier === 2 ? [-30, -15, 0, 15, 30, -22, 22]
                   : [-35, -20, -10, 0, 10, 20, 35, -25, 25];
      angles.forEach(angle => {
        const rad = (angle * Math.PI) / 180;
        s.bullets.push({ x: p.x, y: p.y - 18, vx: Math.sin(rad) * 5, vy: -10, type: 'spread' });
      });
    }

    if (laserTier > 0) {
      const count = laserTier + 1;
      for (let i = 0; i < count; i++) {
        const offset = (i - (count - 1) / 2) * 10;
        s.bullets.push({ x: p.x + offset, y: p.y - 18, vx: 0, vy: -18, type: 'laser' });
      }
    }

    if (raygunTier > 0) {
      const count = raygunTier + 1;
      for (let i = 0; i < count; i++) {
        const offset = (i - (count - 1) / 2) * 16;
        s.bullets.push({ x: p.x + offset, y: p.y - 12, vx: 0, vy: -8, type: 'raygun' });
      }
    }

    // Default shot if no offensive powerup
    if (spreadTier === 0 && laserTier === 0 && raygunTier === 0) {
      s.bullets.push({ x: p.x, y: p.y - 18, vx: 0, vy: -12, type: 'normal' });
    }

    // Wingmen fire
    if ((pw.wingman || 0) > 0) {
      s.wingmen.forEach(w => {
        s.bullets.push({ x: w.x, y: w.y - 10, vx: 0, vy: -12, type: 'normal' });
      });
    }
  }

  function getFireRate(pw) {
    if ((pw.laser || 0) > 0) return Math.max(2, 5 - (pw.laser || 0));
    if ((pw.raygun || 0) > 0) return Math.max(4, 10 - (pw.raygun || 0) * 2);
    if ((pw.spread || 0) > 0) return Math.max(5, 8 - (pw.spread || 0));
    return 8;
  }

  // ── Drawing ──────────────────────────────────────────────────
  function drawPlayer(ctx, p, wingmen, shieldHp) {
    wingmen.forEach(w => {
      ctx.save();
      ctx.translate(w.x, w.y);
      ctx.shadowColor = '#44aaff'; ctx.shadowBlur = 10;
      ctx.strokeStyle = '#44aaff'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -10); ctx.lineTo(8, 8); ctx.lineTo(0, 4); ctx.lineTo(-8, 8); ctx.closePath();
      ctx.stroke();
      ctx.restore();
    });

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 18;
    ctx.strokeStyle = '#00f0ff'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -18); ctx.lineTo(13, 12); ctx.lineTo(0, 6); ctx.lineTo(-13, 12); ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,240,255,0.15)';
    ctx.fill();

    // Shield ring
    if (shieldHp > 0) {
      const alpha = 0.3 + shieldHp * 0.2;
      ctx.shadowColor = '#00aaff';
      ctx.shadowBlur = 20;
      ctx.strokeStyle = `rgba(0,180,255,${alpha})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.stroke();
      // Shield pip dots
      for (let i = 0; i < shieldHp; i++) {
        const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
        ctx.fillStyle = '#00ccff';
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 26, Math.sin(a) * 26, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawEnemy(ctx, e) {
    ctx.save();
    ctx.translate(e.x, e.y);

    if (e.type === 'boss') {
      ctx.shadowColor = '#ff0066'; ctx.shadowBlur = 30;
      ctx.strokeStyle = '#ff0066'; ctx.lineWidth = 3;
      // Skull-like shape
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 === 0 ? 40 : 28;
        i === 0 ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,0,102,0.1)';
      ctx.fill();
      ctx.fillStyle = '#ff0066';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('☠', 0, 0);
    } else if (e.type === 'dropper') {
      ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 16;
      ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        const r = 14;
        i === 0 ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,215,0,0.12)'; ctx.fill();
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('★', 0, 0);
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
      const bw = e.type === 'boss' ? 70 : 24, bh = 3;
      const bx = -bw / 2, by = e.type === 'boss' ? 48 : e.type === 'dropper' ? 18 : 14;
      ctx.fillStyle = '#333'; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = e.type === 'boss' ? '#ff0066' : e.type === 'dropper' ? '#ffd700' : '#ff44ff';
      ctx.fillRect(bx, by, bw * (e.hp / e.maxHp), bh);
    }
    ctx.restore();
  }

  function drawBullet(ctx, b, isEnemy) {
    ctx.save();
    if (b.type === 'laser') {
      ctx.shadowColor = '#ff44ff'; ctx.shadowBlur = 10;
      ctx.fillStyle = '#ff44ff';
      ctx.fillRect(b.x - 2, b.y - 10, 4, 18);
    } else if (b.type === 'raygun') {
      ctx.shadowColor = '#44ffaa'; ctx.shadowBlur = 12;
      ctx.strokeStyle = '#44ffaa'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x - 5, b.y); ctx.lineTo(b.x + 5, b.y);
      ctx.moveTo(b.x, b.y - 10); ctx.lineTo(b.x, b.y + 10);
      ctx.stroke();
    } else if (isEnemy) {
      const isBoss = b.boss;
      ctx.shadowColor = isBoss ? '#ff0066' : '#ff6600'; ctx.shadowBlur = isBoss ? 14 : 8;
      ctx.fillStyle = isBoss ? '#ff0066' : '#ff6600';
      ctx.beginPath();
      ctx.arc(b.x, b.y, isBoss ? 6 : 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 8;
      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(b.x - 1.5, b.y - 7, 3, 14);
    }
    ctx.restore();
  }

  function drawPowerupItem(ctx, item) {
    const colors = { spread: '#ffdd00', laser: '#ff44ff', raygun: '#44ffaa', wingman: '#44aaff', shield: '#00ccff' };
    const labels = { spread: 'S', laser: 'L', raygun: 'R', wingman: 'W', shield: '🛡' };
    const c = colors[item.type] || '#fff';
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(item.angle || 0);
    ctx.shadowColor = c; ctx.shadowBlur = 16;
    ctx.strokeStyle = c; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = c + '33'; ctx.fill();
    ctx.fillStyle = c;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(labels[item.type], 0, 0);
    ctx.restore();
  }

  function drawParticle(ctx, pt) {
    ctx.save();
    ctx.globalAlpha = pt.alpha;
    ctx.shadowColor = pt.color; ctx.shadowBlur = 6;
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
    ctx.fill();
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
      if (s.shieldHp === 0) {
        sounds.shieldBreak();
        delete s.powerups.shield;
      }
      onPowerupChange({ ...s.powerups, shieldHp: s.shieldHp });
      return;
    }
    s.lives--;
    onLivesChange(s.lives);
    sounds.playerHit();
    if (s.lives <= 0) {
      sounds.stopBossMusic();
      s.running = false;
      setGameState('gameover');
    }
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
    const spd = 4.5;
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) p.x = Math.max(16, p.x - spd);
    if (keys['ArrowRight'] || keys['d'] || keys['D']) p.x = Math.min(W - 16, p.x + spd);
    if (keys['ArrowUp'] || keys['w'] || keys['W']) p.y = Math.max(16, p.y - spd);
    if (keys['ArrowDown'] || keys['s'] || keys['S']) p.y = Math.min(H - 16, p.y + spd);

    // Wingmen follow
    if ((s.powerups.wingman || 0) > 0) {
      const tier = s.powerups.wingman;
      const targets = [
        { x: p.x - 40, y: p.y + 10 }, { x: p.x + 40, y: p.y + 10 },
        { x: p.x - 70, y: p.y + 20 }, { x: p.x + 70, y: p.y + 20 },
      ].slice(0, Math.min(tier * 2, 4));
      // Ensure correct count
      while (s.wingmen.length < targets.length) s.wingmen.push({ ...targets[s.wingmen.length] });
      while (s.wingmen.length > targets.length) s.wingmen.pop();
      s.wingmen.forEach((w, i) => {
        w.x += (targets[i].x - w.x) * 0.1;
        w.y += (targets[i].y - w.y) * 0.1;
      });
    }

    // Auto fire
    s.fireTimer--;
    if (s.fireTimer <= 0) {
      playerFire(s);
      s.fireTimer = getFireRate(s.powerups);
    }

    // Boss movement (phase-based)
    s.enemies.forEach(e => {
      if (e.type === 'boss') {
        e.phase = (e.phase || 0) + 0.01;
        e.x += Math.sin(e.phase) * 2;
        e.y = Math.min(e.y + 0.15, H * 0.25);
        if (e.x < 50 || e.x > W - 50) e.vx *= -1;
      } else {
        e.x += e.vx; e.y += e.vy;
        if (e.x < 20 || e.x > W - 20) e.vx *= -1;
      }
    });

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
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        if (e.type === 'boss') {
          // Boss fires spread
          [-20, -10, 0, 10, 20].forEach(angle => {
            const rad = (angle * Math.PI) / 180;
            const bvx = (dx / len) * 3;
            const bvy = (dy / len) * 3;
            s.enemyBullets.push({ x: e.x, y: e.y, vx: bvx + Math.sin(rad) * 2, vy: bvy + Math.cos(rad) * 0.5, boss: true });
          });
          e.fireTimer = 30;
        } else {
          const bspd = e.type === 'dropper' ? 2.5 : 2;
          s.enemyBullets.push({ x: e.x, y: e.y, vx: (dx / len) * bspd, vy: (dy / len) * bspd });
          e.fireTimer = e.type === 'dropper' ? 100 : (s.wave > 3 ? 50 : 70);
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

    // Bullet vs enemy
    const piercingTypes = ['laser', 'raygun'];
    s.bullets.forEach(b => {
      if (b.hit) return;
      s.enemies.forEach(e => {
        if (e.dead) return;
        const dx = b.x - e.x, dy = b.y - e.y;
        if (Math.abs(dx) < e.w && Math.abs(dy) < e.h) {
          e.hp--;
          sounds.hit();
          if (!piercingTypes.includes(b.type)) b.hit = true;
          if (e.hp <= 0) {
            e.dead = true;
            const pts = e.type === 'boss' ? 5000 : e.type === 'dropper' ? 500 : e.type === 'elite' ? 300 : 100;
            s.score += pts;
            onScoreChange(s.score);
            sounds.kill();
            spawnExplosion(s, e.x, e.y,
              e.type === 'boss' ? '#ff0066' : e.type === 'dropper' ? '#ffd700' : e.type === 'elite' ? '#ff44ff' : '#ff4444',
              e.type === 'boss' ? 40 : 14
            );
            if (e.type === 'dropper') {
              sounds.killDropper();
              s.powerupItems.push({ x: e.x, y: e.y, type: e.drop, angle: 0 });
            }
            if (e.type === 'boss') {
              sounds.stopBossMusic();
              sounds.waveComplete();
            }
          }
        }
      });
    });
    s.bullets = s.bullets.filter(b => !b.hit);
    s.enemies = s.enemies.filter(e => !e.dead);

    // Player picks up powerup
    s.powerupItems = s.powerupItems.filter(item => {
      const dx = item.x - p.x, dy = item.y - p.y;
      if (Math.sqrt(dx * dx + dy * dy) < 22) {
        if (item.type === 'shield') {
          s.shieldHp = Math.min(3, s.shieldHp + 3);
          sounds.shield();
        } else {
          s.powerups[item.type] = Math.min((s.powerups[item.type] || 0) + 1, 3);
          if (item.type === 'wingman') {
            // wingmen array will resize next frame
          }
          sounds.powerup();
        }
        onPowerupChange({ ...s.powerups, shieldHp: s.shieldHp });
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
        e.dead = true;
        spawnExplosion(s, e.x, e.y, '#ff4444', 12);
        takeDamage(s);
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
        sounds.waveComplete();
        spawnWave(W, s);
      }
    }

    // Particles
    s.particles.forEach(pt => { pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.04; pt.alpha -= 0.025; });
    s.particles = s.particles.filter(pt => pt.alpha > 0);

    // Draw
    s.particles.forEach(pt => drawParticle(ctx, pt));
    s.powerupItems.forEach(item => drawPowerupItem(ctx, item));
    s.enemies.forEach(e => drawEnemy(ctx, e));
    s.bullets.forEach(b => drawBullet(ctx, b, false));
    s.enemyBullets.forEach(b => drawBullet(ctx, b, true));
    drawPlayer(ctx, p, s.wingmen, s.shieldHp);

    animRef.current = requestAnimationFrame(loop);
  }, [onScoreChange, onLivesChange, onWaveChange, onPowerupChange, setGameState]);

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
    } else {
      sounds.stopBossMusic();
      stateRef.current.running = false;
      if (animRef.current) cancelAnimationFrame(animRef.current);
    }

    return () => {
      window.removeEventListener('resize', resize);
      sounds.stopBossMusic();
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