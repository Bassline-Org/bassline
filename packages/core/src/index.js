export { Bassline } from './bassline.js'
export { RouterBuilder, routes } from './router.js'
export { createLinkIndex, collectRefs } from './links.js'
export { matchesPattern } from './match.js'
export { createPlumber } from './plumber.js'
export { createInstallRoutes } from './install.js'

// Upgrade modules for dynamic installation
export { default as upgradeLinks } from './upgrade-links.js'
export { default as upgradePlumber } from './upgrade-plumber.js'
