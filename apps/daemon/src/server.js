#!/usr/bin/env node
import { serveTcp } from '@bassline/core/serve'
import { context, conversation } from '@bassline/std'
import { lobby, localBindings } from './lobby.js'

const [, , socketPath = '/tmp/bassline.sock'] = process.argv

const ctx = context()
const { dispatch, mintId } = ctx

const [serverMsg] = serveTcp(onConnect, { path: socketPath })

process.on('SIGINT', onClose)
process.on('SIGTERM', onClose)

const interval = setInterval(() => {
  console.log('[server] entries: ', ctx.entries().length)
  console.log('[server] localBindings', localBindings)
}, 1000)

function onClose() {
  serverMsg.close()
  clearInterval(interval)
}

function onConnect([aPeer, recvPeer]) {
  const [conv, onMsg] = conversation(aPeer, {
    recv: recvPeer,
    dispatch,
    mintId,
  })
  onMsg(aMsg => {
    console.log('received: ', aMsg)
  })
  conv.closedBy(aPeer, serverMsg).closes(aPeer).send(lobby)
}

console.log(`daemon listening on ${socketPath}`)
