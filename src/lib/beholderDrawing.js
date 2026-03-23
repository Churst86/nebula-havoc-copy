// Beholder Boss drawing functions
import { getBeholderShieldRadius } from './beholderLogic.js';

export function drawBeholderShield(ctx, e) {
  if (!e._shieldActive) return;
  const sr = getBeholderShieldRadius(e);
  const pulse = 0.5 + Math.sin(Date.now() * 0.012) * 0.5;
  ctx.save();

  // Outer wide glow
  ctx.shadowColor = '#ff2200';
  ctx.shadowBlur = 40 + pulse * 20;
  ctx.strokeStyle = `rgba(255,40,0,${0.15 + pulse * 0.12})`;
  ctx.lineWidth = 28;
  ctx.beginPath();
  ctx.arc(e.x, e.y, sr, 0, Math.PI * 2);
  ctx.stroke();

  // Mid ring
  ctx.shadowBlur = 20;
  ctx.strokeStyle = `rgba(255,80,20,${0.45 + pulse * 0.3})`;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(e.x, e.y, sr, 0, Math.PI * 2);
  ctx.stroke();

  // Bright inner edge
  ctx.shadowColor = '#ff6633';
  ctx.shadowBlur = 10;
  ctx.strokeStyle = `rgba(255,160,80,${0.7 + pulse * 0.3})`;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(e.x, e.y, sr, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}