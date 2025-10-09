import { gadgetProto } from "@bassline/core";
import { installTaps } from "@bassline/taps";
//import { installMetadata } from "@bassline/core/metadata";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

export function useLocalGadget(factory) {
    const gadget = useMemo(factory, []);
    return [gadget.useCurrent(), gadget.useSend()];
}

export function installReact() {
    if (gadgetProto["useCurrent"] !== undefined) {
        return;
    }

    installTaps();
    //installMetadata();

    Object.assign(gadgetProto, {
        useCurrent() {
            const snapshot = useSyncExternalStore(
                (callback) => {
                    const cleanup = this.tapOn("changed", (_change) => {
                        callback();
                    });
                    return cleanup;
                },
                () => this.current(),
            );
            return snapshot;
        },
        useSend() {
            const send = useCallback((value) => {
                this.receive(value);
            }, [this]);
            return send;
        },
        useComputed(fn) {
            const current = this.useCurrent();
            const computed = useMemo(() => fn(current), [current]);
            return computed;
        },
        useState() {
            const current = this.useCurrent();
            const send = this.useSend();
            return [current, send];
        },
        useTap(fn) {
            useEffect(() => {
                return this.tap(fn);
            }, [this, fn]);
        },
        useMetadata() {
            const metadata = this.useCurrent();
            return metadata;
        },
    });
}
