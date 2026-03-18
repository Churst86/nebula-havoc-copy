import React from 'react';
import { Heart, Zap, Shield, RefreshCw, Pause, Play, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

const GUN_POWERUPS = ['shotgun', 'laser', 'bounce'];
const POWERUP_COLORS = {
  shotgun:   '#ffdd00',
  laser:     '#ff44ff',
  photon:    '#44ffaa',
  wingman:   '#44aaff',
  bounce:    '#aaff00',
  speed:     '#ff8800',
  rapidfire: '#ff4488',
  reverse:   '#ff6600',
};
const POWERUP_LABELS = {
  shotgun:   'SHOTGUN',
  laser:     'LASER',
  photon:    'PHOTON',
  wingman:   'WINGMAN',
  bounce:    'BOUNCE',
  speed:     'SPEED',
  rapidfire: 'RAPID FIRE',
  reverse:   'REVERSE',
};

export default function GameHUD({ score, lives, maxLives, wave, activePowerup, continuesLeft, isPaused, onPauseToggle, onOpenOptions }) {
  const powerups = activePowerup || {};
  const shieldHp = powerups.shieldHp || 0;
  const starInvincible = powerups.starInvincible || false;
  const gunKeys = GUN_POWERUPS.filter(k => (powerups[k] || 0) > 0);
  const otherKeys = Object.keys(POWERUP_LABELS).filter(k => !GUN_POWERUPS.includes(k) && (powerups[k] || 0) > 0);

  return (
    <div className="absolute inset-0 z-20 pointer-events-none">
      {/* Top bar: Score | Wave+Powerups | Lives */}
      <div className="flex items-start justify-between px-6 py-4">

        {/* Score */}
        <div className="flex items-center gap-3">
          <Zap className="w-5 h-5 text-primary fill-primary" />
          <span className="text-2xl font-black text-white tracking-wider tabular-nums">
            {score.toLocaleString()}
          </span>
        </div>

        {/* Wave + Shield + Star */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="text-sm font-bold uppercase tracking-[0.3em] text-muted-foreground">
            Wave {wave}
          </div>
          <div className="flex flex-wrap justify-center gap-1">
            {starInvincible && (
              <div className="text-xs font-bold px-2 py-0.5 rounded-full animate-pulse"
                style={{ color: '#fff', border: '1px solid #fff', background: 'rgba(255,255,255,0.15)' }}>
                ★ INVINCIBLE
              </div>
            )}
            {shieldHp > 0 && (
              <div className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ color: '#00ccff', border: '1px solid #00ccff', background: '#00ccff22' }}>
                <Shield className="w-3 h-3" />
                {shieldHp <= 5 ? '●'.repeat(shieldHp) : `×${shieldHp}`}
              </div>
            )}
            {otherKeys.map(key => {
              const tier = powerups[key] || 1;
              const color = POWERUP_COLORS[key];
              const isSuper = key === 'wingman' && tier >= 5;
              const label = isSuper ? 'SUPER WINGMAN' : POWERUP_LABELS[key];
              const tierLabel = tier > 1 ? ` Lv${tier}` : '';
              return (
                <div key={key}
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ color, border: `1px solid ${color}`, background: `${color}22` }}>
                  ⚡ {label}{tierLabel}
                </div>
              );
            })}
          </div>
        </div>

        {/* Lives + Continues */}
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5 flex-wrap justify-end max-w-36">
            {Array.from({ length: maxLives || 3 }).map((_, i) => (
              <Heart key={i}
                className={`w-5 h-5 transition-all duration-300 ${
                  i < lives ? 'text-red-500 fill-red-500 scale-100' : 'text-gray-700 fill-gray-700 scale-75 opacity-40'
                }`}
              />
            ))}
          </div>
          {continuesLeft > 0 && (
            <div className="flex items-center gap-1 text-xs font-bold"
              style={{ color: '#00f0ff' }}>
              <RefreshCw className="w-3 h-3" />
              <span>{continuesLeft}×</span>
            </div>
          )}
        </div>
      </div>

      {/* Gun Upgrades — bottom-left */}
      {gunKeys.length > 0 && (
        <div className="absolute bottom-6 left-6 flex flex-col gap-1">
          {gunKeys.map(key => {
            const tier = powerups[key] || 1;
            const color = POWERUP_COLORS[key];
            return (
              <div key={key}
                className="text-xs font-bold px-3 py-1 rounded-full"
                style={{ color, border: `1px solid ${color}`, background: `${color}22` }}>
                🔫 {POWERUP_LABELS[key]} Lv{tier}
              </div>
            );
          })}
        </div>
      )}

      {/* Pause + Options buttons — bottom-right */}
      <div className="absolute bottom-6 right-6 pointer-events-auto flex gap-2">
        {isPaused && (
          <Button
            size="icon"
            variant="ghost"
            onClick={onOpenOptions}
            className="text-muted-foreground hover:bg-white/10 w-12 h-12"
            title="Options"
          >
            <Settings className="w-5 h-5" />
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          onClick={onPauseToggle}
          className="text-primary hover:bg-primary/10 w-12 h-12"
          title="Pause [Enter]"
        >
          {isPaused ? <Play className="w-6 h-6" /> : <Pause className="w-6 h-6" />}
        </Button>
      </div>
    </div>
  );
}