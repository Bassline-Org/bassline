/**
 * Test worker to verify basic loading
 */

console.log('[TestWorker] Worker script loaded')

// Test basic functionality
self.postMessage({ type: 'test', message: 'Worker is running!' })

// Try importing micro-bassline
try {
  console.log('[TestWorker] Attempting to import micro-bassline...')
  // @ts-ignore - testing dynamic import
  import('micro-bassline').then(
    (module) => {
      console.log('[TestWorker] micro-bassline imported successfully:', module)
      self.postMessage({ type: 'import-success', module: Object.keys(module) })
    },
    (error) => {
      console.error('[TestWorker] Failed to import micro-bassline:', error)
      self.postMessage({ type: 'import-error', error: error.message })
    }
  )
} catch (e) {
  console.error('[TestWorker] Sync error:', e)
  self.postMessage({ type: 'error', error: e })
}

self.onmessage = (e) => {
  console.log('[TestWorker] Received message:', e.data)
  self.postMessage({ type: 'echo', data: e.data })
}