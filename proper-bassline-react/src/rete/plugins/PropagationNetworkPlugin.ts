/**
 * PropagationNetworkPlugin - Core plugin that syncs Rete.js with propagation networks
 * 
 * This plugin acts as a bridge between Rete's visual editor and the propagation network,
 * maintaining bidirectional sync between Rete nodes and network gadgets.
 */

import { Scope, ClassicPreset } from 'rete'
import type { NodeEditor } from 'rete'
import type { AreaPlugin } from 'rete-area-plugin'
import type { BasslineEngine, PropagationEvent } from 'proper-bassline/src/engine'
import type { Gadget } from 'proper-bassline/src/gadget'
import type { GadgetBase } from 'proper-bassline/src/gadget-base'
import { Cell } from 'proper-bassline/src/cell'
import { FunctionGadget } from 'proper-bassline/src/function'
import { CellNode, FunctionNode, type BasslineSchemes } from '../nodes'

export type PropagationSignal =
  | { type: 'gadgetAdded', gadget: Gadget }
  | { type: 'gadgetRemoved', gadgetId: string }
  | { type: 'connectionAdded', from: string, to: string, toInput?: string }
  | { type: 'connectionRemoved', from: string, to: string, toInput?: string }
  | { type: 'valueChanged', gadgetId: string, value: any }

export class PropagationNetworkPlugin<Schemes extends BasslineSchemes> extends Scope<PropagationSignal, []> {
  private engine: BasslineEngine
  private editor: NodeEditor<Schemes>
  private area: AreaPlugin<Schemes, any> | null = null
  
  // Bidirectional mappings
  private gadgetToNode = new Map<string, string>() // gadget.id -> node.id
  private nodeToGadget = new Map<string, string>() // node.id -> gadget.id
  
  // Subscription cleanup function
  private unsubscribe: (() => void) | null = null
  
  // Synchronization flags
  private hasSynced = false
  private isSyncing = false // Prevent re-entrant sync operations
  private isInternalUpdate = false // Distinguish programmatic updates
  private existingConnections = new Set<string>() // Track existing connections
  
  constructor(
    engine: BasslineEngine,
    editor: NodeEditor<Schemes>
  ) {
    super('propagation-network')
    this.engine = engine
    this.editor = editor
    
    this.setupEditorListeners()
    this.subscribeToEngine()
  }
  
  /**
   * Set the area plugin for positioning nodes
   */
  setArea(area: AreaPlugin<Schemes, any>) {
    this.area = area
    
    // Only sync once
    if (!this.hasSynced) {
      this.hasSynced = true
      // Now that we have the area plugin, sync existing gadgets
      this.syncExistingGadgets()
    }
  }
  
  /**
   * Create Rete nodes for existing gadgets in the engine
   */
  private async syncExistingGadgets() {
    if (this.isSyncing) {
      console.log('[PropagationPlugin] Already syncing, skipping')
      return
    }
    
    console.log('[PropagationPlugin] Syncing existing gadgets from engine')
    this.isSyncing = true
    
    // Wait a bit to ensure editor is ready
    setTimeout(async () => {
      try {
      let yPosition = 100
      
      for (const gadget of this.engine.gadgets) {
        // Skip if already has a node
        if (this.gadgetToNode.has(gadget.id)) continue
        
        console.log('[PropagationPlugin] Creating node for existing gadget:', gadget.id)
        
        let node: Schemes['Node'] | null = null
        
        if (gadget instanceof Cell) {
          node = new CellNode(gadget)
        } else if (gadget instanceof FunctionGadget) {
          node = new FunctionNode(gadget)
        }
        
        if (node) {
          await this.editor.addNode(node)
          
          // Position the node
          if (this.area) {
            await this.area.translate(node.id, {
              x: 100 + Math.random() * 500,
              y: yPosition
            })
            yPosition += 100
          }
        }
      }
      
      // Now sync connections
      for (const gadget of this.engine.gadgets) {
        const sourceNodeId = this.gadgetToNode.get(gadget.id)
        if (!sourceNodeId) continue
        
        // Check downstream connections
        for (const conn of gadget.downstream) {
          const target = conn.gadget.deref()
          if (target) {
            const targetNodeId = this.gadgetToNode.get(target.id)
            if (targetNodeId) {
              const sourceNode = this.editor.getNode(sourceNodeId)
              const targetNode = this.editor.getNode(targetNodeId)
              
              if (sourceNode && targetNode) {
                // Check if connection already exists
                const connectionKey = `${sourceNodeId}->${targetNodeId}:${conn.inputName || 'input'}`
                if (!this.existingConnections.has(connectionKey)) {
                  this.existingConnections.add(connectionKey)
                  
                  // Create Rete connection - all nodes use 'output' socket
                  this.isInternalUpdate = true
                  const connection = new ClassicPreset.Connection(
                    sourceNode,
                    'output',
                    targetNode,
                    conn.inputName || 'input'
                  ) as any
                  await this.editor.addConnection(connection)
                  this.isInternalUpdate = false
                }
              }
            }
          }
        }
      }
      } finally {
        this.isSyncing = false
      }
    }, 100)
  }
  
