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
  const ox = e._laserOriginX ?? e.x;
  const oy = e._laserOriginY ?? e.y;

  // Charge telegraph for the primary tracking beam.
  if (e._laserCharging && e._laserEndX !== undefined) {
    const chargePct = e._laserChargePct || 0;
    const alpha = 0.15 + chargePct * 0.5;
    ctx.save();
    ctx.shadowColor = '#aa00ff'; ctx.shadowBlur = 18 + chargePct * 20;
    ctx.strokeStyle = `rgba(170,0,255,${alpha})`; ctx.lineWidth = 8 + chargePct * 14;
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(e._laserEndX, e._laserEndY); ctx.stroke();
    ctx.fillStyle = `rgba(255,255,255,${0.25 + chargePct * 0.5})`;
    ctx.beginPath(); ctx.arc(ox, oy, 10 + chargePct * 12, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // ── Laser 1: wide tracking beam ──
  // Render the expensive main beam only while it is actively firing.
  if (e._laserFiring && e._laserEndX !== undefined) {
    const isStage2 = e._stage2Triggered && e.hp <= e.maxHp / 3;
    const laserColor = isStage2 ? '#ff00ff' : '#aa00ff';
    const laserRgb = isStage2 ? '255,0,255' : '170,0,255';
    ctx.save();
    // Outer glow
    ctx.shadowColor = laserColor; ctx.shadowBlur = 20;
    ctx.strokeStyle = `rgba(${laserRgb},0.22)`; ctx.lineWidth = 30;
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(e._laserEndX, e._laserEndY); ctx.stroke();
    // Mid beam
    ctx.shadowBlur = 10;
    ctx.strokeStyle = `rgba(${laserRgb},0.72)`; ctx.lineWidth = 12;
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(e._laserEndX, e._laserEndY); ctx.stroke();
    // White hot center line
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(e._laserEndX, e._laserEndY); ctx.stroke();
    ctx.restore();
  }

  // ── Laser 2: side beam ──
  if (e._randLaserEndX !== undefined) {
    const alpha = e._randLaser1?.charging
      ? 0.12 + (e._randLaser1.chargePct || 0) * 0.35
      : e._randLaser1 ? Math.min(e._randLaser1.timer / 20, 1) : 0;
    ctx.save();
    ctx.shadowColor = '#bb55ff'; ctx.shadowBlur = 22;
    ctx.strokeStyle = `rgba(187,85,255,${0.5 * alpha})`; ctx.lineWidth = e._randLaser1?.charging ? 6 : 14;
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(e._randLaserEndX, e._randLaserEndY); ctx.stroke();
    if (!e._randLaser1?.charging) {
      ctx.strokeStyle = `rgba(225,170,255,${0.85 * alpha})`; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(e._randLaserEndX, e._randLaserEndY); ctx.stroke();
    }
    ctx.restore();
  }

  // ── Laser 3: side beam ──
  if (e._randLaserEndX2 !== undefined) {
    const alpha = e._randLaser2?.charging
      ? 0.12 + (e._randLaser2.chargePct || 0) * 0.35
      : e._randLaser2 ? Math.min(e._randLaser2.timer / 20, 1) : 0;
    ctx.save();
    ctx.shadowColor = '#aa44ff'; ctx.shadowBlur = 22;
    ctx.strokeStyle = `rgba(170,68,255,${0.5 * alpha})`; ctx.lineWidth = e._randLaser2?.charging ? 6 : 14;
    ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(e._randLaserEndX2, e._randLaserEndY2); ctx.stroke();
    if (!e._randLaser2?.charging) {
      ctx.strokeStyle = `rgba(215,160,255,${0.85 * alpha})`; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(e._randLaserEndX2, e._randLaserEndY2); ctx.stroke();
    }
    ctx.restore();
  }
}