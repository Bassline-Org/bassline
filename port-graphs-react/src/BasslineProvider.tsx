/**
 * BasslineProvider - React context for managing bassline gadgets
 *
 * Uses gadgets for everything including persistence
 */

import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { factoryBassline, withTaps, extract, type Gadget, type FactoryBasslineSpec } from 'port-graphs';
import { useRelations } from './useRelations';
import { useGadget } from './useGadget';

interface BasslineContextValue {
  bassline: Gadget<FactoryBasslineSpec> & { tap: any };
  storage: ReturnType<typeof localStorageGadget>;
}

const BasslineContext = createContext<BasslineContextValue | null>(null);

interface BasslineProviderProps {
  children: ReactNode;
  storageKey?: string;
  typeRegistry?: Record<string, Function>;
  autoSave?: boolean;
}

export function BasslineProvider({
  children,
  storageKey = 'bassline-state',
  typeRegistry = {},
  autoSave = true
}: BasslineProviderProps) {

  // Create the bassline and storage gadgets
  const bassline = useMemo(() => withTaps(factoryBassline(typeRegistry)), []);
  const storage = useMemo(() => localStorageGadget(storageKey), [storageKey]);

  // Load initial state from storage
  useMemo(() => {
    storage.receive({ load: {} });
  }, [storage]);

  // Wire storage to bassline if autoSave is enabled
  useRelations(autoSave ? [
    // When bassline changes, save to storage
    () => extract(bassline, 'spawned', () => {
      const state = bassline.current();
      const snapshot = {
        instances: Object.entries(state.instances).map(([name, g]) => ({
          name,
          state: g.current()
        })),
        connections: Object.entries(state.connections).map(([id, c]) => ({
          id,
          ...c.data
        }))
      };
      storage.receive({ save: snapshot });
    }),

    () => extract(bassline, 'connected', () => {
      const state = bassline.current();
      const snapshot = {
        instances: Object.entries(state.instances).map(([name, g]) => ({
          name,
          state: g.current()
        })),
        connections: Object.entries(state.connections).map(([id, c]) => ({
          id,
          ...c.data
        }))
      };
      storage.receive({ save: snapshot });
    }),

    () => extract(bassline, 'disconnected', () => {
      const state = bassline.current();
      const snapshot = {
        instances: Object.entries(state.instances).map(([name, g]) => ({
          name,
          state: g.current()
        })),
        connections: Object.entries(state.connections).map(([id, c]) => ({
          id,
          ...c.data
        }))
      };
      storage.receive({ save: snapshot });
    }),

    // When storage loads data, restore to bassline
    () => extract(storage, 'loaded', (event) => {
      if (event.data) {
        // Clear existing state
        const currentState = bassline.current();
        Object.keys(currentState.instances).forEach(name => {
          bassline.receive({ destroy: name });
        });

        // Restore instances
        event.data.instances?.forEach((instance: any) => {
          // Find the type that can create this instance
          // This is simplified - in reality we'd need to track types
          const typeName = Object.keys(typeRegistry).find(t => {
            // Try to match based on state shape
            return true; // Simplified for now
          });

          if (typeName) {
            bassline.receive({
              spawn: {
                name: instance.name,
                type: typeName,
                args: [instance.state]
              }
            });
          }
        });

        // Restore connections
        event.data.connections?.forEach((conn: any) => {
          bassline.receive({ connect: conn });
        });
      }
    })
  ] : []);

  const contextValue = useMemo(() => ({
    bassline,
    storage
  }), [bassline, storage]);

  return (
    <BasslineContext.Provider value={contextValue}>
      {children}
    </BasslineContext.Provider>
  );
}

export function useBassline() {
  const context = useContext(BasslineContext);
  if (!context) {
    throw new Error('useBassline must be used within BasslineProvider');
  }

  const [state, send] = useGadget(context.bassline);

  return {
    state,
    send,
    bassline: context.bassline,
    storage: context.storage
  };
}