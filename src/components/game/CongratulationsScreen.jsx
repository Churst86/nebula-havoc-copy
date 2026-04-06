import React from 'react';
import { Button } from '@/components/ui/button';
import { Trophy, Zap } from 'lucide-react';

export default function CongratulationsScreen({ wave, completedWave, nextWave, score, currentDifficulty, nextDifficulty, onProgressToDifficulty, onReturnToTitle }) {
  const difficultyNames = { easy: 'Easy', normal: 'Challenging', hell: 'Hell' };
  const difficultyEmojis = { easy: '⭐', normal: '🔥', hell: '💀' };
  const displayedCompletedWave = Number.isFinite(completedWave) ? completedWave : wave;
  const displayedNextWave = Number.isFinite(nextWave)
    ? nextWave
    : (Number.isFinite(displayedCompletedWave) ? displayedCompletedWave + 1 : null);
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto"
      style={{
        backgroundImage: 'url(https://media.base44.com/images/public/69b94c96f2e7813ac4b009de/50ba4ea79_image.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}>
      {/* Dark overlay for text legibility */}
      <div className="absolute inset-0 bg-black/50" />
      
      <div className="relative z-10 text-center space-y-8 max-w-2xl mx-auto px-6">
        {/* Trophy */}
        <div className="flex justify-center">
          <Trophy className="w-20 h-20 text-yellow-400 animate-bounce" />
        </div>

        {/* Congratulations */}
        <div className="space-y-2">
          <h1 className="text-5xl font-black text-white mb-2">CONGRATULATIONS!</h1>
          <p className="text-xl text-primary">You've completed Wave {displayedCompletedWave}</p>
          <p className="text-lg text-muted-foreground">
            {difficultyEmojis[currentDifficulty]} {difficultyNames[currentDifficulty]} Mode
          </p>
        </div>

        {/* Score display */}
        <div className="bg-card/50 border border-primary/30 rounded-lg p-6">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Zap className="w-5 h-5 text-primary" />
            <span className="text-sm text-muted-foreground">Final Score</span>
          </div>
          <p className="text-4xl font-black text-primary tabular-nums">
            {score.toLocaleString()}
          </p>
        </div>

        {/* Next difficulty info */}
        {nextDifficulty ? (
          <div className="space-y-3">
            <p className="text-lg font-bold text-white">Ready for the next challenge?</p>
            <p className="text-sm text-muted-foreground">
              Your powerups will carry over to {difficultyNames[nextDifficulty]} mode
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-lg font-bold text-yellow-400">You've conquered all difficulties!</p>
            <p className="text-sm text-muted-foreground">The galaxy is safe. For now.</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-3">
          {nextDifficulty && (
            <Button
              onClick={onProgressToDifficulty}
              className="bg-primary hover:bg-primary/90 text-lg py-6"
            >
              {difficultyEmojis[nextDifficulty]} Continue to Wave {displayedNextWave} ({difficultyNames[nextDifficulty]})
            </Button>
          )}
          <Button
            onClick={onReturnToTitle}
            variant="outline"
            className="text-lg py-6"
          >
            Return to Title
          </Button>
        </div>
      </div>
    </div>
  );
}