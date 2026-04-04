import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Trophy, Settings, Play } from 'lucide-react';
import HighScoresMenu from './HighScoresMenu';
import OptionsScreen from './OptionsScreen';
import { sounds } from '../../hooks/useSound.js';
import { loadSaveFile } from '../../lib/gameSettings';

export const GAME_VERSION = 'v1.3.0';

const DIFFICULTY_MILESTONES = {
  easy: 25,
  normal: 50,
};

const DIFFICULTY_LABELS = {
  easy: 'Easy',
  normal: 'Challenging',
  hell: 'Hell',
};

function difficultyForWave(wave = 1) {
  if (wave > DIFFICULTY_MILESTONES.normal) return 'hell';
  if (wave > DIFFICULTY_MILESTONES.easy) return 'normal';
  return 'easy';
}

function getLoadDifficulty(saveFile) {
  const wave = saveFile?.wave || 1;
  const byWave = difficultyForWave(wave);
  const saved = saveFile?.difficulty;
  const order = { easy: 1, normal: 2, hell: 3 };
  if (!saved || !order[saved]) return byWave;
  return order[saved] >= order[byWave] ? saved : byWave;
}

export default function StartScreen({ onStart, onContinue, settings, onSettingsChange }) {
  const [showScores, setShowScores] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const musicEnabled = settings.musicEnabled !== false;
  const saveFile = loadSaveFile();
  const loadDifficulty = getLoadDifficulty(saveFile);

  // Stop game music and start title music immediately on mount.
  // The IntroCrawl requires a user gesture to dismiss, so autoplay is already unblocked by the time StartScreen mounts.
  useEffect(() => {
    sounds.stopAllMusic();
    sounds.setMusicEnabled(musicEnabled);
    sounds.playTitleMusic();
  }, []);

  if (showScores) return <HighScoresMenu onBack={() => setShowScores(false)} />;
  if (showOptions) return <OptionsScreen settings={settings} onSettingsChange={onSettingsChange} onBack={() => setShowOptions(false)} />;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-30 flex items-center justify-center overflow-y-auto"
      style={{
        backgroundImage: 'url(https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69b94c96f2e7813ac4b009de/107976521_image.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}>
      
      {/* Dark overlay for text legibility */}
      <div className="absolute inset-0 bg-black/50" />
      
      <div className="relative z-10 text-center space-y-4 md:space-y-8 px-4 w-full max-w-xs md:max-w-sm">
        <h1 className="text-4xl md:text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 to-cyan-600">
          NEBULA HAVOK
        </h1>
        <p className="text-muted-foreground text-sm md:text-lg tracking-widest uppercase">
          Bullet Hell Space Shooter
        </p>

        <div className="space-y-2 md:space-y-3 pt-1 md:pt-2">
          <Button
            onClick={onStart}
            size="lg"
            className="bg-primary hover:bg-primary/80 text-primary-foreground font-bold text-base md:text-lg px-8 md:px-10 py-4 md:py-6 rounded-xl w-full">
            NEW GAME
          </Button>

          <Button
            onClick={() => onStart(false, true)}
            size="lg"
            variant="outline"
            className="font-bold text-base md:text-lg px-8 md:px-10 py-4 md:py-6 rounded-xl w-full border-red-500/60 text-red-400 hover:bg-red-950/30">
            ⚔ BOSS MODE
          </Button>

          {saveFile &&
          <Button
            onClick={onContinue}
            size="lg"
            variant="outline"
            className="font-bold text-sm md:text-lg px-6 md:px-10 py-4 md:py-6 rounded-xl w-full gap-2 border-cyan-500 text-cyan-300 hover:bg-cyan-900/30">
              <Play className="w-4 h-4 md:w-5 md:h-5" />
              LOAD — {DIFFICULTY_LABELS[loadDifficulty]} · Wave {saveFile.wave || 1}
            </Button>
          }

          <div className="flex gap-2 md:gap-3">
            <Button
              onClick={() => setShowScores(true)}
              variant="outline"
              size="lg"
              className="font-bold px-4 md:px-6 py-4 md:py-6 rounded-xl gap-2 flex-1 text-sm md:text-base">
              <Trophy className="w-4 h-4 md:w-5 md:h-5" />
              SCORES
            </Button>
            <Button
              onClick={() => setShowOptions(true)}
              variant="outline"
              size="lg"
              className="font-bold px-4 md:px-6 py-4 md:py-6 rounded-xl gap-2 flex-1 text-sm md:text-base">
              <Settings className="w-4 h-4 md:w-5 md:h-5" />
              OPTIONS
            </Button>
          </div>

          <div className="hidden md:block text-sm text-muted-foreground space-y-1 pt-2">
            <p><kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">WASD</kbd> or <kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">Arrow Keys</kbd> to move</p>
            <p>Auto-fire enabled &bull; <kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">Enter</kbd> to pause</p>
          </div>
        </div>
      </div>
    </motion.div>);

}