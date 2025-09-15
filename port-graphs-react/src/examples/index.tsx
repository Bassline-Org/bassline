/**
 * Example React components demonstrating gadget integration
 */

export { CounterExample } from './Counter';
export { FormExample } from './Form';
export { PubSubChatExample } from './PubSubChat';

import React from 'react';
import { CounterExample } from './Counter';
import { FormExample } from './Form';

/**
 * Main example app showing all demos
 */
export function ExampleApp() {
  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Port-Graphs React Examples</h1>

      <div style={{ marginBottom: '40px' }}>
        <CounterExample />
      </div>

      <div style={{ marginBottom: '40px' }}>
        <FormExample />
      </div>

      <p style={{ marginTop: '40px', padding: '20px', backgroundColor: '#f0f0f0' }}>
        Note: These examples show how gadgets integrate with React, using React state
        as the single source of truth while preserving gadget behavior and semantics.
      </p>
    </div>
  );
}