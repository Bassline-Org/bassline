import { resource } from '@bassline/core'
import { substitute, validateParams } from './template.js'

/**
 * Create recipe routes for template-based resource composition.
 *
 * A Recipe is a template that defines multiple resources to create together.
 * An Instance is a concrete instantiation of a recipe with specific parameters.
 *
 * Resource structure:
 * - GET  /recipes           -> list all recipes
 * - GET  /recipes/:name     -> get recipe definition
 * - PUT  /recipes/:name     -> create/update recipe
 * - PUT  /recipes/:name/delete -> delete recipe
 *
 * - GET  /instances         -> list all instances
 * - GET  /instances/:name   -> get instance info
 * - PUT  /instances/:name   -> instantiate a recipe
 * - PUT  /instances/:name/delete -> delete instance and its resources
 *
 * @param {object} options - Configuration options
 * @param {import('@bassline/core').Bassline} options.bl - Bassline instance
 * @returns {object} Recipe routes and management functions
 */
export function createRecipeRoutes(options = {}) {
  const { bl } = options

  /**
   * Recipe store - maps name to recipe definition
   * @type {Map<string, object>}
   */
  const recipeStore = new Map()

  /**
   * Instance store - maps name to instance state
   * @type {Map<string, object>}
   */
  const instanceStore = new Map()

  /**
   * Create or update a recipe definition.
   *
   * @param {string} name - Recipe name
   * @param {object} definition - Recipe definition
   * @returns {object} Stored recipe
   */
  function createRecipe(name, definition) {
    const recipe = {
      name,
      description: definition.description || '',
      params: definition.params || {},
      resources: definition.resources || [],
      createdAt: recipeStore.get(name)?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    recipeStore.set(name, recipe)

    // Dispatch event through plumber
    if (bl._plumber) {
      bl._plumber.dispatch({
        uri: `bl:///recipes/${name}`,
        method: 'put',
        headers: { type: 'bl:///types/recipe-saved' },
        body: { recipe: name },
      })
    }

    return recipe
  }

  /**
   * Delete a recipe.
   *
   * @param {string} name - Recipe name
   * @returns {boolean} Whether recipe existed
   */
  function deleteRecipe(name) {
    const existed = recipeStore.has(name)
    if (existed) {
      recipeStore.delete(name)
    }
    return existed
  }

  /**
   * Get a recipe by name.
   *
   * @param {string} name - Recipe name
   * @returns {object|null} Recipe definition
   */
  function getRecipe(name) {
    return recipeStore.get(name) || null
  }

  /**
   * List all recipe names.
   *
   * @returns {string[]} Recipe names
   */
  function listRecipes() {
    return [...recipeStore.keys()]
  }

  /**
   * Instantiate a recipe with given parameters.
   *
   * @param {string} instanceName - Name for the instance
   * @param {string} recipeUri - Recipe URI (e.g., 'bl:///recipes/counter')
   * @param {object} params - Parameter values
   * @returns {Promise<object>} Instance state
   */
  async function instantiate(instanceName, recipeUri, params = {}) {
    // Extract recipe name from URI
    const recipeName = recipeUri.replace(/^bl:\/\/\/recipes\//, '')
    const recipe = getRecipe(recipeName)

    if (!recipe) {
      throw new Error(`Recipe not found: ${recipeUri}`)
    }

    // Validate and resolve parameters
    const resolvedParams = validateParams(recipe.params, params)

    // Build substitution context
    const context = {
      params: resolvedParams,
      ref: {},
    }

    // Create resources in order
    const createdResources = []

    for (const spec of recipe.resources) {
      try {
        // Substitute template variables in URI and body
        const uri = substitute(spec.uri, context)
        const body = substitute(spec.body, context)

        // Create the resource
        await bl.put(uri, {}, body)

        // Track the created resource
        const resourceRef = { id: spec.id, uri }
        createdResources.push(resourceRef)

        // Add to ref context for subsequent resources
        if (spec.id) {
          context.ref[spec.id] = uri
        }

        // Handle initial value if specified
        if (spec.init !== undefined) {
          const initValue = substitute(spec.init, context)
          await bl.put(`${uri}/value`, {}, initValue)
        }
      } catch (err) {
        // Log error but continue with other resources
        console.warn(`Failed to create resource ${spec.id}:`, err.message)
      }
    }

    // Store instance state
    const instance = {
      name: instanceName,
      recipe: recipeUri,
      params: resolvedParams,
      createdResources,
      state: 'active',
      createdAt: new Date().toISOString(),
    }

    instanceStore.set(instanceName, instance)

    // Dispatch event through plumber
    if (bl._plumber) {
      bl._plumber.dispatch({
        uri: `bl:///instances/${instanceName}`,
        method: 'put',
        headers: { type: 'bl:///types/instance-created' },
        body: {
          instance: instanceName,
          recipe: recipeUri,
          resources: createdResources.map((r) => r.uri),
        },
      })
    }

    return instance
  }

  /**
   * Delete an instance and all its created resources.
   *
   * @param {string} name - Instance name
   * @returns {Promise<boolean>} Whether instance existed
   */
  async function deleteInstance(name) {
    const instance = instanceStore.get(name)
    if (!instance) return false

    // Delete resources in reverse order (propagators before cells)
    const resourcesToDelete = [...instance.createdResources].reverse()

    for (const resource of resourcesToDelete) {
      try {
        // Try kill first (for cells, propagators, timers)
        await bl.put(`${resource.uri}/kill`, {}, {})
      } catch (err) {
        // Try delete as fallback (for monitors)
        try {
          await bl.put(`${resource.uri}/delete`, {}, {})
        } catch (err2) {
          console.warn(`Failed to delete ${resource.uri}:`, err2.message)
        }
      }
    }

    instance.state = 'deleted'
    instanceStore.delete(name)

    // Dispatch event through plumber
    if (bl._plumber) {
      bl._plumber.dispatch({
        uri: `bl:///instances/${name}`,
        method: 'delete',
        headers: { type: 'bl:///types/instance-deleted' },
        body: { instance: name },
      })
    }

    return true
  }

  /**
   * Get an instance by name.
   *
   * @param {string} name - Instance name
   * @returns {object|null} Instance state
   */
  function getInstance(name) {
    return instanceStore.get(name) || null
  }

  /**
   * List all instance names.
   *
   * @returns {string[]} Instance names
   */
  function listInstances() {
    return [...instanceStore.keys()]
  }

  // Recipe routes
  const recipeResource = resource((r) => {
    // List all recipes
    r.get('/', () => ({
      headers: { type: 'bl:///types/directory' },
      body: {
        entries: listRecipes().map((name) => {
          const recipe = recipeStore.get(name)
          return {
            name,
            type: 'recipe',
            uri: `bl:///recipes/${name}`,
            description: recipe?.description,
            paramCount: Object.keys(recipe?.params || {}).length,
            resourceCount: recipe?.resources?.length || 0,
          }
        }),
      },
    }))

    // Get recipe definition
    r.get('/:name', ({ params }) => {
      const recipe = getRecipe(params.name)
      if (!recipe) return null

      return {
        headers: { type: 'bl:///types/recipe' },
        body: recipe,
      }
    })

    // Create/update recipe
    r.put('/:name', ({ params, body }) => {
      const recipe = createRecipe(params.name, body || {})

      return {
        headers: { type: 'bl:///types/recipe' },
        body: recipe,
      }
    })

    // Delete recipe
    r.put('/:name/delete', ({ params }) => {
      const existed = deleteRecipe(params.name)
      if (!existed) return null

      return {
        headers: { type: 'bl:///types/resource-removed' },
        body: { uri: `bl:///recipes/${params.name}` },
      }
    })
  })

  // Instance routes
  const instanceResource = resource((r) => {
    // List all instances
    r.get('/', () => ({
      headers: { type: 'bl:///types/directory' },
      body: {
        entries: listInstances().map((name) => {
          const instance = instanceStore.get(name)
          return {
            name,
            type: 'instance',
            uri: `bl:///instances/${name}`,
            recipe: instance?.recipe,
            state: instance?.state,
            resourceCount: instance?.createdResources?.length || 0,
          }
        }),
      },
    }))

    // Get instance info
    r.get('/:name', ({ params }) => {
      const instance = getInstance(params.name)
      if (!instance) return null

      return {
        headers: { type: 'bl:///types/instance' },
        body: {
          ...instance,
          entries: [{ name: 'delete', uri: `bl:///instances/${params.name}/delete` }],
        },
      }
    })

    // Create instance (instantiate recipe)
    r.put('/:name', async ({ params, body }) => {
      if (!body?.recipe) {
        return {
          headers: { type: 'bl:///types/error' },
          body: { error: 'Missing required field: recipe' },
        }
      }

      try {
        const instance = await instantiate(params.name, body.recipe, body.params || {})

        return {
          headers: { type: 'bl:///types/instance' },
          body: instance,
        }
      } catch (err) {
        return {
          headers: { type: 'bl:///types/error' },
          body: { error: err.message },
        }
      }
    })

    // Delete instance
    r.put('/:name/delete', async ({ params }) => {
      const existed = await deleteInstance(params.name)
      if (!existed) return null

      return {
        headers: { type: 'bl:///types/resource-removed' },
        body: { uri: `bl:///instances/${params.name}` },
      }
    })
  })

  /**
   * Install recipe routes into a Bassline instance.
   *
   * @param {import('@bassline/core').Bassline} blInstance
   * @param {object} [options] - Options
   * @param {string} [options.recipesPrefix='/recipes'] - Mount prefix for recipes
   * @param {string} [options.instancesPrefix='/instances'] - Mount prefix for instances
   */
  function install(
    blInstance,
    { recipesPrefix = '/recipes', instancesPrefix = '/instances' } = {}
  ) {
    blInstance.mount(recipesPrefix, recipeResource)
    blInstance.mount(instancesPrefix, instanceResource)
  }

  return {
    recipeRoutes: recipeResource,
    instanceRoutes: instanceResource,
    install,
    createRecipe,
    deleteRecipe,
    getRecipe,
    listRecipes,
    instantiate,
    deleteInstance,
    getInstance,
    listInstances,
    _recipeStore: recipeStore,
    _instanceStore: instanceStore,
  }
}
