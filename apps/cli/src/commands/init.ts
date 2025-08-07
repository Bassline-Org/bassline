/**
 * Initialize a new Bassline user installation
 */

import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import chalk from 'chalk'
import inquirer from 'inquirer'
import ora from 'ora'
import { execSync } from 'child_process'

interface InitOptions {
  path?: string
  from?: string
  minimal?: boolean
  skipInstall?: boolean
}

interface InitAnswers {
  installPath: string
  includeExamples: boolean
  storageBackends: string[]
  transportLayers: string[]
  typescript: boolean
  addToPath: boolean
}

const STORAGE_OPTIONS = [
  { name: 'Memory (included)', value: 'memory', included: true },
  { name: 'PostgreSQL', value: 'postgres', package: '@bassline/storage-postgres' },
  { name: 'Filesystem', value: 'filesystem', package: '@bassline/storage-filesystem' },
]

const TRANSPORT_OPTIONS = [
  { name: 'Local (included)', value: 'local', included: true },
  { name: 'WebSocket', value: 'websocket', package: '@bassline/transport-websocket' },
  { name: 'WebRTC', value: 'webrtc', package: '@bassline/transport-webrtc' },
]

export async function initCommand(options: InitOptions) {
  console.log(chalk.blue.bold('\n🎵 Bassline Installation Setup\n'))
  
  // Check if already initialized
  const defaultPath = path.join(os.homedir(), '.bassline')
  const existingPath = process.env.BASSLINE_HOME || defaultPath
  
  if (await fileExists(existingPath) && !options.path) {
    const { overwrite } = await inquirer.prompt([{
      type: 'confirm',
      name: 'overwrite',
      message: `Installation already exists at ${existingPath}. Overwrite?`,
      default: false
    }])
    
    if (!overwrite) {
      console.log(chalk.yellow('Installation cancelled'))
      return
    }
  }
  
  // Gather configuration
  let answers: InitAnswers
  
  if (options.minimal) {
    // Minimal setup - no prompts
    answers = {
      installPath: options.path || existingPath,
      includeExamples: false,
      storageBackends: ['memory'],
      transportLayers: ['local'],
      typescript: true,
      addToPath: true
    }
  } else if (options.from) {
    // Install from template
    answers = {
      installPath: options.path || existingPath,
      includeExamples: false,
      storageBackends: ['memory'],
      transportLayers: ['local'],
      typescript: true,
      addToPath: true
    }
    // Template handling will override these defaults
  } else {
    // Interactive setup
    answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'installPath',
        message: 'Installation directory:',
        default: existingPath,
        filter: (input) => {
          if (input.startsWith('~')) {
            return path.join(os.homedir(), input.slice(1))
          }
          return path.resolve(input)
        }
      },
      {
        type: 'confirm',
        name: 'includeExamples',
        message: 'Include example plugins and basslines?',
        default: true
      },
      {
        type: 'checkbox',
        name: 'storageBackends',
        message: 'Select storage backends:',
        choices: STORAGE_OPTIONS,
        default: ['memory']
      },
      {
        type: 'checkbox',
        name: 'transportLayers',
        message: 'Select transport layers:',
        choices: TRANSPORT_OPTIONS,
        default: ['local']
      },
      {
        type: 'confirm',
        name: 'typescript',
        message: 'Use TypeScript?',
        default: true
      },
      {
        type: 'confirm',
        name: 'addToPath',
        message: 'Add to PATH?',
        default: true
      }
    ])
  }
  
  // Create installation
  const spinner = ora('Creating installation...').start()
  
  try {
    // Create directory structure
    await createDirectoryStructure(answers.installPath)
    
    // Copy or create files based on template
    if (options.from) {
      await installFromTemplate(options.from, answers.installPath)
    } else {
      await createInstallationFiles(answers)
    }
    
    spinner.succeed('Installation created')
    
    // Install dependencies
    if (!options.skipInstall) {
      const installSpinner = ora('Installing dependencies...').start()
      try {
        execSync('npm install', {
          cwd: answers.installPath,
          stdio: 'ignore'
        })
        installSpinner.succeed('Dependencies installed')
      } catch (error) {
        installSpinner.fail('Failed to install dependencies')
        console.log(chalk.yellow('Run "npm install" manually in', answers.installPath))
      }
    }
    
    // Add to PATH if requested
    if (answers.addToPath) {
      await addToPath(answers.installPath)
    }
    
    // Success message
    console.log(chalk.green.bold('\n✨ Installation complete!\n'))
    console.log('Next steps:')
    console.log(chalk.cyan('  cd ' + answers.installPath))
    console.log(chalk.cyan('  npm run dev     # Start development mode'))
    console.log(chalk.cyan('  bassline --help # See available commands'))
    
    if (answers.addToPath) {
      console.log(chalk.yellow('\n⚠️  Restart your terminal or run:'))
      console.log(chalk.cyan('  source ~/.bashrc  # or ~/.zshrc'))
    }
    
  } catch (error) {
    spinner.fail('Installation failed')
    console.error(error)
    process.exit(1)
  }
}

