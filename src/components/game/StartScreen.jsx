import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Crosshair, Trophy, Settings } from 'lucide-react';
import HighScoresMenu from './HighScoresMenu';
import OptionsScreen from './OptionsScreen';

export const GAME_VERSION = 'v1.2.0';

export default function StartScreen({ onStart, settings, onSettingsChange }) {
  const [showScores, setShowScores] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  if (showScores) return <HighScoresMenu onBack={() => setShowScores(false)} />;
  if (showOptions) return <OptionsScreen settings={settings} onSettingsChange={onSettingsChange} onBack={() => setShowOptions(false)} />;

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
        <p className="text-xs text-muted-foreground/50 font-mono -mt-4">{GAME_VERSION}</p>

        <div className="space-y-3 pt-2">
          <Button
            onClick={onStart}
            size="lg"
            className="bg-primary hover:bg-primary/80 text-primary-foreground font-bold text-lg px-10 py-6 rounded-xl w-full"
          >
            START GAME
          </Button>

          <div className="flex gap-3">
            <Button
              onClick={() => setShowScores(true)}
              variant="outline"
              size="lg"
              className="font-bold px-6 py-6 rounded-xl gap-2 flex-1"
            >
              <Trophy className="w-5 h-5" />
              SCORES
            </Button>
            <Button
              onClick={() => setShowOptions(true)}
              variant="outline"
              size="lg"
              className="font-bold px-6 py-6 rounded-xl gap-2 flex-1"
            >
              <Settings className="w-5 h-5" />
              OPTIONS
            </Button>
          </div>

          <div className="text-sm text-muted-foreground space-y-1 pt-2">
            <p><kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">WASD</kbd> or <kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">Arrow Keys</kbd> to move</p>
            <p>Auto-fire enabled &bull; <kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">Enter</kbd> to pause</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}