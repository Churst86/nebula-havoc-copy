import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Music, Volume2, Sun, Skull, Gauge } from 'lucide-react';
import { DIFFICULTY_CONFIG, saveSettings } from '../../lib/gameSettings';

function Slider({ color, min, max, step, value, onChange, label }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex items-center gap-3">
      <input
        type="range" min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
        style={{ background: `linear-gradient(to right, ${color} ${pct}%, #1a2040 ${pct}%)`, accentColor: color }}
      />
      <span className="text-white font-mono w-12 text-right text-sm">{label}</span>
    </div>
  );
}

export default function OptionsScreen({ settings, onSettingsChange, onBack }) {
  function update(key, value) {
    const next = { ...settings, [key]: value };
    onSettingsChange(next);
    saveSettings(next);
  }

  const musicVol = settings.musicVolume ?? settings.soundVolume ?? 0.8;
  const sfxVol   = settings.sfxVolume   ?? settings.soundVolume ?? 0.8;
  const gameSpeed = settings.gameSpeed ?? 30;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/92 backdrop-blur-md overflow-y-auto"
    >
      <motion.div
        initial={{ scale: 0.88, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.05, type: 'spring', stiffness: 200 }}
        className="w-full max-w-sm space-y-5 p-8"
      >
        <h1 className="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 to-cyan-600 text-center">
          OPTIONS
        </h1>

        {/* Music Volume */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-cyan-400 uppercase tracking-widest">
            <Music className="w-4 h-4" />
            Music Volume
          </div>
          <Slider color="#00f0ff" min={0} max={1} step={0.05}
            value={musicVol}
            onChange={v => update('musicVolume', v)}
            label={`${Math.round(musicVol * 100)}%`} />
        </div>

        {/* SFX Volume */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-purple-400 uppercase tracking-widest">
            <Volume2 className="w-4 h-4" />
            SFX Volume
          </div>
          <Slider color="#cc44ff" min={0} max={1} step={0.05}
            value={sfxVol}
            onChange={v => update('sfxVolume', v)}
            label={`${Math.round(sfxVol * 100)}%`} />
        </div>

        {/* Game Speed */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-green-400 uppercase tracking-widest">
            <Gauge className="w-4 h-4" />
            Game Speed
          </div>
          <Slider color="#44ff88" min={15} max={60} step={1}
            value={gameSpeed}
            onChange={v => update('gameSpeed', v)}
            label={`${gameSpeed} fps`} />
          <p className="text-xs text-muted-foreground text-center">Default: 30 fps</p>
        </div>

        {/* Brightness */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-yellow-400 uppercase tracking-widest">
            <Sun className="w-4 h-4" />
            Brightness
          </div>
          <Slider color="#facc15" min={0.3} max={1.5} step={0.05}
            value={settings.brightness ?? 1}
            onChange={v => update('brightness', v)}
            label={`${Math.round((settings.brightness ?? 1) * 100)}%`} />
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
            {DIFFICULTY_CONFIG[settings.difficulty ?? 'normal'].desc}
          </p>
        </div>

        <Button onClick={onBack} variant="outline" className="w-full gap-2 mt-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
      </motion.div>
    </motion.div>
  );
}