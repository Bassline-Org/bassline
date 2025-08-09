/**
 * Date manipulation gadgets
 * Some are pure (calculations), some are impure (current time)
 */

import type { PrimitiveGadget } from '@bassline/core'

export function formatDate(): PrimitiveGadget {
  return {
    id: 'format-date',
    name: 'Format Date',
    inputs: ['date', 'format', 'timezone'],
    outputs: ['formatted', 'error'],
    activation: (inputs) => inputs.has('date') && inputs.has('format'),
    body: async (inputs) => {
      const date = inputs.get('date')
      const formatStr = String(inputs.get('format'))
      const timezone = inputs.get('timezone') as string | undefined
      
      try {
        const { format } = await import('date-fns')
        
        let dateObj: Date
        if (typeof date === 'string') {
          dateObj = new Date(date)
        } else if (typeof date === 'number') {
          dateObj = new Date(date)
        } else if (date instanceof Date) {
          dateObj = date
        } else {
          throw new Error('Invalid date input')
        }
        
        const formatted = format(dateObj, formatStr)
        
        return new Map([
          ['formatted', formatted],
          ['error', null]
        ])
      } catch (error) {
        return new Map([
          ['formatted', null],
          ['error', error instanceof Error ? error.message : String(error)]
        ])
      }
    },
    description: 'Formats date according to pattern',
    category: 'time',
    isPure: true // Date formatting is deterministic
  }
}

export function parseDate(): PrimitiveGadget {
  return {
    id: 'parse-date',
    name: 'Parse Date',
    inputs: ['text', 'format'],
    outputs: ['date', 'timestamp', 'error'],
    activation: (inputs) => inputs.has('text'),
    body: async (inputs) => {
      const text = String(inputs.get('text'))
      const formatStr = inputs.get('format') as string | undefined
      
      try {
        let date: Date
        
        if (formatStr) {
          const { parse } = await import('date-fns')
          date = parse(text, formatStr, new Date())
        } else {
          date = new Date(text)
        }
        
        if (isNaN(date.getTime())) {
          throw new Error('Invalid date')
        }
        
        return new Map([
          ['date', date.toISOString()],
          ['timestamp', date.getTime()],
          ['error', null]
        ])
      } catch (error) {
        return new Map([
          ['date', null],
          ['timestamp', null],
          ['error', error instanceof Error ? error.message : String(error)]
        ])
      }
    },
    description: 'Parses date from text',
    category: 'time',
    isPure: true
  }
}

export function dateDiff(): PrimitiveGadget {
  return {
    id: 'date-diff',
    name: 'Date Difference',
    inputs: ['date1', 'date2', 'unit'],
    outputs: ['difference', 'error'],
    activation: (inputs) => inputs.has('date1') && inputs.has('date2'),
    body: async (inputs) => {
      const date1 = inputs.get('date1')
      const date2 = inputs.get('date2')
      const unit = inputs.get('unit') as string || 'milliseconds'
      
      try {
        const d1 = new Date(date1 as any)
        const d2 = new Date(date2 as any)
        
        if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
          throw new Error('Invalid date')
        }
        
        const diffMs = d2.getTime() - d1.getTime()
        
        let difference: number
        switch (unit) {
          case 'seconds':
            difference = diffMs / 1000
            break
          case 'minutes':
            difference = diffMs / (1000 * 60)
            break
          case 'hours':
            difference = diffMs / (1000 * 60 * 60)
            break
          case 'days':
            difference = diffMs / (1000 * 60 * 60 * 24)
            break
          case 'weeks':
            difference = diffMs / (1000 * 60 * 60 * 24 * 7)
            break
          case 'months':
            difference = diffMs / (1000 * 60 * 60 * 24 * 30.44) // Average month
            break
          case 'years':
            difference = diffMs / (1000 * 60 * 60 * 24 * 365.25) // Account for leap years
            break
          default:
            difference = diffMs
        }
        
        return new Map([
          ['difference', difference],
          ['error', null]
        ])
      } catch (error) {
        return new Map([
          ['difference', null],
          ['error', error instanceof Error ? error.message : String(error)]
        ])
      }
    },
    description: 'Calculates difference between dates',
    category: 'time',
    isPure: true
  }
}

