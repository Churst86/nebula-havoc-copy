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
import { UPGRADE_DEFS, saveShopUpgrades } from '../lib/shopUpgrades';
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

const DIFFICULTY_ORDER = {
  easy: 1,
  normal: 2,
  hell: 3,
};

const EMPTY_SHOP_UPGRADES = { armor: 0, repair: 0, drone: 0, harvester: 0, speed: 0, rapidfire: 0, shield: 0, wingman: 0 };
const BOSS_TEST_WEAPONS = ['spread', 'laser', 'photon', 'bounce', 'missile', 'reverse'];

function difficultyForWave(wave = 1) {
  if (wave > DIFFICULTY_MILESTONES.normal) return 'hell';
  if (wave > DIFFICULTY_MILESTONES.easy) return 'normal';
  return 'easy';
}

function normalizeDifficultyForWave(savedDifficulty, wave = 1) {
  const byWave = difficultyForWave(wave);
  const fromSave = DIFFICULTY_ORDER[savedDifficulty] ? savedDifficulty : byWave;
  return DIFFICULTY_ORDER[fromSave] >= DIFFICULTY_ORDER[byWave] ? fromSave : byWave;
}

function maxDifficulty(a = 'easy', b = 'easy') {
  return (DIFFICULTY_ORDER[a] || 1) >= (DIFFICULTY_ORDER[b] || 1) ? a : b;
}

function clampDifficultyToUnlocked(requestedDifficulty = 'easy', unlockedDifficulty = 'easy') {
  return (DIFFICULTY_ORDER[requestedDifficulty] || 1) <= (DIFFICULTY_ORDER[unlockedDifficulty] || 1)
    ? requestedDifficulty
    : unlockedDifficulty;
}

const LEGACY_POWERUP_KEY_MAP = {
  shotgun: 'spread',
};

