/**
 * TapAffordance - Detects taps/clicks and emits a boolean pulse
 */

import { Affordance, type InputEvent } from '../meta/affordance'
import { bool, num } from '../types'
import type { LatticeValue } from '../types'
import type { Cell } from '../cell'

export class TapAffordance extends Affordance {
  // Configuration
  private tapCount: number = 0
  private lastTapTime: number = 0
  private doubleTapThreshold: number = 300  // ms
  
  constructor(id: string = 'tap', target?: Cell) {
    super(id, target)
  }
  
  protected handleSpecificInput(event: InputEvent): boolean {
    if (event.type !== 'tap') return false
    
    const now = Date.now()
    const timeSinceLastTap = now - this.lastTapTime
    
    // Check for double tap
    if (timeSinceLastTap < this.doubleTapThreshold) {
      this.tapCount++
    } else {
      this.tapCount = 1
    }
    
    this.lastTapTime = now
    
    // Emit true on tap (will automatically revert to false)
    this.emitValue(bool(true))
    
    // Also emit tap count for double/triple tap detection
    this.setOutput('tapCount', num(this.tapCount))
    
    // Reset to false after a short delay (simulating a pulse)
    setTimeout(() => {
      this.emitValue(bool(false))
    }, 50)
    
    return true
  }
  
  protected getDefaultOutput(): LatticeValue {
    return bool(false)
  }
  
  protected getAffordanceType(): string {
    return 'tap'
  }
  
  /**
   * Convenience method to simulate a tap programmatically
   */
  tap(): void {
    this.handleInput({
      type: 'tap',
      position: { x: 0, y: 0 }
    })
  }
}