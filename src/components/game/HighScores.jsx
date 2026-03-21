import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Trophy, RotateCcw } from 'lucide-react';
import { TROPHY_DEFS, getEarnedTrophies } from '../../lib/trophies';

const LS_KEY = 'voidstorm_highscores';
const MAX_SCORES = 10;

export function getHighScores() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch { return []; }
}

export function isHighScore(score) {
  const scores = getHighScores();
  return scores.length < MAX_SCORES || score > (scores[scores.length - 1]?.score || 0);
}

export function saveHighScore(name, score, wave) {
  const scores = getHighScores();
  scores.push({ name: name.toUpperCase().slice(0, 3), score, wave, date: Date.now() });
  scores.sort((a, b) => b.score - a.score);
  const trimmed = scores.slice(0, MAX_SCORES);
  localStorage.setItem(LS_KEY, JSON.stringify(trimmed));
  return trimmed;
}

export default function HighScores({ score, wave, onRestart, onReturnToTitle, isNewScore }) {
  const [saved, setSaved] = useState(false);
  const [scores, setScores] = useState(getHighScores());
  const inputs = [useRef(), useRef(), useRef()];
  const [letters, setLetters] = useState(['', '', '']);
  const [countdown, setCountdown] = useState(null);
  const [showTrophies, setShowTrophies] = useState(false);
  const earnedTrophies = getEarnedTrophies();

  const handleLetterChange = (i, val) => {
    const char = val.replace(/[^a-zA-Z0-9]/g, '').slice(-1).toUpperCase();
    const next = [...letters];
    next[i] = char;
    setLetters(next);
    if (char && i < 2) inputs[i + 1].current?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !letters[i] && i > 0) {
      inputs[i - 1].current?.focus();
    }
  };

  const handleSave = () => {
    const n = letters.join('').padEnd(3, '_').slice(0, 3);
    const updated = saveHighScore(n, score, wave);
    setScores(updated);
    setSaved(true);
    setCountdown(5);
  };

  useEffect(() => {
    if (!isNewScore) setCountdown(5);
  }, [isNewScore]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) { onReturnToTitle(); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, onReturnToTitle]);

  const newScoreIndex = saved ? scores.findIndex(s => s.score === score && s.name === letters.join('').padEnd(3,'_').slice(0,3)) : -1;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-30 flex items-center justify-center overflow-y-auto"
      style={{
        backgroundImage: 'url(https://media.base44.com/images/public/69b94c96f2e7813ac4b009de/4dc774d1a_gameoverscreenfornebulahavok.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="absolute inset-0 bg-black/40" />
      
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 180 }}
        className="relative z-10 text-center space-y-4 p-8 max-w-sm w-full"
      >
        <div className="flex items-center justify-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-400" />
          <span className="text-2xl font-bold text-white">{score.toLocaleString()}</span>
          <span className="text-muted-foreground text-sm">· Wave {wave}</span>
        </div>

        {/* Tab toggle */}
        <div className="flex rounded-lg overflow-hidden border border-white/10">
          <button
            onClick={() => setShowTrophies(false)}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${!showTrophies ? 'bg-cyan-900/60 text-cyan-300' : 'text-muted-foreground'}`}
          >
            Scores
          </button>
          <button
            onClick={() => setShowTrophies(true)}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${showTrophies ? 'bg-yellow-900/60 text-yellow-300' : 'text-muted-foreground'}`}
          >
            🏆 Trophies {earnedTrophies.length > 0 ? `(${earnedTrophies.length}/${TROPHY_DEFS.length})` : ''}
          </button>
        </div>

        {!showTrophies ? (
          <>
            {/* Name entry */}
            {isNewScore && !saved && (
              <div className="space-y-3">
                <p className="text-cyan-400 font-bold tracking-widest text-sm uppercase">New High Score!</p>
                <div className="flex justify-center gap-3">
                  {[0, 1, 2].map(i => (
                    <input
                      key={i}
                      ref={inputs[i]}
                      value={letters[i]}
                      onChange={e => handleLetterChange(i, e.target.value)}
                      onKeyDown={e => handleKeyDown(i, e)}
                      maxLength={1}
                      className="w-12 h-14 text-center text-2xl font-black bg-transparent border-2 border-cyan-500 text-white rounded-lg focus:outline-none focus:border-cyan-300 uppercase caret-transparent"
                      placeholder="_"
                      autoFocus={i === 0}
                    />
                  ))}
                </div>
                <Button onClick={handleSave} disabled={letters.join('').trim().length === 0}
                  className="bg-primary hover:bg-primary/80 font-bold px-8">
                  SAVE
                </Button>
              </div>
            )}

            {/* Leaderboard */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">High Scores</p>
              {scores.length === 0 && <p className="text-muted-foreground text-sm">No scores yet</p>}
              {scores.map((s, i) => {
                const isThis = saved && i === newScoreIndex;
                return (
                  <div key={i}
                    className={`flex justify-between items-center px-3 py-1.5 rounded-lg text-sm font-mono
                      ${isThis ? 'bg-cyan-900/50 border border-cyan-500 text-cyan-300' : 'text-muted-foreground'}`}>
                    <span className={`w-5 font-bold ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-600' : ''}`}>
                      {i + 1}.
                    </span>
                    <span className="flex-1 text-left font-bold text-white ml-2">{s.name}</span>
                    <span className="text-right">{s.score.toLocaleString()}</span>
                    <span className="text-right ml-3 text-xs opacity-60">W{s.wave}</span>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          /* Trophies panel */
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {TROPHY_DEFS.map(t => {
              const earned = earnedTrophies.includes(t.id);
              return (
                <div key={t.id}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${earned ? 'bg-yellow-900/30 border border-yellow-600/40' : 'opacity-40'}`}>
                  <span className="text-xl w-7 text-center">{earned ? t.icon : '🔒'}</span>
                  <div className="text-left flex-1">
                    <div className={`font-bold text-xs ${earned ? 'text-yellow-300' : 'text-muted-foreground'}`}>{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.desc}</div>
                  </div>
                  {earned && <span className="text-xs text-yellow-500 font-bold">✓</span>}
                </div>
              );
            })}
          </div>
        )}

        {countdown !== null && (
          <p className="text-xs text-muted-foreground">
            Returning to title in {countdown}s…
          </p>
        )}

        <Button onClick={onRestart} size="lg"
          className="bg-primary hover:bg-primary/80 text-primary-foreground font-bold text-lg px-8 py-6 rounded-xl gap-2 w-full">
          <RotateCcw className="w-5 h-5" />
          PLAY AGAIN
        </Button>
      </motion.div>
    </motion.div>
  );
}