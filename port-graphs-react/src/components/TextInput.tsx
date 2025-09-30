/**
 * React component for TextInput gadget
 */

import { type TextInputState, type Tappable, Gadget, Arrow, InputOf } from 'port-graphs';
import { useGadget } from '../useGadget';
import { useGadgetEffect } from '../useGadgetEffect';

export interface TextInputProps<Step extends Arrow> {
  gadget: Gadget<Step> & Tappable<Step>;
  className?: string;
  autoFocus?: boolean;
  onChange?: (value: string) => void;
}

export function TextInput<Step extends Arrow>({
  gadget,
  className = '',
  autoFocus = false,
  onChange
}: TextInputProps<Step>) {
  const [state, send] = useGadget(gadget);

  useGadgetEffect(gadget, (effects) => {
    if ('changed' in effects && effects.changed !== undefined) {
      onChange?.(effects.changed as string);
    }
  }, [onChange]);

  const { value, placeholder, disabled } = state as TextInputState;

  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      onChange={(e) => send({ set: e.target.value } as InputOf<Step>)}
      className={`px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
        } ${className}`}
    />
  );
}