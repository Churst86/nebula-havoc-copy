// Berserk enemy utilities
export function updateBerserkMovement(e, p, W, H) {
  // Zigzag follow: move toward player with a sine-wave lateral offset
  e._zigTimer = (e._zigTimer || 0) + 1;
  const dx = p.x - e.x, dy = p.y - e.y;
  const len = Math.hypot(dx, dy) || 1;
  const followSpeed = e._isHell ? 2.2 : 1.7;

  // Perpendicular direction for zigzag
  const perpX = -dy / len;
  const perpY = dx / len;
  const zigAmp = 3.5;
  const zigFreq = 0.06;
  const zigOffset = Math.sin(e._zigTimer * zigFreq) * zigAmp;

  e.x += (dx / len) * followSpeed + perpX * zigOffset;
  e.y += (dy / len) * followSpeed + perpY * zigOffset;

  // Hard clamp — always stay on screen
  e.x = Math.max(30, Math.min(W - 30, e.x));
  e.y = Math.max(30, Math.min(H - 30, e.y));
}

export function updateBerserkLaser(e, s, p, W, H) {
  const laserChargeMax = 30;
  const laserActiveDuration = 45;
  
  if (e._laserCooldown > 0) {
    e._laserCooldown--;
  } else if (e._laserActive) {
    e._laserActive--;
    if (e._laserActive <= 0) {
      e._laserActive = false;
      e._laserCooldown = 90;
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
  ctx.translate(e.x, e.y);
  
  const isMini = e._mini;
  const scale = isMini ? 0.6 : 1;
  ctx.scale(scale, scale);
  
  const pulse = 0.8 + Math.sin(t * 0.015) * 0.2;
  const berserkColor = e._isHell ? `hsl(${(t * 0.3) % 360},100%,65%)` : '#ff4400';
  const innerColor = e._isHell ? `hsla(${(t * 0.3) % 360},100%,65%,0.25)` : 'rgba(255,68,0,0.25)';
  
  ctx.shadowColor = berserkColor;
  ctx.shadowBlur = (e._isHell ? 25 : 16) + pulse * 8;
  
  // Main body — spiky sphere
  ctx.fillStyle = innerColor;
  ctx.beginPath();
  ctx.arc(0, 0, 16 + pulse * 2, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.strokeStyle = berserkColor;
  ctx.lineWidth = 2;
  ctx.stroke();
  
  // Spikes around body (8 spikes)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + (t * 0.008);
    const innerR = 18;
    const outerR = 26 + pulse * 3;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * innerR, Math.sin(a) * innerR);
    ctx.lineTo(Math.cos(a) * outerR, Math.sin(a) * outerR);
    ctx.stroke();
  }
  
  // Laser spinning — rotates AROUND the unit (orbiting beam)
  if (e._laserActive) {
    const spinSpeed = e._isHell ? 0.12 : 0.07;
    e._spinAngle += spinSpeed;

    const orbitR = 20;          // orbit radius from center
    const laserLen = e._isHell ? 90 : 65;
    const laserW = e._isHell ? 5 : 3;

    const beamCount = e._isHell ? 2 : 1;
    for (let bi = 0; bi < beamCount; bi++) {
      const angle = e._spinAngle + (bi / beamCount) * Math.PI * 2;
      const startX = Math.cos(angle) * orbitR;
      const startY = Math.sin(angle) * orbitR;
      const endX = Math.cos(angle) * (orbitR + laserLen);
      const endY = Math.sin(angle) * (orbitR + laserLen);

      const laserColor = bi === 0
        ? (e._isHell ? `rgba(255,${Math.floor(100 + Math.sin(t * 0.02) * 100)},0,0.9)` : 'rgba(255,68,0,0.9)')
        : `rgba(0,${Math.floor(100 + Math.sin(t * 0.02) * 100)},255,0.8)`;

      ctx.shadowColor = laserColor;
      ctx.shadowBlur = 12;
      ctx.strokeStyle = laserColor;
      ctx.lineWidth = laserW;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Bright core
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }
  }
  
  // HP bar (full size only)
  if (!isMini) {
    const bw = 50, bh = 4;
    ctx.fillStyle = '#222';
    ctx.fillRect(-bw / 2, -28, bw, bh);
    ctx.fillStyle = e.hp / e.maxHp > 0.5 ? '#ff6600' : '#ff2200';
    ctx.fillRect(-bw / 2, -28, bw * (e.hp / e.maxHp), bh);
    ctx.strokeStyle = berserkColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(-bw / 2, -28, bw, bh);
    
    ctx.fillStyle = berserkColor;
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BERSERK', 0, -38);
  }
  
  ctx.restore();
}