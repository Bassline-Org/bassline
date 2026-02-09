import { confirm } from '@inquirer/prompts'

export async function prompt(ctx) {
  const initLexicon = await confirm({
    message: 'Initialize protocol definitions?',
    default: true,
  })

  return { ...ctx, initLexicon }
}

export async function apply() {
  return []
}
