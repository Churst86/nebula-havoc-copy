// Hitbox sizes matched to sprite rendering dimensions
export const HITBOX_SIZES = {
  // Bosses (drawn at 440px)
  boss: { w: 90, h: 90 },
  
  // Regular enemies (drawn at 169px)
  basicEnemy: { w: 50, h: 50 },
  elite: { w: 50, h: 50 },
  
  // Specialized enemies
  glutton: { w: 94, h: 94 },      // sprite drawn at 94px, grows with absorption
  eater: { w: 85, h: 85 },        // drawn at 270px
  mine: { w: 56, h: 56 },         // drawn at 108px
  dropper: { w: 60, h: 60 },      // drawn at 120px body
  
  // Player
  player: { w: 60, h: 60 },       // drawn at 169px, but kept responsive
  
  // Powerups (drawn at 48px icons)
  powerup: { w: 36, h: 36 },
};