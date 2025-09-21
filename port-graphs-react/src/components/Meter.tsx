/**
 * Typed React component for Meter gadgets
 *
 * This component provides a fully typed interface for meter gadgets,
 * with automatic type inference from the MeterSpec.
 */

import React from 'react';
import { type TypedGadget, type MeterSpec, type MeterState, Gadgetish, Tappable, ExtractSpec } from 'port-graphs';
import { useGadget } from '../useGadget';

export interface MeterProps<G, Spec extends ExtractSpec<G>> {
  /** The meter gadget instance */
  gadget: Gadgetish<G> & Tappable<Spec['effects']>;
  /** Optional CSS class name */
  className?: string;
  /** Display style for the meter */
  variant?: 'bar' | 'circle' | 'text';
  /** Whether to show percentage instead of value */
  showPercentage?: boolean;
  /** Color scheme */
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'gradient';
  /** Whether to animate changes */
  animated?: boolean;
}

/**
 * Meter component that displays a meter gadget's value
 *
 * The component automatically:
 * - Syncs with the gadget's state
 * - Updates when the gadget state changes
 * - Displays value with proper formatting
 *
 * @example
 * ```tsx
 * const meter = meterGadget(0, 100, 'CPU Usage');
 *
 * function MyComponent() {
 *   return <Meter
 *     gadget={meter}
 *     variant="bar"
 *     color="gradient"
 *     showPercentage
 *     animated
 *   />;
 * }
 * ```
 */
export function Meter<G, Spec extends ExtractSpec<G> & MeterSpec>(
  {
    gadget,
    className = '',
    variant = 'bar',
    showPercentage = false,
    color = 'blue',
    animated = true
  }: MeterProps<G, Spec>) {
  // useGadget gives us perfect type inference
  // state is MeterState
  const [state] = useGadget<G, Spec>(gadget);

  // Extract typed values from state
  const { value, min, max, label } = state;

  // Calculate percentage (0-100)
  const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

  // Get color class based on prop
  const getColorClass = () => {
    switch (color) {
      case 'green': return 'bg-green-500';
      case 'yellow': return 'bg-yellow-500';
      case 'red': return 'bg-red-500';
      case 'gradient': return 'bg-gradient-to-r from-blue-500 to-green-500';
      default: return 'bg-blue-500';
    }
  };

  // Render based on variant
  switch (variant) {
    case 'circle':
      // SVG circle meter
      const radius = 40;
      const circumference = 2 * Math.PI * radius;
      const strokeDashoffset = circumference - (percentage / 100) * circumference;

      return (
        <div className={`meter-circle ${className}`}>
          {label && <div className="meter-label">{label}</div>}
          <svg width="100" height="100" className="meter-svg">
            <circle
              cx="50"
              cy="50"
              r={radius}
              stroke="#e5e7eb"
              strokeWidth="8"
              fill="none"
            />
            <circle
              cx="50"
              cy="50"
              r={radius}
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className={`${getColorClass()} transition-all ${animated ? 'duration-300' : ''}`}
              style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
            />
          </svg>
          <div className="meter-value">
            {showPercentage ? `${Math.round(percentage)}%` : value}
          </div>
        </div>
      );

    case 'text':
      // Simple text display
      return (
        <div className={`meter-text ${className}`}>
          {label && <span className="meter-label">{label}: </span>}
          <span className={`meter-value ${getColorClass()}`}>
            {showPercentage ? `${Math.round(percentage)}%` : value}
          </span>
          {!showPercentage && <span className="meter-range"> / {max}</span>}
        </div>
      );

    case 'bar':
    default:
      // Horizontal bar meter
      return (
        <div className={`meter-bar ${className}`}>
          {label && <div className="meter-label">{label}</div>}
          <div className="meter-bar-container">
            <div className="meter-bar-background">
              <div
                className={`meter-bar-fill ${getColorClass()} ${animated ? 'transition-all duration-300' : ''}`}
                style={{ width: `${percentage}%` }}
              />
            </div>
            <div className="meter-bar-value">
              {showPercentage ? `${Math.round(percentage)}%` : `${value} / ${max}`}
            </div>
          </div>
        </div>
      );
  }
}