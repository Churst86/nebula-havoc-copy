// Powerup drop categories for droppers
export const GUN_POWERUPS = ['shotgun', 'laser', 'photon', 'bounce', 'missile'];
export const UTILITY_POWERUPS = ['speed', 'rapidfire', 'wingman', 'shield'];

// Alternating rotation: guns on even rotations, utilities on odd
export function getNextDropperType(s) {
  const rotationIdx = s.dropperRotationIdx || 0;
  const isGunRotation = rotationIdx % 2 === 0;
  const pool = isGunRotation ? GUN_POWERUPS : UTILITY_POWERUPS;
  
  // Find first non-maxed powerup in the pool
  for (let i = 0; i < pool.length; i++) {
    const t = pool[(rotationIdx / 2 + i) % pool.length];
    if ((s.powerups[t] || 0) < 10) {
      s.dropperRotationIdx = rotationIdx + 1;
      return t;
    }
  }
  
  // All maxed, return first in pool
  s.dropperRotationIdx = rotationIdx + 1;
  return pool[0];
}