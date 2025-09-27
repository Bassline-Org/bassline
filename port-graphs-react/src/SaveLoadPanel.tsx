/**
 * SaveLoadPanel - UI for saving and loading bassline configurations
 */

import React, { useMemo, useRef } from 'react';
import { buttonGadget, withTaps, transform, fileIOGadget, fileInputGadget } from 'port-graphs';
import { useRelations } from './useRelations';
import { useGadget } from './useGadget';
import { Button } from './components/Button';
import type { Gadget, FactoryBasslineSpec } from 'port-graphs';

interface SaveLoadPanelProps {
  bassline: Gadget<FactoryBasslineSpec> & { tap: any };
}

// Helper to serialize bassline state
function serializeBassline(bassline: Gadget<FactoryBasslineSpec>) {
  const state = bassline.current();
  return {
    types: Object.keys(state.types),
    instances: Object.entries(state.instances).map(([name, g]) => ({
      name,
      state: g.current()
    })),
    connections: Object.entries(state.connections).map(([id, c]) => ({
      id,
      ...c.data
    }))
  };
}

export function SaveLoadPanel({ bassline }: SaveLoadPanelProps) {
  const [basslineState] = useGadget(bassline);

  // UI gadgets
  const saveButton = useMemo(() => withTaps(buttonGadget()), []);
  const loadButton = useMemo(() => withTaps(buttonGadget()), []);
  const clearButton = useMemo(() => withTaps(buttonGadget()), []);
  const fileIO = useMemo(() => fileIOGadget(), []);
  const fileInput = useMemo(() => fileInputGadget('.json', false), []);

  // File input ref for triggering file dialog
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Wire UI actions
  useRelations([
    // Save button downloads JSON
    () => transform(
      saveButton,
      'clicked',
      () => {
        const snapshot = serializeBassline(bassline);
        return {
          download: {
            data: snapshot,
            filename: `bassline-${Date.now()}.json`
          }
        };
      },
      fileIO
    ),

    // Load button triggers file input
    () => transform(
      loadButton,
      'clicked',
      () => {
        fileInputRef.current?.click();
        return undefined;
      },
      fileIO
    ),

    // File selection triggers file read
    () => transform(
      fileInput,
      'selected',
      (files) => {
        if (files && files[0]) {
          return { read: files[0] };
        }
        return undefined;
      },
      fileIO
    ),

    // File read loads into bassline
    () => transform(
      fileIO,
      'fileRead',
      (event) => {
        if (event.data) {
          // Clear existing state
          const currentState = bassline.current();
          const destroyCommands = Object.keys(currentState.instances).map(name => ({
            destroy: name
          }));

          // Send all destroy commands first
          destroyCommands.forEach(cmd => bassline.receive(cmd));

          // Then restore from loaded data
          const commands: any[] = [];

          // Restore instances
          event.data.instances?.forEach((instance: any) => {
            commands.push({
              spawn: {
                name: instance.name,
                type: 'max', // Simplified - would need type mapping
                args: [instance.state]
              }
            });
          });

          // Restore connections
          event.data.connections?.forEach((conn: any) => {
            commands.push({ connect: conn });
          });

          // Send all commands
          commands.forEach(cmd => bassline.receive(cmd));
        }
        return undefined;
      },
      bassline
    ),

    // Clear button destroys all instances
    () => transform(
      clearButton,
      'clicked',
      () => {
        const currentState = bassline.current();
        Object.keys(currentState.instances).forEach(name => {
          bassline.receive({ destroy: name });
        });
        return undefined;
      },
      bassline
    )
  ]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      fileInput.receive({ filesSelected: e.target.files });
    }
  };

  return (
    <div style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
      <h3>Configuration Management</h3>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <Button gadget={saveButton}>
          💾 Save Configuration
        </Button>

        <Button gadget={loadButton}>
          📁 Load Configuration
        </Button>

        <Button gadget={clearButton}>
          🗑️ Clear All
        </Button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Status display */}
      <div style={{
        padding: '10px',
        background: '#f5f5f5',
        borderRadius: '4px',
        fontSize: '14px'
      }}>
        <div>
          Current configuration:
        </div>
        <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
          <li>{Object.keys(basslineState.instances).length} instances</li>
          <li>{Object.keys(basslineState.connections).length} connections</li>
          <li>{Object.keys(basslineState.types).length} types defined</li>
        </ul>
      </div>

      {/* Quick actions */}
      <div style={{ marginTop: '20px' }}>
        <h4>Quick Actions</h4>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            style={{
              padding: '5px 10px',
              background: '#e3f2fd',
              border: '1px solid #90caf9',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
            onClick={() => {
              // Create a simple test network
              bassline.receive({ spawn: { name: 'input', type: 'max', args: [0] } });
              bassline.receive({ spawn: { name: 'processor', type: 'max', args: [0] } });
              bassline.receive({ spawn: { name: 'output', type: 'max', args: [0] } });
              bassline.receive({
                connect: {
                  id: 'input-processor',
                  from: 'input',
                  to: 'processor',
                  pattern: 'extract'
                }
              });
              bassline.receive({
                connect: {
                  id: 'processor-output',
                  from: 'processor',
                  to: 'output',
                  pattern: 'extract'
                }
              });
            }}
          >
            Create Test Network
          </button>

          <button
            style={{
              padding: '5px 10px',
              background: '#fff3e0',
              border: '1px solid #ffb74d',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
            onClick={() => {
              // Export to clipboard
              const snapshot = serializeBassline(bassline);
              navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
              alert('Configuration copied to clipboard!');
            }}
          >
            Copy to Clipboard
          </button>
        </div>
      </div>
    </div>
  );
}