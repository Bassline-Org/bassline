import { Tappable } from "@bassline/core";
import { useCallback, useEffect } from "react";

export function useTap<G, E extends Record<string, unknown>>(gadget: G & Tappable<E>, callback: (effects: Partial<E>) => void) {
    useEffect(() => {
        console.log("useTap setup");
        const cleanup = gadget.tap(callback);
        return () => {
            console.log("useTap cleanup");
            cleanup();
        }
    }, [gadget, callback]);
}