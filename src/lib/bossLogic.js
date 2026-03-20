// Boss behavior logic — all boss-specific AI, firing patterns, and special weapons

// ─── Boss Warning ────────────────────────────────────────────────────────────
// Returns a warning state object to be stored on the game state
export function createBossWarning(wave) {
  return { active: true, wave, timer: 180 }; // 3 seconds at 60fps
}

// ─── Boss Spawner ────────────────────────────────────────────────────────────
export function spawnBoss(W, wave, hpMult) {
  const bossHp = Math.round((20 + wave * 5) * hpMult);
  const bossTier = Math.floor(wave / 5); // 1, 2, 3, 4, 5

  const boss = {
    type: 'boss',
    x: W / 2,
    y: -80,          // always enter from top center
    w: 45, h: 45,
    hp: bossHp, maxHp: bossHp,
    vx: 1.8, vy: 0.4,
    fireTimer: 60,   // initial delay before first shot
    phase: 0,
    tier: bossTier,
    _wave: wave,
    // tier-specific state
    _specialTimer: 0,
    _chargeTimer: 0,
    _charging: false,
    _chargeDx: 0,
    _chargeDy: 0,
    _weaponIdx: 0,      // for tier 5: cycling weapons
    _laserCharging: false,
    _laserChargeTimer: 0,
    _laserActive: false,
    _laserAngle: 0,
    _anchorOut: false,
    _anchorX: 0,
    _anchorY: 0,
    _anchorVx: 0,
    _anchorVy: 0,
    _anchorTarget: null, // 'player', 'block', or null
    _photonPositions: [-80, -40, 0, 40, 80], // x offsets for photon emitters (tier 4)
  };
  return boss;
}

// ─── Boss Movement ────────────────────────────────────────────────────────────
export function updateBossMovement(e, W, H) {
  const bt = e.tier || 1;
  e.phase = (e.phase || 0) + (bt >= 4 ? 0.022 : bt >= 3 ? 0.016 : bt >= 2 ? 0.013 : 0.01);
  const targetY = bt >= 3 ? H * 0.30 : H * 0.22;

  // Slide down from top smoothly
  if (e.y < targetY) {
    e.y = Math.min(e.y + 1.5, targetY);
    e.x = W / 2; // stay centered while entering
    return;
  }

  if (e._charging) {
    e.x += e._chargeDx * 8;
    e.y += e._chargeDy * 8;
    e._chargeDuration = (e._chargeDuration || 0) - 1;
    if (e._chargeDuration <= 0) {
      e._charging = false;
      e._chargeTimer = 180;
    }
    if (e.x < 60) { e.x = 60; e._charging = false; e._chargeTimer = 120; }
    if (e.x > W - 60) { e.x = W - 60; e._charging = false; e._chargeTimer = 120; }
    if (e.y < 20) { e.y = 20; e._charging = false; e._chargeTimer = 120; }
    if (e.y > H * 0.6) { e.y = H * 0.6; e._charging = false; e._chargeTimer = 120; }
    return;
  }

  if (bt === 1) {
    e.x += Math.sin(e.phase) * 2;
  } else if (bt === 2) {
    e.x += Math.sin(e.phase) * 3;
    e.y = targetY + Math.sin(e.phase * 2) * 30;
  } else if (bt === 3) {
    e.x += e.vx * 1.5;
    if (e.x < 60 || e.x > W - 60) e.vx *= -1;
  } else if (bt === 4) {
    e.x = W / 2 + Math.cos(e.phase) * (W * 0.28);
    e.y = targetY + Math.sin(e.phase * 2) * 40;
  } else {
    // tier 5: figure-8 wide sweep
    e.x = W / 2 + Math.cos(e.phase) * (W * 0.32);
    e.y = targetY + Math.sin(e.phase * 2) * 50;
  }

  if (e.x < 50) { e.x = 50; e.vx = Math.abs(e.vx); }
  if (e.x > W - 50) { e.x = W - 50; e.vx = -Math.abs(e.vx); }
}

