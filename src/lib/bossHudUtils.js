// Boss HUD rendering — HP bars at top of screen for one or multiple bosses
const BOSS_NAMES = ['Fang', 'Dreadnought', 'Beholder', 'Pirate', 'Xelgnark'];
const BOSS_BAR_COLORS = ['#ff0066', '#ff6600', '#aa00ff', '#00ccff', '#ff4400'];

function getBossName(boss) {
  const baseName = BOSS_NAMES[Math.min((boss.tier || 1) - 1, 4)];
  if (boss._variantProfile) {
    return `${baseName} ${boss._variantProfile.label}`;
  }
  return baseName;
}

function getBossColor(boss) {
  if (boss._variantProfile) return boss._variantProfile.hudColor;
  return BOSS_BAR_COLORS[Math.min((boss.tier || 1) - 1, 4)];
}

export function drawBossHUD(ctx, W, bossEnemyOrList) {
  // Accept either a single boss or an array
  const bosses = Array.isArray(bossEnemyOrList) ? bossEnemyOrList : [bossEnemyOrList];
  if (!bosses.length) return;

  const barW = Math.min(380, (W - 20) / bosses.length - 10);
  const totalWidth = bosses.length * (barW + 8) - 8;
  let startX = W / 2 - totalWidth / 2;
  const by = 20;
  const bh = 14;

  bosses.forEach((boss, i) => {
    const bx = startX + i * (barW + 8);
    const color = getBossColor(boss);
    const name = getBossName(boss);

    // Boss name above bar
    ctx.fillStyle = color;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(name.toUpperCase(), bx + barW / 2, by - 4);

    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(bx, by, barW, bh);

    // HP fill
    ctx.fillStyle = color;
    ctx.fillRect(bx, by, barW * (boss.hp / boss.maxHp), bh);

    // Border
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, barW, bh);
  });
}