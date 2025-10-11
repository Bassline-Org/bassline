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

        // Accept port-based configuration (new way)
        if (input.sourcePort && typeof input.sourcePort === 'string') {
            valid.sourcePort = input.sourcePort;
            isValid = true;
        }
        if (input.targetPort && typeof input.targetPort === 'string') {
            valid.targetPort = input.targetPort;
            isValid = true;
        }

        // Accept keys configuration (old way, backwards compat)
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
        console.log('[scopedWire.step] Called with:', { state, input, hasSource: !!state.source, hasTarget: !!state.target, sourcePort: input.sourcePort, targetPort: input.targetPort, keys: input.keys });

        const { source, target } = state;

        // If already wired and only configuration changed, just update state
        if (source && target && (input.keys !== undefined || input.sourcePort !== undefined || input.targetPort !== undefined)) {
            console.log('[scopedWire.step] Already wired, updating configuration only');
            this.update({ ...state, ...input });
            return;
        }

        // If already wired with source/target, ignore other inputs
        if (source && target) {
            console.log('[scopedWire.step] Already wired, ignoring input');
            return;
        }

        const next = { ...state, ...input };
        console.log('[scopedWire.step] Next state:', {
            hasSource: !!next.source,
            hasTarget: !!next.target,
            hasSourceName: !!next.sourceName,
            hasTargetName: !!next.targetName,
            sourcePort: next.sourcePort,
            targetPort: next.targetPort,
            keys: next.keys
        });

        if (next.source && next.target) {
            console.log('[scopedWire.step] Setting up tap from source to target');
            const cleanup = next.source.tap((effects) => {
                const { sourcePort, targetPort, keys } = this.current();

                // Port-based extraction (new way)
                if (sourcePort) {
                    const value = effects[sourcePort];
                    console.log('[scopedWire.tap] Port extraction:', { sourcePort, value, targetPort });

                    if (value !== undefined) {
                        if (targetPort) {
                            // Check if target has single-value input (inputs is a string/primitive)
                            // vs multi-field input (inputs is an object)
                            const targetInputs = next.target.inputs;
                            const isSingleValueInput = typeof targetInputs !== 'object' || targetInputs === null;

                            if (isSingleValueInput) {
                                // Single-value input: send raw value (e.g., max cell, inc function)
                                console.log('[scopedWire.tap] Single-value input, sending raw:', value);
                                next.target.receive(value);
                            } else {
                                // Multi-field input: wrap as named field (e.g., add function)
                                console.log('[scopedWire.tap] Multi-field input, sending as field:', { [targetPort]: value });
                                next.target.receive({ [targetPort]: value });
                            }
                        } else {
                            // Send raw value
                            console.log('[scopedWire.tap] Sending raw value:', value);
                            next.target.receive(value);
                        }
                    }
                }
                // Keys-based extraction (old way, backwards compat)
                else if (keys && Array.isArray(keys) && keys.length > 0) {
                    const filtered = {};
                    keys.forEach(key => {
                        if (effects[key] !== undefined) {
                            filtered[key] = effects[key];
                        }
                    });
                    // Only forward if we have matching keys
                    if (Object.keys(filtered).length > 0) {
                        // Extract value if single key, otherwise forward filtered object
                        const toForward = keys.length === 1 ? filtered[keys[0]] : filtered;
                        console.log('[scopedWire.tap] Keys extraction, forwarding:', toForward);
                        next.target.receive(toForward);
                    } else {
                        console.log('[scopedWire.tap] No matching keys in effect:', effects, 'keys:', keys);
                    }
                }
                // No extraction - forward everything
                else {
                    console.log('[scopedWire.tap] Forwarding all effects:', effects);
                    next.target.receive(effects);
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
