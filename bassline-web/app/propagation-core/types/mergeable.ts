import type { Mergeable } from './index'
import { Contradiction } from './index'

// Interval arithmetic - narrows down to intersection
export class Interval implements Mergeable<Interval> {
  constructor(
    public readonly min: number,
    public readonly max: number
  ) {
    if (min > max) {
      throw new Error(`Invalid interval: min (${min}) > max (${max})`)
    }
  }
  
  merge(other: Interval): Interval | Contradiction {
    const newMin = Math.max(this.min, other.min)
    const newMax = Math.min(this.max, other.max)
    
    if (newMin > newMax) {
      return new Contradiction(
        `Interval contradiction: [${this.min}, ${this.max}] ∩ [${other.min}, ${other.max}] = ∅`
      )
    }
    
    return new Interval(newMin, newMax)
  }
  
  toString(): string {
    return `[${this.min}, ${this.max}]`
  }
}

// Set that accumulates values
export class SetValue<T> implements Mergeable<SetValue<T>> {
  private values: Set<T>
  
  constructor(values: T[] | Set<T> = []) {
    this.values = new Set(values)
  }
  
  merge(other: SetValue<T>): SetValue<T> {
    return new SetValue(new Set([...this.values, ...other.values]))
  }
  
  has(value: T): boolean {
    return this.values.has(value)
  }
  
  get size(): number {
    return this.values.size
  }
  
  toArray(): T[] {
    return Array.from(this.values)
  }
  
  toString(): string {
    return `{${Array.from(this.values).join(', ')}}`
  }
}

// Temperature that only increases (monotonic)
export class Temperature implements Mergeable<Temperature> {
  constructor(public readonly celsius: number) {}
  
  merge(other: Temperature): Temperature {
    // Always take the higher temperature
    return new Temperature(Math.max(this.celsius, other.celsius))
  }
  
  toString(): string {
    return `${this.celsius}°C`
  }
}