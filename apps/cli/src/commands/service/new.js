import { input, confirm } from '@inquirer/prompts'
import { writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { existsSync } from 'node:fs'
import { readConfig, writeConfig } from '../protocol/config.js'
import { log, success, info, label } from '../../log.js'

function validateKebabCase(value) {
  if (!/^[a-z][a-z0-9-]*$/.test(value)) return 'Must be kebab-case (e.g. api, block-indexer)'
  return true
}

export async function command() {
  const config = await readConfig()
  if (!config.services) config.services = {}

  const name = await input({
    message: 'Service name:',
    validate: v => {
      const valid = validateKebabCase(v)
      if (valid !== true) return valid
      if (config.services[v]) return `Service "${v}" already exists.`
      return true
    },
  })

  const description = await input({
    message: 'Description:',
  })

  const servicePath = `services/${name}.js`

  // Show summary
  log()
  label('Service:', name)
  label('Path:', servicePath)
  if (description.trim()) label('Description:', description.trim())
  log()

  const ok = await confirm({ message: 'Add to bassline.config.json?' })
  if (!ok) {
    info('Cancelled.')
    return
  }

  // Create scaffold file if it doesn't exist
  const fullPath = join(process.cwd(), servicePath)
  if (!existsSync(fullPath)) {
    await mkdir(dirname(fullPath), { recursive: true })
    await writeFile(
      fullPath,
      `// ${name} service
// Import and compose your resources here

const port = process.env.PORT ?? 3000

console.log('${name} started')
`
    )
    info(`  created ${servicePath}`)
  } else {
    info(`  ${servicePath} already exists, skipping scaffold`)
  }

  const definition = { path: servicePath }
  if (description.trim()) definition.description = description.trim()

  config.services[name] = definition
  await writeConfig(config)
  success(`Service ${name} added.`)
}
