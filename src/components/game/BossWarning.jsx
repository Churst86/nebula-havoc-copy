import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Plays an alert beep sound using Web Audio API
function playAlertSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const beep = (freq, start, dur) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sawtooth';
      gain.gain.setValueAtTime(0.35, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    };
    beep(880, 0, 0.18);
    beep(660, 0.22, 0.18);
    beep(880, 0.44, 0.18);
    beep(440, 0.66, 0.35);
  } catch {}
}

export default function BossWarning({ warning }) {
  const played = useRef(false);

  useEffect(() => {
    if (warning?.active && !played.current) {
      played.current = true;
      playAlertSound();
    }
    if (!warning?.active) played.current = false;
  }, [warning?.active]);

  const visible = warning?.active;
  const flash = warning ? Math.floor(warning.timer / 15) % 2 === 0 : false;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.3 } }}
          className="fixed inset-0 pointer-events-none z-20 flex items-center justify-center"
        >
          {/* Red vignette flash */}
          <div
            className="absolute inset-0"
            style={{
              background: flash
                ? 'radial-gradient(ellipse at center, transparent 40%, rgba(255,0,50,0.45) 100%)'
                : 'transparent',
              transition: 'background 0.05s',
            }}
          />
          {/* Warning text */}
          <motion.div
            animate={{ scale: flash ? 1.05 : 0.98, opacity: flash ? 1 : 0.6 }}
            transition={{ duration: 0.1 }}
            className="text-center select-none"
          >
            <div
              className="font-black tracking-widest uppercase"
              style={{
                fontSize: '4rem',
                color: '#ff0033',
                textShadow: '0 0 30px #ff0033, 0 0 60px #ff0033',
                letterSpacing: '0.2em',
              }}
            >
              ⚠ WARNING ⚠
            </div>
            <div
              className="font-bold tracking-widest uppercase mt-2"
              style={{
                fontSize: '1.6rem',
                color: '#ffaa00',
                textShadow: '0 0 20px #ffaa00',
              }}
            >
              BOSS APPROACHING
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}