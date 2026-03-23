import React from 'react';
import { Heart, Zap, Shield, RefreshCw, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';

const GUN_POWERUPS = ['shotgun', 'laser', 'photon', 'bounce', 'missile', 'reverse'];
const POWERUP_COLORS = {
  shotgun:   '#ff6600',
  laser:     '#ff2200',
  photon:    '#44ffaa',
  wingman:   '#44aaff',
  bounce:    '#aaff00',
  speed:     '#ff8800',
  rapidfire: '#ff4488',
  missile:   '#ff00ff',
  reverse:   '#cc44ff',
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
  missile:   'MISSILE',
};
const POWERUP_ICONS = {
  shotgun:   '⚡',
  laser:     '║',
  photon:    '◉',
  bounce:    '◆',
  missile:   '→',
  wingman:   '◀',
  shield:    '⬟',
  speed:     '▶',
  rapidfire: '◇',
  reverse:   '↩',
};

const SHOP_COLORS = {
  armor:     '#4488ff',
  repair:    '#44ffaa',
  drone:     '#ffdd00',
  harvester: '#ff8800',
};
const SHOP_ICONS = {
  armor: '🛡', repair: '🔧', drone: '🤖', harvester: '⛏',
};

export default function GameHUD({ score, lives, maxLives, wave, activePowerup, continuesLeft, isPaused, onPauseToggle, onOpenOptions, blockScore, shopUpgrades, armorHp }) {
  const powerups = activePowerup || {};
  const shieldHp = powerups.shieldHp || 0;
  const starInvincible = powerups.starInvincible || false;
  const maxArmorHp = (shopUpgrades?.armor || 0) * 3;
  const gunKeys = GUN_POWERUPS.filter(k => (powerups[k] || 0) > 0);
  const utilityKeys = ['speed', 'rapidfire', 'wingman', 'shield'].filter(k => (powerups[k] || 0) > 0);
  const shopKeys = shopUpgrades ? Object.entries(shopUpgrades).filter(([, v]) => v > 0) : [];

  return (
    <div className="absolute inset-0 z-20 pointer-events-none">
      {/* Wave + Shield + Star — center top */}
      <div className="flex flex-col items-center gap-1 pt-2 md:pt-4">
        <div className="text-xs md:text-sm font-bold uppercase tracking-[0.3em] text-muted-foreground">
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
        </div>
      </div>

      {/* Score — bottom-left */}
      <div className="absolute bottom-3 md:bottom-6 left-3 md:left-6 flex flex-col gap-1">
        <div className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 rounded-lg" style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(4px)', border: '1px solid rgba(0,240,255,0.4)' }}>
          <Zap className="w-3 h-3 md:w-5 md:h-5 text-primary fill-primary" />
          <span className="text-base md:text-2xl font-black text-white tracking-wider tabular-nums">
            {score.toLocaleString()}
          </span>
        </div>
        {blockScore > 0 && (
          <div className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-0.5 md:py-1 rounded-lg" style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(4px)', border: '1px solid rgba(100,200,255,0.35)' }}>
            <span className="text-xs font-bold text-cyan-400">BLOCKS</span>
            <span className="text-xs md:text-sm font-black text-cyan-300 tabular-nums">{blockScore.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Gun Upgrades — top-left */}
      {gunKeys.length > 0 && (
        <div className="absolute top-2 md:top-6 left-2 md:left-6 flex flex-col gap-0.5 md:gap-1" style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.8))' }}>
          {gunKeys.map(key => {
            const tier = powerups[key] || 1;
            const color = POWERUP_COLORS[key];
            const icon = POWERUP_ICONS[key] || '◉';
            return (
              <div key={key}
                className="font-bold px-2 md:px-3 py-0.5 md:py-1 rounded-full"
                style={{ color, border: `1px solid ${color}`, background: `${color}44`, fontSize: '10px' }}>
                {icon} {POWERUP_LABELS[key]} Lv{tier}
              </div>
            );
          })}
        </div>
      )}

      {/* Utility Upgrades — top-right */}
      {utilityKeys.length > 0 && (
        <div className="absolute top-2 md:top-6 right-2 md:right-6 flex flex-col gap-0.5 md:gap-1 items-end" style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.8))' }}>
          {utilityKeys.map(key => {
            const tier = powerups[key] || 1;
            const color = POWERUP_COLORS[key];
            const isSuper = key === 'wingman' && tier >= 5;
            const label = isSuper ? 'S.WINGMAN' : POWERUP_LABELS[key];
            const icon = POWERUP_ICONS[key] || '◉';
            return (
              <div key={key}
                className="font-bold px-2 md:px-3 py-0.5 md:py-1 rounded-full"
                style={{ color, border: `1px solid ${color}`, background: `${color}44`, fontSize: '10px' }}>
                {icon} {label} Lv{tier}
              </div>
            );
          })}
        </div>
      )}

      {/* Lives + Continues — bottom-right */}
      <div className="absolute bottom-3 md:bottom-6 right-3 md:right-6 flex flex-col items-end gap-1 md:gap-2">
        {/* Armor bar above hearts */}
        {maxArmorHp > 0 && (
          <div className="w-full px-1" style={{ minWidth: 90 }}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="font-bold" style={{ color: '#4488ff', fontSize: '9px' }}>🛡 ARMOR</span>
              <span className="font-bold" style={{ color: '#4488ff', fontSize: '9px' }}>{armorHp}/{maxArmorHp}</span>
            </div>
            <div className="rounded-full overflow-hidden" style={{ height: 4, background: 'rgba(0,0,0,0.5)', border: '1px solid #4488ff44' }}>
              <div className="h-full rounded-full transition-all duration-200"
                style={{ width: `${maxArmorHp > 0 ? (armorHp / maxArmorHp) * 100 : 0}%`, background: armorHp > maxArmorHp * 0.5 ? '#4488ff' : armorHp > maxArmorHp * 0.25 ? '#ffaa44' : '#ff4444', boxShadow: '0 0 6px #4488ff' }} />
            </div>
          </div>
        )}
        <div className="flex items-center gap-1 flex-wrap justify-end max-w-32 md:max-w-40 px-2 md:px-3 py-1 md:py-1.5 rounded-lg" style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,80,80,0.4)' }}>
          {Array.from({ length: maxLives || 3 }).map((_, i) => (
            <Heart key={i}
              className={`w-3 h-3 md:w-5 md:h-5 transition-all duration-300 ${
                i < lives ? 'text-red-500 fill-red-500 scale-100' : 'text-gray-700 fill-gray-700 scale-75 opacity-40'
              }`}
            />
          ))}
        </div>
        {continuesLeft > 0 && (
          <div className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 md:py-2 rounded-lg"
            style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(4px)', border: '1px solid rgba(0,240,255,0.5)', color: '#00f0ff' }}>
            <RefreshCw className="w-3 h-3 md:w-4 md:h-4" />
            <span className="text-xs md:text-base font-black tracking-wider">{continuesLeft}× CONT</span>
          </div>
        )}
      </div>

      {/* Shop upgrades — bottom-right above armor/lives (only show during gameplay) */}
      {shopKeys.length > 0 && (
        <div className="absolute bottom-24 md:bottom-32 right-3 md:right-6 flex flex-col gap-0.5 md:gap-1 items-end" style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.8))' }}>
          {shopKeys.map(([key, lvl]) => (
            <div key={key} className="font-bold px-1.5 md:px-2 py-0.5 rounded-full"
              style={{ color: SHOP_COLORS[key], border: `1px solid ${SHOP_COLORS[key]}`, background: `${SHOP_COLORS[key]}55`, fontSize: '9px' }}>
              {SHOP_ICONS[key]} {key.toUpperCase()} Lv{lvl}
            </div>
          ))}
        </div>
      )}

      {/* Pause button — top-center on mobile, bottom-center on desktop */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 md:top-auto md:bottom-6 pointer-events-auto">
        <Button
          size="icon"
          variant="ghost"
          onClick={onPauseToggle}
          className="text-primary hover:bg-primary/10 w-9 h-9 md:w-12 md:h-12"
          title="Pause / Options [Enter]"
        >
          {isPaused ? <Play className="w-4 h-4 md:w-6 md:h-6" /> : <Pause className="w-4 h-4 md:w-6 md:h-6" />}
        </Button>
      </div>
    </div>
  );
}