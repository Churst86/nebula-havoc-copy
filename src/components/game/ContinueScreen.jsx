import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

const CONTINUE_COUNTDOWN = 10; // seconds

export default function ContinueScreen({ score, onContinue, onDecline, bossMode, onRestartBossMode }) {
  const [timeLeft, setTimeLeft] = useState(CONTINUE_COUNTDOWN);

  useEffect(() => {
    if (timeLeft <= 0) { onDecline(); return; }
    const t = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, onDecline]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/85 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
        className="text-center space-y-4 md:space-y-6 p-6 md:p-10"
      >
        <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 to-cyan-600">
          CONTINUE?
        </h1>

        {/* Countdown ring */}
        <div className="relative w-20 h-20 md:w-24 md:h-24 mx-auto">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1a2040" strokeWidth="3" />
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#00f0ff" strokeWidth="3"
              strokeDasharray={`${(timeLeft / CONTINUE_COUNTDOWN) * 100} 100`}
              strokeLinecap="round" className="transition-all duration-1000" />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-3xl font-black text-white">
            {timeLeft}
          </span>
        </div>

        <p className="text-muted-foreground text-sm tracking-widest uppercase">
          Score: {score.toLocaleString()}
        </p>

        <div className="flex gap-4 justify-center flex-wrap">
          <Button
            onClick={onContinue}
            size="lg"
            className="bg-primary hover:bg-primary/80 text-primary-foreground font-bold text-base md:text-lg px-6 md:px-8 py-4 md:py-6 rounded-xl"
          >
            CONTINUE
          </Button>
          {bossMode && (
            <Button
              onClick={onRestartBossMode}
              size="lg"
              variant="outline"
              className="border-red-600 text-red-400 hover:bg-red-900/30 font-bold text-base md:text-lg px-6 md:px-8 py-4 md:py-6 rounded-xl"
            >
              RESTART
            </Button>
          )}
          <Button
            onClick={onDecline}
            size="lg"
            variant="outline"
            className="border-red-600 text-red-400 hover:bg-red-900/30 font-bold text-base md:text-lg px-6 md:px-8 py-4 md:py-6 rounded-xl"
          >
            QUIT
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}