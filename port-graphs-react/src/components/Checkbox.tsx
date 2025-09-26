/**
 * React component for Checkbox gadget
 */

import { type CheckboxSpec, type Tappable, EffectsOf, Gadget, InputOf } from 'port-graphs';
import { useGadget } from '../useGadget';
import { useGadgetEffect } from '../useGadgetEffect';

export interface CheckboxProps<S extends CheckboxSpec, G extends Gadget<S> & Tappable<S>> {
  gadget: G;
  className?: string;
  onChange?: (change: EffectsOf<S>['changed']) => void;
}

export function Checkbox<S extends CheckboxSpec, G extends Gadget<S> & Tappable<S>>({
  gadget,
  className = '',
  onChange
}: CheckboxProps<S, G>) {
  const [state, send] = useGadget<S, G>(gadget);

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
        onChange={() => send({ toggle: {} } as InputOf<S>)}
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