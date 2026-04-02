import { propagator } from '@bassline/core'

export const types = {
  passthrough: () => propagator(),
  doubler: () => propagator((v, p) => p(v * 2)),
  logger: (node) => propagator((v, p) => {
    console.log(`[${node.label}]`, v)
    p(v)
  }),
}
