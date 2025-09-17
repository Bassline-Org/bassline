import { Gadget } from "../core";

/**
 * Emit composition utilities
 *
 * Properly compose emit functions without losing the original "void"
 */

/**
 * Compose multiple emit functions into one
 * Each function is called in order with the effect
 */
export function composeEmit<Effect>(
  ...emitters: Array<(effect: Effect) => void>
): (effect: Effect) => void {
  return (effect: Effect) => {
    emitters.forEach(emit => emit(effect));
  };
}

/**
 * Add a new emit target while preserving existing ones
 */
export function addEmitTarget<Effect>(
  gadget: Gadget<any, any, Effect>,
  target: (effect: Effect) => void
): void {
  const originalEmit = gadget.emit;
  gadget.emit = composeEmit(originalEmit, target);
}

/**
 * Wire one gadget to emit to another's receive
 * Preserves existing emit targets
 */
export function wireEmitToReceive<FromEffect, ToIncoming>(
  from: Gadget<any, any, FromEffect>,
  to: Gadget<any, ToIncoming, any>,
  transform?: (effect: FromEffect) => ToIncoming
) {
  addEmitTarget(from, (effect: FromEffect) => {
    if (effect !== null && effect !== undefined) {
      const data = transform ? transform(effect) : effect as unknown as ToIncoming;
      to.receive(data);
    }
  });
}

/**
 * Filter effects before emitting
 */
export function filterEmit<Effect>(
  gadget: Gadget<any, any, Effect>,
  predicate: (effect: Effect) => boolean
): void {
  const originalEmit = gadget.emit;
  gadget.emit = (effect: Effect) => {
    if (predicate(effect)) {
      originalEmit(effect);
    }
  };
}

/**
 * Transform effects before emitting
 */
export function transformEmit<EffectIn, EffectOut>(
  gadget: Gadget<any, any, EffectIn>,
  transform: (effect: EffectIn) => EffectOut
): void {
  const originalEmit = gadget.emit;
  gadget.emit = (effect: EffectIn) => {
    const transformed = transform(effect);
    (originalEmit as any)(transformed);
  };
}

/**
 * Broadcast effects to multiple targets
 */
export function broadcastEmit<Effect>(
  from: Gadget<any, any, Effect>,
  targets: Array<Gadget<any, any, any>>
): void {
  addEmitTarget(from, (effect: Effect) => {
    targets.forEach(target => target.receive(effect as any));
  });
}

/**
 * Route effects based on type
 */
export function routeEmit<Effect extends { type: string }>(
  from: Gadget<any, any, Effect>,
  routes: Record<string, Gadget<any, any, any>>
): void {
  addEmitTarget(from, (effect: Effect) => {
    const target = routes[effect.type];
    if (target) {
      target.receive(effect as any);
    }
  });
}

/**
 * Create a bidirectional connection preserving existing emits
 */
export function wireBidirectional<State1, State2>(
  gadget1: Gadget<State1, State2, any>,
  gadget2: Gadget<State2, State1, any>
) {
  wireEmitToReceive(gadget1, gadget2, (e: any) => {
    // Extract value from standard effect format
    if (e && typeof e === 'object' && 'changed' in e) {
      return e.changed;
    }
    return e;
  });

  wireEmitToReceive(gadget2, gadget1, (e: any) => {
    if (e && typeof e === 'object' && 'changed' in e) {
      return e.changed;
    }
    return e;
  });
}

/**
 * Log effects without interrupting flow
 */
export function tapEmit<Effect>(
  gadget: Gadget<any, any, Effect>,
  tap: (effect: Effect) => void
): void {
  const originalEmit = gadget.emit;
  gadget.emit = (effect: Effect) => {
    tap(effect);
    originalEmit(effect);
  };
}