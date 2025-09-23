/**
 * React component for TextInput gadget
 */

import { type TypedGadget, type TextInputSpec, type Tappable } from 'port-graphs';
import { useGadget } from '../useGadget';
import { useGadgetEffect } from '../useGadgetEffect';

export interface TextInputProps<G extends TypedGadget<TextInputSpec>> {
  gadget: G & Tappable<TextInputSpec['effects']>;
  className?: string;
  autoFocus?: boolean;
  onChange?: (change: TextInputSpec['effects']['changed']) => void;
}

export function TextInput<G extends TypedGadget<TextInputSpec>>({
  gadget,
  className = '',
  autoFocus = false,
  onChange
}: TextInputProps<G>) {
  const [state, send] = useGadget(gadget);

  useGadgetEffect(gadget, ({ changed }) => {
    if (changed) {
      onChange?.(changed);
    }
  }, [onChange]);

  if (!state) return null;

  return (
    <input
      type="text"
      value={state.value}
      placeholder={state.placeholder}
      disabled={state.disabled}
      autoFocus={autoFocus}
      onChange={(e) => send({ set: e.target.value })}
      className={`px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${state.disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
        } ${className}`}
    />
  );
}