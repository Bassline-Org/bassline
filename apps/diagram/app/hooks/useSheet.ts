import { useRef, useState, useEffect, useCallback } from 'react'
import { Sheet } from '@bassline/sheet'
import { createRegistry } from '@bassline/sheet'
import { loadSheet, saveSheet } from '~/lib/persistence'

export type SheetEvent = Record<string, unknown> & { type: string }

export function useSheet(name: string) {
  const sheetRef = useRef<Sheet | null>(null)
  const commandsRef = useRef<ReturnType<typeof createRegistry> | null>(null)
  const [version, setVersion] = useState(0)
  const [events, setEvents] = useState<SheetEvent[]>([])
  const [ready, setReady] = useState(false)

  // Initialize on client only (localStorage not available during SSR)
  useEffect(() => {
    sheetRef.current = loadSheet(name)
    commandsRef.current = createRegistry(sheetRef.current)
    setVersion(0)
    setEvents([])
    setReady(true)
  }, [name])

  useEffect(() => {
    if (!sheetRef.current) return
    const sheet = sheetRef.current
    const unsub = sheet.on((msg: SheetEvent) => {
      setVersion(v => v + 1)
      setEvents(prev => [...prev.slice(-99), msg])
      saveSheet(name, sheet)
    })
    return unsub
  }, [name, ready])

  const clearEvents = useCallback(() => setEvents([]), [])

  const addError = useCallback((message: string) => {
    setEvents(prev => [...prev.slice(-99), { type: 'error', message }])
  }, [])

  return {
    sheet: sheetRef.current,
    commands: commandsRef.current,
    version,
    events,
    clearEvents,
    addError,
    ready,
  }
}
