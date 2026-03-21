// Boss behavior logic — all boss-specific AI, firing patterns, and special weapons

// ─── Boss Warning ────────────────────────────────────────────────────────────
export function createBossWarning(wave) {
  return { active: true, wave, timer: 180 };
}

// ─── Boss Spawner ────────────────────────────────────────────────────────────
export function spawnBoss(W, wave, hpMult) {
  const bossHp = Math.round((50 + wave * 12.5) * hpMult);
  const bossTier = Math.floor(wave / 5);

  const boss = {
    type: 'boss',
    x: W / 2,
    y: -80,
    w: 45, h: 45,
    hp: bossHp, maxHp: bossHp,
    vx: 1.8, vy: 0.4,
    fireTimer: 5,
    phase: 0,
    tier: bossTier,
    _wave: wave,
    _specialTimer: 0,
    _chargeTimer: 0,
    _charging: false,
    _chargeDx: 0,
    _chargeDy: 0,
    _weaponIdx: 0,
    _laserCharging: false,
    _laserChargeTimer: 0,
    _laserActive: false,
    _laserAngle: 0,
    _photonPositions: [-80, -40, 0, 40, 80],
  };
  return boss;
}

// ─── Boss Movement ────────────────────────────────────────────────────────────
export function updateBossMovement(e, W, H) {
  const bt = e.tier || 1;
  e.phase = (e.phase || 0) + (bt >= 4 ? 0.012 : bt >= 3 ? 0.010 : bt >= 2 ? 0.008 : 0.006);
  const targetY = bt >= 3 ? H * 0.25 : H * 0.18;

  // Smooth slide down from top — lerp toward position, no early return so firing is not interrupted
  if (e.y < targetY - 10) {
    e.y += Math.min((targetY - e.y) * 0.03 + 0.4, 6);
    e.x += (W / 2 - e.x) * 0.04;
    // Don't return — allow firing to proceed below
  }

  if (e._charging) {
    e.x += e._chargeDx * 5;
    e.y += e._chargeDy * 5;
    e._chargeDuration = (e._chargeDuration || 0) - 1;
    if (e._chargeDuration <= 0) {
      e._charging = false;
      e._chargeTimer = 240;
    }
    if (e.x < 60) { e.x = 60; e._chargeDx = Math.abs(e._chargeDx); }
    if (e.x > W - 60) { e.x = W - 60; e._chargeDx = -Math.abs(e._chargeDx); }
    if (e.y < 30) { e.y = 30; e._chargeDy = Math.abs(e._chargeDy); }
    if (e.y > H * 0.55) { e.y = H * 0.55; e._chargeDy = -Math.abs(e._chargeDy); e._charging = false; e._chargeTimer = 240; }
    return;
  }

  // Compute desired — keep boss in upper portion of screen only
  const margin = W * 0.20;
  let desiredX, desiredY;
  if (bt === 1) {
    desiredX = W / 2 + Math.sin(e.phase) * (W * 0.28);
    desiredY = targetY + Math.sin(e.phase * 1.3) * 30;
  } else if (bt === 2) {
    desiredX = W / 2 + Math.sin(e.phase) * (W * 0.32);
    desiredY = targetY + Math.sin(e.phase * 1.5) * 40;
  } else if (bt === 3) {
    desiredX = W / 2 + Math.cos(e.phase) * (W * 0.32);
    desiredY = targetY + Math.sin(e.phase * 1.7) * 50;
  } else if (bt === 4) {
    desiredX = W / 2 + Math.cos(e.phase) * (W * 0.24);
    desiredY = targetY + Math.sin(e.phase * 2) * 40;
  } else {
    desiredX = W / 2 + Math.cos(e.phase) * (W * 0.28);
    desiredY = targetY + Math.sin(e.phase * 2) * 50;
  }

  // Clamp desired to safe zone — boss stays in top 40% of screen
  desiredX = Math.max(margin, Math.min(W - margin, desiredX));
  desiredY = Math.max(targetY - 20, Math.min(H * 0.42, desiredY));

  // Smooth lerp
  e.x += (desiredX - e.x) * 0.05;
  e.y += (desiredY - e.y) * 0.05;
}

