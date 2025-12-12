import { resource } from '@bassline/core'

/**
 * Create val routes for resource composition definitions.
 *
 * A Val is a shareable, forkable resource definition - not executable code,
 * but a composition of Bassline primitives (handlers, propagators, cells, recipes).
 *
 * Val Types:
 * - 'propagator' - A reactive computation (inputs -> handler -> output)
 * - 'recipe' - A template that creates multiple resources
 * - 'handler' - A reusable handler composition
 * - 'cell' - A shared data container definition
 * - 'plumber-rule' - A message routing rule
 *
 * Resource structure:
 * - GET  /vals                  -> list all vals
 * - GET  /vals/:owner           -> list user's vals
 * - GET  /vals/:owner/:name     -> get val definition
 * - PUT  /vals/:owner/:name     -> create/update val
 * - PUT  /vals/:owner/:name/delete -> delete val
 * - GET  /vals/:owner/:name/versions -> version history
 * - PUT  /vals/:owner/:name/fork -> fork val
 * - PUT  /vals/:owner/:name/instantiate -> instantiate recipe val
 *
 * @param {object} options - Configuration options
 * @param {import('@bassline/core').Bassline} options.bl - Bassline instance
 * @returns {object} Val routes and management functions
 */
export function createValRoutes(options = {}) {
  const { bl } = options

  /**
   * Val store - maps "owner/name" to val definition
   * @type {Map<string, object>}
   */
  const valStore = new Map()

  /**
   * Version store - maps "owner/name/version" to immutable snapshot
   * @type {Map<string, object>}
   */
  const versionStore = new Map()

  /**
   * Create a unique key for a val
   */
  function valKey(owner, name) {
    return `${owner}/${name}`
  }

  /**
   * Create or update a val definition.
   *
   * @param {string} owner - Val owner
   * @param {string} name - Val name
   * @param {object} definition - Val definition
   * @returns {object} Stored val
   */
  function createVal(owner, name, definition) {
    const key = valKey(owner, name)
    const existing = valStore.get(key)
    const version = (existing?.version ?? 0) + 1

    // Handle fork
    let parentVal = definition.parentVal || null
    let parentVersion = definition.parentVersion || null

    if (definition.fork) {
      // Fork from another val
      const sourceKey = definition.fork.replace(/^bl:\/\/\/vals\//, '')
      const source = valStore.get(sourceKey)
      if (source) {
        parentVal = `bl:///vals/${sourceKey}`
        parentVersion = definition.forkVersion ?? source.version
        // Copy definition from source if not provided
        if (!definition.definition && !definition.valType) {
          definition = {
            ...definition,
            valType: source.valType,
            definition: source.definition,
            description: source.description,
            tags: source.tags
          }
        }
      }
    }

    const val = {
      name,
      owner,
      description: definition.description || '',
      valType: definition.valType || 'propagator',
      definition: definition.definition || {},
      visibility: definition.visibility || 'public',
      tags: definition.tags || [],
      parentVal,
      parentVersion,
      version,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    valStore.set(key, val)

    // Store immutable version
    const versionKey = `${key}/${version}`
    versionStore.set(versionKey, { ...val, immutable: true })

    // Index in link system if available
    if (bl._links && parentVal) {
      bl._links.index(`bl:///vals/${key}`, { parentVal: { $ref: parentVal } })
    }

    // Dispatch event through plumber
    if (bl._plumber) {
      bl._plumber.dispatch({
        uri: `bl:///vals/${key}`,
        method: 'put',
        headers: { type: 'bl:///types/val-saved', version },
        body: { val: key, version }
      })
    }

    return val
  }

  /**
   * Delete a val.
   *
   * @param {string} owner - Val owner
   * @param {string} name - Val name
   * @returns {boolean} Whether val existed
   */
  function deleteVal(owner, name) {
    const key = valKey(owner, name)
    const existed = valStore.has(key)
    if (existed) {
      valStore.delete(key)
      // Note: versions are kept for history
    }
    return existed
  }

  /**
   * Get a val by owner and name.
   *
   * @param {string} owner - Val owner
   * @param {string} name - Val name
   * @returns {object|null} Val definition
   */
  function getVal(owner, name) {
    return valStore.get(valKey(owner, name)) || null
  }

  /**
   * Get a specific version of a val.
   *
   * @param {string} owner - Val owner
   * @param {string} name - Val name
   * @param {number} version - Version number
   * @returns {object|null} Val version
   */
  function getValVersion(owner, name, version) {
    return versionStore.get(`${owner}/${name}/${version}`) || null
  }

  /**
   * List all vals, optionally filtered by owner.
   *
   * @param {string} [owner] - Filter by owner
   * @returns {object[]} Val summaries
   */
  function listVals(owner) {
    const vals = []
    for (const [key, val] of valStore) {
      if (!owner || val.owner === owner) {
        if (val.visibility === 'public' || val.owner === owner) {
          vals.push({
            name: val.name,
            owner: val.owner,
            uri: `bl:///vals/${key}`,
            valType: val.valType,
            description: val.description,
            version: val.version,
            tags: val.tags
          })
        }
      }
    }
    return vals
  }

  /**
   * List versions of a val.
   *
   * @param {string} owner - Val owner
   * @param {string} name - Val name
   * @returns {object[]} Version summaries
   */
  function listVersions(owner, name) {
    const prefix = `${owner}/${name}/`
    const versions = []
    for (const [key, version] of versionStore) {
      if (key.startsWith(prefix)) {
        versions.push({
          version: version.version,
          uri: `bl:///vals/${key}`,
          createdAt: version.updatedAt
        })
      }
    }
    return versions.sort((a, b) => b.version - a.version)
  }

  /**
   * Instantiate a recipe val - create actual resources from the definition.
   *
   * @param {string} owner - Val owner
   * @param {string} name - Val name
   * @param {string} instanceName - Name for the instance
   * @param {object} params - Parameters for instantiation
   * @returns {Promise<object>} Created instance info
   */
  async function instantiateVal(owner, name, instanceName, params = {}) {
    const val = getVal(owner, name)
    if (!val) {
      throw new Error(`Val not found: ${owner}/${name}`)
    }

    if (val.valType !== 'recipe') {
      throw new Error(`Only recipe vals can be instantiated. This val is type: ${val.valType}`)
    }

    // Use recipes system to instantiate
    if (!bl._recipes) {
      throw new Error('Recipes module not installed')
    }

    // Create a temporary recipe from the val definition
    const recipeName = `val-${owner}-${name}-${instanceName}`
    bl._recipes.createRecipe(recipeName, {
      description: val.description,
      params: val.definition.params || {},
      resources: val.definition.resources || []
    })

    // Instantiate it
    const instance = await bl._recipes.instantiate(
      instanceName,
      `bl:///recipes/${recipeName}`,
      params
    )

    // Add source val reference for querying
    instance.sourceVal = `bl:///vals/${owner}/${name}`

    // Clean up temporary recipe
    bl._recipes.deleteRecipe(recipeName)

    return instance
  }

  // Val routes
  const valResource = resource(r => {
    // List all vals
    r.get('/', ({ headers }) => ({
      headers: { type: 'bl:///types/directory' },
      body: {
        entries: listVals().map(v => ({
          ...v,
          type: 'val'
        }))
      }
    }))

    // List user's vals
    r.get('/:owner', ({ params, headers }) => ({
      headers: { type: 'bl:///types/directory' },
      body: {
        entries: listVals(params.owner).map(v => ({
          ...v,
          type: 'val'
        }))
      }
    }))

    // Get val definition
    r.get('/:owner/:name', ({ params }) => {
      const val = getVal(params.owner, params.name)
      if (!val) return null

      return {
        headers: {
          type: 'bl:///types/val',
          visibility: val.visibility,
          version: val.version
        },
        body: {
          ...val,
          entries: [
            { name: 'versions', uri: `bl:///vals/${params.owner}/${params.name}/versions` },
            { name: 'forks', uri: `bl:///vals/${params.owner}/${params.name}/forks` }
          ]
        }
      }
    })

    // Create/update val
    r.put('/:owner/:name', ({ params, body, headers }) => {
      // Owner check via peer header
      const peer = headers?.peer || 'anonymous'
      if (peer !== params.owner && peer !== 'admin') {
        // Allow creation by anyone for now (owner is part of URI)
      }

      const val = createVal(params.owner, params.name, body || {})

      return {
        headers: {
          type: 'bl:///types/val',
          version: val.version
        },
        body: val
      }
    })

    // Delete val
    r.put('/:owner/:name/delete', ({ params, headers }) => {
      const existed = deleteVal(params.owner, params.name)
      if (!existed) return null

      return {
        headers: { type: 'bl:///types/resource-removed' },
        body: { uri: `bl:///vals/${params.owner}/${params.name}` }
      }
    })

    // Get version history
    r.get('/:owner/:name/versions', ({ params }) => {
      const versions = listVersions(params.owner, params.name)

      return {
        headers: { type: 'bl:///types/directory' },
        body: {
          entries: versions.map(v => ({
            ...v,
            name: `v${v.version}`,
            type: 'val-version'
          }))
        }
      }
    })

    // Get specific version
    r.get('/:owner/:name/versions/:version', ({ params }) => {
      const version = getValVersion(params.owner, params.name, parseInt(params.version))
      if (!version) return null

      return {
        headers: { type: 'bl:///types/val-version', version: version.version },
        body: version
      }
    })

    // Fork a val
    r.put('/:owner/:name/fork', async ({ params, body, headers }) => {
      const source = getVal(params.owner, params.name)
      if (!source) return null

      const peer = headers?.peer || 'anonymous'
      const newName = body?.name || `${source.name}-fork`

      const forked = createVal(peer, newName, {
        fork: `bl:///vals/${params.owner}/${params.name}`,
        forkVersion: body?.version || source.version,
        description: body?.description || source.description,
        tags: body?.tags || source.tags
      })

      return {
        headers: { type: 'bl:///types/val', version: forked.version },
        body: forked
      }
    })

    // Get forks (via backlinks)
    r.get('/:owner/:name/forks', async ({ params }) => {
      const uri = `bl:///vals/${params.owner}/${params.name}`

      // Query backlinks if available
      let forks = []
      if (bl._links) {
        const links = await bl.get(`bl:///links/to${uri.slice(4)}`)
        forks = links?.body?.refs?.filter(ref =>
          ref.startsWith('bl:///vals/') && ref !== uri
        ) || []
      }

      return {
        headers: { type: 'bl:///types/directory' },
        body: {
          entries: forks.map(uri => ({
            uri,
            name: uri.split('/').pop(),
            type: 'val'
          }))
        }
      }
    })

    // Get instances of this val (recipe vals only)
    r.get('/:owner/:name/instances', async ({ params }) => {
      const val = getVal(params.owner, params.name)
      if (!val) return null

      // Find instances that match this val's sourceVal
      const instances = []
      if (bl._recipes && bl._recipes._instanceStore) {
        const sourceVal = `bl:///vals/${params.owner}/${params.name}`
        for (const [instanceName, instance] of bl._recipes._instanceStore) {
          if (instance.sourceVal === sourceVal) {
            instances.push({
              name: instanceName,
              uri: `bl:///instances/${instanceName}`,
              type: 'instance',
              state: instance.state,
              resourceCount: instance.createdResources?.length || 0,
              createdAt: instance.createdAt
            })
          }
        }
      }

      return {
        headers: { type: 'bl:///types/directory' },
        body: { entries: instances }
      }
    })

    // Instantiate a recipe val
    r.put('/:owner/:name/instantiate', async ({ params, body }) => {
      try {
        const instance = await instantiateVal(
          params.owner,
          params.name,
          body?.instanceName || `${params.name}-instance`,
          body?.params || {}
        )

        return {
          headers: { type: 'bl:///types/instance' },
          body: instance
        }
      } catch (err) {
        return {
          headers: { type: 'bl:///types/error' },
          body: { error: err.message }
        }
      }
    })
  })

  /**
   * Install val routes into a Bassline instance.
   *
   * @param {import('@bassline/core').Bassline} blInstance
   * @param {object} [options] - Options
   * @param {string} [options.prefix='/vals'] - Mount prefix
   */
  function install(blInstance, { prefix = '/vals' } = {}) {
    blInstance.mount(prefix, valResource)
  }

  return {
    routes: valResource,
    install,
    createVal,
    deleteVal,
    getVal,
    getValVersion,
    listVals,
    listVersions,
    instantiateVal,
    _valStore: valStore,
    _versionStore: versionStore
  }
}
