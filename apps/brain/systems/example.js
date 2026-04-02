import { cell, propagator } from "@bassline/core"
import { wire } from "../src/wire.js"
import graph from '../graphs/example.json' with { type: 'json' }

const nodes = {
    input: propagator(),
    cell: cell((current, incoming, update) => {
        if (incoming > current) update(incoming)
    }),
    transform: propagator((value, p) => p(value * 2)),
    output: propagator((msg, p) => {
        console.log('output: ', msg)
        p(msg)
    }),
    foo: propagator(msg => {
        console.log('foo: ', msg)
    }),
    bar: propagator(msg => {
        console.log('bar: ', msg)
    })
}

wire(graph.elements, nodes)

nodes.input.send(10)
nodes.input.send(20)
nodes.input.send(30)