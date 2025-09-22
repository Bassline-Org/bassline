/**
 * React component for Button gadget
 */

import React from 'react';
import { type TypedGadget, type ButtonSpec, type Tappable } from 'port-graphs';
import { useGadget } from '../useGadget';

export interface ButtonProps<G extends TypedGadget<ButtonSpec>> {
  gadget: G & Tappable<ButtonSpec['effects']>;
  className?: string;
  variant?: 'primary' | 'secondary' | 'danger';
}

export function Button<G extends TypedGadget<ButtonSpec>>({
  gadget,
  className = '',
  variant = 'primary'
}: ButtonProps<G>) {
  const [state, send] = useGadget(gadget);

  if (!state) return null;

  const variantClasses = {
    primary: 'bg-blue-500 hover:bg-blue-600 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800',
    danger: 'bg-red-500 hover:bg-red-600 text-white'
  };

  return (
    <button
      onMouseDown={() => send({ press: {} })}
      onMouseUp={() => send({ release: {} })}
      onMouseLeave={() => {
        if (state.pressed) send({ release: {} });
      }}
      onClick={() => send({ click: {} })}
      disabled={state.disabled}
      className={`px-4 py-2 rounded-md font-medium transition-colors ${state.pressed ? 'scale-95' : ''
        } ${state.disabled
          ? 'opacity-50 cursor-not-allowed bg-gray-200 text-gray-500'
          : variantClasses[variant]
        } ${className}`}
    >
      {state.label}
    </button>
  );
}