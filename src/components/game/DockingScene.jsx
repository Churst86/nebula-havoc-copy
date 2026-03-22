import React, { useEffect, useRef, useState } from 'react';
import { getSprite } from '../../lib/spriteLoader.js';

// mode: 'arriving' — ship flies up and docks
// mode: 'departing' — ship undocks and flies away (triggered by onDepart)
export default function DockingScene({ onDockComplete, onDepartComplete, mode = 'arriving' }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const frameRef = useRef(0);
  const phaseRef = useRef(mode); // 'arriving' | 'docked' | 'departing'
  const shipYRef = useRef(null);
  const dockedRef = useRef(false);
  const [statusText, setStatusText] = useState('Docking with Space Station Ozma...');

  // Allow parent to trigger departure
  useEffect(() => {
    if (mode === 'departing') {
      phaseRef.current = 'departing';
      setStatusText('Departing Space Station Ozma...');
    }
  }, [mode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const stars = Array.from({ length: 120 }, () => ({
      x: Math.random(), y: Math.random(),
      r: Math.random() * 1.5 + 0.3, speed: Math.random() * 0.4 + 0.15,
    }));

    shipYRef.current = canvas.height - 80;

    function getW() { return canvas.width; }
    function getH() { return canvas.height; }

    function drawStation(ctx, cx, sy, frame) {
      ctx.save();
      ctx.translate(cx, sy);
      const img = getSprite('Spacestation');
      if (img) {
        const sz = 220;
        ctx.shadowColor = '#44aaff'; ctx.shadowBlur = 24;
        ctx.drawImage(img, -sz / 2, -sz / 2, sz, sz);
      } else {
        ctx.strokeStyle = '#88bbff'; ctx.lineWidth = 6;
        ctx.shadowColor = '#44aaff'; ctx.shadowBlur = 18;
        ctx.beginPath(); ctx.ellipse(0, 0, 70, 18, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#223355';
        ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#44aaff'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.stroke();
      }
      const blink = Math.floor(frame / 15) % 2 === 0;
      ctx.fillStyle = blink ? '#ff4400' : '#331100';
      ctx.beginPath(); ctx.arc(-80, 0, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = blink ? '#00ff44' : '#001100';
      ctx.beginPath(); ctx.arc(80, 0, 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    function drawShip(ctx, cx, sy, frame, flipped = false) {
      ctx.save();
      ctx.translate(cx, sy);
      if (flipped) ctx.scale(1, -1); // point downward when departing

      const shipImg = getSprite('PlayerShip');
      if (shipImg) {
        ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 18;
        ctx.drawImage(shipImg, -42, -42, 84, 84);
      } else {
        ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 16;
        ctx.strokeStyle = '#00f0ff'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -18); ctx.lineTo(13, 12); ctx.lineTo(0, 6); ctx.lineTo(-13, 12); ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = 'rgba(0,240,255,0.15)'; ctx.fill();
      }

      // Thruster flame
      const flickLen = 12 + Math.sin(frame * 0.4) * 7;
      const g1 = ctx.createLinearGradient(-5, 12, -5, 12 + flickLen);
      g1.addColorStop(0, 'rgba(0,240,255,0.9)');
      g1.addColorStop(1, 'rgba(255,80,0,0)');
      ctx.fillStyle = g1;
      ctx.beginPath(); ctx.ellipse(-5, 12 + flickLen / 2, 3, flickLen / 2, 0, 0, Math.PI * 2); ctx.fill();
      const g2 = ctx.createLinearGradient(5, 12, 5, 12 + flickLen);
      g2.addColorStop(0, 'rgba(0,240,255,0.9)');
      g2.addColorStop(1, 'rgba(255,80,0,0)');
      ctx.fillStyle = g2;
      ctx.beginPath(); ctx.ellipse(5, 12 + flickLen / 2, 3, flickLen / 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    let departSpeed = 0;

    function loop() {
      frameRef.current++;
      const f = frameRef.current;
      const ctx = canvas.getContext('2d');
      const W = getW(), H = getH();

      ctx.fillStyle = '#050510';
      ctx.fillRect(0, 0, W, H);

      // Stars scroll
      stars.forEach(st => {
        st.y += st.speed / H * (phaseRef.current === 'departing' ? 3 : 1);
        if (st.y > 1) st.y = 0;
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(st.x * W, st.y * H, st.r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      });

      const stationY = H * 0.22;
      drawStation(ctx, W / 2, stationY, f);

      const dockTargetY = stationY + 38;

      if (phaseRef.current === 'arriving') {
        // Ship flies up from bottom
        if (shipYRef.current > dockTargetY + 2) {
          shipYRef.current -= 1.8;
        } else if (!dockedRef.current) {
          dockedRef.current = true;
          phaseRef.current = 'docked';
          shipYRef.current = dockTargetY;
          setTimeout(() => {
            cancelAnimationFrame(animRef.current);
            if (onDockComplete) onDockComplete();
          }, 500);
        }
        drawShip(ctx, W / 2, shipYRef.current, f, false);

        // Docking beam
        if (shipYRef.current < stationY + 90) {
          const pct = Math.max(0, Math.min(1 - (shipYRef.current - dockTargetY) / 90, 0.7));
          ctx.save();
          ctx.globalAlpha = pct;
          ctx.strokeStyle = '#00ccff'; ctx.lineWidth = 2;
          ctx.setLineDash([6, 6]);
          ctx.beginPath();
          ctx.moveTo(W / 2, stationY + 38);
          ctx.lineTo(W / 2, shipYRef.current - 18);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
      } else if (phaseRef.current === 'docked') {
        // Hold docked position
        drawShip(ctx, W / 2, dockTargetY, f, false);
      } else if (phaseRef.current === 'departing') {
        // Ship flips and flies downward off screen
        departSpeed += 0.12;
        shipYRef.current += departSpeed;
        drawShip(ctx, W / 2, shipYRef.current, f, true);

        if (shipYRef.current > H + 80) {
          cancelAnimationFrame(animRef.current);
          if (onDepartComplete) onDepartComplete();
        }
      }

      animRef.current = requestAnimationFrame(loop);
    }

    animRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-40 bg-black">
      <canvas ref={canvasRef} className="w-full h-full" />
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-cyan-400 text-sm font-mono tracking-widest animate-pulse uppercase">
        {statusText}
      </div>
    </div>
  );
}