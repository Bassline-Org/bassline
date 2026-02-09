import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { coreSpec, spec } from '@bassline/core/alt'

const CONFIG_FILE = 'bassline.config.json'

export async function readConfig() {
  try {
    const raw = await readFile(join(process.cwd(), CONFIG_FILE), 'utf-8')
    return JSON.parse(raw)
  } catch {
    throw new Error(`No ${CONFIG_FILE} found. Run "bl new" first.`)
  }
}

export async function writeConfig(config) {
  await writeFile(join(process.cwd(), CONFIG_FILE), JSON.stringify(config, null, 2) + '\n')
}

export function getProjectProtocols(config) {
  return config.spec?.protocols ?? {}
}

export function getAllProtocolNames(config) {
  const core = Object.keys(coreSpec.protocols)
  const project = Object.keys(getProjectProtocols(config))
  return [...core, ...project]
}

export function buildSpecData(config) {
  const protocols = {
    ...coreSpec.protocols,
    ...getProjectProtocols(config),
  }
  return { name: config.name, version: '1.0.0', protocols }
}

export function resolveProtocol(config, name) {
  const data = buildSpecData(config)
  const s = spec(data)
  return s({ protocol: name })
}

export function getResourcePath(resource) {
  return resource.path ?? resource.file
}

export function isDirectoryResource(resource) {
  return getResourcePath(resource)?.endsWith('/')
}

export function getEntryPoint(resource) {
  const p = getResourcePath(resource)
  return p?.endsWith('/') ? p + 'index.js' : p
}

export function getInstalledItems(config) {
  return config.installed ?? {}
}

export function isInstalledProtocol(config, protocolName) {
  const installed = getInstalledItems(config)
  for (const [itemName, item] of Object.entries(installed)) {
    if (item.protocols?.includes(protocolName)) return itemName
  }
  return null
}
