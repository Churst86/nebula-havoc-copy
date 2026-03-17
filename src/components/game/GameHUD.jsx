import React from 'react';
import { Heart, Zap } from 'lucide-react';

const POWERUP_COLORS = {
  spread:  '#ffdd00',
  laser:   '#ff44ff',
  raygun:  '#44ffaa',
  wingman: '#44aaff',
};
const POWERUP_LABELS = {
  spread:  'SPREAD',
  laser:   'LASER',
  raygun:  'RAY GUN',
  wingman: 'WINGMAN',
};

export default function GameHUD({ score, lives, wave, activePowerup }) {
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

        {/* Wave */}
        <div className="text-sm font-bold uppercase tracking-[0.3em] text-muted-foreground">
          Wave {wave}
        </div>

        {/* Lives */}
        <div className="flex items-center gap-1.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Heart
              key={i}
              className={`w-5 h-5 transition-all duration-300 ${
                i < lives
                  ? 'text-red-500 fill-red-500 scale-100'
                  : 'text-gray-700 fill-gray-700 scale-75 opacity-40'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}