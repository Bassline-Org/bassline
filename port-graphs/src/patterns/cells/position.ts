/**
 * Position gadgets for spatial state management
 *
 * These gadgets manage x,y coordinates as state, following the gadget protocol
 * while providing specific behaviors for different position management patterns.
 */

import { createGadget } from "../../core";
import { changed } from "../../effects";
import _ from "lodash";

export type Position = { x: number; y: number };

/**
 * Basic position cell - updates to latest position
 * Similar to lastCell but specifically for position data
 */
export const positionCell = createGadget<Position, Partial<Position>>(
  (current, incoming) => {
    // Allow partial updates
    const newPos = { ...current, ...incoming };

    // Check if position actually changed
    if (_.isEqual(current, newPos)) {
      return null;
    }

    return { action: 'update', context: { position: newPos } };
  },
  {
    'update': (gadget, { position }) => {
      gadget.update(position);
      return changed(position);
    }
  }
);

/**
 * Anchored position - snaps to a grid or anchor points
 * Useful for grid-based layouts or alignment features
 */
export const anchoredPosition = (gridSize: number = 20) =>
  createGadget<Position, Partial<Position>>(
    (current, incoming) => {
      // Merge with current
      const rawPos = { ...current, ...incoming };

      // Snap to grid
      const snapped: Position = {
        x: Math.round(rawPos.x / gridSize) * gridSize,
        y: Math.round(rawPos.y / gridSize) * gridSize
      };

      // Check if snapped position changed
      if (_.isEqual(current, snapped)) {
        return null;
      }

      return { action: 'update', context: { position: snapped } };
    },
    {
      'update': (gadget, { position }) => {
        gadget.update(position);
        return changed(position);
      }
    }
  );

/**
 * Bounded position - constrains position within bounds
 * Useful for keeping nodes within a canvas area
 */
export const boundedPosition = (bounds: {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}) =>
  createGadget<Position, Partial<Position>>(
    (current, incoming) => {
      // Merge with current
      const rawPos = { ...current, ...incoming };

      // Apply bounds
      const bounded: Position = {
        x: Math.max(bounds.minX, Math.min(bounds.maxX, rawPos.x)),
        y: Math.max(bounds.minY, Math.min(bounds.maxY, rawPos.y))
      };

      // Check if bounded position changed
      if (_.isEqual(current, bounded)) {
        return null;
      }

      return { action: 'update', context: { position: bounded } };
    },
    {
      'update': (gadget, { position }) => {
        gadget.update(position);
        return changed(position);
      }
    }
  );

/**
 * Relative position - maintains position relative to a parent
 * Useful for grouped or hierarchical layouts
 */
export const relativePosition = createGadget<
  { local: Position; parent: Position; absolute: Position },
  { local?: Position; parent?: Position }
>(
  (current, incoming) => {
    // Update local or parent position
    const newState = { ...current };

    if (incoming.local) {
      newState.local = { ...current.local, ...incoming.local };
    }

    if (incoming.parent) {
      newState.parent = { ...current.parent, ...incoming.parent };
    }

    // Calculate absolute position
    newState.absolute = {
      x: newState.local.x + newState.parent.x,
      y: newState.local.y + newState.parent.y
    };

    // Check if anything changed
    if (_.isEqual(current, newState)) {
      return null;
    }

    return { action: 'update', context: { state: newState } };
  },
  {
    'update': (gadget, { state }) => {
      gadget.update(state);
      return changed(state);
    }
  }
);