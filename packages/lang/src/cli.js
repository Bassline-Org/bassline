#!/usr/bin/env node
import { run, defaultEnv } from './index.js'
import { readFileSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'

const env = { ...defaultEnv }
env.load = path => run(readFileSync(path, 'utf-8'), env)

const args = process.argv.slice(2)

if (args[0] === '-e') {
  const result = run(args[1], env)
  if (result != null) console.log(result)
} else if (args[0]) {
  run(readFileSync(args[0], 'utf-8'), env)
} else {
  repl(env)
}

async function repl(env) {
  const completer = line => {
    // Find the symbol being typed (last word boundary)
    const match = line.match(/[a-zA-Z_+*/=<>!?.@-][a-zA-Z0-9_+*/=<>!?.-]*$/)
    const partial = match ? match[0] : ''
    const candidates = Object.keys(env).filter(k => k.startsWith(partial))
    return [candidates, partial]
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout, completer })
  console.log('blang repl — :q to quit')
  while (true) {
    let line
    try {
      line = await rl.question('> ')
    } catch {
      break
    }
    if (line === ':q' || line === ':quit') break
    try {
      const result = run(line, env)
      if (result != null) console.log(result)
    } catch (e) {
      console.error(e.message)
    }
  }
  rl.close()
}
