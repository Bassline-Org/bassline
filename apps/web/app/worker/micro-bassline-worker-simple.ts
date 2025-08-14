/**
 * Simplified Micro-Bassline Worker
 * Test without imports first
 */

// For now, just test basic worker functionality
console.log('Worker starting...')

self.postMessage({ type: 'ready' })

self.onmessage = (e: MessageEvent) => {
  const { type } = e.data
  
  switch (type) {
    case 'ping':
      self.postMessage({ type: 'pong' })
      break
      
    default:
      console.warn('Unknown message type:', type)
  }
}

export {}