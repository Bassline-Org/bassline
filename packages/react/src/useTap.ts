import { Tappable } from "@bassline/core";
import { useCallback, useEffect } from "react";

export function useTap<G, E extends Record<string, unknown>>(gadget: G & Tappable<E>, callback: (effects: Partial<E>) => void) {
    useEffect(() => {
        return gadget.tap(callback);
    }, [gadget, callback]);
}