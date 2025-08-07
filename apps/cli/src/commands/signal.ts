import { Command } from 'commander'
import { WebSocketServer, WebSocket } from 'ws'
import http from 'http'
import os from 'os'

interface Room {
  code: string
  host: string | null
  guests: Set<string>
  createdAt: number
}

interface PeerConnection {
  ws: WebSocket
  peerId: string
  roomCode?: string
}

export function createSignalCommand() {
  const command = new Command('signal')
    .description('Start a WebRTC signaling server')
    .option('-p, --port <port>', 'Port to listen on', '8081')
    .option('--host <host>', 'Host to bind to', '0.0.0.0')
    .action(async (options) => {
      const rooms = new Map<string, Room>()
      const connections = new Map<string, PeerConnection>()
      
      // Create HTTP server
      const server = http.createServer()
      
      // Create WebSocket server
      const wss = new WebSocketServer({ server })
      
      wss.on('connection', (ws: WebSocket) => {
        const peerId = generatePeerId()
        const connection: PeerConnection = { ws, peerId }
        connections.set(peerId, connection)
        
        console.log(`[Signal] Peer connected: ${peerId}`)
        
        ws.on('message', (data: WebSocket.Data) => {
          try {
            const message = JSON.parse(data.toString())
            handleMessage(connection, message, rooms, connections)
          } catch (error) {
            console.error('[Signal] Error handling message:', error)
            ws.send(JSON.stringify({
              type: 'error',
              error: 'Invalid message format'
            }))
          }
        })
        
        ws.on('close', () => {
          console.log(`[Signal] Peer disconnected: ${peerId}`)
          
          // Clean up room membership
          if (connection.roomCode) {
            const room = rooms.get(connection.roomCode)
            if (room) {
              if (room.host === peerId) {
                // Host left - notify all guests
                room.guests.forEach(guestId => {
                  const guest = connections.get(guestId)
                  if (guest) {
                    guest.ws.send(JSON.stringify({
                      type: 'peer-left',
                      peerId,
                      isHost: true
                    }))
                  }
                })
                
                // Optionally migrate host to first guest
                if (room.guests.size > 0) {
                  const newHost = Array.from(room.guests)[0]
                  room.host = newHost
                  room.guests.delete(newHost)
                  
                  // Notify new host
                  const newHostConn = connections.get(newHost)
                  if (newHostConn) {
                    newHostConn.ws.send(JSON.stringify({
                      type: 'host-migrated',
                      newHost
                    }))
                  }
                } else {
                  // No guests left, delete room
                  rooms.delete(connection.roomCode)
                }
              } else {
                // Guest left - notify host and other guests
                room.guests.delete(peerId)
                
                // Notify host
                if (room.host) {
                  const host = connections.get(room.host)
                  if (host) {
                    host.ws.send(JSON.stringify({
                      type: 'peer-left',
                      peerId
                    }))
                  }
                }
                
                // Notify other guests
                room.guests.forEach(guestId => {
                  const guest = connections.get(guestId)
                  if (guest) {
                    guest.ws.send(JSON.stringify({
                      type: 'peer-left',
                      peerId
                    }))
                  }
                })
              }
            }
          }
          
          connections.delete(peerId)
        })
        
        ws.on('error', (error) => {
          console.error(`[Signal] WebSocket error for ${peerId}:`, error)
        })
      })
      
      // Start server
      const port = parseInt(options.port)
      const host = options.host
      
      server.listen(port, host, () => {
        console.log(`[Signal] WebRTC signaling server running on ws://${host}:${port}`)
        
        // Also show local network addresses
        if (host === '0.0.0.0') {
          const interfaces = os.networkInterfaces()
          Object.keys(interfaces).forEach(name => {
            interfaces[name]?.forEach((iface: any) => {
              if (iface.family === 'IPv4' && !iface.internal) {
                console.log(`[Signal] Available at ws://${iface.address}:${port}`)
              }
            })
          })
        }
      })
      
      // Clean up old rooms periodically
      setInterval(() => {
        const now = Date.now()
        const timeout = 60 * 60 * 1000 // 1 hour
        
        for (const [code, room] of rooms.entries()) {
          if (now - room.createdAt > timeout && room.guests.size === 0) {
            console.log(`[Signal] Cleaning up inactive room: ${code}`)
            rooms.delete(code)
          }
        }
      }, 60 * 1000) // Check every minute
    })
  
  return command
}

function handleMessage(
  connection: PeerConnection,
  message: any,
  rooms: Map<string, Room>,
  connections: Map<string, PeerConnection>
) {
  console.log(`[Signal] Message from ${connection.peerId}:`, message.type)
  
  switch (message.type) {
    case 'create-room':
      handleCreateRoom(connection, message, rooms, connections)
      break
      
    case 'join-room':
      handleJoinRoom(connection, message, rooms, connections)
      break
      
    case 'leave-room':
      handleLeaveRoom(connection, message, rooms)
      break
      
    case 'offer':
    case 'answer':
    case 'ice-candidate':
      handleSignaling(connection, message, rooms, connections)
      break
      
    default:
      connection.ws.send(JSON.stringify({
        type: 'error',
        error: `Unknown message type: ${message.type}`
      }))
  }
}

