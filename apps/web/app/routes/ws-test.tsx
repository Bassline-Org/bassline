import { useEffect, useState } from 'react'

export default function WebSocketTest() {
  const [status, setStatus] = useState<string>('Not connected')
  const [messages, setMessages] = useState<string[]>([])
  
  useEffect(() => {
    console.log('Creating test WebSocket connection...')
    
    try {
      const ws = new WebSocket('ws://localhost:8455')
      
      ws.onopen = () => {
        console.log('Test WebSocket opened!')
        setStatus('Connected')
        ws.send(JSON.stringify({ type: 'test', message: 'Hello from test!' }))
      }
      
      ws.onmessage = (event) => {
        console.log('Test WebSocket message:', event.data)
        setMessages(prev => [...prev, event.data])
      }
      
      ws.onerror = (error) => {
        console.error('Test WebSocket error:', error)
        setStatus('Error: ' + error)
      }
      
      ws.onclose = () => {
        console.log('Test WebSocket closed')
        setStatus('Closed')
      }
      
      return () => {
        ws.close()
      }
    } catch (error) {
      console.error('Failed to create WebSocket:', error)
      setStatus('Failed to create: ' + error)
    }
  }, [])
  
  return (
    <div className="p-8">
      <h1 className="text-2xl mb-4">WebSocket Test</h1>
      <div className="mb-4">Status: {status}</div>
      <div>
        <h2 className="text-xl mb-2">Messages:</h2>
        <pre className="bg-gray-100 p-4 rounded">
          {messages.map((msg, i) => (
            <div key={i}>{msg}</div>
          ))}
        </pre>
      </div>
    </div>
  )
}