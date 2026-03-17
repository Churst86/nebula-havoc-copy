import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Crosshair, Trophy } from 'lucide-react';
import HighScoresMenu from './HighScoresMenu';

export default function StartScreen({ onStart }) {
  const [showScores, setShowScores] = useState(false);
  if (showScores) {
    return <HighScoresMenu onBack={() => setShowScores(false)} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/90 backdrop-blur-md"
    >
      <div className="text-center space-y-8">
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
        >
          <Crosshair className="w-16 h-16 mx-auto text-primary mb-4" />
        </motion.div>

        <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 to-cyan-600">
          VOID STORM
        </h1>
        <p className="text-muted-foreground text-lg tracking-widest uppercase">
          Bullet Hell Shooter
        </p>

        <div className="space-y-4 pt-4">
          <Button
            onClick={onStart}
            size="lg"
            className="bg-primary hover:bg-primary/80 text-primary-foreground font-bold text-lg px-10 py-6 rounded-xl"
          >
            START GAME
          </Button>

          <Button
            onClick={() => setShowScores(true)}
            variant="outline"
            size="lg"
            className="font-bold text-lg px-10 py-6 rounded-xl gap-2"
          >
            <Trophy className="w-5 h-5" />
            HIGH SCORES
          </Button>

          <div className="text-sm text-muted-foreground space-y-1 pt-4">
            <p><kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">WASD</kbd> or <kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">Arrow Keys</kbd> to move</p>
            <p><kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">Space</kbd> to shoot &bull; Auto-fire enabled</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}