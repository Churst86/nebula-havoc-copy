import React from 'react';
import { getDifficultyTrophies, loadTrophies, TROPHIES } from '@/lib/trophySystem';

export default function TrophyDisplay() {
  const difficultyTrophies = getDifficultyTrophies();
  const allTrophies = loadTrophies();

  // Show difficulty trophies prominently, then milestones
  const displayTrophies = [
    ...difficultyTrophies,
    ...allTrophies.filter(t => !difficultyTrophies.includes(t))
  ];

  if (displayTrophies.length === 0) return null;

  return (
    <div className="absolute top-4 right-4 flex flex-wrap gap-2 max-w-xs justify-end">
      {displayTrophies.map(trophyKey => {
        const trophy = TROPHIES[trophyKey];
        if (!trophy) return null;
        const isDifficulty = trophy.category === 'difficulty';
        return (
          <div
            key={trophyKey}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${
              isDifficulty 
                ? 'bg-yellow-900/40 border border-yellow-600' 
                : 'bg-blue-900/40 border border-blue-600'
            }`}
            title={trophy.name}
          >
            <span className="text-lg">{trophy.icon}</span>
          </div>
        );
      })}
    </div>
  );
}