// ─── Tier 1 (Wave 5): Rapid basic shots + occasional missiles ────────────────
export function updateBossTier1Fire(e, p, s, sounds) {
  e.fireTimer--;
  if (e.fireTimer <= 0) {
    const dx = p.x - e.x, dy = p.y - e.y;
    const len = Math.hypot(dx, dy) || 1;
    s.enemyBullets.push({ x: e.x, y: e.y, vx: (dx / len) * 5.5, vy: (dy / len) * 5.5, boss: true });
    e.fireTimer = 10;
    e._specialTimer = (e._specialTimer || 0) - 1;
  }

  e._specialTimer = (e._specialTimer || 200) - 1;
  if (e._specialTimer <= 0) {
    for (let i = 0; i < 3; i++) {
      const spread = (i - 1) * 0.35;
      s.enemyBullets.push({
        x: e.x, y: e.y,
        vx: Math.sin(spread) * 2.5,
        vy: 4,
        boss: true, big: true,
        homing: true, target: p,
        homingStrength: 0.08,
      });
    }
    sounds && sounds.hit && sounds.hit();
    e._specialTimer = 240;
  }
}

// ─── Tier 2 (Wave 10): Omnidirectional burst with cooldown + large missile ───
export function updateBossTier2Fire(e, p, s, sounds) {
  e._omniTimer = (e._omniTimer || 0) - 1;
  e._omniCooldown = Math.max(0, (e._omniCooldown || 0) - 1);

  if (e._omniTimer <= 0 && e._omniCooldown <= 0) {
    const SHOTS = 16;
    for (let i = 0; i < SHOTS; i++) {
      const angle = (i / SHOTS) * Math.PI * 2;
      s.enemyBullets.push({
        x: e.x, y: e.y,
        vx: Math.cos(angle) * 3.5, vy: Math.sin(angle) * 3.5,
        boss: true,
      });
    }
    e._omniTimer = 90;
    e._omniCooldown = 30;
  }

  e._specialTimer = (e._specialTimer || 300) - 1;
  if (e._specialTimer <= 0) {
    s.enemyBullets.push({
      x: e.x, y: e.y,
      vx: (p.x - e.x) / Math.max(Math.hypot(p.x - e.x, p.y - e.y), 1) * 3,
      vy: (p.y - e.y) / Math.max(Math.hypot(p.x - e.x, p.y - e.y), 1) * 3,
      boss: true, big: true,
      homing: true, target: p,
      homingStrength: 0.12,
    });
    e._specialTimer = 300;
  }
}

