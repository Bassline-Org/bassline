import { Store } from '@bassline/core'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'

export class FileStore extends Store {
  constructor(basePath) {
    super()
    this.basePath = basePath
  }

  pathFor(uri) {
    const path = new URL(uri).pathname
    return join(this.basePath, path + '.json')
  }

  load(uri) {
    const file = this.pathFor(uri)
    if (!existsSync(file)) return null
    return JSON.parse(readFileSync(file, 'utf8'))
  }

  save(uri, doc) {
    const file = this.pathFor(uri)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, JSON.stringify(doc, null, 2))
  }
}
