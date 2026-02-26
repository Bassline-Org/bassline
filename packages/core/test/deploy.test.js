import { describe, it, expect } from 'vitest'
import { Platform } from '../src/platform.js'
import { reducers, scope } from '../src/modules/index.js'

function setup() {
  const p = new Platform()
  p.use(reducers, scope)
  return p
}

describe('platform.use', () => {
  it('loads a module (class available on create)', () => {
    const p = new Platform()
    expect(p.classes.Slot).toBeUndefined()
    p.use(reducers)
    expect(p.classes.Slot).toBeDefined()
  })

  it('chains: p.use(a).use(b)', () => {
    const p = new Platform()
    const result = p.use(reducers).use(scope)
    expect(result).toBe(p)
    expect(p.classes.Slot).toBeDefined()
    expect(p.classes.Scope).toBeDefined()
  })

  it('multiple in one call: p.use(a, b)', () => {
    const p = new Platform()
    p.use(reducers, scope)
    expect(p.classes.Slot).toBeDefined()
    expect(p.classes.Scope).toBeDefined()
  })
})

describe('platform.root', () => {
  it('returns a Scope', () => {
    const p = setup()
    const root = p.root
    expect(typeof root).toBe('function')
    expect(root({})).toEqual({ hrefs: [] })
  })

  it('same instance on repeated access', () => {
    const p = setup()
    expect(p.root).toBe(p.root)
  })

  it('scripts can mount into root', () => {
    const p = setup()
    const slot = p.create.Slot({ value: 42 })
    p.root({ put: slot, at: 'x' })
    expect(p.root({ at: 'x' })({})).toBe(42)
  })
})

describe('platform.deploy — basic', () => {
  it('runs script that mounts into root', async () => {
    const p = setup()
    function myDeploy(platform) {
      const counter = platform.create.Slot({ value: 0 })
      platform.root({ put: counter, at: 'counter' })
    }
    await p.deploy(myDeploy)
    expect(p.root({ has: 'counter' })).toBe(true)
  })

  it('second script sees first scripts mounts', async () => {
    const p = setup()

    function first(platform) {
      platform.root({ put: platform.create.Slot({ value: 10 }), at: 'x' })
    }
    function second(platform) {
      const x = platform.root({ at: 'x' })
      platform.root({ put: platform.create.Slot({ value: x({}) * 2 }), at: 'y' })
    }
    second.dependencies = ['X']
    first.tags = ['X']

    await p.deploy(first, second)
    expect(p.root({ at: 'y' })({})).toBe(20)
  })

  it('returns platform for chaining', async () => {
    const p = setup()
    function noop() {}
    expect(await p.deploy(noop)).toBe(p)
  })
})

