export * from "./gadget.js";
import { installBassline } from "./gadget.js";

export function bl() {
    if (globalThis.bassline === undefined) {
        installBassline();
    }
    return globalThis.bassline;
}

/**
 * Installs a package into the running system
 * Packges are objects with a gadgets property
 * The gadgets property is an object with the gadget constructors to install
 * Each constructor must have a pkg property on it's prototype
 * @param {*} gadgetPackage - The package to install
 * @example
 * import { installPackage } from "@bassline/core";
 *
 * const myCellProto = Object.create(bl().gadgetProto);
 * myCellProto.pkg = "my.package";
 *
 * function MyCellConstructor(initial) { ... }
 * MyCellConstructor.prototype = myCellProto;
 * installPackage({
 *     gadgets: {
 *         MyCellConstructor,
 *         MyOtherCellConstructor,
 *     },
 * });
 */
export function installPackage(gadgetPackage) {
    const { gadgets } = gadgetPackage;
    for (const [name, value] of Object.entries(gadgets)) {
        const pkg = value.prototype.pkg;
        // We set the constructor to the value itself so it has the correct name
        value.prototype.constructor = value;
        console.log(`Installing: ${pkg}.${name}`);
        ensurePath(pkg);
        const context = bl().gadgets[pkg];
        context[name] = value;
        console.log(`Installed: ${pkg}.${name}`);
    }
}

function ensurePath(path) {
    if (bl().gadgets[path] === undefined) {
        bl().gadgets[path] = {};
    }
}

export function fromSpec(spec) {
    const { pkg, gadget, state } = spec;
    const construct = bl().gadgets[pkg][gadget];
    const cell = new construct(state);
    return cell;
}

Object.assign(bl().gadgetProto, {
    toSpec() {
        return {
            pkg: this.pkg,
            gadget: this.constructor.name,
            state: this.current(),
        };
    },
});

globalThis.bl = bl;
globalThis.bassline.installPackage = installPackage;
globalThis.bassline.fromSpec = fromSpec;
