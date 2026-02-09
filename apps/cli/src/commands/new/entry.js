import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export async function prompt(ctx) {
  return ctx
}

export async function apply(ctx) {
  const { dir, projectName } = ctx
  const created = []

  await writeFile(
    join(dir, 'index.js'),
    `// Import your resources here:
// import { myResource } from './resources/my-resource.js'

const name = process.env.NAME ?? '${projectName}'

// Compose and run your resources
// ...

console.log(\`\${name} started\`)
`
  )
  created.push('index.js')

  const envContent = `NAME=${projectName}\nPORT=3000\n`

  await writeFile(join(dir, '.env'), envContent)
  created.push('.env')

  await writeFile(join(dir, '.env.example'), envContent + '# Add your config here\n')
  created.push('.env.example')

  return created
}
