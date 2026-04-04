// Gun powerup firing logic
import { fireMissiles, updateMissiles } from '../missileUtils.js';
import { acquireBullet } from '../bulletPool.js';

export function fireSpreadShot(s) {
  const p = s.player;
  const shotgunTier = s.powerups.shotgun || 0;
  if (shotgunTier === 0) return;
  if (s.spreadReloadTimer > 0) return;
  if (s.spreadShotsLeft <= 0) return;
  const pelletCount = shotgunTier === 1 ? 7 : shotgunTier === 2 ? 9 : 11;
  const spreadDeg = shotgunTier === 1 ? 50 : shotgunTier === 2 ? 100 : 150;
  const extraShots = Math.floor((shotgunTier - 1) / 3);
  acquireBullet(s, { x: p.x, y: p.y - 18, vx: 0, vy: -10, type: 'spread', spreadTier: shotgunTier, pelletCount, spreadDeg, armed: false }, 'player');
  for (let i = 0; i < extraShots; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    acquireBullet(s, { x: p.x + side * 12, y: p.y - 18, vx: side * 2, vy: -10, type: 'spread', spreadTier: shotgunTier, pelletCount, spreadDeg, armed: false }, 'player');
  }
  s.spreadShotsLeft--;
  if (s.spreadShotsLeft <= 0) s.spreadReloadTimer = 80;
}

export function updateGunPowerups(s, keys) {
  const spreadFireTimer = s.spreadFireTimer || 0;
  if ((s.powerups.shotgun || 0) > 0 && spreadFireTimer <= 0) {
    fireSpreadShot(s);
    const shotgunTier = s.powerups.shotgun || 0;
    const rapidfireBonus = (s.powerups.rapidfire || 0) === 1 ? 10 : (s.powerups.rapidfire || 0) * 8;
    s.spreadFireTimer = Math.max(15, 65 - shotgunTier * 4 - rapidfireBonus);
  }
  if ((s.powerups.missile || 0) > 0) {
    updateMissiles(s.bullets, s.enemies);
  }
}

export function getFireRate(pw) {
  const speedBonus = (pw.rapidfire || 0) === 1 ? 10 : (pw.rapidfire || 0) * 8;
  if ((pw.photon || 0) > 0) return Math.max(14, 50 - (pw.photon || 0) * 4 - speedBonus);
  if ((pw.shotgun || 0) > 0 && (pw.bounce || 0) === 0) return Math.max(12, 50 - speedBonus);
  if ((pw.bounce || 0) > 0) return Math.max(10, 35 - speedBonus);
  return Math.max(10, 35 - speedBonus);
}