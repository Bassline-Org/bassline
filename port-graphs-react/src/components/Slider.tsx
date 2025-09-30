/**
 * Typed React component for Slider gadgets
 *
 * This component provides a fully typed interface for slider gadgets,
 * with automatic type inference from the gadget's Step type.
 */

import React from 'react';
import { type SliderState, Tappable, Gadget, Arrow, InputOf } from 'port-graphs';
import { useGadget } from '../useGadget';
import { useGadgetEffect } from '../useGadgetEffect';

export interface SliderProps<Step extends Arrow> {
  /** The slider gadget instance */
  gadget: Gadget<Step> & Tappable<Step>;
  /** Optional CSS class name */
  className?: string;
  /** Whether to show the current value */
  showValue?: boolean;
  /** Whether to show min/max labels */
  showLabels?: boolean;
  /** Optional label for the slider */
  label?: string;
  /** Disable the slider */
  disabled?: boolean;
  onChange?: (value: number) => void;
}

/**
 * Slider component that binds to a slider gadget
 *
 * The component automatically:
 * - Syncs with the gadget's state
 * - Sends properly typed commands on interaction
 * - Updates when the gadget state changes
 *
 * @example
 * ```tsx
 * import { quick, withTaps, sliderProto } from 'port-graphs';
 *
 * const slider = withTaps(quick(sliderProto, { value: 50, min: 0, max: 100, step: 1 }));
 *
 * function MyComponent() {
 *   return <Slider
 *     gadget={slider}
 *     showValue
 *     showLabels
 *     label="Volume"
 *   />;
 * }
 * ```
 */
export function Slider<Step extends Arrow>({
  gadget,
  className = '',
  showValue = true,
  showLabels = false,
  label,
  disabled = false,
  onChange
}: SliderProps<Step>) {
  const [state, send] = useGadget(gadget);

  useGadgetEffect(gadget, (effects) => {
    if ('changed' in effects && effects.changed !== undefined) {
      onChange?.(effects.changed as number);
    }
  }, [onChange]);

  // Type assertion since Step is generic - user passes slider-compatible gadget
  const { value, min, max, step } = state as SliderState;

  // Handle slider change with proper type
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(event.target.value);
    // Send typed command to gadget
    send({ set: newValue } as InputOf<Step>);
  };

  // Calculate percentage for display
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className={`slider-container ${className}`}>
      {label && (
        <label className="slider-label">
          {label}
        </label>
      )}

      <div className="slider-wrapper">
        {showLabels && (
          <span className="slider-min">{min}</span>
        )}

        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          className="slider-input"
          style={{
            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${percentage}%, #e5e7eb ${percentage}%, #e5e7eb 100%)`
          }}
        />

        {showLabels && (
          <span className="slider-max">{max}</span>
        )}
      </div>

      {showValue && (
        <div className="slider-value">
          {value}
        </div>
      )}
    </div>
  );
}