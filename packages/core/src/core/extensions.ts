import { Gadget, Tappable, TapFn } from "./types";

// @goose: Type guard for tappable gadgets
export function isTappable<S, I, A, E extends Record<string, any>>(
    gadget: Gadget<S, I, A, E>
): gadget is Gadget<S, I, A, E> & Tappable<E> {
    return 'tap' in gadget && typeof gadget.tap === 'function';
}

// @goose: Add tapping capability to a gadget by wrapping its handler
export function withTaps<S, I, A, E extends Record<string, any>>(
    gadget: Gadget<S, I, A, E>
): Gadget<S, I, A, E> & Tappable<E> {
    if (isTappable(gadget)) return gadget;

    const taps = new Set<TapFn<E>>();
    const originalEmit = gadget.emit;

    gadget.emit = (effects: Partial<E>) => {
        originalEmit(effects);
        taps.forEach(fn => fn(effects));
    };

    // Add tap method
    return Object.assign(gadget, {
        tap: (fn: TapFn<E>) => {
            taps.add(fn);
            return () => taps.delete(fn);
        }
    });
}