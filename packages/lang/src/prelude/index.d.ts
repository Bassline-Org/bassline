// Abstract type definitions for @bassline/lang/prelude

// Core Value base class
export declare class Value {
  value: any;
  is(type: any): boolean;
  form(): { value: string };
  mold(): { value: string };
  evaluate(stream: any, context: any): any;
  to(type: any): any;
}

// Series types
export declare class Series extends Value {
  items: Value[];
}

export declare class Block extends Series {
  items: Value[];
  reduce(stream: any, context: any): Block;
  compose(stream: any, context: any): Block;
}

export declare class Paren extends Block {}

// String type
export declare class Str extends Value {
  value: string;
}

// Numeric type
export declare class Num extends Value {
  value: number;
}

// Boolean type
export declare class Bool extends Value {
  value: boolean;
}

// Word types
export declare class Word extends Value {
  spelling: string;
}

export declare class WordLike extends Word {}
export declare class GetWord extends WordLike {}
export declare class SetWord extends WordLike {}
export declare class LitWord extends WordLike {}

// Function types
export declare class NativeFn extends Value {
  spec: string[];
  fn: Function;
}

export declare class NativeMethod extends Value {
  static unary(method: string): NativeMethod;
  static binary(method: string): NativeMethod;
  static ternary(method: string): NativeMethod;
}

export declare class PureFn extends Value {}

// Context types
export declare class ContextBase extends Value {
  bindings: Map<symbol, Value>;
  get(word: Word): Value;
  set(word: Word, value: Value): void;
  has(word: Word): boolean;
  keys(): Word[];
  values(): Value[];
  copy(): ContextBase;
  merge(other: ContextBase): ContextBase;
  project(words: Word[]): ContextBase;
}

export declare class ContextChain extends ContextBase {
  parent: ContextChain | null;
  fresh(): ContextChain;
}

// Datatype type
export declare class Datatype extends Value {
  value: Function;
  make(stream: any, context: any): Value;
}

// Error types
export declare class Err extends Value {
  message: string;
}

export declare class Unset extends Value {}

// Task type
export declare class Task extends Value {}

// Export default prelude (all built-in functions and datatypes)
declare const prelude: Record<string, Value>;
export default prelude;