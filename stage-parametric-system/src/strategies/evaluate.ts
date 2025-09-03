import { MetaEnv } from '../types';

/**
 * Default evaluation strategy - direct execution
 * This is the base strategy that all others fall back to
 */
export const evaluateStrategy: MetaEnv = {
  // All functions fall back to their original implementations
  // This strategy doesn't override anything - it's the baseline
};