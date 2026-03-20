import React, { useState, useCallback, useRef, useEffect } from 'react';
import GameCanvas from '../components/game/GameCanvas.jsx';
import BossWarning from '../components/game/BossWarning.jsx';
import GameHUD from '../components/game/GameHUD';
import HighScores, { isHighScore } from '../components/game/HighScores';
import ContinueScreen from '../components/game/ContinueScreen';
import StartScreen from '../components/game/StartScreen';
import OptionsScreen from '../components/game/OptionsScreen';
import CongratulationsScreen from '../components/game/CongratulationsScreen';
import { loadSettings, saveSettings, DIFFICULTY_CONFIG } from '../lib/gameSettings';
import { sounds } from '../hooks/useSound.js';
import IntroCrawl from '../components/game/IntroCrawl';
import { loadShopUpgrades } from '../lib/shopUpgrades';

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
  const [blockScore, setBlockScore] = useState(0);
  const [carryOverPowerups, setCarryOverPowerups] = useState(null);
  const [continuesLeft, setContinuesLeft] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [settings, setSettings] = useState(() => loadSettings());
  const [bossWarning, setBossWarning] = useState(null);
  const [shopUpgrades, setShopUpgrades] = useState(() => loadShopUpgrades());
  const [showPauseOptions, setShowPauseOptions] = useState(false);
  const scoreRef = useRef(0);
  const waveRef = useRef(1);

  const handleScoreChange = useCallback((s) => {
    scoreRef.current = s;
    setScore(s);
  }, []);

  const handleWaveChange = useCallback((w) => {
    waveRef.current = w;
    setWave(w);
  }, []);

  const handleStart = useCallback((keepPowerups = false) => {
    scoreRef.current = 0;
    waveRef.current = 1;
    setScore(0);
    setBlockScore(0);
    setLives(3);
    setMaxLives(3);
    setWave(1);
    if (!keepPowerups) {
      setCarryOverPowerups(null);
      setActivePowerup({});
    }
    setContinuesLeft(0);
    setGameState('playing');
  }, []);

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

  const handleContinueUsed = useCallback(() => {
    setContinuesLeft(c => Math.max(0, c - 1));
  }, []);

  const handleDecline = useCallback(() => {
    setGameState('gameover');
  }, []);

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
    setIsPaused(p => !p);
    setShowPauseOptions(false);
  }, []);

  const handleSettingsChange = useCallback((next) => {
    setSettings(next);
    saveSettings(next);
  }, []);

  // Enter key toggles pause during gameplay
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Enter' && (gameState === 'playing' || gameState === 'resuming')) {
        setIsPaused(p => !p);
        setShowPauseOptions(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gameState]);

  // Title music is triggered by user click in StartScreen (browser requires user gesture)

  // Play game-over music on game over
  useEffect(() => {
    if (gameState === 'gameover') sounds.playGameOverMusic();
  }, [gameState]);

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
      className="relative w-full h-screen overflow-hidden bg-black select-none"
      tabIndex={-1}
      style={{ filter: `brightness(${settings.brightness})` }}
    >
      <GameCanvas
        gameState={gameState}
        setGameState={handleSetGameState}
        onScoreChange={handleScoreChange}
        onBlockScoreChange={setBlockScore}
        onLivesChange={setLives}
        onMaxLivesChange={setMaxLives}
        onWaveChange={handleWaveChange}
        onPowerupChange={setActivePowerup}
        onBossWarning={setBossWarning}
        continuesLeft={continuesLeft}
        onContinueUsed={handleContinueUsed}
        isPaused={isPaused}
        difficultyConfig={difficultyConfig}
        gameSpeed={settings.gameSpeed ?? 30}
        carryOverPowerups={carryOverPowerups}
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
          shopUpgrades={shopUpgrades}
        />
      )}

      {/* Pause options overlay */}
      {showPauseOptions && isPaused && (
        <OptionsScreen
          settings={settings}
          onSettingsChange={handleSettingsChange}
          gameState="playing"
          onExitToTitle={() => {
            sounds.stopAllMusic();
            setGameState('start');
            setShowPauseOptions(false);
          }}
          onBack={() => setShowPauseOptions(false)}
        />
      )}

      {gameState === 'start' && (
        <StartScreen onStart={handleStart} settings={settings} onSettingsChange={handleSettingsChange} />
      )}

      {gameState === 'continue' && (
        <ContinueScreen
          score={score}
          continuesLeft={continuesLeft}
          onContinue={handleContinue}
          onDecline={handleDecline}
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

      {gameState === 'gameover' && (
        <HighScores
          score={score}
          wave={wave}
          onRestart={handleStart}
          onReturnToTitle={() => setGameState('start')}
          isNewScore={isHighScore(score)}
        />
      )}
    </div>
  );
}