describe('platform.deploy — dependency ordering', () => {
  it('script with dependencies runs after provider', async () => {
    const order = []

    function a(_p) {
      order.push('a')
    }
    a.tags = ['A']

    function b(_p) {
      order.push('b')
    }
    b.dependencies = ['A']

    // Pass b first — should still run a first
    await setup().deploy(b, a)
    expect(order).toEqual(['a', 'b'])
  })

  it('three-script chain: A → B → C', async () => {
    const order = []

    function a(_p) {
      order.push('a')
    }
    a.tags = ['A']

    function b(_p) {
      order.push('b')
    }
    b.tags = ['B']
    b.dependencies = ['A']

    function c(_p) {
      order.push('c')
    }
    c.dependencies = ['B']

    await setup().deploy(c, b, a)
    expect(order).toEqual(['a', 'b', 'c'])
  })

  it('diamond dependency: D depends on B and C, both depend on A', async () => {
    const order = []

    function a(_p) {
      order.push('a')
    }
    a.tags = ['A']

    function b(_p) {
      order.push('b')
    }
    b.tags = ['B']
    b.dependencies = ['A']

    function c(_p) {
      order.push('c')
    }
    c.tags = ['C']
    c.dependencies = ['A']

    function d(_p) {
      order.push('d')
    }
    d.dependencies = ['B', 'C']

    await setup().deploy(d, c, b, a)
    // A must come first, D must come last, B and C in between
    expect(order[0]).toBe('a')
    expect(order[3]).toBe('d')
    expect(order).toContain('b')
    expect(order).toContain('c')
  })

  it('script providing multiple tags satisfies multiple consumers', async () => {
    const order = []

    function provider(_p) {
      order.push('provider')
    }
    provider.tags = ['A', 'B']

    function needsA(_p) {
      order.push('needsA')
    }
    needsA.dependencies = ['A']

    function needsB(_p) {
      order.push('needsB')
    }
    needsB.dependencies = ['B']

    await setup().deploy(needsA, needsB, provider)
    expect(order[0]).toBe('provider')
    expect(order).toContain('needsA')
    expect(order).toContain('needsB')
  })

  it('cross-deploy dependency: tag from previous deploy satisfies later deploy', async () => {
    const p = setup()
    const order = []

    function a(_pl) {
      order.push('a')
    }
    a.tags = ['A']

    function b(_pl) {
      order.push('b')
    }
    b.dependencies = ['A']

    await p.deploy(a)
    await p.deploy(b) // 'A' already satisfied from previous deploy
    expect(order).toEqual(['a', 'b'])
  })

  it('scripts without tags/deps preserve input order', async () => {
    const order = []
    function x(_p) {
      order.push('x')
    }
    function y(_p) {
      order.push('y')
    }
    function z(_p) {
      order.push('z')
    }

    await setup().deploy(x, y, z)
    expect(order).toEqual(['x', 'y', 'z'])
  })

  it('throws on missing dependency', async () => {
    function broken(_p) {}
    broken.dependencies = ['doesNotExist']

    await expect(setup().deploy(broken)).rejects.toThrow('missing dependency')
  })

  it('throws on circular dependency', async () => {
    function a(_p) {}
    a.tags = ['A']
    a.dependencies = ['B']

    function b(_p) {}
    b.tags = ['B']
    b.dependencies = ['A']

    await expect(setup().deploy(a, b)).rejects.toThrow('circular')
  })

  it('self-dependency throws circular', async () => {
    function a(_p) {}
    a.tags = ['A']
    a.dependencies = ['A']

    await expect(setup().deploy(a)).rejects.toThrow('circular')
  })
})

describe('platform.deploy — async', () => {
  it('awaits async deploy scripts', async () => {
    const order = []
    async function slow(_p) {
      await new Promise(r => setTimeout(r, 10))
      order.push('slow')
    }
    slow.tags = ['slow']

    function fast(_p) {
      order.push('fast')
    }
    fast.dependencies = ['slow']

    await setup().deploy(fast, slow)
    expect(order).toEqual(['slow', 'fast'])
  })

  it('awaits async skip function', async () => {
    let ran = false
    function skippable(_p) {
      ran = true
    }
    skippable.skip = async () => {
      await new Promise(r => setTimeout(r, 5))
      return true
    }

    await setup().deploy(skippable)
    expect(ran).toBe(false)
  })
})

describe('platform.deploy — idempotency', () => {
  it('script with .id only runs once', async () => {
    let count = 0
    function tracked(_p) {
      count++
    }
    tracked.id = 'once-only'

    const p = setup()
    await p.deploy(tracked)
    await p.deploy(tracked)
    expect(count).toBe(1)
  })

  it('script with .id across separate deploy calls — still once', async () => {
    let count = 0
    function tracked(_p) {
      count++
    }
    tracked.id = 'cross-call'

    const p = setup()
    await p.deploy(tracked)
    await p.deploy(tracked)
    await p.deploy(tracked)
    expect(count).toBe(1)
  })

  it('script without .id runs every time', async () => {
    let count = 0
    function untracked(_p) {
      count++
    }

    const p = setup()
    await p.deploy(untracked)
    await p.deploy(untracked)
    expect(count).toBe(2)
  })

  it('.skip returning true prevents execution', async () => {
    let ran = false
    function skippable(_p) {
      ran = true
    }
    skippable.skip = () => true

    await setup().deploy(skippable)
    expect(ran).toBe(false)
  })

  it('.skip returning false allows execution', async () => {
    let ran = false
    function skippable(_p) {
      ran = true
    }
    skippable.skip = () => false

    await setup().deploy(skippable)
    expect(ran).toBe(true)
  })

  it('skipped scripts tags still satisfy later dependencies', async () => {
    const p = setup()

    function a(_pl) {}
    a.tags = ['A']
    a.skip = () => true

    function b(_pl) {}
    b.dependencies = ['A']

    // a is skipped but its tag 'A' should still be registered
    await p.deploy(a, b)

    // Subsequent deploy depending on 'A' should also work
    function c(_pl) {}
    c.dependencies = ['A']
    await p.deploy(c) // should not throw 'missing dependency'
  })

  it('empty deploy is a no-op', async () => {
    const p = setup()
    expect(await p.deploy()).toBe(p)
  })
})