function normalizePowerups(powerups = {}) {
  const normalized = {};
  Object.entries(powerups).forEach(([key, value]) => {
    const mappedKey = key === ('ray' + 'gun') ? 'photon' : (LEGACY_POWERUP_KEY_MAP[key] || key);
    if (typeof value === 'number') {
      normalized[mappedKey] = Math.max(normalized[mappedKey] || 0, value);
    } else {
      normalized[mappedKey] = value;
    }
  });
  return normalized;
}

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
  const [shopUpgrades, setShopUpgrades] = useState(() => ({ ...EMPTY_SHOP_UPGRADES }));
  const [bossShopUpgrades, setBossShopUpgrades] = useState(() => ({ ...EMPTY_SHOP_UPGRADES }));
  const [showPauseOptions, setShowPauseOptions] = useState(false);
  const [showDocking, setShowDocking] = useState(false);
  const [dockingMode, setDockingMode] = useState('arriving');
  const [showShop, setShowShop] = useState(false);
  const [showBossMiniShop, setShowBossMiniShop] = useState(false);
  const [showLaunch, setShowLaunch] = useState(false);
  const [skipBossSignal, setSkipBossSignal] = useState(0);
  const [loadProgress, setLoadProgress] = useState(0);
  const [lastSaveAt, setLastSaveAt] = useState(null);
  const [liveFps, setLiveFps] = useState(0);
  const [hudSpeedMultiplier, setHudSpeedMultiplier] = useState(1);
  const scoreRef = useRef(0);
  const lastAutoSaveWaveRef = useRef(null);

  // Preload sprites immediately on mount so LaunchScreen has them ready
  React.useEffect(() => {
    loadSprites(() => {}, (progress) => setLoadProgress(progress));
  }, []);
  const waveRef = useRef(1);

  const handleScoreChange = useCallback((s) => {
    scoreRef.current = s;
    setScore(s);
  }, []);

  const [lastDockingWave, setLastDockingWave] = useState(-1);
  const [bossMode, setBossMode] = useState(false);

  const handleWaveChange = useCallback((w) => {
    waveRef.current = w;
    setWave(w);

    if (bossMode) return;

    // After completing a boss wave trigger docking/shop sequence,
    // except milestone endings that go to congratulations.
    const milestones = [25, 50, 100];
    const prevWave = w - 1;
    if (prevWave > 0 && prevWave % 5 === 0 && !milestones.includes(prevWave) && prevWave !== lastDockingWave) {
      setLastDockingWave(prevWave);
      setDockingMode('arriving');
      setShowDocking(true);
    }
  }, [bossMode, lastDockingWave]);

  const handleStart = useCallback((keepPowerups = false, isBossMode = false) => {
    // Defensive coercion: UI onClick handlers can pass a MouseEvent as the first arg.
    const keepPowerupsFlag = typeof keepPowerups === 'boolean' ? keepPowerups : false;
    const bossModeFlag = typeof isBossMode === 'boolean' ? isBossMode : false;

    // New game always starts on easy
    if (!keepPowerupsFlag && !bossModeFlag) {
      const newSettings = { ...settings, difficulty: 'easy' };
      setSettings(newSettings);
      saveSettings(newSettings);
    }
    setBossMode(bossModeFlag);
    setShowLaunch(true);
    setLoadProgress(isSpritesLoaded() ? 1 : 0);
    scoreRef.current = 0;
    waveRef.current = bossModeFlag ? 5 : 1;
    setScore(0);
    setBlockScore(0);
    setLives(3);
    setMaxLives(3);
    setWave(bossModeFlag ? 5 : 1);
    setStartWave(bossModeFlag ? 5 : 1);
    if (!keepPowerupsFlag) {
      if (bossModeFlag) {
        // Start boss mode with 3 random gun powerups
        const guns = ['spread', 'laser', 'photon', 'bounce', 'missile'];
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
      const resetUpgrades = { ...EMPTY_SHOP_UPGRADES };
      if (bossModeFlag) {
        setBossShopUpgrades(resetUpgrades);
      } else {
        setShopUpgrades(resetUpgrades);
        saveShopUpgrades(resetUpgrades);
      }
      if (!bossModeFlag) {
        deleteSaveFile('auto');
      }
    }
    setContinuesLeft(0);
    setHudSpeedMultiplier(1);
    setIsPaused(false);
    setShowPauseOptions(false);
    setShowDocking(false);
    setShowShop(false);
    setShowBossMiniShop(false);
    setSkipBossSignal(0);
    setLastDockingWave(-1);

    if (!bossModeFlag) {
      writeSaveFile({
        wave: 1,
        difficulty: 'easy',
        powerups: {},
        shopUpgrades: { ...EMPTY_SHOP_UPGRADES },
        blockScore: 0,
      }, 'auto');
      setLastSaveAt(Date.now());
      lastAutoSaveWaveRef.current = 1;
    } else {
      lastAutoSaveWaveRef.current = null;
      setLastSaveAt(null);
    }
    // gameState will be set to 'playing' by LaunchScreen.onDone
  }, []);

  useEffect(() => {
    if (bossMode) return;
    if (wave <= 0) return;
    if (gameState !== 'playing' && gameState !== 'resuming') return;
    if (lastAutoSaveWaveRef.current === wave) return;

    writeSaveFile({
      wave: waveRef.current || wave,
      difficulty: settings.difficulty,
      powerups: activePowerup,
      shopUpgrades: shopUpgrades,
      score: scoreRef.current,
      blockScore: blockScore,
    }, 'auto');
    setLastSaveAt(Date.now());
    lastAutoSaveWaveRef.current = wave;
  }, [wave, bossMode, gameState, settings.difficulty, activePowerup, shopUpgrades, blockScore]);

  const handleLoadGame = useCallback((slot = 'auto') => {
    const save = loadSaveFile(slot);
    if (!save) return;
    setBossMode(false);
    setHudSpeedMultiplier(1);
    const savedWave = save.wave || 1;
    const savedDifficulty = normalizeDifficultyForWave(save.difficulty, savedWave);
    const unlockedByWave = difficultyForWave(savedWave);
    const currentUnlocked = settings.unlockedDifficulty || 'easy';
    const unlockedDifficulty = maxDifficulty(currentUnlocked, unlockedByWave);
    const restoredDifficulty = clampDifficultyToUnlocked(savedDifficulty, unlockedDifficulty);
    // Restore difficulty
    const newSettings = { ...settings, difficulty: restoredDifficulty, unlockedDifficulty };
    setSettings(newSettings);
    saveSettings(newSettings);
    // Restore shop upgrades
    const savedShopUpgrades = save.shopUpgrades || { armor: 0, repair: 0, drone: 0, harvester: 0 };
    setShopUpgrades(savedShopUpgrades);
    saveShopUpgrades(savedShopUpgrades);
    // Restore powerups
    const savedPowerups = normalizePowerups(save.powerups || {});
    setCarryOverPowerups(savedPowerups);
    // Immediately seed the HUD powerup display
    setActivePowerup({ ...savedPowerups });
    if (savedPowerups.armorHp !== undefined) setArmorHp(savedPowerups.armorHp);
    // Restore block score so player keeps their currency
    setBlockScore(save.blockScore || 0);
    // Restore score
    scoreRef.current = Math.max(0, Number(save.score) || 0);
    setScore(scoreRef.current);
    // Resume at the saved wave
    waveRef.current = savedWave;
    setWave(savedWave);
    setStartWave(savedWave);
    setLives(3);
    setMaxLives(3);
    setContinuesLeft(0);
    setIsPaused(false);
    setShowPauseOptions(false);
    setShowDocking(false);
    setShowShop(false);
    setShowBossMiniShop(false);
    setSkipBossSignal(0);
    setLastDockingWave(-1);
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
      // Canvas advances to the next wave before signaling completion,
      // so compare against the completed wave (current - 1).
      const milestone = DIFFICULTY_MILESTONES[settings.difficulty];
      const completedWave = waveRef.current - 1;
      if (completedWave === milestone) {
        const nextDifficulty = NEXT_DIFFICULTY[settings.difficulty];
        if (nextDifficulty) {
          setSettings(prev => {
            const currentUnlocked = prev.unlockedDifficulty || 'easy';
            const unlockedDifficulty = maxDifficulty(currentUnlocked, nextDifficulty);
            if (unlockedDifficulty === currentUnlocked) return prev;
            const updated = { ...prev, unlockedDifficulty };
            saveSettings(updated);
            return updated;
          });
        }
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
    setHudSpeedMultiplier(1);
    setGameState('gameover');
  }, [bossMode]);

  const handleSettingsChange = useCallback((next) => {
    const prevDifficulty = settings.difficulty;
    const unlockedDifficulty = next.unlockedDifficulty || settings.unlockedDifficulty || 'easy';
    const requestedDifficulty = next.difficulty || 'easy';
    const safeDifficulty = clampDifficultyToUnlocked(requestedDifficulty, unlockedDifficulty);
    const safeNext = { ...next, unlockedDifficulty, difficulty: safeDifficulty };
    setSettings(safeNext);
    saveSettings(safeNext);
    // If difficulty changed during gameplay, reload current wave with new config
    if (safeNext.difficulty !== prevDifficulty && (gameState === 'playing' || gameState === 'resuming')) {
      setStartWave(waveRef.current);
      setCarryOverPowerups({ ...activePowerup });
      setShowPauseOptions(false);
      setIsPaused(false);
      setShowLaunch(true);
      setLoadProgress(isSpritesLoaded() ? 1 : 0);
    }
  }, [settings.difficulty, settings.unlockedDifficulty, gameState, activePowerup]);

  const handleProgressToDifficulty = useCallback(() => {
    const nextDifficulty = NEXT_DIFFICULTY[settings.difficulty];
    if (nextDifficulty) {
      const completedMilestone = DIFFICULTY_MILESTONES[settings.difficulty];
      const nextWave = completedMilestone + 1;

      const newSettings = { ...settings, difficulty: nextDifficulty };
      handleSettingsChange(newSettings);

      // Carry over powerups, shop upgrades, block score, wave count, and score
      const carriedPowerups = normalizePowerups({ ...activePowerup });
      setCarryOverPowerups(carriedPowerups);
      setActivePowerup(carriedPowerups);

      waveRef.current = nextWave;
      setWave(nextWave);
      setStartWave(nextWave);
      // score, blockScore, and shop upgrades all carry over unchanged
      setLives(3);
      setMaxLives(3);
      setContinuesLeft(0);
      setIsPaused(false);
      setShowPauseOptions(false);
      setShowDocking(false);
      setShowShop(false);
      setShowBossMiniShop(false);
      setSkipBossSignal(0);
      setLastDockingWave(-1);

      // Persist the carry-over state so autosave reflects the new difficulty leg
      writeSaveFile({
        wave: nextWave,
        difficulty: nextDifficulty,
        powerups: carriedPowerups,
        shopUpgrades: shopUpgrades,
        score: scoreRef.current,
        blockScore: blockScore,
      }, 'auto');
      lastAutoSaveWaveRef.current = nextWave;

      setShowLaunch(true);
      setLoadProgress(isSpritesLoaded() ? 1 : 0);
    }
  }, [settings, handleSettingsChange, activePowerup, shopUpgrades, blockScore]);

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

  const handleHudSpeedMultiplierChange = useCallback((multiplier) => {
    const next = Number(multiplier);
    if (![1, 2, 3].includes(next)) return;
    setHudSpeedMultiplier(next);
  }, []);

  const handleSaveGame = useCallback((slot = 'slot1') => {
    if (bossMode) return false;
    const ok = writeSaveFile({
      wave: waveRef.current,
      difficulty: settings.difficulty,
      powerups: activePowerup,
      shopUpgrades: shopUpgrades,
      score: scoreRef.current,
      blockScore: blockScore,
    }, slot);
    if (ok) setLastSaveAt(Date.now());
    return ok;
  }, [settings.difficulty, activePowerup, shopUpgrades, blockScore, bossMode]);

  const writeAutoSave = useCallback(() => {
    if (bossMode) return;
    writeSaveFile({
      wave: waveRef.current,
      difficulty: settings.difficulty,
      powerups: activePowerup,
      shopUpgrades: shopUpgrades,
      score: scoreRef.current,
      blockScore: blockScore,
    }, 'auto');
    setLastSaveAt(Date.now());
  }, [bossMode, settings.difficulty, activePowerup, shopUpgrades, blockScore]);

  useEffect(() => {
    if (bossMode) return;
    if (gameState !== 'playing' && gameState !== 'resuming') return;

    const autoSaveId = window.setInterval(() => {
      writeAutoSave();
    }, 12000);

    const flushSave = () => {
      writeAutoSave();
    };

    const onVisibilityChange = () => {
      if (document.hidden) flushSave();
    };

    window.addEventListener('beforeunload', flushSave);
    window.addEventListener('pagehide', flushSave);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(autoSaveId);
      window.removeEventListener('beforeunload', flushSave);
      window.removeEventListener('pagehide', flushSave);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [bossMode, gameState, writeAutoSave]);

  const handleShopBuy = useCallback((upgradeId, useBossShop = false) => {
    const def = UPGRADE_DEFS.find((upgradeDef) => upgradeDef.id === upgradeId);
    const source = useBossShop ? bossShopUpgrades : shopUpgrades;
    const currentLevel = source[upgradeId] || 0;
    const cost = def ? def.cost(currentLevel) : 0;
    if (blockScore < cost) return;

    if (useBossShop) {
      setBossShopUpgrades(prev => ({ ...prev, [upgradeId]: (prev[upgradeId] || 0) + 1 }));
    } else {
      setShopUpgrades(prev => {
        const newUpgrades = { ...prev, [upgradeId]: (prev[upgradeId] || 0) + 1 };
        saveShopUpgrades(newUpgrades);
        return newUpgrades;
      });
    }

    setBlockScore(prev => Math.max(0, prev - cost));
  }, [shopUpgrades, bossShopUpgrades, blockScore]);

  const handleBossWeaponTierChange = useCallback((weaponId, requestedLevel) => {
    if (!BOSS_TEST_WEAPONS.includes(weaponId)) return;
    const nextLevel = Math.max(0, Math.min(10, requestedLevel));
    setActivePowerup(prev => {
      const next = { ...prev };
      if (nextLevel <= 0) delete next[weaponId];
      else next[weaponId] = nextLevel;
      return next;
    });
  }, []);

  const handleBossCoreUpgradeTierChange = useCallback((upgradeId, requestedLevel) => {
    if (!Object.prototype.hasOwnProperty.call(EMPTY_SHOP_UPGRADES, upgradeId)) return;
    const nextLevel = Math.max(0, Math.min(10, requestedLevel));
    setBossShopUpgrades(prev => ({ ...prev, [upgradeId]: nextLevel }));
  }, []);

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

  // Auto-decrement boss warning timer for flashing/fade behavior.
  useEffect(() => {
    if (!bossWarning?.active) return;
    const id = window.setInterval(() => {
      setBossWarning(prev => {
        if (!prev?.active) return prev;
        const nextTimer = (prev.timer || 0) - 1;
        if (nextTimer <= 0) return { active: false, timer: 0 };
        return { ...prev, timer: nextTimer };
      });
    }, 16);
    return () => window.clearInterval(id);
  }, [bossWarning?.active]);

  // Mobile: tap anywhere on screen to open settings
  React.useEffect(() => {
    const onTap = (e) => {
      if (typeof window === 'undefined' || window.innerWidth >= 768) return; // Desktop only
      if (e.target && e.target.closest && e.target.closest('[data-options-overlay="true"]')) return;
      if ((gameState === 'playing' || gameState === 'resuming') && !isPaused && !showPauseOptions) {
        setIsPaused(true);
        setShowPauseOptions(true);
      }
    };
    window.addEventListener('click', onTap);
    return () => window.removeEventListener('click', onTap);
  }, [gameState, isPaused, showPauseOptions]);

  // Title music is triggered by user click in StartScreen (browser requires user gesture)

  // Auto-save when game ends so Load Game is available on title screen
  useEffect(() => {
    if (gameState === 'gameover') {
      if (!bossMode) sounds.playGameOverMusic();
      if (!bossMode) {
        writeSaveFile({
          wave: waveRef.current,
          difficulty: settings.difficulty,
          powerups: activePowerup,
          shopUpgrades: shopUpgrades,
          blockScore: blockScore,
        }, 'auto');
        setLastSaveAt(Date.now());
      }
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
  const hudSpeedControlsUnlocked = settings.hudSpeedBoostsUnlocked === true;

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
          onDone={() => {
            setIsPaused(false);
            setShowPauseOptions(false);
            setGameState('playing');
            setShowLaunch(false);
          }}
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
        onFpsChange={setLiveFps}
        continuesLeft={continuesLeft}
        onContinueUsed={handleContinueUsed}
        isPaused={isPaused || showDocking || showShop || showBossMiniShop}
        difficultyConfig={difficultyConfig}
        gameSpeed={settings.gameSpeed ?? 30}
        speedBoostMultiplier={hudSpeedMultiplier}
        autoFireEnabled={settings.autoFireEnabled !== false}
        carryOverPowerups={carryOverPowerups}
        livePowerups={bossMode ? activePowerup : null}
        shopUpgrades={bossMode ? bossShopUpgrades : shopUpgrades}
        startWave={startWave}
        onLoadProgress={setLoadProgress}
        bossMode={bossMode}
        skipBossSignal={skipBossSignal}
        mobileSpeed={settings.mobileSpeed ?? 1.0}
        joystickVisible={settings.joystickVisible !== false && !settings.motionControlEnabled}
        joystickSize={settings.joystickSize ?? 1.0}
        motionControlEnabled={settings.motionControlEnabled ?? true}
        motionInvertX={settings.motionInvertX ?? true}
        motionInvertY={settings.motionInvertY ?? false}
        motionAccelSpeed={settings.accelerometerSpeed ?? 5.0}
      />

      <BossWarning warning={bossWarning} />

      {(gameState === 'playing' || gameState === 'resuming') && (
        <GameHUD
          score={score}
          lives={lives}
          maxLives={maxLives}
          wave={wave}
          liveFps={liveFps}
          activePowerup={activePowerup}
          blockScore={blockScore}
          speedMultiplier={hudSpeedMultiplier}
          speedControlsUnlocked={hudSpeedControlsUnlocked}
          onSpeedMultiplierChange={handleHudSpeedMultiplierChange}
          autoFireEnabled={settings.autoFireEnabled !== false}
          lastSaveAt={lastSaveAt}
          continuesLeft={continuesLeft}
          isPaused={isPaused}
          onPauseToggle={handlePauseToggle}
          onOpenOptions={() => setShowPauseOptions(true)}
          shopUpgrades={gameState === 'playing' ? (bossMode ? bossShopUpgrades : shopUpgrades) : {}}
          armorHp={armorHp}
        />
      )}

      {bossMode && (gameState === 'playing' || gameState === 'resuming') && !showLaunch && (
        <button
          type="button"
          onClick={() => setSkipBossSignal(v => v + 1)}
          className="absolute top-3 right-3 z-50 rounded-md border border-emerald-400/70 bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold tracking-wide text-emerald-200 hover:bg-emerald-500/35 active:scale-[0.98]"
        >
          Skip Boss
        </button>
      )}

      {/* Pause options overlay */}
      {showPauseOptions && isPaused && (
        <OptionsScreen
          settings={settings}
          onSettingsChange={handleSettingsChange}
          gameState="playing"
          onSaveGame={handleSaveGame}
          bossMode={bossMode}
          onOpenShop={bossMode ? (() => { setShowPauseOptions(false); setShowBossMiniShop(true); }) : undefined}
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

      {showBossMiniShop && bossMode && (
        <ShopScreen
          blockScore={blockScore}
          shopUpgrades={bossShopUpgrades}
          onBuy={(upgradeId) => handleShopBuy(upgradeId, true)}
          onReturn={() => {
            setShowBossMiniShop(false);
            setIsPaused(false);
            setShowPauseOptions(false);
          }}
          nextWave={wave}
          showWeaponEditor
          weaponLevels={activePowerup}
          onWeaponLevelChange={handleBossWeaponTierChange}
          coreUpgradeLevels={bossShopUpgrades}
          onCoreUpgradeLevelChange={handleBossCoreUpgradeTierChange}
          shopTitle="BOSS LAB"
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
          completedWave={DIFFICULTY_MILESTONES[settings.difficulty] || Math.max(1, wave - 1)}
          nextWave={(DIFFICULTY_MILESTONES[settings.difficulty] || Math.max(1, wave - 1)) + 1}
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
          onBuy={(upgradeId) => handleShopBuy(upgradeId, false)}
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
            const resetUpgrades = { ...EMPTY_SHOP_UPGRADES };
            setHudSpeedMultiplier(1);
            if (bossMode) {
              setBossShopUpgrades(resetUpgrades);
            } else {
              setShopUpgrades(resetUpgrades);
              saveShopUpgrades(resetUpgrades);
            }
            setGameState('start');
          }}
          isNewScore={isHighScore(score, bossMode)}
        />
      )}
    </div>
  );
}