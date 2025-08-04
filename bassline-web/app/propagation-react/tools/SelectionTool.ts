import type { Tool, ContextFrame } from '~/propagation-react/types/context-frame'

export class SelectAllTool implements Tool {
  id = 'select-all'
  name = 'Select All'
  icon = 'select-all'
  
  onActivate(context: ContextFrame): void {
    // Tool activates, performs selection, then immediately deactivates
  }
  
  onDeactivate(): void {
    // No cleanup needed
  }
  
  handleKeyPress(event: KeyboardEvent, context: ContextFrame): boolean {
    if ((event.metaKey || event.ctrlKey) && event.key === 'a') {
      event.preventDefault()
      // This will be handled by the component that uses this tool
      return true
    }
    return false
  }
}

export class DeselectAllTool implements Tool {
  id = 'deselect-all'
  name = 'Deselect All'
  icon = 'deselect'
  
  onActivate(context: ContextFrame): void {
    // Tool activates, clears selection, then immediately deactivates
  }
  
  onDeactivate(): void {
    // No cleanup needed
  }
  
  handleKeyPress(event: KeyboardEvent, context: ContextFrame): boolean {
    if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'a') {
      event.preventDefault()
      // This will be handled by the component that uses this tool
      return true
    }
    return false
  }
}

export class InvertSelectionTool implements Tool {
  id = 'invert-selection'
  name = 'Invert Selection'
  icon = 'invert'
  
  onActivate(context: ContextFrame): void {
    // Tool activates, inverts selection, then immediately deactivates
  }
  
  onDeactivate(): void {
    // No cleanup needed
  }
}

export class SelectConnectedTool implements Tool {
  id = 'select-connected'
  name = 'Select Connected'
  icon = 'connected'
  
  onActivate(context: ContextFrame): void {
    // Tool activates, selects all connected nodes, then immediately deactivates
  }
  
  onDeactivate(): void {
    // No cleanup needed
  }
}