describe('platform.deploy — upgrade pattern', () => {
  it('deploy v1, then v2 upgrade modifies the tree', async () => {
    const p = setup()

    function v1(platform) {
      const counter = platform.create.Slot({ value: 0 })
      platform.root({ put: { cells: { counter } } })
    }
    v1.tags = ['cells']
    v1.id = 'cells-v1'

    function v2(platform) {
      const cells = platform.root({ at: 'cells' })
      cells({ put: platform.create.Union(), at: 'tags' })
    }
    v2.dependencies = ['cells']
    v2.id = 'cells-v2'

    await p.deploy(v1, v2)

    const cells = p.root({ at: 'cells' })
    expect(cells({}).hrefs).toContain('counter')
    expect(cells({}).hrefs).toContain('tags')
  })

  it('v2 uses has/meta for internal idempotency', async () => {
    const p = setup()

    function v1(platform) {
      const counter = platform.create.Slot({ value: 0 })
      platform.root({ put: counter, at: 'counter', meta: { version: '1.0' } })
    }
    v1.tags = ['counter']

    let v2RunCount = 0
    function v2(platform) {
      v2RunCount++
      const meta = platform.root({ meta: 'counter' })
      if (meta?.version === '2.0') return
      platform.root({ put: null, at: 'counter' })
      platform.root({
        put: platform.create.Max({ value: 0 }),
        at: 'counter',
        meta: { version: '2.0' },
      })
    }
    v2.dependencies = ['counter']

    await p.deploy(v1, v2)
    expect(p.root({ meta: 'counter' })).toEqual({ version: '2.0' })

    // Run v2 again (no .id, so it executes again) — but internal check makes it a no-op
    await p.deploy(v2)
    expect(v2RunCount).toBe(2) // ran twice, but second time was a no-op
    expect(p.root({ meta: 'counter' })).toEqual({ version: '2.0' })
  })

  it('running v2 twice with .id is a no-op', async () => {
    const p = setup()

    function v1(platform) {
      platform.root({ put: platform.create.Slot({ value: 0 }), at: 'x' })
    }
    v1.tags = ['X']
    v1.id = 'x-v1'

    let upgradeCount = 0
    function v2(platform) {
      upgradeCount++
      platform.root({ put: null, at: 'x' })
      platform.root({ put: platform.create.Max({ value: 0 }), at: 'x' })
    }
    v2.dependencies = ['X']
    v2.id = 'x-v2'

    await p.deploy(v1, v2)
    await p.deploy(v1, v2) // second call — both skipped via .id
    expect(upgradeCount).toBe(1)
  })
})

