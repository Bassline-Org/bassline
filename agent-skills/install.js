#!/usr/bin/env node

/**
 * Bassline Skills Installer
 *
 * Installs the Bassline agent skill following the Agent Skills standard
 * (https://agentskills.io/specification) to help LLMs work with Bassline.
 *
 * Usage:
 *   npx @bassline/skills install [--path <dir>]
 *   pnpm dlx @bassline/skills install [--path <dir>]
 */

import { mkdirSync, cpSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SKILL_NAME = 'bassline'

function showHelp() {
  console.log(`
Bassline Skills Installer

Installs the Bassline agent skill to help LLMs work with Bassline.

Usage:
  npx @bassline/skills install [options]

Options:
  --path, -p <dir>   Install to specific directory (default: ./skills)
  --help, -h         Show this help message

Examples:
  npx @bassline/skills install
  npx @bassline/skills install --path ./agent-skills
`)
}

function install(targetDir) {
  const sourcePath = join(__dirname, SKILL_NAME)
  const targetPath = join(targetDir, SKILL_NAME)

  mkdirSync(targetDir, { recursive: true })
  cpSync(sourcePath, targetPath, { recursive: true })

  console.log(`\nInstalled Bassline skill to ${targetDir}`)
  console.log(`  ✓ ${SKILL_NAME}/`)
  console.log('\nTo use with Claude Code, add to .claude/skills/ or reference in settings.')
}

function main() {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h')) {
    showHelp()
    process.exit(0)
  }

  if (args[0] === 'install' || args.length === 0) {
    let targetDir = './skills'

    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--path' || args[i] === '-p') {
        targetDir = args[++i]
      }
    }

    install(resolve(targetDir))
    process.exit(0)
  }

  console.error(`Unknown command: ${args[0]}`)
  console.error('Run with --help for usage information')
  process.exit(1)
}

main()
