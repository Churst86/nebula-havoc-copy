import React, { useEffect, useRef, useState } from 'react';
import { sounds } from '../../hooks/useSound.js';

const CRAWL_TEXT = `In a galaxy far, far away the evil empire....

Oh wait, that's a different story!

In this one a space marine fights evil close to home.

An army of alien space ships has invaded and are causing strange blocks to appear.

Fight off the hordes and gather the blocks for research!

Who knows what they might unlock?`;

const CRAWL_DURATION = 22000;

export default function IntroCrawl({ onDone }) {
  const [fading, setFading] = useState(false);
  const [crawlDone, setCrawlDone] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const doneRef = useRef(false);

  // Preload title music immediately so it's cached and plays instantly on title screen
  useEffect(() => {
    sounds.preloadMusic('title');
  }, []);

  function finish() {
    if (doneRef.current) return;
    doneRef.current = true;
    setFading(true);
    setTimeout(() => onDone(), 1200);
  }

  // After crawl finishes, show "press any key" prompt
  useEffect(() => {
    const t = setTimeout(() => {
      setCrawlDone(true);
      setShowPrompt(true);
    }, CRAWL_DURATION);
    return () => clearTimeout(t);
  }, []);

  // Interaction: if crawl is done → proceed; otherwise just skip to prompt
  useEffect(() => {
    const handler = () => {
      if (crawlDone) {
        finish();
      } else {
        setCrawlDone(true);
        setShowPrompt(true);
      }
    };
    window.addEventListener('keydown', handler);
    window.addEventListener('pointerdown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('pointerdown', handler);
    };
  }, [crawlDone]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-end overflow-hidden"
      style={{
        background: '#000',
        opacity: fading ? 0 : 1,
        transition: 'opacity 1.2s ease-in-out',
      }}
    >
      {/* Stars background — stable, no random re-renders */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, #0a0a1a 0%, #000 100%)' }}>
        {STABLE_STARS.map((s, i) => (
          <div key={i} className="absolute rounded-full bg-white"
            style={{ left: s.l, top: s.t, width: s.w, height: s.w, opacity: s.o }} />
        ))}
      </div>

      {/* Fade vignette top */}
      <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none"
        style={{ height: '40%', background: 'linear-gradient(to bottom, #000 0%, transparent 100%)' }} />

      {/* Scrolling text container */}
      <div className="relative z-20 w-full max-w-3xl px-8 pb-0"
        style={{ perspective: '500px', perspectiveOrigin: '50% 100%', height: '100vh', overflow: 'hidden' }}>
        <div style={{
          transformOrigin: '50% 100%',
          transform: 'rotateX(22deg)',
          animation: crawlDone ? 'none' : `crawl ${CRAWL_DURATION}ms linear forwards`,
        }}>
          <div style={{
            color: '#ffe87a',
            fontFamily: 'Georgia, serif',
            fontSize: 'clamp(2.4rem, 50vw, 3.8rem)',
            lineHeight: 2.1,
            textAlign: 'justify',
            textShadow: '0 0 24px rgba(255,232,122,0.7)',
            whiteSpace: 'pre-wrap',
            paddingTop: '100vh',
            paddingBottom: '60vh',
          }}>
            {CRAWL_TEXT}
          </div>
        </div>
      </div>

      {/* Prompt shown after crawl or skip */}
      {showPrompt && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60"
          style={{ animation: 'fadeIn 0.8s ease-in' }}>
          <div className="text-center space-y-4">
            <div className="text-3xl font-black tracking-widest text-cyan-300"
              style={{ textShadow: '0 0 20px #00ccff' }}>
              NEBULA HAVOK
            </div>
            <div className="text-white/60 text-sm tracking-widest uppercase animate-pulse">
              Press any key or click to begin
            </div>
          </div>
        </div>
      )}

      {/* Hint while crawling */}
      {!showPrompt && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 text-xs text-white/30 tracking-widest uppercase">
          Click or press any key to skip
        </div>
      )}

      <style>{`
        @keyframes crawl {
          from { transform: rotateX(22deg) translateY(0); }
          to   { transform: rotateX(22deg) translateY(-100%); }
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}

// Pre-computed stable stars (avoid random re-renders)
const STABLE_STARS = Array.from({ length: 80 }, (_, i) => ({
  l: `${(i * 12.34 + 7) % 100}%`,
  t: `${(i * 9.17 + 3) % 100}%`,
  w: `${(i % 3) + 1}px`,
  o: 0.2 + (i % 7) * 0.1,
}));