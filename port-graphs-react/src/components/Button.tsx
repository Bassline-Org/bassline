/**
 * React component for Button gadget
 */

import { type TypedGadget, type ButtonSpec, type Tappable } from 'port-graphs';
import { useGadget } from '../useGadget';
import { useGadgetEffect } from '../useGadgetEffect';

export interface ButtonProps<G extends TypedGadget<ButtonSpec>> {
  gadget: G & Tappable<ButtonSpec['effects']>;
  className?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  onClick?: (change: ButtonSpec['effects']['clicked']) => void;
}

export function Button<G extends TypedGadget<ButtonSpec>>({
  gadget,
  className = '',
  variant = 'primary',
  onClick
}: ButtonProps<G>) {
  const [state, send] = useGadget(gadget);

  useGadgetEffect(gadget, ({ clicked }) => {
    if (clicked) {
      onClick?.(clicked);
    }
  }, [onClick]);

  if (!state) return null;

  const variantClasses = {
    primary: 'bg-blue-500 hover:bg-blue-600 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800',
    danger: 'bg-red-500 hover:bg-red-600 text-white'
  };

  return (
    <button
      onClick={() => send({ click: {} })}
      disabled={state.disabled}
      className={`px-4 py-2 rounded-md font-medium transition-colors ${state.disabled
        ? 'opacity-50 cursor-not-allowed bg-gray-200 text-gray-500'
        : variantClasses[variant]
        } ${className}`}
    >
      {state.label}
    </button>
  );
}