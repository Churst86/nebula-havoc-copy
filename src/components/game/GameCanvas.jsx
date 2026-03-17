import React, { useRef, useEffect, useCallback } from 'react';
import MobileControls from './MobileControls';
import { sounds } from '../../hooks/useSound.js';

// Power-up types (no timer — permanent until replaced/stacked)
const POWERUP_TYPES = ['spread', 'laser', 'raygun', 'wingman', 'shield', 'bounce'];

// Laser charge/burst constants
const LASER_CHARGE_FRAMES = 60;
const LASER_BURST_SHOTS = 8;
const LASER_COOLDOWN_FRAMES = 90;

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
    spiralAngle: 0,
    // Laser charge-burst state
    laserCharge: 0,       // counts up each frame while laser is active
    laserCooldown: 0,     // frames remaining in cooldown after a burst
    laserBursting: false,
    laserBurstShots: 0,
    // Power-up system: max 2 types. lockedPowerups = the 2 chosen types (excludes shield)
    powerups: {},
    lockedPowerups: [],   // up to 2 non-shield powerup keys
    shieldHp: 0,
    running: false,
  };
}

// Offensive powerup types (not shield — shield is always droppable)
const OFFENSIVE_POWERUPS = ['spread', 'laser', 'raygun', 'wingman', 'bounce'];

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
        hp: 80 + wave * 12, maxHp: 80 + wave * 12,
        vx: 1.2, vy: 0.3,
        fireTimer: 40,
        phase: 0,
      });
      sounds.startBossMusic();
    } else {
      sounds.startWaveMusic(wave);
    }

    // Dropper (powerup carrier) — drop pool determined at pickup time, not spawn time
    enemies.push({
      type: 'dropper',
      x: randomBetween(60, W - 60), y: -40,
      w: 28, h: 28,
      hp: 5, maxHp: 5,
      vx: randomBetween(-0.5, 0.5), vy: 0.7,
      fireTimer: randomBetween(120, 180),
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

  // ── Fire logic ───────────────────────────────────────────────
  // Laser charge constants
  const LASER_CHARGE_FRAMES = 60;   // frames to fully charge
  const LASER_BURST_SHOTS   = 8;    // how many rapid shots in one burst
  const LASER_COOLDOWN_FRAMES = 90; // frames of cooldown after burst

  function fireLaserBurstShot(s, shotIndex) {
    const p = s.player;
    const laserTier = s.powerups.laser || 1;
    const count = laserTier + 1;
    const spacing = 18 + laserTier * 6;
    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * spacing;
      const angle = offset * 0.008;
      // Slight spread on burst shots for dramatic feel
      const spread = (shotIndex / LASER_BURST_SHOTS) * 0.3 - 0.15;
      s.bullets.push({ x: p.x + offset, y: p.y - 18, vx: angle + spread, vy: -20, type: 'laser', fat: laserTier });
    }
  }

  function playerFire(s) {
    const p = s.player;
    const pw = s.powerups;

    const spreadTier = pw.spread || 0;
    const laserTier  = pw.laser  || 0;
    const raygunTier = pw.raygun || 0;
    const bounceTier = pw.bounce || 0;

    // Laser is handled separately via charge/burst system (not here)
    if (spreadTier > 0) {
      const [spread, count] = spreadTier === 1 ? [40, 5] : spreadTier === 2 ? [90, 7] : [160, 9];
      for (let i = 0; i < count; i++) {
        const angle = -spread / 2 + (spread / (count - 1)) * i;
        const rad = (angle * Math.PI) / 180;
        s.bullets.push({ x: p.x, y: p.y - 18, vx: Math.sin(rad) * 6, vy: -Math.cos(rad) * 10, type: 'spread' });
      }
    }

    if (raygunTier > 0) {
      const arms = raygunTier + 1;
      const speed = 9;
      for (let i = 0; i < arms; i++) {
        const a = s.spiralAngle + (i / arms) * Math.PI * 2;
        s.bullets.push({ x: p.x, y: p.y - 10, vx: Math.sin(a) * speed * 0.55, vy: -Math.cos(a) * speed, type: 'raygun' });
      }
      s.spiralAngle += 0.35;
    }

    if (bounceTier > 0) {
      const bounces = bounceTier;
      s.bullets.push({ x: p.x - 8, y: p.y - 14, vx: -4, vy: -9, type: 'bounce', bouncesLeft: bounces });
      s.bullets.push({ x: p.x + 8, y: p.y - 14, vx:  4, vy: -9, type: 'bounce', bouncesLeft: bounces });
    }

    if (spreadTier === 0 && laserTier === 0 && raygunTier === 0 && bounceTier === 0) {
      s.bullets.push({ x: p.x, y: p.y - 18, vx: 0, vy: -12, type: 'normal' });
    }

    // Wingmen fire — aim at nearest enemy with weak slow shots
    if ((pw.wingman || 0) > 0) {
      s.wingmen.forEach(w => {
        // Find nearest enemy
        let target = null, bestDist = Infinity;
        s.enemies.forEach(e => {
          const d = Math.hypot(e.x - w.x, e.y - w.y);
          if (d < bestDist) { bestDist = d; target = e; }
        });
        if (target) {
          const dx = target.x - w.x, dy = target.y - w.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const spd = 7; // slower than player
          s.bullets.push({ x: w.x, y: w.y - 10, vx: (dx / len) * spd, vy: (dy / len) * spd, type: 'wingman' });
        } else {
          s.bullets.push({ x: w.x, y: w.y - 10, vx: 0, vy: -7, type: 'wingman' });
        }
      });
    }
  }

  function getFireRate(pw) {
    // Laser fire rate doesn't apply here (handled by charge system), return slow base for non-laser
    if ((pw.laser || 0) > 0) return 999; // laser fires via charge burst only
    if ((pw.raygun || 0) > 0) return Math.max(5, 10 - (pw.raygun || 0) * 2);
    if ((pw.spread || 0) > 0) return Math.max(5, 8 - (pw.spread || 0));
    return 8;
  }

  // ── Drawing ──────────────────────────────────────────────────
  function drawPlayer(ctx, p, wingmen, shieldHp, enemies) {
    wingmen.forEach(w => {
      // Rotate wingman to face nearest enemy
      let angle = -Math.PI / 2; // default: point up
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
    if (b.type === 'wingman') {
      // Soft blue-white small orb — weak but distinct from player/enemy
      ctx.shadowColor = '#aaddff'; ctx.shadowBlur = 8;
      ctx.fillStyle = '#aaddff';
      ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
    } else if (b.type === 'bounce') {
      // Vivid lime-green — clearly distinct from orange enemy shots
      ctx.shadowColor = '#aaff00'; ctx.shadowBlur = 12;
      ctx.fillStyle = '#aaff00';
      ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, Math.PI * 2); ctx.fill();
      // Small inner white core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(b.x, b.y, 2, 0, Math.PI * 2); ctx.fill();
    } else if (b.type === 'laser') {
      const w = 3 + (b.fat || 1) * 2; // fatter per tier
      ctx.shadowColor = '#ff44ff'; ctx.shadowBlur = 14 + (b.fat || 1) * 4;
      // Bright core
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(b.x - w * 0.3, b.y - 12, w * 0.6, 22);
      // Outer glow beam
      ctx.fillStyle = '#ff44ff';
      ctx.fillRect(b.x - w, b.y - 12, w * 2, 22);
    } else if (b.type === 'raygun') {
      // Glowing orb for spiral shot
      ctx.shadowColor = '#44ffaa'; ctx.shadowBlur = 16;
      const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 7);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.4, '#44ffaa');
      grad.addColorStop(1, 'rgba(68,255,170,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 7, 0, Math.PI * 2);
      ctx.fill();
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
    const colors = { spread: '#ffdd00', laser: '#ff44ff', raygun: '#44ffaa', wingman: '#44aaff', shield: '#00ccff', bounce: '#aaff00' };
    const labels = { spread: 'S', laser: 'L', raygun: 'R', wingman: 'W', shield: '🛡', bounce: 'B' };
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
      sounds.stopAllMusic();
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

    // Auto fire (non-laser weapons)
    s.fireTimer--;
    if (s.fireTimer <= 0) {
      playerFire(s);
      s.fireTimer = getFireRate(s.powerups);
    }

    // ── Laser charge / burst / cooldown ──────────────────────
    if ((s.powerups.laser || 0) > 0) {
      if (s.laserCooldown > 0) {
        s.laserCooldown--;
      } else if (s.laserBursting) {
        // Fire one burst shot per frame during burst
        if (s.laserBurstShots > 0) {
          fireLaserBurstShot(s, LASER_BURST_SHOTS - s.laserBurstShots);
          s.laserBurstShots--;
        } else {
          s.laserBursting = false;
          s.laserCharge = 0;
          s.laserCooldown = LASER_COOLDOWN_FRAMES;
        }
      } else {
        s.laserCharge++;
        if (s.laserCharge >= LASER_CHARGE_FRAMES) {
          s.laserBursting = true;
          s.laserBurstShots = LASER_BURST_SHOTS + (s.powerups.laser - 1) * 4;
          sounds.powerup(); // charge-complete sound cue
        }
      }
    } else {
      s.laserCharge = 0; s.laserCooldown = 0; s.laserBursting = false; s.laserBurstShots = 0;
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

    // Move bullets (bounce off walls)
    s.bullets = s.bullets.filter(b => {
      b.x += b.vx; b.y += b.vy;
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
    const piercingTypes = ['laser', 'raygun', 'spread'];
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
              // If 2 powerups are locked, only drop one of those 2 (or shield)
              let dropType;
              if (s.lockedPowerups.length >= 2) {
                // Occasionally drop shield too
                const pool = [...s.lockedPowerups, 'shield'];
                dropType = pool[Math.floor(Math.random() * pool.length)];
              } else {
                // Still picking powerups — drop any offensive type
                dropType = OFFENSIVE_POWERUPS[Math.floor(Math.random() * OFFENSIVE_POWERUPS.length)];
              }
              s.powerupItems.push({ x: e.x, y: e.y, type: dropType, angle: 0 });
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
          // Enforce 2-powerup lock: only accept if already in locked list or can add a slot
          const isLocked = s.lockedPowerups.includes(item.type);
          const canAdd = s.lockedPowerups.length < 2;
          if (!isLocked && !canAdd) return true; // reject — slots full with different types
          if (!isLocked) s.lockedPowerups.push(item.type);
          s.powerups[item.type] = Math.min((s.powerups[item.type] || 0) + 1, 3);
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
    drawPlayer(ctx, p, s.wingmen, s.shieldHp, s.enemies);

    // Laser charge indicator — pulsing arc above player
    if ((s.powerups.laser || 0) > 0) {
      const pct = s.laserCooldown > 0 ? 0 : Math.min(s.laserCharge / LASER_CHARGE_FRAMES, 1);
      if (s.laserCooldown > 0) {
        // Cooldown: grey arc
        ctx.save();
        ctx.strokeStyle = 'rgba(180,180,180,0.3)';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - s.laserCooldown / LASER_COOLDOWN_FRAMES));
        ctx.stroke();
        ctx.restore();
      } else if (!s.laserBursting) {
        // Charging: pink arc growing
        ctx.save();
        ctx.strokeStyle = `rgba(255,68,255,${0.4 + pct * 0.6})`;
        ctx.shadowColor = '#ff44ff'; ctx.shadowBlur = 8 + pct * 16;
        ctx.lineWidth = 2 + pct * 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 28 + pct * 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
        ctx.stroke();
        ctx.restore();
      }
    }

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