// ─── Tier 3 (Wave 15): Dual outward lasers with 3s charge, random directions ──
// Each laser fires outward from boss edge, NOT from center
export function updateBossTier3Fire(e, p, s, W, H, spawnExplosion, sounds, onScoreChange, BLOCK_SIZE, getBlockCells) {
  const BOSS_RADIUS = 80; // offset from boss center to edge

  // Initialize state
  if (e._sweepState === undefined) { e._sweepState = 'cooldown'; e._sweepStateTimer = 120; }

  e._sweepStateTimer--;

  if (e._sweepState === 'cooldown') {
    e._sweepHitsPlayer = false;
    if (e._sweepStateTimer <= 0) {
      // Pick 2 random outward angles (not toward player — away from center)
      e._laserAngle = Math.random() * Math.PI * 2;
      e._laserAngle2 = e._laserAngle + Math.PI + (Math.random() - 0.5) * 1.2;
      e._sweepState = 'charging';
      e._sweepStateTimer = 180; // 3 second charge at 60fps
    }
  } else if (e._sweepState === 'charging') {
    // Slow rotation during charge for visual interest
    e._laserAngle += 0.005;
    e._laserAngle2 += 0.005;
    if (e._sweepStateTimer <= 0) {
      e._sweepState = 'active';
      e._sweepStateTimer = 200; // ~3.3s active
    }
  } else if (e._sweepState === 'active') {
    // Sweep rotation
    e._laserAngle += 0.020;
    e._laserAngle2 = e._laserAngle + Math.PI;

    const LASER_LEN = Math.max(W, H) * 1.4;
    // Lasers start from boss EDGE, not center
    const l1StartX = e.x + Math.cos(e._laserAngle) * BOSS_RADIUS;
    const l1StartY = e.y + Math.sin(e._laserAngle) * BOSS_RADIUS;
    const l1EndX = e.x + Math.cos(e._laserAngle) * LASER_LEN;
    const l1EndY = e.y + Math.sin(e._laserAngle) * LASER_LEN;
    const l2StartX = e.x + Math.cos(e._laserAngle2) * BOSS_RADIUS;
    const l2StartY = e.y + Math.sin(e._laserAngle2) * BOSS_RADIUS;
    const l2EndX = e.x + Math.cos(e._laserAngle2) * LASER_LEN;
    const l2EndY = e.y + Math.sin(e._laserAngle2) * LASER_LEN;

    e._sweepLaserStartX = l1StartX; e._sweepLaserStartY = l1StartY;
    e._sweepLaserEndX = l1EndX; e._sweepLaserEndY = l1EndY;
    e._sweepLaserStartX2 = l2StartX; e._sweepLaserStartY2 = l2StartY;
    e._sweepLaserEndX2 = l2EndX; e._sweepLaserEndY2 = l2EndY;

    // Damage check every 8 frames for performance
    e._laserDmgTimer = (e._laserDmgTimer || 0) - 1;
    if (e._laserDmgTimer <= 0) {
      e._laserDmgTimer = 8;
      const lasers = [
        [l1StartX, l1StartY, l1EndX, l1EndY],
        [l2StartX, l2StartY, l2EndX, l2EndY],
      ];
      lasers.forEach(([sx, sy, ex, ey]) => {
        // Damage blocks (skip invulnerable)
        s.blocks.forEach(block => {
          if (block.dead || block.invulnerable) return;
          getBlockCells(block).forEach(cell => {
            const cx = cell.x + BLOCK_SIZE / 2, cy = cell.y + BLOCK_SIZE / 2;
            if (pointNearLine(cx, cy, sx, sy, ex, ey, 14)) {
              block.hp -= 1;
              spawnExplosion(s, cx, cy, '#ff44ff', 2);
              if (block.hp <= 0) block.dead = true;
            }
          });
        });
      });
      // Player hit check
      e._sweepHitsPlayer =
        pointNearLine(p.x, p.y, l1StartX, l1StartY, l1EndX, l1EndY, 16) ||
        pointNearLine(p.x, p.y, l2StartX, l2StartY, l2EndX, l2EndY, 16);
    }

    if (e._sweepStateTimer <= 0) {
      e._sweepState = 'cooldown';
      e._sweepStateTimer = 200;
      e._sweepLaserEndX = null;
      e._sweepLaserEndX2 = null;
      e._sweepHitsPlayer = false;
    }
  }

  // Super laser: fires straight down from boss
  e._superLaserTimer = (e._superLaserTimer || 420) - 1;
  if (!e._superLaserCharging && !e._superLaserActive && e._superLaserTimer <= 0) {
    e._superLaserCharging = true;
    e._superLaserChargeTimer = 120;
    e._superLaserTimer = 540;
  }
  if (e._superLaserCharging) {
    e._superLaserChargeTimer--;
    if (e._superLaserChargeTimer <= 0) {
      e._superLaserCharging = false;
      e._superLaserActive = true;
      e._superLaserDuration = 120;
      e._superLaserDmgTimer = 0;
    }
  }
  if (e._superLaserActive) {
    e._superLaserDuration--;
    e._superLaserDmgTimer = (e._superLaserDmgTimer || 0) - 1;
    if (e._superLaserDmgTimer <= 0) {
      e._superLaserDmgTimer = 6;
      const bx = e.x;
      s.blocks.forEach(block => {
        if (block.dead) return;
        getBlockCells(block).forEach(cell => {
          if (Math.abs(cell.x + BLOCK_SIZE / 2 - bx) < 20) {
            block.hp -= 2;
            spawnExplosion(s, cell.x + BLOCK_SIZE / 2, cell.y, '#ffffff', 3);
            if (block.hp <= 0) block.dead = true;
          }
        });
      });
      e._superHitsPlayer = Math.abs(p.x - bx) < 22;
    }
    if (e._superLaserDuration <= 0) {
      e._superLaserActive = false;
      e._superHitsPlayer = false;
    }
  }
}

