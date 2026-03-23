import React, { useState, useCallback, useRef, useEffect } from 'react';
import GameCanvas from '../components/game/GameCanvas.jsx';
import BossWarning from '../components/game/BossWarning.jsx';
import GameHUD from '../components/game/GameHUD';
import HighScores, { isHighScore } from '../components/game/HighScores';
import ContinueScreen from '../components/game/ContinueScreen';
import StartScreen from '../components/game/StartScreen';
import OptionsScreen from '../components/game/OptionsScreen';
import CongratulationsScreen from '../components/game/CongratulationsScreen';
import { loadSettings, saveSettings, DIFFICULTY_CONFIG, loadSaveFile, writeSaveFile, deleteSaveFile } from '../lib/gameSettings';
import { sounds } from '../hooks/useSound.js';
import IntroCrawl from '../components/game/IntroCrawl';
import { loadShopUpgrades, saveShopUpgrades } from '../lib/shopUpgrades';
import DockingScene from '../components/game/DockingScene';
import ShopScreen from '../components/game/ShopScreen';
import LaunchScreen from '../components/game/LaunchScreen.jsx';
import { loadSprites, isSpritesLoaded } from '../lib/spriteLoader.js';

const CONTINUE_SCORE_THRESHOLD = 1000; // score needed to earn a continue
const MAX_CONTINUES = 3;

const DIFFICULTY_MILESTONES = {
  easy: 25,
  normal: 50,
  hell: 100,
};

const NEXT_DIFFICULTY = {
  easy: 'normal',
  normal: 'hell',
  hell: null,
};

