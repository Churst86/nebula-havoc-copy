import React from 'react';
import { Heart, Zap, Shield } from 'lucide-react';

const POWERUP_COLORS = {
  spread:  '#ffdd00',
  laser:   '#ff44ff',
  raygun:  '#44ffaa',
  wingman: '#44aaff',
  bounce:  '#aaff00',
  speed:   '#ff8800',
};
const POWERUP_LABELS = {
  spread:  'SPREAD',
  laser:   'LASER',
  raygun:  'RAY GUN',
  wingman: 'WINGMAN',
  bounce:  'BOUNCE',
  speed:   'SPEED',
};

export default function GameHUD({ score, lives, maxLives, wave, activePowerup }) {
  const powerups = activePowerup || {};
  const shieldHp = powerups.shieldHp || 0;
  const activePowerupKeys = Object.keys(POWERUP_LABELS).filter(k => (powerups[k] || 0) > 0);

  return (
    <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none">
      <div className="flex items-center justify-between px-6 py-4">

        {/* Score */}
        <div className="flex items-center gap-3">
          <Zap className="w-5 h-5 text-primary fill-primary" />
          <span className="text-2xl font-black text-white tracking-wider tabular-nums">
            {score.toLocaleString()}
          </span>
        </div>

        {/* Wave + Power-ups */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="text-sm font-bold uppercase tracking-[0.3em] text-muted-foreground">
            Wave {wave}
          </div>
          <div className="flex flex-wrap justify-center gap-1">
            {/* Shield indicator */}
            {shieldHp > 0 && (
              <div className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ color: '#00ccff', border: '1px solid #00ccff', background: '#00ccff22' }}>
                <Shield className="w-3 h-3" />
                {'●'.repeat(shieldHp)}
              </div>
            )}
            {/* Power-up badges */}
            {activePowerupKeys.map(key => {
              const tier = powerups[key] || 1;
              const color = POWERUP_COLORS[key];
              return (
                <div key={key}
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ color, border: `1px solid ${color}`, background: `${color}22` }}>
                  ⚡ {POWERUP_LABELS[key]}{tier > 1 ? ` ${'★'.repeat(tier)}` : ''}
                </div>
              );
            })}
          </div>
        </div>

        {/* Lives */}
        <div className="flex items-center gap-1.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Heart key={i}
              className={`w-5 h-5 transition-all duration-300 ${
                i < lives ? 'text-red-500 fill-red-500 scale-100' : 'text-gray-700 fill-gray-700 scale-75 opacity-40'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}