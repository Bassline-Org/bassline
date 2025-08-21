/**
 * Sequencer Component - React UI for the Drum Sequencer app
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTemplate, useContact } from './react-templates'
import { SequencerTemplate } from './sequencer-app'

interface SequencerProps {
  appId?: string
}

interface StepPattern {
  kick: boolean
  snare: boolean
  hihat: boolean
}

// Simple sound generation using Web Audio
function playDrum(type: 'kick' | 'snare' | 'hihat') {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
  const oscillator = audioContext.createOscillator()
  const gainNode = audioContext.createGain()
  
  oscillator.connect(gainNode)
  gainNode.connect(audioContext.destination)
  
  const now = audioContext.currentTime
  
  switch (type) {
    case 'kick':
      oscillator.frequency.setValueAtTime(60, now)
      oscillator.frequency.exponentialRampToValueAtTime(40, now + 0.1)
      gainNode.gain.setValueAtTime(1, now)
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5)
      oscillator.start(now)
      oscillator.stop(now + 0.5)
      break
      
    case 'snare':
      // White noise for snare
      const bufferSize = audioContext.sampleRate * 0.1
      const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate)
      const output = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1
      }
      const noise = audioContext.createBufferSource()
      noise.buffer = buffer
      noise.connect(gainNode)
      gainNode.gain.setValueAtTime(0.5, now)
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1)
      noise.start(now)
      break
      
    case 'hihat':
      oscillator.frequency.setValueAtTime(8000, now)
      gainNode.gain.setValueAtTime(0.3, now)
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05)
      oscillator.start(now)
      oscillator.stop(now + 0.05)
      break
  }
}

export function Sequencer({ appId = 'sequencer-app' }: SequencerProps) {
  const sequencer = useTemplate(SequencerTemplate, {}, appId)
  
  // Control inputs
  const [, setClock] = useContact<boolean>(sequencer.gadget, 'clock')
  const [, setPlaying] = useContact<boolean>(sequencer.gadget, 'playing')
  const [, setReset] = useContact<boolean>(sequencer.gadget, 'reset')
  const [, setLength] = useContact<number>(sequencer.gadget, 'length')
  
  // Step pattern setters
  const stepSetters = Array.from({ length: 8 }, (_, i) => 
    useContact<StepPattern>(sequencer.gadget, `step${i}`)[1]
  )
  
  // Outputs
  const [currentStep] = useContact<number>(sequencer.gadget, 'currentStep')
  const [kickTrigger] = useContact<boolean>(sequencer.gadget, 'kickTrigger')
  const [snareTrigger] = useContact<boolean>(sequencer.gadget, 'snareTrigger')
  const [hihatTrigger] = useContact<boolean>(sequencer.gadget, 'hihatTrigger')
  
  // Step active indicators
  const stepActives = Array.from({ length: 8 }, (_, i) => 
    useContact<boolean>(sequencer.gadget, `stepActive${i}`)[0]
  )
  
  // Local state for pattern
  const [pattern, setPattern] = useState<StepPattern[]>(
    Array.from({ length: 8 }, () => ({ kick: false, snare: false, hihat: false }))
  )
  const [localPlaying, setLocalPlaying] = useState(false)
  const [tempo, setTempo] = useState(120) // BPM
  
  // Play sounds when triggers fire
  useEffect(() => {
    if (kickTrigger) playDrum('kick')
  }, [kickTrigger])
  
  useEffect(() => {
    if (snareTrigger) playDrum('snare')
  }, [snareTrigger])
  
  useEffect(() => {
    if (hihatTrigger) playDrum('hihat')
  }, [hihatTrigger])
  
  // Internal clock generation (can be replaced by external oscillator)
  const intervalRef = useRef<NodeJS.Timeout>()
  
  useEffect(() => {
    if (localPlaying) {
      const intervalMs = (60 / tempo / 4) * 1000 // 16th notes
      intervalRef.current = setInterval(() => {
        setClock(true)
        setTimeout(() => setClock(false), 10) // Short pulse
      }, intervalMs)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [localPlaying, tempo, setClock])
  
  // Handle pattern changes
  const toggleStep = useCallback((stepIndex: number, drum: 'kick' | 'snare' | 'hihat') => {
    const newPattern = [...pattern]
    newPattern[stepIndex] = {
      ...newPattern[stepIndex],
      [drum]: !newPattern[stepIndex][drum]
    }
    setPattern(newPattern)
    stepSetters[stepIndex](newPattern[stepIndex])
  }, [pattern, stepSetters])
  
  // Handle play/pause
  const handlePlayPause = useCallback(() => {
    const newPlaying = !localPlaying
    setLocalPlaying(newPlaying)
    setPlaying(newPlaying)
  }, [localPlaying, setPlaying])
  
  // Handle reset
  const handleReset = useCallback(() => {
    setReset(true)
    requestAnimationFrame(() => setReset(false))
  }, [setReset])
  
  // Handle clear pattern
  const handleClear = useCallback(() => {
    const emptyPattern = Array.from({ length: 8 }, () => ({ kick: false, snare: false, hihat: false }))
    setPattern(emptyPattern)
    emptyPattern.forEach((step, i) => stepSetters[i](step))
  }, [stepSetters])
  
  // Preset patterns
  const loadPreset = useCallback((preset: 'basic' | 'funky' | 'techno') => {
    let newPattern: StepPattern[] = []
    
    switch (preset) {
      case 'basic':
        newPattern = [
          { kick: true, snare: false, hihat: true },
          { kick: false, snare: false, hihat: true },
          { kick: false, snare: true, hihat: true },
          { kick: false, snare: false, hihat: true },
          { kick: true, snare: false, hihat: true },
          { kick: false, snare: false, hihat: true },
          { kick: false, snare: true, hihat: true },
          { kick: false, snare: false, hihat: false },
        ]
        break
      case 'funky':
        newPattern = [
          { kick: true, snare: false, hihat: false },
          { kick: false, snare: false, hihat: true },
          { kick: false, snare: true, hihat: false },
          { kick: true, snare: false, hihat: true },
          { kick: false, snare: false, hihat: false },
          { kick: false, snare: false, hihat: true },
          { kick: false, snare: true, hihat: false },
          { kick: false, snare: false, hihat: true },
        ]
        break
      case 'techno':
        newPattern = [
          { kick: true, snare: false, hihat: false },
          { kick: false, snare: false, hihat: false },
          { kick: true, snare: false, hihat: true },
          { kick: false, snare: false, hihat: false },
          { kick: true, snare: false, hihat: false },
          { kick: false, snare: false, hihat: false },
          { kick: true, snare: false, hihat: true },
          { kick: false, snare: false, hihat: false },
        ]
        break
    }
    
    setPattern(newPattern)
    newPattern.forEach((step, i) => stepSetters[i](step))
  }, [stepSetters])
  
  return (
    <div className="p-4 bg-gray-900 h-full flex flex-col text-white min-w-[500px]">
      <h2 className="text-xl font-bold mb-4">Drum Sequencer</h2>
      
      {/* Pattern Grid */}
      <div className="mb-4">
        <div className="grid grid-cols-9 gap-1">
          {/* Headers */}
          <div className="text-xs text-gray-400 p-2"></div>
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="text-center text-xs text-gray-400 p-1">
              {i + 1}
            </div>
          ))}
          
          {/* Kick row */}
          <div className="text-xs text-gray-300 p-2">Kick</div>
          {Array.from({ length: 8 }, (_, i) => (
            <button
              key={`kick-${i}`}
              onClick={() => toggleStep(i, 'kick')}
              className={`h-10 rounded transition-all ${
                pattern[i].kick
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-gray-700 hover:bg-gray-600'
              } ${stepActives[i] ? 'ring-2 ring-white' : ''}`}
            />
          ))}
          
          {/* Snare row */}
          <div className="text-xs text-gray-300 p-2">Snare</div>
          {Array.from({ length: 8 }, (_, i) => (
            <button
              key={`snare-${i}`}
              onClick={() => toggleStep(i, 'snare')}
              className={`h-10 rounded transition-all ${
                pattern[i].snare
                  ? 'bg-yellow-600 hover:bg-yellow-700'
                  : 'bg-gray-700 hover:bg-gray-600'
              } ${stepActives[i] ? 'ring-2 ring-white' : ''}`}
            />
          ))}
          
          {/* Hihat row */}
          <div className="text-xs text-gray-300 p-2">HiHat</div>
          {Array.from({ length: 8 }, (_, i) => (
            <button
              key={`hihat-${i}`}
              onClick={() => toggleStep(i, 'hihat')}
              className={`h-10 rounded transition-all ${
                pattern[i].hihat
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-gray-700 hover:bg-gray-600'
              } ${stepActives[i] ? 'ring-2 ring-white' : ''}`}
            />
          ))}
        </div>
      </div>
      
      {/* Tempo Control */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">
          Tempo: {tempo} BPM
        </label>
        <input
          type="range"
          min="60"
          max="180"
          value={tempo}
          onChange={(e) => setTempo(parseInt(e.target.value))}
          className="w-full"
        />
      </div>
      
      {/* Transport */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={handlePlayPause}
          className={`flex-1 px-4 py-2 rounded font-medium ${
            localPlaying
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {localPlaying ? 'Stop' : 'Play'}
        </button>
        <button
          onClick={handleReset}
          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded"
        >
          Reset
        </button>
        <button
          onClick={handleClear}
          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded"
        >
          Clear
        </button>
      </div>
      
      {/* Presets */}
      <div className="flex gap-2">
        <button
          onClick={() => loadPreset('basic')}
          className="flex-1 px-2 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm"
        >
          Basic
        </button>
        <button
          onClick={() => loadPreset('funky')}
          className="flex-1 px-2 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm"
        >
          Funky
        </button>
        <button
          onClick={() => loadPreset('techno')}
          className="flex-1 px-2 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm"
        >
          Techno
        </button>
      </div>
      
      {/* Status */}
      <div className="mt-auto pt-3 border-t border-gray-700 text-xs text-gray-400">
        <div>Current Step: {(currentStep ?? 0) + 1} / 8</div>
        <div>Status: {localPlaying ? 'Playing' : 'Stopped'}</div>
        <div className="mt-1 text-gray-500">
          💡 Connect an Oscillator's trigger output to this sequencer's clock input for external sync!
        </div>
      </div>
    </div>
  )
}