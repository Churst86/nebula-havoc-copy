// Boss movement pattern utilities — player-tracking and distance management

/**
 * Player-Tracking Movement: Boss maintains and follows player's vertical position
 * to keep the player on one side of the screen, with gradual Y-axis mirroring.
 * 
 * @param {Object} boss - Boss entity with x, y, tier properties
 * @param {Object} player - Player entity with x, y properties
 * @param {number} H - Screen height
 */
export function applyPlayerTracking(boss, player, H) {
  const bt = boss.tier || 1;
  
  // Define vertical bounds for boss movement based on tier
  const yMin = H * 0.08;
  const yMax = bt >= 3 ? H * 0.42 : H * 0.38;
  
  // Smoothly track player's Y position (mirror player vertically)
  const trackStrength = 0.015 + bt * 0.003; // Higher tiers track faster
  const targetY = Math.max(yMin, Math.min(yMax, player.y * 0.6 + boss.y * 0.4));
  boss.y += (targetY - boss.y) * trackStrength;
}

/**
 * Distance Management: Boss maintains a minimum distance from the player
 * and retreats if the player gets too close to allow bullet patterns to spread.
 * 
 * @param {Object} boss - Boss entity
 * @param {Object} player - Player entity
 * @param {number} W - Screen width
 * @param {number} preferredDistance - Target distance to maintain (pixels)
 */
export function applyDistanceManagement(boss, player, W, preferredDistance = 200) {
  const dx = player.x - boss.x;
  const dy = player.y - boss.y;
  const distance = Math.hypot(dx, dy);
  
  // If player is too close, push boss away to maintain distance
  if (distance < preferredDistance && distance > 0) {
    const pushStrength = 0.02;
    const angle = Math.atan2(dy, dx);
    boss.x -= Math.cos(angle) * pushStrength * (preferredDistance - distance);
    boss.y -= Math.sin(angle) * pushStrength * (preferredDistance - distance);
    
    // Clamp to bounds
    const margin = W * 0.18;
    boss.x = Math.max(margin, Math.min(W - margin, boss.x));
  }
}