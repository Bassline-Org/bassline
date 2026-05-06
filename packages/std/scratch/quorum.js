import { msg } from '@bassline/core'
import { lambda, call } from '../src/lambda.js'

const empty = msg({})

let resolve, reject
const doneVoting = new Promise((res, rej) => {
  ;[resolve, reject] = [res, rej]
})

const quorum = (seconds = 5) => {
  let totalVotes = 0
  const timeout = setTimeout(() => {
    reject('vote failed')
    clearTimeout(timeout)
  }, seconds * 1000)
  return () => {
    let voted = false
    return lambda(async () => {
      if (!voted) {
        voted = true
        totalVotes++
        if (totalVotes >= 5) {
          resolve(msg({ scalar: 'passed' }))
          clearTimeout(timeout)
        }
      }
      const done = await doneVoting
      return done
    })
  }
}

const askForValidation = quorum(10)

for (let i = 0; i < 5; i++) {
  const validationHandle = askForValidation()
  setTimeout(
    () => {
      for (let j = 0; j < 5; j++) {
        call(validationHandle)(empty)
      }
      console.log(i, ' voted')
    },
    Math.floor(Math.random() * 6 * 1000)
  )
}

const result = await doneVoting
console.log('passed', result)
