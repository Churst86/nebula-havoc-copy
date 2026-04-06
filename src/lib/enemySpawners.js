// Enemy spawner utilities — keeps spawnWave logic cleaner
import { HITBOX_SIZES } from './hitboxConfig.js';

export function spawnGlutton(enemies, W, wave, hpMult, isHell) {
  const gluttonHp = Math.round((24 + wave * 4.5) * hpMult);
  
  enemies.push({
    type: 'glutton',
    x: Math.random() * (W - 160) + 80,
    y: -60,
    w: HITBOX_SIZES.glutton.w,
    h: HITBOX_SIZES.glutton.h,
    hp: gluttonHp,
    maxHp: gluttonHp,
    vx: Math.random() * 1 - 0.5,
    vy: 0.3 + wave * 0.03,
    fireTimer: 9999,
    _isHell: isHell,
    _gluttonRole: 'head',
    _gluttonSegmentGap: 56,
    _gluttonGrowthMeter: 0,
    _segmentCount: 0,
    _maxSegments: isHell ? 7 : 5,
    _angle: Math.PI / 2,
  });
}

export function spawnEater(enemies, W, wave, hpMult) {
  const eaterHp = Math.round((15 + wave * 2.8) * hpMult);
  enemies.push({
    type: 'eater',
    x: Math.random() * (W - 160) + 80,
    y: -60,
    w: HITBOX_SIZES.eater.w,
    h: HITBOX_SIZES.eater.h,
    hp: eaterHp,
    maxHp: eaterHp,
    _spawnHp: eaterHp, // used for mini eater HP calculation
    vx: Math.random() * 1.2 - 0.6,
    vy: 0.25 + wave * 0.02,
    fireTimer: 9999,
    _chargePlayerTimer: 0,
    _growthStage: 1,
    _growthMeter: 0,
    _blocksEaten: 0,
    _offspringCount: 0,
    _offspringCap: 2,
    _lineageDepth: 0,
    _spawnCooldown: 0,
    _passiveRoamPhase: Math.random() * Math.PI * 2,
  });
}