  /**
   * Subscribe to engine events
   */
  private subscribeToEngine() {
    console.log('[PropagationPlugin] Subscribing to engine events')
    
    this.unsubscribe = this.engine.subscribe((event: PropagationEvent) => {
      // Handle events from the propagation engine
      switch (event.type) {
        case 'valueChanged':
          this.handleValueChanged(event)
          break
        case 'gadgetAdded':
          console.log('[PropagationPlugin] Gadget added to engine:', event.gadget.id)
          break
        case 'gadgetRemoved':
          console.log('[PropagationPlugin] Gadget removed from engine:', event.gadgetId)
          break
        case 'connect':
          console.log('[PropagationPlugin] Connection in engine:', event.fromId, '->', event.toId)
          break
        case 'disconnect':
          console.log('[PropagationPlugin] Disconnection in engine:', event.fromId, '->', event.toId)
          break
      }
    })
  }
  
  /**
   * Handle value changed events from the engine
   */
  private handleValueChanged(event: { gadgetId: string; outputName: string; value: any }) {
    console.log('[PropagationPlugin] Value changed:', event.gadgetId, event.value)
    
    const nodeId = this.gadgetToNode.get(event.gadgetId)
    if (nodeId) {
      this.emit({ type: 'valueChanged', gadgetId: event.gadgetId, value: event.value })
      // Update the node in Rete
      this.updateNodeValue(nodeId)
      
      // Also update controls if they exist
      const node = this.editor.getNode(nodeId)
      if (node && this.area) {
        const controls = node.controls
        if (controls) {
          for (const [, control] of Object.entries(controls)) {
            // Trigger control update by updating the area
            if (control && 'id' in control) {
              this.area.update('control', control.id)
            }
          }
        }
      }
    }
  }
  
  /**
   * Update node's value display
   */
  private async updateNodeValue(nodeId: string) {
    const node = this.editor.getNode(nodeId)
    if (node && this.area) {
      // Update the node's current value
      const gadgetId = this.nodeToGadget.get(nodeId)
      if (gadgetId) {
        const gadget = this.findGadget(gadgetId)
        if (gadget && 'currentValue' in node) {
          (node as any).currentValue = gadget.getOutput()
        }
      }
      // Trigger Rete to re-render the node and its controls
      await this.area.update('node', nodeId)
    }
  }
  
