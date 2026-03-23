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

// Tracking laser — a beam angle that slowly rotates toward the player
export function updateBeholderFire(e, p, s, sounds) {
  const isStage2 = e._stage2Triggered && e.hp <= e.maxHp / 3;

  // Initialize laser angle pointing straight down
  if (e._laserAngle === undefined) {
    e._laserAngle = Math.PI / 2;
  }

  // How fast the laser rotates toward the player (radians per frame)
  const trackSpeed = isStage2 ? 0.022 : 0.012;

  // Target angle = direction from boss to player
  const targetAngle = Math.atan2(p.y - e.y, p.x - e.x);

  // Shortest-path angle interpolation
  let diff = targetAngle - e._laserAngle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  e._laserAngle += Math.sign(diff) * Math.min(Math.abs(diff), trackSpeed);

  // Store laser endpoint for drawing (long beam)
  const BEAM_LENGTH = 1200;
  e._laserEndX = e.x + Math.cos(e._laserAngle) * BEAM_LENGTH;
  e._laserEndY = e.y + Math.sin(e._laserAngle) * BEAM_LENGTH;

  // Check if beam hits player (point-near-line)
  const hit = pointNearLine(p.x, p.y, e.x, e.y, e._laserEndX, e._laserEndY, 14);
  e._laserHitsPlayer = hit;

  // Mark as having fired so damage can be taken
  e._hasFired = true;
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