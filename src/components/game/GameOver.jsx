import React from 'react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { RotateCcw, Trophy } from 'lucide-react';

export default function GameOver({ score, onRestart }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
        className="text-center space-y-6 p-10"
      >
        <motion.h1
          initial={{ y: -20 }}
          animate={{ y: 0 }}
          className="text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-red-400 to-red-600"
        >
          GAME OVER
        </motion.h1>

        <div className="flex items-center justify-center gap-3">
          <Trophy className="w-6 h-6 text-yellow-400" />
          <span className="text-3xl font-bold text-white">{score.toLocaleString()}</span>
        </div>

        <Button
          onClick={onRestart}
          size="lg"
          className="bg-primary hover:bg-primary/80 text-primary-foreground font-bold text-lg px-8 py-6 rounded-xl gap-2"
        >
          <RotateCcw className="w-5 h-5" />
          PLAY AGAIN
        </Button>
      </motion.div>
    </motion.div>
  );
}