// Glutton enemy utilities
import { getSprite, drawSprite, drawSpriteFrame, getSpriteFrameCount, isSpritesLoaded, hasDrawableSprite } from './spriteLoader.js';

export function updateGluttonMovement(e, p, W, H) {
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

export function updateGluttonLaser(e, s, p, W, H) {
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

export function drawGlutton(ctx, e, t) {
  ctx.save();

  const isMini = e._mini;
  const baseSize = isMini ? 40 : 94;
  const hitboxSize = Math.max(1, Number(e.w || e.h || baseSize));
  const spriteSize = isMini ? baseSize : hitboxSize;
  const scale = Math.max(0.35, spriteSize / 72);
  const accentColor = e._isHell ? `hsl(${(t * 0.3) % 360},100%,65%)` : '#7cff6a';
  const gluttonHeadSprite = getSprite('GluttonHead');
  const gluttonTailSprite = getSprite('GluttonTail');
  const eaterChompSprite = getSprite('EaterChomp');
  const hasSprite = isSpritesLoaded() && hasDrawableSprite(gluttonHeadSprite);
  const gluttonFrameCount = getSpriteFrameCount(gluttonHeadSprite, 162, 240);
  const tailFrameCount = getSpriteFrameCount(gluttonTailSprite, 240, 240);
  const chompFrame = gluttonFrameCount > 0
    ? Math.floor((t / 110) % gluttonFrameCount)
    : 0;
  const tailFrame = tailFrameCount > 0
    ? Math.floor((t / 140) % tailFrameCount)
    : 0;
  const segmentPositions = Array.isArray(e._segmentPositions) ? e._segmentPositions : [];
  const tailPosition = e._tailPosition || null;

  const drawHeadSprite = (size, alpha = 1) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    if (gluttonHeadSprite && gluttonFrameCount > 0) {
      drawSpriteFrame(ctx, gluttonHeadSprite, 162, 240, chompFrame, -size / 2, -size / 2, size, size);
    }
    if (eaterChompSprite && (e._eatingFrames || 0) > 0) {
      const alphaBlend = Math.min(1, (e._eatingFrames || 0) / 14);
      ctx.save();
      ctx.globalAlpha = 0.2 + alphaBlend * 0.45;
      drawSprite(ctx, eaterChompSprite, -size / 2, -size / 2, size, size);
      ctx.restore();
    }
    ctx.restore();
  };

  if (hasSprite) {
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = isMini ? 8 : 14;
    for (let segmentIndex = segmentPositions.length - 1; segmentIndex >= 0; segmentIndex -= 1) {
      const segment = segmentPositions[segmentIndex];
      if (!segment) continue;
      const segmentSize = spriteSize * Math.max(0.68, Number(segment.sizeScale) || 0.82);
      ctx.save();
      ctx.translate((segment.x || e.x) - e.x, (segment.y || e.y) - e.y);
      ctx.rotate((segment.angle || 0) + Math.PI / 2);
      ctx.shadowBlur = 8;
      drawHeadSprite(segmentSize, 0.55);
      ctx.restore();
    }

    if (tailPosition && gluttonTailSprite && tailFrameCount > 0) {
      const tailSize = spriteSize * 0.72;
      ctx.save();
      ctx.translate((tailPosition.x || e.x) - e.x, (tailPosition.y || e.y) - e.y);
      ctx.rotate((tailPosition.angle || 0) + Math.PI / 2);
      ctx.globalAlpha = 0.82;
      ctx.shadowBlur = 6;
      drawSpriteFrame(ctx, gluttonTailSprite, 240, 240, tailFrame, -tailSize / 2, -tailSize / 2, tailSize, tailSize);
      ctx.restore();
    }

    ctx.rotate((e._angle || 0) + Math.PI / 2);
    drawHeadSprite(spriteSize, 1);
  } else {
    ctx.scale(scale, scale);

    const pulse = 0.85 + Math.sin(t * 0.015) * 0.15;
    const innerColor = e._isHell ? `hsla(${(t * 0.3) % 360},100%,65%,0.25)` : 'rgba(124,255,106,0.25)';

    ctx.shadowColor = accentColor;
    ctx.shadowBlur = (e._isHell ? 25 : 16) + pulse * 8;

    // Fallback: glowing glutton head orb
    ctx.fillStyle = innerColor;
    ctx.beginPath();
    ctx.arc(0, 0, 14 + pulse * 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Teeth/spikes around body
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

  if (!isMini) {
    const bw = 50, bh = 4;
    ctx.fillStyle = '#222';
    ctx.fillRect(-bw / 2, -20, bw, bh);
    ctx.fillStyle = e.hp / e.maxHp > 0.5 ? '#ff6600' : '#ff2200';
    ctx.fillRect(-bw / 2, -20, bw * (e.hp / e.maxHp), bh);
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(-bw / 2, -20, bw, bh);

    ctx.fillStyle = accentColor;
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GLUTTON', 0, -30);
  }

  ctx.restore();
}
