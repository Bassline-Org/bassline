/**
 * Selection cell for tracking node selection state
 */

import { lastMap } from 'port-graphs/cells';
import type { PartialSpec, TypedGadget } from 'port-graphs';
import type { SelectionState } from './types';

/**
 * Selection cell specification
 */
export interface SelectionCellSpec extends PartialSpec<
  SelectionState,
  SelectionState | Array<{ id: string; selected: boolean }>,
  {
    changed: SelectionState;
    selectionChanged: Array<{ id: string; selected: boolean }>;
  }
> {}

/**
 * Creates a selection cell for tracking which nodes are selected
 */
export function selectionCell(initial: SelectionState = {}) {
  // Using lastMap as a simple ACI cell
  const cell = lastMap<SelectionState>(initial);

  // Wrap to handle array input
  const originalReceive = cell.receive.bind(cell);

  cell.receive = (input: SelectionState | Array<{ id: string; selected: boolean }>) => {
    if (Array.isArray(input)) {
      // Convert array to object
      const current = cell.current();
      const updated = { ...current };
      const changes: Array<{ id: string; selected: boolean }> = [];

      input.forEach(({ id, selected }) => {
        if (current[id] !== selected) {
          changes.push({ id, selected });
        }
        if (selected) {
          updated[id] = true;
        } else {
          delete updated[id];
        }
      });

      originalReceive(updated);

      // Emit selection changes if needed
      if (changes.length > 0) {
        // @ts-ignore - extending the emit for custom effects
        cell.emit({ selectionChanged: changes });
      }
    } else {
      originalReceive(input);
    }
  };

  return cell as TypedGadget<SelectionCellSpec>;
}