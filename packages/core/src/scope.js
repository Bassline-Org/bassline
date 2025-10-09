const scopeProto = {
    __promises: {},
    async get(name) {
        const val = this[name];
        if (val === undefined) {
            this[name] = new Promise((resolve) => {
                const existing = this.__promises[name];
                if (existing === undefined) {
                    this.__promises[name] = [resolve];
                } else {
                    existing.push(resolve);
                }
            });
        }
        return await this[name];
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
