// Boss HUD rendering — HP bar at top of screen with boss name
export function drawBossHUD(ctx, W, bossEnemy) {
  if (!bossEnemy) return;

  const bossNames = ['Dreadnought', 'Sentinel', 'Beholder', 'Corsair', 'Leviathan'];
  const bossName = bossNames[Math.min((bossEnemy.tier || 1) - 1, 4)];
  const bw = 400, bh = 14, bx = W / 2 - bw / 2, by = 20;
  const bossBarColor = ['#ff0066', '#ff6600', '#aa00ff', '#00ccff'][Math.min((bossEnemy.tier || 1) - 1, 3)];

  // Boss name above bar
  ctx.fillStyle = bossBarColor;
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(bossName.toUpperCase(), W / 2, by - 4);

  // HP bar
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = bossBarColor;
  ctx.fillRect(bx, by, bw * (bossEnemy.hp / bossEnemy.maxHp), bh);
  ctx.strokeStyle = bossBarColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(bx, by, bw, bh);
}