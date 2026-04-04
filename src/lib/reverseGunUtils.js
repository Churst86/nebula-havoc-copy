// Reverse shotgun (rear-firing) utilities
import { acquireBullet } from './bulletPool.js';

export function fireReverseShot(s) {
  const p = s.player;
  const reverseTier = s.powerups.reverse || 0;
  if (reverseTier === 0) return;

  // Reverse gun scales by level: each tier adds one pellet.
  const pelletCount = Math.max(1, Math.min(10, reverseTier));
  const spreadDeg = pelletCount === 1 ? 0 : Math.min(150, 12 + reverseTier * 11);
  const speed = 7.2;

  for (let i = 0; i < pelletCount; i++) {
    const t = pelletCount === 1 ? 0.5 : i / (pelletCount - 1);
    const angleDeg = -spreadDeg / 2 + spreadDeg * t;
    const rad = (angleDeg * Math.PI) / 180;
    acquireBullet(s, {
      x: p.x,
      y: p.y + 18,
      vx: Math.sin(rad) * speed,
      vy: Math.cos(rad) * speed,
      type: 'reverse',
    }, 'player');
  }
}

export function drawReverseFlame(ctx, p, reverseTier, t) {
  if (reverseTier < 10) return;
  
  // Tier 10: blue flame effect at rear of ship
  ctx.save();
  ctx.translate(p.x, p.y + 20);
  
  const flameLen = 20 + Math.sin(t * 0.01) * 5;
  const flameW = 8 + Math.cos(t * 0.015) * 2;
  
  ctx.shadowColor = '#00bbff';
  ctx.shadowBlur = 15;
  
  // Main flame
  const grad = ctx.createLinearGradient(0, 0, 0, flameLen);
  grad.addColorStop(0, 'rgba(0,187,255,0.9)');
  grad.addColorStop(0.5, 'rgba(0,200,255,0.5)');
  grad.addColorStop(1, 'rgba(0,200,255,0)');
  
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(-flameW / 2, 0);
  ctx.lineTo(flameW / 2, 0);
  ctx.lineTo(flameW / 3, flameLen);
  ctx.lineTo(-flameW / 3, flameLen);
  ctx.closePath();
  ctx.fill();
  
  ctx.restore();
}