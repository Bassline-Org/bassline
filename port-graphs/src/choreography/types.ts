/**
 * Choreography format types
 *
 * Minimal specification for gadget networks as pure data
 */

/**
 * Core choreography structure
 */
export interface Choreography {
  /**
   * Gadget definitions - what gadgets exist and their initial state
   */
  gadgets: {
    [id: string]: {
      /**
       * Gadget type from the registry (e.g., 'maxCell', 'pubsub')
       */
      type: string;

      /**
       * Initial arguments passed to the gadget factory
       * This is the ONLY configuration - everything else is emergent
       */
      initial?: any;
    }
  };

  /**
   * Bootstrap messages sent after gadgets are created
   * Used to set up initial routing, state, etc.
   */
  bootstrap?: Array<{
    /**
     * Target gadget ID to receive the data
     */
    to: string;

    /**
     * Data to send to the gadget's receive method
     */
    data: any;
  }>;
}

/**
 * Factory function for creating gadgets
 */
export type GadgetFactory<T = any> = (initial?: T) => any;

/**
 * Registry mapping type names to factory functions
 */
export type GadgetRegistry = Record<string, GadgetFactory>;