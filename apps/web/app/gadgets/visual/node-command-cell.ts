/**
 * Command cell for processing React Flow node changes
 */

import type { NodeChange } from '@xyflow/react';
import { defGadget, withTaps } from 'port-graphs';
import type { GadgetSpec } from 'port-graphs';

/**
 * Node command specification
 */
export interface NodeCommandSpec extends GadgetSpec<
  {}, // No persistent state needed
  NodeChange[], // Always an array input
  {
    processChanges: NodeChange[];
  },
  {
    positionsChanged: Array<{ id: string; position: { x: number; y: number } }>;
    selectionsChanged: Array<{ id: string; selected: boolean }>;
    dimensionsChanged: Array<{ id: string; dimensions: { width: number; height: number } }>;
    nodesRemoved: string[];
    noop: {};
  }
> {}

/**
 * Creates a node command cell that processes React Flow changes
 */
export function nodeCommandCell() {
  const baseGadget = defGadget<NodeCommandSpec>(
    (_state, changes) => {
      // Always process the array of changes
      if (changes && changes.length > 0) {
        return { processChanges: changes };
      }
      return null;
    },
    {
      processChanges: (_gadget, changes) => {
        // Group changes by type
        const positions: Array<{ id: string; position: { x: number; y: number } }> = [];
        const selections: Array<{ id: string; selected: boolean }> = [];
        const dimensions: Array<{ id: string; dimensions: { width: number; height: number } }> = [];
        const removals: string[] = [];

        changes.forEach(change => {
          switch (change.type) {
            case 'position':
              if ('position' in change && change.position) {
                positions.push({
                  id: change.id,
                  position: change.position
                });
              }
              break;

            case 'select':
              if ('selected' in change) {
                selections.push({
                  id: change.id,
                  selected: change.selected
                });
              }
              break;

            case 'dimensions':
              if ('dimensions' in change && change.dimensions && 'resizing' in change && !change.resizing) {
                dimensions.push({
                  id: change.id,
                  dimensions: change.dimensions
                });
              }
              break;

            case 'remove':
              removals.push(change.id);
              break;
          }
        });

        // Build effects object with only non-empty arrays
        const effects: Partial<NodeCommandSpec['effects']> = {};

        if (positions.length > 0) {
          effects.positionsChanged = positions;
        }
        if (selections.length > 0) {
          effects.selectionsChanged = selections;
        }
        if (dimensions.length > 0) {
          effects.dimensionsChanged = dimensions;
        }
        if (removals.length > 0) {
          effects.nodesRemoved = removals;
        }

        // If we have any effects, return them, otherwise noop
        return Object.keys(effects).length > 0 ? effects : { noop: {} };
      }
    }
  )({});

  return withTaps(baseGadget);
}