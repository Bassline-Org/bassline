/**
 * Pure data transformation gadgets
 * These gadgets transform data between different formats
 */

import type { PrimitiveGadget } from '@bassline/core'

export function jsonParse(): PrimitiveGadget {
  return {
    id: 'json-parse',
    name: 'JSON Parse',
    inputs: ['text'],
    outputs: ['data', 'error'],
    activation: (inputs) => inputs.has('text'),
    body: async (inputs) => {
      const text = inputs.get('text')
      
      try {
        const data = JSON.parse(String(text))
        return new Map([
          ['data', data],
          ['error', null]
        ])
      } catch (error) {
        return new Map([
          ['data', null],
          ['error', error instanceof Error ? error.message : String(error)]
        ])
      }
    },
    description: 'Parses JSON text into data',
    category: 'data',
    isPure: true
  }
}

export function jsonStringify(): PrimitiveGadget {
  return {
    id: 'json-stringify',
    name: 'JSON Stringify',
    inputs: ['data', 'indent'],
    outputs: ['text', 'error'],
    activation: (inputs) => inputs.has('data'),
    body: async (inputs) => {
      const data = inputs.get('data')
      const indent = inputs.get('indent') as number | undefined
      
      try {
        const text = JSON.stringify(data, null, indent || 0)
        return new Map([
          ['text', text],
          ['error', null]
        ])
      } catch (error) {
        return new Map([
          ['text', null],
          ['error', error instanceof Error ? error.message : String(error)]
        ])
      }
    },
    description: 'Converts data to JSON text',
    category: 'data',
    isPure: true
  }
}

export function csvParse(): PrimitiveGadget {
  return {
    id: 'csv-parse',
    name: 'CSV Parse',
    inputs: ['text', 'delimiter', 'headers'],
    outputs: ['data', 'error'],
    activation: (inputs) => inputs.has('text'),
    body: async (inputs) => {
      const text = String(inputs.get('text'))
      const delimiter = inputs.get('delimiter') as string || ','
      const hasHeaders = inputs.get('headers') !== false
      
      try {
        const Papa = await import('papaparse')
        const result = Papa.parse(text, {
          delimiter,
          header: hasHeaders,
          dynamicTyping: true,
          skipEmptyLines: true
        })
        
        if (result.errors.length > 0) {
          return new Map([
            ['data', result.data],
            ['error', result.errors.map(e => e.message).join('; ')]
          ])
        }
        
        return new Map([
          ['data', result.data],
          ['error', null]
        ])
      } catch (error) {
        return new Map([
          ['data', null],
          ['error', error instanceof Error ? error.message : String(error)]
        ])
      }
    },
    description: 'Parses CSV text into data',
    category: 'data',
    isPure: true
  }
}

export function csvStringify(): PrimitiveGadget {
  return {
    id: 'csv-stringify',
    name: 'CSV Stringify',
    inputs: ['data', 'delimiter', 'headers'],
    outputs: ['text', 'error'],
    activation: (inputs) => inputs.has('data'),
    body: async (inputs) => {
      const data = inputs.get('data')
      const delimiter = inputs.get('delimiter') as string || ','
      const includeHeaders = inputs.get('headers') !== false
      
      try {
        const Papa = await import('papaparse')
        const csv = Papa.unparse(data as any, {
          delimiter,
          header: includeHeaders
        })
        
        return new Map([
          ['text', csv],
          ['error', null]
        ])
      } catch (error) {
        return new Map([
          ['text', null],
          ['error', error instanceof Error ? error.message : String(error)]
        ])
      }
    },
    description: 'Converts data to CSV text',
    category: 'data',
    isPure: true
  }
}

export function yamlParse(): PrimitiveGadget {
  return {
    id: 'yaml-parse',
    name: 'YAML Parse',
    inputs: ['text'],
    outputs: ['data', 'error'],
    activation: (inputs) => inputs.has('text'),
    body: async (inputs) => {
      const text = String(inputs.get('text'))
      
      try {
        const yaml = await import('js-yaml')
        const data = yaml.load(text)
        
        return new Map([
          ['data', data],
          ['error', null]
        ])
      } catch (error) {
        return new Map([
          ['data', null],
          ['error', error instanceof Error ? error.message : String(error)]
        ])
      }
    },
    description: 'Parses YAML text into data',
    category: 'data',
    isPure: true
  }
}

export function yamlStringify(): PrimitiveGadget {
  return {
    id: 'yaml-stringify',
    name: 'YAML Stringify',
    inputs: ['data', 'indent'],
    outputs: ['text', 'error'],
    activation: (inputs) => inputs.has('data'),
    body: async (inputs) => {
      const data = inputs.get('data')
      const indent = inputs.get('indent') as number || 2
      
      try {
        const yaml = await import('js-yaml')
        const text = yaml.dump(data, {
          indent
        })
        
        return new Map([
          ['text', text],
          ['error', null]
        ])
      } catch (error) {
        return new Map([
          ['text', null],
          ['error', error instanceof Error ? error.message : String(error)]
        ])
      }
    },
    description: 'Converts data to YAML text',
    category: 'data',
    isPure: true
  }
}

export function base64Encode(): PrimitiveGadget {
  return {
    id: 'base64-encode',
    name: 'Base64 Encode',
    inputs: ['data'],
    outputs: ['encoded'],
    activation: (inputs) => inputs.has('data'),
    body: async (inputs) => {
      const data = inputs.get('data')
      
      let encoded: string
      if (typeof data === 'string') {
        encoded = Buffer.from(data).toString('base64')
      } else if (Buffer.isBuffer(data)) {
        encoded = data.toString('base64')
      } else {
        encoded = Buffer.from(JSON.stringify(data)).toString('base64')
      }
      
      return new Map([['encoded', encoded]])
    },
    description: 'Encodes data to Base64',
    category: 'data',
    isPure: true
  }
}

export function base64Decode(): PrimitiveGadget {
  return {
    id: 'base64-decode',
    name: 'Base64 Decode',
    inputs: ['encoded', 'outputType'],
    outputs: ['data', 'error'],
    activation: (inputs) => inputs.has('encoded'),
    body: async (inputs) => {
      const encoded = String(inputs.get('encoded'))
      const outputType = inputs.get('outputType') as string || 'string'
      
      try {
        const buffer = Buffer.from(encoded, 'base64')
        
        let data: any
        switch (outputType) {
          case 'buffer':
            data = buffer
            break
          case 'json':
            data = JSON.parse(buffer.toString())
            break
          case 'string':
          default:
            data = buffer.toString()
            break
        }
        
        return new Map([
          ['data', data],
          ['error', null]
        ])
      } catch (error) {
        return new Map([
          ['data', null],
          ['error', error instanceof Error ? error.message : String(error)]
        ])
      }
    },
    description: 'Decodes Base64 data',
    category: 'data',
    isPure: true
  }
}