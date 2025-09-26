/**
 * React component for NumberInput gadget
 */

import { type NumberInputSpec, type Tappable, EffectsOf, Gadget, InputOf } from 'port-graphs';
import { useGadget } from '../useGadget';
import { useGadgetEffect } from '../useGadgetEffect';

export interface NumberInputProps<S extends NumberInputSpec, G extends Gadget<S> & Tappable<S>> {
  gadget: G;
  className?: string;
  showButtons?: boolean;
  onChange?: (change: EffectsOf<S>['changed']) => void;
}

export function NumberInput<S extends NumberInputSpec, G extends Gadget<S> & Tappable<S>>({
  gadget,
  className = '',
  showButtons = true,
  onChange
}: NumberInputProps<S, G>) {
  const [state, send] = useGadget<S, G>(gadget);

  useGadgetEffect(gadget, ({ changed }) => {
    if (changed) {
      onChange?.(changed);
    }
  }, [onChange]);

  if (!state) return null;

  return (
    <div className={`inline-flex items-center ${className}`}>
      {showButtons && (
        <button
          onClick={() => send({ decrement: {} } as InputOf<S>)}
          disabled={state.disabled || (state.min !== undefined && state.value <= state.min)}
          className="px-2 py-1 border rounded-l-md bg-gray-50 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          −
        </button>
      )}
      <input
        type="number"
        value={state.value}
        min={state.min}
        max={state.max}
        step={state.step}
        disabled={state.disabled}
        onChange={(e) => {
          const value = parseFloat(e.target.value);
          if (!isNaN(value)) {
            send({ set: value } as InputOf<S>);
          }
        }}
        className={`px-3 py-1 border-y ${showButtons ? '' : 'border-x rounded-md'} text-center w-20 focus:outline-none focus:ring-2 focus:ring-blue-500 ${state.disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
          }`}
      />
      {showButtons && (
        <button
          onClick={() => send({ increment: {} } as InputOf<S>)}
          disabled={state.disabled || (state.max !== undefined && state.value >= state.max)}
          className="px-2 py-1 border rounded-r-md bg-gray-50 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          +
        </button>
      )}
    </div>
  );
}