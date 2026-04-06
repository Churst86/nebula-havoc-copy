// Berserk enemy utilities
import { getSprite, drawSprite, isSpritesLoaded, hasDrawableSprite } from './spriteLoader.js';

export function updateBerserkMovement(e, p, W, H) {
  // Jerky, aggressive burst movement:
  // keep a velocity that gets sudden retarget spikes every few frames.
  const absorbScale = 1 + Math.min(e._absorbedUnits || 0, 12) * 0.08;
  const halfW = Math.max(10, (e.w || 20) * 0.9);
  const halfH = Math.max(10, (e.h || 20) * 0.9);
  const visualHalf = (e._mini ? 27 : 90) * absorbScale;
  const marginX = Math.max(e._mini ? 20 : 30, halfW + 8, visualHalf + 6);
  const marginY = Math.max(e._mini ? 20 : 30, halfH + 8, visualHalf + 6);
  const baseSpeed = e._mini ? 2.8 : (e._isHell ? 4.2 : 3.2);

  if (e._jerkTimer === undefined) {
    e._jerkTimer = 0;
    e._vx = (Math.random() * 2 - 1) * baseSpeed;
    e._vy = (Math.random() * 2 - 1) * baseSpeed;
  }

  e._jerkTimer--;
  if (e._jerkTimer <= 0) {
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const len = Math.hypot(dx, dy) || 1;

    // Retarget aggressively toward player with random lateral snap.
    const lateral = (Math.random() * 2 - 1) * (e._isHell ? 2.4 : 1.8);
    const towardX = (dx / len) * (baseSpeed + (e._isHell ? 1.8 : 1.2));
    const towardY = (dy / len) * (baseSpeed + (e._isHell ? 1.8 : 1.2));

    e._vx = towardX + lateral;
    e._vy = towardY - lateral * 0.6;

    // Short, uneven burst cadence creates a jerky feel.
    e._jerkTimer = Math.floor(Math.random() * 8) + (e._isHell ? 4 : 6);
  }

  e.x += e._vx;
  e.y += e._vy;

  // Hard clamp + bounce to guarantee it never leaves the screen.
  if (e.x < marginX) {
    e.x = marginX;
    e._vx = Math.abs(e._vx) * 0.95;
  } else if (e.x > W - marginX) {
    e.x = W - marginX;
    e._vx = -Math.abs(e._vx) * 0.95;
  }

  if (e.y < marginY) {
    e.y = marginY;
    e._vy = Math.abs(e._vy) * 0.95;
  } else if (e.y > H - marginY) {
    e.y = H - marginY;
    e._vy = -Math.abs(e._vy) * 0.95;
  }
}

export function updateBerserkLaser(e, s, p, W, H) {
  const laserChargeMax = 20;
  const laserActiveDuration = 90; // longer active duration
  
  if (e._laserCooldown > 0) {
    e._laserCooldown--;
  } else if (e._laserActive) {
    e._laserActive--;
    if (e._laserActive <= 0) {
      e._laserActive = false;
      e._laserCooldown = 60; // shorter cooldown
    }
  } else {
    e._laserCharge++;
    if (e._laserCharge >= laserChargeMax) {
      e._laserActive = laserActiveDuration;
      e._laserCharge = 0;
      e._spinAngle = Math.atan2(p.y - e.y, p.x - e.x);
    }
  }
}

export function drawBerserk(ctx, e, t) {
  ctx.save();
  
  const isMini = e._mini;
  const baseSize = isMini ? 40 : 94;
  const hitboxSize = Math.max(1, Number(e.w || e.h || baseSize));
  const spriteSize = isMini ? baseSize : hitboxSize;
  const scale = Math.max(0.35, spriteSize / 72);
  const berserkColor = e._isHell ? `hsl(${(t * 0.3) % 360},100%,65%)` : '#ff4400';
  const berserkSprite = getSprite('Berskerker');
  const eaterChompSprite = getSprite('EaterChomp');
  const hasSprite = isSpritesLoaded() && hasDrawableSprite(berserkSprite);

  if (hasSprite) {
    ctx.shadowColor = berserkColor;
    ctx.shadowBlur = isMini ? 8 : 14;
    drawSprite(ctx, berserkSprite, -spriteSize / 2, -spriteSize / 2, spriteSize, spriteSize);
    if (eaterChompSprite && (e._eatingFrames || 0) > 0) {
      const alpha = Math.min(1, (e._eatingFrames || 0) / 14);
      ctx.save();
      ctx.globalAlpha = 0.35 + alpha * 0.5;
      drawSprite(ctx, eaterChompSprite, -spriteSize / 2, -spriteSize / 2, spriteSize, spriteSize);
      ctx.restore();
    }
  } else {
    ctx.scale(scale, scale);
  
    const pulse = 0.85 + Math.sin(t * 0.015) * 0.15;
    const innerColor = e._isHell ? `hsla(${(t * 0.3) % 360},100%,65%,0.25)` : 'rgba(255,68,0,0.25)';
  
    ctx.shadowColor = berserkColor;
    ctx.shadowBlur = (e._isHell ? 25 : 16) + pulse * 8;
  
    // Main body — spiky sphere
    ctx.fillStyle = innerColor;
    ctx.beginPath();
    ctx.arc(0, 0, 14 + pulse * 2, 0, Math.PI * 2);
    ctx.fill();
  
    ctx.strokeStyle = berserkColor;
    ctx.lineWidth = 2;
    ctx.stroke();
  
    // Spikes around body (8 spikes)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + (t * 0.008);
      const innerR = 14;
      const outerR = 20 + pulse * 2.5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * innerR, Math.sin(a) * innerR);
      ctx.lineTo(Math.cos(a) * outerR, Math.sin(a) * outerR);
      ctx.stroke();
    }
  }
  
  // HP bar (full size only)
  if (!isMini) {
    const bw = 50, bh = 4;
    ctx.fillStyle = '#222';
    ctx.fillRect(-bw / 2, -20, bw, bh);
    ctx.fillStyle = e.hp / e.maxHp > 0.5 ? '#ff6600' : '#ff2200';
    ctx.fillRect(-bw / 2, -20, bw * (e.hp / e.maxHp), bh);
    ctx.strokeStyle = berserkColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(-bw / 2, -20, bw, bh);
    
    ctx.fillStyle = berserkColor;
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BERSERK', 0, -30);
  }
  
  ctx.restore();
}