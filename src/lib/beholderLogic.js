// Beholder Boss (Tier 3) — movement, shield mechanics, and tracking laser

export function initBeholderMovement(e) {
  e._beholderMovementPhase = 'entry';
  e._beholderVx = 0;
  e._beholderVy = 0;
}

export function updateBeholderMovement(e, W, H) {
  if (!e._beholderMovementPhase) initBeholderMovement(e);
  const entryY = H * 0.32;

  if (e._beholderMovementPhase === 'entry') {
    if (e.y < entryY) {
      e.y += Math.min((entryY - e.y) * 0.06 + 1.8, 12);
      e.x += (W / 2 - e.x) * 0.08;
    } else {
      e._beholderMovementPhase = 'roaming';
      const angle = Math.PI / 2 + (Math.random() - 0.5) * 1.2;
      const speed = 3.1;
      e._beholderVx = Math.cos(angle) * speed;
      e._beholderVy = Math.sin(angle) * speed;
    }
  }

  if (e._beholderMovementPhase === 'roaming') {
    e.x += e._beholderVx;
    e.y += e._beholderVy;

    if (e.x < 70) { e.x = 70; e._beholderVx = Math.abs(e._beholderVx); }
    if (e.x > W - 70) { e.x = W - 70; e._beholderVx = -Math.abs(e._beholderVx); }
    if (e.y < 70) { e.y = 70; e._beholderVy = Math.abs(e._beholderVy); }
    if (e.y > H - 120) { e.y = H - 120; e._beholderVy = -Math.abs(e._beholderVy); }

    const stageSpeedMult = e.hp <= e.maxHp / 3 ? 1.18 : 1;
    e._beholderVx *= stageSpeedMult;
    e._beholderVy *= stageSpeedMult;
    const maxSpeed = e.hp <= e.maxHp / 3 ? 4.8 : 4.1;
    const speed = Math.hypot(e._beholderVx, e._beholderVy) || 1;
    if (speed > maxSpeed) {
      e._beholderVx = (e._beholderVx / speed) * maxSpeed;
      e._beholderVy = (e._beholderVy / speed) * maxSpeed;
    }
  }
}

export function updateBeholderShield(e) {
  const isStage2 = e.hp <= e.maxHp / 3 && !e._stage2Triggered;
  if (isStage2) {
    e._stage2Triggered = true;
    e._shieldActive = false;
    e._shieldCooldown = 0;
  }

  if (!e._stage2Triggered) return;

  if (!e._shieldStateInit) {
    e._shieldStateInit = true;
    e._shieldActive = false;
    e._shieldTimer = 0;
    e._shieldCooldown = 0;
  }

  if (e._shieldCooldown > 0) {
    e._shieldCooldown--;
    return;
  }

  if (e._shieldActive) {
    e._shieldTimer--;
    if (e._shieldTimer <= 0) {
      e._shieldActive = false;
      e._shieldCooldown = 600;
    }
  } else if (e._shieldCooldown <= 0) {
    e._shieldActive = true;
    e._shieldTimer = 180;
  }
}

