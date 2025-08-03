/**
 * Utility for properly displaying contact content in the UI
 */
export function formatContentForDisplay(content: any): string {
  if (content === undefined || content === null) {
    return '∅'
  }
  
  // Handle Set objects
  if (content instanceof Set) {
    return `{${Array.from(content).join(', ')}}`
  }
  
  // Handle Map objects
  if (content instanceof Map) {
    const entries = Array.from(content.entries())
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ')
    return `Map{${entries}}`
  }
  
  // Handle Date objects
  if (content instanceof Date) {
    return content.toISOString().split('T')[0] // Just show the date part
  }
  
  // Handle arrays
  if (Array.isArray(content)) {
    return `[${content.join(', ')}]`
  }
  
  // Handle objects
  if (content !== null && typeof content === 'object') {
    try {
      // Try to display as JSON, but limit length
      const json = JSON.stringify(content)
      return json.length > 50 ? json.substring(0, 47) + '...' : json
    } catch {
      return '[Object]'
    }
  }
  
  // Handle primitives
  return String(content)
}

/**
 * Get a detailed tooltip for contact content
 */
export function formatContentForTooltip(content: any): string | undefined {
  if (content === undefined || content === null) {
    return undefined
  }
  
  // Handle Set objects
  if (content instanceof Set) {
    return `Set with ${content.size} items: {${Array.from(content).join(', ')}}`
  }
  
  // Handle Map objects
  if (content instanceof Map) {
    const entries = Array.from(content.entries())
      .map(([k, v]) => `${k}: ${v}`)
    return `Map with ${content.size} entries: {${entries.join(', ')}}`
  }
  
  // Handle Date objects
  if (content instanceof Date) {
    return `Date: ${content.toISOString()}`
  }
  
  // Handle arrays
  if (Array.isArray(content)) {
    return `Array with ${content.length} items: [${content.join(', ')}]`
  }
  
  // Handle objects
  if (content !== null && typeof content === 'object') {
    try {
      return JSON.stringify(content, null, 2)
    } catch {
      return 'Complex object'
    }
  }
  
  return String(content)
}