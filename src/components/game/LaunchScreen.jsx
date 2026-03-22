import React, { useEffect, useRef, useState } from 'react';
import { getSprite } from '../../lib/spriteLoader.js';

export default function LaunchScreen({ onDone, loadProgress = 0 }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const frameRef = useRef(0);
  const [fading, setFading] = useState(false);
  const doneCalledRef = useRef(false);

  // Trigger fade-out when fully loaded, then call onDone after fade
  useEffect(() => {
    if (loadProgress >= 1 && !doneCalledRef.current) {
      doneCalledRef.current = true;
      setFading(true);
      setTimeout(() => onDone(), 700);
    }
  }, [loadProgress, onDone]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const W = () => canvas.width;
    const H = () => canvas.height;

    const stars = Array.from({ length: 160 }, () => ({
      x: Math.random(), y: Math.random(),
      r: Math.random() * 1.4 + 0.3,
      speed: 0,
      alpha: Math.random() * 0.7 + 0.3,
    }));

    const EARTH_RADIUS = 220;

    const continents = [
      { dx: -60, dy: -80, rx: 55, ry: 35, rot: 0.3 },
      { dx: 30,  dy: -50, rx: 42, ry: 58, rot: -0.2 },
      { dx: -80, dy: 20,  rx: 38, ry: 28, rot: 0.5 },
      { dx: 65,  dy: 55,  rx: 48, ry: 30, rot: -0.4 },
      { dx: 10,  dy: 85,  rx: 22, ry: 32, rot: 0.1 },
      { dx: -30, dy: 50,  rx: 28, ry: 18, rot: 0.8 },
    ];

    function drawEarth(ctx, cx, ey) {
      ctx.save();

      // Glow halo
      const glow = ctx.createRadialGradient(cx, ey, EARTH_RADIUS * 0.6, cx, ey, EARTH_RADIUS * 1.35);
      glow.addColorStop(0, 'rgba(30,120,255,0.0)');
      glow.addColorStop(0.7, 'rgba(30,120,255,0.14)');
      glow.addColorStop(1, 'rgba(30,120,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(cx, ey, EARTH_RADIUS * 1.35, 0, Math.PI * 2); ctx.fill();

      // Ocean base
      ctx.beginPath(); ctx.arc(cx, ey, EARTH_RADIUS, 0, Math.PI * 2);
      const ocean = ctx.createRadialGradient(cx - 40, ey - 40, 20, cx, ey, EARTH_RADIUS);
      ocean.addColorStop(0, '#3a8fff');
      ocean.addColorStop(0.5, '#1a5fcc');
      ocean.addColorStop(1, '#0a2266');
      ctx.fillStyle = ocean;
      ctx.fill();

      // Clip to Earth circle for continents
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, ey, EARTH_RADIUS - 2, 0, Math.PI * 2); ctx.clip();

      continents.forEach(c => {
        ctx.save();
        ctx.translate(cx + c.dx, ey + c.dy);
        ctx.rotate(c.rot);
        // Dark base
        ctx.fillStyle = '#1a5c26';
        ctx.beginPath(); ctx.ellipse(0, 0, c.rx + 4, c.ry + 4, 0, 0, Math.PI * 2); ctx.fill();
        // Main green
        ctx.fillStyle = '#2d8a3a';
        ctx.beginPath(); ctx.ellipse(0, 0, c.rx, c.ry, 0, 0, Math.PI * 2); ctx.fill();
        // Highlight
        ctx.fillStyle = '#4aaa55';
        ctx.beginPath(); ctx.ellipse(-c.rx * 0.2, -c.ry * 0.2, c.rx * 0.55, c.ry * 0.45, c.rot * 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });

      ctx.restore(); // end clip

      // Atmosphere rim
      const atm = ctx.createRadialGradient(cx, ey, EARTH_RADIUS - 12, cx, ey, EARTH_RADIUS + 22);
      atm.addColorStop(0, 'rgba(100,180,255,0.0)');
      atm.addColorStop(0.4, 'rgba(100,180,255,0.3)');
      atm.addColorStop(1, 'rgba(100,180,255,0)');
      ctx.fillStyle = atm;
      ctx.beginPath(); ctx.arc(cx, ey, EARTH_RADIUS + 22, 0, Math.PI * 2); ctx.fill();

      // Cloud wisps (clipped to earth)
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, ey, EARTH_RADIUS - 2, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      [
        { dx: -30, dy: -100, rx: 50, ry: 10 },
        { dx: 70,  dy: -20,  rx: 40, ry: 8 },
        { dx: -90, dy: 40,   rx: 35, ry: 9 },
        { dx: 20,  dy: 100,  rx: 55, ry: 11 },
      ].forEach(c => {
        ctx.beginPath(); ctx.ellipse(cx + c.dx, ey + c.dy, c.rx, c.ry, 0, 0, Math.PI * 2); ctx.fill();
      });
      ctx.restore();

      ctx.restore();
    }

    function drawShip(ctx, cx, sy, frame) {
      const playerImg = getSprite('PlayerShip');
      ctx.save();
      ctx.translate(cx, sy);
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
      ctx.fillStyle = g1; ctx.beginPath(); ctx.ellipse(-5, 12 + flickLen / 2, 3, flickLen / 2, 0, 0, Math.PI * 2); ctx.fill();
      const g2 = ctx.createLinearGradient(5, 12, 5, 12 + flickLen);
      g2.addColorStop(0, 'rgba(0,240,255,0.9)'); g2.addColorStop(1, 'rgba(255,80,0,0)');
      ctx.fillStyle = g2; ctx.beginPath(); ctx.ellipse(5, 12 + flickLen / 2, 3, flickLen / 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    let shipY;
    let initialized = false;

    function loop() {
      frameRef.current++;
      const f = frameRef.current;
      const ctx = canvas.getContext('2d');
      const w = W(), h = H();

      if (!initialized) { shipY = h * 0.55; initialized = true; }

      ctx.fillStyle = '#020510';
      ctx.fillRect(0, 0, w, h);

      stars.forEach(st => {
        ctx.globalAlpha = st.alpha;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(st.x * w, st.y * h, st.r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      });

      const earthCY = h + EARTH_RADIUS - 60;
      drawEarth(ctx, w / 2, earthCY);

      const acceleration = 0.015;
      shipY -= (2 + f * acceleration);
      if (shipY < -60) shipY = -60;

      drawShip(ctx, w / 2, shipY, f);

      animRef.current = requestAnimationFrame(loop);
    }

    animRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{
        background: '#020510',
        opacity: fading ? 0 : 1,
        transition: 'opacity 0.7s ease-in-out',
        pointerEvents: fading ? 'none' : 'all',
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      <div className="relative z-10 flex flex-col items-center justify-end h-full pb-16 px-8">
        <div className="mb-6 text-center">
          <div className="text-3xl font-black tracking-widest text-cyan-300" style={{ textShadow: '0 0 20px #00ccff' }}>
            NEBULA HAVOK
          </div>
          <div className="text-xs tracking-[0.3em] text-cyan-500/60 uppercase mt-1">Loading Assets...</div>
        </div>

        <div className="w-full max-w-sm">
          <div className="flex justify-between text-xs text-cyan-500/60 font-mono mb-1">
            <span>LOADING</span>
            <span>{Math.round(loadProgress * 100)}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-200"
              style={{
                width: `${loadProgress * 100}%`,
                background: 'linear-gradient(90deg, #00ccff, #00f0ff)',
                boxShadow: '0 0 8px #00f0ff',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}