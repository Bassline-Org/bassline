/**
 * Impure timer gadgets
 * These gadgets deal with time and are non-deterministic
 */

import type { PrimitiveGadget } from '@bassline/core'

export function now(): PrimitiveGadget {
  return {
    id: 'now',
    name: 'Now',
    inputs: ['trigger'],
    outputs: ['timestamp', 'iso', 'unix'],
    activation: (inputs) => inputs.has('trigger'),
    body: async () => {
      const date = new Date()
      
      return new Map([
        ['timestamp', date.getTime()],
        ['iso', date.toISOString()],
        ['unix', Math.floor(date.getTime() / 1000)]
      ])
    },
    description: 'Gets current timestamp',
    category: 'time',
    isPure: false
  }
}

export function delay(): PrimitiveGadget {
  return {
    id: 'delay',
    name: 'Delay',
    inputs: ['value', 'milliseconds'],
    outputs: ['value', 'elapsed'],
    activation: (inputs) => inputs.has('value') && inputs.has('milliseconds'),
    body: async (inputs) => {
      const value = inputs.get('value')
      const ms = inputs.get('milliseconds') as number
      
      const start = Date.now()
      await new Promise(resolve => setTimeout(resolve, ms))
      const elapsed = Date.now() - start
      
      return new Map([
        ['value', value],
        ['elapsed', elapsed]
      ])
    },
    description: 'Delays value propagation',
    category: 'time',
    isPure: false
  }
}

export function timeout(): PrimitiveGadget {
  return {
    id: 'timeout',
    name: 'Timeout',
    inputs: ['value', 'milliseconds', 'default'],
    outputs: ['value', 'timedOut'],
    activation: (inputs) => inputs.has('value') && inputs.has('milliseconds'),
    body: async (inputs) => {
      const value = inputs.get('value')
      const ms = inputs.get('milliseconds') as number
      const defaultValue = inputs.get('default')
      
      // Note: This is a simplified implementation
      // Real timeout would need special runtime support to actually timeout async operations
      
      return new Map([
        ['value', value],
        ['timedOut', false]
      ])
    },
    description: 'Timeout with default value (requires runtime support)',
    category: 'time',
    isPure: false
  }
}

export function interval(): PrimitiveGadget {
  return {
    id: 'interval',
    name: 'Interval',
    inputs: ['milliseconds', 'enable', 'maxCount'],
    outputs: ['tick', 'count', 'error'],
    activation: (inputs) => inputs.has('milliseconds') && inputs.has('enable'),
    body: async (inputs) => {
      const ms = inputs.get('milliseconds') as number
      const enable = Boolean(inputs.get('enable'))
      const maxCount = inputs.get('maxCount') as number | undefined
      
      // Note: This is a simplified implementation
      // Real interval would require special runtime support to manage timer lifecycle
      // and emit multiple values over time
      
      if (!enable) {
        return new Map()
      }
      
      return new Map([
        ['tick', Date.now()],
        ['count', 1],
        ['error', 'Interval requires special runtime support for continuous emission']
      ])
    },
    description: 'Emits values at intervals (requires runtime support)',
    category: 'time',
    isPure: false
  }
}

export function cron(): PrimitiveGadget {
  return {
    id: 'cron',
    name: 'Cron',
    inputs: ['pattern', 'enable', 'timezone'],
    outputs: ['tick', 'nextRun', 'error'],
    activation: (inputs) => inputs.has('pattern') && inputs.has('enable'),
    body: async (inputs) => {
      const pattern = String(inputs.get('pattern'))
      const enable = Boolean(inputs.get('enable'))
      const timezone = inputs.get('timezone') as string | undefined
      
      // Note: This is a simplified implementation
      // Real cron would require special runtime support to manage schedule
      
      if (!enable) {
        return new Map()
      }
      
      try {
        // Validate cron pattern
        const { CronJob } = await import('cron')
        const job = new CronJob(pattern, () => {}, null, false, timezone)
        const nextDate = job.nextDate()
        
        return new Map([
          ['tick', Date.now()],
          ['nextRun', nextDate ? nextDate.toISOString() : null],
          ['error', 'Cron requires special runtime support for scheduled execution']
        ])
      } catch (error) {
        return new Map([
          ['tick', null],
          ['nextRun', null],
          ['error', error instanceof Error ? error.message : String(error)]
        ])
      }
    },
    description: 'Cron-based scheduling (requires runtime support)',
    category: 'time',
    isPure: false
  }
}

export function stopwatch(): PrimitiveGadget {
  return {
    id: 'stopwatch',
    name: 'Stopwatch',
    inputs: ['start', 'stop', 'reset'],
    outputs: ['elapsed', 'running'],
    activation: (inputs) => inputs.has('start') || inputs.has('stop') || inputs.has('reset'),
    body: async (inputs) => {
      const start = Boolean(inputs.get('start'))
      const stop = Boolean(inputs.get('stop'))
      const reset = Boolean(inputs.get('reset'))
      
      // Note: This is a simplified implementation
      // Real stopwatch would need to maintain state across calls
      
      if (reset) {
        return new Map([
          ['elapsed', 0],
          ['running', false]
        ])
      }
      
      if (start) {
        return new Map([
          ['elapsed', 0],
          ['running', true]
        ])
      }
      
      if (stop) {
        return new Map([
          ['elapsed', 0],
          ['running', false]
        ])
      }
      
      return new Map([
        ['elapsed', 0],
        ['running', false]
      ])
    },
    description: 'Stopwatch timer (requires runtime support for state)',
    category: 'time',
    isPure: false
  }
}

export function debounce(): PrimitiveGadget {
  return {
    id: 'debounce',
    name: 'Debounce',
    inputs: ['value', 'milliseconds'],
    outputs: ['value'],
    activation: (inputs) => inputs.has('value') && inputs.has('milliseconds'),
    body: async (inputs) => {
      const value = inputs.get('value')
      const ms = inputs.get('milliseconds') as number
      
      // Note: This is a simplified implementation
      // Real debounce would need to maintain state and cancel previous timeouts
      
      await new Promise(resolve => setTimeout(resolve, ms))
      
      return new Map([['value', value]])
    },
    description: 'Debounces value changes (requires runtime support)',
    category: 'time',
    isPure: false
  }
}

export function throttle(): PrimitiveGadget {
  return {
    id: 'throttle',
    name: 'Throttle',
    inputs: ['value', 'milliseconds'],
    outputs: ['value', 'throttled'],
    activation: (inputs) => inputs.has('value') && inputs.has('milliseconds'),
    body: async (inputs) => {
      const value = inputs.get('value')
      const ms = inputs.get('milliseconds') as number
      
      // Note: This is a simplified implementation
      // Real throttle would need to maintain state and timing
      
      return new Map([
        ['value', value],
        ['throttled', false]
      ])
    },
    description: 'Throttles value changes (requires runtime support)',
    category: 'time',
    isPure: false
  }
}