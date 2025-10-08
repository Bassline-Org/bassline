import { bl } from "../../index.js";
import { createScope } from "./scope.js";
import { localRef } from "../refs/localRef.js";

const { gadgetProto, fromSpec } = bl();

const pkg = "@bassline/compound";

export const compound = Object.create(gadgetProto);
Object.assign(compound, {
    pkg,
    name: "compound",

    afterSpawn(spec) {
        const { gadgets, interface: iface } = spec;

        // Create scope (can have parent for nested compounds)
        const scope = createScope(this.parentScope);
        this.scope = scope;

        // Single pass: spawn all gadgets and register in scope
        for (const [name, gadgetSpec] of Object.entries(gadgets || {})) {
            // Expand { ref: "name" } sugar syntax
            const expanded = this.expandRefs(gadgetSpec);
            const gadget = fromSpec(expanded);

            // Register in scope
            scope.set(name, gadget);
        }

        // Second pass: provide scope to localRefs only
        for (const gadget of scope.values()) {
            if (localRef.isPrototypeOf(gadget)) {
                gadget.receive({ scope });
            }
        }

        this.setupInterface(iface);
        this.update({ scope, interface: iface });
    },

    expandRefs(obj) {
        // Sugar: { ref: "name" } → spawned localRef instance with scope
        if (obj?.ref !== undefined) {
            const ref = localRef.spawn({ name: obj.ref });
            // Provide scope immediately
            ref.receive({ scope: this.scope });
            return ref;
        }

        // Recursively expand objects
        if (typeof obj === "object" && obj !== null && !Array.isArray(obj)) {
            return Object.fromEntries(
                Object.entries(obj).map(([k, v]) => [k, this.expandRefs(v)]),
            );
        }

        return obj;
    },

    setupInterface(iface) {
        if (!iface) return;

        // Forward outputs - tap gadgets and re-emit under port names
        for (const [portName, localName] of Object.entries(
            iface.outputs || {},
        )) {
            const gadget = this.scope.get(localName);
            if (gadget?.tap) {
                gadget.tap((effects) => {
                    this.emit({ [portName]: effects });
                });
            }
        }
    },

    receive(input) {
        const { scope, interface: iface } = this.current();
        if (!iface) return;

        // Route to input ports
        for (const [portName, localName] of Object.entries(
            iface.inputs || {},
        )) {
            if (input[portName] !== undefined) {
                const gadget = scope.get(localName);
                if (gadget?.receive) {
                    gadget.receive(input[portName]);
                }
            }
        }
    },

    stateSpec() {
        const { scope, interface: iface } = this.current();
        const gadgets = {};

        for (const [name, gadget] of scope.entries()) {
            gadgets[name] = gadget.toSpec();
        }

        return { gadgets, interface: iface };
    },
});
