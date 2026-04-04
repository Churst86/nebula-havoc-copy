import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Smartphone } from 'lucide-react';

function Slider({ color, min, max, step, value, onChange, label }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex items-center gap-3">
      <input
        type="range" min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
        style={{ background: `linear-gradient(to right, ${color} ${pct}%, #1a2040 ${pct}%)`, accentColor: color }}
      />
      <span className="text-white font-mono w-12 text-right text-sm">{label}</span>
    </div>
  );
}

export default function ControllerOptionsScreen({ settings, onSettingsChange, onBack }) {
  const [motionSupported] = useState(typeof DeviceMotionEvent !== 'undefined');
  const [motionPermissionError, setMotionPermissionError] = useState(false);

  function update(key, value) {
    const next = { ...settings, [key]: value };
    onSettingsChange(next);
  }

  async function toggleMotionControls() {
    const newValue = !(settings.motionControlEnabled ?? false);
    
    if (newValue && motionSupported) {
      // Request permission on toggle if needed
      if (typeof DeviceMotionEvent?.requestPermission === 'function') {
        try {
          const permission = await DeviceMotionEvent.requestPermission();
          if (permission !== 'granted') {
            setMotionPermissionError(true);
            return;
          }
        } catch {
          setMotionPermissionError(true);
          return;
        }
      }
      setMotionPermissionError(false);
    }
    
    update('motionControlEnabled', newValue);
  }

  const motionEnabled = settings.motionControlEnabled ?? false;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/92 backdrop-blur-md overflow-y-auto"
    >
      <motion.div
        initial={{ scale: 0.88, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.05, type: 'spring', stiffness: 200 }}
        className="w-full max-w-sm space-y-4 md:space-y-5 p-4 md:p-8"
      >
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 to-cyan-600 text-center">
          CONTROLLER
        </h1>

        {/* Joystick Visibility */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-blue-400 uppercase tracking-widest">
              <span className="text-base">📱</span>
              Joystick Visible
            </div>
            <button
              onClick={() => update('joystickVisible', !(settings.joystickVisible !== false))}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border transition-all"
              style={{
                borderColor: (settings.joystickVisible !== false) ? '#00f0ff' : '#444',
                color: (settings.joystickVisible !== false) ? '#00f0ff' : '#666',
                background: (settings.joystickVisible !== false) ? '#00f0ff22' : 'transparent',
              }}>
              {(settings.joystickVisible !== false) ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* Joystick Size */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-indigo-400 uppercase tracking-widest">
            <span className="text-base">📏</span>
            Joystick Size
          </div>
          <div className="flex items-center justify-between gap-3 mb-2 text-xs text-muted-foreground">
            <span>Small</span>
            <span>Large</span>
          </div>
          <Slider color="#6366f1" min={0.6} max={1.8} step={0.1}
            value={settings.joystickSize ?? 1.0}
            onChange={v => update('joystickSize', v)}
            label={`${(settings.joystickSize ?? 1.0).toFixed(1)}×`} />
        </div>

        {/* Motion Controls */}
        {motionSupported && (
          <div className="space-y-2 pt-2 border-t border-cyan-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-green-400 uppercase tracking-widest">
                <Smartphone className="w-4 h-4" />
                Motion Controls
              </div>
              <button
                onClick={toggleMotionControls}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border transition-all"
                style={{
                  borderColor: motionEnabled ? '#44ff88' : '#444',
                  color: motionEnabled ? '#44ff88' : '#666',
                  background: motionEnabled ? '#44ff8822' : 'transparent',
                }}>
                {motionEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Tilt your device to control the ship</p>
            
            {motionEnabled && (
              <>
                <div className="space-y-2 pl-2">
                  <label className="text-xs text-green-400/80 block">Accelerometer Speed</label>
                  <div className="flex items-center justify-between gap-3 mb-1 text-xs text-muted-foreground">
                    <span>1×</span>
                    <span>10×</span>
                  </div>
                  <Slider color="#44ff88" min={1} max={25} step={0.5}
                    value={settings.accelerometerSpeed ?? 1.0}
                    onChange={v => update('accelerometerSpeed', v)}
                    label={`${(settings.accelerometerSpeed ?? 1.0).toFixed(1)}×`} />
                </div>
                <div className="flex items-center justify-between pl-2">
                  <label className="text-xs text-green-400/80">Invert X Axis</label>
                  <button
                    onClick={() => update('motionInvertX', !(settings.motionInvertX ?? false))}
                    className="flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-full border transition-all"
                    style={{
                      borderColor: (settings.motionInvertX ?? false) ? '#44ff88' : '#444',
                      color: (settings.motionInvertX ?? false) ? '#44ff88' : '#666',
                      background: (settings.motionInvertX ?? false) ? '#44ff8822' : 'transparent',
                    }}>
                    {(settings.motionInvertX ?? false) ? 'ON' : 'OFF'}
                  </button>
                </div>
                <div className="flex items-center justify-between pl-2">
                  <label className="text-xs text-green-400/80">Invert Y Axis</label>
                  <button
                    onClick={() => update('motionInvertY', !(settings.motionInvertY ?? false))}
                    className="flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-full border transition-all"
                    style={{
                      borderColor: (settings.motionInvertY ?? false) ? '#44ff88' : '#444',
                      color: (settings.motionInvertY ?? false) ? '#44ff88' : '#666',
                      background: (settings.motionInvertY ?? false) ? '#44ff8822' : 'transparent',
                    }}>
                    {(settings.motionInvertY ?? false) ? 'ON' : 'OFF'}
                  </button>
                </div>
              </>
            )}
            
            {motionPermissionError && (
              <p className="text-xs text-red-400">Motion permission denied. Check device settings.</p>
            )}
          </div>
        )}

        {!motionSupported && (
          <div className="p-3 rounded border border-yellow-600/50 bg-yellow-900/20">
            <p className="text-xs text-yellow-400">Motion controls not supported on this device</p>
          </div>
        )}

        <Button onClick={onBack} variant="outline" className="w-full gap-2 mt-4">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
      </motion.div>
    </motion.div>
  );
}