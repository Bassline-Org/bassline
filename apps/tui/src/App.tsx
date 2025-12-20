import React, { useState, useEffect } from 'react'
import DaemonPicker from './components/DaemonPicker.js'
import Workspace from './components/Workspace.js'
import { Connection, loadConnections, getDefaultConnectionId, getConnection, testConnection } from './connections.js'

export default function App() {
  const [connection, setConnection] = useState<Connection | null>(null)
  const [loading, setLoading] = useState(true)

  // On mount, try to connect to default connection
  useEffect(() => {
    const init = async () => {
      const defaultId = getDefaultConnectionId()
      if (defaultId) {
        const conn = getConnection(defaultId)
        if (conn) {
          const alive = await testConnection(conn.url)
          if (alive) {
            setConnection(conn)
          }
        }
      }
      setLoading(false)
    }
    init()
  }, [])

  if (loading) {
    return null // Brief loading state
  }

  if (!connection) {
    return <DaemonPicker onConnect={setConnection} />
  }

  return (
    <Workspace connection={connection} onDisconnect={() => setConnection(null)} onSwitchConnection={setConnection} />
  )
}
