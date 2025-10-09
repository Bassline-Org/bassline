// Utility function for resolving gadgets by ID from global registry
export function getGadgetById(id) {
    const entry = globalThis.bassline?.registry?.get(id);
    return entry instanceof WeakRef ? entry.deref() : entry;
}
