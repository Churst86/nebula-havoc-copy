export function drawEnemy(ctx, e) {
  if (!e) return;
  
  ctx.save();
  
  if (e.type === 'boss') {
    ctx.translate(e.x, e.y);
    ctx.shadowColor = '#ff4444';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#ff4444';
    ctx.beginPath();
    ctx.arc(0, 0, e.w / 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Health bar
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(-e.w / 2, -e.h / 2 - 8, (e.hp / e.maxHp) * e.w, 3);
  } else if (e.type === 'elite') {
    ctx.translate(e.x, e.y);
    ctx.shadowColor = '#ffff00';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, e.w / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffff0044';
    ctx.fill();
  } else if (e.type === 'basic') {
    ctx.translate(e.x, e.y);
    ctx.shadowColor = '#44ff88';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#44ff88';
    ctx.beginPath();
    ctx.moveTo(0, -e.h / 2);
    ctx.lineTo(e.w / 2, e.h / 4);
    ctx.lineTo(e.w / 4, e.h / 2);
    ctx.lineTo(-e.w / 4, e.h / 2);
    ctx.lineTo(-e.w / 2, e.h / 4);
    ctx.closePath();
    ctx.fill();
  } else if (e.type === 'mine') {
    ctx.translate(e.x, e.y);
    ctx.shadowColor = '#ff8800';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = '#ff8800';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-e.w / 2, 0);
    ctx.lineTo(e.w / 2, 0);
    ctx.moveTo(0, -e.h / 2);
    ctx.lineTo(0, e.h / 2);
    ctx.stroke();
    ctx.fillStyle = '#ff880044';
    ctx.beginPath();
    ctx.arc(0, 0, e.w / 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.type === 'dropper') {
    ctx.translate(e.x, e.y);
    ctx.shadowColor = e.color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.arc(0, 0, e.w / 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.type === 'eater') {
    ctx.translate(e.x, e.y);
    ctx.shadowColor = '#ff00ff';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#ff00ff';
    ctx.beginPath();
    ctx.arc(0, 0, e.w / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  
  ctx.restore();
}

export function updateEnemyPositions(s, W, H) {
  s.enemies = s.enemies.filter(e => {
    if (!e) return false;
    // Remove if off-screen (don't update position here, already done in main loop)
    return e.x > -50 && e.x < W + 50 && e.y < H + 50;
  });
}