/**
 * React component for Button gadget
 */

import { type ButtonState, type Tappable, Gadget, Arrow, InputOf } from 'port-graphs';
import { useGadget } from '../useGadget';
import { useGadgetEffect } from '../useGadgetEffect';

export interface ButtonProps<Step extends Arrow> {
  gadget: Gadget<Step> & Tappable<Step>;
  className?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  onClick?: () => void;
}

export function Button<Step extends Arrow>({
  gadget,
  className = '',
  variant = 'primary',
  onClick
}: ButtonProps<Step>) {
  const [state, send] = useGadget(gadget);

  useGadgetEffect(gadget, (effects) => {
    if ('clicked' in effects && effects.clicked !== undefined) {
      onClick?.();
    }
  }, [onClick]);

  const { label, disabled } = state as ButtonState;

  const variantClasses = {
    primary: 'bg-blue-500 hover:bg-blue-600 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800',
    danger: 'bg-red-500 hover:bg-red-600 text-white'
  };

  return (
    <button
      onClick={() => send({ click: {} } as InputOf<Step>)}
      disabled={disabled}
      className={`px-4 py-2 rounded-md font-medium transition-colors ${disabled
        ? 'opacity-50 cursor-not-allowed bg-gray-200 text-gray-500'
        : variantClasses[variant]
        } ${className}`}
    >
      {label}
    </button>
  );
}