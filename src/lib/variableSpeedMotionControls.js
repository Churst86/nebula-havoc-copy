/**
 * Variable speed motion controls — tilt intensity maps to movement speed
 * Stores normalized motion values (-1 to 1) based on accelerometer tilt
 */

export function initVariableSpeedMotionControls(keysRef, sensitivityMultiplier = 1.0, invertX = false, invertY = false) {
  let isListening = false;

  async function requestPermission() {
    if (typeof DeviceMotionEvent === 'undefined') return false;
    if (typeof DeviceMotionEvent.requestPermission !== 'function') {
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

    let { x, y } = e.accelerationIncludingGravity;
    const threshold = 1.0; // Minimum tilt to start moving
    const maxTilt = 12.0; // Tilt magnitude for full speed

    // Apply inversion if enabled
    if (invertX) x = -x;
    if (invertY) y = -y;

    // Calculate normalized speed values (-1 to 1 range)
    // Below threshold: 0, at maxTilt or beyond: ±1
    const normalizedX = Math.abs(x) <= threshold ? 0 : Math.sign(x) * Math.min(Math.max((Math.abs(x) - threshold) / (maxTilt - threshold), 0), 1);
    const normalizedY = Math.abs(y) <= threshold ? 0 : Math.sign(y) * Math.min(Math.max((Math.abs(y) - threshold) / (maxTilt - threshold), 0), 1);

    // Apply sensitivity multiplier and store as motion values
    keysRef.current['motionX'] = normalizedX * sensitivityMultiplier;
    keysRef.current['motionY'] = normalizedY * sensitivityMultiplier;
  }

  async function start() {
    if (isListening) return;

    const hasPermission = await requestPermission();
    if (!hasPermission) return false;

    window.addEventListener('devicemotion', handleDeviceMotion);
    isListening = true;
    return true;
  }

  function stop() {
    if (!isListening) return;
    window.removeEventListener('devicemotion', handleDeviceMotion);
    isListening = false;
    keysRef.current['motionX'] = 0;
    keysRef.current['motionY'] = 0;
  }

  return { start, stop, isListening: () => isListening };
}