export interface Gadget<TIn = unknown> {
  receive(data: TIn): void;
}

export type Protocol<TIn, TApply = unknown, TConsider = unknown> = {
  apply: (data: TIn) => TApply | null;
  consider: (result: TApply) => TConsider | null;
  act: (result: TConsider, gadget: Gadget<TIn>) => void;
}

/**
 * Creates a protocol function
 * @param apply - The function to apply to the data
 * @param consider - The function to consider the result
 * @param act - The function to act on the result
 * @returns A protocol function
 */
export function protocol<G extends Gadget<TIn>, TIn, TApply, TConsider>(
  apply: (data: TIn) => TApply | null,
  consider: (result: TApply) => TConsider | null,
  act: (result: TConsider, gadget: G) => void
): (this: G, data: TIn) => void {
  return function(this: G, data: TIn): void {
    const result = apply(data);
    if (result == null) return;
    
    const decision = consider(result);
    if (decision == null) return;
    
    act(decision, this);
  };
}