// ─── Tier 4 Block+Enemy Armor: blocks/enemies that collide with boss stick as armor ──────
export function updateBossTier4Armor(e, s, BLOCK_SIZE, getBlockCells, spawnExplosion) {
  if (!e._armorBlocks) e._armorBlocks = []; // [{dx, dy, color, hp, isShip}]

  // Absorb falling blocks within range
  s.blocks = s.blocks.filter(block => {
    if (block.dead || block.settled || block._bossAbsorbed) return true;
    const cells = getBlockCells(block);
    const anyClose = cells.some(cell => Math.hypot(cell.x + BLOCK_SIZE / 2 - e.x, cell.y + BLOCK_SIZE / 2 - e.y) < 80);
    if (anyClose) {
      cells.forEach(cell => {
        const dx = (cell.x + BLOCK_SIZE / 2) - e.x;
        const dy = (cell.y + BLOCK_SIZE / 2) - e.y;
        // Clamp to orbit ring: 60–120px from boss center
        const dist = Math.hypot(dx, dy) || 1;
        const targetDist = Math.max(60, Math.min(120, dist));
        const ndx = (dx / dist) * targetDist;
        const ndy = (dy / dist) * targetDist;
        e._armorBlocks.push({ dx: ndx, dy: ndy, color: block.color, hp: 3 });
      });
      block._bossAbsorbed = true;
      return false;
    }
    return true;
  });

  // Absorb nearby non-boss enemies (basic, elite) as armor ships
  s.enemies = s.enemies.filter(enemy => {
    if (enemy === e || enemy.dead || enemy.type === 'boss' || enemy.type === 'dropper') return true;
    if (enemy._bossAbsorbed) return false; // already absorbed, remove
    const dist = Math.hypot(enemy.x - e.x, enemy.y - e.y);
    if (dist < 90 && e._armorBlocks.length < 24) {
      const dx = enemy.x - e.x;
      const dy = enemy.y - e.y;
      const nd = Math.max(dist, 1);
      const targetDist = Math.max(60, Math.min(130, nd));
      const ndx = (dx / nd) * targetDist;
      const ndy = (dy / nd) * targetDist;
      e._armorBlocks.push({ dx: ndx, dy: ndy, color: '#ff4444', hp: 4, isShip: true });
      enemy._bossAbsorbed = true;
      spawnExplosion(s, enemy.x, enemy.y, '#ff4444', 6);
      return false; // remove from normal enemy list
    }
    return true;
  });

  // Cap armor at 24 pieces
  if (e._armorBlocks.length > 24) e._armorBlocks = e._armorBlocks.slice(-24);
}

