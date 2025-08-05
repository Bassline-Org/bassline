import { useState, useCallback, useRef } from 'react'

export interface HistoryState<T> {
  past: T[]
  present: T
  future: T[]
}

export function useHistory<T>(initialState: T) {
  const [history, setHistory] = useState<HistoryState<T>>({
    past: [],
    present: initialState,
    future: []
  })
  
  // Track if we're in the middle of an undo/redo operation
  const isUndoingRef = useRef(false)
  
  const setState = useCallback((newState: T | ((prev: T) => T)) => {
    if (isUndoingRef.current) {
      // If we're undoing/redoing, just update the present without affecting history
      setHistory(prev => ({
        ...prev,
        present: typeof newState === 'function' ? (newState as (prev: T) => T)(prev.present) : newState
      }))
    } else {
      // Normal state update - add to history
      setHistory(prev => {
        const nextState = typeof newState === 'function' 
          ? (newState as (prev: T) => T)(prev.present) 
          : newState
          
        return {
          past: [...prev.past, prev.present],
          present: nextState,
          future: [] // Clear future when new action is performed
        }
      })
    }
  }, [])
  
  const undo = useCallback(() => {
    setHistory(prev => {
      if (prev.past.length === 0) return prev
      
      const previous = prev.past[prev.past.length - 1]
      const newPast = prev.past.slice(0, prev.past.length - 1)
      
      isUndoingRef.current = true
      setTimeout(() => { isUndoingRef.current = false }, 0)
      
      return {
        past: newPast,
        present: previous,
        future: [prev.present, ...prev.future]
      }
    })
  }, [])
  
  const redo = useCallback(() => {
    setHistory(prev => {
      if (prev.future.length === 0) return prev
      
      const next = prev.future[0]
      const newFuture = prev.future.slice(1)
      
      isUndoingRef.current = true
      setTimeout(() => { isUndoingRef.current = false }, 0)
      
      return {
        past: [...prev.past, prev.present],
        present: next,
        future: newFuture
      }
    })
  }, [])
  
  const canUndo = history.past.length > 0
  const canRedo = history.future.length > 0
  
  return {
    state: history.present,
    setState,
    undo,
    redo,
    canUndo,
    canRedo,
    historyLength: history.past.length
  }
}