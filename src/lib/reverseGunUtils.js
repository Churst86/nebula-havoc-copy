// Reverse shotgun (rear-firing) utilities
export function fireReverseShot(s) {
  const p = s.player;
  const reverseTier = s.powerups.reverse || 0;
  if (reverseTier === 0) return;
  
  if (reverseTier === 1) {
    s.bullets.push({ x: p.x, y: p.y + 18, vx: 0, vy: 7, type: 'reverse' });
  } else if (reverseTier === 2) {
    s.bullets.push({ x: p.x - 6, y: p.y + 18, vx: -3.5, vy: 7, type: 'reverse' });
    s.bullets.push({ x: p.x + 6, y: p.y + 18, vx: 3.5, vy: 7, type: 'reverse' });
  } else {
    s.bullets.push({ x: p.x, y: p.y + 18, vx: 0, vy: 7, type: 'reverse' });
    s.bullets.push({ x: p.x - 8, y: p.y + 18, vx: -3.5, vy: 7, type: 'reverse' });
    s.bullets.push({ x: p.x + 8, y: p.y + 18, vx: 3.5, vy: 7, type: 'reverse' });
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