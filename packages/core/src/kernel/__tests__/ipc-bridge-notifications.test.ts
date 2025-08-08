/**
 * Fun macOS notification tests using IPCBridgeDriver
 * Shows how Bassline can trigger system notifications through IPC
 * Uses real kernel and propagation network to demonstrate full integration
 */

import { describe, it, beforeEach, afterEach } from 'vitest'
import { IPCBridgeDriver } from '../bridges/ipc-bridge-driver'
import { Kernel } from '../kernel'
import { UserspaceRuntime } from '../userspace-runtime'
import { MemoryStorageDriver } from '../drivers/memory-storage-driver'
import { brand } from '../../types'

describe('IPCBridgeDriver - macOS Notifications with Kernel', () => {
  let kernel: Kernel
  let runtime: UserspaceRuntime
  let storage: MemoryStorageDriver
  let bridge: IPCBridgeDriver
  
  beforeEach(async () => {
    // Set up kernel and runtime
    kernel = new Kernel()
    storage = new MemoryStorageDriver()
    
    await storage.initialize()
    kernel.registerDriver(storage)
    
    runtime = new UserspaceRuntime({ kernel })
    kernel.setUserspaceHandler(runtime.receiveExternalInput.bind(runtime))
  })
  
  afterEach(async () => {
    if (bridge) {
      try {
        await bridge.stopListening()
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    if (kernel) {
      await kernel.shutdown()
    }
  })
  
  describe('Kernel-Driven Notifications', () => {
    it('should notify on every contact update through kernel', async () => {
      // Create a notification bridge that formats messages nicely
      const notificationScript = `
        while IFS= read -r line; do
          # Parse JSON to extract contact and value
          contactId=$(echo "$line" | sed -n 's/.*"contactId"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\\1/p')
          value=$(echo "$line" | sed -n 's/.*"value"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\\1/p')
          if [ -z "$value" ]; then
            value=$(echo "$line" | sed -n 's/.*"value"[[:space:]]*:[[:space:]]*\\([^,}]*\\).*/\\1/p')
          fi
          osascript -e "display notification \\"Contact '$contactId' = $value\\" with title \\"Bassline Update\\" sound name \\"Glass\\""
        done
      `
      
      bridge = new IPCBridgeDriver({
        command: 'sh',
        args: ['-c', notificationScript],
        protocol: 'json'
      })
      
      // Register the bridge with the kernel
      kernel.registerDriver(bridge)
      await bridge.startListening()
      
      // Create a group and contact
      const groupId = brand.groupId('demo-group')
      const contactId = brand.contactId('demo-contact')
      
      await runtime.registerGroup({
        id: groupId,
        name: 'Demo Group',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      await runtime.addContact(groupId, {
        id: contactId,
        content: 42,
        blendMode: 'accept-last'
      })
      
      // Wait for initial notification
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Update the contact - should trigger notification
      await runtime.scheduleUpdate(contactId, 100)
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Another update
      await runtime.scheduleUpdate(contactId, 'Final Value')
      await new Promise(resolve => setTimeout(resolve, 1000))
    }, 10000)
    
    it('should show propagation chain with multiple contacts', async () => {
      // Notification script that shows propagation flow
      const notificationScript = `
        while IFS= read -r line; do
          contactId=$(echo "$line" | sed -n 's/.*"contactId"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\\1/p')
          value=$(echo "$line" | sed -n 's/.*"value"[[:space:]]*:[[:space:]]*\\([^,}]*\\).*/\\1/p')
          
          # Determine icon based on contact name
          icon="📊"
          if echo "$contactId" | grep -q "input"; then icon="📥"; fi
          if echo "$contactId" | grep -q "output"; then icon="📤"; fi
          if echo "$contactId" | grep -q "multiply"; then icon="✖️"; fi
          if echo "$contactId" | grep -q "add"; then icon="➕"; fi
          
          osascript -e "display notification \\"Value: $value\\" with title \\"$icon $contactId\\""
        done
      `
      
      bridge = new IPCBridgeDriver({
        command: 'sh',
        args: ['-c', notificationScript],
        protocol: 'json'
      })
      
      kernel.registerDriver(bridge)
      await bridge.startListening()
      
      const groupId = brand.groupId('calc-group')
      
      await runtime.registerGroup({
        id: groupId,
        name: 'Calculator Group',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Create a calculation chain
      const inputId = brand.contactId('input')
      const multiplyId = brand.contactId('multiply-by-2')
      const addId = brand.contactId('add-5')
      const outputId = brand.contactId('output')
      
      // Add contacts
      await runtime.addContact(groupId, {
        id: inputId,
        content: 10,
        blendMode: 'accept-last'
      })
      
      await runtime.addContact(groupId, {
        id: multiplyId,
        content: 20,  // 10 * 2
        blendMode: 'accept-last'
      })
      
      await runtime.addContact(groupId, {
        id: addId,
        content: 25,  // 20 + 5
        blendMode: 'accept-last'
      })
      
      await runtime.addContact(groupId, {
        id: outputId,
        content: 25,
        blendMode: 'accept-last'
      })
      
      // Wait for initial notifications
      // Note: Wire connections would go here once implemented in UserspaceRuntime
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Now update the input - should cascade through the chain
      await runtime.scheduleUpdate(inputId, 20)
      await new Promise(resolve => setTimeout(resolve, 500))
      
      await runtime.scheduleUpdate(multiplyId, 40)  // 20 * 2
      await new Promise(resolve => setTimeout(resolve, 500))
      
      await runtime.scheduleUpdate(addId, 45)  // 40 + 5
      await new Promise(resolve => setTimeout(resolve, 500))
      
      await runtime.scheduleUpdate(outputId, 45)
      await new Promise(resolve => setTimeout(resolve, 500))
    }, 15000)
  })
  
  describe('Real-Time Monitoring', () => {
    it('should create a live contact value monitor', async () => {
      // Create a monitor that shows value changes in real-time
      const monitorScript = `
        while IFS= read -r line; do
          contactId=$(echo "$line" | sed -n 's/.*"contactId"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\\1/p')
          value=$(echo "$line" | sed -n 's/.*"value"[[:space:]]*:[[:space:]]*\\([^,}]*\\).*/\\1/p')
          timestamp=$(date +"%H:%M:%S")
          
          # Create a formatted notification
          osascript -e "display notification \\"[$timestamp] $contactId = $value\\" with title \\"🔴 Live Monitor\\" sound name \\"Morse\\""
        done
      `
      
      bridge = new IPCBridgeDriver({
        command: 'sh',
        args: ['-c', monitorScript],
        protocol: 'json'
      })
      
      kernel.registerDriver(bridge)
      await bridge.startListening()
      
      const groupId = brand.groupId('monitor-group')
      
      await runtime.registerGroup({
        id: groupId,
        name: 'Monitor Group',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      // Create temperature sensor simulation
      const tempId = brand.contactId('temperature')
      const humidityId = brand.contactId('humidity')
      const alertId = brand.contactId('alert-status')
      
      await runtime.addContact(groupId, {
        id: tempId,
        content: 20,
        blendMode: 'accept-last'
      })
      
      await runtime.addContact(groupId, {
        id: humidityId,
        content: 45,
        blendMode: 'accept-last'
      })
      
      await runtime.addContact(groupId, {
        id: alertId,
        content: 'normal',
        blendMode: 'accept-last'
      })
      
      // Simulate sensor readings
      const readings = [
        { temp: 21, humidity: 46, status: 'normal' },
        { temp: 24, humidity: 50, status: 'normal' },
        { temp: 28, humidity: 60, status: 'warning' },
        { temp: 32, humidity: 70, status: 'critical' },
        { temp: 25, humidity: 55, status: 'normal' }
      ]
      
      for (const reading of readings) {
        await runtime.scheduleUpdate(tempId, reading.temp)
        await new Promise(resolve => setTimeout(resolve, 300))
        
        await runtime.scheduleUpdate(humidityId, reading.humidity)
        await new Promise(resolve => setTimeout(resolve, 300))
        
        await runtime.scheduleUpdate(alertId, reading.status)
        await new Promise(resolve => setTimeout(resolve, 700))
      }
    }, 15000)
    
    it('should create a countdown timer through kernel updates', async () => {
      // Create a countdown script that shows formatted countdown
      const countdownScript = `
        while IFS= read -r line; do
          value=$(echo "$line" | sed -n 's/.*"value"[[:space:]]*:[[:space:]]*\\([^,}]*\\).*/\\1/p')
          
          if [ "$value" = "0" ]; then
            osascript -e "display notification \\"🚀 Blast off!\\" with title \\"Countdown Complete\\" sound name \\"Blow\\""
          else
            osascript -e "display notification \\"T-minus $value seconds\\" with title \\"⏰ Countdown\\" sound name \\"Pop\\""
          fi
        done
      `
      
      bridge = new IPCBridgeDriver({
        command: 'sh',
        args: ['-c', countdownScript],
        protocol: 'json'
      })
      
      kernel.registerDriver(bridge)
      await bridge.startListening()
      
      const groupId = brand.groupId('countdown-group')
      const counterId = brand.contactId('counter')
      
      await runtime.registerGroup({
        id: groupId,
        name: 'Countdown Group',
        contactIds: [],
        wireIds: [],
        subgroupIds: [],
        boundaryContactIds: []
      })
      
      await runtime.addContact(groupId, {
        id: counterId,
        content: 5,
        blendMode: 'accept-last'
      })
      
      // Countdown from 5 to 0
      for (let i = 5; i >= 0; i--) {
        await runtime.scheduleUpdate(counterId, i)
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }, 10000)
  })
  
})