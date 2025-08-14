/**
 * Simple JS worker for testing
 */

console.log('[SimpleWorker] Worker loaded!')

self.postMessage({ type: 'ready', message: 'Simple worker is ready' })

self.onmessage = (e) => {
  console.log('[SimpleWorker] Got message:', e.data)
  self.postMessage({ type: 'echo', data: e.data })
}