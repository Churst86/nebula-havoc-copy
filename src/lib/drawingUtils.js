// Drawing utilities — extracted from GameCanvas for file size
const BLOCK_SIZE = 18;

export function drawBlock(ctx, block) {
  const alpha = block.invulnerable ? 1 : (block.hp / block.maxHp);
  ctx.save();
  block.shape.forEach(([col, row]) => {
    const bx = block.x + col * BLOCK_SIZE;
    const by = block.y + row * BLOCK_SIZE;
    if (block.invulnerable) {
      ctx.shadowColor = '#8888bb'; ctx.shadowBlur = 6;
      ctx.fillStyle = '#555577';
      ctx.fillRect(bx + 1, by + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
      ctx.strokeStyle = '#9999bb'; ctx.lineWidth = 1.5;
      ctx.strokeRect(bx + 1, by + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
      ctx.strokeStyle = 'rgba(180,180,220,0.25)'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bx + 1, by + 1); ctx.lineTo(bx + BLOCK_SIZE - 1, by + BLOCK_SIZE - 1);
      ctx.moveTo(bx + BLOCK_SIZE / 2, by + 1); ctx.lineTo(bx + BLOCK_SIZE - 1, by + BLOCK_SIZE / 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(200,200,255,0.6)';
      ctx.font = `bold ${Math.round(BLOCK_SIZE * 0.55)}px monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('∞', bx + BLOCK_SIZE / 2, by + BLOCK_SIZE / 2);
    } else {
      ctx.shadowColor = block.color; ctx.shadowBlur = 8;
      ctx.fillStyle = block.color + Math.round(alpha * 0xcc).toString(16).padStart(2, '0');
      ctx.fillRect(bx + 1, by + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
      ctx.strokeStyle = block.color; ctx.lineWidth = 1.5;
      ctx.strokeRect(bx + 1, by + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
    }
  });
  ctx.restore();
}

export function drawPiledCells(ctx, cells) {
  cells.forEach(cell => {
    ctx.save();
    ctx.shadowColor = cell.color; ctx.shadowBlur = 6;
    ctx.fillStyle = cell.color + '99';
    ctx.fillRect(cell.x + 1, cell.y + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
    ctx.strokeStyle = cell.color;
    ctx.lineWidth = 1;
    ctx.strokeRect(cell.x + 1, cell.y + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
    ctx.restore();
  });
}

export function drawParticle(ctx, pt) {
  ctx.save();
  ctx.globalAlpha = pt.alpha;
  if (pt.shockwave) {
    ctx.shadowColor = pt.color; ctx.shadowBlur = 12;
    ctx.strokeStyle = pt.color;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.shockwaveR, 0, Math.PI * 2); ctx.stroke();
  } else {
    ctx.shadowColor = pt.color; ctx.shadowBlur = 6;
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}