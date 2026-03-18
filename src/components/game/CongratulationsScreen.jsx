import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Trophy, Zap } from 'lucide-react';
import DifficultySelector from './DifficultySelector';

export default function CongratulationsScreen({ difficulty, score, onPlayNext, onPlayAgain, onHome, completedDifficulties }) {
  const [showSelector, setShowSelector] = useState(false);
  const difficultyName = { easy: 'Easy', challenging: 'Challenging', hell: 'Hell' }[difficulty];
  const levelTarget = { easy: 25, challenging: 50, hell: 100 }[difficulty];
  const nextDifficulty = { easy: 'challenging', challenging: 'hell', hell: null }[difficulty];

  if (showSelector) {
    return (
      <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50">
        <DifficultySelector
          completedDifficulties={completedDifficulties}
          onSelectDifficulty={onPlayNext}
          onHome={onHome}
        />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50">
      <div className="text-center space-y-8 max-w-2xl">
        <div className="animate-bounce">
          <Trophy className="w-24 h-24 text-yellow-400 mx-auto" />
        </div>
        
        <div>
          <h1 className="text-5xl font-black text-white mb-2">
            CONGRATULATIONS!
          </h1>
          <p className="text-xl text-primary">
            You defeated {difficulty.toUpperCase()} mode at Wave {levelTarget}
          </p>
        </div>

        <div className="bg-card/50 rounded-lg p-6 space-y-3">
          <div className="flex items-center justify-center gap-3">
            <Zap className="w-6 h-6 text-primary fill-primary" />
            <span className="text-2xl font-bold text-white">
              {score.toLocaleString()} points
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {nextDifficulty ? (
            <>
              <p className="text-muted-foreground">
                Ready for the next challenge?
              </p>
              <Button
                onClick={() => setShowSelector(true)}
                className="w-full bg-primary hover:bg-primary/90 text-lg h-12"
              >
                Choose Difficulty
              </Button>
            </>
          ) : (
            <p className="text-lg font-bold text-yellow-400">
              You've mastered all difficulties!
            </p>
          )}
          
          <Button
            onClick={onPlayAgain}
            variant="outline"
            className="w-full text-lg h-12"
          >
            Play {difficultyName} Again
          </Button>
          
          <Button
            onClick={onHome}
            variant="ghost"
            className="w-full text-lg h-12"
          >
            Main Menu
          </Button>
        </div>
      </div>
    </div>
  );
}