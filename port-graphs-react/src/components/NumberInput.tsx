/**
 * React component for NumberInput gadget
 */

import React from 'react';
import { type TypedGadget, type NumberInputSpec, type Tappable } from 'port-graphs';
import { useGadget } from '../useGadget';
import { useGadgetEffect } from '../useGadgetEffect';

export interface NumberInputProps<G extends TypedGadget<NumberInputSpec>> {
  gadget: G & Tappable<NumberInputSpec['effects']>;
  className?: string;
  showButtons?: boolean;
  onChange?: (change: NumberInputSpec['effects']['changed']) => void;
}

export function NumberInput<G extends TypedGadget<NumberInputSpec>>({
  gadget,
  className = '',
  showButtons = true,
  onChange
}: NumberInputProps<G>) {
  const [state, send] = useGadget(gadget);

  useGadgetEffect(gadget, ({ changed }) => {
    if (changed) {
      onChange?.(changed);
    }
  }, [onChange]);

  if (!state) return null;

  return (
    <div className={`inline-flex items-center ${className}`}>
      {showButtons && (
        <button
          onClick={() => send({ decrement: {} })}
          disabled={state.disabled || (state.min !== undefined && state.value <= state.min)}
          className="px-2 py-1 border rounded-l-md bg-gray-50 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          −
        </button>
      )}
      <input
        type="number"
        value={state.value}
        min={state.min}
        max={state.max}
        step={state.step}
        disabled={state.disabled}
        onChange={(e) => {
          const value = parseFloat(e.target.value);
          if (!isNaN(value)) {
            send({ set: value });
          }
        }}
        className={`px-3 py-1 border-y ${showButtons ? '' : 'border-x rounded-md'} text-center w-20 focus:outline-none focus:ring-2 focus:ring-blue-500 ${state.disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
          }`}
      />
      {showButtons && (
        <button
          onClick={() => send({ increment: {} })}
          disabled={state.disabled || (state.max !== undefined && state.value >= state.max)}
          className="px-2 py-1 border rounded-r-md bg-gray-50 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          +
        </button>
      )}
    </div>
  );
}