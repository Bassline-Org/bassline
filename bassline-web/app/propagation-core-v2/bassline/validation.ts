/**
 * Bassline Validation System
 * 
 * Comprehensive validation for bassline manifests including:
 * - Schema validation
 * - Semantic validation
 * - Compatibility checks
 * - Security validation
 */

import type { Bassline, BasslineAttributes, GadgetDefinition } from './types'

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
  info: ValidationInfo[]
}

export interface ValidationError {
  path: string
  message: string
  code: string
}

export interface ValidationWarning {
  path: string
  message: string
  code: string
}

export interface ValidationInfo {
  path: string
  message: string
}

export interface ValidationOptions {
  // Validation strictness levels
  strict?: boolean
  // Check for security issues
  checkSecurity?: boolean
  // Check for deprecated patterns
  checkDeprecated?: boolean
  // Check for best practices
  checkBestPractices?: boolean
  // Maximum allowed complexity
  maxComplexity?: number
  // Allowed attribute namespaces
  allowedNamespaces?: string[]
}

const DEFAULT_OPTIONS: ValidationOptions = {
  strict: false,
  checkSecurity: true,
  checkDeprecated: true,
  checkBestPractices: true,
  maxComplexity: 1000,
  allowedNamespaces: ['bassline', 'permissions', 'runtime', 'validation', 'ui', 'dev']
}

/**
 * Validate a bassline manifest
 */