async function createDirectoryStructure(installPath: string) {
  const dirs = [
    installPath,
    path.join(installPath, 'bin'),
    path.join(installPath, 'plugins'),
    path.join(installPath, 'plugins/storage'),
    path.join(installPath, 'plugins/transport'),
    path.join(installPath, 'plugins/gadgets'),
    path.join(installPath, 'basslines'),
    path.join(installPath, 'networks'),
    path.join(installPath, 'daemon'),
  ]
  
  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true })
  }
}

async function createInstallationFiles(answers: InitAnswers) {
  const { installPath, includeExamples, storageBackends, transportLayers, typescript } = answers
  
  // Detect if we're in development (CLI is running from bassline repo)
  const isLocalDevelopment = process.cwd().includes('bassline') || process.env.BASSLINE_DEV === 'true'
  
  // Find the bassline repo root by walking up directories
  let basslineRoot = null
  if (isLocalDevelopment) {
    let currentDir = process.cwd()
    while (currentDir !== path.dirname(currentDir)) {
      if (path.basename(currentDir) === 'bassline') {
        basslineRoot = currentDir
        break
      }
      currentDir = path.dirname(currentDir)
    }
  }
  
  // Create package.json
  const packageJson = {
    name: 'bassline-user-installation',
    version: '1.0.0',
    type: 'module',
    private: true,
    scripts: {
      dev: typescript ? 'tsx watch index.ts' : 'node --watch index.js',
      build: typescript ? 'tsc' : 'echo "No build needed"',
      test: 'vitest',
      upgrade: isLocalDevelopment ? 'echo "Using local development packages"' : 'npm update @bassline/core @bassline/installation'
    },
    dependencies: {
      '@bassline/core': isLocalDevelopment && basslineRoot ? `file:${basslineRoot}/packages/core` : '^0.1.0',
      '@bassline/installation': isLocalDevelopment && basslineRoot ? `file:${basslineRoot}/packages/installation` : '^0.1.0',
      '@bassline/storage-memory': isLocalDevelopment && basslineRoot ? `file:${basslineRoot}/packages/storage-memory` : '^0.1.0',
      tsx: typescript ? '^4.7.0' : undefined
    } as any,
    devDependencies: typescript ? {
      '@types/node': '^20.10.5',
      typescript: '^5.3.3',
      vitest: '^1.2.1'
    } : {
      vitest: '^1.2.1'
    }
  }
  
  // Add selected storage backends
  for (const backend of storageBackends) {
    const option = STORAGE_OPTIONS.find(o => o.value === backend)
    if (option && 'package' in option && option.package) {
      if (isLocalDevelopment && basslineRoot) {
        // Convert package name to local path
        const packageName = option.package.replace('@bassline/', '')
        packageJson.dependencies[option.package] = `file:${basslineRoot}/packages/${packageName}`
      } else {
        packageJson.dependencies[option.package] = '^0.1.0'
      }
    }
  }
  
  // Add selected transport layers
  for (const transport of transportLayers) {
    const option = TRANSPORT_OPTIONS.find(o => o.value === transport)
    if (option && 'package' in option && option.package) {
      if (isLocalDevelopment && basslineRoot) {
        // Convert package name to local path  
        const packageName = option.package.replace('@bassline/', '')
        packageJson.dependencies[option.package] = `file:${basslineRoot}/packages/${packageName}`
      } else {
        packageJson.dependencies[option.package] = '^0.1.0'
      }
    }
  }
  
  await fs.writeFile(
    path.join(installPath, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  )
  
  // Create tsconfig.json if using TypeScript
  if (typescript) {
    const tsconfig = {
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        lib: ['ES2022'],
        moduleResolution: 'bundler',
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        resolveJsonModule: true,
        allowSyntheticDefaultImports: true,
        strict: true,
        noEmit: true
      },
      include: ['**/*.ts'],
      exclude: ['node_modules']
    }
    
    await fs.writeFile(
      path.join(installPath, 'tsconfig.json'),
      JSON.stringify(tsconfig, null, 2)
    )
  }
  
  // Create main index file
  const indexContent = generateIndexFile(storageBackends, transportLayers, typescript, includeExamples)
  await fs.writeFile(
    path.join(installPath, typescript ? 'index.ts' : 'index.js'),
    indexContent
  )
  
  // Create bin wrapper
  const binContent = `#!/usr/bin/env ${typescript ? 'tsx' : 'node'}
import { CLI } from '@bassline/cli/runtime'
import installation from '../index.${typescript ? 'ts' : 'js'}'

const cli = new CLI(installation)
cli.run(process.argv)
`
  
  const binPath = path.join(installPath, 'bin', 'bassline')
  await fs.writeFile(binPath, binContent)
  await fs.chmod(binPath, 0o755)
  
  // Create example files if requested
  if (includeExamples) {
    await createExampleFiles(installPath, typescript)
  }
}