export function dateAdd(): PrimitiveGadget {
  return {
    id: 'date-add',
    name: 'Date Add',
    inputs: ['date', 'amount', 'unit'],
    outputs: ['result', 'error'],
    activation: (inputs) => inputs.has('date') && inputs.has('amount') && inputs.has('unit'),
    body: async (inputs) => {
      const date = inputs.get('date')
      const amount = inputs.get('amount') as number
      const unit = String(inputs.get('unit'))
      
      try {
        const { add } = await import('date-fns')
        
        const dateObj = new Date(date as any)
        if (isNaN(dateObj.getTime())) {
          throw new Error('Invalid date')
        }
        
        const duration: any = {}
        duration[unit] = amount
        
        const result = add(dateObj, duration)
        
        return new Map([
          ['result', result.toISOString()],
          ['error', null]
        ])
      } catch (error) {
        return new Map([
          ['result', null],
          ['error', error instanceof Error ? error.message : String(error)]
        ])
      }
    },
    description: 'Adds duration to date',
    category: 'time',
    isPure: true
  }
}

export function dateSubtract(): PrimitiveGadget {
  return {
    id: 'date-subtract',
    name: 'Date Subtract',
    inputs: ['date', 'amount', 'unit'],
    outputs: ['result', 'error'],
    activation: (inputs) => inputs.has('date') && inputs.has('amount') && inputs.has('unit'),
    body: async (inputs) => {
      const date = inputs.get('date')
      const amount = inputs.get('amount') as number
      const unit = String(inputs.get('unit'))
      
      try {
        const { sub } = await import('date-fns')
        
        const dateObj = new Date(date as any)
        if (isNaN(dateObj.getTime())) {
          throw new Error('Invalid date')
        }
        
        const duration: any = {}
        duration[unit] = amount
        
        const result = sub(dateObj, duration)
        
        return new Map([
          ['result', result.toISOString()],
          ['error', null]
        ])
      } catch (error) {
        return new Map([
          ['result', null],
          ['error', error instanceof Error ? error.message : String(error)]
        ])
      }
    },
    description: 'Subtracts duration from date',
    category: 'time',
    isPure: true
  }
}

export function startOfPeriod(): PrimitiveGadget {
  return {
    id: 'start-of-period',
    name: 'Start of Period',
    inputs: ['date', 'period'],
    outputs: ['result', 'error'],
    activation: (inputs) => inputs.has('date') && inputs.has('period'),
    body: async (inputs) => {
      const date = inputs.get('date')
      const period = String(inputs.get('period'))
      
      try {
        const fns = await import('date-fns')
        
        const dateObj = new Date(date as any)
        if (isNaN(dateObj.getTime())) {
          throw new Error('Invalid date')
        }
        
        let result: Date
        switch (period) {
          case 'day':
            result = fns.startOfDay(dateObj)
            break
          case 'week':
            result = fns.startOfWeek(dateObj)
            break
          case 'month':
            result = fns.startOfMonth(dateObj)
            break
          case 'quarter':
            result = fns.startOfQuarter(dateObj)
            break
          case 'year':
            result = fns.startOfYear(dateObj)
            break
          case 'hour':
            result = fns.startOfHour(dateObj)
            break
          case 'minute':
            result = fns.startOfMinute(dateObj)
            break
          default:
            throw new Error(`Unknown period: ${period}`)
        }
        
        return new Map([
          ['result', result.toISOString()],
          ['error', null]
        ])
      } catch (error) {
        return new Map([
          ['result', null],
          ['error', error instanceof Error ? error.message : String(error)]
        ])
      }
    },
    description: 'Gets start of period for date',
    category: 'time',
    isPure: true
  }
}