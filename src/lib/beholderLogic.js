// Beholder Boss (Tier 3) — specialized movement, shield mechanics, and firing patterns

export function initBeholderMovement(e) {
  e._beholderMovementPhase = 'entry'; // entry → bouncing
  e._beholderVx = 0;
  e._beholderVy = 0;
}

export function updateBeholderMovement(e, W, H) {
  const entryY = H * 0.20;

  // Entry phase: slide in from top
  if (e._beholderMovementPhase === 'entry') {
    if (e.y < entryY) {
      e.y += Math.min((entryY - e.y) * 0.05 + 1.2, 10);
      e.x += (W / 2 - e.x) * 0.06;
    } else {
      // Transition to bouncing
      e._beholderMovementPhase = 'bouncing';
      // Pick a random diagonal direction
      const angle = Math.random() * Math.PI * 2;
      const speed = 3.5;
      e._beholderVx = Math.cos(angle) * speed;
      e._beholderVy = Math.sin(angle) * speed;
    }
  }

  if (e._beholderMovementPhase === 'bouncing') {
    e.x += e._beholderVx;
    e.y += e._beholderVy;

    // Bounce off walls with boundary checks
    if (e.x < 60) {
      e.x = 60;
      e._beholderVx = Math.abs(e._beholderVx);
    }
    if (e.x > W - 60) {
      e.x = W - 60;
      e._beholderVx = -Math.abs(e._beholderVx);
    }
    if (e.y < 30) {
      e.y = 30;
      e._beholderVy = Math.abs(e._beholderVy);
    }
    if (e.y > H * 0.55) {
      e.y = H * 0.55;
      e._beholderVy = -Math.abs(e._beholderVy);
    }
  }
}

export function updateBeholderShield(e) {
  // Check if stage 2 triggered
  const isStage2 = e.hp <= e.maxHp / 3 && !e._stage2Triggered;
  if (isStage2) {
    e._stage2Triggered = true;
    e._shieldActive = false;
    e._shieldCooldown = 0;
  }

  if (!e._stage2Triggered) return; // No shield in stage 1

  // Initialize shield state if needed
  if (!e._shieldStateInit) {
    e._shieldStateInit = true;
    e._shieldActive = false;
    e._shieldTimer = 0;
    e._shieldCooldown = 0;
  }

  // Handle cooldown
  if (e._shieldCooldown > 0) {
    e._shieldCooldown--;
    return;
  }

  // Handle active shield
  if (e._shieldActive) {
    e._shieldTimer--;
    if (e._shieldTimer <= 0) {
      e._shieldActive = false;
      e._shieldCooldown = 600; // 10 seconds at 60fps
    }
  } else if (e._shieldCooldown <= 0) {
    // Activate shield if not on cooldown
    e._shieldActive = true;
    e._shieldTimer = 180; // 3 seconds at 60fps
  }
}

export function updateBeholderFire(e, p, s, sounds) {
  const isStage2 = e._stage2Triggered && e.hp <= e.maxHp / 3;

  // Initialize laser timer
  if (e._laserAtPlayerTimer === undefined) e._laserAtPlayerTimer = 60;
  
  e._laserAtPlayerTimer--;

  // Laser at player position — fires every 3 seconds (180 frames)
  if (e._laserAtPlayerTimer <= 0) {
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const len = Math.hypot(dx, dy) || 1;
    const angle = Math.atan2(dy, dx);

    // Fire 5 lasers in a spread toward player
    for (let i = 0; i < 5; i++) {
      const spreadAngle = angle + (i - 2) * 0.25;
      s.enemyBullets.push({
        x: e.x,
        y: e.y,
        vx: Math.cos(spreadAngle) * 5.5,
        vy: Math.sin(spreadAngle) * 5.5,
        boss: true,
      });
    }
    sounds && sounds.hit && sounds.hit();
    e._laserAtPlayerTimer = isStage2 ? 120 : 180;
    e._hasFired = true;
  }
}

export function getBeholderShieldRadius(e) {
  // Shield hitbox is much larger than sprite to actually block projectiles
  if (e._shieldActive) {
    return 280; // Significantly larger than the boss sprite
  }
  return 0; // No shield active
}