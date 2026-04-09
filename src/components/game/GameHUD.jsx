import React from 'react';
import { Heart, Zap, Shield, RefreshCw, Pause, Play, FastForward } from 'lucide-react';
import { Button } from '@/components/ui/button';

const GUN_POWERUPS = ['spread', 'laser', 'photon', 'bounce', 'missile', 'reverse'];
const POWERUP_COLORS = {
  spread:    '#ff9900',
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
  spread:    'SPREAD',
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
  spread:    '⚡',
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

export default function GameHUD({ score, lives, maxLives, wave, liveFps = 0, activePowerup, continuesLeft, isPaused, onPauseToggle, onOpenOptions, blockScore, shopUpgrades, armorHp, autoFireEnabled = true, lastSaveAt, speedMultiplier = 1, speedControlsUnlocked = false, onSpeedMultiplierChange, boss, targetEnemy, aimMode }) {
  const [showSaveFlash, setShowSaveFlash] = React.useState(false);
  const [saveFlashLabel, setSaveFlashLabel] = React.useState('AUTOSAVED');
  const powerups = activePowerup || {};
  const shieldHp = powerups.shieldHp || 0;
  const starInvincible = powerups.starInvincible || false;
  const maxArmorHp = (shopUpgrades?.armor || 0) * 3;
  const gunKeys = GUN_POWERUPS.filter(k => (powerups[k] || 0) > 0);
  const utilityKeys = ['speed', 'rapidfire', 'wingman', 'shield'].filter(k => (powerups[k] || 0) > 0);
  const shopKeys = shopUpgrades ? Object.entries(shopUpgrades).filter(([, v]) => v > 0) : [];

  React.useEffect(() => {
    if (!lastSaveAt) return;
    const stamp = new Date(lastSaveAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setSaveFlashLabel(`AUTOSAVED ${stamp}`);
    setShowSaveFlash(true);
    const id = window.setTimeout(() => setShowSaveFlash(false), 1400);
    return () => window.clearTimeout(id);
  }, [lastSaveAt]);

  // Stylized boss HP bar (always visible if boss exists)
  const renderBossBar = () => {
    if (!boss) return null;
    const percent = boss.hp / boss.maxHp;
    const color = '#ff0066';
    return (
      <div className="absolute left-1/2 top-4 -translate-x-1/2 z-30 flex flex-col items-center" style={{ minWidth: 260, maxWidth: 420 }}>
        <div className="flex items-center gap-2 mb-1.5">
          <span style={{ fontSize: 22, color, filter: 'drop-shadow(0 0 6px #000)' }}>☠️</span>
          <span className="font-black tracking-widest text-lg md:text-2xl" style={{ color, textShadow: '0 2px 8px #000, 0 0 2px #fff' }}>
            {boss.name ? boss.name.toUpperCase() : (boss.label || 'BOSS').toUpperCase()}
          </span>
          <span style={{ fontSize: 22, color, filter: 'drop-shadow(0 0 6px #000)' }}>☠️</span>
        </div>
        <div className="relative w-full h-6 rounded-lg overflow-hidden border-2 border-pink-700 bg-[#1a1a2e]" style={{ boxShadow: '0 0 16px #ff0066cc' }}>
          <div className="absolute left-0 top-0 h-full rounded-lg transition-all duration-300" style={{ width: `${Math.max(0, Math.min(1, percent)) * 100}%`, background: 'linear-gradient(90deg, #ff0066 60%, #ff4400 100%)', boxShadow: '0 0 12px #ff0066' }} />
          <div className="absolute left-0 top-0 w-full h-full flex items-center justify-center">
            <span className="font-bold text-xs md:text-base text-white drop-shadow" style={{ letterSpacing: 2 }}>{Math.ceil(boss.hp)}/{Math.ceil(boss.maxHp)} HP</span>
          </div>
        </div>
      </div>
    );
  };

  // Targeted enemy HP bar (face-target mode only, only if no boss)
  const renderTargetEnemyBar = () => {
    if (boss) return null;
    if (!aimMode || !targetEnemy) return null;
    const percent = targetEnemy.hp / targetEnemy.maxHp;
    return (
      <div className="absolute left-1/2 top-4 z-25 -translate-x-1/2 flex flex-col items-center" style={{ minWidth: 180, maxWidth: 320 }}>
        <div className="font-bold text-xs md:text-base tracking-widest mb-1 text-yellow-900 drop-shadow" style={{ textShadow: '0 1px 4px #fff' }}>
          {targetEnemy.name ? targetEnemy.name.toUpperCase() : (targetEnemy.label || 'ENEMY').toUpperCase()}
        </div>
        <div className="relative w-full h-5 rounded-md overflow-hidden border border-yellow-400 bg-[#fffbe6]" style={{ boxShadow: '0 0 8px #ffe06688' }}>
          <div className="absolute left-0 top-0 h-full rounded-md transition-all duration-200" style={{ width: `${Math.max(0, Math.min(1, percent)) * 100}%`, background: 'linear-gradient(90deg, #ffe066 60%, #ffbb00 100%)', boxShadow: '0 0 6px #ffe066' }} />
          <div className="absolute left-0 top-0 w-full h-full flex items-center justify-center">
            <span className="font-bold text-[11px] md:text-sm text-yellow-900" style={{ letterSpacing: 1, textShadow: '0 1px 4px #fff' }}>{Math.ceil(targetEnemy.hp)}/{Math.ceil(targetEnemy.maxHp)} HP</span>
          </div>
        </div>
      </div>
    );
  };

  // Only render one HP bar at the top: boss takes precedence
  return (
    <div className="absolute inset-0 z-20 pointer-events-none">
      {boss ? renderBossBar() : renderTargetEnemyBar()}
      {/* Stack: Boss bar (if any), enemy bar (if any), wave, then powerups/fps row */}
      <div className="flex flex-col items-center gap-0 pt-24 md:pt-28">
        {/* Wave counter right below enemy HP bar */}
        <div className="text-xs md:text-sm font-bold uppercase tracking-[0.3em] text-muted-foreground mt-1 mb-1">
          Wave {wave}
        </div>
        {/* Powerups/FPS/Status row, tightly stacked, deduplicated, no overlap */}
        {(() => {
          // Defensive: only render each status badge once
          const statusBadges = [];
          let rendered = { fps: false, autofire: false, invincible: false, shield: false };
          if (!rendered.fps) {
            statusBadges.push(
              <div key="fps" className="text-xs font-bold px-2 py-0.5 rounded-full min-w-[70px] flex-shrink-0 text-center"
                style={{ color: '#8ad4ff', border: '1px solid #3a6fa3', background: '#11253b99' }}>
                FPS {liveFps || 0}
              </div>
            );
            rendered.fps = true;
          }
          if (!rendered.autofire) {
            statusBadges.push(
              <div key="autofire" className="text-xs font-bold px-2 py-0.5 rounded-full min-w-[90px] flex-shrink-0 text-center"
                style={{
                  color: autoFireEnabled ? '#00f0ff' : '#ffc14d',
                  border: `1px solid ${autoFireEnabled ? '#00f0ff' : '#ffc14d'}`,
                  background: autoFireEnabled ? '#00f0ff22' : '#ffc14d22',
                }}>
                AUTO FIRE {autoFireEnabled ? 'ON' : 'OFF'}
              </div>
            );
            rendered.autofire = true;
          }
          if (starInvincible && !rendered.invincible) {
            statusBadges.push(
              <div key="invincible" className="text-xs font-bold px-2 py-0.5 rounded-full min-w-[90px] flex-shrink-0 text-center animate-pulse"
                style={{ color: '#fff', border: '1px solid #fff', background: 'rgba(255,255,255,0.15)' }}>
                ★ INVINCIBLE
              </div>
            );
            rendered.invincible = true;
          }
          if (shieldHp > 0 && !rendered.shield) {
            statusBadges.push(
              <div key="shield" className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full min-w-[70px] flex-shrink-0 text-center"
                style={{ color: '#00ccff', border: '1px solid #00ccff', background: '#00ccff22' }}>
                <Shield className="w-3 h-3" />
                {shieldHp <= 5 ? '●'.repeat(shieldHp) : `×${shieldHp}`}
              </div>
            );
            rendered.shield = true;
          }
          return (
            <div className="flex flex-wrap justify-center gap-2 mb-0.5">
              {statusBadges}
            </div>
          );
        })()}
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
        {showSaveFlash && (
          <div className="px-2 md:px-3 py-0.5 md:py-1 rounded-lg animate-pulse" style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(4px)', border: '1px solid rgba(120,255,170,0.5)' }}>
            <span className="text-[10px] md:text-xs font-bold tracking-wide text-emerald-300">{saveFlashLabel}</span>
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

      {/* Pause button — desktop only, bottom-center */}
      <div className="absolute bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 pointer-events-auto">
        {speedControlsUnlocked && (
          <div className="flex items-center gap-1 rounded-xl border border-amber-400/40 bg-black/70 px-2 py-2 backdrop-blur-sm">
            <div className="flex items-center gap-1 px-1.5 text-[10px] font-black tracking-[0.24em] text-amber-200">
              <FastForward className="h-3.5 w-3.5" />
              SPEED
            </div>
            {[1, 2, 3].map((multiplier) => {
              const active = speedMultiplier === multiplier;
              return (
                <button
                  key={multiplier}
                  type="button"
                  onClick={() => onSpeedMultiplierChange?.(multiplier)}
                  className="min-w-10 rounded-md border px-2 py-1 text-xs font-black tracking-wide transition-all"
                  style={{
                    color: active ? '#081018' : '#ffd47a',
                    borderColor: active ? '#ffd47a' : '#7c5d1a',
                    background: active ? '#ffd47a' : 'transparent',
                  }}
                  title={`Set HUD speed boost to x${multiplier}`}
                >
                  x{multiplier}
                </button>
              );
            })}
          </div>
        )}

        <Button
          size="icon"
          variant="ghost"
          onClick={onPauseToggle}
          className="hidden md:inline-flex text-primary hover:bg-primary/10 w-12 h-12"
          title="Pause / Options [Enter]"
        >
          {isPaused ? <Play className="w-6 h-6" /> : <Pause className="w-6 h-6" />}
        </Button>
      </div>
    </div>
  );
}