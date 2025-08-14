import { useEffect, useState } from 'react'

export default function TestWorkerSimple() {
  const [status, setStatus] = useState('Initializing...')
  const [messages, setMessages] = useState<string[]>([])
  
  useEffect(() => {
    console.log('Creating test worker...')
    
    try {
      const worker = new Worker(
        new URL('../worker/test-worker.ts', import.meta.url),
        { type: 'module' }
      )
      
      worker.onmessage = (e) => {
        console.log('Message from worker:', e.data)
        setMessages(prev => [...prev, JSON.stringify(e.data)])
        if (e.data.type === 'test') {
          setStatus('Worker loaded!')
        }
      }
      
      worker.onerror = (e) => {
        console.error('Worker error:', e)
        setStatus('Worker error!')
      }
      
      // Send test message
      setTimeout(() => {
        worker.postMessage({ test: 'hello' })
      }, 1000)
      
      return () => worker.terminate()
    } catch (error) {
      console.error('Failed to create worker:', error)
      setStatus('Failed to create worker: ' + error)
    }
  }, [])
  
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Test Worker Simple</h1>
      <div className="mb-4">
        <strong>Status:</strong> {status}
      </div>
      <div>
        <strong>Messages:</strong>
        <ul className="list-disc pl-4">
          {messages.map((msg, i) => (
            <li key={i}>{msg}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}