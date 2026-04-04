// Block settling and collision logic
export function updateBlockSettling(s, H, BLOCK_SIZE, getBlockCells) {
  s.blocks.forEach(block => {
    if (block.settled) return;
    block.y += block.vy;
    
    // Skip settling if block passes through a non-corsair boss
    const corsair = s.enemies.find(e => e.type === 'boss' && (e.tier || 1) === 4);
    if (!corsair) {
      const otherBoss = s.enemies.find(e => e.type === 'boss' && (e.tier || 1) !== 4 && Math.hypot(e.x - block.x, e.y - block.y) < 120);
      if (otherBoss) return; // Block passes through
    }
    
    const cells = getBlockCells(block);
    let shouldSettle = false;
    cells.forEach(cell => {
      if (cell.y + BLOCK_SIZE >= H) { shouldSettle = true; }
      s.piledCells.forEach(pc => {
        if (Math.abs(cell.x - pc.x) < BLOCK_SIZE * 0.8 && Math.abs((cell.y + BLOCK_SIZE) - pc.y) < 4) shouldSettle = true;
      });
    });
    if (shouldSettle) {
      block.settled = true;
      cells.forEach(cell => {
        const snappedY = Math.min(Math.round(cell.y / BLOCK_SIZE) * BLOCK_SIZE, H - BLOCK_SIZE);
        s.piledCells.push({ x: Math.round(cell.x / BLOCK_SIZE) * BLOCK_SIZE, y: snappedY, color: block.color });
      });
    }
  });
  s.blocks = s.blocks.filter(b => !b.settled);

  if (s.piledCells.length > 200) s.piledCells = s.piledCells.slice(-200);
  s.piledCells = s.piledCells.filter(c => c.y < H);
}