import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Music, Volume2, VolumeX, Sun, Skull, Gauge, Save, LogOut, CheckCircle, Smartphone, Wrench } from 'lucide-react';
import { DIFFICULTY_CONFIG, saveSettings } from '../../lib/gameSettings';
import { sounds } from '../../hooks/useSound.js';
import ControllerOptionsScreen from './ControllerOptionsScreen';

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

export default function OptionsScreen({ settings, onSettingsChange, onBack, gameState, onExitToTitle, onSaveGame, bossMode = false, onOpenShop }) {
  const [savedFlash, setSavedFlash] = useState(false);
  const [showControllerOptions, setShowControllerOptions] = useState(false);

  function update(key, value) {
    const next = { ...settings, [key]: value };
    onSettingsChange(next);
    saveSettings(next);
  }

  function handleSaveGame() {
    if (onSaveGame) {
      onSaveGame();
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    }
  }

  const musicVol = settings.musicVolume ?? settings.soundVolume ?? 0.8;
  const sfxVol   = settings.sfxVolume   ?? settings.soundVolume ?? 0.8;
  const gameSpeed = settings.gameSpeed ?? 30;
  const musicEnabled = settings.musicEnabled !== false;

  if (showControllerOptions) {
    return (
      <ControllerOptionsScreen
        settings={settings}
        onSettingsChange={onSettingsChange}
        onBack={() => setShowControllerOptions(false)}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      data-options-overlay="true"
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/92 backdrop-blur-md overflow-y-auto"
    >
      <motion.div
        initial={{ scale: 0.88, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.05, type: 'spring', stiffness: 200 }}
        className="w-full max-w-sm space-y-4 md:space-y-5 p-4 md:p-8"
      >
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 to-cyan-600 text-center">
          OPTIONS
        </h1>

        {/* Music On/Off + Volume */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-cyan-400 uppercase tracking-widest">
              <Music className="w-4 h-4" />
              Music
            </div>
            <button
              onClick={() => {
                const next = !musicEnabled;
                update('musicEnabled', next);
                sounds.setMusicEnabled(next);
              }}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border transition-all"
              style={{
                borderColor: musicEnabled ? '#00f0ff' : '#444',
                color: musicEnabled ? '#00f0ff' : '#666',
                background: musicEnabled ? '#00f0ff22' : 'transparent',
              }}>
              {musicEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
              {musicEnabled ? 'ON' : 'OFF'}
            </button>
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
          <div className="flex items-center justify-between gap-3 mb-2 text-xs text-muted-foreground">
            <span>Slow</span>
            <span>Fast</span>
          </div>
          <Slider color="#44ff88" min={15} max={120} step={1}
            value={gameSpeed}
            onChange={v => update('gameSpeed', v)}
            label="" />
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

        {/* Controller Settings Button */}
        <Button onClick={() => setShowControllerOptions(true)} variant="outline" className="w-full gap-2 mt-2">
          <Smartphone className="w-4 h-4" />
          Controller Settings
        </Button>

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

        {gameState === 'playing' && (
          <Button onClick={handleSaveGame} variant="outline" className={`w-full gap-2 mt-2 transition-colors ${savedFlash ? 'border-green-500 text-green-400' : ''}`}>
            {savedFlash ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {savedFlash ? 'Saved!' : 'Save Game'}
          </Button>
        )}

        {gameState === 'playing' && bossMode && onOpenShop && (
          <Button onClick={onOpenShop} variant="outline" className="w-full gap-2 mt-2 border-amber-500/60 text-amber-300 hover:bg-amber-900/25">
            <Wrench className="w-4 h-4" />
            Open Test Shop
          </Button>
        )}

        {onExitToTitle && (
          <Button onClick={onExitToTitle} variant="outline" className="w-full gap-2 mt-2 text-red-400 border-red-600 hover:bg-red-900/30">
            <LogOut className="w-4 h-4" />
            Exit to Title
          </Button>
        )}

        <Button onClick={onBack} variant="outline" className="w-full gap-2 mt-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
      </motion.div>
    </motion.div>
  );
}