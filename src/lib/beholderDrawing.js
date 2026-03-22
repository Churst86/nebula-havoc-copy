// Beholder Boss drawing functions
import { getBeholderShieldRadius } from './beholderLogic.js';

export function drawBeholderShield(ctx, e) {
  if (!e._shieldActive) return;
  const sr = getBeholderShieldRadius(e);
  ctx.save();
  ctx.shadowColor = '#00ccff';
  ctx.shadowBlur = 30 + Math.sin(Date.now() * 0.01) * 10;
  ctx.strokeStyle = `rgba(0,200,255,${0.4 + Math.sin(Date.now() * 0.008) * 0.3})`;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(e.x, e.y, sr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}