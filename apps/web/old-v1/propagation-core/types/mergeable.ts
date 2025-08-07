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

// RGB Color that blends together
export class Color implements Mergeable<Color> {
  constructor(
    public readonly r: number,
    public readonly g: number,
    public readonly b: number
  ) {
    if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
      throw new Error('RGB values must be between 0 and 255')
    }
  }
  
  merge(other: Color): Color {
    // Average the colors
    return new Color(
      Math.round((this.r + other.r) / 2),
      Math.round((this.g + other.g) / 2),
      Math.round((this.b + other.b) / 2)
    )
  }
  
  toHex(): string {
    const toHex = (n: number) => n.toString(16).padStart(2, '0')
    return `#${toHex(this.r)}${toHex(this.g)}${toHex(this.b)}`
  }
  
  toString(): string {
    return this.toHex()
  }
}

// Boolean that requires consensus (AND operation)
export class ConsensusBoolean implements Mergeable<ConsensusBoolean> {
  constructor(public readonly value: boolean) {}
  
  merge(other: ConsensusBoolean): ConsensusBoolean {
    // Both must be true for consensus
    return new ConsensusBoolean(this.value && other.value)
  }
  
  toString(): string {
    return this.value ? 'true' : 'false'
  }
}

// Point2D that finds the center point
export class Point2D implements Mergeable<Point2D> {
  constructor(
    public readonly x: number,
    public readonly y: number
  ) {}
  
  merge(other: Point2D): Point2D {
    // Find the midpoint
    return new Point2D(
      (this.x + other.x) / 2,
      (this.y + other.y) / 2
    )
  }
  
  toString(): string {
    return `(${this.x.toFixed(1)}, ${this.y.toFixed(1)})`
  }
}

// String that must match exactly or contradicts
export class ExactString implements Mergeable<ExactString> {
  constructor(public readonly value: string) {}
  
  merge(other: ExactString): ExactString | Contradiction {
    if (this.value !== other.value) {
      return new Contradiction(
        `String mismatch: "${this.value}" ≠ "${other.value}"`
      )
    }
    return this
  }
  
  toString(): string {
    return this.value
  }
}

// Numeric range with min/max constraints
export class NumericRange implements Mergeable<NumericRange> {
  constructor(
    public readonly min: number | null = null,
    public readonly max: number | null = null
  ) {
    if (min !== null && max !== null && min > max) {
      throw new Error(`Invalid range: min (${min}) > max (${max})`)
    }
  }
  
  merge(other: NumericRange): NumericRange | Contradiction {
    const newMin = this.min === null ? other.min : 
                   other.min === null ? this.min : 
                   Math.max(this.min, other.min)
    
    const newMax = this.max === null ? other.max :
                   other.max === null ? this.max :
                   Math.min(this.max, other.max)
    
    if (newMin !== null && newMax !== null && newMin > newMax) {
      return new Contradiction(
        `Range contradiction: [${this.min ?? '-∞'}, ${this.max ?? '+∞'}] ∩ [${other.min ?? '-∞'}, ${other.max ?? '+∞'}] = ∅`
      )
    }
    
    return new NumericRange(newMin, newMax)
  }
  
  contains(value: number): boolean {
    return (this.min === null || value >= this.min) &&
           (this.max === null || value <= this.max)
  }
  
  toString(): string {
    return `[${this.min ?? '-∞'}, ${this.max ?? '+∞'}]`
  }
}

// Set of strings that accumulates unique values
export class StringSet implements Mergeable<StringSet> {
  private values: Set<string>
  
  constructor(values: string[] | Set<string> = []) {
    this.values = new Set(values)
  }
  
  merge(other: StringSet): StringSet {
    return new StringSet(new Set([...this.values, ...other.values]))
  }
  
  add(value: string): void {
    this.values.add(value)
  }
  
  has(value: string): boolean {
    return this.values.has(value)
  }
  
  get size(): number {
    return this.values.size
  }
  
  toArray(): string[] {
    return Array.from(this.values)
  }
  
  toString(): string {
    return `{${Array.from(this.values).join(', ')}}`
  }
}

// Weighted average that accumulates values with sample count
export class WeightedAverage implements Mergeable<WeightedAverage> {
  constructor(
    public readonly sum: number = 0,
    public readonly count: number = 0
  ) {}
  
  static fromValue(value: number): WeightedAverage {
    return new WeightedAverage(value, 1)
  }
  
  merge(other: WeightedAverage): WeightedAverage {
    return new WeightedAverage(
      this.sum + other.sum,
      this.count + other.count
    )
  }
  
  get average(): number | null {
    return this.count === 0 ? null : this.sum / this.count
  }
  
  toString(): string {
    const avg = this.average
    return avg === null ? 'N/A' : `${avg.toFixed(2)} (n=${this.count})`
  }
}

// Timestamp value that keeps the most recent
export class TimestampValue<T = any> implements Mergeable<TimestampValue<T>> {
  constructor(
    public readonly value: T,
    public readonly timestamp: number = Date.now()
  ) {}
  
  merge(other: TimestampValue<T>): TimestampValue<T> {
    return this.timestamp >= other.timestamp ? this : other
  }
  
  get age(): number {
    return Date.now() - this.timestamp
  }
  
  toString(): string {
    return `${this.value} @ ${new Date(this.timestamp).toISOString()}`
  }
}