import React, { useRef, useCallback, useEffect } from 'react';

export default function MobileControls({ keysRef, mobileSpeed = 1.0, joystickVisible = true, joystickSize = 1.0 }) {
  const joystickRef = useRef(null);
  const activeRef = useRef(false);
  const centerRef = useRef({ x: 0, y: 0 });

  const updateKeys = useCallback((dx, dy) => {
    // Higher mobileSpeed = lower threshold = more sensitive
    const threshold = Math.max(2, 8 / mobileSpeed);
    keysRef.current['ArrowLeft'] = dx < -threshold;
    keysRef.current['ArrowRight'] = dx > threshold;
    keysRef.current['ArrowUp'] = dy < -threshold;
    keysRef.current['ArrowDown'] = dy > threshold;
  }, [keysRef, mobileSpeed]);

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

  const outerSize = 208 * joystickSize;
  const innerSize = 96 * joystickSize;
  const outerColor = joystickVisible ? 'rgba(0, 240, 255, 0.18)' : 'transparent';
  const outerBorder = joystickVisible ? '3px solid rgba(0, 240, 255, 0.75)' : 'none';
  const innerColor = joystickVisible ? 'rgba(0, 240, 255, 0.45)' : 'transparent';
  const innerBorder = joystickVisible ? '2px solid rgba(0, 240, 255, 0.9)' : 'none';

  return (
    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
      <div
        ref={joystickRef}
        className="rounded-full flex items-center justify-center"
        style={{ width: outerSize, height: outerSize, background: outerColor, border: outerBorder }}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
      >
        <div className="rounded-full" style={{ width: innerSize, height: innerSize, background: innerColor, border: innerBorder }} />
      </div>
    </div>
  );
}