/**
 * Constraint gadgets for enforcing rules between connected gadgets
 */

import { createGadget } from '../../core';
import { changed } from '../../effects';

export interface ConstraintRule<T = any> {
  name: string;
  check: (values: Record<string, T>) => boolean;
  message?: string;
}

export interface ConstraintViolation {
  rule: string;
  message: string;
  values: Record<string, any>;
}

/**
 * Basic constraint gadget that checks rules against connected values
 */
export function createConstraintGadget<T = any>(rules: ConstraintRule<T>[]) {
  type State = {
    values: Record<string, T>;
    violations: ConstraintViolation[];
    satisfied: boolean;
  };

  return createGadget<State, Record<string, T>>(
    (current, incoming) => {
      // Merge incoming values with current state
      const newValues = { ...current.values, ...incoming };

      // Check all rules
      const violations: ConstraintViolation[] = [];
      for (const rule of rules) {
        if (!rule.check(newValues)) {
          violations.push({
            rule: rule.name,
            message: rule.message || `Constraint '${rule.name}' violated`,
            values: newValues
          });
        }
      }

      const satisfied = violations.length === 0;
      const violationsChanged = violations.length !== current.violations.length ||
        violations.some((v, i) => v.rule !== current.violations[i]?.rule);

      if (!violationsChanged && satisfied === current.satisfied) {
        return null; // No change
      }

      return {
        action: 'update',
        context: { values: newValues, violations, satisfied }
      };
    },
    {
      'update': (gadget, { values, violations, satisfied }) => {
        gadget.update({ values, violations, satisfied });
        return changed({ violations, satisfied, values });
      }
    }
  )({ values: {}, violations: [], satisfied: true });
}

/**
 * Range constraint: ensures a value stays within min/max bounds
 */
export function rangeConstraint(key: string, min: number, max: number): ConstraintRule<number> {
  return {
    name: `${key}_range`,
    check: (values) => {
      const value = values[key];
      return value == null || (value >= min && value <= max);
    },
    message: `${key} must be between ${min} and ${max}`
  };
}

/**
 * Comparison constraint: ensures one value is greater/less than another
 */
export function comparisonConstraint(
  key1: string,
  operator: '>' | '<' | '>=' | '<=',
  key2: string
): ConstraintRule<number> {
  return {
    name: `${key1}_${operator}_${key2}`,
    check: (values) => {
      const val1 = values[key1];
      const val2 = values[key2];
      if (val1 == null || val2 == null) return true;

      switch (operator) {
        case '>': return val1 > val2;
        case '<': return val1 < val2;
        case '>=': return val1 >= val2;
        case '<=': return val1 <= val2;
        default: return true;
      }
    },
    message: `${key1} must be ${operator} ${key2}`
  };
}

/**
 * Required constraint: ensures certain keys have values
 */
export function requiredConstraint(...keys: string[]): ConstraintRule {
  return {
    name: `required_${keys.join('_')}`,
    check: (values) => keys.every(key => values[key] != null),
    message: `Required fields: ${keys.join(', ')}`
  };
}

/**
 * Custom constraint from a function
 */
export function customConstraint<T>(
  name: string,
  checkFn: (values: Record<string, T>) => boolean,
  message?: string
): ConstraintRule<T> {
  return {
    name,
    check: checkFn,
    message: message || ''
  };
}

/**
 * Boundary gadget - enforces min <= current <= max constraint
 * Automatically adjusts values to maintain the constraint
 */
export function createBoundaryGadget(initialMin = 0, initialCurrent = 50, initialMax = 100) {
  type BoundaryState = { min: number; current: number; max: number };

  return createGadget<BoundaryState, Partial<BoundaryState>>(
    (current, incoming) => {
      let { min, max, current: value } = { ...current, ...incoming };

      // Enforce constraints by adjusting values
      let changed = false;

      // Ensure min <= max
      if (min > max) {
        max = min;
        changed = true;
      }

      // Ensure min <= current <= max
      if (value < min) {
        value = min;
        changed = true;
      }
      if (value > max) {
        value = max;
        changed = true;
      }

      // Check if anything actually changed
      if (!changed &&
        min === current.min &&
        max === current.max &&
        value === current.current) {
        return null;
      }

      return {
        action: 'enforce',
        context: { min, current: value, max }
      };
    },
    {
      'enforce': (gadget, newState) => {
        gadget.update(newState);
        return changed(newState);
      }
    }
  )({ min: initialMin, current: initialCurrent, max: initialMax });
}