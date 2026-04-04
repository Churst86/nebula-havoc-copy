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

const EMPTY_SHOP_UPGRADES = { armor: 0, repair: 0, drone: 0, harvester: 0, speed: 0, rapidfire: 0, shield: 0, wingman: 0 };
const BOSS_TEST_WEAPONS = ['spread', 'laser', 'photon', 'bounce', 'missile', 'reverse'];

function difficultyForWave(wave = 1) {
  if (wave > DIFFICULTY_MILESTONES.normal) return 'hell';
  if (wave > DIFFICULTY_MILESTONES.easy) return 'normal';
  return 'easy';
}

function normalizeDifficultyForWave(savedDifficulty, wave = 1) {
  const byWave = difficultyForWave(wave);
  const order = { easy: 1, normal: 2, hell: 3 };
  const fromSave = order[savedDifficulty] ? savedDifficulty : byWave;
  return order[fromSave] >= order[byWave] ? fromSave : byWave;
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
        deleteSaveFile();
      }
    }
    setContinuesLeft(0);
    setIsPaused(false);
    setShowPauseOptions(false);
    setShowDocking(false);
    setShowShop(false);
    setShowBossMiniShop(false);
    setSkipBossSignal(0);
    setLastDockingWave(-1);
    // gameState will be set to 'playing' by LaunchScreen.onDone
  }, []);

  const handleLoadGame = useCallback(() => {
    const save = loadSaveFile();
    if (!save) return;
    setBossMode(false);
    const savedWave = save.wave || 1;
    const savedDifficulty = normalizeDifficultyForWave(save.difficulty, savedWave);
    // Restore difficulty
    const newSettings = { ...settings, difficulty: savedDifficulty };
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
    // Resume at the saved wave
    waveRef.current = savedWave;
    setWave(savedWave);
    setStartWave(savedWave);
    scoreRef.current = 0;
    setScore(0);
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
      setCarryOverPowerups(normalizePowerups({ ...activePowerup }));
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
    if (bossMode) return;
    writeSaveFile({
      wave: waveRef.current,
      difficulty: settings.difficulty,
      powerups: activePowerup,
      shopUpgrades: shopUpgrades,
      blockScore: blockScore,
    });
  }, [settings.difficulty, activePowerup, shopUpgrades, blockScore, bossMode]);

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
        });
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
        continuesLeft={continuesLeft}
        onContinueUsed={handleContinueUsed}
        isPaused={isPaused || showDocking || showShop || showBossMiniShop}
        difficultyConfig={difficultyConfig}
        gameSpeed={settings.gameSpeed ?? 30}
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
          activePowerup={activePowerup}
          blockScore={blockScore}
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