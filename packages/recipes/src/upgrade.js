import { createRecipeRoutes } from './recipe.js'

/**
 * Install recipes into a Bassline instance.
 *
 * Recipes enable template-based composition of multiple resources.
 * One PUT to /instances creates cells, propagators, and other
 * resources defined in a recipe template.
 * @param {import('@bassline/core').Bassline} bl
 */
export default function installRecipes(bl) {
  const recipes = createRecipeRoutes({ bl })
  recipes.install(bl)

  bl.setModule('recipes', recipes)

  // Recipe and instance events are sent through plumber.
  // Consumers can add rules to route these events as needed:
  //   PUT bl:///plumb/rules/my-rule { match: { type: 'bl:///types/recipe-saved' }, to: 'bl:///my/handler' }

  console.log('Recipes installed')
}
