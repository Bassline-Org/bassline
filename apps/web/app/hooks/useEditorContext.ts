import { useOutletContext } from 'react-router'
import type { GroupState } from '@bassline/core'

export type EditorContext = {
  groupState: GroupState
  groupId: string
  setGroupState: (state: GroupState) => void
}

/**
 * Type-safe hook for accessing editor context in child routes
 */
export function useEditorContext() {
  return useOutletContext<EditorContext>()
}