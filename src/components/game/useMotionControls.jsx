import { useEffect, useRef } from 'react';
import { initMotionControls } from '../../lib/motionControls.js';

export function useMotionControls(keysRef, motionEnabled, mobileSpeed, invertX = false, invertY = false) {
  const motionControlsRef = useRef(null);

  useEffect(() => {
    if (motionEnabled) {
      if (!motionControlsRef.current) {
        motionControlsRef.current = initMotionControls(keysRef, mobileSpeed, invertX, invertY);
      }
      motionControlsRef.current.start();
    } else {
      if (motionControlsRef.current) {
        motionControlsRef.current.stop();
      }
    }
    
    return () => {
      if (motionControlsRef.current && motionEnabled) {
        motionControlsRef.current.stop();
      }
    };
  }, [motionEnabled, mobileSpeed, invertX, invertY, keysRef]);
}