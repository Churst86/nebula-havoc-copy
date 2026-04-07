import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UPGRADE_DEFS } from '../../lib/shopUpgrades';

const OZMA_GREETING = "Hi, I'm Ozma. I can exchange your blocks for upgrades!";
const OZMA_CHALLENGER = "Wow you're really something! The enemies will be much harder from here on out though. I've been working on something...";
const SHOPKEEPER_URL = 'https://raw.githubusercontent.com/Churst86/Sprites/main/Shopkeeper.png';

function UpgradeCard({ def, currentLevel, blockScore, onBuy }) {
  const maxed = currentLevel >= def.maxLevel;
  const cost = maxed ? 0 : def.cost(currentLevel);
  const canAfford = blockScore >= cost;

  return (
    <motion.div
      whileHover={!maxed ? { scale: 1.05 } : {}} className="p-2 rounded border flex flex-col gap-1"

      style={{
        background: 'rgba(5,10,25,0.82)',
        borderColor: maxed ? '#446633' : def.color + '99',
        boxShadow: maxed ? 'none' : `0 0 4px ${def.color}33`
      }}>
      
      <div className="flex items-center gap-1 flex-col">
        <span className="text-lg">{def.icon}</span>
        <div className="flex-1 min-w-0 text-center">
          <div className="font-bold text-white text-xs truncate">{def.name}</div>
          <div className="text-xs" style={{ color: def.color }}>Lv{currentLevel}/{def.maxLevel}</div>
        </div>
        {/* Level pips */}
        <div className="my-1 px-3 flex gap-0.5 flex-wrap justify-end max-w-16">
          {Array.from({ length: Math.min(def.maxLevel, 10) }).map((_, i) =>
          <div key={i} className="w-1.5 h-1.5 rounded-full"
          style={{ background: i < currentLevel ? def.color : '#1a2a3a' }} />
          )}
        </div>
      </div>
      <div className="text-xs text-gray-400 leading-tight line-clamp-2">{def.description(Math.max(currentLevel, 1))}</div>
      {maxed ?
      <div className="text-center text-xs font-bold text-green-400">✓</div> :

      <button
        onClick={() => canAfford && onBuy(def.id)}
        className="py-0.5 px-2 rounded text-xs font-bold transition-all"
        style={{
          background: canAfford ? def.color + 'dd' : '#1a2233',
          color: canAfford ? '#000' : '#888',
          cursor: canAfford ? 'pointer' : 'not-allowed',
          border: `1px solid ${canAfford ? def.color : '#334'}`,
          fontSize: '10px'
        }}>
        
          {cost}
        </button>
      }
    </motion.div>);

}

