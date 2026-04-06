// Enemy spawner utilities — keeps spawnWave logic cleaner
import { HITBOX_SIZES } from './hitboxConfig.js';

export function spawnGlutton(enemies, W, wave, hpMult, isHell) {
  const gluttonHp = Math.round((24 + wave * 4.5) * hpMult);
  const spawnX = Math.random() * (W - 160) + 80;
  const spawnY = -60;
  const spawnAngle = Math.PI / 2;
  const spawnGap = 88;
  const trailDx = Math.cos(spawnAngle);
  const trailDy = Math.sin(spawnAngle);
  const starterSegmentHp = Math.max(18, Math.round(gluttonHp * 0.32));
  
  enemies.push({
    type: 'glutton',
    x: spawnX,
    y: spawnY,
    w: HITBOX_SIZES.glutton.w,
    h: HITBOX_SIZES.glutton.h,
    hp: gluttonHp,
    maxHp: gluttonHp,
    vx: Math.random() * 1 - 0.5,
    vy: 0.3 + wave * 0.03,
    fireTimer: 9999,
    _isHell: isHell,
    _gluttonRole: 'head',
    _gluttonSegmentGap: spawnGap,
    _gluttonGrowthMeter: 0,
    _segmentCount: 1,
    _segmentHp: [starterSegmentHp],
    _maxSegments: isHell ? 34 : 24,
    _angle: spawnAngle,
    _trailPoints: [
      { x: spawnX, y: spawnY, angle: spawnAngle },
      { x: spawnX - trailDx * spawnGap, y: spawnY - trailDy * spawnGap, angle: spawnAngle },
      { x: spawnX - trailDx * spawnGap * 2, y: spawnY - trailDy * spawnGap * 2, angle: spawnAngle },
    ],
  });
}

export function spawnEater(enemies, W, wave, hpMult) {
  const eaterHp = Math.round((15 + wave * 2.8) * hpMult);
  const miniScale = 0.54;
  const miniRatio = hpMult >= 10 ? 0.95 : hpMult >= 5 ? 0.88 : 0.78;
  const miniHpFloor = hpMult >= 5 ? 10 : 8;
  const miniHp = Math.max(miniHpFloor, Math.round(eaterHp * miniRatio));
  enemies.push({
    type: 'eater',
    x: Math.random() * (W - 160) + 80,
    y: -60,
    w: Math.round(HITBOX_SIZES.eater.w * miniScale),
    h: Math.round(HITBOX_SIZES.eater.h * miniScale),
    hp: miniHp,
    maxHp: eaterHp,
    _spawnHp: eaterHp, // used for mini eater HP calculation
    vx: Math.random() * 1.2 - 0.6,
    vy: 0.25 + wave * 0.02,
    fireTimer: 9999,
    _chargePlayerTimer: 0,
    _mini: true,
    _growthStage: 0,
    _growthMeter: 0,
    _blocksEaten: 0,
    _offspringCount: 0,
    _offspringCap: 2,
    _lineageDepth: 0,
    _spawnCooldown: 0,
    _passiveRoamPhase: Math.random() * Math.PI * 2,
  });
}