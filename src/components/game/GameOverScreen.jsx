import React, { useEffect, useState } from 'react';

export default function GameOverScreen({ onTransitionToHighScores }) {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Auto-transition after 5 seconds
    const timer = setTimeout(() => {
      setFadeOut(true);
      // Give fade animation time to complete before transitioning
      setTimeout(onTransitionToHighScores, 500);
    }, 5000);

    return () => clearTimeout(timer);
  }, [onTransitionToHighScores]);

  return (
    <div
      className={`fixed inset-0 z-50 bg-black flex items-center justify-center transition-opacity duration-500 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Retro pixel art game over scene */}
      <svg
        viewBox="0 0 1024 768"
        className="w-full h-full max-w-6xl max-h-screen"
        style={{ imageRendering: 'pixelated', imageRendering: 'crisp-edges' }}
      >
        {/* Starfield background */}
        <rect width="1024" height="768" fill="#000000" />
        <circle cx="100" cy="50" r="2" fill="#ffffff" />
        <circle cx="200" cy="80" r="1.5" fill="#ffffff" />
        <circle cx="350" cy="120" r="2" fill="#ffffff" />
        <circle cx="500" cy="60" r="1" fill="#ffffff" />
        <circle cx="700" cy="90" r="2" fill="#ffffff" />
        <circle cx="850" cy="100" r="1.5" fill="#ffffff" />
        <circle cx="950" cy="70" r="1" fill="#ffffff" />

        {/* Alien creature (large tentacled monster) */}
        <g id="creature">
          {/* Head/eye area */}
          <ellipse cx="250" cy="280" rx="120" ry="100" fill="#4a3a2a" />
          <ellipse cx="280" cy="250" rx="80" ry="70" fill="#6b5a4a" />

          {/* Red glowing eye */}
          <circle cx="300" cy="240" r="35" fill="#ff3300" />
          <circle cx="300" cy="240" r="25" fill="#ff6600" />
          <circle cx="305" cy="235" r="10" fill="#ffff00" />

          {/* Teeth/jaw area */}
          <polygon
            points="150,330 200,360 250,340 300,370 350,340 400,365 280,400"
            fill="#8b7355"
          />
          {/* Individual teeth */}
          <rect x="160" y="340" width="15" height="30" fill="#ffdd00" />
          <rect x="190" y="355" width="15" height="25" fill="#ffdd00" />
          <rect x="230" y="340" width="15" height="30" fill="#ffdd00" />
          <rect x="270" y="360" width="15" height="25" fill="#ffdd00" />
          <rect x="310" y="340" width="15" height="30" fill="#ffdd00" />
          <rect x="350" y="355" width="15" height="25" fill="#ffdd00" />

          {/* Tentacles */}
          <path
            d="M 150 350 Q 100 400 80 500"
            stroke="#4a3a6a"
            strokeWidth="40"
            fill="none"
          />
          <path
            d="M 400 360 Q 450 410 470 510"
            stroke="#5a4a7a"
            strokeWidth="40"
            fill="none"
          />
          <path
            d="M 180 400 Q 120 480 100 600"
            stroke="#6a5a8a"
            strokeWidth="35"
            fill="none"
          />
          <path
            d="M 350 400 Q 420 480 450 600"
            stroke="#5a4a7a"
            strokeWidth="35"
            fill="none"
          />

          {/* Tentacle suction cups */}
          <circle cx="80" cy="500" r="12" fill="#8a6a9a" />
          <circle cx="470" cy="510" r="12" fill="#8a6a9a" />
          <circle cx="100" cy="600" r="10" fill="#9a7aaa" />
          <circle cx="450" cy="600" r="10" fill="#9a7aaa" />
        </g>

        {/* Environment/rocks */}
        <polygon
          points="0,500 200,450 250,650 0,768"
          fill="#3a3a2a"
        />
        <polygon
          points="800,480 1024,450 1024,768 750,768"
          fill="#2a2a1a"
        />
        <rect x="200" y="600" width="150" height="168" fill="#4a4a3a" />
        <rect x="700" y="580" width="120" height="188" fill="#3a3a2a" />

        {/* Player character (small blue robot) */}
        <g id="player" transform="translate(750, 480)">
          {/* Body */}
          <rect x="-20" y="0" width="40" height="50" fill="#1a4a9a" />
          {/* Chest detail */}
          <rect x="-12" y="8" width="24" height="20" fill="#ff6600" />
          {/* Head */}
          <rect x="-18" y="-25" width="36" height="25" fill="#3a6acc" />
          {/* Helmet visor */}
          <rect x="-10" y="-18" width="20" height="12" fill="#66bbff" />
          {/* Left arm */}
          <rect x="-30" y="5" width="12" height="35" fill="#2a5aaa" />
          {/* Right arm */}
          <rect x="18" y="5" width="12" height="35" fill="#2a5aaa" />
          {/* Left leg */}
          <rect x="-15" y="50" width="12" height="30" fill="#1a3a7a" />
          {/* Right leg */}
          <rect x="3" y="50" width="12" height="30" fill="#1a3a7a" />
        </g>

        {/* GAME OVER text */}
        <text
          x="512"
          y="100"
          fontSize="120"
          fontWeight="bold"
          fill="#ff3300"
          textAnchor="middle"
          fontFamily="Arial, sans-serif"
          style={{
            textShadow: '4px 4px 0px #000000',
            filter: 'drop-shadow(4px 4px 0px #000000)',
          }}
        >
          GAME OVER
        </text>
      </svg>
    </div>
  );
}