import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Play } from 'lucide-react';

const DIFFICULTY_LABELS = {
  easy: 'Easy',
  normal: 'Challenging',
  hell: 'Hell',
};

const SLOT_META = [
  { key: 'slot1', label: 'Save Slot 1', accent: '#4dd0ff' },
  { key: 'slot2', label: 'Save Slot 2', accent: '#8f9bff' },
  { key: 'slot3', label: 'Save Slot 3', accent: '#7dffb2' },
  { key: 'auto', label: 'Autosave', accent: '#ffc14d' },
];

function formatSave(save) {
  if (!save) return 'Empty';
  const difficulty = DIFFICULTY_LABELS[save.difficulty] || 'Easy';
  const wave = save.wave || 1;
  const score = (save.blockScore || 0).toLocaleString();
  const stamp = save.savedAt
    ? new Date(save.savedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'Unknown time';
  return `${difficulty} · Wave ${wave} · Blocks ${score} · ${stamp}`;
}

export default function SavedGamesScreen({ saves, onLoad, onBack }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/85 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 210, damping: 20 }}
        className="w-full max-w-lg space-y-4 p-4 md:p-7"
      >
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 to-cyan-600 text-center">
          SAVED GAMES
        </h1>

        <div className="space-y-2">
          {SLOT_META.map((slot) => {
            const save = saves?.[slot.key] || null;
            const isEmpty = !save;
            return (
              <button
                key={slot.key}
                onClick={() => !isEmpty && onLoad?.(slot.key)}
                disabled={isEmpty}
                className={`w-full rounded-xl border px-4 py-3 text-left transition-all ${isEmpty ? 'opacity-55 cursor-not-allowed' : 'hover:translate-y-[-1px]'}`}
                style={{
                  borderColor: isEmpty ? '#28314b' : slot.accent,
                  background: isEmpty ? '#0a1020' : `${slot.accent}18`,
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-black tracking-wide" style={{ color: isEmpty ? '#6f7a98' : slot.accent }}>
                    {slot.label}
                  </div>
                  {!isEmpty && <Play className="w-4 h-4" style={{ color: slot.accent }} />}
                </div>
                <div className="mt-1 text-xs md:text-sm text-slate-200/85">{formatSave(save)}</div>
              </button>
            );
          })}
        </div>

        <Button onClick={onBack} variant="outline" className="w-full gap-2 mt-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
      </motion.div>
    </motion.div>
  );
}
