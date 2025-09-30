/**
 * React component for NumberInput gadget
 */

import { type NumberInputState, type Tappable, Gadget, Arrow, InputOf } from 'port-graphs';
import { useGadget } from '../useGadget';
import { useGadgetEffect } from '../useGadgetEffect';

export interface NumberInputProps<Step extends Arrow> {
  gadget: Gadget<Step> & Tappable<Step>;
  className?: string;
  showButtons?: boolean;
  onChange?: (value: number) => void;
}

export function NumberInput<Step extends Arrow>({
  gadget,
  className = '',
  showButtons = true,
  onChange
}: NumberInputProps<Step>) {
  const [state, send] = useGadget(gadget);

  useGadgetEffect(gadget, (effects) => {
    if ('changed' in effects && effects.changed !== undefined) {
      onChange?.(effects.changed as number);
    }
  }, [onChange]);

  const { value, min, max, step, disabled } = state as NumberInputState;

  return (
    <div className={`inline-flex items-center ${className}`}>
      {showButtons && (
        <button
          onClick={() => send({ decrement: {} } as InputOf<Step>)}
          disabled={disabled || (min !== undefined && value <= min)}
          className="px-2 py-1 border rounded-l-md bg-gray-50 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          −
        </button>
      )}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => {
          const newValue = parseFloat(e.target.value);
          if (!isNaN(newValue)) {
            send({ set: newValue } as InputOf<Step>);
          }
        }}
        className={`px-3 py-1 border-y ${showButtons ? '' : 'border-x rounded-md'} text-center w-20 focus:outline-none focus:ring-2 focus:ring-blue-500 ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
          }`}
      />
      {showButtons && (
        <button
          onClick={() => send({ increment: {} } as InputOf<Step>)}
          disabled={disabled || (max !== undefined && value >= max)}
          className="px-2 py-1 border rounded-r-md bg-gray-50 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          +
        </button>
      )}
    </div>
  );
}