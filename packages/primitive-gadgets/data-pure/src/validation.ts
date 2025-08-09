/**
 * Pure data validation gadgets
 * These gadgets validate data against schemas and patterns
 */

import type { PrimitiveGadget } from '@bassline/core'

export function validateSchema(): PrimitiveGadget {
  return {
    id: 'validate-schema',
    name: 'Validate Schema',
    inputs: ['data', 'schema'],
    outputs: ['valid', 'errors'],
    activation: (inputs) => inputs.has('data') && inputs.has('schema'),
    body: async (inputs) => {
      const data = inputs.get('data')
      const schema = inputs.get('schema')
      
      try {
        const Ajv = (await import('ajv')).default
        const ajv = new Ajv({ allErrors: true })
        const validate = ajv.compile(schema as any)
        const valid = validate(data)
        
        return new Map([
          ['valid', valid],
          ['errors', validate.errors || []]
        ])
      } catch (error) {
        return new Map([
          ['valid', false],
          ['errors', [{ message: error instanceof Error ? error.message : String(error) }]]
        ])
      }
    },
    description: 'Validates data against JSON Schema',
    category: 'data',
    isPure: true
  }
}

export function validateEmail(): PrimitiveGadget {
  return {
    id: 'validate-email',
    name: 'Validate Email',
    inputs: ['email'],
    outputs: ['valid', 'error'],
    activation: (inputs) => inputs.has('email'),
    body: async (inputs) => {
      const email = String(inputs.get('email'))
      
      // RFC 5322 compliant email regex
      const emailRegex = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
      
      const valid = emailRegex.test(email)
      
      return new Map([
        ['valid', valid],
        ['error', valid ? null : 'Invalid email format']
      ])
    },
    description: 'Validates email address format',
    category: 'data',
    isPure: true
  }
}

export function validateUrl(): PrimitiveGadget {
  return {
    id: 'validate-url',
    name: 'Validate URL',
    inputs: ['url'],
    outputs: ['valid', 'parsed', 'error'],
    activation: (inputs) => inputs.has('url'),
    body: async (inputs) => {
      const url = String(inputs.get('url'))
      
      try {
        const parsed = new URL(url)
        
        return new Map([
          ['valid', true],
          ['parsed', {
            protocol: parsed.protocol,
            hostname: parsed.hostname,
            port: parsed.port,
            pathname: parsed.pathname,
            search: parsed.search,
            hash: parsed.hash
          }],
          ['error', null]
        ])
      } catch (error) {
        return new Map([
          ['valid', false],
          ['parsed', null],
          ['error', 'Invalid URL format']
        ])
      }
    },
    description: 'Validates and parses URL',
    category: 'data',
    isPure: true
  }
}

export function validatePhone(): PrimitiveGadget {
  return {
    id: 'validate-phone',
    name: 'Validate Phone',
    inputs: ['phone', 'country'],
    outputs: ['valid', 'formatted', 'error'],
    activation: (inputs) => inputs.has('phone'),
    body: async (inputs) => {
      const phone = String(inputs.get('phone'))
      const country = inputs.get('country') as string || 'US'
      
      // Simple validation for common formats
      // In production, you'd use a library like libphonenumber-js
      const patterns: Record<string, RegExp> = {
        US: /^(\+1)?[-.\s]?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/,
        UK: /^(\+44)?[-.\s]?(\(0\))?[-.\s]?(20|7\d{3})[-.\s]?\d{3}[-.\s]?\d{4}$/,
        DE: /^(\+49)?[-.\s]?\(?0?\)?[-.\s]?(1[5-7]\d|30|40|69|89)[-.\s]?\d{3,8}$/,
        FR: /^(\+33)?[-.\s]?\(?0?\)?[-.\s]?[1-9][-.\s]?\d{8}$/
      }
      
      const pattern = patterns[country]
      if (!pattern) {
        return new Map([
          ['valid', false],
          ['formatted', null],
          ['error', `Unsupported country code: ${country}`]
        ])
      }
      
      const valid = pattern.test(phone.replace(/\s/g, ''))
      
      return new Map([
        ['valid', valid],
        ['formatted', valid ? phone.replace(/\D/g, '') : null],
        ['error', valid ? null : 'Invalid phone number format']
      ])
    },
    description: 'Validates phone number format',
    category: 'data',
    isPure: true
  }
}

export function validateRegex(): PrimitiveGadget {
  return {
    id: 'validate-regex',
    name: 'Validate Regex',
    inputs: ['text', 'pattern', 'flags'],
    outputs: ['matches', 'groups', 'error'],
    activation: (inputs) => inputs.has('text') && inputs.has('pattern'),
    body: async (inputs) => {
      const text = String(inputs.get('text'))
      const pattern = String(inputs.get('pattern'))
      const flags = inputs.get('flags') as string || ''
      
      try {
        const regex = new RegExp(pattern, flags)
        const match = text.match(regex)
        
        if (match) {
          return new Map([
            ['matches', true],
            ['groups', match.groups || match.slice(1)],
            ['error', null]
          ])
        } else {
          return new Map([
            ['matches', false],
            ['groups', null],
            ['error', null]
          ])
        }
      } catch (error) {
        return new Map([
          ['matches', false],
          ['groups', null],
          ['error', error instanceof Error ? error.message : String(error)]
        ])
      }
    },
    description: 'Validates text against regex pattern',
    category: 'data',
    isPure: true
  }
}

export function validateRange(): PrimitiveGadget {
  return {
    id: 'validate-range',
    name: 'Validate Range',
    inputs: ['value', 'min', 'max'],
    outputs: ['valid', 'clamped'],
    activation: (inputs) => inputs.has('value'),
    body: async (inputs) => {
      const value = inputs.get('value') as number
      const min = inputs.get('min') as number | undefined
      const max = inputs.get('max') as number | undefined
      
      let valid = true
      let clamped = value
      
      if (typeof value !== 'number') {
        return new Map([
          ['valid', false],
          ['clamped', null]
        ])
      }
      
      if (min !== undefined && value < min) {
        valid = false
        clamped = min
      }
      
      if (max !== undefined && value > max) {
        valid = false
        clamped = max
      }
      
      return new Map([
        ['valid', valid],
        ['clamped', clamped]
      ])
    },
    description: 'Validates number is within range',
    category: 'data',
    isPure: true
  }
}