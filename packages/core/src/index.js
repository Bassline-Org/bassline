export * from "./gadget.js";
export * from "./packageLoader.js";
export * from "./packageExporter.js";
export * from "./packageResolver.js";
import { installBassline } from "./gadget.js";
import { defaultPackageResolver } from "./packageResolver.js";

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
    const { gadgets } = gadgetPackage;
    console.log(`Installing...`);
    let lastPkg;
    for (const value of Object.values(gadgets)) {
        const pkg = value.pkg;
        const name = value.name;
        if (pkg !== lastPkg) {
            console.log(`Installing ${pkg}:`);
            lastPkg = pkg;
        }
        console.log(`  ${name}`);
        ensurePath(pkg);
        const context = bl().packages[pkg];
        context[name] = value;
    }
    console.log("Done!");
}

function ensurePath(path) {
    if (bl().packages[path] === undefined) {
        bl().packages[path] = {};
    }
}

/**
 * Creates a gadget from a spec
 * @param {Object|Array} spec - Gadget spec or array of specs
 * @param {Object} resolver - Package resolver for type resolution (optional)
 * @returns {Object|Array} Spawned gadget(s)
 *
 * Supports two spec formats:
 * - Long form: { pkg: "@bassline/cells", name: "max", state: 0 }
 * - Short form: { type: "cells.max", state: 0 } (requires imports in resolver)
 */
export function fromSpec(spec, resolver = defaultPackageResolver) {
    if (Array.isArray(spec)) {
        return spec.map((s) => fromSpec(s, resolver));
    }

    let pkg, name;
    const { state, id } = spec;

    // Short form: { type: "cells.max", state: ... }
    if (spec.type) {
        try {
            ({ pkg, name } = resolver.resolve(spec.type));
        } catch (error) {
            throw new Error(
                `Could not resolve type "${spec.type}": ${error.message}`,
            );
        }
    } // Long form: { pkg: "...", name: "...", state: ... }
    else {
        pkg = spec.pkg;
        name = spec.name;

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
    }

    const pkgContext = bl().packages[pkg];
    if (!pkgContext) {
        throw new Error(`Package ${pkg} not found! Did you install it?`);
    }

    const proto = pkgContext[name];
    if (!proto) {
        throw new Error(
            `Gadget ${name} not found in package ${pkg}! Did you install it?`,
        );
    }

    const g = proto.spawn(state);
    if (id && globalThis.bassline.registry !== undefined) {
        g._setId(id);
    }

    return g;
}

Object.assign(bl().gadgetProto, {
    toSpec() {
        return {
            pkg: this.pkg,
            name: this.name,
            state: this.stateSpec(),
        };
    },
    stateSpec() {
        return this.current();
    },
});

globalThis.bl = bl;
globalThis.bassline.installPackage = installPackage;
globalThis.bassline.fromSpec = fromSpec;
