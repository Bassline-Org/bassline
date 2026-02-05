import { KEYBOARD_NOCAPTURE } from './constants'

/**
 * Check if an event target or any of its ancestors has the nocapture class.
 * Used by keyboard handlers to determine if they should ignore the event.
 */
export function shouldIgnoreKeyboardEvent(event: React.KeyboardEvent | KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null
  if (!target) return false

  // Check if target or any ancestor has the nocapture class
  return target.closest(`.${KEYBOARD_NOCAPTURE}`) !== null
}

/**
 * Check if the event target is a text input element where
 * keyboard navigation should be preserved.
 */
export function isTextInputElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false

  const tagName = target.tagName.toLowerCase()

  // Standard text inputs
  if (tagName === 'textarea') return true
  if (tagName === 'input') {
    const type = (target as HTMLInputElement).type.toLowerCase()
    return ['text', 'search', 'url', 'tel', 'email', 'password', 'number'].includes(type)
  }

  // Contenteditable
  if (target.isContentEditable) return true

  return false
}
