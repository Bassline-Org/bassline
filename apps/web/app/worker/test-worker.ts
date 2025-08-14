// Simple test worker
console.log('Test worker loading...')

self.postMessage({ type: 'test', message: 'Worker loaded successfully' })

self.onmessage = (e) => {
  console.log('Test worker received:', e.data)
  self.postMessage({ type: 'echo', data: e.data })
}

export {}