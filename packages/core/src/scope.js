const scopeProto = {
    __promises: {},
    async get(name) {
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
            return await val;
        }
    },
    async set(name, value) {
        this[name] = await value;
        for (const resolve of this.__promises[name] || []) {
            resolve(value);
        }
        delete this.__promises[name];
    },
};

export function scope() {
    return Object.create(scopeProto);
}
