import { gadgetProto } from "./gadget.js";
import { scope } from "./scope.js";

export function installBassline() {
    if (globalThis.bassline === undefined) {
        globalThis.bl = bl;
        globalThis.bassline = {
            gadgetProto,
            installPackage,
            fromSpec,
            packages: scope(),
        };
    }
}

export function bl() {
    if (globalThis.bassline === undefined) {
        installBassline();
    }
    return globalThis.bassline;
}

/**
 * Installs a package into the running system
 * Packges are objects with an optional gadgets property
 * The gadgets property is an object with the gadget constructors to install
 * Each constructor must have a pkg property on it's prototype
 * @param {*} gadgetPackage - The package to install
 * @example
 * import { installPackage } from "@bassline/core";
 *
 * const myCell = Object.create(bl().gadgetProto);
 * Object.assign(myCell, {
 *     pkg: "my.package",
 *     name: "myCell",
 *     step(c, i) { ... }
 * });
 *
 * installPackage({
 *     gadgets: {
 *         myCell
 *     },
 * });
 */
export function installPackage(gadgetPackage) {
    if (globalThis.bassline === undefined) {
        installBassline();
    }

    const { gadgets } = gadgetPackage;
    console.log(`Installing...`);
    let lastPkg;
    for (const value of Object.values(gadgets)) {
        const pkg = value.pkg;
        const name = value.name;
        const key = `${pkg}/${name}`;
        if (pkg !== lastPkg) {
            console.log(`Installing ${pkg}:`);
            lastPkg = pkg;
        }
        console.log(`  ${name}`);
        bl().packages.set(key, value);
    }
    console.log("Done!");
}

/**
 * Creates a gadget from a spec
 * @param {Object|Array} spec - Gadget spec or array of specs
 * @param {Object} resolver - Package resolver for type resolution (optional)
 * @returns {Object|Array} Spawned gadget(s)
 *
 * Supports two spec formats:
 * - Long form: { pkg: "@bassline/cells", name: "max", state: 0 }
 * - Short form: { type: "cells.max", state: 0 }
 */
export async function fromSpec(spec, resolver = bl().packages) {
    if (Array.isArray(spec)) {
        return await Promise.all(spec.map((s) => fromSpec(s, resolver)));
    }

    const { pkg, name, state, id } = spec;

    if (!name) {
        throw new Error(
            `Name is required for spec: ${JSON.stringify(spec)}`,
        );
    }
    if (!pkg) {
        throw new Error(
            `Pkg is required for spec: ${JSON.stringify(spec)}`,
        );
    }

    const key = `${pkg}/${name}`;
    const proto = await bl().packages.get(key);
    if (!proto) {
        throw new Error(`Gadget ${key} not found! Did you install it?`);
    }

    const g = proto.spawn(state);

    if (id && globalThis.bassline.registry !== undefined) {
        g._setId(id);
    }

    return g;
}
