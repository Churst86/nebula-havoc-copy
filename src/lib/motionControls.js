/**
 * Motion sensor controls handler
 * Translates device motion/acceleration into directional input
 */

export function initMotionControls(keysRef, sensitivityMultiplier = 1.0, invertX = false, invertY = false) {
  let hasPermission = false;
  let isListening = false;

  async function requestPermission() {
    if (typeof DeviceMotionEvent === 'undefined') return false;
    if (typeof DeviceMotionEvent.requestPermission !== 'function') {
      // Non-iOS devices don't need explicit permission
      return true;
    }
    try {
      const permission = await DeviceMotionEvent.requestPermission();
      return permission === 'granted';
    } catch {
      return false;
    }
  }

  function handleDeviceMotion(e) {
    if (!e.accelerationIncludingGravity) return;
    
    const { x, y } = e.accelerationIncludingGravity;
    // Threshold to prevent noise (adjust as needed)
    const threshold = 2;
    const multiplier = 5 * sensitivityMultiplier;

    // Map acceleration to directional keys
    // x-axis: tilt left/right
    // y-axis: tilt forward/backward
    keysRef.current['ArrowLeft'] = x < -threshold;
    keysRef.current['ArrowRight'] = x > threshold;
    keysRef.current['ArrowUp'] = y < -threshold;
    keysRef.current['ArrowDown'] = y > threshold;
  }

  async function start() {
    if (isListening) return;
    
    hasPermission = await requestPermission();
    if (!hasPermission) return false;

    window.addEventListener('devicemotion', handleDeviceMotion);
    isListening = true;
    return true;
  }

  function stop() {
    if (!isListening) return;
    window.removeEventListener('devicemotion', handleDeviceMotion);
    isListening = false;
    // Clear all keys when stopping
    keysRef.current['ArrowLeft'] = false;
    keysRef.current['ArrowRight'] = false;
    keysRef.current['ArrowUp'] = false;
    keysRef.current['ArrowDown'] = false;
  }

  return { start, stop, isListening: () => isListening };
}