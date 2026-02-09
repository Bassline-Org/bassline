import { input, select, checkbox, confirm } from '@inquirer/prompts'
import { writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { existsSync } from 'node:fs'
import { readConfig, writeConfig, getAllProtocolNames, getProjectProtocols, getEntryPoint } from '../protocol/config.js'
import { generateScaffold, generateGenericScaffold } from './scaffold.js'
import { log, success, info, label } from '../../log.js'

function validateKebabCase(value) {
  if (!/^[a-z][a-z0-9-]*$/.test(value)) return 'Must be kebab-case (e.g. cache, redis-store)'
  return true
}

function toCamelCase(kebab) {
  return kebab.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
}

async function promptProtocols(labelText, available) {
  if (!available.length) return []
  return checkbox({
    message: `${labelText}:`,
    choices: available.map(n => ({ value: n, name: n })),
  })
}

export async function command() {
  const config = await readConfig()
  if (!config.resources) config.resources = {}

  const name = await input({
    message: 'Resource name:',
    validate: v => {
      const valid = validateKebabCase(v)
      if (valid !== true) return valid
      if (config.resources[v]) return `Resource "${v}" already exists.`
      return true
    },
  })

  const description = await input({
    message: 'Description:',
  })

  const resourceType = await select({
    message: 'Resource type:',
    choices: [
      { value: 'file', name: 'Single file' },
      { value: 'directory', name: 'Directory (multiple files)' },
    ],
  })

  const defaultPath = resourceType === 'directory' ? `resources/${name}/` : `resources/${name}.js`

  const resourcePath = await input({
    message: 'Path:',
    default: defaultPath,
  })

  const allProtocols = getAllProtocolNames(config)
  const implements_ = await promptProtocols('Implements', allProtocols)

  const projectProtocols = Object.keys(getProjectProtocols(config))
  const protocols = await promptProtocols('Distribute protocol', projectProtocols)

  const definition = {
    path: resourcePath,
  }
  if (description.trim()) definition.description = description.trim()
  if (implements_.length) definition.implements = implements_
  if (protocols.length) definition.protocols = protocols

  // Show summary
  log()
  label('Resource:', name)
  label('Path:', resourcePath)
  if (definition.description) label('Description:', definition.description)
  if (implements_.length) label('Implements:', implements_.join(', '))
  if (protocols.length) label('Distributes:', protocols.join(', '))
  log()

  const ok = await confirm({ message: 'Add to bassline.config.json?' })
  if (!ok) {
    info('Cancelled.')
    return
  }

  // Create scaffold file if it doesn't exist
  const entryPath = getEntryPoint(definition)
  const fullPath = join(process.cwd(), entryPath)
  if (!existsSync(fullPath)) {
    await mkdir(dirname(fullPath), { recursive: true })
    const exportName = toCamelCase(name)
    const code = implements_.length
      ? generateScaffold(exportName, implements_, config)
      : generateGenericScaffold(exportName)
    await writeFile(fullPath, code)
    info(`  created ${entryPath}`)
  } else {
    info(`  ${entryPath} already exists, skipping scaffold`)
  }

  config.resources[name] = definition
  await writeConfig(config)
  success(`Resource ${name} added.`)
}
