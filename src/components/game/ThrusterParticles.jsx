// Thruster particle system for visual feedback
export function spawnThrusterParticles(s, p, keys) {
  const isMoving = keys['ArrowLeft'] || keys['a'] || keys['A'] || 
                   keys['ArrowRight'] || keys['d'] || keys['D'] || 
                   keys['ArrowUp'] || keys['w'] || keys['W'] || 
                   keys['ArrowDown'] || keys['s'] || keys['S'];
  
  if (!isMoving) return;
  
  // Spawn 1-2 thruster particles per frame when moving
  const count = Math.random() < 0.6 ? 2 : 1;
  for (let i = 0; i < count; i++) {
    const offsetX = (Math.random() - 0.5) * 8;
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 1;
    s.particles.push({
      x: p.x + offsetX,
      y: p.y + 12,
      vx: Math.cos(angle) * speed - 0.5,
      vy: speed + Math.random() * 0.5,
      r: 1.5 + Math.random() * 1,
      alpha: 0.6,
      color: '#00f0ff'
    });
  }
}

export function drawParticleEnhanced(ctx, pt) {
  ctx.save();
  ctx.globalAlpha = pt.alpha;
  if (pt.shockwave) {
    ctx.shadowColor = pt.color;
    ctx.shadowBlur = 16;
    ctx.strokeStyle = pt.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.shockwaveR, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.shadowColor = pt.color;
    ctx.shadowBlur = pt.r > 2 ? 12 : 6;
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}