/**
 * Connectable wrapper component
 * Makes any gadget-powered component connectable in the dynamic wiring system
 */

import React, { useState, useRef, useEffect, type ReactNode, type MouseEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRegisterGadget, type ConnectionManagerAPI } from './use-connection-manager'
import type { Gadget } from './types'

interface ConnectableProps {
  gadget: Gadget
  children: ReactNode
  className?: string
  manager: ConnectionManagerAPI
}

/**
 * Wrapper component that makes a gadget connectable
 */
export function Connectable({ gadget, children, className = '', manager }: ConnectableProps) {
  const [showContactMenu, setShowContactMenu] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Register this gadget with the global registry
  useRegisterGadget(gadget)
  
  // Check if this gadget is the pending source
  const isPendingSource = manager.pendingConnection?.gadgetId === gadget.id
  
  // Check if this gadget has any active connections
  const hasConnections = manager.activeConnections.some(
    conn => conn.from.gadgetId === gadget.id || conn.to.gadgetId === gadget.id
  )
  
  // Get list of contacts for this gadget
  const contacts = Array.from(gadget.contacts.entries()).map(([name, contact]) => ({
    name,
    direction: contact.direction,
    value: contact.signal.value,
    strength: contact.signal.strength
  }))
  
  // For UI components, most contacts are bidirectional
  // Show all contacts but explain their role in the current context
  const filteredContacts = contacts
  
  // Handle right-click to show contact menu
  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    // If we're in connection mode and selecting target, complete the connection
    if (manager.connectionStatus === 'selecting-target' && !isPendingSource) {
      // Show contact selection menu for target
      setMenuPosition({ x: e.clientX, y: e.clientY })
      setShowContactMenu(true)
    } else if (!manager.connectionMode || manager.connectionStatus === 'idle') {
      // Start a new connection - show source contact menu
      setMenuPosition({ x: e.clientX, y: e.clientY })
      setShowContactMenu(true)
    }
  }
  
  // Handle contact selection from menu
  const handleContactSelect = (contactName: string) => {
    if (manager.connectionStatus === 'selecting-target' && !isPendingSource) {
      // Complete the connection
      manager.completeConnection(gadget, contactName)
    } else {
      // Start a new connection
      manager.startConnection(gadget, contactName)
    }
    setShowContactMenu(false)
  }
  
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: any) => {
      if (showContactMenu && !containerRef.current?.contains(e.target)) {
        setShowContactMenu(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showContactMenu])
  
  // Handle ESC key to cancel connection
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (manager.connectionMode) {
          manager.cancelConnection()
        }
        setShowContactMenu(false)
      }
    }
    
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [manager])
  
  // Determine visual state and animation variants
  let borderStyle = {}
  let showPulseOverlay = false
  
  if (isPendingSource) {
    // This is the source being connected from
    borderStyle = {
      border: '3px solid #4CAF50',
      boxShadow: '0 0 15px rgba(76, 175, 80, 0.7)',
      background: 'rgba(76, 175, 80, 0.1)'
    }
  } else if (manager.connectionStatus === 'selecting-target') {
    // This is a potential target
    borderStyle = {
      border: '3px dashed #2196F3',
      cursor: 'crosshair',
      background: 'rgba(33, 150, 243, 0.1)',
      boxShadow: '0 0 10px rgba(33, 150, 243, 0.5)'
    }
    showPulseOverlay = true
  } else if (manager.connectionMode && manager.connectionStatus === 'selecting-source') {
    // In connection mode, show as selectable source
    borderStyle = {
      border: '2px dashed #FF9800',
      cursor: 'pointer',
      background: 'rgba(255, 152, 0, 0.05)',
      boxShadow: '0 0 8px rgba(255, 152, 0, 0.3)'
    }
  } else if (hasConnections) {
    // This has connections
    borderStyle = {
      border: '1px solid #9C27B0'
    }
  }
  
  return (
    <motion.div
      ref={containerRef}
      className={`connectable ${className}`}
      onContextMenu={handleContextMenu}
      initial={false}
      animate={{
        scale: isPendingSource ? 1.05 : 1,
        ...borderStyle
      }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 20
      }}
      style={{
        position: 'relative',
        display: 'inline-block',
        padding: '4px',
        borderRadius: '4px'
      }}
      title={`Right-click to connect • ${gadget.id}`}
    >
      {/* Animated pulse overlay for target selection */}
      <AnimatePresence>
        {showPulseOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: [0.3, 0.7, 0.3],
              scale: [1, 1.02, 1]
            }}
            exit={{ opacity: 0 }}
            transition={{ 
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(33, 150, 243, 0.1)',
              pointerEvents: 'none',
              borderRadius: '4px'
            }}
          />
        )}
      </AnimatePresence>
      
      {children}
      
      {/* Contact selection menu */}
      <AnimatePresence>
        {showContactMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed',
              left: menuPosition.x,
              top: menuPosition.y,
              background: 'white',
              border: '1px solid #ccc',
              borderRadius: '4px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
              zIndex: 10000,
              minWidth: '200px'
            }}
          >
            <div style={{ padding: '8px', borderBottom: '1px solid #eee', fontWeight: 'bold' }}>
              {manager.connectionStatus === 'selecting-target' 
                ? `Connect TO ${gadget.id}:` 
                : `Connect FROM ${gadget.id}:`}
              <div style={{ fontSize: '10px', color: '#666', fontWeight: 'normal' }}>
                Status: {manager.connectionStatus} | Pending: {isPendingSource ? 'YES' : 'NO'}
              </div>
            </div>
            
            {filteredContacts.length === 0 ? (
              <div style={{ padding: '8px', color: '#999' }}>
                No contacts available
              </div>
            ) : (
              filteredContacts.map(contact => (
                <button
                  key={contact.name}
                  onClick={() => handleContactSelect(contact.name)}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px',
                    border: 'none',
                    background: 'transparent',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f5f5f5'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>
                      <span style={{
                        display: 'inline-block',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: contact.direction === 'input' ? '#4CAF50' : '#FF9800',
                        marginRight: '8px'
                      }} />
                      {contact.name}
                    </span>
                    <span style={{ fontSize: '12px', color: '#666' }}>
                      {contact.direction}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#999', marginTop: '2px', marginLeft: '16px' }}>
                    Value: {typeof contact.value === 'object' ? 
                      JSON.stringify(contact.value).slice(0, 20) + '...' : 
                      String(contact.value).slice(0, 20)}
                    {(() => {
                      if (manager.connectionStatus === 'selecting-target' && !isPendingSource) {
                        // We're selecting a target - show what this contact will do
                        return contact.direction === 'input' ? ' ← will receive data' : ' → will send data'
                      } else {
                        // We're selecting a source or in idle mode - show what this contact will do
                        return contact.direction === 'output' ? ' → will send data' : ' ← will receive data'
                      }
                    })()}
                  </div>
                </button>
              ))
            )}
            
            {manager.connectionMode && (
              <button
                onClick={() => {
                  manager.cancelConnection()
                  setShowContactMenu(false)
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '8px',
                  border: 'none',
                  borderTop: '1px solid #eee',
                  background: '#f5f5f5',
                  textAlign: 'center',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: '#666'
                }}
              >
                Cancel Connection
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Connection status indicator */}
      <AnimatePresence>
        {isPendingSource && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{
              position: 'absolute',
              top: '-20px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#4CAF50',
              color: 'white',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              whiteSpace: 'nowrap'
            }}
          >
            Connecting from {manager.pendingConnection?.contactName}...
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}