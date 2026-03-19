// Missile weapon utilities
export function fireMissiles(s, source, missileTier) {
  const count = missileTier >= 10 ? 1 : Math.min(missileTier, 3);
  for (let i = 0; i < count; i++) {
    const angle = missileTier >= 10 ? 0 : (i / count) * Math.PI * 0.8 - Math.PI * 0.4;
    s.bullets.push({ x: source.x, y: source.y - 14, vx: Math.sin(angle) * 2, vy: -8 + Math.cos(angle) * 1, type: 'missile', target: null, missileTier });
  }
}

export function updateMissiles(bullets, enemies, W, H) {
  bullets.forEach(b => {
    if (b.type !== 'missile') return;

    // Find closest enemy — no range limit, always seek
    if (!b.target || b.target.dead) {
      let bestDist = Infinity;
      enemies.forEach(e => {
        if (e.dead || e.type === 'dropper') return;
        const d = Math.hypot(e.x - b.x, e.y - b.y);
        if (d < bestDist) { bestDist = d; b.target = e; }
      });
    }

    // Home towards target with smooth curving
    if (b.target && !b.target.dead) {
      const dx = b.target.x - b.x, dy = b.target.y - b.y;
      const len = Math.hypot(dx, dy) || 1;
      const speed = Math.hypot(b.vx, b.vy) || 8;
      const turnRate = 0.32;
      b.vx += (dx / len) * turnRate;
      b.vy += (dy / len) * turnRate;
      const currentSpeed = Math.hypot(b.vx, b.vy) || 1;
      if (currentSpeed > speed * 1.4) {
        b.vx = (b.vx / currentSpeed) * speed;
        b.vy = (b.vy / currentSpeed) * speed;
      }
    }

    // Remove missiles that leave the screen
    if (W && H) {
      if (b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) {
        b._outOfBounds = true;
      }
    }
  });
}

export function getMissileHitDamage(missileTier) {
  if (missileTier >= 10) return 10; // Tier 10: heavy damage
  if (missileTier >= 5) return 2; // Tier 5+: small explosion, 2 damage
  return 1;
}

export function shouldSpawnMissileExplosion(missileTier) {
  return missileTier >= 5;
}

export function drawMissile(ctx, b) {
  const sz = (b.missileTier || 1) >= 10 ? 12 : 6;
  const a = Math.atan2(b.vy, b.vx);
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(a);
  ctx.shadowColor = '#ff00ff'; ctx.shadowBlur = sz >= 10 ? 25 : 16;
  ctx.fillStyle = '#ff00ff';
  ctx.beginPath(); ctx.moveTo(sz, 0); ctx.lineTo(-sz * 0.7, -sz * 0.6); ctx.lineTo(-sz * 0.3, 0); ctx.lineTo(-sz * 0.7, sz * 0.6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ff6600'; ctx.beginPath(); ctx.moveTo(-sz * 0.3, 0); ctx.lineTo(-sz * 1.5, -sz * 0.3); ctx.lineTo(-sz * 1.8, 0); ctx.lineTo(-sz * 1.5, sz * 0.3); ctx.closePath(); ctx.fill();
  ctx.restore();
}