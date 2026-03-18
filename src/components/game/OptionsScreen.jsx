import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Volume2, Sun, Skull } from 'lucide-react';
import { DIFFICULTY_CONFIG, saveSettings } from '../../lib/gameSettings';

export default function OptionsScreen({ settings, onSettingsChange, onBack }) {
  function update(key, value) {
    const next = { ...settings, [key]: value };
    onSettingsChange(next);
    saveSettings(next);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/92 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.88, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.05, type: 'spring', stiffness: 200 }}
        className="w-full max-w-sm space-y-6 p-8"
      >
        <h1 className="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 to-cyan-600 text-center">
          OPTIONS
        </h1>

        {/* Sound Volume */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-cyan-400 uppercase tracking-widest">
            <Volume2 className="w-4 h-4" />
            Sound Volume
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range" min="0" max="1" step="0.05"
              value={settings.soundVolume}
              onChange={e => update('soundVolume', parseFloat(e.target.value))}
              className="flex-1 h-2 rounded-full appearance-none cursor-pointer accent-cyan-400"
              style={{ background: `linear-gradient(to right, #00f0ff ${settings.soundVolume * 100}%, #1a2040 ${settings.soundVolume * 100}%)` }}
            />
            <span className="text-white font-mono w-10 text-right text-sm">
              {Math.round(settings.soundVolume * 100)}%
            </span>
          </div>
        </div>

        {/* Brightness */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-yellow-400 uppercase tracking-widest">
            <Sun className="w-4 h-4" />
            Brightness
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range" min="0.3" max="1.5" step="0.05"
              value={settings.brightness}
              onChange={e => update('brightness', parseFloat(e.target.value))}
              className="flex-1 h-2 rounded-full appearance-none cursor-pointer accent-yellow-400"
              style={{ background: `linear-gradient(to right, #facc15 ${((settings.brightness - 0.3) / 1.2) * 100}%, #1a2040 ${((settings.brightness - 0.3) / 1.2) * 100}%)` }}
            />
            <span className="text-white font-mono w-10 text-right text-sm">
              {Math.round(settings.brightness * 100)}%
            </span>
          </div>
        </div>

        {/* Difficulty */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-red-400 uppercase tracking-widest">
            <Skull className="w-4 h-4" />
            Difficulty
          </div>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(DIFFICULTY_CONFIG).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => update('difficulty', key)}
                className="relative py-3 px-2 rounded-xl border-2 transition-all text-center"
                style={{
                  borderColor: settings.difficulty === key ? cfg.color : '#1a2040',
                  background: settings.difficulty === key ? `${cfg.color}22` : 'transparent',
                  color: settings.difficulty === key ? cfg.color : '#666',
                }}
              >
                <div className="font-black text-sm">{cfg.label}</div>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center mt-1">
            {DIFFICULTY_CONFIG[settings.difficulty].desc}
          </p>
        </div>

        <Button onClick={onBack} variant="outline" className="w-full gap-2 mt-4">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
      </motion.div>
    </motion.div>
  );
}