import * as project from './project.js'
import * as git from './git.js'
import * as config from './config.js'

const steps = [project, git, config]

export async function command(name) {
  let ctx = { name }
  for (const step of steps) ctx = await step.prompt(ctx)

  const created = []
  for (const step of steps) created.push(...(await step.apply(ctx)))

  console.log(`\nCreated ${ctx.projectName}/`)
  for (const path of created) console.log(`  ${path}`)
}
