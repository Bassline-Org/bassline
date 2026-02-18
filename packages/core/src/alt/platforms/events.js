export function withEvents(platform) {
    return {
        ...platform,
        eventTarget: new EventTarget()
    }
}