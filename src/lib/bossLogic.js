// Boss behavior logic — all boss-specific AI, firing patterns, and special weapons
import { applyPlayerTracking, applyDistanceManagement } from './bossMovementPatterns.js';

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
export function updateBossMovement(e, W, H, p) {
  const bt = e.tier || 1;
  const entryY = bt >= 3 ? H * 0.20 : H * 0.14;

  // Slide in from top on first entry
  if (e.y < entryY) {
    e.y += Math.min((entryY - e.y) * 0.05 + 1.2, 10);
    e.x += (W / 2 - e.x) * 0.06;
    return;
  }

  // Handle charge dash (tier 5 uses this)
  if (e._charging) {
    e.x += e._chargeDx * 5;
    e.y += e._chargeDy * 5;
    e._chargeDuration = (e._chargeDuration || 0) - 1;
    if (e._chargeDuration <= 0) { e._charging = false; e._chargeTimer = 180; }
    if (e.x < 60) { e.x = 60; e._chargeDx = Math.abs(e._chargeDx); }
    if (e.x > W - 60) { e.x = W - 60; e._chargeDx = -Math.abs(e._chargeDx); }
    if (e.y < 30) { e.y = 30; e._chargeDy = Math.abs(e._chargeDy); }
    if (e.y > H * 0.55) { e.y = H * 0.55; e._chargeDy = -Math.abs(e._chargeDy); e._charging = false; e._chargeTimer = 180; }
    return;
  }

  // Pick a new random roam target periodically
  const roamInterval = bt >= 4 ? 120 : bt >= 3 ? 150 : 180;
  // Initialize timer to a positive value to avoid instant jump on first frame
  if (e._roamTimer === undefined) {
    e._roamTimer = roamInterval;
    e._roamTargetX = e.x;
    e._roamTargetY = e.y;
  }
  e._roamTimer--;
  if (e._roamTimer <= 0) {
    const margin = W * 0.18;
    const yMin = H * 0.08;
    const yMax = bt >= 3 ? H * 0.42 : H * 0.38;
    e._roamTargetX = margin + Math.random() * (W - margin * 2);
    e._roamTargetY = yMin + Math.random() * (yMax - yMin);
    e._roamTimer = roamInterval + Math.floor(Math.random() * 60);
  }

  // Smooth lerp toward roam target — increased speed for fluid motion
  const lerpSpeed = 0.045 + bt * 0.005;
  e.x += ((e._roamTargetX || W / 2) - e.x) * lerpSpeed;
  e.y += ((e._roamTargetY || entryY) - e.y) * lerpSpeed;

  // Apply new movement patterns with player tracking and distance management
  if (p) {
    applyPlayerTracking(e, p, H);
    applyDistanceManagement(e, p, W, 180 + bt * 20); // Higher tiers maintain more distance
  }
}

// ─── Tier 1 (Wave 5): Single aimed shots fired quickly + occasional homing missiles ──
export function updateBossTier1Fire(e, p, s, sounds) {
  e.fireTimer--;
  if (e.fireTimer <= 0) {
    const dx = p.x - e.x, dy = p.y - e.y;
    const baseAngle = Math.atan2(dy, dx);
    // Single aimed shot with a tiny random spread
    const a = baseAngle + (Math.random() - 0.5) * 0.15;
    s.enemyBullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 5.5, vy: Math.sin(a) * 5.5, boss: true });
    e.fireTimer = 18;
  }

  e._specialTimer = (e._specialTimer || 90) - 1;
  if (e._specialTimer <= 0) {
    // Fire 3 homing missiles from back, they circle and home in
    for (let i = 0; i < 3; i++) {
      const backOffset = (i - 1) * 25;
      s.enemyBullets.push({
        x: e.x + backOffset, y: e.y + 30, // Fire from back side
        vx: 0, vy: 2,
        boss: true, big: true,
        tier1Missile: true,
        circlePhase: 0,
        circleRadius: 80 + i * 20,
        circleSpeed: 0.06,
        target: p,
        homingDelay: 120, // circle for 120 frames before homing
        homingStrength: 0.08,
      });
    }
    sounds && sounds.hit && sounds.hit();
    e._specialTimer = 90;
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
    e._omniTimer = 65;
    e._omniCooldown = 20;
  }

  e._specialTimer = (e._specialTimer || 180) - 1;
  if (e._specialTimer <= 0) {
    s.enemyBullets.push({
      x: e.x, y: e.y,
      vx: (p.x - e.x) / Math.max(Math.hypot(p.x - e.x, p.y - e.y), 1) * 3,
      vy: (p.y - e.y) / Math.max(Math.hypot(p.x - e.x, p.y - e.y), 1) * 3,
      boss: true, big: true,
      homing: true, target: p,
      homingStrength: 0.12,
    });
    e._specialTimer = 180;
  }
}

