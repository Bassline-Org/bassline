import * as project from './project.js'
import * as git from './git.js'
import * as lexicon from './lexicon.js'
import * as config from './config.js'
import * as entry from './entry.js'
import { log, success, item } from '../../log.js'

const steps = [project, git, lexicon, config, entry]

export async function command(name) {
  let ctx = { name }
  for (const step of steps) ctx = await step.prompt(ctx)

  const created = []
  for (const step of steps) created.push(...(await step.apply(ctx)))

  log()
  success(`Created ${ctx.projectName}/`)
  for (const path of created) item(path)
}
