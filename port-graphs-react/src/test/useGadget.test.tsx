/**
 * Tests for useGadget hook
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGadget } from '../useGadget';
import { createGadget } from 'port-graphs';

describe('useGadget', () => {
  it('should initialize with provided state', () => {
    const { result } = renderHook(() =>
      useGadget(
        createGadget(
          () => ({ action: 'noop' }),
          { noop: () => null }
        ),
        { count: 0 }
      )
    );

    const [state] = result.current;
    expect(state).toEqual({ count: 0 });
  });

  it('should update React state when gadget updates', () => {
    const { result } = renderHook(() =>
      useGadget(
        (initial) => createGadget<number, number>(
          (current, incoming) => ({ action: 'add', context: incoming }),
          {
            add: (gadget, value) => {
              const newValue = gadget.current() + value;
              gadget.update(newValue);
              return { changed: newValue };
            }
          }
        )(initial),
        0
      )
    );

    const [, send] = result.current;

    act(() => {
      send(5);
    });

    const [newState] = result.current;
    expect(newState).toBe(5);
  });

  it('should maintain gadget behavior', () => {
    // Test with a maxCell - should only update to higher values
    const { result } = renderHook(() =>
      useGadget(
        (initial) => createGadget<number, number>(
          (current, incoming) => {
            if (incoming > current) {
              return { action: 'update', context: incoming };
            }
            return null;
          },
          {
            update: (gadget, value) => {
              gadget.update(value);
              return { changed: value };
            }
          }
        )(initial),
        10
      )
    );

    const [, send] = result.current;

    // Try to set to lower value
    act(() => {
      send(5);
    });

    let [state] = result.current;
    expect(state).toBe(10); // Should not update

    // Set to higher value
    act(() => {
      send(15);
    });

    [state] = result.current;
    expect(state).toBe(15); // Should update
  });

  it('should handle emissions', () => {
    const emissionSpy = vi.fn();

    const { result } = renderHook(() =>
      useGadget(
        (initial) => {
          const g = createGadget<string, string>(
            (current, incoming) => ({ action: 'update', context: incoming }),
            {
              update: (gadget, value) => {
                gadget.update(value);
                return { changed: value };
              }
            }
          )(initial)
          g.emit = emissionSpy;
          return g;
        },
        'initial'
      )
    );

    const [, send] = result.current;

    act(() => {
      send('updated');
    });

    expect(emissionSpy).toHaveBeenCalledWith({ changed: 'updated' });
  });
});