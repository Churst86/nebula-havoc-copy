import React, { useState, useRef, useCallback, useEffect } from 'react';

export default function MobileControls({ keysRef }) {
  const joystickRef = useRef(null);
  const activeRef = useRef(false);
  const centerRef = useRef({ x: 0, y: 0 });

  const updateKeys = useCallback((dx, dy) => {
    const threshold = 20;
    keysRef.current['ArrowLeft'] = dx < -threshold;
    keysRef.current['ArrowRight'] = dx > threshold;
    keysRef.current['ArrowUp'] = dy < -threshold;
    keysRef.current['ArrowDown'] = dy > threshold;
  }, [keysRef]);

  const clearKeys = useCallback(() => {
    keysRef.current['ArrowLeft'] = false;
    keysRef.current['ArrowRight'] = false;
    keysRef.current['ArrowUp'] = false;
    keysRef.current['ArrowDown'] = false;
  }, [keysRef]);

  const handleStart = useCallback((e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = joystickRef.current.getBoundingClientRect();
    centerRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    activeRef.current = true;
  }, []);

  const handleMove = useCallback((e) => {
    e.preventDefault();
    if (!activeRef.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - centerRef.current.x;
    const dy = touch.clientY - centerRef.current.y;
    updateKeys(dx, dy);
  }, [updateKeys]);

  const handleEnd = useCallback((e) => {
    e.preventDefault();
    activeRef.current = false;
    clearKeys();
  }, [clearKeys]);

  // Check if mobile
  const [isMobile, setIsMobile] = React.useState(false);
  useEffect(() => {
    setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  if (!isMobile) return null;

  return (
    <div className="absolute bottom-8 left-8 z-20 pointer-events-auto">
      <div
        ref={joystickRef}
        className="w-28 h-28 rounded-full border-2 border-primary/30 bg-primary/10 backdrop-blur-sm flex items-center justify-center"
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
      >
        <div className="w-12 h-12 rounded-full bg-primary/40 border border-primary/60" />
      </div>
    </div>
  );
}