export function drawBossTier4Armor(ctx, e, BLOCK_SIZE) {
  if (!e._armorBlocks || e._armorBlocks.length === 0) return;
  const sz = BLOCK_SIZE;
  e._armorBlocks.forEach(piece => {
    const ax = e.x + piece.dx;
    const ay = e.y + piece.dy;
    ctx.save();
    ctx.shadowColor = piece.color; ctx.shadowBlur = 10;
    if (piece.isShip) {
      // Draw as small ship silhouette
      ctx.translate(ax, ay);
      ctx.strokeStyle = piece.color; ctx.lineWidth = 2;
      ctx.fillStyle = piece.color + '66';
      ctx.beginPath();
      ctx.moveTo(0, -10); ctx.lineTo(8, 8); ctx.lineTo(0, 4); ctx.lineTo(-8, 8); ctx.closePath();
      ctx.fill(); ctx.stroke();
      if (piece.hp <= 2) {
        // cracked
        ctx.strokeStyle = 'rgba(255,200,200,0.6)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.stroke();
      }
    } else {
      ctx.fillStyle = piece.color + 'cc';
      ctx.fillRect(ax - sz / 2, ay - sz / 2, sz, sz);
      ctx.strokeStyle = '#ffffff44'; ctx.lineWidth = 1;
      ctx.strokeRect(ax - sz / 2, ay - sz / 2, sz, sz);
      if (piece.hp <= 1) {
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ax - sz / 2, ay); ctx.lineTo(ax + sz / 2, ay);
        ctx.moveTo(ax, ay - sz / 2); ctx.lineTo(ax, ay + sz / 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  });
}

// ─── Tier 4 (Wave 20): Multi-position photon guns + max bounce shot ───────────
export function updateBossTier4Fire(e, p, s, sounds, W, H, spawnExplosion) {
  e._photonTimer = (e._photonTimer || 0) - 1;
  if (e._photonTimer <= 0) {
    const offsets = [-80, -40, 0, 40, 80];
    offsets.forEach(ox => {
      const fx = e.x + ox;
      const fy = e.y + 20;
      const dx = p.x - fx, dy = p.y - fy;
      const len = Math.hypot(dx, dy) || 1;
      s.enemyBullets.push({
        x: fx, y: fy,
        vx: (dx / len) * 3.5, vy: (dy / len) * 3.5,
        boss: true, big: true,
        photonOrb: true, orbSize: 16,
        piercing: true,
      });
    });
    e._photonTimer = 80;
  }

  e._bounceTimer = (e._bounceTimer || 200) - 1;
  if (e._bounceTimer <= 0) {
    const SHOTS = 8;
    for (let i = 0; i < SHOTS; i++) {
      const angle = (i / SHOTS) * Math.PI * 2;
      s.enemyBullets.push({
        x: e.x, y: e.y,
        vx: Math.cos(angle) * 5, vy: Math.sin(angle) * 5,
        boss: true, big: true,
        bouncing: true, bouncesLeft: 10,
      });
    }
    e._bounceTimer = 280;
  }
}

// ─── Tier 5 (Wave 25): Cycles all player weapons at max + charge attacks ──────
const BOSS5_WEAPONS = ['spread', 'laser', 'photon', 'bounce', 'missile', 'shotgun'];

export function updateBossTier5Fire(e, p, s, sounds, W, H, spawnExplosion) {
  e._weaponTimer = (e._weaponTimer || 0) - 1;
  if (e._weaponTimer <= 0) {
    const gun = BOSS5_WEAPONS[e._weaponIdx % BOSS5_WEAPONS.length];
    fireBoss5Weapon(gun, e, p, s);
    e._shotCount = (e._shotCount || 0) + 1;
    if (e._shotCount >= 3) { e._shotCount = 0; e._weaponIdx++; }
    e._weaponTimer = 25;
  }

  e._chargeTimer = (e._chargeTimer || 300) - 1;
  if (e._chargeTimer <= 0 && !e._charging) {
    const dx = p.x - e.x, dy = p.y - e.y;
    const len = Math.hypot(dx, dy) || 1;
    e._chargeDx = dx / len;
    e._chargeDy = dy / len;
    e._charging = true;
    e._chargeDuration = 50;
    e._chargeTimer = 300;
  }
}

function fireBoss5Weapon(gun, e, p, s) {
  const dx = p.x - e.x, dy = p.y - e.y;
  const len = Math.hypot(dx, dy) || 1;
  if (gun === 'spread') {
    for (let i = 0; i < 11; i++) {
      const angleDeg = -75 + i * 15;
      const rad = (angleDeg * Math.PI) / 180;
      s.enemyBullets.push({ x: e.x, y: e.y, vx: Math.sin(rad) * 5, vy: Math.cos(rad) * 5, boss: true });
    }
  } else if (gun === 'laser') {
    for (let li = 0; li < 5; li++) {
      s.enemyBullets.push({ x: e.x, y: e.y + li * 5, vx: (dx / len) * 8, vy: (dy / len) * 8, boss: true });
    }
  } else if (gun === 'photon') {
    s.enemyBullets.push({ x: e.x, y: e.y, vx: (dx / len) * 2.5, vy: (dy / len) * 2.5, boss: true, big: true, photonOrb: true, orbSize: 18 });
  } else if (gun === 'bounce') {
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2;
      s.enemyBullets.push({ x: e.x, y: e.y, vx: Math.cos(ang) * 4.5, vy: Math.sin(ang) * 4.5, boss: true, bouncing: true, bouncesLeft: 5 });
    }
  } else if (gun === 'missile') {
    for (let mi = 0; mi < 3; mi++) {
      const spread = (mi - 1) * 0.4;
      s.enemyBullets.push({ x: e.x, y: e.y, vx: Math.sin(spread) * 3, vy: (dy / len) * 5, boss: true, big: true, homing: true, target: p, homingStrength: 0.15 });
    }
  } else if (gun === 'shotgun') {
    for (let i = 0; i < 9; i++) {
      const angleDeg = -60 + i * 15;
      const rad = (angleDeg * Math.PI) / 180;
      s.enemyBullets.push({ x: e.x, y: e.y, vx: Math.sin(rad) * 4.5 + (dx / len) * 2, vy: Math.cos(rad) * 4.5 + (dy / len) * 2, boss: true });
    }
  }
}

// ─── Homing bullet updater ──────────────────────────────────────────────────
export function updateHomingBullets(enemyBullets) {
  enemyBullets.forEach(b => {
    if (!b.homing || !b.target) return;
    const tx = b.target.x, ty = b.target.y;
    const dx = tx - b.x, dy = ty - b.y;
    const len = Math.hypot(dx, dy) || 1;
    const str = b.homingStrength || 0.1;
    b.vx += (dx / len) * str;
    b.vy += (dy / len) * str;
    const spd = Math.hypot(b.vx, b.vy);
    const maxSpd = 6;
    if (spd > maxSpd) { b.vx = (b.vx / spd) * maxSpd; b.vy = (b.vy / spd) * maxSpd; }
  });
}

// ─── Helper: point near line segment ─────────────────────────────────────────
function pointNearLine(px, py, x1, y1, x2, y2, threshold) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - x1, py - y1) < threshold;
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const nx = x1 + t * dx, ny = y1 + t * dy;
  return Math.hypot(px - nx, py - ny) < threshold;
}

