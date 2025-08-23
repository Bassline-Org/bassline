/**
 * Demo of proper-bassline with multiple networks and imports/exports
 * Shows how to use networks as organizational namespaces
 */

import { useState } from 'react'
import { 
  NetworkProvider, 
  useNetwork, 
  useCell, 
  useGadget,
  useImport,
  useWiring,
  useFunctionOutput
} from '~/proper-bassline-integration'
import { Network } from 'proper-bassline/src/network'
import { OrdinalCell, MaxCell, UnionCell } from 'proper-bassline/src/cells/basic'
import { FunctionGadget } from 'proper-bassline/src/function'
import { num, str, set, array, getMapValue } from 'proper-bassline/src/types'
import type { LatticeValue } from 'proper-bassline/src/types'

// Custom function gadget for formatting
class FormatMessage extends FunctionGadget {
  constructor(id: string) {
    super(id, ['name', 'count'])
  }
  
  fn(args: Record<string, LatticeValue>): LatticeValue {
    const name = getMapValue(args.name)
    const count = getMapValue(args.count)
    
    if (!name || !count) return str('Waiting for input...')
    
    const nameStr = name.type === 'string' ? name.value : String(name.value)
    const countNum = count.type === 'number' ? count.value : 0
    
    return str(`Hello ${nameStr}! You have ${countNum} messages.`)
  }
}

