// Reverse gun firing integration patch - apply these changes to GameCanvas
// This file documents the changes needed:

// 1. Add to imports:
// import { fireReverseShot, drawReverseFlame } from '../../lib/reverseGunUtils.js';
// import { DROPPER_COLORS, DROPPER_LABELS, DROPPER_ROTATION } from '../../lib/powerupConfig.js';

// 2. In initState(), add:
// reverseFireTimer: 0,

// 3. After fireSpreadShot function, add reverse firing to player fire loop (around line 979):
//     // Reverse shotgun timer
//     if ((s.powerups.reverse || 0) > 0) {
//       s.reverseFireTimer--;
//       if (s.reverseFireTimer <= 0) {
//         fireReverseShot(s);
//         const reverseTier = s.powerups.reverse || 0;
//         const rapidfireBonus = (s.powerups.rapidfire || 0) === 1 ? 10 : (s.powerups.rapidfire || 0) * 8;
//         const baseDelay = Math.max(12, 55 - (reverseTier > 3 ? (reverseTier - 3) * 3 : 0) - rapidfireBonus);
//         s.reverseFireTimer = baseDelay;
//       }
//     }

// 4. In drawBullet function, add reverse bullet rendering:
//     } else if (b.type === 'reverse') {
//       ctx.shadowColor = '#ff6600'; ctx.shadowBlur = 10;
//       ctx.fillStyle = '#ff6600';
//       ctx.fillRect(b.x - 1.5, b.y - 7, 3, 14);
//       ctx.fillStyle = '#ffaa00';
//       ctx.fillRect(b.x - 0.75, b.y - 5, 1.5, 10);

// 5. In powerup pickup logic (line 1680), add:
//     } else if (item.type === 'reverse') {
//       s.powerups.reverse = Math.min((s.powerups.reverse || 0) + 1, 10);
//       sounds.powerup();

// 6. In block collision (line 1620), change photon references and add tier 10 reverse invul destruction:
//       if (block.invulnerable) {
//         if (b.type === 'reverse' && (s.powerups.reverse || 0) >= 10) {
//           block.dead = true;
//           s.score += 50; onScoreChange(s.score);
//           spawnExplosion(s, block.x + BLOCK_SIZE, block.y, '#00bbff', 12);
//         } else {
//           b.hit = true;
//           spawnExplosion(s, b.x, b.y, '#aaaacc', 3);
//         }
//         return;
//       }

// 7. Change all photon references consistently throughout the file

// 8. After drawPlayer call (line 1849), add:
//     const reverseTier = s.powerups.reverse || 0;
//     if (reverseTier >= 10) {
//       drawReverseFlame(ctx, p, reverseTier, Date.now());
//     }

export default {};