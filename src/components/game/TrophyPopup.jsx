import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function TrophyPopup({ trophy, onComplete }) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(false);
      onComplete?.();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.8 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
        >
          <div className="bg-gradient-to-b from-yellow-500/20 to-yellow-600/10 border-2 border-yellow-400 rounded-lg px-6 py-4 shadow-2xl">
            <div className="text-center space-y-2">
              <div className="text-4xl">{trophy.icon}</div>
              <div className="text-sm font-bold text-yellow-300">TROPHY EARNED</div>
              <div className="text-lg font-black text-white">{trophy.name}</div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}