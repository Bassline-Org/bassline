import { bl } from "@bassline/core";

const { gadgetProto } = bl();

export const scopedWire = Object.create(gadgetProto);
Object.assign(scopedWire, {
    pkg: "@bassline/relations",
    name: "scopedWire",

    validate(input) {
        const valid = {};
        let isValid = false;

        // Accept gadget refs (for runtime)
        if (input.source) {
            if (gadgetProto.isPrototypeOf(input.source)) {
                valid.source = input.source;
                isValid = true;
            }
        }
        if (input.target) {
            if (gadgetProto.isPrototypeOf(input.target)) {
                valid.target = input.target;
                isValid = true;
            }
        }

        // Accept name strings (for serialization/canvas)
        if (input.sourceName && typeof input.sourceName === 'string') {
            valid.sourceName = input.sourceName;
            isValid = true;
        }
        if (input.targetName && typeof input.targetName === 'string') {
            valid.targetName = input.targetName;
            isValid = true;
        }

        // Accept keys configuration
        if (input.keys !== undefined) {
            valid.keys = input.keys;
            isValid = true;
        }

        if (isValid) {
            return valid;
        } else {
            return undefined;
        }
    },

    afterSpawn(initial) {
        // IMPORTANT: Call receive instead of update so that step() runs and sets up the tap
        this.update({});  // Initialize to empty state first
        this.receive(initial);  // Then receive the initial state to trigger step()
    },

    step(state = {}, input) {
        console.log('[scopedWire.step] Called with:', { state, input, hasSource: !!state.source, hasTarget: !!state.target, keys: input.keys });

        const { source, target } = state;

        // If already wired and only keys changed, just update state
        if (source && target && input.keys !== undefined) {
            console.log('[scopedWire.step] Already wired, updating keys only');
            this.update({ ...state, keys: input.keys });
            return;
        }

        // If already wired with source/target, ignore other inputs
        if (source && target) {
            console.log('[scopedWire.step] Already wired, ignoring input');
            return;
        }

        const next = { ...state, ...input };
        console.log('[scopedWire.step] Next state:', { hasSource: !!next.source, hasTarget: !!next.target, hasSourceName: !!next.sourceName, hasTargetName: !!next.targetName, keys: next.keys });

        if (next.source && next.target) {
            console.log('[scopedWire.step] Setting up tap from source to target');
            const cleanup = next.source.tap((e) => {
                const keys = this.current().keys;

                // Filter effects based on keys configuration
                if (keys && Array.isArray(keys) && keys.length > 0) {
                    const filtered = {};
                    keys.forEach(key => {
                        if (e[key] !== undefined) {
                            filtered[key] = e[key];
                        }
                    });
                    // Only forward if we have matching keys
                    if (Object.keys(filtered).length > 0) {
                        console.log('[scopedWire.tap] Forwarding filtered effect:', filtered);
                        next.target.receive(filtered);
                    } else {
                        console.log('[scopedWire.tap] No matching keys in effect:', e, 'keys:', keys);
                    }
                } else {
                    // No keys specified → forward everything
                    console.log('[scopedWire.tap] Forwarding all effects:', e);
                    next.target.receive(e);
                }
            });
            this.update(next);
            this.cleanup = cleanup;
        } else {
            console.log('[scopedWire.step] Missing source or target, not setting up tap');
        }
    },

    onKill() {
        this.cleanup?.();
        this.update({});
    },
});

export default {
    gadgets: {
        scopedWire,
    },
};
