/**
 * Built-in Aggregation Definitions
 *
 * Each definition specifies:
 * - initialState: Initial accumulator state (can be function or object)
 * - accumulate: (state, rawValue) => newState - How to update state with new value
 * - reduce: (state) => result - How to compute final result from state
 *
 * Note: accumulate() receives RAW values and must handle parsing/validation itself
 */

export const builtinAggregations = {
  /**
   * SUM - Add all numeric values
   */
  SUM: {
    initialState: { sum: 0 },

    accumulate(state, rawValue) {
      const num = typeof rawValue === 'number' ? rawValue : parseFloat(rawValue);
      if (isNaN(num)) return state;  // Skip invalid values

      return { sum: state.sum + num };
    },

    reduce(state) {
      return state.sum;
    }
  },

  /**
   * COUNT - Count all items (ignores values)
   */
  COUNT: {
    initialState: { count: 0 },

    accumulate(state, rawValue) {
      return { count: state.count + 1 };
    },

    reduce(state) {
      return state.count;
    }
  },

  /**
   * AVG - Average of all numeric values
   */
  AVG: {
    initialState: { sum: 0, count: 0 },

    accumulate(state, rawValue) {
      const num = typeof rawValue === 'number' ? rawValue : parseFloat(rawValue);
      if (isNaN(num)) return state;

      return {
        sum: state.sum + num,
        count: state.count + 1
      };
    },

    reduce(state) {
      return state.count > 0 ? state.sum / state.count : 0;
    }
  },

  /**
   * MIN - Minimum numeric value
   */
  MIN: {
    initialState: { min: Infinity },

    accumulate(state, rawValue) {
      const num = typeof rawValue === 'number' ? rawValue : parseFloat(rawValue);
      if (isNaN(num)) return state;

      return { min: Math.min(state.min, num) };
    },

    reduce(state) {
      return state.min === Infinity ? null : state.min;
    }
  },

  /**
   * MAX - Maximum numeric value
   */
  MAX: {
    initialState: { max: -Infinity },

    accumulate(state, rawValue) {
      const num = typeof rawValue === 'number' ? rawValue : parseFloat(rawValue);
      if (isNaN(num)) return state;

      return { max: Math.max(state.max, num) };
    },

    reduce(state) {
      return state.max === -Infinity ? null : state.max;
    }
  }
};
