// Utility powerup logic
export function applyUtilityPowerup(item, s, p, onPowerupChange, sounds) {
  if (item.type === 'star') {
    s.starInvincibleTimer = 420; // 7 seconds at 60fps
    sounds.powerup();
  } else if (item.type === 'shield') {
    s.shieldHp = Math.min(s.shieldHp + 1, 10);
    sounds.shield();
  } else if (item.type === 'speed') {
    s.powerups.speed = Math.min((s.powerups.speed || 0) + 1, 10);
    sounds.powerup();
  } else if (item.type === 'rapidfire') {
    s.powerups.rapidfire = Math.min((s.powerups.rapidfire || 0) + 1, 10);
    sounds.powerup();
  } else if (item.type === 'wingman') {
    s.powerups.wingman = Math.min((s.powerups.wingman || 0) + 1, 10);
    sounds.powerup();
  }
  onPowerupChange({ ...s.powerups, shieldHp: s.shieldHp, starInvincible: s.starInvincibleTimer > 0 });
}

export function updateUtilityTimers(s, sounds) {
  if (s.shieldHp > 0 && s.shieldHp <= 0) {
    sounds.shieldBreak();
    delete s.powerups.shield;
  }
}