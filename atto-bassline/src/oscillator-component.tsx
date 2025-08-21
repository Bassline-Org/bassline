/**
 * Oscillator Component - React UI for the Oscillator app
 * Generates waveforms using setInterval and writes to the network
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTemplate, useContact } from './react-templates'
import { OscillatorTemplate } from './oscillator-app'

interface OscillatorProps {
  appId?: string
}

// Waveform generation functions
const waveformGenerators = {
  sine: (phase: number) => Math.sin(phase),
  square: (phase: number) => phase < Math.PI ? 1 : -1,
  saw: (phase: number) => (phase / Math.PI) - 1,
  triangle: (phase: number) => {
    const p = phase / Math.PI
    return p < 1 ? (p * 2 - 1) : (3 - p * 2)
  }
}

export function Oscillator({ appId = 'oscillator-app' }: OscillatorProps) {
  const oscillator = useTemplate(OscillatorTemplate, {}, appId)
  
  // Control inputs
  const [, setFrequency] = useContact<number>(oscillator.gadget, 'frequency')
  const [, setAmplitude] = useContact<number>(oscillator.gadget, 'amplitude')
  const [, setWaveform] = useContact<string>(oscillator.gadget, 'waveform')
  const [, setPlaying] = useContact<boolean>(oscillator.gadget, 'playing')
  const [, setReset] = useContact<boolean>(oscillator.gadget, 'reset')
  
  // Outputs - we write to these
  const [, setWaveValue] = useContact<number>(oscillator.gadget, 'waveValue')
  const [, setNormalizedValue] = useContact<number>(oscillator.gadget, 'normalizedValue')
  const [, setCurrentPhase] = useContact<number>(oscillator.gadget, 'currentPhase')
  const [, setTrigger] = useContact<boolean>(oscillator.gadget, 'trigger')
  const [, setGate] = useContact<boolean>(oscillator.gadget, 'gate')
  
  // Read back for display
  const [actualFrequency] = useContact<number>(oscillator.gadget, 'actualFrequency')
  const [isPlaying] = useContact<boolean>(oscillator.gadget, 'isPlaying')
  const [waveformType] = useContact<string>(oscillator.gadget, 'waveformType')
  
  // Local state for UI
  const [localFreq, setLocalFreq] = useState(1)
  const [localAmp, setLocalAmp] = useState(1)
  const [localWaveform, setLocalWaveform] = useState('sine')
  const [localPlaying, setLocalPlaying] = useState(false)
  
  // Animation state
  const phaseRef = useRef(0)
  const lastTimeRef = useRef(0)
  const animationRef = useRef<number>()
  const lastTriggerRef = useRef(false)
  
  // Canvas for visualization
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  // Animation loop
  const animate = useCallback((timestamp: number) => {
    if (!lastTimeRef.current) {
      lastTimeRef.current = timestamp
    }
    
    const deltaTime = (timestamp - lastTimeRef.current) / 1000 // Convert to seconds
    lastTimeRef.current = timestamp
    
    // Update phase based on frequency
    const freq = actualFrequency || localFreq
    phaseRef.current = (phaseRef.current + deltaTime * freq * 2 * Math.PI) % (2 * Math.PI)
    
    // Generate wave value
    const generator = waveformGenerators[waveformType || localWaveform] || waveformGenerators.sine
    const rawValue = generator(phaseRef.current)
    const amplitude = localAmp
    const waveValue = rawValue * amplitude
    
    // Write to network
    setWaveValue(waveValue)
    setNormalizedValue((waveValue + 1) / 2)
    setCurrentPhase(phaseRef.current)
    
    // Generate triggers
    const currentGate = waveValue > 0
    setGate(currentGate)
    
    // Trigger on positive zero crossing
    const currentTrigger = !lastTriggerRef.current && currentGate
    if (currentTrigger) {
      setTrigger(true)
      // Clear trigger after a frame
      requestAnimationFrame(() => setTrigger(false))
    }
    lastTriggerRef.current = currentGate
    
    // Draw visualization
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        const width = canvas.width
        const height = canvas.height
        
        // Clear
        ctx.fillStyle = '#000'
        ctx.fillRect(0, 0, width, height)
        
        // Draw waveform
        ctx.strokeStyle = '#0f0'
        ctx.lineWidth = 2
        ctx.beginPath()
        
        for (let x = 0; x < width; x++) {
          const phase = (x / width) * 2 * Math.PI
          const y = height / 2 - generator(phase) * amplitude * (height / 2 - 10)
          if (x === 0) {
            ctx.moveTo(x, y)
          } else {
            ctx.lineTo(x, y)
          }
        }
        ctx.stroke()
        
        // Draw current position
        const currentX = (phaseRef.current / (2 * Math.PI)) * width
        const currentY = height / 2 - waveValue * (height / 2 - 10)
        ctx.fillStyle = '#f00'
        ctx.beginPath()
        ctx.arc(currentX, currentY, 5, 0, 2 * Math.PI)
        ctx.fill()
      }
    }
    
    // Continue animation
    if (localPlaying) {
      animationRef.current = requestAnimationFrame(animate)
    }
  }, [actualFrequency, localFreq, localAmp, localWaveform, waveformType, localPlaying,
      setWaveValue, setNormalizedValue, setCurrentPhase, setTrigger, setGate])
  
  // Start/stop animation
  useEffect(() => {
    if (localPlaying) {
      lastTimeRef.current = 0
      animationRef.current = requestAnimationFrame(animate)
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [localPlaying, animate])
  
  // Handle play/pause
  const handlePlayPause = useCallback(() => {
    const newPlaying = !localPlaying
    setLocalPlaying(newPlaying)
    setPlaying(newPlaying)
  }, [localPlaying, setPlaying])
  
  // Handle reset
  const handleReset = useCallback(() => {
    phaseRef.current = 0
    setReset(true)
    requestAnimationFrame(() => setReset(false))
  }, [setReset])
  
  // Handle frequency change
  const handleFreqChange = useCallback((value: number) => {
    setLocalFreq(value)
    setFrequency(value)
  }, [setFrequency])
  
  // Handle amplitude change
  const handleAmpChange = useCallback((value: number) => {
    setLocalAmp(value)
    setAmplitude(value)
  }, [setAmplitude])
  
  // Handle waveform change
  const handleWaveformChange = useCallback((value: string) => {
    setLocalWaveform(value)
    setWaveform(value)
  }, [setWaveform])
  
  return (
    <div className="p-4 bg-gray-900 h-full flex flex-col text-white">
      <h2 className="text-xl font-bold mb-4">Oscillator</h2>
      
      {/* Visualization */}
      <canvas 
        ref={canvasRef}
        width={300}
        height={150}
        className="bg-black border border-gray-700 rounded mb-4"
      />
      
      {/* Controls */}
      <div className="space-y-3">
        {/* Frequency */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Frequency: {localFreq.toFixed(2)} Hz
          </label>
          <input
            type="range"
            min="0.1"
            max="10"
            step="0.1"
            value={localFreq}
            onChange={(e) => handleFreqChange(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>
        
        {/* Amplitude */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Amplitude: {(localAmp * 100).toFixed(0)}%
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={localAmp}
            onChange={(e) => handleAmpChange(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>
        
        {/* Waveform */}
        <div>
          <label className="block text-sm font-medium mb-1">Waveform</label>
          <div className="grid grid-cols-4 gap-2">
            {Object.keys(waveformGenerators).map((wave) => (
              <button
                key={wave}
                onClick={() => handleWaveformChange(wave)}
                className={`px-2 py-1 rounded text-sm ${
                  localWaveform === wave
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {wave}
              </button>
            ))}
          </div>
        </div>
        
        {/* Transport */}
        <div className="flex gap-2">
          <button
            onClick={handlePlayPause}
            className={`flex-1 px-4 py-2 rounded font-medium ${
              localPlaying
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {localPlaying ? 'Stop' : 'Start'}
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded"
          >
            Reset
          </button>
        </div>
      </div>
      
      {/* Status */}
      <div className="mt-4 pt-3 border-t border-gray-700 text-xs text-gray-400">
        <div>Status: {localPlaying ? 'Running' : 'Stopped'}</div>
        <div>Phase: {(phaseRef.current / Math.PI).toFixed(2)}π</div>
      </div>
    </div>
  )
}