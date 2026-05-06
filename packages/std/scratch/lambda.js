import { msg } from '@bassline/core'
import { lambda, call } from '../src/lambda.js'

const withArguments = fn =>
  lambda(aMsg => {
    const args = aMsg.get('args')
    return fn(...args)
  })

function funcall(aLambda, args) {
  return call(aLambda)(msg({ args }))
}

const sum = withArguments((...args) => {
  const total = args.reduce((a, b) => a + b, 0)
  return msg({ sum: total })
})

const randSum = () => {
  const args = [1, 2, 3].map(_ => Math.floor(Math.random() * 100))
  return funcall(sum, args)
}

const results = await Promise.all([randSum(), randSum(), randSum()])

console.log(results)
