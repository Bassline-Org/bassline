/**
 * Position cell for tracking node positions
 */

import { lastMap } from 'port-graphs/cells';
import type { PartialSpec, TypedGadget } from 'port-graphs';
import type { PositionState } from './types';

/**
 * Position cell specification
 */
export interface PositionCellSpec extends PartialSpec<
  PositionState,
  PositionState | Array<{ id: string; position: { x: number; y: number } }>,
  {
    changed: PositionState;
    moved: Array<{ id: string; from: { x: number; y: number }; to: { x: number; y: number } }>;
  }
> {}

/**
 * Creates a position cell for tracking node positions
 */
export function positionCell(initial: PositionState = {}) {
  // For now, using lastMap as a simple ACI cell
  // Could be enhanced with more sophisticated merging
  const cell = lastMap<PositionState>(initial);

  // Wrap to handle array input
  const originalReceive = cell.receive.bind(cell);

  cell.receive = (input: PositionState | Array<{ id: string; position: { x: number; y: number } }>) => {
    if (Array.isArray(input)) {
      // Convert array to object
      const current = cell.current();
      const updated = { ...current };
      const moves: Array<{ id: string; from: { x: number; y: number }; to: { x: number; y: number } }> = [];

      input.forEach(({ id, position }) => {
        if (current[id]) {
          moves.push({ id, from: current[id], to: position });
        }
        updated[id] = position;
      });

      originalReceive(updated);

      // Emit move events if needed
      if (moves.length > 0) {
        // @ts-ignore - extending the emit for custom effects
        cell.emit({ moved: moves });
      }
    } else {
      originalReceive(input);
    }
  };

  return cell as TypedGadget<PositionCellSpec>;
}