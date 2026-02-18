export default function (p) {
    function reducer({ reduce, value }) {
        const r = p.resource({
            reduce,
            value,
            get() {
                return this.value
            },
            put(current) {
                const previous = this.value
                const reduced = this.reduce({ previous, current });
                if (reduced !== previous) {
                    this.value = reduced;
                    p.announce('resource.changed', { resource: r, previous, current: reduced })
                }
                return this.value
            }
        })
        return r
    }

    function connector() {
        const r = p.resource({
            nodes: new Map(),
            has(aNode) {
                return this.nodes.has(aNode)
            },
            connected(source, target) {
                return this.has(source)
                    && this.has(target)
                    && this.nodeFor(source).outgoing.has(target)
            },
            nodeFor(aNode) {
                if (!this.has(aNode)) {
                    this.nodes.set(aNode, { incoming: new Set(), outgoing: new Set() })
                }
                return this.nodes.get(aNode)
            },
            connect(from, to) {
                this.nodeFor(from).outgoing.add(to)
                this.nodeFor(to).incoming.add(from);
                p.announce('resource.connected', { resource: r, from, to })
            },
            disconnect(from, to) {
                if (!(this.has(from) && this.has(to))) return;
                this.nodeFor(from).outgoing.delete(to)
                this.nodeFor(to).incoming.delete(from);
                p.announce('resource.disconnected', { resource: r, from, to })
            },
            remove(aNode) {
                if (!this.has(aNode)) return;
                for (const { incoming, outgoing } of this.nodes.values()) {
                    for (const input of incoming)
                        this.disconnect(input, aNode);
                    for (const output of outgoing)
                        this.disconnect(aNode, output);
                }
                this.nodes.delete(aNode)
                return aNode;
            },
            get({ from, to, has, connections }) {
                if (from || to) {
                    const values = []
                    for (const [node, { incoming, outgoing }] of this.nodes) {
                        if ((from && incoming.has(from))
                            || (to && outgoing.has(to))) {
                            values.push(node)
                        }
                    }
                    return values
                }
                if (has) return this.has(has)
                if (connections) return this.nodes.entries()
            },
            put({
                from, fromAll = [from],
                to, toAll = [to],
                remove, removeAll = [remove]
            }, { disconnect, bi }) {
                const sources = fromAll.filter(Boolean);
                const targets = toAll.filter(Boolean);
                for (const source of sources) {
                    for (const target of targets) {
                        if (disconnect) {
                            this.disconnect(source, target)
                            if (bi) this.disconnect(target, source)
                        } else {
                            this.connect(source, target)
                            if (bi) this.connect(target, source)
                        }
                    }
                }
                const removals = removeAll.filter(Boolean);
                for (const removal of removals) {
                    this.remove(removal)
                }
            }
        })
        return r
    }

    function broadcast({ targets }) {
        return p.resource({
            targets,
            get(msg) {
                return this.targets.map(r => r(msg))
            },
            put(body, msg) {
                return this.targets.map(r => r({ put: body, ...msg }))
            }
        })
    }

    return {
        slot({ value } = {}) {
            return reducer({ value, reduce: ({ current }) => current })
        },
        reducer,
        broadcast,
        connector
    }
}