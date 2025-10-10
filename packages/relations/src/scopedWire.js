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
        console.log('[scopedWire.step] Called with:', { state, input, hasSource: !!state.source, hasTarget: !!state.target });
        const { source, target } = state;
        if (source && target) {
            console.log('[scopedWire.step] Already wired, returning early');
            return;
        }
        const next = { ...state, ...input };
        console.log('[scopedWire.step] Next state:', { hasSource: !!next.source, hasTarget: !!next.target, hasSourceName: !!next.sourceName, hasTargetName: !!next.targetName });
        if (next.source && next.target) {
            console.log('[scopedWire.step] Setting up tap from source to target');
            const cleanup = next.source.tap((e) => {
                console.log('[scopedWire.tap] Forwarding effect:', e);
                next.target.receive(e);
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
