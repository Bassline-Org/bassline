/**
 * React component for Select gadget
 */

import { type SelectSpec, type Tappable, EffectsOf, Gadget, InputOf } from 'port-graphs';
import { useGadget } from '../useGadget';
import { useGadgetEffect } from '../useGadgetEffect';

export interface SelectProps<T, S extends SelectSpec<T>, G extends Gadget<S> & Tappable<S>> {
  gadget: G;
  className?: string;
  renderOption?: (option: T) => React.ReactNode;
  getOptionValue?: (option: T) => string;
  placeholder?: string;
  onChange?: (change: EffectsOf<SelectSpec<T>>['changed']) => void;
}

export function Select<T, S extends SelectSpec<T>, G extends Gadget<S> & Tappable<S>>({
  gadget,
  className = '',
  renderOption = (opt) => String(opt),
  getOptionValue = (opt) => String(opt),
  placeholder = 'Select...',
  onChange
}: SelectProps<T, S, G>) {
  const [state, send] = useGadget<S, G>(gadget);

  useGadgetEffect(gadget, ({ changed }) => {
    if (changed) {
      onChange?.(changed);
    }
  }, [onChange]);

  if (!state) return null;

  return (
    <select
      value={state.value !== undefined ? getOptionValue(state.value) : ''}
      disabled={state.disabled}
      onChange={(e) => {
        const selectedValue = e.target.value;
        const option = state.options.find(opt => getOptionValue(opt) === selectedValue);
        if (option !== undefined) {
          send({ select: option } as InputOf<S>);
        }
      }}
      className={`px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${state.disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
        } ${className}`}
    >
      {state.value === undefined && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {state.options.map((option, idx) => (
        <option key={idx} value={getOptionValue(option)}>
          {renderOption(option)}
        </option>
      ))}
    </select>
  );
}