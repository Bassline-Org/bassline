import { confirm } from '@inquirer/prompts'
import { writeFile } from 'node:fs/promises'
import { execSync } from 'node:child_process'
import { join } from 'node:path'

export async function prompt(ctx) {
  const initGit = await confirm({
    message: 'Initialize git repository?',
    default: true,
  })

  return { ...ctx, initGit }
}

export async function apply(ctx) {
  if (!ctx.initGit) return []

  const { dir } = ctx

  execSync('git init', { cwd: dir, stdio: 'ignore' })

  await writeFile(join(dir, '.gitignore'), 'node_modules/\n*.blit\n')

  return ['.git/', '.gitignore']
}
