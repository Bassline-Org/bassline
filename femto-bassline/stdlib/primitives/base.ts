/**
 * Base Gadget interface for all primitive gadgets
 * Defines the standard contract for gadget execution
 */

/**
 * Standard interface for all gadgets in the system
 */
export interface Gadget {
  /** Input pin names */
  inputs: string[];
  
  /** Output pin names */
  outputs: string[];
  
  /** 
   * Activation function - determines if the gadget should execute
   * @param inputs Current values on input pins
   * @returns true if the gadget should execute
   */
  activation: (inputs: Map<string, unknown>) => boolean;
  
  /**
   * Process function - performs the gadget's computation
   * @param inputs Current values on input pins
   * @returns Map of output pin names to computed values
   */
  process: (inputs: Map<string, unknown>) => Map<string, unknown> | Promise<Map<string, unknown>>;
  
  /** Whether this gadget is pure (no side effects) */
  isPure?: boolean;
  
  /** Human-readable description */
  description?: string;
  
  /** Category for organization */
  category?: string;
}

/**
 * Helper to create a gadget that activates when all inputs are present
 */
export function allInputsActivation(requiredInputs: string[]): (inputs: Map<string, unknown>) => boolean {
  return (inputs: Map<string, unknown>) => {
    for (const input of requiredInputs) {
      if (!inputs.has(input) || inputs.get(input) === undefined) {
        return false;
      }
    }
    return true;
  };
}

/**
 * Helper to create a gadget that activates when any input is present
 */
export function anyInputActivation(requiredInputs: string[]): (inputs: Map<string, unknown>) => boolean {
  return (inputs: Map<string, unknown>) => {
    for (const input of requiredInputs) {
      if (inputs.has(input) && inputs.get(input) !== undefined) {
        return true;
      }
    }
    return false;
  };
}

/**
 * Convert value to number with fallback
 */
export function toNumber(value: unknown, fallback: number = 0): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? fallback : parsed;
  }
  if (typeof value === 'boolean') return value ? 1 : 0;
  return fallback;
}

/**
 * Convert value to string
 */
export function toString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  return String(value);
}

/**
 * Convert value to boolean
 */
export function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value.length > 0 && value !== 'false';
  return Boolean(value);
}