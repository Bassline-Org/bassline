import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { select } from '@inquirer/prompts'
import { readConfig, getProjectProtocols, getResourcePath } from './protocol/config.js'
import { log, success, error, info, item } from '../log.js'

async function getProjectVersion() {
  try {
    const pkg = JSON.parse(await readFile(join(process.cwd(), 'package.json'), 'utf-8'))
    return pkg.version || '0.1.0'
  } catch {
    return '0.1.0'
  }
}

async function collectFiles(resourcePath) {
  const fullPath = join(process.cwd(), resourcePath)

  if (!resourcePath.endsWith('/')) {
    // Single file
    const content = await readFile(fullPath, 'utf-8')
    return [{ path: resourcePath, content }]
  }

  // Directory — walk recursively for .js files
  const files = []
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
      } else if (entry.name.endsWith('.js')) {
        const rel = relative(process.cwd(), full)
        const content = await readFile(full, 'utf-8')
        const file = { path: rel, content }
        if (entry.name === 'index.js') file.type = 'entry'
        files.push(file)
      }
    }
  }
  await walk(fullPath)
  return files
}

function buildItem(name, resource, version, allProtocols, files) {
  const entry = {
    name,
    version,
    description: resource.description || '',
  }

  // Gather protocol definitions to distribute
  if (resource.protocols?.length) {
    entry.protocols = {}
    for (const protoName of resource.protocols) {
      if (allProtocols[protoName]) {
        entry.protocols[protoName] = allProtocols[protoName]
      }
    }
  }

  if (resource.implements?.length) {
    entry.implements = resource.implements
  }

  entry.files = files

  if (resource.dependencies && Object.keys(resource.dependencies).length) {
    entry.npmDependencies = resource.dependencies
  }

  return entry
}

export async function command(name, options) {
  const config = await readConfig()
  const resources = config.resources ?? {}
  const output = options.output || 'public/r'
  const names = Object.keys(resources)

  if (!names.length) {
    info('No resources defined. Use "bl resource new" to add one.')
    return
  }

  // Interactive selection when no name given and multiple resources exist
  if (!name && names.length > 1) {
    const choice = await select({
      message: 'Build which resource:',
      choices: [{ value: '__all__', name: '(all)' }, ...names.map(n => ({ value: n, name: n }))],
    })
    if (choice !== '__all__') name = choice
  }

  const toBuild = name ? { [name]: resources[name] } : resources

  if (name && !resources[name]) {
    error(`Resource "${name}" not found.`)
    info('Available: ' + names.join(', '))
    process.exitCode = 1
    return
  }

  const version = await getProjectVersion()
  const allProtocols = getProjectProtocols(config)

  await mkdir(join(process.cwd(), output), { recursive: true })

  let built = 0
  for (const [resName, resource] of Object.entries(toBuild)) {
    try {
      const resPath = getResourcePath(resource)
      const files = await collectFiles(resPath)
      const entry = buildItem(resName, resource, version, allProtocols, files)
      const outPath = join(process.cwd(), output, `${resName}.json`)
      await writeFile(outPath, JSON.stringify(entry, null, 2) + '\n')
      item(`${output}/${resName}.json`)
      built++
    } catch (e) {
      error(`${resName}: failed — ${e.message}`)
    }
  }

  // Generate index.json from all built items in output dir
  try {
    const outputDir = join(process.cwd(), output)
    const allFiles = await readdir(outputDir)
    const index = { items: {} }
    for (const f of allFiles) {
      if (!f.endsWith('.json') || f === 'index.json') continue
      try {
        const raw = JSON.parse(await readFile(join(outputDir, f), 'utf-8'))
        const name = f.replace('.json', '')
        index.items[name] = {
          version: raw.version ?? '',
          description: raw.description ?? '',
          protocols: Object.keys(raw.protocols ?? {}),
          implements: raw.implements ?? [],
        }
      } catch { /* skip malformed files */ }
    }
    await writeFile(join(outputDir, 'index.json'), JSON.stringify(index, null, 2) + '\n')
  } catch { /* index generation is best-effort */ }

  log()
  success(`Built ${built} item${built !== 1 ? 's' : ''} → ${output}/`)
}
