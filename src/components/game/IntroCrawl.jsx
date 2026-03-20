import React, { useEffect, useRef, useState } from 'react';

const CRAWL_TEXT = `In a galaxy far, far away the evil empire....

Oh wait, that's a different story!

In this one a space marine fights evil close to home.

An army of alien space ships has invaded and are causing strange blocks to appear.

Fight off the hordes and gather the blocks for research!

Who knows what they might unlock?`;

export default function IntroCrawl({ onDone }) {
  const [fading, setFading] = useState(false);
  const doneRef = useRef(false);

  function finish() {
    if (doneRef.current) return;
    doneRef.current = true;
    setFading(true);
    setTimeout(() => onDone(), 1200);
  }

  // Auto-finish after crawl duration (~18s)
  useEffect(() => {
    const t = setTimeout(finish, 18000);
    return () => clearTimeout(t);
  }, []);

  // Any key or click skips
  useEffect(() => {
    const handler = () => finish();
    window.addEventListener('keydown', handler);
    window.addEventListener('pointerdown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('pointerdown', handler);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-end overflow-hidden"
      style={{
        background: '#000',
        opacity: fading ? 0 : 1,
        transition: 'opacity 1.2s ease-in-out',
      }}
    >
      {/* Stars background */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, #0a0a1a 0%, #000 100%)' }}>
        {Array.from({ length: 80 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${Math.random() * 2 + 1}px`,
              height: `${Math.random() * 2 + 1}px`,
              opacity: Math.random() * 0.7 + 0.3,
            }}
          />
        ))}
      </div>

      {/* Fade vignette top — text fades into black */}
      <div
        className="absolute top-0 left-0 right-0 z-10 pointer-events-none"
        style={{ height: '35%', background: 'linear-gradient(to bottom, #000 0%, transparent 100%)' }}
      />

      {/* Scrolling text container */}
      <div
        className="relative z-20 w-full max-w-2xl px-8 pb-0"
        style={{
          perspective: '400px',
          perspectiveOrigin: '50% 100%',
          height: '100vh',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            transformOrigin: '50% 100%',
            transform: 'rotateX(22deg)',
            animation: 'crawl 18s linear forwards',
            paddingBottom: '60vh',
          }}
        >
          <div
            style={{
              color: '#ffe87a',
              fontFamily: 'Georgia, serif',
              fontSize: 'clamp(1rem, 2.5vw, 1.4rem)',
              lineHeight: 2,
              textAlign: 'justify',
              textShadow: '0 0 20px rgba(255,232,122,0.6)',
              whiteSpace: 'pre-wrap',
              paddingTop: '100vh',
            }}
          >
            {CRAWL_TEXT}
          </div>
        </div>
      </div>

      {/* Skip hint */}
      <div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 text-xs text-white/40 tracking-widest uppercase"
        style={{ animation: 'pulse 2s ease-in-out infinite' }}
      >
        Click or press any key to skip
      </div>

      <style>{`
        @keyframes crawl {
          from { transform: rotateX(22deg) translateY(0); }
          to   { transform: rotateX(22deg) translateY(-100%); }
        }
      `}</style>
    </div>
  );
}