  /**
   * Find a gadget in the engine by ID
   */
  private findGadget(gadgetId: string): Gadget | null {
    // First try direct lookup in engine's gadgets
    for (const gadget of this.engine.gadgets) {
      if (gadget.id === gadgetId) {
        return gadget
      }
    }
    
    // Try using getByPath if it exists
    const gadget = this.engine.getByPath(gadgetId)
    return gadget
  }
  
  
  /**
   * Listen to Rete editor events
   */
  private setupEditorListeners() {
    this.editor.addPipe((context) => {
      if (context.type === 'nodecreate') {
        const node = context.data
        const gadgetId = (node as any).gadgetId
        if (gadgetId) {
          console.log('[PropagationPlugin] Node created for gadget:', gadgetId)
          this.gadgetToNode.set(gadgetId, node.id)
          this.nodeToGadget.set(node.id, gadgetId)
          
          // Get initial value and update node
          const gadget = this.findGadget(gadgetId)
          if (gadget) {
            const value = gadget.getOutput()
            if (value && 'currentValue' in node) {
              (node as any).currentValue = value
            }
          } else {
            console.warn('[PropagationPlugin] Gadget not found in engine:', gadgetId)
          }
        }
      }
      
      if (context.type === 'noderemove') {
        const node = context.data
        const gadgetId = this.nodeToGadget.get(node.id)
        if (gadgetId) {
          console.log('[PropagationPlugin] Node removed for gadget:', gadgetId)
          
          this.gadgetToNode.delete(gadgetId)
          this.nodeToGadget.delete(node.id)
          
          // Remove from engine
          const gadget = this.findGadget(gadgetId)
          if (gadget && this.engine.gadgets.has(gadget)) {
            this.engine.remove(gadget)
          }
        }
      }
      
      if (context.type === 'connectioncreate') {
        // Skip if this is an internal update (programmatic)
        if (this.isInternalUpdate) {
          return context
        }
        
        const connection = context.data
        const sourceNode = this.editor.getNode(connection.source)
        const targetNode = this.editor.getNode(connection.target)
        
        if (sourceNode && targetNode) {
          const sourceGadgetId = (sourceNode as any).gadgetId
          const targetGadgetId = (targetNode as any).gadgetId
          
          console.log('[PropagationPlugin] User created connection:', sourceGadgetId, '->', targetGadgetId)
          
          if (sourceGadgetId && targetGadgetId) {
            const sourceGadget = this.findGadget(sourceGadgetId)
            const targetGadget = this.findGadget(targetGadgetId)
            
            if (sourceGadget && targetGadget) {
              // Check if already connected to prevent double-wiring
              let alreadyConnected = false
              
              if (targetGadget instanceof FunctionGadget) {
                const inputKey = connection.targetInput || 'input'
                const existing = targetGadget.inputs.get(inputKey)
                if (existing) {
                  const existingSource = existing.source.deref()
                  if (existingSource === sourceGadget) {
                    console.log('[PropagationPlugin] Already connected, skipping')
                    alreadyConnected = true
                  }
                }
              }
              
              if (!alreadyConnected) {
                // Track this connection to prevent duplicates
                const connectionKey = `${sourceGadgetId}->${targetGadgetId}:${connection.targetInput || 'input'}`
                
                // Check if we've already processed this connection
                if (this.existingConnections.has(connectionKey)) {
                  console.log('[PropagationPlugin] Connection already exists in our tracking, skipping')
                  return context
                }
                
                this.existingConnections.add(connectionKey)
                
                // Wire gadgets based on type
                if (targetGadget instanceof Cell) {
                  console.log('[PropagationPlugin] Connecting Cell', targetGadgetId, 'from', sourceGadgetId)
                  targetGadget.connectFrom(sourceGadget, connection.sourceOutput || 'default')
                } else if (targetGadget instanceof FunctionGadget) {
                  const inputKey = connection.targetInput || 'input'
                  console.log('[PropagationPlugin] Connecting Function', targetGadgetId, 'input', inputKey, 'from', sourceGadgetId)
                  targetGadget.connectFrom(inputKey, sourceGadget, connection.sourceOutput || 'default')
                }
                
                // Don't manually trigger computation - let the propagation network handle it
                // The network will automatically propagate values when connections are made
                
                this.emit({ 
                  type: 'connectionAdded', 
                  from: sourceGadgetId, 
                  to: targetGadgetId,
                  toInput: connection.targetInput
                })
              }
            } else {
              console.warn('[PropagationPlugin] Gadgets not found:', sourceGadgetId, targetGadgetId)
            }
          }
        }
      }
      
      if (context.type === 'connectionremove') {
        // Skip if this is an internal update
        if (this.isInternalUpdate) {
          return context
        }
        
        const connection = context.data
        const sourceNode = this.editor.getNode(connection.source)
        const targetNode = this.editor.getNode(connection.target)
        
        if (sourceNode && targetNode) {
          const sourceGadgetId = (sourceNode as any).gadgetId
          const targetGadgetId = (targetNode as any).gadgetId
          
          // Remove from our tracking
          const connectionKey = `${sourceGadgetId}->${targetGadgetId}:${connection.targetInput || 'input'}`
          this.existingConnections.delete(connectionKey)
          
          if (sourceGadgetId && targetGadgetId) {
            const sourceGadget = this.findGadget(sourceGadgetId)
            const targetGadget = this.findGadget(targetGadgetId)
            
            if (sourceGadget && targetGadget) {
              if (targetGadget instanceof Cell) {
                targetGadget.disconnectFrom(sourceGadget, connection.sourceOutput || 'default')
              } else if (targetGadget instanceof FunctionGadget && connection.targetInput) {
                targetGadget.disconnectInput(connection.targetInput)
              }
            }
            
            this.emit({ 
              type: 'connectionRemoved', 
              from: sourceGadgetId, 
              to: targetGadgetId,
              toInput: connection.targetInput
            })
          }
        }
      }
      
      return context
    })
  }
  
  /**
   * Get Rete node for a gadget
   */
  getNodeForGadget(gadgetId: string): Schemes['Node'] | undefined {
    const nodeId = this.gadgetToNode.get(gadgetId)
    if (nodeId) {
      return this.editor.getNode(nodeId)
    }
    return undefined
  }
  
  /**
   * Get gadget for a Rete node
   */
  getGadgetForNode(nodeId: string): Gadget | undefined {
    const gadgetId = this.nodeToGadget.get(nodeId)
    if (gadgetId) {
      return this.findGadget(gadgetId) || undefined
    }
    return undefined
  }
  
  /**
   * Add a gadget and create its node
   */
  async addGadgetWithNode(gadget: Gadget, node: any) {
    // Add gadget to engine if not already present
    if (!this.engine.gadgets.has(gadget)) {
      this.engine.add(gadget)
    }
    
    // Map gadget to node (already done in nodecreate event)
    // Don't duplicate - just check if already mapped
    if (!this.gadgetToNode.has(gadget.id)) {
      this.gadgetToNode.set(gadget.id, node.id)
      this.nodeToGadget.set(node.id, gadget.id)
    }
  }
  
  /**
   * Cleanup
   */
  destroy() {
    console.log('[PropagationPlugin] Destroying plugin, cleaning up subscriptions')
    // Cleanup engine subscription
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = null
    }
    this.gadgetToNode.clear()
    this.nodeToGadget.clear()
  }
}