import React from 'react';
import { Button } from '@/components/ui/button';
import { Lock, Zap } from 'lucide-react';

export default function DifficultySelector({ completedDifficulties, onSelectDifficulty, onHome }) {
  const difficulties = [
    {
      key: 'easy',
      label: 'EASY',
      description: 'Wave 25',
      color: '#44ffaa',
      locked: false,
    },
    {
      key: 'challenging',
      label: 'CHALLENGING',
      description: 'Wave 50',
      color: '#ff8800',
      locked: !completedDifficulties?.includes('easy'),
    },
    {
      key: 'hell',
      label: 'HELL',
      description: 'Wave 100',
      color: '#ff0066',
      locked: !completedDifficulties?.includes('challenging'),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-black text-white mb-2">SELECT DIFFICULTY</h2>
        <p className="text-muted-foreground">Complete each difficulty to unlock the next</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {difficulties.map(diff => (
          <button
            key={diff.key}
            onClick={() => !diff.locked && onSelectDifficulty(diff.key)}
            disabled={diff.locked}
            className={`relative p-6 rounded-lg border-2 transition-all ${
              diff.locked
                ? 'border-muted bg-card/30 opacity-50 cursor-not-allowed'
                : 'border-transparent bg-card hover:shadow-lg hover:shadow-[color] cursor-pointer'
            }`}
            style={!diff.locked ? { '--tw-shadow-color': diff.color + '40' } : {}}
          >
            {diff.locked && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Lock className="w-8 h-8 text-muted-foreground" />
              </div>
            )}
            
            <div className={diff.locked ? 'opacity-50' : ''}>
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-5 h-5 fill-current" style={{ color: diff.color }} />
                <h3 className="text-xl font-bold" style={{ color: diff.color }}>
                  {diff.label}
                </h3>
              </div>
              <p className="text-sm text-muted-foreground">{diff.description}</p>
              {completedDifficulties?.includes(diff.key) && (
                <p className="text-xs text-green-500 mt-2">✓ COMPLETED</p>
              )}
            </div>
          </button>
        ))}
      </div>

      <div className="flex justify-center pt-4">
        <Button onClick={onHome} variant="outline">
          Back to Menu
        </Button>
      </div>
    </div>
  );
}