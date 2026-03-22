import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UPGRADE_DEFS } from '../../lib/shopUpgrades';

const OZMA_GREETING = "Hi, I'm Ozma. I can exchange your artifacts for upgrades!";
const SHOPKEEPER_URL = 'https://raw.githubusercontent.com/Churst86/Sprites/main/Shopkeeper.png';

function UpgradeCard({ def, currentLevel, blockScore, onBuy }) {
  const maxed = currentLevel >= def.maxLevel;
  const cost = maxed ? 0 : def.cost(currentLevel);
  const canAfford = blockScore >= cost;

  return (
    <motion.div
      whileHover={!maxed ? { scale: 1.05 } : {}} className="mt-3 mr-48 p-2 rounded border flex flex-col gap-1"

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
          color: canAfford ? '#000' : '#556',
          cursor: canAfford ? 'pointer' : 'not-allowed',
          border: `1px solid ${canAfford ? def.color : '#334'}`,
          fontSize: '10px'
        }}>
        
          {canAfford ? `${cost}` : '✕'}
        </button>
      }
    </motion.div>);

}

export default function ShopScreen({ blockScore, shopUpgrades, onBuy, onReturn, nextWave }) {
  const [showDialogue, setShowDialogue] = useState(true);
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    setDisplayedText('');
    let i = 0;
    const t = setInterval(() => {
      i++;
      setDisplayedText(OZMA_GREETING.slice(0, i));
      if (i >= OZMA_GREETING.length) {
        clearInterval(t);
        setTimeout(() => setShowDialogue(false), 2500);
      }
    }, 35);
    return () => clearInterval(t);
  }, []);

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

        {/* Header */}
        <div className="text-center pt-4 pb-1">
          <div className="text-xs tracking-[0.4em] uppercase text-cyan-500/60 font-mono">Space Station</div>
          <div className="text-xl font-black tracking-widest text-cyan-300" style={{ textShadow: '0 0 16px #00ccff' }}>
            OZMA
          </div>
        </div>

        {/* Dialogue bubble */}
        <div className="px-4 min-h-[44px]">
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

        {/* Artifacts balance */}
        <div className="px-4 pt-2 pb-1">
          <div className="rounded-lg border border-orange-500/40 px-3 py-1.5 inline-flex items-center gap-2"
          style={{ background: 'rgba(0,0,0,0.6)' }}>
            <span className="text-xs text-orange-400/80 font-mono uppercase">Blocks</span>
            <span className="text-lg font-black text-orange-300">{blockScore.toLocaleString()}</span>
            <span className="text-xs text-orange-500/60">pts</span>
          </div>
        </div>

        {/* Upgrade cards grid */}
        <div className="flex-1 overflow-y-auto px-4 pb-2">
          <div className="grid grid-cols-4 gap-1">
            {UPGRADE_DEFS.map((def) =>
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
        <div className="px-6 pb-5 pt-2 flex justify-center">
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            onClick={onReturn}
            className="px-10 py-2.5 rounded-xl font-black text-base tracking-wider"
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