import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Music, Volume2, VolumeX, Sun, Skull, Gauge, Save, LogOut, CheckCircle, Smartphone, Wrench, Lock, Keyboard } from 'lucide-react';
import { DIFFICULTY_CONFIG, saveSettings, loadAllSaveFiles } from '../../lib/gameSettings';
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

const DIFFICULTY_LABELS = {
  easy: 'Easy',
  normal: 'Challenging',
  hell: 'Hell',
};

const SLOT_META = [
  { key: 'slot1', label: 'Slot 1', accent: '#4dd0ff' },
  { key: 'slot2', label: 'Slot 2', accent: '#8f9bff' },
  { key: 'slot3', label: 'Slot 3', accent: '#7dffb2' },
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

export default function OptionsScreen({ settings, onSettingsChange, onBack, gameState, onExitToTitle, onSaveGame, bossMode = false, onOpenShop }) {
  const [savedFlash, setSavedFlash] = useState(false);
  const [savedLabel, setSavedLabel] = useState('Saved!');
  const [showSaveSlots, setShowSaveSlots] = useState(false);
  const [showControllerOptions, setShowControllerOptions] = useState(false);
  const [showCodePanel, setShowCodePanel] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [codeStatus, setCodeStatus] = useState('');
  const [saves, setSaves] = useState({});
  const [confirmOverwrite, setConfirmOverwrite] = useState(null);

  useEffect(() => {
    if (showSaveSlots) {
      const allSaves = loadAllSaveFiles();
      setSaves(allSaves || {});
    }
  }, [showSaveSlots]);

  function update(key, value) {
    const next = { ...settings, [key]: value };
    onSettingsChange(next);
    saveSettings(next);
  }

  function handleSaveGame(slotKey) {
    console.log(`[OptionsScreen] handleSaveGame called with slotKey: ${slotKey}`);
    console.log(`[OptionsScreen] saves object:`, saves);
    console.log(`[OptionsScreen] save for ${slotKey}:`, saves?.[slotKey]);
    
    const save = saves?.[slotKey];
    
    // If slot is occupied, show confirmation first
    if (save) {
      console.log(`[OptionsScreen] Slot ${slotKey} occupied, showing confirmation`);
      setConfirmOverwrite(slotKey);
      return;
    }
    
    // Slot is empty, save directly
    console.log(`[OptionsScreen] Slot ${slotKey} empty, proceeding with save`);
    proceedWithSave(slotKey);
  }

  function proceedWithSave(slotKey) {
    if (onSaveGame) {
      console.log(`[Options] Attempting to save to ${slotKey}...`);
      const ok = onSaveGame(slotKey);
      if (ok) {
        console.log(`[Options] Save to ${slotKey} succeeded`);
        setSavedLabel(`Saved to ${slotKey.toUpperCase()}`);
        setSavedFlash(true);
        setShowSaveSlots(false);
        setConfirmOverwrite(null);
        setTimeout(() => setSavedFlash(false), 2000);
      } else {
        console.error(`[Options] Save to ${slotKey} FAILED`);
        setSavedLabel(`Save FAILED!`);
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 3000);
      }
    }
  }

  const musicVol = settings.musicVolume ?? settings.soundVolume ?? 0.8;
  const sfxVol   = settings.sfxVolume   ?? settings.soundVolume ?? 0.8;
  const gameSpeed = settings.gameSpeed ?? 30;
  const musicEnabled = settings.musicEnabled !== false;
  const unlockedDifficulty = settings.unlockedDifficulty || 'easy';
  const godModeUnlocked = settings.hudSpeedBoostsUnlocked === true && settings.bossModeUnlocked === true;
  const difficultyRank = { easy: 1, normal: 2, hell: 3 };

  function handleCodeSubmit(event) {
    event.preventDefault();
    const normalized = codeInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!normalized) {
      setCodeStatus('Enter a code first.');
      return;
    }
    if (normalized === 'GODMODE') {
      const next = {
        ...settings,
        hudSpeedBoostsUnlocked: true,
        bossModeUnlocked: true,
      };
      onSettingsChange(next);
      saveSettings(next);
      setCodeStatus(godModeUnlocked ? 'GODMODE already active. Boss Mode is on the title screen and x2/x3 are on the in-game HUD.' : 'GODMODE accepted. Boss Mode is now on the title screen and x2/x3 are on the in-game HUD.');
      setCodeInput('');
      return;
    }
    setCodeStatus('Code not recognized.');
  }

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
            label={`${gameSpeed} fps`} />
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

        <div className="space-y-2 rounded-xl border border-cyan-900/60 bg-slate-950/50 p-3 md:p-4">
          <Button onClick={() => setShowCodePanel(v => !v)} variant="outline" className="w-full gap-2">
            <Keyboard className="w-4 h-4" />
            {showCodePanel ? 'Hide Codes' : 'Codes'}
          </Button>

          {showCodePanel && (
            <form onSubmit={handleCodeSubmit} className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-amber-300 uppercase tracking-widest">
                <Lock className="w-4 h-4" />
                Unlock Codes
              </div>
              <input
                type="text"
                value={codeInput}
                onChange={(e) => {
                  setCodeInput(e.target.value);
                  if (codeStatus) setCodeStatus('');
                }}
                placeholder="Enter code"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                className="w-full rounded-lg border border-cyan-500/40 bg-slate-900/90 px-3 py-2 text-center font-mono text-sm tracking-[0.35em] text-cyan-100 outline-none transition focus:border-cyan-300"
              />
              <Button type="submit" className="w-full bg-amber-500 text-slate-950 hover:bg-amber-400">
                Submit Code
              </Button>
              <div className="rounded-lg border border-slate-700/80 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
                Hidden features: HUD speed boosts and Boss Mode title option.
              </div>
              {godModeUnlocked && (
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-3 py-2 text-xs font-semibold text-emerald-300">
                  GODMODE is active. Start or resume a run to use the x2 and x3 HUD speed buttons.
                </div>
              )}
              {codeStatus && (
                <div className={`text-xs font-semibold ${codeStatus.includes('accepted') || codeStatus.includes('already') ? 'text-emerald-300' : 'text-red-300'}`}>
                  {codeStatus}
                </div>
              )}
            </form>
          )}
        </div>

        {/* Difficulty */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-red-400 uppercase tracking-widest">
            <Skull className="w-4 h-4" />
            Difficulty
          </div>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(DIFFICULTY_CONFIG).map(([key, cfg]) => {
              const isUnlocked = (difficultyRank[key] || 1) <= (difficultyRank[unlockedDifficulty] || 1);
              const isSelected = settings.difficulty === key;
              const unlockHint = key === 'normal' ? 'Beat Easy to unlock' : 'Beat Challenging to unlock';
              return (
                <button
                  key={key}
                  disabled={!isUnlocked}
                  onClick={() => isUnlocked && update('difficulty', key)}
                  className={`relative py-3 px-2 rounded-xl border-2 transition-all text-center ${isUnlocked ? '' : 'opacity-55 cursor-not-allowed'}`}
                  style={{
                    borderColor: !isUnlocked ? '#2c3148' : (isSelected ? cfg.color : '#1a2040'),
                    background: !isUnlocked ? '#0b1022' : (isSelected ? `${cfg.color}22` : 'transparent'),
                    color: !isUnlocked ? '#55607f' : (isSelected ? cfg.color : '#666'),
                  }}
                  title={!isUnlocked ? unlockHint : cfg.desc}
                >
                  <div className="font-black text-sm">{cfg.label}</div>
                  {!isUnlocked && (
                    <div className="mt-1 text-[10px] font-semibold tracking-wide uppercase">Locked</div>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground text-center mt-1">
            {DIFFICULTY_CONFIG[settings.difficulty ?? 'normal'].desc}
          </p>
        </div>

        {gameState === 'playing' && !bossMode && (
          <div className="space-y-2">
            <Button onClick={() => setShowSaveSlots(v => !v)} variant="outline" className={`w-full gap-2 mt-2 transition-colors ${savedFlash ? (savedLabel.includes('FAILED') ? 'border-red-500 text-red-400' : 'border-green-500 text-green-400') : ''}`}>
              {savedFlash ? (savedLabel.includes('FAILED') ? <Skull className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />) : <Save className="w-4 h-4" />}
              {savedFlash ? savedLabel : 'Save Game'}
            </Button>

            {showSaveSlots && (
              <div className="space-y-2 rounded-lg border border-cyan-800/40 bg-cyan-950/10 p-3">
                {SLOT_META.map((slot) => {
                  const save = saves?.[slot.key] || null;
                  const isEmpty = !save;
                  return (
                    <button
                      key={slot.key}
                      onClick={() => handleSaveGame(slot.key)}
                      className={`w-full rounded-lg border px-3 py-2 text-left transition-all text-xs md:text-sm ${isEmpty ? 'opacity-60 hover:scale-[1.02]' : 'hover:scale-105'}`}
                      style={{
                        borderColor: isEmpty ? '#28314b' : slot.accent,
                        background: isEmpty ? '#0a1020' : `${slot.accent}18`,
                      }}
                    >
                      <div className="font-bold tracking-wide" style={{ color: isEmpty ? '#6f7a98' : slot.accent }}>
                        {slot.label}
                      </div>
                      <div className="mt-1 text-xs text-slate-300/75">{formatSave(save)}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
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

        {/* Overwrite Confirmation Modal */}
        <AnimatePresence>
          {confirmOverwrite && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-sm space-y-4 rounded-lg border border-amber-600/60 bg-amber-950/40 p-6"
              >
                <h2 className="text-lg md:text-xl font-black text-amber-200 text-center">
                  OVERWRITE SAVE?
                </h2>
                
                {saves?.[confirmOverwrite] && (
                  <div className="text-xs md:text-sm text-amber-100/80 text-center border border-amber-700/30 rounded-lg p-3 bg-black/30">
                    <div className="font-bold mb-1">Current Save:</div>
                    <div>{formatSave(saves[confirmOverwrite])}</div>
                  </div>
                )}

                <p className="text-xs md:text-sm text-amber-100/70 text-center">
                  This save will be replaced with your current progress.
                </p>

                <div className="flex gap-2">
                  <Button
                    onClick={() => setConfirmOverwrite(null)}
                    variant="outline"
                    className="flex-1 text-xs md:text-sm border-gray-600 text-gray-300 hover:bg-gray-900/50"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => proceedWithSave(confirmOverwrite)}
                    className="flex-1 text-xs md:text-sm border-amber-500 text-amber-100 bg-amber-600/40 hover:bg-amber-600/60"
                  >
                    Overwrite
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}