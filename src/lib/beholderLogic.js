// Beholder Boss (Tier 3) — movement, shield mechanics, and tracking laser

export function initBeholderMovement(e) {
  e._beholderMovementPhase = 'entry';
  e._beholderVx = 0;
  e._beholderVy = 0;
}

export function updateBeholderMovement(e, W, H) {
  const entryY = H * 0.20;

  if (e._beholderMovementPhase === 'entry') {
    if (e.y < entryY) {
      e.y += Math.min((entryY - e.y) * 0.05 + 1.2, 10);
      e.x += (W / 2 - e.x) * 0.06;
    } else {
      e._beholderMovementPhase = 'bouncing';
      const angle = Math.random() * Math.PI * 2;
      const speed = 3.5;
      e._beholderVx = Math.cos(angle) * speed;
      e._beholderVy = Math.sin(angle) * speed;
    }
  }

  if (e._beholderMovementPhase === 'bouncing') {
    e.x += e._beholderVx;
    e.y += e._beholderVy;

    if (e.x < 60) { e.x = 60; e._beholderVx = Math.abs(e._beholderVx); }
    if (e.x > W - 60) { e.x = W - 60; e._beholderVx = -Math.abs(e._beholderVx); }
    if (e.y < 30) { e.y = 30; e._beholderVy = Math.abs(e._beholderVy); }
    if (e.y > H * 0.55) { e.y = H * 0.55; e._beholderVy = -Math.abs(e._beholderVy); }
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
  const BEAM_LENGTH = 1200;

  // ── Init ──
  if (e._laserAngle === undefined) {
    e._laserAngle = Math.PI / 2;
    e._laserTargetAngle = Math.PI / 2;
    // Fire cycle: laser active for a burst, then pauses
    e._laserFireTimer = 0;      // counts up; laser fires when active
    e._laserActiveFrames = 0;   // frames laser has been firing this burst
    e._laserCooldownTimer = 60; // wait before first burst
    e._laserFiring = false;
    // Random lasers
    e._randLaser1 = null; // { angle, timer }
    e._randLaser2 = null;
    e._randLaserCooldown = 90;
  }

  // ── Laser 1: tracking (lags behind player) ──
  // Only update target angle periodically — creates "lag" effect
  e._laserTargetUpdateTimer = (e._laserTargetUpdateTimer || 0) - 1;
  if (e._laserTargetUpdateTimer <= 0) {
    e._laserTargetAngle = Math.atan2(p.y - e.y, p.x - e.x);
    // Update target slowly — every 20 frames sample the player position
    e._laserTargetUpdateTimer = 20;
  }

  // Rotate toward the lagged target angle slowly
  const trackSpeed = isStage2 ? 0.016 : 0.009;
  let diff = e._laserTargetAngle - e._laserAngle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  e._laserAngle += Math.sign(diff) * Math.min(Math.abs(diff), trackSpeed);

  // Fire in bursts: active 150 frames, cooldown 200 frames (stage2: active 180, cooldown 140)
  const activeDuration = isStage2 ? 180 : 150;
  const cooldownDuration = isStage2 ? 140 : 200;

  if (e._laserFiring) {
    e._laserActiveFrames++;
    if (e._laserActiveFrames >= activeDuration) {
      e._laserFiring = false;
      e._laserCooldownTimer = cooldownDuration;
      e._laserEndX = undefined; // hide beam during cooldown
      e._laserEndY = undefined;
    }
  } else {
    e._laserCooldownTimer--;
    if (e._laserCooldownTimer <= 0) {
      e._laserFiring = true;
      e._laserActiveFrames = 0;
    }
  }

  // Only expose endpoint (and deal damage) while firing
  if (e._laserFiring) {
    e._laserEndX = e.x + Math.cos(e._laserAngle) * BEAM_LENGTH;
    e._laserEndY = e.y + Math.sin(e._laserAngle) * BEAM_LENGTH;
    const hit = pointNearLine(p.x, p.y, e.x, e.y, e._laserEndX, e._laserEndY, 18); // wider hit box
    e._laserHitsPlayer = hit;
  } else {
    e._laserHitsPlayer = false;
  }

  e._hasFired = true;

  // ── Lasers 2 & 3: random-direction bursts ──
  e._randLaserCooldown--;
  if (e._randLaserCooldown <= 0) {
    // Spawn both random lasers at random angles, active for 90 frames
    const burstDuration = isStage2 ? 120 : 90;
    e._randLaser1 = { angle: Math.random() * Math.PI * 2, timer: burstDuration };
    e._randLaser2 = { angle: Math.random() * Math.PI * 2, timer: burstDuration };
    e._randLaserCooldown = isStage2 ? 180 : 260;
  }

  // Tick random lasers and check player hit
  [e._randLaser1, e._randLaser2].forEach((rl, idx) => {
    if (!rl) return;
    rl.timer--;
    // Slowly drift the random angle for visual interest
    rl.angle += 0.008;
    const endX = e.x + Math.cos(rl.angle) * BEAM_LENGTH;
    const endY = e.y + Math.sin(rl.angle) * BEAM_LENGTH;
    if (idx === 0) { e._randLaserEndX = endX; e._randLaserEndY = endY; }
    else { e._randLaserEndX2 = endX; e._randLaserEndY2 = endY; }
    // Deal damage if hitting player
    if (pointNearLine(p.x, p.y, e.x, e.y, endX, endY, 10)) {
      e._laserHitsPlayer = true;
    }
    if (rl.timer <= 0) {
      if (idx === 0) { e._randLaser1 = null; e._randLaserEndX = undefined; }
      else { e._randLaser2 = null; e._randLaserEndX2 = undefined; }
    }
  });
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