export function validateBassline(
  bassline: Bassline,
  options: ValidationOptions = {}
): ValidationResult {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []
  const info: ValidationInfo[] = []
  
  // Schema validation
  validateSchema(bassline, errors, warnings, opts)
  
  // Semantic validation
  validateSemantics(bassline, errors, warnings, opts)
  
  // Attribute validation
  if (bassline.attributes) {
    validateAttributes(bassline.attributes, 'attributes', errors, warnings, opts)
  }
  
  // Build validation
  if (bassline.build) {
    validateBuild(bassline.build, errors, warnings, info, opts)
  }
  
  // Interface validation
  if (bassline.interface) {
    validateInterface(bassline.interface, errors, warnings, opts)
  }
  
  // Dependencies validation
  if (bassline.dependencies) {
    validateDependencies(bassline.dependencies, errors, warnings, opts)
  }
  
  // Security validation
  if (opts.checkSecurity) {
    validateSecurity(bassline, errors, warnings)
  }
  
  // Complexity validation
  if (opts.maxComplexity) {
    const complexity = calculateComplexity(bassline)
    if (complexity > opts.maxComplexity) {
      warnings.push({
        path: 'root',
        message: `Bassline complexity (${complexity}) exceeds maximum (${opts.maxComplexity})`,
        code: 'COMPLEXITY_HIGH'
      })
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    info
  }
}

/**
 * Validate bassline schema
 */
function validateSchema(
  bassline: Bassline,
  errors: ValidationError[],
  warnings: ValidationWarning[],
  opts: ValidationOptions
): void {
  // Required fields
  if (!bassline.name) {
    errors.push({
      path: 'name',
      message: 'Bassline must have a name',
      code: 'MISSING_NAME'
    })
  } else if (!/^[a-zA-Z0-9-_]+$/.test(bassline.name)) {
    warnings.push({
      path: 'name',
      message: 'Bassline name should only contain alphanumeric characters, hyphens, and underscores',
      code: 'INVALID_NAME_FORMAT'
    })
  }
  
  // Version format
  if (bassline.version && !/^\d+\.\d+\.\d+(-.*)?$/.test(bassline.version)) {
    warnings.push({
      path: 'version',
      message: 'Version should follow semantic versioning (e.g., 1.0.0)',
      code: 'INVALID_VERSION_FORMAT'
    })
  }
  
  // Must have something to build or be a pure interface
  if (!bassline.build && !bassline.interface && !bassline.dependencies) {
    errors.push({
      path: 'root',
      message: 'Bassline must define build, interface, or dependencies',
      code: 'EMPTY_BASSLINE'
    })
  }
}

/**
 * Validate semantic correctness
 */
function validateSemantics(
  bassline: Bassline,
  errors: ValidationError[],
  warnings: ValidationWarning[],
  opts: ValidationOptions
): void {
  // Check for conflicting attributes
  const attrs = bassline.attributes
  if (attrs) {
    if (attrs['bassline.pure'] && attrs['bassline.mutable']) {
      errors.push({
        path: 'attributes',
        message: 'Cannot be both pure and mutable',
        code: 'CONFLICTING_ATTRIBUTES'
      })
    }
    
    if (attrs['bassline.frozen'] && attrs['bassline.mutable']) {
      errors.push({
        path: 'attributes',
        message: 'Cannot be both frozen and mutable',
        code: 'CONFLICTING_ATTRIBUTES'
      })
    }
  }
  
  // Check dynamic features
  if (attrs?.['bassline.dynamic-topology']) {
    const config = attrs['bassline.dynamic-topology']
    if (typeof config === 'object' && config !== null) {
      if (!('schemaContact' in config)) {
        errors.push({
          path: 'attributes.bassline.dynamic-topology',
          message: 'Dynamic topology requires schemaContact',
          code: 'MISSING_SCHEMA_CONTACT'
        })
      }
    }
  }
}

/**
 * Validate attributes
 */
function validateAttributes(
  attributes: BasslineAttributes,
  path: string,
  errors: ValidationError[],
  warnings: ValidationWarning[],
  opts: ValidationOptions
): void {
  for (const [key, value] of Object.entries(attributes)) {
    const attrPath = `${path}.${key}`
    
    // Check namespace
    if (!key.includes('.') && !key.startsWith('x-')) {
      if (opts.checkBestPractices) {
        warnings.push({
          path: attrPath,
          message: `Attribute should be namespaced (e.g., "bassline.${key}") or use x- prefix for custom`,
          code: 'UNNAMESPACED_ATTRIBUTE'
        })
      }
    } else if (key.includes('.')) {
      const namespace = key.split('.')[0]
      if (opts.allowedNamespaces && !opts.allowedNamespaces.includes(namespace) && !namespace.startsWith('x-')) {
        warnings.push({
          path: attrPath,
          message: `Unknown namespace "${namespace}"`,
          code: 'UNKNOWN_NAMESPACE'
        })
      }
    }
    
    // Check well-known attributes
    validateWellKnownAttribute(key, value, attrPath, errors, warnings)
  }
}

/**
 * Validate well-known attributes
 */
function validateWellKnownAttribute(
  key: string,
  value: unknown,
  path: string,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  switch (key) {
    case 'bassline.pure':
    case 'bassline.mutable':
    case 'bassline.frozen':
      if (typeof value !== 'boolean') {
        errors.push({
          path,
          message: `${key} must be a boolean`,
          code: 'INVALID_TYPE'
        })
      }
      break
      
    case 'permissions.modify':
    case 'permissions.execute':
    case 'permissions.read':
      if (!['none', 'owner', 'team', 'anyone'].includes(value as string)) {
        errors.push({
          path,
          message: `${key} must be one of: none, owner, team, anyone`,
          code: 'INVALID_PERMISSION'
        })
      }
      break
      
    case 'bassline.dynamic-attributes':
    case 'bassline.dynamic-topology':
      if (typeof value !== 'object' || value === null) {
        errors.push({
          path,
          message: `${key} must be an object`,
          code: 'INVALID_TYPE'
        })
      }
      break
  }
}

/**
 * Validate build section
 */
function validateBuild(
  build: NonNullable<Bassline['build']>,
  errors: ValidationError[],
  warnings: ValidationWarning[],
  info: ValidationInfo[],
  opts: ValidationOptions
): void {
  // Validate topology
  if (build.topology) {
    validateTopology(build.topology, 'build.topology', errors, warnings)
  }
  
  // Validate gadget
  if (build.gadget) {
    validateGadget(build.gadget, 'build.gadget', errors, warnings)
  }
  
  // Validate gadgets array
  if (build.gadgets) {
    build.gadgets.forEach((gadget, i) => {
      validateGadget(gadget, `build.gadgets[${i}]`, errors, warnings)
    })
  }
}

/**
 * Validate topology
 */
function validateTopology(
  topology: any,
  path: string,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  // Check for duplicate contact IDs
  if (topology.contacts && Array.isArray(topology.contacts)) {
    const ids = new Set<string>()
    for (const contact of topology.contacts) {
      if (ids.has(contact.id)) {
        errors.push({
          path: `${path}.contacts`,
          message: `Duplicate contact ID: ${contact.id}`,
          code: 'DUPLICATE_ID'
        })
      }
      ids.add(contact.id)
    }
  }
  
  // Validate wires reference existing contacts
  if (topology.wires && Array.isArray(topology.wires)) {
    const contactIds = new Set(
      topology.contacts?.map((c: any) => c.id) || []
    )
    
    for (const wire of topology.wires) {
      if (!contactIds.has(wire.fromId) && !wire.fromId.startsWith('@')) {
        warnings.push({
          path: `${path}.wires`,
          message: `Wire references unknown contact: ${wire.fromId}`,
          code: 'UNKNOWN_CONTACT'
        })
      }
      if (!contactIds.has(wire.toId) && !wire.toId.startsWith('@')) {
        warnings.push({
          path: `${path}.wires`,
          message: `Wire references unknown contact: ${wire.toId}`,
          code: 'UNKNOWN_CONTACT'
        })
      }
    }
  }
}

/**
 * Validate gadget definition
 */
function validateGadget(
  gadget: GadgetDefinition,
  path: string,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  if (!gadget.id) {
    errors.push({
      path,
      message: 'Gadget must have an ID',
      code: 'MISSING_GADGET_ID'
    })
  }
  
  // Check gadget type
  if (gadget.type && !['primitive', 'composite', 'dynamic'].includes(gadget.type)) {
    warnings.push({
      path: `${path}.type`,
      message: `Unknown gadget type: ${gadget.type}`,
      code: 'UNKNOWN_GADGET_TYPE'
    })
  }
  
  // Validate nested bassline
  if (gadget.bassline) {
    const result = validateBassline(gadget.bassline)
    result.errors.forEach(e => errors.push({ ...e, path: `${path}.bassline.${e.path}` }))
    result.warnings.forEach(w => warnings.push({ ...w, path: `${path}.bassline.${w.path}` }))
  }
}

/**
 * Validate interface definition
 */
function validateInterface(
  iface: NonNullable<Bassline['interface']>,
  errors: ValidationError[],
  warnings: ValidationWarning[],
  opts: ValidationOptions
): void {
  // Check for special @ contacts
  const allContacts = [...(iface.inputs || []), ...(iface.outputs || [])]
  for (const contact of allContacts) {
    if (contact.startsWith('@') && !['@config', '@network-definition', '@schema'].includes(contact)) {
      if (opts.checkBestPractices) {
        warnings.push({
          path: 'interface',
          message: `Unknown special contact: ${contact}`,
          code: 'UNKNOWN_SPECIAL_CONTACT'
        })
      }
    }
  }
}

/**
 * Validate dependencies
 */
function validateDependencies(
  deps: Record<string, string>,
  errors: ValidationError[],
  warnings: ValidationWarning[],
  opts: ValidationOptions
): void {
  for (const [name, spec] of Object.entries(deps)) {
    // Check dependency format
    if (!spec.includes('@') && !spec.startsWith('http') && !spec.startsWith('file:')) {
      warnings.push({
        path: `dependencies.${name}`,
        message: 'Dependency should include version (e.g., "package@1.0.0") or be a URL',
        code: 'INVALID_DEPENDENCY_FORMAT'
      })
    }
  }
}

/**
 * Security validation
 */
function validateSecurity(
  bassline: Bassline,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  // Check for potentially dangerous patterns
  const jsonStr = JSON.stringify(bassline)
  
  // Check for script injection attempts
  if (jsonStr.includes('<script') || jsonStr.includes('javascript:')) {
    errors.push({
      path: 'root',
      message: 'Potential script injection detected',
      code: 'SECURITY_SCRIPT_INJECTION'
    })
  }
  
  // Check for excessive permissions
  const perms = bassline.attributes?.['permissions.modify']
  if (perms === 'anyone') {
    warnings.push({
      path: 'attributes.permissions.modify',
      message: 'Setting modify permissions to "anyone" may be a security risk',
      code: 'SECURITY_OPEN_PERMISSIONS'
    })
  }
  
  // Check for remote dependencies without HTTPS
  if (bassline.dependencies) {
    for (const [name, url] of Object.entries(bassline.dependencies)) {
      if (url.startsWith('http://')) {
        warnings.push({
          path: `dependencies.${name}`,
          message: 'Use HTTPS for remote dependencies',
          code: 'SECURITY_INSECURE_DEPENDENCY'
        })
      }
    }
  }
}

/**
 * Calculate bassline complexity
 */
function calculateComplexity(bassline: Bassline): number {
  let complexity = 0
  
  // Count entities
  if (bassline.build?.topology) {
    const topo = bassline.build.topology
    complexity += (topo.contacts?.length || 0) * 1
    complexity += (topo.wires?.length || 0) * 2
    complexity += (topo.subgroups?.length || 0) * 10
  }
  
  if (bassline.build?.gadgets) {
    complexity += bassline.build.gadgets.length * 5
  }
  
  // Add complexity for dynamic features
  if (bassline.attributes?.['bassline.dynamic-topology']) {
    complexity += 20
  }
  if (bassline.attributes?.['bassline.dynamic-attributes']) {
    complexity += 10
  }
  
  // Add complexity for dependencies
  complexity += Object.keys(bassline.dependencies || {}).length * 5
  
  return complexity
}

/**
 * Validate that a bassline is compatible with a specific version
 */
export function validateCompatibility(
  bassline: Bassline,
  targetVersion: string
): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []
  const info: ValidationInfo[] = []
  
  // Parse version
  const [major, minor] = targetVersion.split('.').map(Number)
  
  // Check for features that require specific versions
  if (bassline.attributes?.['bassline.dynamic-topology']) {
    if (major < 2) {
      errors.push({
        path: 'attributes.bassline.dynamic-topology',
        message: `Dynamic topology requires version 2.0.0 or higher`,
        code: 'INCOMPATIBLE_FEATURE'
      })
    }
  }
  
  return { valid: errors.length === 0, errors, warnings, info }
}