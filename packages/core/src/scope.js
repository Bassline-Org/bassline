let __currentScope = null;

export function currentScope() {
    return __currentScope;
}

const scopeProto = {
    __promises: {},
    get(name) {
        const val = this[name];
        if (val === undefined) {
            return new Promise((resolve) => {
                const existing = this.__promises[name];
                if (existing === undefined) {
                    this.__promises[name] = [resolve];
                } else {
                    existing.push(resolve);
                }
            });
        } else {
            return val;
        }
    },
    async set(name, value) {
        this[name] = await value;
        for (const resolve of this.__promises[name] || []) {
            resolve(value);
        }
        delete this.__promises[name];
    },
    enter(fn) {
        const oldScope = currentScope();
        __currentScope = this;
        try {
            fn();
        } finally {
            __currentScope = oldScope;
        }
    },
};

export function scope() {
    return Object.create(scopeProto);
}
