import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UPGRADE_DEFS } from '../../lib/shopUpgrades';

const OZMA_GREETING = "Hi, I'm Ozma. I can take your artifacts and exchange them for upgrades! Just let me know what you want.";

// Draw Ozma NPC (no sprite in repo — drawn NPC)
function OzmaPortrait() {
  return (
    <svg width="120" height="140" viewBox="0 0 120 140" className="drop-shadow-lg">
      {/* Body */}
      <ellipse cx="60" cy="110" rx="30" ry="28" fill="#1a2a4a" stroke="#44aaff" strokeWidth="2"/>
      {/* Suit details */}
      <rect x="45" y="95" width="30" height="20" rx="4" fill="#223355" stroke="#3366aa" strokeWidth="1"/>
      <rect x="54" y="98" width="12" height="14" rx="2" fill="#00ccff44" stroke="#00ccff" strokeWidth="1"/>
      {/* Neck */}
      <rect x="54" y="78" width="12" height="16" rx="4" fill="#f4c88a"/>
      {/* Head */}
      <ellipse cx="60" cy="65" rx="22" ry="24" fill="#f4c88a" stroke="#e8a870" strokeWidth="1.5"/>
      {/* Helmet ring */}
      <ellipse cx="60" cy="50" rx="24" ry="8" fill="none" stroke="#44aaff" strokeWidth="2" opacity="0.6"/>
      {/* Eyes */}
      <ellipse cx="52" cy="62" rx="4" ry="5" fill="#fff"/>
      <ellipse cx="68" cy="62" rx="4" ry="5" fill="#fff"/>
      <ellipse cx="53" cy="63" rx="2.5" ry="3" fill="#1a4a8a"/>
      <ellipse cx="69" cy="63" rx="2.5" ry="3" fill="#1a4a8a"/>
      <circle cx="54" cy="62" r="1" fill="#fff"/>
      <circle cx="70" cy="62" r="1" fill="#fff"/>
      {/* Smile */}
      <path d="M52 73 Q60 80 68 73" fill="none" stroke="#c87040" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Hair */}
      <path d="M38 60 Q36 44 60 41 Q84 44 82 60" fill="#884422" stroke="none"/>
      <path d="M38 60 Q34 58 36 52 Q38 48 40 56" fill="#884422"/>
      <path d="M82 60 Q86 58 84 52 Q82 48 80 56" fill="#884422"/>
      {/* Shoulder arms */}
      <ellipse cx="32" cy="105" rx="10" ry="6" fill="#1a2a4a" stroke="#44aaff" strokeWidth="1.5" transform="rotate(-20,32,105)"/>
      <ellipse cx="88" cy="105" rx="10" ry="6" fill="#1a2a4a" stroke="#44aaff" strokeWidth="1.5" transform="rotate(20,88,105)"/>
      {/* Badge */}
      <circle cx="60" cy="106" r="5" fill="#ffdd00" stroke="#cc8800" strokeWidth="1"/>
      <text x="60" y="109.5" textAnchor="middle" fontSize="6" fill="#553300" fontWeight="bold">★</text>
    </svg>
  );
}

function UpgradeCard({ def, currentLevel, blockScore, onBuy }) {
  const maxed = currentLevel >= def.maxLevel;
  const cost = maxed ? 0 : def.cost(currentLevel);
  const canAfford = blockScore >= cost;

  return (
    <motion.div
      whileHover={!maxed ? { scale: 1.03 } : {}}
      className="rounded-xl border p-4 flex flex-col gap-2"
      style={{
        background: 'rgba(10,20,40,0.85)',
        borderColor: maxed ? '#556633' : def.color,
        boxShadow: maxed ? 'none' : `0 0 12px ${def.color}44`,
      }}
    >
      <div className="flex items-center gap-3">
        <span className="text-3xl">{def.icon}</span>
        <div>
          <div className="font-bold text-white text-sm">{def.name}</div>
          <div className="text-xs" style={{ color: def.color }}>
            Level {currentLevel} / {def.maxLevel}
          </div>
        </div>
        <div className="ml-auto flex gap-1">
          {Array.from({ length: def.maxLevel }).map((_, i) => (
            <div key={i} className="w-2 h-2 rounded-full"
              style={{ background: i < currentLevel ? def.color : '#223' }} />
          ))}
        </div>
      </div>
      <div className="text-xs text-gray-300">{def.description(Math.max(currentLevel, 1))}</div>
      {maxed ? (
        <div className="text-center text-xs font-bold text-green-400 py-1">✓ MAXED OUT</div>
      ) : (
        <button
          onClick={() => canAfford && onBuy(def.id)}
          className="mt-1 py-1.5 px-4 rounded-lg text-sm font-bold transition-all"
          style={{
            background: canAfford ? def.color + 'cc' : '#334',
            color: canAfford ? '#000' : '#667',
            cursor: canAfford ? 'pointer' : 'not-allowed',
            border: `1px solid ${canAfford ? def.color : '#445'}`,
          }}
        >
          {canAfford ? `⛏ ${cost} pts` : `Need ${cost} pts`}
        </button>
      )}
    </motion.div>
  );
}

