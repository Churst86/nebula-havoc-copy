import React, { useEffect, useRef, useState } from 'react';

// Loading screen: player ship launches from Earth into space
// Calls onDone() when all sprites are loaded (or timeout)
export default function LaunchScreen({ onDone, loadProgress = 0 }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const frameRef = useRef(0);
  const [fading, setFading] = useState(false);
  const doneCalledRef = useRef(false);

  // Trigger fade-out when fully loaded
  useEffect(() => {
    if (loadProgress >= 1 && !doneCalledRef.current) {
      doneCalledRef.current = true;
      setFading(true);
      setTimeout(() => onDone(), 900);
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

    // Stars
    const stars = Array.from({ length: 160 }, () => ({
      x: Math.random(), y: Math.random(),
      r: Math.random() * 1.4 + 0.3,
      speed: Math.random() * 0.3 + 0.05,
      alpha: Math.random() * 0.7 + 0.3,
    }));

    // Earth params — drawn at bottom center
    const EARTH_RADIUS = 220;

    function drawEarth(ctx, cx, ey) {
      ctx.save();
      // Glow
      const glow = ctx.createRadialGradient(cx, ey, EARTH_RADIUS * 0.6, cx, ey, EARTH_RADIUS * 1.3);
      glow.addColorStop(0, 'rgba(30,120,255,0.0)');
      glow.addColorStop(0.7, 'rgba(30,120,255,0.12)');
      glow.addColorStop(1, 'rgba(30,120,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(cx, ey, EARTH_RADIUS * 1.3, 0, Math.PI * 2); ctx.fill();

      // Ocean base
      ctx.beginPath(); ctx.arc(cx, ey, EARTH_RADIUS, 0, Math.PI * 2);
      const ocean = ctx.createRadialGradient(cx - 40, ey - 40, 20, cx, ey, EARTH_RADIUS);
      ocean.addColorStop(0, '#3a8fff');
      ocean.addColorStop(0.5, '#1a5fcc');
      ocean.addColorStop(1, '#0a2266');
      ctx.fillStyle = ocean; ctx.fill();

      // Continents
      ctx.fillStyle = '#2d7a3a';
      const continents = [
        { dx: -60, dy: -80, rx: 55, ry: 35, rot: 0.3 },
        { dx: 30, dy: -40, rx: 40, ry: 55, rot: -0.2 },
        { dx: -80, dy: 30, rx: 30, ry: 25, rot: 0.5 },
        { dx: 60, dy: 60, rx: 45, ry: 28, rot: -0.4 },
        { dx: 10, dy: 80, rx: 20, ry: 30, rot: 0.1 },
      ];
      continents.forEach(c => {
        ctx.save();
        ctx.translate(cx + c.dx, ey + c.dy);
        ctx.rotate(c.rot);
        ctx.beginPath(); ctx.ellipse(0, 0, c.rx, c.ry, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.restore();
      });

      // Atmosphere rim
      const atm = ctx.createRadialGradient(cx, ey, EARTH_RADIUS - 12, cx, ey, EARTH_RADIUS + 18);
      atm.addColorStop(0, 'rgba(100,180,255,0.0)');
      atm.addColorStop(0.4, 'rgba(100,180,255,0.25)');
      atm.addColorStop(1, 'rgba(100,180,255,0)');
      ctx.fillStyle = atm;
      ctx.beginPath(); ctx.arc(cx, ey, EARTH_RADIUS + 18, 0, Math.PI * 2); ctx.fill();

      // Cloud wisps
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      const clouds = [
        { dx: -30, dy: -100, rx: 50, ry: 10 },
        { dx: 70, dy: -20, rx: 40, ry: 8 },
        { dx: -90, dy: 40, rx: 35, ry: 9 },
        { dx: 20, dy: 100, rx: 55, ry: 11 },
      ];
      clouds.forEach(c => {
        ctx.beginPath(); ctx.ellipse(cx + c.dx, ey + c.dy, c.rx, c.ry, 0, 0, Math.PI * 2); ctx.fill();
      });

      ctx.restore();
    }

    function drawShip(ctx, cx, sy, frame) {
      ctx.save();
      ctx.translate(cx, sy);
      ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 20;
      ctx.strokeStyle = '#00f0ff'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -18); ctx.lineTo(13, 12); ctx.lineTo(0, 6); ctx.lineTo(-13, 12); ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,240,255,0.15)'; ctx.fill();
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

    // Ship starts just above Earth surface, flies upward
    const shipStartYFn = () => H() * 0.55;
    let shipY = shipStartYFn();
    let initialized = false;

    function loop() {
      frameRef.current++;
      const f = frameRef.current;
      const ctx = canvas.getContext('2d');
      const w = W(), h = H();

      if (!initialized) { shipY = shipStartYFn(); initialized = true; }

      ctx.fillStyle = '#020510';
      ctx.fillRect(0, 0, w, h);

      // Stars scroll down (ship going up)
      stars.forEach(st => {
        st.y += st.speed;
        if (st.y > 1) st.y = 0;
        ctx.globalAlpha = st.alpha;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(st.x * w, st.y * h, st.r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      });

      // Earth at bottom center
      const earthCY = h + EARTH_RADIUS - 60;
      drawEarth(ctx, w / 2, earthCY);

      // Ship accelerates upward
      const acceleration = 0.015;
      shipY -= (2 + f * acceleration);
      if (shipY < -40) shipY = -40; // clamp at top

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
        transition: 'opacity 0.9s ease-in-out',
        pointerEvents: fading ? 'none' : 'all',
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      <div className="relative z-10 flex flex-col items-center justify-end h-full pb-16 px-8">
        {/* Title */}
        <div className="mb-6 text-center">
          <div className="text-3xl font-black tracking-widest text-cyan-300" style={{ textShadow: '0 0 20px #00ccff' }}>
            NEBULA HAVOK
          </div>
          <div className="text-xs tracking-[0.3em] text-cyan-500/60 uppercase mt-1">Loading Assets...</div>
        </div>

        {/* Progress bar */}
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