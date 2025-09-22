/**
 * React component for Checkbox gadget
 */

import React from 'react';
import { type TypedGadget, type CheckboxSpec, type Tappable } from 'port-graphs';
import { useGadget } from '../useGadget';

export interface CheckboxProps<G extends TypedGadget<CheckboxSpec>> {
  gadget: G & Tappable<CheckboxSpec['effects']>;
  className?: string;
}

export function Checkbox<G extends TypedGadget<CheckboxSpec>>({
  gadget,
  className = ''
}: CheckboxProps<G>) {
  const [state, send] = useGadget(gadget);

  if (!state) return null;

  return (
    <label className={`flex items-center cursor-pointer ${state.disabled ? 'opacity-50' : ''} ${className}`}>
      <input
        type="checkbox"
        checked={state.checked}
        disabled={state.disabled}
        onChange={() => send({ toggle: {} })}
        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:cursor-not-allowed"
      />
      {state.label && (
        <span className="ml-2 select-none">
          {state.label}
        </span>
      )}
    </label>
  );
}