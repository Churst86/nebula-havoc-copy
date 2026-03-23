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

// Draw all Beholder lasers: laser 1 (wide tracking), lasers 2 & 3 (random bursts)
export function drawBeholderLasers(ctx, e) {
  // ── Laser 1: wide tracking beam ──
  if (e._laserEndX !== undefined) {
    const isStage2 = e._stage2Triggered && e.hp <= e.maxHp / 3;
    const laserColor = isStage2 ? '#ff00ff' : '#aa00ff';
    const laserRgb = isStage2 ? '255,0,255' : '170,0,255';
    ctx.save();
    // Wide outer glow
    ctx.shadowColor = laserColor; ctx.shadowBlur = 40;
    ctx.strokeStyle = `rgba(${laserRgb},0.18)`; ctx.lineWidth = 36;
    ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e._laserEndX, e._laserEndY); ctx.stroke();
    // Mid beam
    ctx.shadowBlur = 20;
    ctx.strokeStyle = `rgba(${laserRgb},0.55)`; ctx.lineWidth = 14;
    ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e._laserEndX, e._laserEndY); ctx.stroke();
    // Bright core
    ctx.strokeStyle = `rgba(${laserRgb},0.9)`; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e._laserEndX, e._laserEndY); ctx.stroke();
    // White hot center line
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e._laserEndX, e._laserEndY); ctx.stroke();
    ctx.restore();
  }

  // ── Laser 2: random burst (orange/yellow) ──
  if (e._randLaserEndX !== undefined) {
    const alpha = e._randLaser1 ? Math.min(e._randLaser1.timer / 20, 1) : 0;
    ctx.save();
    ctx.shadowColor = '#ff8800'; ctx.shadowBlur = 22;
    ctx.strokeStyle = `rgba(255,140,0,${0.5 * alpha})`; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e._randLaserEndX, e._randLaserEndY); ctx.stroke();
    ctx.strokeStyle = `rgba(255,200,80,${0.85 * alpha})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e._randLaserEndX, e._randLaserEndY); ctx.stroke();
    ctx.restore();
  }

  // ── Laser 3: random burst (cyan/teal) ──
  if (e._randLaserEndX2 !== undefined) {
    const alpha = e._randLaser2 ? Math.min(e._randLaser2.timer / 20, 1) : 0;
    ctx.save();
    ctx.shadowColor = '#00ffcc'; ctx.shadowBlur = 22;
    ctx.strokeStyle = `rgba(0,220,180,${0.5 * alpha})`; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e._randLaserEndX2, e._randLaserEndY2); ctx.stroke();
    ctx.strokeStyle = `rgba(100,255,220,${0.85 * alpha})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e._randLaserEndX2, e._randLaserEndY2); ctx.stroke();
    ctx.restore();
  }
}