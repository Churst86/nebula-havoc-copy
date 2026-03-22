// Boss-block collision prevention — blocks pass through bosses (except tier 4 corsair who collects them)
export function checkBossBlockPassthrough(block, s) {
  // Tier 4 (Corsair) collects blocks — don't skip
  const corsair = s.enemies.find(e => e.type === 'boss' && (e.tier || 1) === 4);
  if (corsair) return false; // Allow normal block collection
  
  // Other bosses: check if block is close to any non-corsair boss
  const otherBosses = s.enemies.filter(e => e.type === 'boss' && (e.tier || 1) !== 4);
  for (const boss of otherBosses) {
    if (Math.hypot(boss.x - block.x, boss.y - block.y) < 120) {
      return true; // Block passes through, skip settling logic
    }
  }
  return false;
}