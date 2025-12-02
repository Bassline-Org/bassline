const watch = (fn) => (sources) => {
    const unsubs = sources.map(s => s.subscribe(fn));
    return () => unsubs.forEach(f => f())
}

const reactive = () => {
    const subs = new Set();
    const notify = (...args) => {
        for (const cb of subs) {
            cb(...args)
        }
    }
    const sub = (cb) => {
        subs.add(cb);
        return () => subs.delete(cb)
    }
    return [notify, sub]
}

const slot = (init) => {
    let value = init;
    const [notify, sub] = reactive();
    return {
        read: () => value,
        write: (newValue) => {
            if (newValue === value) return value;
            value = newValue;
            notify(value)
            return value
        },
        subscribe: sub
    }
}

const coerce = (castFn, predicate) => ({read, write, ...rest}) => ({
    ...rest,
    read: () => {
        const value = read();
        if (predicate(value)) {
            return value
        }
        const casted = castFn(value);
        if (predicate(casted)) {
            return casted;
        }
        return undefined;
    },
    write: (newValue) => {
        const casted = castFn(newValue);
        if (predicate(casted)) {
            write(casted)
        }
    }
})

const asNumber = coerce((val) => Number(val), (val) => !Number.isNaN(val))
const toSet = (val) => {
    if (val instanceof Set) return val;
    if (Array.isArray(val)) return new Set(val)
    return new Set([val])
}
const asSet = coerce(
    toSet,
    (val) => val instanceof Set
)

const cell = (merge) => ({read, write, ...rest}) => {
    return {
        ...rest,
        read,
        write: (newValue) => {
            const merged = merge(read(), newValue);
            merged && write(merged)
        },
        reset: (newValue) => {
            return write(newValue);
        },
    }
}

const propagator = (body) => (...sources) => (...targets) => {
    const compute = () => body(sources)
    const trigger = () => {
        const result = compute();
        console.log('result: ', result)
        targets.forEach(t => t.write(result))
    }
    const shutdown = watch(trigger)(sources);
    trigger()
    return {
        read: compute,
        shutdown,
    }
}

const sumSources = (sources) => sources.map(s => s.read()).reduceRight((a, b) => a + b);
const sum = propagator(sumSources);

const compose = (...fns) => (arg) => fns.reduce((acc, f) => f(acc), arg)
const numericSlot = compose(slot, asNumber)
const setSlot = compose(slot, asSet)
const maxCell = compose(numericSlot, cell(Math.max))

const union = compose(slot, cell((a, b) => a.union(b)), asSet);

const a = maxCell(10)
const b = maxCell(0);
const c = slot(0)
const d = union(undefined);
const prop = sum(a, b)(c, d);

//a.subscribe((val) => console.log('a: ', val));
//b.subscribe((val) => console.log('b:', val));
c.subscribe((val) => console.log("c: ", val));
d.subscribe((val) => console.log("d: ", val));

a.write(15)
b.write(25)

prop.shutdown()

b.write(30)