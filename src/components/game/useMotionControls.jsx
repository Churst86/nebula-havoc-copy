import { useEffect, useRef } from 'react';
import { initVariableSpeedMotionControls } from '../../lib/variableSpeedMotionControls.js';

export function useMotionControls(keysRef, motionEnabled, mobileSpeed, invertX = false, invertY = false) {
  const motionControlsRef = useRef(null);

  useEffect(() => {
    if (motionEnabled) {
      // Stop and reinitialize on any setting change
      if (motionControlsRef.current) {
        motionControlsRef.current.stop();
      }
      motionControlsRef.current = initVariableSpeedMotionControls(keysRef, mobileSpeed, invertX, invertY);
      motionControlsRef.current.start();
    } else {
      if (motionControlsRef.current) {
        motionControlsRef.current.stop();
      }
    }
    
    return () => {
      if (motionControlsRef.current) {
        motionControlsRef.current.stop();
      }
    };
  }, [motionEnabled, mobileSpeed, invertX, invertY, keysRef]);
}