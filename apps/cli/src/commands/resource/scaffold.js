import { resolveProtocol, buildSpecData } from '../protocol/config.js'

function selectorParams(sel) {
  if (sel === '') return []
  return sel.split(':').filter(Boolean)
}

function selectorSpecificity(sel) {
  return selectorParams(sel).length
}

function findSelectorOrigin(config, implementedNames, sel, dispatch) {
  const specData = buildSpecData(config)
  const protocols = specData.protocols ?? {}

  // Walk implemented protocols and their parents to find the owner
  for (const name of implementedNames) {
    const def = protocols[name]
    if (!def) continue

    const own = def[dispatch] ?? []
    if (own.includes(sel)) return name

    // Check if it comes from a parent
    const origin = traceInheritance(protocols, name, sel, dispatch)
    if (origin) return `${origin} via ${name}`
  }
  return null
}

function traceInheritance(protocols, name, sel, dispatch, visited) {
  if (visited?.has(name)) return null
  const seen = visited ?? new Set()
  seen.add(name)

  const def = protocols[name]
  if (!def) return null

  const own = def[dispatch] ?? []
  if (own.includes(sel)) return name

  for (const ext of def.extends ?? []) {
    const found = traceInheritance(protocols, ext, sel, dispatch, seen)
    if (found) return found
  }
  return null
}

function generateHandler(dispatch, selectors, origins) {
  const sorted = [...selectors].sort((a, b) => selectorSpecificity(b) - selectorSpecificity(a))

  const allParams = new Set()
  for (const sel of sorted) {
    for (const p of selectorParams(sel)) allParams.add(p)
  }

  const isPut = dispatch === 'put'
  const sig = isPut ? 'put(value, msg)' : 'get(msg)'
  const lines = []
  lines.push(`  ${sig} {`)

  const paramList = [...allParams].sort()
  const msgRef = isPut ? 'msg' : 'msg'
  if (paramList.length) {
    lines.push(`    const { ${paramList.join(', ')} } = ${msgRef}`)
    lines.push('')
  }

  let hasBare = false
  for (const sel of sorted) {
    const params = selectorParams(sel)
    const origin = origins.get(`${dispatch}:${sel}`) ?? ''
    const originComment = origin ? `  (${origin})` : ''

    if (params.length === 0) {
      hasBare = true
      // Bare selector comes last, no guard needed
      continue
    }

    const guard = params.map(p => `${p} !== undefined`).join(' && ')
    lines.push(`    // ${sel}${originComment}`)
    lines.push(`    if (${guard}) {`)
    lines.push(`      // TODO: implement ${sel}`)
    lines.push(`      throw new Error('not yet implemented')`)
    lines.push(`    }`)
    lines.push('')
  }

  if (hasBare) {
    const bareSel = ''
    const origin = origins.get(`${dispatch}:${bareSel}`) ?? ''
    const originComment = origin ? `  (${origin})` : ''
    lines.push(`    // ""${originComment}`)
    if (isPut) {
      lines.push(`    // TODO: set the current value`)
    } else {
      lines.push(`    // TODO: get the current value`)
    }
    lines.push(`    throw new Error('not yet implemented')`)
  } else {
    lines.push(`    return this.dnu(${msgRef})`)
  }

  lines.push(`  },`)
  return lines.join('\n')
}

export function generateScaffold(exportName, implementedNames, config) {
  // Resolve all protocols and collect selectors
  const allGet = new Set()
  const allPut = new Set()
  const origins = new Map()

  for (const name of implementedNames) {
    const resolved = resolveProtocol(config, name)
    if (!resolved) continue

    for (const sel of resolved.get ?? []) {
      allGet.add(sel)
      if (!origins.has(`get:${sel}`)) {
        const origin = findSelectorOrigin(config, implementedNames, sel, 'get')
        if (origin) origins.set(`get:${sel}`, origin)
      }
    }
    for (const sel of resolved.put ?? []) {
      allPut.add(sel)
      if (!origins.has(`put:${sel}`)) {
        const origin = findSelectorOrigin(config, implementedNames, sel, 'put')
        if (origin) origins.set(`put:${sel}`, origin)
      }
    }
  }

  const parts = []
  parts.push(`import { resource } from '@bassline/core/alt'`)
  parts.push('')
  parts.push(`// Configure via environment:`)
  parts.push(`// const myVar = process.env.MY_VAR`)
  parts.push('')
  parts.push(`export const ${exportName} = resource({`)
  parts.push('')

  if (allGet.size) {
    parts.push(generateHandler('get', allGet, origins))
    if (allPut.size) parts.push('')
  }

  if (allPut.size) {
    parts.push(generateHandler('put', allPut, origins))
  }

  parts.push(`})`)
  parts.push('')

  return parts.join('\n')
}

export function generateGenericScaffold(exportName) {
  return `import { resource } from '@bassline/core/alt'

// Configure via environment:
// const myVar = process.env.MY_VAR

export const ${exportName} = resource({
  get(msg) {
    return this.dnu(msg)
  },
  put(value, msg) {
    return this.dnu({ put: value, ...msg })
  },
})
`
}
