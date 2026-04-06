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

  const headForwardOffset = Math.PI;

  const isMini = e._mini;
  const baseSize = isMini ? 40 : 94;
  const hitboxSize = Math.max(1, Number(e.w || e.h || baseSize));
  const spriteSize = isMini ? baseSize : hitboxSize;
  const scale = Math.max(0.35, spriteSize / 72);
  const accentColor = e._isHell ? `hsla(${(t * 0.3) % 360},100%,65%,0.78)` : 'rgba(124,255,106,0.62)';
  const gluttonHeadSprite = getSprite('GluttonHead');
  const gluttonTailSprite = getSprite('GluttonTail');
  const gluttonBinderSprite = getSprite('GluttonBinder');
  const hasSprite = isSpritesLoaded() && hasDrawableSprite(gluttonHeadSprite);
  const gluttonFrameCount = getSpriteFrameCount(gluttonHeadSprite, 162, 240);
  const tailFrameCount = getSpriteFrameCount(gluttonTailSprite, 240, 240);
  const isEating = (e._eatingFrames || 0) > 0;
  const frameCadence = isEating ? 60 : 130;
  const chompFrame = gluttonFrameCount > 0
    ? Math.floor((t / frameCadence) % gluttonFrameCount)
    : 0;
  const idleFrame = 0;
  const getSegmentFrame = (segmentIndex) => {
    if (gluttonFrameCount <= 0) return idleFrame;
    // Keep follower chomps occasional and slower so they read as ambient behavior.
    if (segmentIndex <= 0) return idleFrame;
    const burstWindow = 8 + ((segmentIndex * 5) % 7);
    const burstCycle = 720 + ((segmentIndex * 83) % 220);
    const burstPhase = (t + segmentIndex * 173) % burstCycle;
    if (burstPhase > burstWindow) return idleFrame;
    return Math.floor(((t / 95) + segmentIndex * 0.9) % gluttonFrameCount);
  };
  const tailFrame = tailFrameCount > 0
    ? Math.floor((t / 90) % tailFrameCount)
    : 0;
  const mainFacingAngle = (e._angle || 0) + headForwardOffset;
  const segmentPositions = Array.isArray(e._segmentPositions) ? e._segmentPositions : [];
  const tailPosition = e._tailPosition || null;

  const drawHeadSprite = (size, alpha = 1, frameIndex = chompFrame) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    if (gluttonHeadSprite && gluttonFrameCount > 0) {
      drawSpriteFrame(ctx, gluttonHeadSprite, 162, 240, frameIndex, -size / 2, -size / 2, size, size);
    }
    ctx.restore();
  };

  const drawConnectorTail = (x, y, angle, size, alpha = 0.9) => {
    if (!gluttonTailSprite || tailFrameCount <= 0) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    drawSpriteFrame(ctx, gluttonTailSprite, 240, 240, tailFrame, -size / 2, -size / 2, size, size);
    ctx.restore();
  };

  const drawBinder = (ax, ay, bx, by) => {
    if (!gluttonBinderSprite) return;
    const dx = bx - ax;
    const dy = by - ay;
    const dist = Math.hypot(dx, dy);
    if (dist < 2) return;
    // Rotate 90deg from previous orientation to match binder artwork direction.
    const angle = Math.atan2(dy, dx) + Math.PI;
    const mx = (ax + bx) / 2 - e.x;
    const my = (ay + by) / 2 - e.y;
    // Width matches the segment body; height stretches to fill the gap exactly.
    const binderW = Math.max(28, spriteSize * 0.98);
    const binderH = dist * 1.45;
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(angle);
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 3;
    drawSprite(ctx, gluttonBinderSprite, -binderW / 2, -binderH / 2, binderW, binderH);
    ctx.restore();
  };

  if (hasSprite) {
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = isMini ? 5 : 8;

    const chainPoints = [{ x: e.x, y: e.y }];
    for (let i = 0; i < segmentPositions.length; i += 1) {
      const seg = segmentPositions[i];
      if (!seg) continue;
      chainPoints.push({ x: seg.x || e.x, y: seg.y || e.y });
    }
    if (tailPosition) {
      chainPoints.push({ x: tailPosition.x || e.x, y: tailPosition.y || e.y });
    }

    // Draw tail sprite and old-style connectors beneath segments (background layer).
    if (chainPoints.length > 1 && gluttonTailSprite && tailFrameCount > 0) {
      for (let i = 0; i < chainPoints.length - 1; i += 1) {
        const a = chainPoints[i];
        const b = chainPoints[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);
        const connectorStep = Math.max(18, spriteSize * 0.33);
        const pieceCount = Math.max(1, Math.floor(dist / connectorStep));
        const connectorSize = Math.max(20, spriteSize * 0.5);
        for (let piece = 1; piece <= pieceCount; piece += 1) {
          const mix = piece / (pieceCount + 1);
          const cx = a.x + dx * mix - e.x;
          const cy = a.y + dy * mix - e.y;
          drawConnectorTail(cx, cy, angle + Math.PI / 2, connectorSize, 0.9);
        }
      }
    }

    if (tailPosition && gluttonTailSprite && tailFrameCount > 0) {
      const tailSize = spriteSize * 0.96;
      const lastSegment = segmentPositions.length > 0 ? segmentPositions[segmentPositions.length - 1] : null;
      const anchorX = lastSegment ? (lastSegment.x || e.x) : e.x;
      const anchorY = lastSegment ? (lastSegment.y || e.y) : e.y;
      // Always aim the tail away from the last segment using actual chain geometry.
      const tailDir = Math.atan2((tailPosition.y || e.y) - anchorY, (tailPosition.x || e.x) - anchorX);
      // Push the tail farther out while preserving a connected base near the segment.
      const tailPinDistance = Math.max(tailSize * 0.82, spriteSize * 0.62);
      const tailX = anchorX + Math.cos(tailDir) * tailPinDistance;
      const tailY = anchorY + Math.sin(tailDir) * tailPinDistance;
      const tailBaseOffset = Math.max(tailSize * 0.38, spriteSize * 0.3);
      const tailBaseX = tailX - Math.cos(tailDir) * tailBaseOffset;
      const tailBaseY = tailY - Math.sin(tailDir) * tailBaseOffset;
      const tailFacing = tailDir + Math.PI / 2 + Math.PI;
      ctx.save();
      ctx.translate(tailX - e.x, tailY - e.y);
      ctx.rotate(tailFacing);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 10;
      drawSpriteFrame(ctx, gluttonTailSprite, 240, 240, tailFrame, -tailSize / 2, -tailSize / 2, tailSize, tailSize);
      ctx.restore();

      // Tail binder sits above tail but below the last body segment.
      const lastSegmentForTailBinder = segmentPositions.length > 0 ? segmentPositions[segmentPositions.length - 1] : null;
      if (lastSegmentForTailBinder && gluttonBinderSprite) {
        drawBinder(
          lastSegmentForTailBinder.x || e.x,
          lastSegmentForTailBinder.y || e.y,
          tailBaseX,
          tailBaseY
        );
      }
    }

    // Segments drawn back-to-front.
    for (let segmentIndex = segmentPositions.length - 1; segmentIndex >= 0; segmentIndex -= 1) {
      const segment = segmentPositions[segmentIndex];
      if (!segment) continue;
      const segmentSize = spriteSize * Math.max(0.86, Number(segment.sizeScale) || 0.92);
      const segmentFacing = (segment.angle || e._angle || 0) + headForwardOffset;
      const segmentFrame = getSegmentFrame(segmentIndex);
      ctx.save();
      ctx.translate((segment.x || e.x) - e.x, (segment.y || e.y) - e.y);
      ctx.rotate(segmentFacing);
      ctx.shadowBlur = 8;
      drawHeadSprite(segmentSize, 1, segmentFrame);
      ctx.restore();

      // Layer binder between segments: behind the front segment, above the one after it.
      if (gluttonBinderSprite) {
        const frontPoint = segmentIndex === 0
          ? { x: e.x, y: e.y }
          : segmentPositions[segmentIndex - 1];
        if (frontPoint) {
          drawBinder(
            frontPoint.x || e.x,
            frontPoint.y || e.y,
            segment.x || e.x,
            segment.y || e.y
          );
        }
      }
    }

    // Lead head on top of segments.
    ctx.save();
    ctx.rotate(mainFacingAngle);
    drawHeadSprite(spriteSize, 1, chompFrame);
    ctx.restore();

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

  ctx.restore();
}