// ─── Tier 1 (Wave 5): Rapid basic shots + occasional missiles ────────────────
export function updateBossTier1Fire(e, p, s, sounds) {
  e.fireTimer--;
  if (e.fireTimer <= 0) {
    const dx = p.x - e.x, dy = p.y - e.y;
    const len = Math.hypot(dx, dy) || 1;
    // Rapid stream of single shots aimed at player
    s.enemyBullets.push({ x: e.x, y: e.y, vx: (dx / len) * 5.5, vy: (dy / len) * 5.5, boss: true });
    e.fireTimer = 10; // very rapid
    e._specialTimer = (e._specialTimer || 0) - 1;
  }

  // Missile salvo every ~4 seconds
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
    // Burst of shots in all directions
    const SHOTS = 16;
    for (let i = 0; i < SHOTS; i++) {
      const angle = (i / SHOTS) * Math.PI * 2;
      s.enemyBullets.push({
        x: e.x, y: e.y,
        vx: Math.cos(angle) * 3.5, vy: Math.sin(angle) * 3.5,
        boss: true,
      });
    }
    e._omniTimer = 90;       // fire every 1.5s
    e._omniCooldown = 30;    // 0.5s pause after burst
  }

  // Large homing missile every ~5 seconds
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

// ─── Tier 3 (Wave 15): Sweeping laser + super laser after long charge ─────────
export function updateBossTier3Fire(e, p, s, W, H, spawnExplosion, sounds, onScoreChange, BLOCK_SIZE, getBlockCells) {
  // Sweeping laser — always active, rotating angle
  if (!e._laserAngle) e._laserAngle = 0;
  e._laserAngle += 0.018; // sweep speed

  // Check what the sweeping laser hits this frame
  const LASER_LEN = Math.max(W, H);
  const lx = e.x, ly = e.y;
  const lEndX = lx + Math.cos(e._laserAngle) * LASER_LEN;
  const lEndY = ly + Math.sin(e._laserAngle) * LASER_LEN;

  // Store for drawing
  e._sweepLaserEndX = lEndX;
  e._sweepLaserEndY = lEndY;

  // Damage tetris blocks intersected by sweep laser (every 4 frames)
  if (!e._laserDmgTimer) e._laserDmgTimer = 0;
  e._laserDmgTimer--;
  if (e._laserDmgTimer <= 0) {
    e._laserDmgTimer = 4;
    s.blocks.forEach(block => {
      if (block.dead) return;
      getBlockCells(block).forEach(cell => {
        const cx = cell.x + BLOCK_SIZE / 2, cy = cell.y + BLOCK_SIZE / 2;
        if (pointNearLine(cx, cy, lx, ly, lEndX, lEndY, 12)) {
          block.hp -= block.invulnerable ? 0.5 : 1;
          spawnExplosion(s, cx, cy, '#ff44ff', 3);
          if (block.hp <= 0) block.dead = true;
        }
      });
      // Also damage piled cells
      s.piledCells.forEach((cell, idx) => {
        const cx = cell.x + BLOCK_SIZE / 2, cy = cell.y + BLOCK_SIZE / 2;
        if (pointNearLine(cx, cy, lx, ly, lEndX, lEndY, 12)) {
          spawnExplosion(s, cx, cy, '#ff44ff', 3);
          s.piledCells.splice(idx, 1);
        }
      });
    });
    // Damage player if hit by sweep laser
    if (pointNearLine(p.x, p.y, lx, ly, lEndX, lEndY, 18)) {
      // handled externally via _sweepLaserActive flag
      e._sweepHitsPlayer = true;
    } else {
      e._sweepHitsPlayer = false;
    }
  }

  // Super laser: charge up for 3 seconds, then fire a massive beam straight down
  e._superLaserTimer = (e._superLaserTimer || 360) - 1;
  if (!e._superLaserCharging && !e._superLaserActive && e._superLaserTimer <= 0) {
    e._superLaserCharging = true;
    e._superLaserChargeTimer = 180; // 3s charge
    e._superLaserTimer = 600;       // next super in 10s
  }
  if (e._superLaserCharging) {
    e._superLaserChargeTimer--;
    if (e._superLaserChargeTimer <= 0) {
      e._superLaserCharging = false;
      e._superLaserActive = true;
      e._superLaserDuration = 120; // 2s beam
    }
  }
  if (e._superLaserActive) {
    e._superLaserDuration--;
    // Damage everything below boss
    if (e._laserDmgTimer <= 0) {
      const bx = e.x;
      // damage blocks under super laser
      s.blocks.forEach(block => {
        if (block.dead) return;
        getBlockCells(block).forEach(cell => {
          if (Math.abs(cell.x + BLOCK_SIZE / 2 - bx) < 20) {
            block.hp -= 2;
            spawnExplosion(s, cell.x + BLOCK_SIZE / 2, cell.y, '#ffffff', 4);
            if (block.hp <= 0) block.dead = true;
          }
        });
      });
      if (Math.abs(p.x - bx) < 22) e._superHitsPlayer = true;
      else e._superHitsPlayer = false;
    }
    if (e._superLaserDuration <= 0) {
      e._superLaserActive = false;
      e._superHitsPlayer = false;
    }
  }
}

