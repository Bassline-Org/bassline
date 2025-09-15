/**
 * Example: Form with bidirectional binding using gadgets
 *
 * Demonstrates how gadgets can manage form state with validation
 */

import React from 'react';
import { useGadget, useGadgetEffect } from '../index';
import { createGadget } from 'port-graphs/dist/core';
import { lastMap } from 'port-graphs/dist/patterns/cells/maps';

// Form state type
interface FormData {
  name: string;
  email: string;
  age: number;
}

// Create a form gadget that validates on update
const createFormGadget = (initial: FormData) =>
  createGadget<FormData & { errors?: string[] }, Partial<FormData>>(
    (current, updates) => {
      // Merge updates with current
      const merged = { ...current, ...updates };

      // Validate
      const errors: string[] = [];
      if (!merged.name) errors.push('Name is required');
      if (!merged.email?.includes('@')) errors.push('Invalid email');
      if (merged.age < 0 || merged.age > 150) errors.push('Invalid age');

      return {
        action: 'update',
        context: { merged, errors }
      };
    },
    {
      update: (gadget, { merged, errors }) => {
        const newState = { ...merged, errors: errors.length > 0 ? errors : undefined };
        gadget.update(newState);
        return {
          changed: newState,
          valid: errors.length === 0
        };
      }
    }
  )(initial);

export function FormExample() {
  const [formState, form] = useGadget(
    () => createFormGadget({ name: '', email: '', age: 0 }),
    { name: '', email: '', age: 0 }
  );

  const [submitted, setSubmitted] = React.useState<FormData | null>(null);

  // Handle form emissions
  useGadgetEffect(
    form,
    (effect: any) => {
      if (effect?.valid) {
        console.log('Form is valid!', effect.changed);
      }
    },
    []
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.errors) {
      setSubmitted(formState);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '400px' }}>
      <h2>Form with Gadget State Management</h2>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            Name:
            <input
              type="text"
              value={formState.name}
              onChange={(e) => form?.receive({ name: e.target.value })}
              style={{ display: 'block', width: '100%', padding: '5px' }}
            />
          </label>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            Email:
            <input
              type="email"
              value={formState.email}
              onChange={(e) => form?.receive({ email: e.target.value })}
              style={{ display: 'block', width: '100%', padding: '5px' }}
            />
          </label>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            Age:
            <input
              type="number"
              value={formState.age}
              onChange={(e) => form?.receive({ age: parseInt(e.target.value) || 0 })}
              style={{ display: 'block', width: '100%', padding: '5px' }}
            />
          </label>
        </div>

        {formState.errors && (
          <div style={{ color: 'red', marginBottom: '15px' }}>
            {formState.errors.map((error, i) => (
              <div key={i}>• {error}</div>
            ))}
          </div>
        )}

        <button
          type="submit"
          disabled={!!formState.errors}
          style={{
            padding: '10px 20px',
            backgroundColor: formState.errors ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: formState.errors ? 'not-allowed' : 'pointer'
          }}
        >
          Submit
        </button>
      </form>

      {submitted && (
        <div style={{
          marginTop: '20px',
          padding: '15px',
          backgroundColor: '#d4edda',
          border: '1px solid #c3e6cb',
          borderRadius: '4px'
        }}>
          <h3>Submitted Successfully!</h3>
          <pre>{JSON.stringify(submitted, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}