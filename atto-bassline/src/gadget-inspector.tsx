/**
 * Gadget Inspector Component
 * Debug tool to inspect gadget state, contacts, and contradictions
 */

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Gadget } from './types'

interface GadgetInspectorProps {
  gadget: Gadget
  title?: string
}

/**
 * Inspector component that shows detailed gadget state
 */
export function GadgetInspector({ gadget, title }: GadgetInspectorProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Get all contacts with their current state
  const contacts = Array.from(gadget.contacts.entries()).map(([name, contact]) => ({
    name,
    direction: contact.direction,
    value: contact.signal.value,
    strength: contact.signal.strength,
    sources: contact.sources.size,
    targets: contact.targets.size,
    isContradiction: typeof contact.signal.value === 'object' && contact.signal.value?.tag === 'contradiction'
  }))
  
  // Count contradictions
  const contradictionCount = contacts.filter(c => c.isContradiction).length
  
  // Format value for display
  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'null'
    if (typeof value === 'object' && value.tag === 'contradiction') {
      // Just show the contradiction as-is, don't try to parse it
      return `⚠️ CONTRADICTION: ${JSON.stringify(value)}`
    }
    if (typeof value === 'object') {
      return JSON.stringify(value)
    }
    return String(value)
  }
  
  // Get strength color
  const getStrengthColor = (strength: number): string => {
    if (strength >= 0.8) return '#4CAF50' // Strong - green
    if (strength >= 0.5) return '#FF9800' // Medium - orange  
    if (strength >= 0.2) return '#FFC107' // Weak - yellow
    return '#9E9E9E' // Very weak - gray
  }
  
  return (
    <div style={{
      border: '1px solid #ddd',
      borderRadius: '8px',
      background: '#fff',
      overflow: 'hidden',
      fontFamily: 'monospace',
      fontSize: '12px'
    }}>
      {/* Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          padding: '8px 12px',
          background: contradictionCount > 0 ? '#ffebee' : '#f5f5f5',
          borderBottom: '1px solid #ddd',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div>
          <strong>{title || gadget.id}</strong>
          {contradictionCount > 0 && (
            <span style={{
              marginLeft: '8px',
              padding: '2px 6px',
              background: '#f44336',
              color: 'white',
              borderRadius: '4px',
              fontSize: '10px'
            }}>
              {contradictionCount} CONFLICT{contradictionCount > 1 ? 'S' : ''}
            </span>
          )}
        </div>
        <div style={{ fontSize: '10px', color: '#666' }}>
          {contacts.length} contact{contacts.length !== 1 ? 's' : ''} • {isExpanded ? '▼' : '▶'}
        </div>
      </div>
      
      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '12px' }}>
              {/* Gadget Info */}
              <div style={{ marginBottom: '12px', padding: '8px', background: '#f9f9f9', borderRadius: '4px' }}>
                <div><strong>ID:</strong> {gadget.id}</div>
                <div><strong>Type:</strong> {gadget.primitive ? 'Primitive' : 'Composite'}</div>
                <div><strong>Gain Pool:</strong> {gadget.gainPool.toFixed(3)}</div>
                <div><strong>Child Gadgets:</strong> {gadget.gadgets.size}</div>
              </div>
              
              {/* Contacts List */}
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '13px' }}>Contacts:</h4>
                {contacts.length === 0 ? (
                  <div style={{ color: '#999', fontStyle: 'italic' }}>No contacts</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {contacts.map(contact => (
                      <div
                        key={contact.name}
                        style={{
                          padding: '8px',
                          border: '1px solid #eee',
                          borderRadius: '4px',
                          background: contact.isContradiction ? '#ffebee' : '#fafafa'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{
                              display: 'inline-block',
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: contact.direction === 'input' ? '#4CAF50' : '#FF9800'
                            }} />
                            <strong>{contact.name}</strong>
                            <span style={{
                              fontSize: '10px',
                              color: '#666',
                              padding: '1px 4px',
                              background: '#e0e0e0',
                              borderRadius: '2px'
                            }}>
                              {contact.direction}
                            </span>
                            {contact.isContradiction && (
                              <span style={{
                                fontSize: '10px',
                                color: '#f44336',
                                fontWeight: 'bold'
                              }}>
                                ⚠️ CONFLICT
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              fontSize: '10px',
                              color: getStrengthColor(contact.strength),
                              fontWeight: 'bold'
                            }}>
                              {contact.strength.toFixed(3)}
                            </span>
                            <span style={{ fontSize: '10px', color: '#666' }}>
                              {contact.sources}→{contact.targets}
                            </span>
                          </div>
                        </div>
                        <div style={{
                          padding: '4px',
                          background: '#fff',
                          borderRadius: '2px',
                          border: '1px solid #eee',
                          wordBreak: 'break-all',
                          maxHeight: '60px',
                          overflowY: 'auto'
                        }}>
                          {formatValue(contact.value)}
                        </div>
                        {contact.isContradiction && (
                          <div style={{ 
                            marginTop: '4px', 
                            fontSize: '10px', 
                            color: '#f44336',
                            background: '#ffebee',
                            padding: '4px',
                            borderRadius: '2px'
                          }}>
                            <strong>Debug:</strong> {contact.sources} sources writing to this contact!<br/>
                            Contact ID: {gadget.id}.{contact.name}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * Quick inspector button that can be attached to any gadget
 */
export function InspectorButton({ gadget, title }: GadgetInspectorProps) {
  const [showInspector, setShowInspector] = useState(false)
  
  // Check for contradictions
  const hasContradictions = Array.from(gadget.contacts.values()).some(
    contact => typeof contact.signal.value === 'object' && contact.signal.value?.tag === 'contradiction'
  )
  
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setShowInspector(!showInspector)}
        style={{
          padding: '4px 8px',
          fontSize: '11px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          background: hasContradictions ? '#ffebee' : '#f5f5f5',
          color: hasContradictions ? '#f44336' : '#666',
          cursor: 'pointer',
          fontFamily: 'monospace'
        }}
        title={`Inspect ${title || gadget.id}`}
      >
        🔍 {hasContradictions ? '⚠️' : '✓'}
      </button>
      
      <AnimatePresence>
        {showInspector && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              zIndex: 1000,
              marginTop: '4px',
              minWidth: '350px',
              maxWidth: '500px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
            }}
          >
            <GadgetInspector gadget={gadget} title={title} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}