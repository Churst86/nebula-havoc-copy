// Bullet pooling utilities for player and enemy projectiles.
// Aim: reduce per-frame allocations while preserving existing game logic.

const DEFAULT_PLAYER_POOL_SIZE = 256;
const DEFAULT_ENEMY_POOL_SIZE = 256;

export function initBulletPool(s, config = {}) {
  const playerSize = config.player || DEFAULT_PLAYER_POOL_SIZE;
  const enemySize = config.enemy || DEFAULT_ENEMY_POOL_SIZE;

  s.bullets = s.bullets || [];
  s.enemyBullets = s.enemyBullets || [];
  s._bulletPool = s._bulletPool || { player: [], enemy: [] };

  while (s._bulletPool.player.length < playerSize) {
    s._bulletPool.player.push({ active: false, type: 'player', x: 0, y: 0, vx: 0, vy: 0 });
  }
  while (s._bulletPool.enemy.length < enemySize) {
    s._bulletPool.enemy.push({ active: false, type: 'enemy', x: 0, y: 0, vx: 0, vy: 0 });
  }
}

function resetBullet(b, props) {
  Object.keys(b).forEach(k => { b[k] = undefined; });
  Object.assign(b, props, { active: true });
  return b;
}

export function acquireBullet(s, props = {}, target = 'player') {
  if (!s._bulletPool || !s._bulletPool.player) {
    initBulletPool(s);
  }

  const pool = target === 'enemy' ? s._bulletPool.enemy : s._bulletPool.player;
  const fallbackType = target === 'enemy' ? 'enemy' : 'normal';
  const nextProps = { ...props, owner: target, type: props.type || fallbackType };
  let b = pool.pop();
  if (!b) {
    b = { active: true, ...nextProps };
  } else {
    resetBullet(b, nextProps);
  }

  const list = target === 'enemy' ? s.enemyBullets : s.bullets;
  list.push(b);
  return b;
}

export function releaseBullet(s, b) {
  if (!b || !b.active) return;
  b.active = false;

  const isEnemy = s.enemyBullets && s.enemyBullets.indexOf(b) !== -1;
  const list = isEnemy ? s.enemyBullets : s.bullets;
  const pool = isEnemy ? s._bulletPool?.enemy : s._bulletPool?.player;

  if (list) {
    const idx = list.indexOf(b);
    if (idx !== -1) list.splice(idx, 1);
  }

  if (pool) {
    // Keep last used state as a template for next reuse
    pool.push(b);
  }
}

export function cleanDeadBullets(s) {
  if (!s || !s._bulletPool) return;

  function cleanup(list, pool) {
    for (let i = list.length - 1; i >= 0; --i) {
      const b = list[i];
      if (!b.active) {
        list.splice(i, 1);
        pool && pool.push(b);
      }
    }
  }
  cleanup(s.bullets, s._bulletPool.player);
  cleanup(s.enemyBullets, s._bulletPool.enemy);
}
