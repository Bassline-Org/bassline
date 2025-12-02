const log = (msg) => (v) => console.log(`${msg} `, v)

/**
 * @typedef { { fire: (v: any) => void, watch: (...callbacks: Function[]) => () => void} } Joint
 * @typedef { { watch: Joint['watch'] } } Watch
 * @typedef { (T) & Watch } WatchedFn<T>
 */
const joint = () => {
    const subs = new Set()
    const watch = (...callbacks) => {
        callbacks.forEach(cb => subs.add(cb));
        return () => callbacks.forEach(cb => subs.remove(cb));
    }
    const fire = (value) => {
        subs.forEach(f => f(value))
        return value;
    }
    return { fire, watch }
}

/**
 * 
 * @type { (val: any, fire: Joint['fire']) => (target: Joint) => Watch }
 */
const trigger = fn => target => {
    const {fire, watch} = target;
    const wrapped = (val) => fn(val, fire)
    wrapped.watch = watch;
    return wrapped;
}

/**
 * @type { (fn: Function) => (source: Joint) => Watch }
 */
const flow = fn => source => {
    const { pub, sub } = trigger();
    const disable = source.sub((v) => pub(fn(v)))
    fn.sub = sub
    fn.disable = disable
    return fn
}

/**
 * @type { (init: any) => { read: WatchedFn<() => any>, write: WatchedFn<(newValue: any) => void> } }
 */
const slot = (init) => {
    let value = init;
    const j = joint()
    const write = trigger(v => {
        value = v;
        return value
    })(j);
    const read = flow(() => value)(j)
    return { read, write }
}

const sum = (write) => {
    let s = 0;
    return reaction(write)(v => {
        s += v;
        return s
    })
}

const {read, write} = slot(0);
const s = sum(write);
s.sub(log('sum:'))

write(5);
write(10);
write(25)