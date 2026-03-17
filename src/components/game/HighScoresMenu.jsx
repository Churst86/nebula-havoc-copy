import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Trophy, ArrowLeft } from 'lucide-react';
import { getHighScores } from './HighScores';

export default function HighScoresMenu({ onBack }) {
  const scores = getHighScores();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/90 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 180 }}
        className="text-center space-y-6 p-8 max-w-md w-full"
      >
        <h1 className="text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-yellow-400 to-yellow-600">
          HIGH SCORES
        </h1>

        <div className="space-y-2">
          {scores.length === 0 ? (
            <p className="text-muted-foreground text-sm">No scores yet</p>
          ) : (
            scores.map((s, i) => (
              <div key={i}
                className="flex justify-between items-center px-4 py-2 rounded-lg bg-card">
                <span className={`w-6 font-bold ${
                  i === 0 ? 'text-yellow-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-600' : 'text-muted-foreground'
                }`}>
                  {i + 1}.
                </span>
                <span className="flex-1 text-left font-bold text-white ml-3">{s.name}</span>
                <span className="text-right text-sm">{s.score.toLocaleString()}</span>
                <span className="text-right ml-3 text-xs opacity-60 w-8">W{s.wave}</span>
              </div>
            ))
          )}
        </div>

        <Button onClick={onBack} variant="outline" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
      </motion.div>
    </motion.div>
  );
}