// ─── Tier 3 (Wave 15): Eye sweep lasers targeting player + super laser ──────
// Timeline (cumulative frames at 60fps):
//   0s  — Laser 1 starts cycling every 3s (180f): 60f charge → 120f active sweep
//   9s  — Laser 2 joins, also cycling every 3s
//   15s — Super laser starts cycling every 9s (540f): 90f charge → 90f active
//
// Each sweep laser fires from the boss eye toward the player's position at the
// moment it charges, then sweeps in a slow arc across the screen.
export function updateBossTier3Fire(e, p, s, W, H, spawnExplosion, sounds, onScoreChange, BLOCK_SIZE, getBlockCells) {
  const LASER_LEN = Math.max(W, H) * 1.6;
  const BOSS_RADIUS = 30; // eye is close to boss center

  // Global elapsed counter
  e._t3Elapsed = (e._t3Elapsed || 0) + 1;
  const elapsed = e._t3Elapsed;

  // ── Helper: fire one sweep laser (L1 or L2) ──
  function tickSweepLaser(idx) {
    // Each laser has its own state object
    const key = `_sweep${idx}`;
    if (!e[key]) e[key] = { state: 'cooldown', timer: idx === 1 ? 60 : 0 }; // L2 starts immediately when unlocked
    const ls = e[key];

    ls.timer--;

    if (ls.state === 'cooldown') {
      if (ls.timer <= 0) {
        // Aim toward player's CURRENT position at charge time
        const dx = p.x - e.x, dy = p.y - e.y;
        ls.angle = Math.atan2(dy, dx);
        ls.sweepDir = Math.random() < 0.5 ? 1 : -1;
        ls.state = 'charging';
        ls.timer = 60; // 1s charge
      }
    } else if (ls.state === 'charging') {
      if (ls.timer <= 0) {
        ls.state = 'active';
        ls.timer = 120; // 2s active sweep
      }
    } else if (ls.state === 'active') {
      // Sweep angle toward player, rotating outward slowly
      ls.angle += ls.sweepDir * 0.018;

      const sx = e.x + Math.cos(ls.angle) * BOSS_RADIUS;
      const sy = e.y + Math.sin(ls.angle) * BOSS_RADIUS;
      const ex2 = e.x + Math.cos(ls.angle) * LASER_LEN;
      const ey2 = e.y + Math.sin(ls.angle) * LASER_LEN;

      // Store draw coords
      ls.startX = sx; ls.startY = sy;
      ls.endX = ex2; ls.endY = ey2;

      // Damage check every 6 frames
      ls.dmgTimer = (ls.dmgTimer || 0) - 1;
      if (ls.dmgTimer <= 0) {
        ls.dmgTimer = 6;
        s.blocks.forEach(block => {
          if (block.dead || block.invulnerable) return;
          getBlockCells(block).forEach(cell => {
            const cx = cell.x + BLOCK_SIZE / 2, cy = cell.y + BLOCK_SIZE / 2;
            if (pointNearLine(cx, cy, sx, sy, ex2, ey2, 14)) {
              block.hp -= 1;
              spawnExplosion(s, cx, cy, '#ff44ff', 2);
              if (block.hp <= 0) block.dead = true;
            }
          });
        });
        ls.hitsPlayer = pointNearLine(p.x, p.y, sx, sy, ex2, ey2, 16);
      }

      // Propagate player hit to top-level flag
      if (idx === 1) e._sweepHitsPlayer = ls.hitsPlayer || false;
      else e._sweepHitsPlayer = e._sweepHitsPlayer || ls.hitsPlayer || false;

      if (ls.timer <= 0) {
        ls.state = 'cooldown';
        ls.timer = 120; // 2s cooldown before next shot (total cycle ~5s)
        ls.startX = undefined;
        ls.hitsPlayer = false;
        if (idx === 1) e._sweepHitsPlayer = false;
      }
    }
  }

  // ── Laser 1: always active from the start ──
  tickSweepLaser(1);

  // ── Laser 2: unlocks after 9 seconds (540f) ──
  if (elapsed >= 540) tickSweepLaser(2);

  // Expose draw data for drawBossSweepLaser
  const l1 = e._sweep1;
  const l2 = e._sweep2;
  e._sweepLaserStartX  = l1 && l1.startX !== undefined ? l1.startX : undefined;
  e._sweepLaserStartY  = l1 && l1.startY !== undefined ? l1.startY : undefined;
  e._sweepLaserEndX    = l1 && l1.endX !== undefined ? l1.endX : undefined;
  e._sweepLaserEndY    = l1 && l1.endY !== undefined ? l1.endY : undefined;
  e._sweepLaserStartX2 = l2 && l2.startX !== undefined ? l2.startX : undefined;
  e._sweepLaserStartY2 = l2 && l2.startY !== undefined ? l2.startY : undefined;
  e._sweepLaserEndX2   = l2 && l2.endX !== undefined ? l2.endX : undefined;
  e._sweepLaserEndY2   = l2 && l2.endY !== undefined ? l2.endY : undefined;

  // Expose charging state for drawBossSweepLaser
  e._sweepState = (l1 && l1.state === 'charging') || (l2 && l2.state === 'charging') ? 'charging' : 'active';
  e._sweepCharging1 = l1 && l1.state === 'charging' ? l1.angle : undefined;
  e._sweepCharging2 = l2 && l2.state === 'charging' ? l2.angle : undefined;

  // ── Super laser: unlocks after 15 seconds (900f), fires every 9s (540f) ──
  if (elapsed >= 900) {
    e._superLaserTimer = (e._superLaserTimer || 1) - 1;
    if (!e._superLaserCharging && !e._superLaserActive && e._superLaserTimer <= 0) {
      e._superLaserCharging = true;
      e._superLaserChargeTimer = 90;
      e._superLaserTargetX = p.x; // aim at player position when charging starts
      e._superLaserTimer = 540;
    }
  }
  if (e._superLaserCharging) {
    e._superLaserChargeTimer--;
    if (e._superLaserChargeTimer <= 0) {
      e._superLaserCharging = false;
      e._superLaserActive = true;
      e._superLaserDuration = 90;
      e._superLaserDmgTimer = 0;
    }
  }
  if (e._superLaserActive) {
    e._superLaserDuration--;
    e._superLaserDmgTimer = (e._superLaserDmgTimer || 0) - 1;
    if (e._superLaserDmgTimer <= 0) {
      e._superLaserDmgTimer = 6;
      const bx = e._superLaserTargetX || e.x;
      s.blocks.forEach(block => {
        if (block.dead) return;
        getBlockCells(block).forEach(cell => {
          if (Math.abs(cell.x + BLOCK_SIZE / 2 - bx) < 22) {
            block.hp -= 2;
            spawnExplosion(s, cell.x + BLOCK_SIZE / 2, cell.y, '#ffffff', 3);
            if (block.hp <= 0) block.dead = true;
          }
        });
      });
      e._superHitsPlayer = Math.abs(p.x - bx) < 24;
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

// ─── Tier 4 (Wave 20): Dreadnought - corner-to-corner movement + ring shots ───────────
export function updateBossTier4Fire(e, p, s, sounds, W, H, spawnExplosion) {
  // Initialize dreadnought movement state
  if (!e._dreadnoughtInit) {
    e._dreadnoughtInit = true;
    e._dreadnoughtPhase = 'entry'; // entry → moving → corner
    e._cornerIndex = 0;
    e._ringFireTimer = 0;
    e._stage2Triggered = false;
  }

  const hpThreshold = e.maxHp / 3;
  const isStage2 = e.hp <= hpThreshold && !e._stage2Triggered;
  if (isStage2) {
    e._stage2Triggered = true;
    e._stage2Timer = 0;
  }

  // ── Movement: after entry, move to corners diagonally ──
  if (e._dreadnoughtPhase === 'entry') {
    if (e.y >= H * 0.20) {
      e._dreadnoughtPhase = 'moving';
      e._moveStartTime = 0;
      e._cornerSequence = [0, 2, 1, 3]; // top-left, bottom-right, top-right, bottom-left
    }
  }

  if (e._dreadnoughtPhase === 'moving') {
    // Define corners
    const corners = [
      { x: W * 0.15, y: H * 0.12 },  // top-left
      { x: W * 0.85, y: H * 0.12 },  // top-right
      { x: W * 0.85, y: H * 0.42 },  // bottom-right
      { x: W * 0.15, y: H * 0.42 },  // bottom-left
    ];

    const cornerIdx = e._cornerSequence[e._cornerIndex % 4];
    const targetCorner = corners[cornerIdx];

    const dx = targetCorner.x - e.x;
    const dy = targetCorner.y - e.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 8) {
      const spd = isStage2 ? 4.5 : 3.5; // faster in stage 2
      e.x += (dx / dist) * spd;
      e.y += (dy / dist) * spd;
    } else {
      // Reached corner, move to next
      e._cornerIndex++;
      e._moveStartTime = 0;
    }
  }

  // ── Firing: ring shot every 4 seconds (240 frames) ──
  e._ringFireTimer--;
  if (e._ringFireTimer <= 0) {
    const RING_SHOTS = 12;
    const fireInterval = isStage2 ? 240 : 240; // same base, but we'll vary by stage elsewhere
    for (let i = 0; i < RING_SHOTS; i++) {
      const angle = (i / RING_SHOTS) * Math.PI * 2;
      s.enemyBullets.push({
        x: e.x, y: e.y,
        vx: Math.cos(angle) * 4, vy: Math.sin(angle) * 4,
        boss: true, big: true,
        dreadnoughtGreen: true,
      });
    }
    e._ringFireTimer = isStage2 ? 180 : 240;
    sounds && sounds.hit && sounds.hit();
  }

  // ── Stage 2: flash effect and increased difficulty ──
  if (e._stage2Triggered) {
    e._stage2Timer++;
    e._flashIntensity = Math.floor(e._stage2Timer / 6) % 2; // flash every 6 frames
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
    e._weaponTimer = 16;
  }

  e._chargeTimer = (e._chargeTimer || 200) - 1;
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

// ─── Draw tier 3 sweep lasers ─────────────────────────────────────────────────
export function drawBossSweepLaser(ctx, e) {
  ctx.save();

  // Draw charging indicators
  [
    { angle: e._sweepCharging1, color: '#ff44ff' },
    { angle: e._sweepCharging2, color: '#cc44ff' },
  ].forEach(({ angle, color }) => {
    if (angle === undefined) return;
    const sx = e.x + Math.cos(angle) * 30;
    const sy = e.y + Math.sin(angle) * 30;
    const pulse = 0.5 + Math.sin(Date.now() * 0.015) * 0.5;
    ctx.shadowColor = color; ctx.shadowBlur = 20 * pulse;
    ctx.strokeStyle = color.replace(')', `,${pulse * 0.9})`).replace('rgb', 'rgba').replace('#ff44ff', 'rgba(255,68,255,').replace('#cc44ff', 'rgba(200,68,255,') + ')';
    ctx.strokeStyle = color;
    ctx.lineWidth = 3 + pulse * 4;
    ctx.beginPath(); ctx.arc(sx, sy, 8 + pulse * 16, 0, Math.PI * 2); ctx.stroke();
  });

  // Draw active laser 1
  if (e._sweepLaserEndX !== undefined) {
    const sx1 = e._sweepLaserStartX ?? e.x;
    const sy1 = e._sweepLaserStartY ?? e.y;
    ctx.shadowColor = '#ff44ff'; ctx.shadowBlur = 24;
    ctx.strokeStyle = 'rgba(255,68,255,0.75)'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(sx1, sy1); ctx.lineTo(e._sweepLaserEndX, e._sweepLaserEndY); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,210,255,0.95)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(sx1, sy1); ctx.lineTo(e._sweepLaserEndX, e._sweepLaserEndY); ctx.stroke();
  }

  // Draw active laser 2
  if (e._sweepLaserEndX2 !== undefined) {
    const sx2 = e._sweepLaserStartX2 ?? e.x;
    const sy2 = e._sweepLaserStartY2 ?? e.y;
    ctx.shadowColor = '#cc44ff'; ctx.shadowBlur = 24;
    ctx.strokeStyle = 'rgba(200,68,255,0.75)'; ctx.lineWidth = 8;
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