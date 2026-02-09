import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readConfig } from './protocol/config.js'
import { info, error } from '../log.js'

export async function command(options) {
  const config = await readConfig()
  const services = config.services

  if (!services || !Object.keys(services).length) {
    return runOne('index.js')
  }
  if (options.service) {
    const svc = services[options.service]
    if (!svc) {
      error(`Unknown service: ${options.service}`)
      process.exitCode = 1
      return
    }
    return runOne(svc.path)
  }
  return runAll(services)
}

function nodeArgs(entry) {
  const args = []
  if (existsSync('.env')) args.push('--env-file=.env')
  args.push(entry)
  return args
}

function runOne(entry) {
  if (!existsSync(entry)) {
    error(`${entry} not found`)
    process.exitCode = 1
    return
  }
  info(`Running ${entry}...`)
  const child = spawn('node', nodeArgs(entry), {
    stdio: 'inherit',
  })
  const onSIGINT = () => child.kill('SIGINT')
  const onSIGTERM = () => child.kill('SIGTERM')
  process.on('SIGINT', onSIGINT)
  process.on('SIGTERM', onSIGTERM)
  child.on('exit', (code, signal) => {
    process.removeListener('SIGINT', onSIGINT)
    process.removeListener('SIGTERM', onSIGTERM)
    process.exitCode = signal ? 1 : code
  })
}

function runAll(services) {
  const children = new Map()
  let exitCode = 0

  for (const [name, svc] of Object.entries(services)) {
    if (!existsSync(svc.path)) {
      error(`[${name}] ${svc.path} not found`)
      continue
    }
    info(`Starting ${name} (${svc.path})...`)
    const child = spawn('node', nodeArgs(svc.path), {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, BL_SERVICE: name },
    })
    child.stdout.on('data', d => {
      for (const line of d.toString().split('\n').filter(Boolean)) {
        console.log(`[${name}] ${line}`)
      }
    })
    child.stderr.on('data', d => {
      for (const line of d.toString().split('\n').filter(Boolean)) {
        console.error(`[${name}] ${line}`)
      }
    })
    child.on('exit', (code, sig) => {
      info(`[${name}] exited (${sig || code})`)
      if (code && code !== 0) exitCode = code
      children.delete(name)
      if (children.size === 0) process.exit(exitCode)
    })
    children.set(name, child)
  }

  if (children.size === 0) {
    error('No services started')
    process.exitCode = 1
    return
  }

  let shuttingDown = false
  const shutdown = () => {
    if (shuttingDown) return
    shuttingDown = true
    info('Shutting down...')
    for (const child of children.values()) {
      child.kill('SIGTERM')
    }
    setTimeout(() => {
      for (const child of children.values()) {
        child.kill('SIGKILL')
      }
    }, 5000).unref()
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}
