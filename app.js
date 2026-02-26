import { Platform } from './packages/core/src/platform.js'
import { reducers, scope } from './packages/core/src/modules/index.js'
import http from './packages/core/src/platforms/http.js'
import tracing from './packages/core/src/modules/tracing.js'

function deployHealth(platform) {
  const started = Date.now()
  const R = platform.classes.Resource
  const r = new R()
  r.get = () => ({ ok: true, uptime: Date.now() - started, tags: [...platform._tags] })
  const health = platform.resource(r)
  platform.root({ put: health, at: '_health' })
}
deployHealth.tags = ['health']
deployHealth.id = 'health'

function deployGreeting(platform) {
  platform.root({ put: platform.create.Slot({ value: 'hello' }), at: 'greeting' })
}
deployGreeting.id = 'greeting'

function deployCells(platform) {
  platform.root({
    put: {
      cells: {
        counter: platform.create.Slot({ value: 0, reduce: Math.max }),
        title: platform.create.Slot({ value: 'untitled' }),
        tags: platform.create.Union(),
      },
    },
  })
}
deployCells.tags = ['cells']
deployCells.id = 'deploy-cells'

function deployStore(platform) {
  platform.root({
    put: {
      store: {
        config: platform.create.Slot({ value: { name: 'My App', version: '1.0' } }),
        settings: {
          theme: platform.create.Slot({ value: 'dark' }),
          lang: platform.create.Slot({ value: 'en' }),
        },
      },
    },
  })
}
deployStore.tags = ['store']
deployStore.id = 'deploy-store'

const app = new Platform().use(reducers, scope).use(http).use(tracing)

await app.deploy(deployHealth, deployGreeting, deployCells, deployStore)

app.serve()