function WeaponTierCard({ id, label, color, level, onChange }) {
  const clamped = Math.max(0, Math.min(10, level || 0));
  return (
    <div
      className="p-2 rounded border flex flex-col gap-1"
      style={{
        background: 'rgba(5,10,25,0.82)',
        borderColor: color + '99',
        boxShadow: `0 0 4px ${color}33`
      }}
    >
      <div className="font-bold text-xs text-white truncate">{label}</div>
      <div className="text-xs" style={{ color }}>Lv{clamped}/10</div>
      <div className="my-1 flex gap-0.5 flex-wrap">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: i < clamped ? color : '#1a2a3a' }} />
        ))}
      </div>
      <div className="flex gap-1">
        <button
          onClick={() => onChange(id, clamped - 1)}
          className="flex-1 rounded border py-0.5 text-xs font-bold"
          style={{ borderColor: '#4b5563', color: '#d1d5db', background: 'rgba(17,24,39,0.75)' }}
        >
          -
        </button>
        <button
          onClick={() => onChange(id, clamped + 1)}
          className="flex-1 rounded border py-0.5 text-xs font-bold"
          style={{ borderColor: color, color: color, background: color + '22' }}
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function ShopScreen({ blockScore, shopUpgrades, onBuy, onReturn, nextWave, showWeaponEditor = false, weaponLevels = {}, onWeaponLevelChange, coreUpgradeLevels = {}, onCoreUpgradeLevelChange, shopTitle = 'OZMA', challengerMode = false }) {
  const [showDialogue, setShowDialogue] = useState(true);
  const [displayedText, setDisplayedText] = useState('');
  const weaponDefs = [
    { id: 'spread', label: 'Spread', color: '#ff9900' },
    { id: 'laser', label: 'Laser', color: '#ff2200' },
    { id: 'photon', label: 'Photon', color: '#44ffaa' },
    { id: 'bounce', label: 'Bounce', color: '#aaff00' },
    { id: 'missile', label: 'Missile', color: '#ff00ff' },
    { id: 'reverse', label: 'Reverse', color: '#cc44ff' },
  ];
  const coreUpgradeDefs = [
    { id: 'armor', label: 'Armor', color: '#4488ff' },
    { id: 'repair', label: 'Auto Repair', color: '#44ffaa' },
    { id: 'speed', label: 'Speed', color: '#ff8800' },
    { id: 'rapidfire', label: 'Rapid Fire', color: '#ff4488' },
    { id: 'shield', label: 'Shield', color: '#00ccff' },
    { id: 'wingman', label: 'Wingman', color: '#44aaff' },
    ...(challengerMode ? [
      { id: 'atkDmg', label: 'Attack Damage', color: '#ff44cc' },
      { id: 'atkSpd', label: 'Attack Speed', color: '#44e0ff' },
    ] : [])
  ];
  const classicShopDefs = UPGRADE_DEFS.filter(def => ['armor', 'repair', 'drone', 'harvester', 'atkDmg', 'atkSpd'].includes(def.id) ? challengerMode : ['armor', 'repair', 'drone', 'harvester'].includes(def.id));

  useEffect(() => {
    setDisplayedText('');
    let i = 0;
    const msg = challengerMode ? OZMA_CHALLENGER : OZMA_GREETING;
    const t = setInterval(() => {
      i++;
      setDisplayedText(msg.slice(0, i));
      if (i >= msg.length) {
        clearInterval(t);
        setTimeout(() => setShowDialogue(false), 2500);
      }
    }, 35);
    return () => clearInterval(t);
  }, [challengerMode]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 overflow-hidden">
      
      {/* Shopkeeper as full-screen background */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${SHOPKEEPER_URL})`,
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          imageRendering: 'pixelated'
        }} />
      
      {/* Dark overlay for readability */}
      <div className="absolute inset-0" style={{ background: 'rgba(2,6,18,0.68)' }} />

      {/* UI overlay */}
      <div className="relative z-10 flex flex-col h-full">

        {/* Header + Dialogue centered at top */}
        <div className="text-center pt-4 pb-1">
          <div className="text-xs tracking-[0.4em] uppercase text-cyan-500/60 font-mono">Space Station</div>
          <div className="text-xl font-black tracking-widest text-cyan-300" style={{ textShadow: '0 0 16px #00ccff' }}>
            {shopTitle}
          </div>
        </div>

        <div className="flex justify-center px-4 min-h-[44px]">
          <AnimatePresence>
            {showDialogue &&
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-lg border border-cyan-500/40 px-3 py-2 text-xs text-gray-200"
              style={{ background: 'rgba(0,30,60,0.85)' }}>
              <span className="text-cyan-400 font-bold">Ozma: </span>
              {displayedText}
              <span className="animate-pulse">▌</span>
            </motion.div>
            }
          </AnimatePresence>
        </div>

        {/* Block score centered */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="rounded-lg border border-orange-500/40 px-3 py-1.5 inline-flex items-center gap-2"
            style={{ background: 'rgba(0,0,0,0.6)' }}>
            <span className="text-xs text-orange-400/80 font-mono uppercase">Blocks</span>
            <span className="text-lg font-black text-orange-300">{blockScore.toLocaleString()}</span>
            <span className="text-xs text-orange-500/60">pts</span>
          </div>
        </div>

        {/* Main area: left cards | center (shopkeeper view) | right cards */}
        <div className="flex-1 flex flex-row items-center gap-1 md:gap-2 px-1 md:px-2 overflow-hidden">
          {/* Left column */}
          <div className="flex flex-col gap-1 md:gap-2 w-28 md:w-36 shrink-0 overflow-y-auto h-full py-1 md:py-2">
            {classicShopDefs.slice(0, Math.ceil(classicShopDefs.length / 2)).map((def) =>
              <UpgradeCard
                key={def.id}
                def={def}
                currentLevel={shopUpgrades[def.id] || 0}
                blockScore={blockScore}
                onBuy={onBuy} />
            )}
          </div>

          {/* Center: empty so shopkeeper is visible */}
          <div className="flex-1 px-1 md:px-3">
            {showWeaponEditor && (
              <div className="space-y-2 md:space-y-3">
                <div className="rounded-xl border border-fuchsia-500/35 p-2 md:p-3" style={{ background: 'rgba(18,10,30,0.65)' }}>
                  <div className="text-center text-[10px] md:text-xs uppercase tracking-[0.25em] text-fuchsia-300 mb-2">
                    Boss Test Weapons
                  </div>
                  <div className="grid grid-cols-2 gap-1 md:gap-2">
                    {weaponDefs.map(w => (
                      <WeaponTierCard
                        key={w.id}
                        id={w.id}
                        label={w.label}
                        color={w.color}
                        level={weaponLevels[w.id] || 0}
                        onChange={(id, nextLevel) => onWeaponLevelChange?.(id, nextLevel)}
                      />
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-cyan-500/30 p-2 md:p-3" style={{ background: 'rgba(8,18,30,0.62)' }}>
                  <div className="text-center text-[10px] md:text-xs uppercase tracking-[0.25em] text-cyan-300 mb-2">
                    Core Upgrades
                  </div>
                  <div className="grid grid-cols-2 gap-1 md:gap-2">
                    {coreUpgradeDefs.map(upgrade => (
                      <WeaponTierCard
                        key={upgrade.id}
                        id={upgrade.id}
                        label={upgrade.label}
                        color={upgrade.color}
                        level={coreUpgradeLevels[upgrade.id] || 0}
                        onChange={(id, nextLevel) => onCoreUpgradeLevelChange?.(id, nextLevel)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-1 md:gap-2 w-28 md:w-36 shrink-0 overflow-y-auto h-full py-1 md:py-2">
            {classicShopDefs.slice(Math.ceil(classicShopDefs.length / 2)).map((def) =>
              <UpgradeCard
                key={def.id}
                def={def}
                currentLevel={shopUpgrades[def.id] || 0}
                blockScore={blockScore}
                onBuy={onBuy} />
            )}
          </div>
        </div>

        {/* Return button */}
        <div className="px-4 md:px-6 pb-6 md:pb-8 pt-2 flex justify-center" style={{ marginBottom: '2vh' }}>
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            onClick={onReturn}
            className="px-6 md:px-10 py-2 md:py-2.5 rounded-xl font-black text-sm md:text-base tracking-wider"
            style={{
              background: 'rgba(0,40,80,0.8)',
              border: '2px solid #00ccff',
              color: '#00f0ff',
              textShadow: '0 0 10px #00ccff',
              boxShadow: '0 0 16px #00ccff33'
            }}>
            ▶ RETURN TO STAGE {nextWave}
          </motion.button>
        </div>
      </div>
    </motion.div>);

}