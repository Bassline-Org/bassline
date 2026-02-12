import { useState, useCallback, useRef } from 'react'

export interface PanZoomState {
  x: number
  y: number
  w: number
  h: number
}

const DRAG_THRESHOLD = 3

export function usePanZoom(contentWidth: number, contentHeight: number) {
  const [viewBox, setViewBox] = useState<PanZoomState>({
    x: 0,
    y: 0,
    w: contentWidth,
    h: contentHeight,
  })

  // Auto-fit: when content dimensions change, reset viewBox to fit.
  // This is React's recommended "adjust state when props change" pattern —
  // runs synchronously during render, before paint.
  const prevContent = useRef({ w: 0, h: 0 })
  if (contentWidth > 0 && contentHeight > 0 &&
      (contentWidth !== prevContent.current.w || contentHeight !== prevContent.current.h)) {
    prevContent.current = { w: contentWidth, h: contentHeight }
    setViewBox({ x: 0, y: 0, w: contentWidth, h: contentHeight })
  }

  const isPanning = useRef(false)
  const didDrag = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })
  const svgRef = useRef<SVGSVGElement | null>(null)

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const scaleFactor = e.deltaY > 0 ? 1.1 : 1 / 1.1
      const svg = svgRef.current
      if (!svg) return

      const rect = svg.getBoundingClientRect()
      const mouseX = (e.clientX - rect.left) / rect.width
      const mouseY = (e.clientY - rect.top) / rect.height

      setViewBox(prev => {
        const newW = prev.w * scaleFactor
        const newH = prev.h * scaleFactor
        const dx = (newW - prev.w) * mouseX
        const dy = (newH - prev.h) * mouseY
        return { x: prev.x - dx, y: prev.y - dy, w: newW, h: newH }
      })
    },
    [],
  )

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      isPanning.current = true
      didDrag.current = false
      panStart.current = { x: e.clientX, y: e.clientY }
    }
  }, [])

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning.current) return
      const svg = svgRef.current
      if (!svg) return

      // Only start panning after exceeding drag threshold
      if (!didDrag.current) {
        const dx = e.clientX - panStart.current.x
        const dy = e.clientY - panStart.current.y
        if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return
        didDrag.current = true
      }

      const rect = svg.getBoundingClientRect()
      const scaleX = viewBox.w / rect.width
      const scaleY = viewBox.h / rect.height
      const dx = (e.clientX - panStart.current.x) * scaleX
      const dy = (e.clientY - panStart.current.y) * scaleY
      setViewBox(prev => ({ ...prev, x: prev.x - dx, y: prev.y - dy }))
      panStart.current = { x: e.clientX, y: e.clientY }
    },
    [viewBox.w, viewBox.h],
  )

  const onMouseUp = useCallback(() => {
    isPanning.current = false
  }, [])

  const zoomIn = useCallback(() => {
    setViewBox(prev => ({
      x: prev.x + prev.w * 0.1,
      y: prev.y + prev.h * 0.1,
      w: prev.w * 0.8,
      h: prev.h * 0.8,
    }))
  }, [])

  const zoomOut = useCallback(() => {
    setViewBox(prev => ({
      x: prev.x - prev.w * 0.125,
      y: prev.y - prev.h * 0.125,
      w: prev.w * 1.25,
      h: prev.h * 1.25,
    }))
  }, [])

  const zoomToFit = useCallback(() => {
    setViewBox({ x: 0, y: 0, w: contentWidth, h: contentHeight })
  }, [contentWidth, contentHeight])

  return {
    svgRef,
    viewBox,
    handlers: { onWheel, onMouseDown, onMouseMove, onMouseUp, onMouseLeave: onMouseUp },
    zoomIn,
    zoomOut,
    zoomToFit,
  }
}
