/**
 * Typed React component for Slider gadgets
 *
 * This component provides a fully typed interface for slider gadgets,
 * with automatic type inference from the SliderSpec.
 */

import React from 'react';
import { type SliderSpec, type SliderState, Tappable, Gadget, EffectsOf, InputOf } from 'port-graphs';
import { useGadget } from '../useGadget';
import { useGadgetEffect } from '../useGadgetEffect';

export interface SliderProps<S extends SliderSpec, G extends Gadget<S> & Tappable<S>> {
  /** The slider gadget instance */
  gadget: G;
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
  onChange?: (change: EffectsOf<S>['changed']) => void;
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
 * const slider = sliderGadget(50, 0, 100, 5);
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
export function Slider<S extends SliderSpec, G extends Gadget<S> & Tappable<S>>({
  gadget,
  className = '',
  showValue = true,
  showLabels = false,
  label,
  disabled = false,
  onChange
}: SliderProps<S, G>) {
  // useGadget gives us perfect type inference
  // state is SliderState, send accepts SliderCommands
  const [state, send] = useGadget<S, G>(gadget);

  useGadgetEffect(gadget, ({ changed }) => {
    if (changed) {
      onChange?.(changed);
    }
  }, [onChange]);

  // Extract typed values from state
  const { value, min, max, step } = state;

  // Handle slider change with proper type
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(event.target.value);
    // Send typed command to gadget
    send({ set: newValue } as InputOf<S>);
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