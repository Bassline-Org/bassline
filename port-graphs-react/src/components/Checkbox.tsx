/**
 * React component for Checkbox gadget
 */

import { type TypedGadget, type CheckboxSpec, type Tappable } from 'port-graphs';
import { useGadget } from '../useGadget';
import { useGadgetEffect } from '../useGadgetEffect';

export interface CheckboxProps<G extends TypedGadget<CheckboxSpec>> {
  gadget: G & Tappable<CheckboxSpec['effects']>;
  className?: string;
  onChange?: (change: CheckboxSpec['effects']['changed']) => void;
}

export function Checkbox<G extends TypedGadget<CheckboxSpec>>({
  gadget,
  className = '',
  onChange
}: CheckboxProps<G>) {
  const [state, send] = useGadget(gadget);

  useGadgetEffect(gadget, ({ changed }) => {
    if (changed !== undefined) {
      onChange?.(changed);
    }
  }, [onChange]);

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