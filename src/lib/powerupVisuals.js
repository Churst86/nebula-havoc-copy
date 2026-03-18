// Powerup visual rendering with distinct identifiers
export const POWERUP_ICONS = {
  shotgun: '⚡', // Lightning bolt
  laser: '║', // Vertical line
  photon: '◉', // Filled circle
  bounce: '◆', // Diamond
  missile: '→', // Arrow
  wingman: '◀', // Triangle
  shield: '⬟', // Hexagon
  speed: '▶', // Play button
  rapidfire: '◇', // Open diamond
  star: '★', // Star
};

export function drawPowerupItem(ctx, item) {
  const colors = { 
    shotgun: '#ffdd00', laser: '#ff44ff', photon: '#44ffaa', wingman: '#44aaff', 
    shield: '#00ccff', bounce: '#aaff00', speed: '#ff8800', rapidfire: '#ff4488', 
    missile: '#ff00ff', star: '#ffffff' 
  };
  
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.rotate(item.angle || 0);

  if (item.type === 'star') {
    const hue = (Date.now() * 0.2) % 360;
    const c1 = `hsl(${hue},100%,70%)`;
    ctx.shadowColor = c1; ctx.shadowBlur = 22;
    ctx.strokeStyle = c1; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = c1 + '33'; ctx.fill();
    ctx.fillStyle = c1;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('★', 0, 1);
  } else {
    const c = colors[item.type] || '#fff';
    ctx.shadowColor = c; ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fillStyle = c + '33'; ctx.fill();
    ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.strokeStyle = c + '88'; ctx.lineWidth = 1; ctx.stroke();
    
    // Icon/identifier
    ctx.fillStyle = c;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(POWERUP_ICONS[item.type] || item.type[0].toUpperCase(), 0, 0);
  }
  ctx.restore();
}