import { send, isNil } from "../utils.js";

export function resource(aResourceModule) {
    let sendTo, r;
    const resourceFn = async (msg) => {
        if (isNil(r)) r = await aResourceModule;
        if (isNil(sendTo)) sendTo = send(await r)
        const result = await sendTo(await msg)
        this.announce('resource.fired', { resource: resourceFn, msg, result })
        return result
    }
    resourceFn.mod = mod;
    this.announce('resource.created')
    return resourceFn
}

export default resource