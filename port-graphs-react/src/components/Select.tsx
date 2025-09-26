/**
 * React component for Select gadget
 */

import { type SelectSpec, type Tappable, EffectsOf, Gadget, InputOf, SpecOf, StateOf } from 'port-graphs';
import { useGadget } from '../useGadget';
import { useGadgetEffect } from '../useGadgetEffect';

export interface SelectProps<S extends SelectSpec<any>, G extends Gadget<S> & Tappable<S>> {
  gadget: G;
  className?: string;
  renderOption?: (option: StateOf<S>['value']) => React.ReactNode;
  getOptionValue?: (option: StateOf<S>['value']) => string;
  placeholder?: string;
  onChange?: (change: EffectsOf<S>['changed']) => void;
}

export function Select<S extends SelectSpec<any>, G extends Gadget<S> & Tappable<S>>({
  gadget,
  className = '',
  renderOption = (opt) => String(opt),
  getOptionValue = (opt) => String(opt),
  placeholder = 'Select...',
  onChange
}: SelectProps<S, G>) {
  const [state, send] = useGadget<S>(gadget);

  useGadgetEffect<S>(gadget, ({ changed }) => {
    if (changed) {
      onChange?.(changed as EffectsOf<S>['changed']);
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