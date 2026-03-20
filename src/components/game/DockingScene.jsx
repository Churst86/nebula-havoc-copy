import React, { useEffect, useRef, useState } from 'react';

// Animated canvas: player ship flies up and docks with a space station
export default function DockingScene({ onDockComplete }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const shipY = useRef(null);
  const docked = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const W = canvas.width, H = canvas.height;

    shipY.current = H - 80;
    const stationY = H * 0.2;
    const stars = Array.from({ length: 100 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: Math.random() * 1.5 + 0.3, speed: Math.random() * 0.5 + 0.2,
    }));

    let frame = 0;

    function drawStation(ctx, cx, sy) {
      ctx.save();
      ctx.translate(cx, sy);
      // Main ring
      ctx.strokeStyle = '#88bbff'; ctx.lineWidth = 6;
      ctx.shadowColor = '#44aaff'; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.ellipse(0, 0, 70, 18, 0, 0, Math.PI * 2); ctx.stroke();
      // Hub
      ctx.fillStyle = '#223355';
      ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#44aaff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.stroke();
      // Solar panels
      [[-90, -6], [90, -6]].forEach(([px, py]) => {
        ctx.fillStyle = '#1144aa';
        ctx.fillRect(px - 20, py, 40, 12);
        ctx.strokeStyle = '#3366ff'; ctx.lineWidth = 1;
        ctx.strokeRect(px - 20, py, 40, 12);
        // Cells
        for (let i = 0; i < 4; i++) {
          ctx.strokeStyle = '#5588ff33';
          ctx.strokeRect(px - 20 + i * 10, py, 10, 12);
        }
      });
      // Docking port (bottom)
      ctx.fillStyle = '#00ccff44';
      ctx.strokeStyle = '#00ccff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-14, 18); ctx.lineTo(14, 18); ctx.lineTo(10, 34); ctx.lineTo(-10, 34); ctx.closePath();
      ctx.fill(); ctx.stroke();
      // Blinking lights
      const blink = Math.floor(frame / 15) % 2 === 0;
      ctx.fillStyle = blink ? '#ff4400' : '#331100';
      ctx.beginPath(); ctx.arc(-70, 0, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = blink ? '#00ff44' : '#001100';
      ctx.beginPath(); ctx.arc(70, 0, 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    function drawShip(ctx, cx, sy) {
      ctx.save();
      ctx.translate(cx, sy);
      ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 16;
      ctx.strokeStyle = '#00f0ff'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -18); ctx.lineTo(13, 12); ctx.lineTo(0, 6); ctx.lineTo(-13, 12); ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,240,255,0.15)'; ctx.fill();
      // Thruster flame
      const flickLen = 8 + Math.sin(frame * 0.4) * 6;
      const grad = ctx.createLinearGradient(0, 12, 0, 12 + flickLen);
      grad.addColorStop(0, 'rgba(0,240,255,0.9)');
      grad.addColorStop(1, 'rgba(255,80,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.ellipse(0, 12 + flickLen / 2, 3, flickLen / 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    function loop() {
      frame++;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#050510';
      ctx.fillRect(0, 0, W, H);

      // Stars scroll down slowly (ship moves up)
      stars.forEach(st => {
        st.y += st.speed;
        if (st.y > H) { st.y = 0; st.x = Math.random() * W; }
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      });

      const stationY_abs = H * 0.22;
      drawStation(ctx, W / 2, stationY_abs);

      // Move ship up
      const dockTargetY = stationY_abs + 34;
      if (shipY.current > dockTargetY + 2) {
        shipY.current -= 1.8;
      } else if (!docked.current) {
        docked.current = true;
        // Docked — flash then callback
        setTimeout(() => {
          cancelAnimationFrame(animRef.current);
          onDockComplete();
        }, 600);
      }

      drawShip(ctx, W / 2, shipY.current);

      // Docking beam when close
      if (shipY.current < stationY_abs + 80) {
        const pct = 1 - (shipY.current - dockTargetY) / 80;
        ctx.save();
        ctx.globalAlpha = Math.min(pct, 0.6);
        ctx.strokeStyle = '#00ccff';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(W / 2, stationY_abs + 34);
        ctx.lineTo(W / 2, shipY.current - 18);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      animRef.current = requestAnimationFrame(loop);
    }

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [onDockComplete]);

  return (
    <div className="fixed inset-0 z-40 bg-black">
      <canvas ref={canvasRef} className="w-full h-full" />
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-cyan-400 text-sm font-mono tracking-widest animate-pulse uppercase">
        Docking with Space Station Ozma...
      </div>
    </div>
  );
}