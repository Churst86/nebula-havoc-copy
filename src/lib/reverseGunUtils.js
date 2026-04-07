// Reverse shotgun (rear-firing) utilities
import { acquireBullet } from './bulletPool.js';

export function fireReverseShot(s, aim) {
  const p = s.player;
  const reverseTier = s.powerups.reverse || 0;
  if (reverseTier === 0) return;

  // Use provided aim transform (must be correct for current mode)
  // Rear position: opposite the nose (behind the ship)
  const rearX = p.x - aim.dirX * 18;
  const rearY = p.y - aim.dirY * 18;
  const rearDirX = -aim.dirX;
  const rearDirY = -aim.dirY;

  // Reverse gun scales by level: each tier adds one pellet.
  const pelletCount = Math.max(1, Math.min(10, reverseTier));
  const spreadDeg = pelletCount === 1 ? 0 : Math.min(150, 12 + reverseTier * 11);
  const speed = 7.2;

  // Get global attack bonus if available
  let atkDmgMult = 1;
  if (typeof s.shopUpgradesRef === 'object' && typeof s.shopUpgradesRef.current === 'object') {
    const atkDmg = s.shopUpgradesRef.current.atkDmg || 0;
    atkDmgMult = 1 + atkDmg * 0.01;
  }
  // Double damage for level 10 reverse
  if (reverseTier >= 10) atkDmgMult *= 2;
  for (let i = 0; i < pelletCount; i++) {
    const t = pelletCount === 1 ? 0.5 : i / (pelletCount - 1);
    // Spread is centered on the REAR direction
    const angleRad = Math.atan2(rearDirY, rearDirX) - (spreadDeg * Math.PI / 180) / 2 + (spreadDeg * Math.PI / 180) * t;
    acquireBullet(s, {
      x: rearX,
      y: rearY,
      vx: Math.cos(angleRad) * speed,
      vy: Math.sin(angleRad) * speed,
      type: 'reverse',
      color: '#0033aa', // Dark blue core
      glow: ['#0033aa', '#00e6ff'], // Blue to cyan blend
      atkDmgMult,
    }, 'player');
  }
}

export function drawReverseFlame(ctx, p, reverseTier, t) {
  if (reverseTier < 10) return;
  
  // Tier 10: magenta-cyan blend flame at rear of ship
  ctx.save();
  ctx.translate(p.x, p.y + 20);
  
  const flameLen = 20 + Math.sin(t * 0.01) * 5;
  const flameW = 8 + Math.cos(t * 0.015) * 2;
  
  // Magenta-cyan shadow glow
  ctx.shadowColor = '#ff44cc';
  ctx.shadowBlur = 10;
  // Main flame gradient: magenta to cyan
  const grad = ctx.createLinearGradient(0, 0, 0, flameLen);
  grad.addColorStop(0, 'rgba(255,68,204,0.9)'); // Magenta
  grad.addColorStop(0.5, 'rgba(255,255,255,0.7)'); // White core
  grad.addColorStop(1, 'rgba(0,230,255,0.8)'); // Cyan
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(-flameW / 2, 0);
  ctx.lineTo(flameW / 2, 0);
  ctx.lineTo(flameW / 3, flameLen);
  ctx.lineTo(-flameW / 3, flameLen);
  ctx.closePath();
  ctx.fill();
  // Add a cyan outer glow
  ctx.shadowColor = '#00e6ff';
  ctx.shadowBlur = 18;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.ellipse(0, flameLen * 0.7, flameW * 0.7, flameLen * 0.4, 0, 0, 2 * Math.PI);
  ctx.fill();
  ctx.globalAlpha = 1.0;
  ctx.restore();
}