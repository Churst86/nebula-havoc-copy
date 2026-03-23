import React, { useEffect, useRef, useState } from 'react';
import { getSprite } from '../../lib/spriteLoader.js';

const STATION_URL = 'https://raw.githubusercontent.com/Churst86/Sprites/main/Spacestation.png';

// Docking animation: ship flies up and docks with station (arriving)
// Departure animation: ship undocks and flies downward off screen (departing)
export default function DockingScene({ mode = 'arriving', onDockComplete, onDepartComplete }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const frameRef = useRef(0);
  const [fading, setFading] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    // Reset state for each new mode run
    doneRef.current = false;
    setFading(false);
    frameRef.current = 0;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Stars
    const stars = Array.from({ length: 120 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.4 + 0.3,
      speed: Math.random() * 0.2 + 0.05,
      alpha: Math.random() * 0.7 + 0.3,
    }));

    // Load station image
    const stationImg = new Image();
    stationImg.crossOrigin = 'anonymous';
    stationImg.src = STATION_URL;

    const STATION_W = 300;
    const STATION_H = 200;

    function drawStation(ctx, W, H, stY) {
      ctx.save();
      if (stationImg.complete && stationImg.naturalWidth > 0) {
        ctx.shadowColor = '#00ccff';
        ctx.shadowBlur = 30;
        ctx.drawImage(stationImg, W / 2 - STATION_W / 2, stY, STATION_W, STATION_H);
      } else {
        // Fallback geometric station
        ctx.shadowColor = '#00ccff'; ctx.shadowBlur = 20;
        ctx.strokeStyle = '#00ccff'; ctx.lineWidth = 2;
        ctx.strokeRect(W / 2 - 80, stY + 20, 160, 60);
        ctx.strokeRect(W / 2 - 140, stY + 40, 50, 30);
        ctx.strokeRect(W / 2 + 90, stY + 40, 50, 30);
        // Docking port
        ctx.fillStyle = '#00ccff44';
        ctx.beginPath(); ctx.arc(W / 2, stY + 80, 10, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#00ccff'; ctx.stroke();
      }
      ctx.restore();
    }

    function drawShip(ctx, x, y, frame, flipped = false) {
      const playerImg = getSprite('PlayerShip');
      ctx.save();
      ctx.translate(x, y);
      if (flipped) ctx.scale(1, -1);
      ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 18;
      if (playerImg) {
        ctx.drawImage(playerImg, -42, -42, 84, 84);
      } else {
        ctx.strokeStyle = '#00f0ff'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -18); ctx.lineTo(13, 12); ctx.lineTo(0, 6); ctx.lineTo(-13, 12); ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = 'rgba(0,240,255,0.15)'; ctx.fill();
      }
      // Thruster flame
      const flickLen = 14 + Math.sin(frame * 0.4) * 8;
      const g1 = ctx.createLinearGradient(-5, 12, -5, 12 + flickLen);
      g1.addColorStop(0, 'rgba(0,240,255,0.9)'); g1.addColorStop(1, 'rgba(255,80,0,0)');
      ctx.fillStyle = g1;
      ctx.beginPath(); ctx.ellipse(-5, 12 + flickLen / 2, 3, flickLen / 2, 0, 0, Math.PI * 2); ctx.fill();
      const g2 = ctx.createLinearGradient(5, 12, 5, 12 + flickLen);
      g2.addColorStop(0, 'rgba(0,240,255,0.9)'); g2.addColorStop(1, 'rgba(255,80,0,0)');
      ctx.fillStyle = g2;
      ctx.beginPath(); ctx.ellipse(5, 12 + flickLen / 2, 3, flickLen / 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    let shipY, stationY, done = false;

    function loop() {
      frameRef.current++;
      const f = frameRef.current;
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;

      ctx.fillStyle = '#020510';
      ctx.fillRect(0, 0, W, H);

      // Scrolling stars
      const starDir = mode === 'arriving' ? 1 : -1;
      stars.forEach(st => {
        st.y += st.speed * starDir;
        if (st.y > 1) st.y = 0;
        if (st.y < 0) st.y = 1;
        ctx.globalAlpha = st.alpha;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(st.x * W, st.y * H, st.r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      });

      // Station stays fixed in upper area
      stationY = H * 0.12;
      drawStation(ctx, W, H, stationY);

      if (mode === 'arriving') {
        // Ship starts from bottom, flies up to dock
        if (shipY === undefined) shipY = H + 60;
        const dockY = stationY + STATION_H - 10;
        const speed = Math.max(1, (shipY - dockY) * 0.04 + 1.5);
        shipY -= speed;
        if (shipY <= dockY && !done) {
          done = true;
          // Brief pause then fade out and call onDockComplete
          setTimeout(() => {
            if (!doneRef.current) {
              doneRef.current = true;
              setFading(true);
              setTimeout(() => onDockComplete && onDockComplete(), 800);
            }
          }, 600);
        }
        drawShip(ctx, W / 2, shipY, f, false);
      } else {
        // Departing: ship starts docked, flies downward off screen
        if (shipY === undefined) shipY = stationY + STATION_H - 10;
        const acceleration = 0.01;
        shipY += (2 + f * acceleration);
        if (shipY > H + 80 && !done) {
          done = true;
          if (!doneRef.current) {
            doneRef.current = true;
            setFading(true);
            setTimeout(() => onDepartComplete && onDepartComplete(), 800);
          }
        }
        drawShip(ctx, W / 2, shipY, f, true);
      }

      animRef.current = requestAnimationFrame(loop);
    }

    animRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [mode]);

  return (
    <>
      {/* Background layer — always opaque */}
      <div className="fixed inset-0 z-40 bg-black" style={{ pointerEvents: fading ? 'none' : 'all' }} />
      
      {/* Content layer — fades out */}
      <div
        className="fixed inset-0 z-40 flex items-center justify-center"
        style={{
          opacity: fading ? 0 : 1,
          transition: 'opacity 0.8s ease-in-out',
          pointerEvents: fading ? 'none' : 'all',
        }}
      >
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        <div className="relative z-10 text-center" style={{ marginTop: '65%' }}>
          <div className="text-xs tracking-[0.3em] text-cyan-500/60 uppercase font-mono animate-pulse">
            {mode === 'arriving' ? 'Docking...' : 'Departing...'}
          </div>
        </div>
      </div>
    </>
  );
}