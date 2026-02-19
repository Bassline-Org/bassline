export function resource(aResourceModule) {
    let sendTo, r;
    const resourceFn = async (msg) => {
        if (isNil(r)) r = await aResourceModule;
        if (isNil(sendTo)) sendTo = this.utils.send(await r)
        const result = await sendTo(await msg)
        this.announce('resource.fired', { resource: resourceFn, msg, result })
        return result
    }
    resourceFn.mod = aResourceModule;
    this.announce('resource.created')
    return resourceFn
}

export default resource