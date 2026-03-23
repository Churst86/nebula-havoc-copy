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
    const threshold = 0.5; // Minimum tilt to start moving
    const maxTilt = 6.0; // Tilt magnitude for full speed

    // Apply inversion if enabled
    if (invertX) x = -x;
    if (invertY) y = -y;

    // Calculate normalized speed values (0 to 2 range for boost)
    // Below threshold: 0, at maxTilt or beyond: 2
    const absX = Math.abs(x);
    const absY = Math.abs(y);
    const speedX = absX <= threshold ? 0 : Math.sign(x) * Math.min((absX - threshold) / (maxTilt - threshold) * 2, 2);
    const speedY = absY <= threshold ? 0 : Math.sign(y) * Math.min((absY - threshold) / (maxTilt - threshold) * 2, 2);

    // Apply sensitivity multiplier and store as motion values
    keysRef.current['motionX'] = speedX * sensitivityMultiplier;
    keysRef.current['motionY'] = speedY * sensitivityMultiplier;
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