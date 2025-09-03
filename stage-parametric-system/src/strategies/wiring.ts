import { MetaEnv, Expression } from '../types';

/**
 * Wiring strategy - handles reactive system wiring during construction
 */
export const wiringStrategy: MetaEnv = {
  wire: (source: any, target: any): void => {
    console.log(`[WIRING] Connecting ${source} to ${target}`);
    
    // Add target to source's downstream set
    if (source && typeof source === 'object' && 'downstream' in source) {
      source.downstream.add(target);
    }
  },
  
  into: (source: any, target: any): any => {
    console.log(`[WIRING] Explicit wiring: ${source} into ${target}`);
    
    // Add target to source's downstream and immediately call target with source's value
    if (source && typeof source === 'object' && 'downstream' in source) {
      source.downstream.add(target);
      if (typeof target === 'function' && 'value' in source) {
        target(source.value());
      }
    }
    
    return target;
  },
  
  gadget: (body: Expression): any => {
    console.log(`[WIRING] Creating gadget with expression body`);
    
    // Create a gadget that will be wired when called
    const gadget = {
      body,
      downstream: new Set(),
      isWired: false,
      isGadget: true,
      
      // This will be called during wiring phase
      enterWiringMode: (fn?: () => void) => {
        if (gadget.isWired) return;
        console.log(`[WIRING] Entering wiring mode for gadget`);
        if (fn) fn();
        gadget.isWired = true;
      }
    };
    
    return gadget;
  },
  
  cell: (mergeFn: any, initialValue?: any): any => {
    console.log(`[WIRING] Creating cell with mergeFn:`, mergeFn);
    
    const cell = {
      mergeFn,
      initialValue,
      downstream: new Set(),
      isWired: false,
      isGadget: false,
      currentValue: initialValue
    };
    
    return cell;
  }
};
