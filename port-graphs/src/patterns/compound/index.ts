/**
 * Compound gadget patterns
 *
 * These helpers use tapping to compose gadgets into larger structures
 * while maintaining the simple gadget protocol.
 */

export { pipeline, broadcast, collect } from './pipeline';

// Re-export the basic pipeline from createFn approach for comparison
// This shows that compound gadgets can be built multiple ways
import { Gadget } from "../../core";
import { createFn } from "../functions";

type PipelineArgs = {
  stages: Gadget[];
  incoming: any;
};

/**
 * Alternative pipeline using function gadget pattern
 *
 * This approach treats the pipeline as a function that computes
 * by threading data through gadgets. However, it has limitations:
 * - Can't capture effects from intermediate stages
 * - Requires gadgets to return values somehow
 */
export const functionalPipeline = createFn(({ stages, incoming }: PipelineArgs) => {
  return stages.reduce((acc, stage) => {
    stage.receive(acc);
    return stage.current(); // Get the processed result
  }, incoming);
}, ['stages', 'incoming']);