/**
 * SoundMode - Plays sound effects for various actions
 */

import { MinorModeBase } from '../MinorModeBase'
import type { ModeContext, Command } from '../types'

export class SoundMode extends MinorModeBase {
  id = 'sound'
  name = 'Sound'
  icon = '🔊'
  description = 'Audio feedback for actions'
  
  // In real implementation, would use the actual sound system
  private sounds = {
    connect: 440, // Hz
    disconnect: 220,
    create: 523,
    delete: 261,
    move: 330,
    select: 587
  }
  
  onEnable(_context: ModeContext): void {
    // Could play a "mode enabled" sound
    this.playSound(this.sounds.select, 0.1)
  }
  
  onDisable(_context: ModeContext): void {
    // Could play a "mode disabled" sound
    this.playSound(this.sounds.disconnect, 0.1)
  }
  
  afterCommand(command: Command, _result: any, _context: ModeContext): void {
    // Play sounds based on command type
    switch (command.type) {
      case 'connect':
        this.playSound(this.sounds.connect, 0.2)
        break
      case 'disconnect':
        this.playSound(this.sounds.disconnect, 0.2)
        break
      case 'createNode':
        this.playSound(this.sounds.create, 0.2)
        break
      case 'deleteNode':
        this.playSound(this.sounds.delete, 0.2)
        break
      case 'moveNode':
        // Debounce move sounds to avoid spam
        this.playSound(this.sounds.move, 0.05)
        break
      case 'select':
      case 'addToSelection':
        this.playSound(this.sounds.select, 0.1)
        break
    }
  }
  
  private playSound(frequency: number, duration: number): void {
    // Simplified sound generation
    // In real implementation would use the SoundSystem
    if (typeof window === 'undefined' || !window.AudioContext) return
    
    try {
      const audioContext = new AudioContext()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      oscillator.frequency.value = frequency
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration)
      
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + duration)
    } catch (e) {
      // Ignore audio errors
    }
  }
}