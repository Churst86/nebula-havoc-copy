import React, { useState, useCallback, useRef, useEffect } from 'react';
import GameCanvas from '../components/game/GameCanvas.jsx';
import GameHUD from '../components/game/GameHUD';
import HighScores, { isHighScore } from '../components/game/HighScores';
import ContinueScreen from '../components/game/ContinueScreen';
import StartScreen from '../components/game/StartScreen';
import OptionsScreen from '../components/game/OptionsScreen';
import CongratulationsScreen from '../components/game/CongratulationsScreen';
import DifficultySelector from '../components/game/DifficultySelector';
import { loadSettings, saveSettings, DIFFICULTY_CONFIG } from '../lib/gameSettings';
import { sounds } from '../hooks/useSound.js';

const CONTINUE_SCORE_THRESHOLD = 1000; // score needed to earn a continue
const MAX_CONTINUES = 3;

export default function Game() {
  const [gameState, setGameState] = useState('start');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [maxLives, setMaxLives] = useState(3);
  const [wave, setWave] = useState(1);
  const [activePowerup, setActivePowerup] = useState({});
  const [continuesLeft, setContinuesLeft] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [settings, setSettings] = useState(() => loadSettings());
  const [showPauseOptions, setShowPauseOptions] = useState(false);
  const [currentDifficulty, setCurrentDifficulty] = useState('easy');
  const [completedDifficulties, setCompletedDifficulties] = useState(() => {
    const saved = localStorage.getItem('completedDifficulties');
    return saved ? JSON.parse(saved) : [];
  });
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

  const handleStart = useCallback((difficulty = 'easy', carryoverPowerups = null) => {
    setCurrentDifficulty(difficulty);
    scoreRef.current = carryoverPowerups ? score : 0;
    waveRef.current = 1;
    setScore(carryoverPowerups ? score : 0);
    setLives(3);
    setMaxLives(3);
    setWave(1);
    setActivePowerup(carryoverPowerups || {});
    setContinuesLeft(0);
    setGameState('playing');
  }, [score]);

  // Called by canvas when lives hit 0 or level complete
  const handleSetGameState = useCallback((state) => {
    if (state === 'continue') {
      const earned = Math.min(Math.floor(scoreRef.current / CONTINUE_SCORE_THRESHOLD), MAX_CONTINUES);
      setContinuesLeft(prev => {
        if (prev > 0) { setGameState('continue'); return prev; }
        if (earned > 0) { setGameState('continue'); return earned; }
        setGameState('gameover');
        return 0;
      });
    } else if (state === 'gameover') {
      // Check if player beat level target for current difficulty
      const levelTargets = { easy: 25, challenging: 50, hell: 100 };
      const target = levelTargets[currentDifficulty];
      if (waveRef.current > target) {
        // Player beat the difficulty!
        setCompletedDifficulties(prev => {
          const updated = [...new Set([...prev, currentDifficulty])];
          localStorage.setItem('completedDifficulties', JSON.stringify(updated));
          return updated;
        });
        setGameState('congratulations');
      } else {
        setGameState('gameover');
      }
    } else {
      setGameState(state);
    }
  }, [currentDifficulty]);

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

  // Apply separate music/sfx volumes when settings change
  useEffect(() => {
    sounds.setMusicVolume(settings.musicVolume ?? settings.soundVolume ?? 0.8);
  }, [settings.musicVolume, settings.soundVolume]);

  useEffect(() => {
    sounds.setSfxVolume(settings.sfxVolume ?? settings.soundVolume ?? 0.8);
  }, [settings.sfxVolume, settings.soundVolume]);

  const difficultyConfig = DIFFICULTY_CONFIG[currentDifficulty] || DIFFICULTY_CONFIG.easy;

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
        onLivesChange={setLives}
        onMaxLivesChange={setMaxLives}
        onWaveChange={handleWaveChange}
        onPowerupChange={setActivePowerup}
        continuesLeft={continuesLeft}
        onContinueUsed={handleContinueUsed}
        isPaused={isPaused}
        difficultyConfig={difficultyConfig}
        gameSpeed={settings.gameSpeed ?? 30}
      />

      {(gameState === 'playing' || gameState === 'resuming') && (
        <GameHUD
          score={score}
          lives={lives}
          maxLives={maxLives}
          wave={wave}
          activePowerup={activePowerup}
          continuesLeft={continuesLeft}
          isPaused={isPaused}
          onPauseToggle={handlePauseToggle}
          onOpenOptions={() => setShowPauseOptions(true)}
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
        <div className="absolute inset-0 z-40 bg-black/90 flex items-center justify-center">
          <DifficultySelector
            completedDifficulties={completedDifficulties}
            onSelectDifficulty={(difficulty) => handleStart(difficulty)}
            onHome={() => {}} // Keep on start screen if no home option
          />
        </div>
      )}

      {gameState === 'continue' && (
        <ContinueScreen
          score={score}
          continuesLeft={continuesLeft}
          onContinue={handleContinue}
          onDecline={handleDecline}
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