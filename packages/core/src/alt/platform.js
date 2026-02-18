import { send } from "./utils.js";

export class Platform {
    eventTarget = new EventTarget()
    resource(aResourceModule) {
        const sendTo = send(aResourceModule)
        const resourceFn = msg => {
            const result = sendTo(msg)
            this.announce('resource.fired', { resource: resourceFn, msg, result })
            return result
        }
        resourceFn.mod = aResourceModule;
        this.announce('resource.created', { resource: resourceFn })
        return resourceFn
    }
    announce(topic, message) {
        this?.eventTarget?.dispatchEvent?.(new CustomEvent(topic, { detail: message }));
        return this;
    }
    on(aTopic, aCallback) {
        const cb = e => aCallback(e.detail, e)
        this?.eventTarget?.addEventListener?.(aTopic, cb);
        return () => this?.eventTarget?.removeEventListener?.(aTopic, cb)
    }
    once(aTopic, aCallback) {
        const unsub = this.on(aTopic, (e) => {
            const res = aCallback(e)
            unsub()
            return res;
        })
        return this;
    }
}

export const platform = (opts) => {
    const p = new Platform()
    if (opts) {
        Object.assign(p, opts)
    }
    return p
}

export default platform