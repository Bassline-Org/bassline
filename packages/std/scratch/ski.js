import { msg } from '@bassline/core'
import { lambda, evaluate } from '../src/lambda.js'

const k = lambda(x => _y => x)
k.merge({ description: 'I am the K combinator. K x y => x' })

const s = lambda(
  x => y => async z =>
    evaluate([
      [x, z],
      [y, z],
    ])
)
s.merge({ description: 'I am the S combinator' })

const i = await evaluate([s, k, k])
i.merge({ description: '' })

let res = await evaluate([i, msg({ scalar: 5 })])
console.log(res)
res = await evaluate([i, msg({ scalar: 9 })])
console.log(res)