// Component demonstrating auth network
function AuthNetwork() {
  const network = useNetwork()
  
  // Create auth sub-network
  const authNet = useGadget(() => {
    const auth = new Network('auth')
    const username = new OrdinalCell('username')
    const permissions = new UnionCell('permissions')
    
    // Add to auth network
    auth.add(username, permissions)
    
    // Mark as boundaries for external access
    auth.addBoundary(username)
    auth.addBoundary(permissions)
    
    return auth
  }, 'auth')
  
  // Get the cells from auth network
  const username = authNet.getByPath('username') as OrdinalCell
  const permissions = authNet.getByPath('permissions') as UnionCell
  
  const [userValue, setUser] = useCell<string>(username)
  const [permsValue, setPerms] = useCell(permissions)
  
  return (
    <div className="border rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-2">Auth Network</h3>
      <div className="space-y-2">
        <div>
          <label className="block text-sm font-medium">Username:</label>
          <input
            type="text"
            value={userValue || ''}
            onChange={e => setUser(str(e.target.value))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Permissions:</label>
          <div className="flex gap-2 mt-1">
            <button
              onClick={() => {
                const current = permsValue instanceof Set ? permsValue : new Set()
                const newSet = new Set(current)
                newSet.add(str('read'))
                setPerms(set(Array.from(newSet)))
              }}
              className="px-3 py-1 bg-blue-500 text-white rounded"
            >
              Add Read
            </button>
            <button
              onClick={() => {
                const current = permsValue instanceof Set ? permsValue : new Set()
                const newSet = new Set(current)
                newSet.add(str('write'))
                setPerms(set(Array.from(newSet)))
              }}
              className="px-3 py-1 bg-green-500 text-white rounded"
            >
              Add Write
            </button>
            <button
              onClick={() => {
                const current = permsValue instanceof Set ? permsValue : new Set()
                const newSet = new Set(current)
                newSet.add(str('admin'))
                setPerms(set(Array.from(newSet)))
              }}
              className="px-3 py-1 bg-red-500 text-white rounded"
            >
              Add Admin
            </button>
          </div>
          <div className="mt-2 text-sm text-gray-600">
            Current: {permsValue instanceof Set ? 
              JSON.stringify(Array.from(permsValue).map((v: any) => v.value)) : 
              'none'}
          </div>
        </div>
      </div>
    </div>
  )
}

// Component demonstrating messaging network with imports
function MessagingNetwork() {
  const network = useNetwork()
  
  // Import username from auth network
  const authNet = network.getByPath('auth') as Network
  const authUsername = authNet?.getByPath('username') as OrdinalCell
  
  // Create messaging sub-network
  const msgNet = useGadget(() => {
    const messaging = new Network('messaging')
    const messageCount = new MaxCell('messageCount')
    const formatter = new FormatMessage('formatter')
    
    messaging.add(messageCount, formatter)
    
    return messaging
  }, 'messaging')
  
  // Get messaging components
  const messageCount = msgNet.getByPath('messageCount') as MaxCell
  const formatter = msgNet.getByPath('formatter') as FormatMessage
  
  // Import username into messaging context
  const localUsername = useImport('msg-username', authUsername || new OrdinalCell('fallback'))
  
  // Wire up the formatter
  useWiring([
    { from: localUsername, to: formatter, toInput: 'name' },
    { from: messageCount, to: formatter, toInput: 'count' }
  ])
  
  const [count, setCount] = useCell<number>(messageCount)
  const message = useFunctionOutput<string>(formatter)
  
  return (
    <div className="border rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-2">Messaging Network</h3>
      <div className="space-y-2">
        <div>
          <label className="block text-sm font-medium">Message Count:</label>
          <input
            type="number"
            value={count || 0}
            onChange={e => setCount(num(parseInt(e.target.value) || 0))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          />
        </div>
        <div className="p-3 bg-gray-100 rounded">
          <div className="text-sm font-medium">Formatted Message:</div>
          <div className="text-lg">{message || 'Waiting...'}</div>
        </div>
      </div>
    </div>
  )
}

// Component demonstrating analytics network
function AnalyticsNetwork() {
  const network = useNetwork()
  
  // Import from both auth and messaging
  const authNet = network.getByPath('auth') as Network
  const msgNet = network.getByPath('messaging') as Network
  
  const authUsername = authNet?.getByPath('username') as OrdinalCell
  const messageCount = msgNet?.getByPath('messageCount') as MaxCell
  
  // Create analytics network
  const analyticsNet = useGadget(() => {
    const analytics = new Network('analytics')
    
    // Create a function to compute stats
    class ComputeStats extends FunctionGadget {
      constructor() {
        super('stats', ['user', 'messages'])
      }
      
      fn(args: Record<string, LatticeValue>): LatticeValue {
        const user = getMapValue(args.user)
        const messages = getMapValue(args.messages)
        
        const userStr = user?.type === 'string' ? user.value : 'anonymous'
        const msgCount = messages?.type === 'number' ? messages.value : 0
        
        return str(`User "${userStr}" has ${msgCount} messages (${msgCount > 10 ? 'active' : 'normal'} user)`)
      }
    }
    
    const stats = new ComputeStats()
    analytics.add(stats)
    
    return analytics
  }, 'analytics')
  
  const stats = analyticsNet.getByPath('stats') as FunctionGadget
  
  // Import data from other networks
  const importedUser = useImport('analytics-user', authUsername || new OrdinalCell('fallback'))
  const importedCount = useImport('analytics-count', messageCount || new MaxCell('fallback'))
  
  // Wire imports to stats function
  useWiring([
    { from: importedUser, to: stats, toInput: 'user' },
    { from: importedCount, to: stats, toInput: 'messages' }
  ])
  
  const statsOutput = useFunctionOutput<string>(stats)
  
  return (
    <div className="border rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-2">Analytics Network</h3>
      <div className="p-3 bg-blue-50 rounded">
        <div className="text-sm font-medium">Statistics:</div>
        <div className="text-lg">{statsOutput || 'Computing...'}</div>
      </div>
    </div>
  )
}

export default function ProperDemo() {
  const [mainNetwork] = useState(() => new Network('main'))
  
  return (
    <NetworkProvider network={mainNetwork}>
      <div className="container mx-auto p-8">
        <h1 className="text-3xl font-bold mb-8">Proper Bassline: Network Organization Demo</h1>
        
        <div className="mb-6 p-4 bg-yellow-50 rounded-lg">
          <h2 className="font-semibold mb-2">Concepts Demonstrated:</h2>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Networks as organizational namespaces (auth, messaging, analytics)</li>
            <li>Imports creating local aliases to external gadgets</li>
            <li>React integration using gadgets as state management</li>
            <li>Bidirectional constraint propagation</li>
            <li>Function gadgets for computed values</li>
          </ul>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AuthNetwork />
          <MessagingNetwork />
          <div className="md:col-span-2">
            <AnalyticsNetwork />
          </div>
        </div>
        
        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold mb-2">Try it out:</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Enter a username in the Auth Network</li>
            <li>Add some permissions using the buttons</li>
            <li>Change the message count in the Messaging Network</li>
            <li>Watch how the formatted message and analytics update automatically</li>
            <li>Notice how changes propagate across network boundaries via imports</li>
          </ol>
        </div>
      </div>
    </NetworkProvider>
  )
}