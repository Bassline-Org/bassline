/**
 * React component for Button gadget
 */

import { type ButtonSpec, type Tappable, Gadget, EffectsOf, InputOf } from 'port-graphs';
import { useGadget } from '../useGadget';
import { useGadgetEffect } from '../useGadgetEffect';

export interface ButtonProps<S extends ButtonSpec, G extends Gadget<S> & Tappable<S>> {
  gadget: G;
  className?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  onClick?: (change: EffectsOf<S>['clicked']) => void;
}

export function Button<S extends ButtonSpec, G extends Gadget<S> & Tappable<S>>({
  gadget,
  className = '',
  variant = 'primary',
  onClick
}: ButtonProps<S, G>) {
  const [state, send] = useGadget<S, G>(gadget);

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
      onClick={() => send({ click: {} } as InputOf<S>)}
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