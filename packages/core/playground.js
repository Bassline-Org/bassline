import base from './src/alt/platform.js'
import core from "./src/alt/modules/core.js"

const platform = base()

const { slot, connector } = core(platform)

platform.id = 0;
platform.on('resource.created', ({ resource }) => {
    resource.id = platform.id++;
})
platform.on('resource.connected', ({ from, to }) => {
    console.log(`\nconnected ${from.id} -> ${to.id}`)
})
platform.on('resource.changed', ({ resource, previous, current }) => {
    console.log(`\n${resource.id} changed from: ${previous} to: ${current}`)
})

const a = slot({ value: 123 })
const b = slot({ value: 69 })
const c = slot({ value: 69 })

const graph = connector();
platform.on('resource.changed', ({ resource, previous, current }) => {
    for (const out of graph({ from: resource }) ?? []) {
        console.log('propagating from: ', resource.id, ' to: ', out.id)
        out({ put: current })
    }
})

graph({
    put: { fromAll: [a, b], to: c },
    bi: true
})

function logGraph() {
    for (const [node, { incoming, outgoing }] of graph({ connections: true })) {
        const inputs = [...incoming].map(v => v.id).join(',')
        const outputs = [...outgoing].map(v => v.id).join(',')
        console.log(
            `\n[${inputs}] ---> ${node.id} ---> [${outputs}]\n`
        )
    }
}

logGraph()

a({ put: 420 })

logGraph()

c({ put: 999 })

logGraph()

console.log(a())