/**
 * UUID generation utility
 * Works in both Node.js and browsers
 */

export function generateUUID(): string {
  // Use crypto.randomUUID() if available (Node 14.17+ and modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  
  // Fallback to manual UUID v4 generation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}