// ─── Tier 4 (Wave 20): Multi-position photon guns + max bounce shot ───────────
export function updateBossTier4Fire(e, p, s, sounds, W, H, spawnExplosion) {
  // Fire photon orbs from 5 positions periodically
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

  // Max bounce shots — fired in a wide spread, bounce off walls
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
    // Cycle weapon every 3 shots
    e._shotCount = (e._shotCount || 0) + 1;
    if (e._shotCount >= 3) { e._shotCount = 0; e._weaponIdx++; }
    e._weaponTimer = 25;
  }

  // Charge attack at player every ~5 seconds
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

// ─── Homing bullet updater (called each frame for enemy bullets) ──────────────
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

// ─── Draw boss anchor ─────────────────────────────────────────────────────────
export function drawBossAnchor(ctx, e) {
  if (!e._anchorOut) return;
  ctx.save();
  // Chain
  ctx.strokeStyle = 'rgba(200,180,120,0.8)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e._anchorX, e._anchorY); ctx.stroke();
  ctx.setLineDash([]);
  // Anchor head
  ctx.fillStyle = e._anchorTarget ? '#ffdd00' : '#aaaacc';
  ctx.shadowColor = '#ffdd00'; ctx.shadowBlur = e._anchorTarget ? 20 : 8;
  ctx.save();
  ctx.translate(e._anchorX, e._anchorY);
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.shadowBlur = 0;
  ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, 8); ctx.stroke();
  ctx.beginPath(); ctx.arc(-8, 0, 5, Math.PI * 0.5, Math.PI * 1.5); ctx.stroke();
  ctx.beginPath(); ctx.arc(8, 0, 5, -Math.PI * 0.5, Math.PI * 0.5); ctx.stroke();
  ctx.restore();
  ctx.restore();
}

// ─── Draw tier 3 sweep laser ──────────────────────────────────────────────────
export function drawBossSweepLaser(ctx, e) {
  if (!e._sweepLaserEndX) return;
  ctx.save();
  ctx.shadowColor = '#ff44ff'; ctx.shadowBlur = 20;
  ctx.strokeStyle = 'rgba(255,68,255,0.7)'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e._sweepLaserEndX, e._sweepLaserEndY); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,200,255,0.9)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e._sweepLaserEndX, e._sweepLaserEndY); ctx.stroke();
  ctx.restore();
}

export function drawBossSuperLaser(ctx, e) {
  if (!e._superLaserCharging && !e._superLaserActive) return;
  ctx.save();
  if (e._superLaserCharging) {
    // Pulsing charge effect around boss
    const pct = 1 - (e._superLaserChargeTimer / 180);
    const radius = 20 + pct * 60;
    ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 40 * pct;
    ctx.strokeStyle = `rgba(255,255,255,${pct * 0.8})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(e.x, e.y, radius, 0, Math.PI * 2); ctx.stroke();
  } else if (e._superLaserActive) {
    // Massive white beam downward
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