function generateIndexFile(
  storageBackends: string[],
  transportLayers: string[],
  typescript: boolean,
  includeExamples: boolean
): string {
  const imports = typescript ? `
import { BasslineInstallation } from '@bassline/installation'
import type { StorageFactory, TransportFactory } from '@bassline/installation'
` : `
import { BasslineInstallation } from '@bassline/installation'
`
  
  const storageConfig = storageBackends.map(backend => {
    if (backend === 'memory') {
      return `    memory: async () => {
      const { createMemoryStorage } = await import('@bassline/storage-memory')
      return createMemoryStorage
    }`
    } else if (backend === 'postgres') {
      return `    postgres: async () => {
      const { createPostgresStorage } = await import('@bassline/storage-postgres')
      return createPostgresStorage
    }`
    } else if (backend === 'filesystem') {
      return `    filesystem: async () => {
      const { createFilesystemStorage } = await import('@bassline/storage-filesystem')
      return createFilesystemStorage
    }`
    }
    return ''
  }).filter(Boolean).join(',\n')
  
  const transportConfig = transportLayers.map(transport => {
    if (transport === 'local') {
      return `    local: async () => {
      const { LocalTransport } = await import('@bassline/core')
      return LocalTransport
    }`
    } else if (transport === 'websocket') {
      return `    websocket: async () => {
      const { WebSocketTransport } = await import('@bassline/transport-websocket')
      return WebSocketTransport
    }`
    } else if (transport === 'webrtc') {
      return `    webrtc: async () => {
      const { WebRTCTransport } = await import('@bassline/transport-webrtc')
      return WebRTCTransport
    }`
    }
    return ''
  }).filter(Boolean).join(',\n')
  
  const basslinesConfig = includeExamples ? `
  basslines: {
    'example-math': () => import('./basslines/example-math'),
    'example-string': () => import('./basslines/example-string')
  },` : `
  basslines: {},`
  
  return `/**
 * Bassline User Installation Configuration
 * 
 * This file defines your personalized Bassline environment.
 * Add storage backends, transport layers, and basslines as needed.
 */
${imports}

export default new BasslineInstallation({
  // Storage backends
  storage: {
${storageConfig}
  },
  
  // Transport layers
  transports: {
${transportConfig}
  },
  
  // Pre-installed basslines
${basslinesConfig}
  
  // Default configurations
  defaults: {
    storage: '${storageBackends[0] || 'memory'}',
    transport: '${transportLayers[0] || 'local'}',
    scheduler: 'immediate'
  },
  
  // Lifecycle hooks (optional)
  hooks: {
    beforeNetworkStart: async (network) => {
      console.log(\`Starting network: \${network.id}\`)
    },
    afterNetworkStart: async (network) => {
      console.log(\`Network started: \${network.id}\`)
    }
  }
})
`
}

