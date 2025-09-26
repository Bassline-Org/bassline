/**
 * Typed React component for Toggle gadgets
 *
 * This component provides a fully typed interface for toggle gadgets,
 * with automatic type inference from the ToggleSpec.
 */

import { type ToggleSpec, Tappable, Gadget, EffectsOf, InputOf } from 'port-graphs';
import { useGadget } from '../useGadget';
import { useCallback } from 'react';
import { useGadgetEffect } from '../useGadgetEffect';

export interface ToggleProps<S extends ToggleSpec, G extends Gadget<S> & Tappable<S>> {
  /** The toggle gadget instance */
  gadget: G;
  /** Optional CSS class name */
  className?: string;
  /** Display style for the toggle */
  variant?: 'switch' | 'checkbox' | 'button';
  /** Size of the toggle */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to disable the toggle */
  disabled?: boolean;
  /** Optional label to display */
  label?: string;
  /** Position of label relative to toggle */
  labelPosition?: 'left' | 'right';
  /** Optional callback to call when the toggle changes */
  onChange?: (changed: EffectsOf<S>['changed']) => void;
  /** Optional callback to call when the toggle is toggled */
  onToggle?: (toggled: EffectsOf<S>['toggled']) => void;
}

/**
 * Toggle component that binds to a toggle gadget
 *
 * The component automatically:
 * - Syncs with the gadget's state
 * - Sends properly typed commands on interaction
 * - Updates when the gadget state changes
 *
 * @example
 * ```tsx
 * const toggle = toggleGadget(false, 'Dark Mode');
 *
 * function MyComponent() {
 *   return <Toggle
 *     gadget={toggle}
 *     variant="switch"
 *     size="md"
 *     labelPosition="right"
 *   />;
 * }
 * ```
 */
export function Toggle<S extends ToggleSpec, G extends Gadget<S> & Tappable<S>>({
  gadget,
  className = '',
  variant = 'switch',
  size = 'md',
  disabled = false,
  label,
  labelPosition = 'right',
  onChange,
  onToggle,
}: ToggleProps<S, G>) {
  // useGadget gives us perfect type inference
  // state is ToggleState, send accepts ToggleCommands
  const [state, send] = useGadget<S, G>(gadget);
  const displayLabel = label || state.label;

  // Handle toggle with proper type
  const handleToggle = () => {
    send({ toggle: {} } as InputOf<S>);
  }

  useGadgetEffect(gadget, ({ changed, toggled }) => {
    if (changed !== undefined) {
      onChange?.(changed);
    }
    if (toggled !== undefined) {
      onToggle?.(toggled);
    }
  }, [onChange, onToggle]);

  // Get size classes
  const getSizeClass = () => {
    switch (size) {
      case 'sm': return 'toggle-sm';
      case 'lg': return 'toggle-lg';
      default: return 'toggle-md';
    }
  };

  // Render label if provided
  const renderLabel = () => {
    if (!displayLabel) return null;
    return (
      <span className={`toggle-label ${getSizeClass()}`}>
        {displayLabel}
      </span>
    );
  };

  // Render based on variant
  switch (variant) {
    case 'checkbox':
      return (
        <label className={`toggle-checkbox ${className} ${disabled ? 'toggle-disabled' : ''}`}>
          {labelPosition === 'left' && renderLabel()}
          <input
            type="checkbox"
            checked={state.on}
            onChange={handleToggle}
            disabled={disabled}
            className={`checkbox-input ${getSizeClass()}`}
          />
          <span className="checkbox-mark" />
          {labelPosition === 'right' && renderLabel()}
        </label>
      );

    case 'button':
      return (
        <button
          onClick={handleToggle}
          disabled={disabled}
          className={`toggle-button ${className} ${getSizeClass()} ${state.on ? 'toggle-on' : 'toggle-off'} ${disabled ? 'toggle-disabled' : ''}`}
        >
          {displayLabel || (state.on ? 'ON' : 'OFF')}
        </button>
      );

    case 'switch':
    default:
      return (
        <label className={`toggle-switch ${className} ${disabled ? 'toggle-disabled' : ''}`}>
          {labelPosition === 'left' && renderLabel()}
          <div className={`switch-container ${getSizeClass()}`}>
            <input
              type="checkbox"
              checked={state.on}
              onChange={handleToggle}
              disabled={disabled}
              className="switch-input"
            />
            <div className={`switch-slider ${state.on ? 'switch-on' : 'switch-off'}`}>
              <div className="switch-thumb" />
            </div>
          </div>
          {labelPosition === 'right' && renderLabel()}
        </label>
      );
  }
}