function handleCreateRoom(
  connection: PeerConnection,
  message: any,
  rooms: Map<string, Room>,
  connections: Map<string, PeerConnection>
) {
  const roomCode = message.roomCode || generateRoomCode()
  
  // Check if room already exists
  if (rooms.has(roomCode)) {
    connection.ws.send(JSON.stringify({
      type: 'error',
      error: 'Room already exists'
    }))
    return
  }
  
  // Create room
  const room: Room = {
    code: roomCode,
    host: connection.peerId,
    guests: new Set(),
    createdAt: Date.now()
  }
  
  rooms.set(roomCode, room)
  connection.roomCode = roomCode
  
  console.log(`[Signal] Room created: ${roomCode} by ${connection.peerId}`)
  
  connection.ws.send(JSON.stringify({
    type: 'room-created',
    roomCode,
    peerId: connection.peerId
  }))
}

function handleJoinRoom(
  connection: PeerConnection,
  message: any,
  rooms: Map<string, Room>,
  connections: Map<string, PeerConnection>
) {
  const roomCode = message.roomCode
  
  if (!roomCode) {
    connection.ws.send(JSON.stringify({
      type: 'error',
      error: 'Room code required'
    }))
    return
  }
  
  const room = rooms.get(roomCode)
  if (!room) {
    connection.ws.send(JSON.stringify({
      type: 'error',
      error: 'Room not found'
    }))
    return
  }
  
  // Add guest to room
  room.guests.add(connection.peerId)
  connection.roomCode = roomCode
  
  console.log(`[Signal] ${connection.peerId} joined room ${roomCode}`)
  
  // Send room-joined to the guest
  connection.ws.send(JSON.stringify({
    type: 'room-joined',
    roomCode,
    hostId: room.host,
    guests: Array.from(room.guests)
  }))
  
  // Notify host that a guest joined
  if (room.host) {
    const host = connections.get(room.host)
    if (host) {
      host.ws.send(JSON.stringify({
        type: 'peer-joined',
        peerId: connection.peerId,
        roomCode
      }))
    }
  }
  
  // Notify other guests
  room.guests.forEach(guestId => {
    if (guestId !== connection.peerId) {
      const guest = connections.get(guestId)
      if (guest) {
        guest.ws.send(JSON.stringify({
          type: 'peer-joined',
          peerId: connection.peerId,
          roomCode
        }))
      }
    }
  })
  
  // Send peer-joined for host to the new guest
  if (room.host) {
    connection.ws.send(JSON.stringify({
      type: 'peer-joined',
      peerId: room.host,
      roomCode,
      data: { isHost: true }
    }))
  }
  
  // Send peer-joined for each existing guest to the new guest
  room.guests.forEach(guestId => {
    if (guestId !== connection.peerId) {
      connection.ws.send(JSON.stringify({
        type: 'peer-joined',
        peerId: guestId,
        roomCode
      }))
    }
  })
}

function handleLeaveRoom(
  connection: PeerConnection,
  message: any,
  rooms: Map<string, Room>
) {
  if (!connection.roomCode) {
    return
  }
  
  const room = rooms.get(connection.roomCode)
  if (!room) {
    return
  }
  
  // Remove from room
  if (room.host === connection.peerId) {
    room.host = null
  } else {
    room.guests.delete(connection.peerId)
  }
  
  connection.roomCode = undefined
  
  console.log(`[Signal] ${connection.peerId} left room ${room.code}`)
}

function handleSignaling(
  connection: PeerConnection,
  message: any,
  rooms: Map<string, Room>,
  connections: Map<string, PeerConnection>
) {
  if (!connection.roomCode) {
    connection.ws.send(JSON.stringify({
      type: 'error',
      error: 'Not in a room'
    }))
    return
  }
  
  const room = rooms.get(connection.roomCode)
  if (!room) {
    return
  }
  
  // If a specific target is provided, only forward to that peer
  // Otherwise forward to all peers in room
  let targetPeers: string[] = []
  
  if (message.targetPeerId) {
    // Direct message to specific peer
    targetPeers = [message.targetPeerId]
  } else {
    // Broadcast to all other peers in room
    if (room.host && room.host !== connection.peerId) {
      targetPeers.push(room.host)
    }
    
    room.guests.forEach(guestId => {
      if (guestId !== connection.peerId) {
        targetPeers.push(guestId)
      }
    })
  }
  
  console.log(`[Signal] Forwarding ${message.type} from ${connection.peerId} to ${targetPeers.length} peers`)
  
  targetPeers.forEach(targetId => {
    const target = connections.get(targetId)
    if (target) {
      target.ws.send(JSON.stringify({
        ...message,
        peerId: connection.peerId,
        roomCode: connection.roomCode
      }))
    }
  })
}

function generatePeerId(): string {
  return Math.random().toString(36).substring(2, 15)
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}