/**
 * TypeAffordance - Captures keyboard input and emits text
 */

import { Affordance, type InputEvent } from '../affordance'
import { str, bool, num } from '../types'
import type { LatticeValue } from '../types'
import type { Cell } from '../cell'

export class TypeAffordance extends Affordance {
  // Text state
  private text: string = ''
  private cursorPosition: number = 0
  private isActive: boolean = false
  
  constructor(id: string = 'type', target?: Cell, initialText: string = '') {
    super(id, target)
    
    this.text = initialText
    this.cursorPosition = initialText.length
    
    // Additional outputs
    this.setOutput('active', bool(false))
    this.setOutput('cursor', num(this.cursorPosition))
  }
  
  protected handleSpecificInput(event: InputEvent): boolean {
    if (event.type !== 'key') return false
    
    const key = event.key
    if (!key) return false
    
    let changed = false
    
    // Handle special keys
    switch (key) {
      case 'Enter':
        // Emit current text and clear
        this.emitValue(str(this.text))
        if (event.modifiers?.shift) {
          // Shift+Enter adds newline
          this.text += '\n'
          this.cursorPosition++
        }
        changed = true
        break
        
      case 'Backspace':
        if (this.cursorPosition > 0) {
          this.text = 
            this.text.slice(0, this.cursorPosition - 1) + 
            this.text.slice(this.cursorPosition)
          this.cursorPosition--
          changed = true
        }
        break
        
      case 'Delete':
        if (this.cursorPosition < this.text.length) {
          this.text = 
            this.text.slice(0, this.cursorPosition) + 
            this.text.slice(this.cursorPosition + 1)
          changed = true
        }
        break
        
      case 'ArrowLeft':
        if (this.cursorPosition > 0) {
          this.cursorPosition--
          this.setOutput('cursor', num(this.cursorPosition))
        }
        break
        
      case 'ArrowRight':
        if (this.cursorPosition < this.text.length) {
          this.cursorPosition++
          this.setOutput('cursor', num(this.cursorPosition))
        }
        break
        
      case 'Home':
        this.cursorPosition = 0
        this.setOutput('cursor', num(this.cursorPosition))
        break
        
      case 'End':
        this.cursorPosition = this.text.length
        this.setOutput('cursor', num(this.cursorPosition))
        break
        
      case 'Escape':
        // Clear text
        this.text = ''
        this.cursorPosition = 0
        changed = true
        break
        
      default:
        // Regular character input
        if (key.length === 1) {
          this.text = 
            this.text.slice(0, this.cursorPosition) + 
            key + 
            this.text.slice(this.cursorPosition)
          this.cursorPosition++
          changed = true
        }
        break
    }
    
    if (changed) {
      this.emitValue(str(this.text))
      this.setOutput('cursor', num(this.cursorPosition))
    }
    
    return true
  }
  
  protected getDefaultOutput(): LatticeValue {
    return str(this.text)
  }
  
  protected getAffordanceType(): string {
    return 'type'
  }
  
  /**
   * Set the text programmatically
   */
  setText(text: string): void {
    this.text = text
    this.cursorPosition = text.length
    this.emitValue(str(text))
    this.setOutput('cursor', num(this.cursorPosition))
  }
  
  /**
   * Get current text
   */
  getText(): string {
    return this.text
  }
  
  /**
   * Activate/deactivate typing (for focus management)
   */
  setActive(active: boolean): void {
    this.isActive = active
    this.setOutput('active', bool(active))
  }
}