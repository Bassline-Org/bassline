/**
 * React component for TextInput gadget
 */

import { type TextInputSpec, type Tappable, Gadget, InputOf, EffectsOf } from 'port-graphs';
import { useGadget } from '../useGadget';
import { useGadgetEffect } from '../useGadgetEffect';

export interface TextInputProps<S extends TextInputSpec, G extends Gadget<S> & Tappable<S>> {
  gadget: G,
  className?: string;
  autoFocus?: boolean;
  onChange?: (change: EffectsOf<S>['changed']) => void;
}

export function TextInput<S extends TextInputSpec, G extends Gadget<S> & Tappable<S>>({
  gadget,
  className = '',
  autoFocus = false,
  onChange
}: TextInputProps<S, G>) {
  const [state, send] = useGadget<S, G>(gadget);

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
      onChange={(e) => send({ set: e.target.value } as InputOf<S>)}
      className={`px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${state.disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
        } ${className}`}
    />
  );
}