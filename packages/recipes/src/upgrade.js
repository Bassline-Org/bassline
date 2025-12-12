import { createRecipeRoutes } from './recipe.js'

/**
 * Install recipes into a Bassline instance.
 *
 * Recipes enable template-based composition of multiple resources.
 * One PUT to /instances creates cells, propagators, and other
 * resources defined in a recipe template.
 *
 * @param {import('@bassline/core').Bassline} bl
 */
export default function installRecipes(bl) {
  const recipes = createRecipeRoutes({ bl })
  recipes.install(bl)

  // Expose for other modules
  bl._recipes = recipes

  // Set up plumber rules for recipe events
  if (bl._plumber) {
    bl._plumber.addRule('recipe-events', {
      match: { headers: { type: '^bl:///types/recipe-' } },
      port: 'recipe-changes',
    })

    bl._plumber.addRule('instance-events', {
      match: { headers: { type: '^bl:///types/instance-' } },
      port: 'instance-changes',
    })
  }

  console.log('Recipes installed')
}