export default function ShopScreen({ blockScore, shopUpgrades, onBuy, onReturn, nextWave }) {
  const [showDialogue, setShowDialogue] = useState(true);
  const [displayedText, setDisplayedText] = useState('');

  // Typewriter effect for greeting
  useEffect(() => {
    setDisplayedText('');
    let i = 0;
    const t = setInterval(() => {
      i++;
      setDisplayedText(OZMA_GREETING.slice(0, i));
      if (i >= OZMA_GREETING.length) {
        clearInterval(t);
        setTimeout(() => setShowDialogue(false), 3000);
      }
    }, 30);
    return () => clearInterval(t);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex flex-col overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at 50% 0%, #0a1a3a 0%, #050510 70%)',
      }}
    >
      {/* Stars */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 60 }).map((_, i) => (
          <div key={i} className="absolute rounded-full bg-white"
            style={{
              left: `${(i * 17.3) % 100}%`, top: `${(i * 13.7) % 100}%`,
              width: `${(i % 3) + 1}px`, height: `${(i % 3) + 1}px`,
              opacity: 0.2 + (i % 5) * 0.1,
            }} />
        ))}
      </div>

      {/* Station name header */}
      <div className="relative z-10 text-center pt-4 pb-2">
        <div className="text-xs tracking-[0.4em] uppercase text-cyan-500/60 font-mono">Space Station</div>
        <div className="text-2xl font-black tracking-widest text-cyan-300" style={{ textShadow: '0 0 20px #00ccff' }}>
          OZMA
        </div>
      </div>

      {/* Main area */}
      <div className="relative z-10 flex flex-1 gap-4 px-4 pb-4 overflow-hidden">
        {/* Ozma column */}
        <div className="flex flex-col items-center gap-3 w-36 shrink-0">
          <div className="relative">
            <OzmaPortrait />
            <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-400 animate-pulse border border-green-600" />
          </div>
          <div className="text-center text-xs text-cyan-400/70 font-mono">Ozma<br/>Station Keeper</div>

          {/* Block score */}
          <div className="w-full rounded-lg border border-orange-500/40 bg-black/40 p-2 text-center">
            <div className="text-xs text-orange-400/70 font-mono uppercase">Artifacts</div>
            <div className="text-xl font-black text-orange-300">{blockScore.toLocaleString()}</div>
            <div className="text-xs text-orange-500/50">pts available</div>
          </div>
        </div>

        {/* Dialogue + Shop */}
        <div className="flex-1 flex flex-col gap-3 overflow-hidden">
          {/* Dialogue bubble */}
          <AnimatePresence>
            {showDialogue && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="rounded-xl border border-cyan-500/40 p-3 text-sm text-gray-200 leading-relaxed"
                style={{ background: 'rgba(0,40,80,0.7)' }}
              >
                <span className="text-cyan-400 font-bold">Ozma: </span>
                {displayedText}
                <span className="animate-pulse">▌</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Shop grid */}
          <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3 pr-1">
            {UPGRADE_DEFS.map(def => (
              <UpgradeCard
                key={def.id}
                def={def}
                currentLevel={shopUpgrades[def.id] || 0}
                blockScore={blockScore}
                onBuy={onBuy}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Return button */}
      <div className="relative z-10 px-6 pb-6 flex justify-center">
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          onClick={onReturn}
          className="px-10 py-3 rounded-xl font-black text-lg tracking-wider"
          style={{
            background: 'linear-gradient(135deg, #00ccff33, #0044aa44)',
            border: '2px solid #00ccff',
            color: '#00f0ff',
            textShadow: '0 0 12px #00ccff',
            boxShadow: '0 0 20px #00ccff44',
          }}
        >
          ▶ RETURN TO STAGE {nextWave}
        </motion.button>
      </div>
    </motion.div>
  );
}