async function createExampleFiles(installPath: string, typescript: boolean) {
  const ext = typescript ? 'ts' : 'js'
  
  // Example storage plugin
  const storageExample = `/**
 * Example custom storage backend
 */

${typescript ? "import type { NetworkStorage } from '@bassline/core'" : ''}

export class CustomStorage${typescript ? ' implements NetworkStorage' : ''} {
  async saveContactContent(networkId, groupId, contactId, content) {
    console.log('Saving:', { networkId, groupId, contactId, content })
  }
  
  async loadContactContent(networkId, groupId, contactId) {
    console.log('Loading:', { networkId, groupId, contactId })
    return null
  }
  
  // ... implement other required methods
}

export function createCustomStorage(config) {
  return new CustomStorage(config)
}
`
  
  await fs.writeFile(
    path.join(installPath, 'plugins', 'storage', `custom-storage.${ext}`),
    storageExample
  )
  
  // Example bassline
  const basslineExample = `/**
 * Example bassline with custom gadgets
 */

export const exampleMath = {
  name: 'example-math',
  version: '1.0.0',
  attributes: {
    'bassline.type': 'gadget-library',
    'bassline.author': 'user'
  },
  gadgets: [
    {
      name: 'double',
      primitive: async ({ value }) => {
        return { result: value * 2 }
      }
    },
    {
      name: 'square',
      primitive: async ({ value }) => {
        return { result: value * value }
      }
    }
  ]
}
`
  
  await fs.writeFile(
    path.join(installPath, 'basslines', `example-math.${ext}`),
    basslineExample
  )
}

async function installFromTemplate(template: string, installPath: string) {
  // Handle different template sources
  if (template.startsWith('github:')) {
    // Clone from GitHub
    const repo = template.slice(7)
    execSync(`git clone https://github.com/${repo} ${installPath}`, { stdio: 'ignore' })
  } else if (template.startsWith('@')) {
    // Install from npm
    execSync(`npm pack ${template}`, { cwd: os.tmpdir(), stdio: 'ignore' })
    // Extract and copy files
    // ... implementation needed
  } else if (await fileExists(template)) {
    // Copy from local directory
    execSync(`cp -r ${template}/* ${installPath}/`, { stdio: 'ignore' })
  } else {
    throw new Error(`Unknown template source: ${template}`)
  }
}

async function addToPath(installPath: string) {
  const binPath = path.join(installPath, 'bin')
  const exportLine = `export PATH="${binPath}:$PATH"`
  
  // Detect shell
  const shell = process.env.SHELL || '/bin/bash'
  const shellConfig = shell.includes('zsh') ? '.zshrc' : '.bashrc'
  const configPath = path.join(os.homedir(), shellConfig)
  
  try {
    const content = await fs.readFile(configPath, 'utf-8')
    if (!content.includes(binPath)) {
      await fs.appendFile(configPath, `\n# Bassline CLI\n${exportLine}\n`)
      console.log(chalk.green(`✓ Added to ${shellConfig}`))
    }
  } catch (error) {
    console.log(chalk.yellow(`Could not update ${shellConfig}. Add manually:`))
    console.log(chalk.cyan(`  echo '${exportLine}' >> ~/${shellConfig}`))
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}