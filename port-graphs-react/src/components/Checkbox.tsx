/**
 * React component for Checkbox gadget
 */

import { type CheckboxState, type Tappable, Gadget, Arrow, InputOf } from 'port-graphs';
import { useGadget } from '../useGadget';
import { useGadgetEffect } from '../useGadgetEffect';

export interface CheckboxProps<Step extends Arrow> {
  gadget: Gadget<Step> & Tappable<Step>;
  className?: string;
  onChange?: (checked: boolean) => void;
}

export function Checkbox<Step extends Arrow>({
  gadget,
  className = '',
  onChange
}: CheckboxProps<Step>) {
  const [state, send] = useGadget(gadget);

  useGadgetEffect(gadget, (effects) => {
    if ('changed' in effects && effects.changed !== undefined) {
      onChange?.(effects.changed as boolean);
    }
  }, [onChange]);

  const { checked, disabled, label } = state as CheckboxState;

  return (
    <label className={`flex items-center cursor-pointer ${disabled ? 'opacity-50' : ''} ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={() => send({ toggle: {} } as InputOf<Step>)}
        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:cursor-not-allowed"
      />
      {label && (
        <span className="ml-2 select-none">
          {label}
        </span>
      )}
    </label>
  );
}