/**
 * React component for Select gadget
 */

import { type SelectState, type Tappable, Gadget, Arrow, InputOf } from 'port-graphs';
import { useGadget } from '../useGadget';
import { useGadgetEffect } from '../useGadgetEffect';

export interface SelectProps<T, Step extends Arrow> {
  gadget: Gadget<Step> & Tappable<Step>;
  className?: string;
  renderOption?: (option: T) => React.ReactNode;
  getOptionValue?: (option: T) => string;
  placeholder?: string;
  onChange?: (value: T) => void;
}

export function Select<T, Step extends Arrow>({
  gadget,
  className = '',
  renderOption = (opt) => String(opt),
  getOptionValue = (opt) => String(opt),
  placeholder = 'Select...',
  onChange
}: SelectProps<T, Step>) {
  const [state, send] = useGadget(gadget);

  useGadgetEffect(gadget, (effects) => {
    if ('changed' in effects && effects.changed !== undefined) {
      onChange?.(effects.changed as T);
    }
  }, [onChange]);

  const { value, options, disabled } = state as SelectState<T>;

  return (
    <select
      value={value !== undefined ? getOptionValue(value) : ''}
      disabled={disabled}
      onChange={(e) => {
        const selectedValue = e.target.value;
        const option = options.find(opt => getOptionValue(opt) === selectedValue);
        if (option !== undefined) {
          send({ select: option } as InputOf<Step>);
        }
      }}
      className={`px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
        } ${className}`}
    >
      {value === undefined && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((option, idx) => (
        <option key={idx} value={getOptionValue(option)}>
          {renderOption(option)}
        </option>
      ))}
    </select>
  );
}