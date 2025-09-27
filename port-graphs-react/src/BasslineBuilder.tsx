/**
 * BasslineBuilder - Interactive UI for building bassline networks
 */

import React, { useMemo } from 'react';
import { selectGadget, textInputGadget, buttonGadget, withTaps, transform } from 'port-graphs';
import { useRelations } from './useRelations';
import { useGadget } from './useGadget';
import { Select } from './components/Select';
import { TextInput } from './components/TextInput';
import { Button } from './components/Button';
import type { Gadget, FactoryBasslineSpec } from 'port-graphs';

interface BasslineBuilderProps {
  bassline: Gadget<FactoryBasslineSpec> & { tap: any };
}

export function BasslineBuilder({ bassline }: BasslineBuilderProps) {
  const [state] = useGadget(bassline);

  // UI gadgets for instance creation
  const typeSelector = useMemo(() => withTaps(selectGadget()), []);
  const nameInput = useMemo(() => withTaps(textInputGadget('')), []);
  const createButton = useMemo(() => withTaps(buttonGadget()), []);

  // UI gadgets for connections
  const fromSelect = useMemo(() => withTaps(selectGadget()), []);
  const toSelect = useMemo(() => withTaps(selectGadget()), []);
  const patternSelect = useMemo(() => withTaps(selectGadget('extract')), []);
  const connectButton = useMemo(() => withTaps(buttonGadget()), []);

  // Wire UI to bassline
  useRelations([
    // Create instance when button clicked
    () => transform(
      createButton,
      'clicked',
      () => {
        const type = typeSelector.current();
        const name = nameInput.current();
        if (type && name) {
          return {
            spawn: {
              name,
              type,
              args: []
            }
          };
        }
        return undefined;
      },
      bassline
    ),

    // Clear name input after successful spawn
    () => transform(
      bassline,
      'spawned',
      () => '',
      nameInput
    ),

    // Create connection when connect button clicked
    () => transform(
      connectButton,
      'clicked',
      () => {
        const from = fromSelect.current();
        const to = toSelect.current();
        const pattern = patternSelect.current();

        if (from && to) {
          return {
            connect: {
              id: `${from}-${to}-${Date.now()}`,
              from,
              to,
              pattern
            }
          };
        }
        return undefined;
      },
      bassline
    )
  ]);

  const typeOptions = Object.keys(state.types).map(type => ({
    value: type,
    label: type
  }));

  const instanceOptions = Object.keys(state.instances).map(name => ({
    value: name,
    label: name
  }));

  const patternOptions = [
    { value: 'extract', label: 'Extract' },
    { value: 'transform', label: 'Transform' },
    { value: 'forward', label: 'Forward' }
  ];

  return (
    <div style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
      {/* Instance Creation */}
      <div style={{ marginBottom: '20px' }}>
        <h3>Create Instance</h3>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '4px' }}>Type</label>
            <Select
              gadget={typeSelector}
              options={typeOptions}
              placeholder="Select type..."
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '4px' }}>Name</label>
            <TextInput
              gadget={nameInput}
              placeholder="Instance name..."
            />
          </div>
          <Button gadget={createButton}>
            Create
          </Button>
        </div>
      </div>

      {/* Connection Creation */}
      <div>
        <h3>Create Connection</h3>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '4px' }}>From</label>
            <Select
              gadget={fromSelect}
              options={instanceOptions}
              placeholder="Source..."
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '4px' }}>To</label>
            <Select
              gadget={toSelect}
              options={instanceOptions}
              placeholder="Target..."
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '4px' }}>Pattern</label>
            <Select
              gadget={patternSelect}
              options={patternOptions}
            />
          </div>
          <Button gadget={connectButton}>
            Connect
          </Button>
        </div>
      </div>

      {/* Current State Summary */}
      <div style={{ marginTop: '20px', padding: '10px', background: '#f5f5f5', borderRadius: '4px' }}>
        <h4 style={{ margin: '0 0 10px 0' }}>Current State</h4>
        <div>Instances: {Object.keys(state.instances).length}</div>
        <div>Connections: {Object.keys(state.connections).length}</div>
        <div>Types available: {Object.keys(state.types).join(', ')}</div>
      </div>
    </div>
  );
}