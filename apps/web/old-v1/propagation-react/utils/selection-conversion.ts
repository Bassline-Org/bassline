import type { Selection } from '~/propagation-core/refactoring/types'
import type { SelectionState } from '~/propagation-react/types/context-frame'

/**
 * Convert context frame selection to old refactoring selection format
 */
export function contextSelectionToRefactoringSelection(
  contextSelection: SelectionState
): Selection {
  return {
    contacts: new Set(contextSelection.contactIds),
    groups: new Set(contextSelection.groupIds),
    wires: new Set() // Context selection doesn't track wires
  }
}