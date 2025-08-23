// Test utility functions to import

export function double(x: number): number {
  return x * 2
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function reverseString(s: string): string {
  return s.split('').reverse().join('')
}

export default function defaultTransform(input: any): any {
  if (typeof input === 'number') return input * 10
  if (typeof input === 'string') return `[${input}]`
  return input
}