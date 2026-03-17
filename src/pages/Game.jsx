import React, { useState, useCallback } from 'react';
import GameCanvas from '../components/game/GameCanvas.jsx';
import GameHUD from '../components/game/GameHUD';
import GameOver from '../components/game/GameOver';
import StartScreen from '../components/game/StartScreen';

export default function Game() {
  const [gameState, setGameState] = useState('start');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [maxLives, setMaxLives] = useState(3);
  const [wave, setWave] = useState(1);
  const [activePowerup, setActivePowerup] = useState({});

  const handleStart = useCallback(() => {
    setScore(0);
    setLives(3);
    setMaxLives(3);
    setWave(1);
    setActivePowerup({});
    setGameState('playing');
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black select-none" tabIndex={-1}>
      <GameCanvas
        gameState={gameState}
        setGameState={setGameState}
        onScoreChange={setScore}
        onLivesChange={setLives}
        onWaveChange={setWave}
        onPowerupChange={setActivePowerup}
      />

      {gameState === 'playing' && (
        <GameHUD score={score} lives={lives} wave={wave} activePowerup={activePowerup} />
      )}

      {gameState === 'start' && (
        <StartScreen onStart={handleStart} />
      )}

      {gameState === 'gameover' && (
        <GameOver score={score} onRestart={handleStart} />
      )}
    </div>
  );
}