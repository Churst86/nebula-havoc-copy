import React, { useRef, useEffect, useCallback } from 'react';
import MobileControls from './MobileControls';
import { sounds } from '../../hooks/useSound.js';
import { loadSprites, getSprite, drawSprite } from '../../lib/spriteLoader.js';
import { useMotionControls } from './useMotionControls.jsx';

// Minimal version to get something on screen
export default function GameCanvas({ gameState, setGameState, isPaused }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useMotionControls(useRef({}), false, 1.0, false, false);

  // Simple render loop to show something
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    ctx.fillStyle = '#0a001f';
    ctx.fillRect(0, 0, W, H);

    // Draw simple player ship
    ctx.save();
    ctx.translate(W/2, H - 100);
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -25);
    ctx.lineTo(20, 20);
    ctx.lineTo(0, 10);
    ctx.lineTo(-20, 20);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // Draw "Nebula Havoc" text
    ctx.fillStyle = '#00ffff';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('NEBULA HAVOC', W/2, 120);

    ctx.font = '24px Arial';
    ctx.fillText('Local Build - Press SPACE to shoot', W/2, H - 50);

    animRef.current = requestAnimationFrame(render);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    if (gameState === 'playing') {
      render();
    }

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [gameState, render]);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 w-full h-full bg-black"
    />
  );
}