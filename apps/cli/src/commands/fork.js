import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname, resolve } from 'node:path'
import { existsSync } from 'node:fs'
import * as project from './new/project.js'
import * as git from './new/git.js'
import { collectProjectFiles } from './files.js'
import { log, success, error, info, item } from '../log.js'

async function readSource(sourcePath) {
  const abs = resolve(sourcePath)

  if (sourcePath.endsWith('.bundle.json')) {
    const raw = JSON.parse(await readFile(abs, 'utf-8'))
    if (!raw.basslineBundle) throw new Error('Not a valid bassline bundle')
    return { config: raw.config, files: raw.files, label: raw.name || sourcePath }
  }

  // Directory mode
  const configPath = join(abs, 'bassline.config.json')
  if (!existsSync(configPath)) throw new Error(`No bassline.config.json found in ${abs}`)
  const config = JSON.parse(await readFile(configPath, 'utf-8'))
  const files = await collectProjectFiles(abs)
  return { config, files, label: config.name || sourcePath }
}

export async function command(sourcePath) {
  let source
  try {
    source = await readSource(sourcePath)
  } catch (e) {
    error(e.message)
    process.exitCode = 1
    return
  }

  info(`Forking from: ${source.label} (${source.files.length} files)`)
  log()

  // Prompt for new project name and git
  let ctx = {}
  ctx = await project.prompt(ctx)
  ctx = await git.prompt(ctx)

  const { dir, projectName } = ctx

  // Patch files in memory
  const patchedConfig = { ...source.config, name: projectName, fork: { from: sourcePath } }
  delete patchedConfig.installed

  const patchedFiles = source.files.map(f => {
    if (f.path === 'bassline.config.json') {
      return { path: f.path, content: JSON.stringify(patchedConfig, null, 2) + '\n' }
    }
    if (f.path === 'package.json') {
      try {
        const pkg = JSON.parse(f.content)
        pkg.name = projectName
        return { path: f.path, content: JSON.stringify(pkg, null, 2) + '\n' }
      } catch {
        return f
      }
    }
    return f
  })

  // Write all files
  await mkdir(dir, { recursive: true })
  for (const f of patchedFiles) {
    const filePath = join(dir, f.path)
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, f.content)
  }

  // Git init if requested
  if (ctx.initGit) {
    await git.apply(ctx)
  }

  log()
  success(`Forked ${source.label} → ${projectName}/`)
  item(`${patchedFiles.length} files written`)
}
