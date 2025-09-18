/**
 * Example: Pipeline using direct taps
 *
 * Demonstrates how to build a data processing pipeline using taps
 */

import React, { useState } from 'react';
import { useGadget, useTap } from '../index';
import { createGadget, changed, noop } from 'port-graphs';

// Create a validator gadget factory
const createValidator = (initial: any) =>
  createGadget(
    (_state, data: string) => {
      if (data.length > 0 && data.length < 50) {
        return { action: 'valid', context: data };
      }
      return { action: 'invalid', context: data };
    },
    {
      valid: (gadget, data) => {
        gadget.update({ valid: true, data });
        return changed({ valid: true, data });
      },
      invalid: (gadget, data) => {
        gadget.update({ valid: false, data });
        return changed({ valid: false, data });
      },
    }
  );

// Create a transformer gadget factory
const createTransformer = (initial: any) =>
  createGadget(
    (_state, data: { valid: boolean; data: string }) => {
      if (data.valid) {
        return { action: 'transform', context: data.data };
      }
      return { action: 'skip' };
    },
    {
      transform: (gadget, data) => {
        const transformed = data.toUpperCase();
        gadget.update(transformed);
        return changed(transformed);
      },
      skip: () => noop(),
    }
  );

// Create a storage gadget factory
const createStorage = (initial: string[]) =>
  createGadget(
    (state, data: string) => ({ action: 'store', context: data }),
    {
      store: (gadget, data) => {
        const newState = [...gadget.current(), data];
        gadget.update(newState);
        return changed(newState);
      },
    }
  );

export function PipelineExample() {
  const [input, setInput] = useState('');

  // Create the pipeline stages - all automatically tappable!
  const [, sendInput, inputGadget] = useGadget(
    () => createGadget(
      (_state, data: string) => ({ action: 'emit', context: data }),
      { emit: (gadget, data) => { gadget.update(data); return changed(data); } }
    ),
    ''
  );

  const [validatorState, , validator] = useGadget(createValidator, { valid: false, data: '' });
  const [transformed, , transformer] = useGadget(createTransformer, '');
  const [stored, , storage] = useGadget(createStorage, []);

  // Wire the pipeline using taps
  useTap(inputGadget, (effect) => {
    if (effect && 'changed' in effect) {
      validator.receive(effect.changed);
    }
  });

  useTap(validator, (effect) => {
    if (effect && 'changed' in effect) {
      transformer.receive(effect.changed);
    }
  });

  useTap(transformer, (effect) => {
    if (effect && 'changed' in effect) {
      storage.receive(effect.changed);
    }
  });

  // Log storage changes
  useTap(storage, (effect) => {
    console.log('Storage updated:', effect);
  });

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h2>Data Pipeline (Tap-based)</h2>

      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter text (1-49 characters)"
          style={{ marginRight: '10px', padding: '5px' }}
        />
        <button onClick={() => sendInput(input)}>
          Send to Pipeline
        </button>
      </div>

      <div style={{ display: 'grid', gap: '10px' }}>
        <div style={{ padding: '10px', background: '#f0f0f0', borderRadius: '4px' }}>
          <strong>Validator:</strong>
          <div>Valid: {validatorState.valid ? '✅' : '❌'}</div>
          <div>Data: {validatorState.data}</div>
        </div>

        <div style={{ padding: '10px', background: '#f0f0f0', borderRadius: '4px' }}>
          <strong>Transformer:</strong>
          <div>Output: {transformed || '(none)'}</div>
        </div>

        <div style={{ padding: '10px', background: '#f0f0f0', borderRadius: '4px' }}>
          <strong>Storage:</strong>
          <ul>
            {stored.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div style={{ marginTop: '20px', fontSize: '0.9em', color: '#666' }}>
        Pipeline: Input → Validator → Transformer → Storage
        <br />
        Connected using direct taps between gadgets!
      </div>
    </div>
  );
}

/**
 * Example: Broadcast pattern with taps
 */
export function BroadcastExample() {
  const [, sendBroadcast, broadcaster] = useGadget(
    () => createGadget(
      (_state, data: string) => ({ action: 'broadcast', context: data }),
      { broadcast: (gadget, data) => { gadget.update(data); return changed(data); } }
    ),
    ''
  );

  const [log1, , logger1] = useGadget(createStorage, []);
  const [log2, , logger2] = useGadget(createStorage, []);
  const [log3, , logger3] = useGadget(createStorage, []);

  // Broadcast to multiple targets using taps
  useTap(broadcaster, (effect) => {
    if (effect && 'changed' in effect) {
      logger1.receive(effect.changed);
      logger2.receive(effect.changed);
      logger3.receive(effect.changed);
    }
  });

  const [message, setMessage] = useState('');

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h2>Broadcast Pattern</h2>

      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Enter message to broadcast"
          style={{ marginRight: '10px', padding: '5px' }}
        />
        <button onClick={() => sendBroadcast(message)}>
          Broadcast
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
        <div style={{ padding: '10px', background: '#f0f0f0', borderRadius: '4px' }}>
          <strong>Logger 1</strong>
          <ul>
            {log1.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>

        <div style={{ padding: '10px', background: '#f0f0f0', borderRadius: '4px' }}>
          <strong>Logger 2</strong>
          <ul>
            {log2.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>

        <div style={{ padding: '10px', background: '#f0f0f0', borderRadius: '4px' }}>
          <strong>Logger 3</strong>
          <ul>
            {log3.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}