import { Context as ReactContext, ReactNode } from 'react'
import { Bassline, Response } from '@bassline/core'

/**
 * React context for Bassline instance
 */
export declare const BasslineContext: ReactContext<Bassline | null>

/**
 * React context for WebSocket connection
 */
export declare const WebSocketContext: ReactContext<WebSocket | null>

/**
 * Provider component for Bassline instance
 */
export declare function BasslineProvider(props: {
  value: Bassline
  children: ReactNode
}): JSX.Element

/**
 * Hook to access the Bassline instance
 */
export declare function useBassline(): Bassline

/**
 * Hook to fetch a resource by URI
 */
export declare function useResource(uri: string): {
  data: Response | null
  loading: boolean
  error: Error | null
  refetch: () => void
}

/**
 * Hook to write to a resource
 */
export declare function useWrite(uri: string): (body: any) => Promise<Response | null>

/**
 * Hook to access the WebSocket connection
 */
export declare function useWebSocket(): WebSocket | null

/**
 * Hook for live-updating resource with WebSocket subscription
 */
export declare function useLiveResource(
  uri: string,
  options?: { subscribe?: boolean }
): {
  data: Response | null
  loading: boolean
  error: Error | null
  refetch: () => void
  isLive: boolean
}

/**
 * Hook for keyboard shortcuts
 */
export declare function useHotkey(
  key: string,
  handler: (event: KeyboardEvent) => void,
  options?: {
    meta?: boolean
    ctrl?: boolean
    shift?: boolean
    preventDefault?: boolean
  }
): void

/**
 * Hook to delete a resource
 */
export declare function useDelete(uri: string): () => Promise<Response | null>

/**
 * Provider for WebSocket connection with auto-reconnect
 */
export declare function WebSocketProvider(props: {
  url: string
  children: ReactNode
}): JSX.Element

// Re-exported hooks
export { useTmpState } from './hooks/useTmpState.js'
export { usePlumberRule } from './hooks/usePlumberRule.js'
export { useCell } from './hooks/useCell.js'