// Tracking laser — lags behind player with a delayed angle, plus 2 random-burst side lasers
export function updateBeholderFire(e, p, s, sounds) {
  const isStage2 = e._stage2Triggered && e.hp <= e.maxHp / 3;
  const perfMode = e._performanceMode || 'normal';
  const lowPerf = perfMode === 'low';
  const veryLowPerf = perfMode === 'very-low';
  const BEAM_LENGTH = 1200;
  const EYE_OFFSET_X = 0;
  const EYE_OFFSET_Y = -16;
  const originX = e.x + EYE_OFFSET_X;
  const originY = e.y + EYE_OFFSET_Y;
  e._laserOriginX = originX;
  e._laserOriginY = originY;
  const mainChargeDuration = isStage2 ? 55 : 75;
  const mainActiveDuration = isStage2 ? 120 : 90;
  const mainCooldownDuration = isStage2 ? 180 : 260;
  const sideChargeDuration = veryLowPerf ? 70 : (lowPerf ? 58 : (isStage2 ? 35 : 50));
  const sideActiveDuration = veryLowPerf ? 28 : (lowPerf ? 42 : (isStage2 ? 75 : 55));
  const sideCooldownDuration = veryLowPerf ? 420 : (lowPerf ? 300 : (isStage2 ? 170 : 240));
  const photonCooldownDuration = veryLowPerf ? 270 : (lowPerf ? 210 : (isStage2 ? 120 : 180));

  // ── Init ──
  if (e._laserAngle === undefined) {
    e._laserAngle = Math.PI / 2;
    e._laserTargetAngle = Math.PI / 2;
    e._laserChargeTimer = 0;
    e._laserActiveFrames = 0;
    e._laserCooldownTimer = 90;
    e._laserFiring = false;
    e._laserCharging = false;
    e._eyeState = 'normal';
    e._eyeAnimStage = 'none';
    e._eyeAnimTimer = 0;
    // Side lasers (independent staggered cycles)
    e._randLaser1 = null; // { angle, timer }
    e._randLaser2 = null;
    e._randLaser1Cooldown = 110;
    e._randLaser2Cooldown = 190;
    e._photonCooldown = 110;
    e._mainBeamShake = 0;
  }
  if (!e._eyeState) e._eyeState = 'normal';
  if (!e._eyeAnimStage) e._eyeAnimStage = 'none';
  e._eyeAnimTimer = Math.max(0, e._eyeAnimTimer || 0);

  // Eye-state sequence after main beam: normal -> blink -> resting -> blink -> normal
  if (e._eyeAnimTimer > 0) e._eyeAnimTimer--;
  if (e._eyeAnimStage === 'closing' && e._eyeAnimTimer <= 0) {
    e._eyeState = 'resting';
    e._eyeAnimStage = 'resting';
    e._eyeAnimTimer = isStage2 ? 26 : 34;
  } else if (e._eyeAnimStage === 'resting' && e._eyeAnimTimer <= 0) {
    e._eyeState = 'blink';
    e._eyeAnimStage = 'opening';
    e._eyeAnimTimer = 9;
  } else if (e._eyeAnimStage === 'opening' && e._eyeAnimTimer <= 0) {
    e._eyeState = 'normal';
    e._eyeAnimStage = 'none';
  }

  // ── Laser 1: tracking (lags behind player) ──
  // Only update target angle periodically — creates "lag" effect
  e._laserTargetUpdateTimer = (e._laserTargetUpdateTimer || 0) - 1;
  if (e._laserTargetUpdateTimer <= 0) {
    e._laserTargetAngle = Math.atan2(p.y - originY, p.x - originX);
    // Update target slowly — every 20 frames sample the player position
    e._laserTargetUpdateTimer = veryLowPerf ? 32 : (lowPerf ? 26 : 20);
  }

  // Rotate toward the lagged target angle slowly
  const trackSpeed = isStage2 ? 0.012 : 0.007;
  let diff = e._laserTargetAngle - e._laserAngle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  e._laserAngle += Math.sign(diff) * Math.min(Math.abs(diff), trackSpeed);

  if (e._laserFiring) {
    e._mainBeamShake = 0;
    e._laserActiveFrames++;
    if (e._laserActiveFrames >= mainActiveDuration) {
      e._laserFiring = false;
      e._laserCooldownTimer = mainCooldownDuration;
      e._laserCharging = false;
      e._laserEndY = undefined;
      e._laserEndX = undefined;
      e._laserChargePct = 0;
      e._eyeState = 'blink';
      e._eyeAnimStage = 'closing';
      e._eyeAnimTimer = 9;
    }
  } else if (e._laserCharging) {
    e._laserChargeTimer--;
    e._laserChargePct = 1 - (e._laserChargeTimer / mainChargeDuration);
    e._mainBeamShake = 1 + (e._laserChargePct || 0) * (isStage2 ? 7 : 5);
    e._laserEndX = originX + Math.cos(e._laserAngle) * BEAM_LENGTH;
    e._laserEndY = originY + Math.sin(e._laserAngle) * BEAM_LENGTH;
    if (e._laserChargeTimer <= 0) {
      e._laserCharging = false;
      e._laserFiring = true;
      e._laserActiveFrames = 0;
      e._laserChargePct = 0;
    }
  } else {
    e._mainBeamShake = 0;
    e._laserCooldownTimer--;
    if (e._laserCooldownTimer <= 0) {
      e._laserCharging = true;
      e._laserChargeTimer = mainChargeDuration;
    }
  }

  // Only expose endpoint (and deal damage) while firing
  if (e._laserFiring) {
    e._laserEndX = originX + Math.cos(e._laserAngle) * BEAM_LENGTH;
    e._laserEndY = originY + Math.sin(e._laserAngle) * BEAM_LENGTH;
    const hit = pointNearLine(p.x, p.y, originX, originY, e._laserEndX, e._laserEndY, 18); // wider hit box
    e._laserHitsPlayer = hit;
  } else {
    e._laserHitsPlayer = false;
  }

  e._hasFired = true;

  // ── Photon volleys: intermittent heavier shots during the fight ──
  e._photonCooldown--;
  if (e._photonCooldown <= 0) {
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const len = Math.hypot(dx, dy) || 1;
    const baseAngle = Math.atan2(dy, dx);
    const photonCount = veryLowPerf ? 1 : (lowPerf ? (isStage2 ? 2 : 1) : (isStage2 ? 3 : 2));
    const bulletCap = veryLowPerf ? 120 : (lowPerf ? 160 : 240);
    if ((s.enemyBullets?.length || 0) >= bulletCap) {
      e._photonCooldown = photonCooldownDuration;
      return;
    }
    for (let i = 0; i < photonCount; i++) {
      const offset = photonCount === 1 ? 0 : (-0.18 + (0.36 / Math.max(1, photonCount - 1)) * i);
      const angle = baseAngle + offset;
      const speed = isStage2 ? 3.5 : 3.1;
      s.enemyBullets.push({
        x: originX + Math.cos(angle) * 22,
        y: originY + Math.sin(angle) * 22,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        boss: true,
        big: true,
        beholderPhoton: true,
      });
    }
    e._photonCooldown = photonCooldownDuration;
  }

  // ── Lasers 2 & 3: similar style, staggered timings ──
  const allowSideLaser1 = !veryLowPerf;
  const allowSideLaser2 = !(lowPerf || veryLowPerf);

  e._randLaser1Cooldown = (e._randLaser1Cooldown || 0) - 1;
  if (allowSideLaser1 && !e._randLaser1 && e._randLaser1Cooldown <= 0) {
    e._randLaser1 = {
      angle: Math.random() * Math.PI * 2,
      timer: sideChargeDuration,
      charging: true,
      chargeDuration: sideChargeDuration,
    };
    e._randLaser1Cooldown = sideCooldownDuration + Math.floor(Math.random() * 50);
  }

  e._randLaser2Cooldown = (e._randLaser2Cooldown || 0) - 1;
  if (allowSideLaser2 && !e._randLaser2 && e._randLaser2Cooldown <= 0) {
    e._randLaser2 = {
      angle: Math.random() * Math.PI * 2,
      timer: sideChargeDuration,
      charging: true,
      chargeDuration: sideChargeDuration,
    };
    e._randLaser2Cooldown = sideCooldownDuration + 70 + Math.floor(Math.random() * 60);
  }

  if (!allowSideLaser1) {
    e._randLaser1 = null;
    e._randLaserEndX = undefined;
    e._randLaserEndY = undefined;
  }
  if (!allowSideLaser2) {
    e._randLaser2 = null;
    e._randLaserEndX2 = undefined;
    e._randLaserEndY2 = undefined;
  }

  const tickSideLaser = (rl, idx) => {
    if (!rl) return null;
    rl.timer--;
    const endX = originX + Math.cos(rl.angle) * BEAM_LENGTH;
    const endY = originY + Math.sin(rl.angle) * BEAM_LENGTH;
    if (idx === 0) { e._randLaserEndX = endX; e._randLaserEndY = endY; }
    else { e._randLaserEndX2 = endX; e._randLaserEndY2 = endY; }

    if (rl.charging) {
      rl.chargePct = 1 - (rl.timer / rl.chargeDuration);
      if (rl.timer <= 0) {
        rl.charging = false;
        rl.timer = sideActiveDuration;
        rl.chargePct = 1;
      }
      return rl;
    }

    if (pointNearLine(p.x, p.y, originX, originY, endX, endY, 10)) e._laserHitsPlayer = true;
    if (rl.timer <= 0) {
      if (idx === 0) { e._randLaserEndX = undefined; e._randLaserEndY = undefined; }
      else { e._randLaserEndX2 = undefined; e._randLaserEndY2 = undefined; }
      return null;
    }
    return rl;
  };

  e._randLaser1 = tickSideLaser(e._randLaser1, 0);
  e._randLaser2 = tickSideLaser(e._randLaser2, 1);
}

function pointNearLine(px, py, x1, y1, x2, y2, threshold) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - x1, py - y1) < threshold;
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const nx = x1 + t * dx, ny = y1 + t * dy;
  return Math.hypot(px - nx, py - ny) < threshold;
}

export function getBeholderShieldRadius(e) {
  if (e._shieldActive) return 280;
  return 0;
}