describe('realistic deployment', () => {
  it('full system: modules, async deploy, DAG, upgrades, idempotency, scope tree', async () => {
    const p = setup()
    const mountEvents = []
    p.on('resource.mounted', e => mountEvents.push(e.name))

    // --- Deploy scripts ---

    function deployCells(platform) {
      platform.root({
        put: {
          cells: {
            counter: platform.create.Slot({ value: 0, reduce: Math.max }),
            title: platform.create.Slot({ value: 'untitled' }),
            total: platform.create.Slot({ value: 0, reduce: Math.max }),
          },
        },
      })
    }
    deployCells.tags = ['cells']
    deployCells.id = 'deploy-cells'

    async function deployStore(platform) {
      // Simulate async I/O (loading config from disk/network)
      const config = await new Promise(resolve => setTimeout(() => resolve({ name: 'My App', version: '1.0' }), 10))
      platform.root({
        put: {
          store: {
            config: platform.create.Slot({ value: config }),
          },
        },
      })
    }
    deployStore.tags = ['store']
    deployStore.id = 'deploy-store'

    function deployCompute(platform) {
      const cells = platform.root({ at: 'cells' })
      const counter = cells({ at: 'counter' })
      const total = cells({ at: 'total' })
      // Wire: total tracks counter (simple propagation by reading + writing)
      const current = counter({})
      total({ put: current })
    }
    deployCompute.dependencies = ['cells']
    deployCompute.tags = ['compute']
    deployCompute.id = 'deploy-compute'

    function deployApp(platform) {
      const cells = platform.root({ at: 'cells' })
      const store = platform.root({ at: 'store' })
      // App resource: reads from cells and store to produce a summary
      const app = platform.create.Slot({
        value: {
          counter: cells({ at: 'counter' })({}),
          title: cells({ at: 'title' })({}),
          config: store({ at: 'config' })({}),
        },
      })
      platform.root({ put: app, at: 'app', meta: { version: '1.0' } })
    }
    deployApp.dependencies = ['cells', 'store']
    deployApp.tags = ['app']
    deployApp.id = 'deploy-app'

    function upgradeAddTags(platform) {
      const cells = platform.root({ at: 'cells' })
      if (cells({ has: 'tags' })) return // idempotent
      cells({ put: platform.create.Union(), at: 'tags' })
    }
    upgradeAddTags.dependencies = ['cells']
    upgradeAddTags.id = 'cells-add-tags'

    async function upgradeStoreV2(platform) {
      const store = platform.root({ at: 'store' })
      const config = store({ at: 'config' })
      const current = config({})
      // Simulate async migration
      await new Promise(r => setTimeout(r, 5))
      if (!current.theme) {
        config({ put: { ...current, theme: 'dark' } })
      }
    }
    upgradeStoreV2.dependencies = ['store']
    upgradeStoreV2.id = 'store-v2'

    // --- Deploy everything (scripts in arbitrary order) ---
    await p.deploy(deployApp, upgradeStoreV2, deployCompute, upgradeAddTags, deployStore, deployCells)

    // --- Verify scope tree ---
    const root = p.root
    expect(root({}).hrefs).toContain('cells')
    expect(root({}).hrefs).toContain('store')
    expect(root({}).hrefs).toContain('app')

    // Cells scope
    const cells = root({ at: 'cells' })
    expect(cells({}).hrefs).toContain('counter')
    expect(cells({}).hrefs).toContain('title')
    expect(cells({}).hrefs).toContain('total')
    expect(cells({}).hrefs).toContain('tags') // from upgrade

    // Store scope
    const store = root({ at: 'store' })
    const config = store({ at: 'config' })
    const configVal = config({})
    expect(configVal.name).toBe('My App')
    expect(configVal.version).toBe('1.0')
    expect(configVal.theme).toBe('dark') // from store-v2 upgrade

    // App resource
    const app = root({ at: 'app' })
    const appVal = app({})
    expect(appVal.counter).toBe(0)
    expect(appVal.title).toBe('untitled')
    expect(appVal.config).toEqual({ name: 'My App', version: '1.0' })

    // Metadata
    expect(root({ meta: 'app' })).toEqual({ version: '1.0' })

    // Walk works end-to-end
    expect(root({ walk: 'cells/counter' })({})).toBe(0)
    expect(root({ walk: 'store/config' })({})).toEqual({ name: 'My App', version: '1.0', theme: 'dark' })

    // Events fired during deployment
    expect(mountEvents.length).toBeGreaterThan(0)
    expect(mountEvents).toContain('cells')
    expect(mountEvents).toContain('store')
    expect(mountEvents).toContain('app')

    // --- Idempotency: deploy + upgrade again ---
    await p.deploy(deployApp, upgradeStoreV2, deployCompute, upgradeAddTags, deployStore, deployCells)

    // upgrade scripts with .id should not have run again
    // deployCells/deployStore/etc (no .id) will re-run but produce same tree structure
    // The key check: tags cell still present and config still has theme
    expect(cells({}).hrefs).toContain('tags')
    const configAfter = store({ at: 'config' })({})
    expect(configAfter.theme).toBe('dark')

    // Mutate state and verify it persists
    cells({ at: 'counter' })({ put: 42 })
    expect(root({ walk: 'cells/counter' })({})).toBe(42)
    cells({ at: 'total' })({ put: 42 })
    expect(root({ walk: 'cells/total' })({})).toBe(42)
  })

  it('async scripts block dependents until resolved', async () => {
    const order = []

    async function slow(_p) {
      await new Promise(r => setTimeout(r, 20))
      order.push('slow')
    }
    slow.tags = ['slow']

    async function medium(_p) {
      await new Promise(r => setTimeout(r, 5))
      order.push('medium')
    }
    medium.tags = ['medium']
    medium.dependencies = ['slow']

    function fast(_p) {
      order.push('fast')
    }
    fast.dependencies = ['slow', 'medium']

    await setup().deploy(fast, medium, slow)
    expect(order).toEqual(['slow', 'medium', 'fast'])
  })
})