export default function Game() {
  const [showIntro, setShowIntro] = useState(true);
  const [gameState, setGameState] = useState('start');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [maxLives, setMaxLives] = useState(3);
  const [wave, setWave] = useState(1);
  const [activePowerup, setActivePowerup] = useState({});
  const [armorHp, setArmorHp] = useState(0);
  const [blockScore, setBlockScore] = useState(0);
  const [carryOverPowerups, setCarryOverPowerups] = useState(null);
  const [startWave, setStartWave] = useState(1);
  const [continuesLeft, setContinuesLeft] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [settings, setSettings] = useState(() => loadSettings());
  const [bossWarning, setBossWarning] = useState(null);
  const [shopUpgrades, setShopUpgrades] = useState(() => ({ armor: 0, repair: 0, drone: 0, harvester: 0 }));
  const [showPauseOptions, setShowPauseOptions] = useState(false);
  const [showDocking, setShowDocking] = useState(false);
  const [dockingMode, setDockingMode] = useState('arriving');
  const [showShop, setShowShop] = useState(false);
  const [showLaunch, setShowLaunch] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const scoreRef = useRef(0);

  // Preload sprites immediately on mount so LaunchScreen has them ready
  React.useEffect(() => {
    loadSprites(() => {}, (progress) => setLoadProgress(progress));
  }, []);
  const waveRef = useRef(1);

  const handleScoreChange = useCallback((s) => {
    scoreRef.current = s;
    setScore(s);
  }, []);

  const handleWaveChange = useCallback((w) => {
    waveRef.current = w;
    setWave(w);
    // After completing a boss wave (wave becomes 6, 11, 16...) trigger docking
    // But not at milestone waves (25, 50, 100) which trigger congratulations instead
    const milestones = [25, 50, 100];
    const prevWave = w - 1;
    if (prevWave > 0 && prevWave % 5 === 0 && !milestones.includes(prevWave) && !showDocking && !showShop) {
      setDockingMode('arriving');
      setShowDocking(true);
    }
  }, [showDocking, showShop]);

  const [bossMode, setBossMode] = useState(false);

  const handleStart = useCallback((keepPowerups = false, isBossMode = false) => {
    // New game always starts on easy
    if (!keepPowerups && !isBossMode) {
      const newSettings = { ...settings, difficulty: 'easy' };
      setSettings(newSettings);
      saveSettings(newSettings);
    }
    setBossMode(isBossMode);
    setShowLaunch(true);
    setLoadProgress(isSpritesLoaded() ? 1 : 0);
    scoreRef.current = 0;
    waveRef.current = isBossMode ? 5 : 1;
    setScore(0);
    setBlockScore(0);
    setLives(3);
    setMaxLives(3);
    setWave(isBossMode ? 5 : 1);
    setStartWave(isBossMode ? 5 : 1);
    if (!keepPowerups) {
      if (isBossMode) {
        // Start boss mode with 3 random gun powerups
        const guns = ['shotgun', 'laser', 'photon', 'bounce', 'missile'];
        const shuffled = [...guns].sort(() => Math.random() - 0.5);
        const startPowerups = {};
        shuffled.slice(0, 3).forEach(gun => { startPowerups[gun] = 1; });
        setCarryOverPowerups(startPowerups);
        setActivePowerup(startPowerups);
      } else {
        // Normal game: never carry over powerups from boss mode
        setCarryOverPowerups(null);
        setActivePowerup({});
      }
      const resetUpgrades = { armor: 0, repair: 0, drone: 0, harvester: 0 };
      setShopUpgrades(resetUpgrades);
      saveShopUpgrades(resetUpgrades);
      deleteSaveFile();
    }
    setContinuesLeft(0);
    setShowDocking(false);
    setShowShop(false);
    // gameState will be set to 'playing' by LaunchScreen.onDone
  }, []);

  const handleLoadGame = useCallback(() => {
    const save = loadSaveFile();
    if (!save) return;
    // Restore difficulty
    const savedDifficulty = save.difficulty || 'normal';
    const newSettings = { ...settings, difficulty: savedDifficulty };
    setSettings(newSettings);
    saveSettings(newSettings);
    // Restore shop upgrades
    const savedShopUpgrades = save.shopUpgrades || { armor: 0, repair: 0, drone: 0, harvester: 0 };
    setShopUpgrades(savedShopUpgrades);
    saveShopUpgrades(savedShopUpgrades);
    // Restore powerups
    const savedPowerups = save.powerups || {};
    setCarryOverPowerups(savedPowerups);
    // Immediately seed the HUD powerup display
    setActivePowerup({ ...savedPowerups });
    if (savedPowerups.armorHp !== undefined) setArmorHp(savedPowerups.armorHp);
    // Restore block score so player keeps their currency
    setBlockScore(save.blockScore || 0);
    // Resume at the saved wave
    const savedWave = save.wave || 1;
    waveRef.current = savedWave;
    setWave(savedWave);
    setStartWave(savedWave);
    scoreRef.current = 0;
    setScore(0);
    setLives(3);
    setMaxLives(3);
    setContinuesLeft(0);
    setShowDocking(false);
    setShowShop(false);
    setShowLaunch(true);
    setLoadProgress(isSpritesLoaded() ? 1 : 0);
    // gameState will be set to 'playing' by LaunchScreen.onDone
  }, [settings]);

  // Called by canvas when lives hit 0 or wave milestone reached
  const handleSetGameState = useCallback((state) => {
    if (state === 'continue') {
      const earned = Math.min(Math.floor(scoreRef.current / CONTINUE_SCORE_THRESHOLD), MAX_CONTINUES);
      setContinuesLeft(prev => {
        // If we already have continues available, just show the screen
        if (prev > 0) { setGameState('continue'); return prev; }
        if (earned > 0) { setGameState('continue'); return earned; }
        setGameState('gameover');
        return 0;
      });
    } else if (state === 'congratulations') {
      // Check if current wave matches difficulty milestone
      const milestone = DIFFICULTY_MILESTONES[settings.difficulty];
      if (waveRef.current === milestone && NEXT_DIFFICULTY[settings.difficulty]) {
        setGameState('congratulations');
      } else {
        setGameState('gameover');
      }
    } else {
      setGameState(state);
    }
  }, [settings.difficulty]);

  const handleContinue = useCallback(() => {
    scoreRef.current = Math.max(0, scoreRef.current - 5000);
    setScore(scoreRef.current);
    setGameState('resuming');
  }, []);

  const handleRestartBossMode = useCallback(() => {
    handleStart(false, true);
  }, [handleStart]);

  const handleContinueUsed = useCallback(() => {
    setContinuesLeft(c => Math.max(0, c - 1));
  }, []);

  const handleDecline = useCallback(() => {
    if (!bossMode) sounds.stopAllMusic();
    setGameState('gameover');
  }, [bossMode]);

  const handleProgressToDifficulty = useCallback(() => {
    const nextDifficulty = NEXT_DIFFICULTY[settings.difficulty];
    if (nextDifficulty) {
      const newSettings = { ...settings, difficulty: nextDifficulty };
      handleSettingsChange(newSettings);
      // Snapshot current powerups to carry over
      setCarryOverPowerups({ ...activePowerup });
      handleStart(true);
    }
  }, [settings, handleStart, activePowerup]);

  const handlePauseToggle = useCallback(() => {
    if (isPaused && showPauseOptions) {
      // Already in options — unpause and close
      setIsPaused(false);
      setShowPauseOptions(false);
    } else {
      // Open options screen directly
      setIsPaused(true);
      setShowPauseOptions(true);
    }
  }, [isPaused, showPauseOptions]);

  const handleSettingsChange = useCallback((next) => {
    const prevDifficulty = settings.difficulty;
    setSettings(next);
    saveSettings(next);
    // If difficulty changed during gameplay, reload current wave with new config
    if (next.difficulty !== prevDifficulty && (gameState === 'playing' || gameState === 'resuming')) {
      setStartWave(waveRef.current);
      setCarryOverPowerups({ ...activePowerup });
      setShowPauseOptions(false);
      setIsPaused(false);
      setShowLaunch(true);
      setLoadProgress(isSpritesLoaded() ? 1 : 0);
    }
  }, [settings.difficulty, gameState, activePowerup]);

  const handleSaveGame = useCallback(() => {
    writeSaveFile({
      wave: waveRef.current,
      difficulty: settings.difficulty,
      powerups: activePowerup,
      shopUpgrades: shopUpgrades,
      blockScore: blockScore,
    });
  }, [settings.difficulty, activePowerup, shopUpgrades, blockScore]);

  const handleShopBuy = useCallback((upgradeId) => {
    setShopUpgrades(prev => {
      const newUpgrades = { ...prev, [upgradeId]: (prev[upgradeId] || 0) + 1 };
      saveShopUpgrades(newUpgrades);
      return newUpgrades;
    });
    // Also deduct from blockScore — stored in ref for canvas, update React state
    setBlockScore(prev => {
      // Cost calculation mirrors shopUpgrades.js
      const currentLevel = shopUpgrades[upgradeId] || 0;
      const COSTS = { armor: (l) => (l + 1) * 200, repair: (l) => (l + 1) * 180, drone: (l) => (l + 1) * 250, harvester: (l) => (l + 1) * 220 };
      const cost = COSTS[upgradeId] ? COSTS[upgradeId](currentLevel) : 0;
      return Math.max(0, prev - cost);
    });
  }, [shopUpgrades]);

  // Enter key toggles pause during gameplay
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Enter' && (gameState === 'playing' || gameState === 'resuming')) {
        setIsPaused(p => {
          const next = !p;
          setShowPauseOptions(next);
          return next;
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gameState]);

  // Title music is triggered by user click in StartScreen (browser requires user gesture)

  // Auto-save when game ends so Load Game is available on title screen
  useEffect(() => {
    if (gameState === 'gameover') {
      if (!bossMode) sounds.playGameOverMusic();
      writeSaveFile({
        wave: waveRef.current,
        difficulty: settings.difficulty,
        powerups: activePowerup,
        shopUpgrades: shopUpgrades,
        blockScore: blockScore,
      });
    }
  }, [gameState, bossMode]);

  // Play win music on congratulations screen
  useEffect(() => {
    if (gameState === 'congratulations') sounds.playWinMusic();
  }, [gameState]);

  // Apply separate music/sfx volumes when settings change
  useEffect(() => {
    sounds.setMusicVolume(settings.musicVolume ?? settings.soundVolume ?? 0.8);
  }, [settings.musicVolume, settings.soundVolume]);

  useEffect(() => {
    sounds.setSfxVolume(settings.sfxVolume ?? settings.soundVolume ?? 0.8);
  }, [settings.sfxVolume, settings.soundVolume]);

  const difficultyConfig = DIFFICULTY_CONFIG[settings.difficulty] || DIFFICULTY_CONFIG.normal;

  if (showIntro) {
    return <IntroCrawl onDone={() => setShowIntro(false)} />;
  }

  return (
    <div
      className="relative w-full h-screen overflow-hidden bg-black select-none touch-none"
      tabIndex={-1}
      style={{ filter: `brightness(${settings.brightness})` }}
    >
      {/* LaunchScreen overlays the game — GameCanvas is always mounted and initializing underneath */}
      {showLaunch && (
        <LaunchScreen
          loadProgress={loadProgress}
          onDone={() => { setGameState('playing'); setShowLaunch(false); }}
        />
      )}

      <GameCanvas
        gameState={gameState}
        setGameState={handleSetGameState}
        onScoreChange={handleScoreChange}
        onBlockScoreChange={setBlockScore}
        onLivesChange={setLives}
        onMaxLivesChange={setMaxLives}
        onWaveChange={handleWaveChange}
        onPowerupChange={(pw) => { setActivePowerup(pw); if (pw.armorHp !== undefined) setArmorHp(pw.armorHp); }}
        onBossWarning={setBossWarning}
        continuesLeft={continuesLeft}
        onContinueUsed={handleContinueUsed}
        isPaused={isPaused || showDocking || showShop}
          difficultyConfig={difficultyConfig}
        gameSpeed={settings.gameSpeed ?? 30}
        carryOverPowerups={carryOverPowerups}
        shopUpgrades={shopUpgrades}
        startWave={startWave}
        onLoadProgress={setLoadProgress}
        bossMode={bossMode}
        mobileSpeed={settings.mobileSpeed ?? 1.0}
        joystickVisible={settings.joystickVisible !== false}
        joystickSize={settings.joystickSize ?? 1.0}
      />

      <BossWarning warning={bossWarning} />

      {(gameState === 'playing' || gameState === 'resuming') && (
        <GameHUD
          score={score}
          lives={lives}
          maxLives={maxLives}
          wave={wave}
          activePowerup={activePowerup}
          blockScore={blockScore}
          continuesLeft={continuesLeft}
          isPaused={isPaused}
          onPauseToggle={handlePauseToggle}
          onOpenOptions={() => setShowPauseOptions(true)}
          shopUpgrades={gameState === 'playing' ? shopUpgrades : {}}
          armorHp={armorHp}
        />
      )}

      {/* Pause options overlay */}
      {showPauseOptions && isPaused && (
        <OptionsScreen
          settings={settings}
          onSettingsChange={handleSettingsChange}
          gameState="playing"
          onSaveGame={handleSaveGame}
          onExitToTitle={() => {
            sounds.stopAllMusic();
            setGameState('start');
            setShowPauseOptions(false);
          }}
          onBack={() => {
            setShowPauseOptions(false);
            setIsPaused(false);
          }}
        />
      )}

      {gameState === 'start' && !showLaunch && (
        <StartScreen onStart={handleStart} onContinue={handleLoadGame} settings={settings} onSettingsChange={handleSettingsChange} />
      )}

      {gameState === 'continue' && (
        <ContinueScreen
          score={score}
          continuesLeft={continuesLeft}
          onContinue={handleContinue}
          onDecline={handleDecline}
          bossMode={bossMode}
          onRestartBossMode={handleRestartBossMode}
        />
      )}

      {gameState === 'congratulations' && (
        <CongratulationsScreen
          wave={wave}
          score={score}
          currentDifficulty={settings.difficulty}
          nextDifficulty={NEXT_DIFFICULTY[settings.difficulty]}
          onProgressToDifficulty={handleProgressToDifficulty}
          onReturnToTitle={() => setGameState('start')}
        />
      )}

      {/* Docking scene → shop flow (after boss waves) */}
      {showDocking && !showShop && (
        <DockingScene
          mode={dockingMode}
          onDockComplete={() => { setShowDocking(false); setShowShop(true); sounds.playTitleMusic(); }}
          onDepartComplete={() => {
            setCarryOverPowerups({ ...activePowerup });
            setShowDocking(false);
            setGameState('playing');
          }}
        />
      )}
      {showShop && (
        <ShopScreen
          blockScore={blockScore}
          shopUpgrades={shopUpgrades}
          onBuy={handleShopBuy}
          onReturn={() => {
            sounds.stopAllMusic();
            setShowShop(false);
            setStartWave(waveRef.current);
            setDockingMode('departing');
            setShowDocking(true);
          }}
          nextWave={wave}
        />
      )}

      {gameState === 'gameover' && (
        <HighScores
          score={score}
          wave={wave}
          onRestart={handleStart}
          onRestartBossMode={handleRestartBossMode}
          bossMode={bossMode}
          onReturnToTitle={() => {
            const resetUpgrades = { armor: 0, repair: 0, drone: 0, harvester: 0 };
            setShopUpgrades(resetUpgrades);
            saveShopUpgrades(resetUpgrades);
            setGameState('start');
          }}
          isNewScore={isHighScore(score, bossMode)}
        />
      )}
    </div>
  );
}