// ─── Draw boss anchor (stub) ─────────────────────────────────────────────────
export function drawBossAnchor(ctx, e) {}

// ─── Draw tier 3 dual sweep lasers ───────────────────────────────────────────
export function drawBossSweepLaser(ctx, e) {
  const isCharging = e._sweepState === 'charging';
  const isActive = e._sweepState === 'active';

  // Charging indicator — pulsing rings at boss edge
  if (isCharging) {
    const pct = Math.max(0, 1 - (e._sweepStateTimer / 180));
    ctx.save();
    // Two charging points on boss edge
    const BOSS_RADIUS = 80;
    [e._laserAngle, e._laserAngle2].forEach((angle, i) => {
      if (angle === undefined) return;
      const sx = e.x + Math.cos(angle) * BOSS_RADIUS;
      const sy = e.y + Math.sin(angle) * BOSS_RADIUS;
      ctx.shadowColor = '#ff44ff'; ctx.shadowBlur = 20 * pct;
      ctx.strokeStyle = `rgba(255,${68 + i * 80},255,${pct * 0.9})`;
      ctx.lineWidth = 3 + pct * 4;
      ctx.beginPath(); ctx.arc(sx, sy, 8 + pct * 20, 0, Math.PI * 2); ctx.stroke();
    });
    ctx.restore();
    return;
  }

  if (!isActive || !e._sweepLaserEndX) return;

  ctx.save();
  // Draw laser 1 from edge
  const sx1 = e._sweepLaserStartX ?? e.x;
  const sy1 = e._sweepLaserStartY ?? e.y;
  ctx.shadowColor = '#ff44ff'; ctx.shadowBlur = 22;
  ctx.strokeStyle = 'rgba(255,68,255,0.7)'; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(sx1, sy1); ctx.lineTo(e._sweepLaserEndX, e._sweepLaserEndY); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,200,255,0.95)'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(sx1, sy1); ctx.lineTo(e._sweepLaserEndX, e._sweepLaserEndY); ctx.stroke();

  // Draw laser 2 from edge
  if (e._sweepLaserEndX2) {
    const sx2 = e._sweepLaserStartX2 ?? e.x;
    const sy2 = e._sweepLaserStartY2 ?? e.y;
    ctx.shadowColor = '#cc44ff';
    ctx.strokeStyle = 'rgba(200,68,255,0.7)'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(sx2, sy2); ctx.lineTo(e._sweepLaserEndX2, e._sweepLaserEndY2); ctx.stroke();
    ctx.strokeStyle = 'rgba(220,180,255,0.95)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(sx2, sy2); ctx.lineTo(e._sweepLaserEndX2, e._sweepLaserEndY2); ctx.stroke();
  }
  ctx.restore();
}

export function drawBossSuperLaser(ctx, e) {
  if (!e._superLaserCharging && !e._superLaserActive) return;
  ctx.save();
  if (e._superLaserCharging) {
    const pct = 1 - (e._superLaserChargeTimer / 90);
    const radius = 20 + pct * 60;
    ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 40 * pct;
    ctx.strokeStyle = `rgba(255,255,255,${pct * 0.8})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(e.x, e.y, radius, 0, Math.PI * 2); ctx.stroke();
  } else if (e._superLaserActive) {
    ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 60;
    ctx.strokeStyle = 'rgba(200,200,255,0.5)'; ctx.lineWidth = 60;
    ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x, 2000); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 16;
    ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x, 2000); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x, 2000); ctx.stroke();
  }
  ctx.restore();
}