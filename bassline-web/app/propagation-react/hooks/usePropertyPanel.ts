import { useState, useCallback, useRef } from 'react'

export function usePropertyPanel() {
  const [isVisible, setIsVisible] = useState(false)
  const shouldFocusRef = useRef(false)

  const toggleVisibility = useCallback(() => {
    setIsVisible(prev => !prev)
  }, [])

  const show = useCallback((focusInput = false) => {
    shouldFocusRef.current = focusInput
    setIsVisible(true)
  }, [])

  const hide = useCallback(() => {
    setIsVisible(false)
  }, [])

  return {
    isVisible,
    toggleVisibility,
    show,
    hide,
    shouldFocus: shouldFocusRef
  }
}