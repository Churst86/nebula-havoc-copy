// Enemy spawner utilities — keeps spawnWave logic cleaner
import { HITBOX_SIZES } from './hitboxConfig.js';

export function spawnBerserk(enemies, W, wave, hpMult, isHell) {
  const berserkHp = Math.round((24 + wave * 4.5) * hpMult);
  
  enemies.push({
    type: 'berserk',
    x: Math.random() * (W - 160) + 80,
    y: -60,
    w: HITBOX_SIZES.berserk.w,
    h: HITBOX_SIZES.berserk.h,
    hp: berserkHp,
    maxHp: berserkHp,
    vx: Math.random() * 1 - 0.5,
    vy: 0.3 + wave * 0.03,
    fireTimer: 9999,
    _isHell: isHell,
  });
}

export function spawnEater(enemies, W, wave, hpMult) {
  const eaterHp = Math.round((11 + wave * 2.25) * hpMult); // reduced ~25%
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
  });
}