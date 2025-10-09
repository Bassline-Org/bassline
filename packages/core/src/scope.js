let __currentScope = null;

export function currentScope() {
    return __currentScope;
}

const scopeProto = {
    __promises: {},
    get(name) {
        const val = this[name];
        if (val === undefined) {
            const existing = this.__promises[name];
            if (existing) {
                return existing;
            } else {
                const p = new Promise((resolve) => {
                    this.__promises[name] = resolve;
                }).then((v) => {
                    this[name] = v;
                    delete this.__promises[name];
                    return v;
                });
                this.__promises[name] = p;
                return p;
            }
        } else {
            return val;
        }
    },
    set(name, value) {
        if (value instanceof Promise) {
            return value.then((v) => this.set(name, v));
        }

        const resolver = this.__promises[name];
        if (typeof resolver === "function") {
            resolver(value);
            return value;
        }
        this[name] = value;
    },
    enter(fn) {
        const oldScope = currentScope();
        __currentScope = this;
        const result = fn();
        if (result instanceof Promise) {
            return result.then((v) => {
                __currentScope = oldScope;
                return v;
            });
        }
        __currentScope = oldScope;
        return result;
    },
};

export function scope() {
    return Object.create(scopeProto);
}
