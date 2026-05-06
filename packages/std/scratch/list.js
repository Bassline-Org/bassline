import { msg } from '@bassline/core'
import { lambda, call, request } from '../src/lambda.js'
import { resolve, reject } from '../src/shape.js'

const edit = request('edit')
const value = request('value')

const slotDesc = `I am a slot. I hold a value and allow modifications.`
function slot(aValue) {
  let ref = aValue
  return msg({ description: slotDesc }).grantAll({
    edit(aMsg) {
      const value = aMsg.get('value')
      if (!value) return reject(aMsg)
      ref = value
      resolve(aMsg)
    },
    value(aMsg) {
      resolve(aMsg, msg({ value: ref }))
    },
  })
}

function fn(aLambda) {
  const f = call(aLambda)
  return async aMsg => {
    const result = await f(aMsg)
    if (result.hasCap('call')) {
      const wrapped = fn(result)
      wrapped.unwrap = () => result
      return wrapped
    }
    return result
  }
}

function paginate(els, i = 0) {
  return lambda(() => {
    if (i > els.length) return
    const el = els[i]
    i++
    return el
  })
}

function createList() {
  const contents = []
  const edit = index => el => {
    contents[index] = el
  }
  const add = item => {
    const index = contents.length
    contents.push(item)
    return edit(index)
  }
  const read = () => msg({ items: contents })
  return paginate([read, add])
}

const foo = slot(123)
const editFoo = edit(foo)
const valueFoo = value(foo)

console.log('value:', await valueFoo())
await editFoo(msg({ value: 420 }))
console.log('value:', await valueFoo())

const more = fn(createList())

const read = await more()
const add = await more()
const rawAdd = add.unwrap()
rawAdd.grant('foo', () => console.log('foo!!!'))

const a = await add(msg({ hello: 'world' }))
const _ = await add(msg({ hello: 'world..' }))

const logElements = async () => {
  const elements = await read()
  console.log(elements.get('items'))
}

await logElements()

await a(msg({ foo: 'bar' }))

await logElements()
