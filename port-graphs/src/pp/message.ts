/**
 * Message-based propagation patterns
 * 
 * Messages add semantic routing to the propagation network.
 * This is a common extension pattern, not part of the core.
 */

import { fn } from "./patterns";
import { Action } from "./patterns";
import { Gadget } from "./core";

/**
 * Message type for semantic routing
 * Messages carry a tag for routing and a value payload
 */
export interface Message<T = unknown> {
  tag: string;
  value: T;
  from?: string;  // Optional source tracking
}

/**
 * Create a transformer that wraps values in messages
 * This is a fn gadget that tags raw values
 */
export function fromValue<T, G extends Gadget<T> = Gadget<T>>(
  tag: string,
  act: Action<Message<T>, G>
): (this: G, data: T) => void {
  return fn<T, Message<T>, G>(
    value => ({ tag, value }),
    act
  );
}

/**
 * Create a transformer that extracts values from messages
 * This is a fn gadget that unwraps message payloads
 */
export function toValue<T, G extends Gadget<Message<T>> = Gadget<Message<T>>>(
  act: Action<T, G>
): (this: G, data: Message<T>) => void {
  return fn<Message<T>, T, G>(
    msg => msg.value,
    act
  );
}

/**
 * Create a filter that only passes messages with specific tag
 * Returns null for non-matching tags (which stops propagation)
 */
export function filterTag<T, G extends Gadget<Message<T>> = Gadget<Message<T>>>(
  tag: string,
  act: Action<Message<T>, G>
): (this: G, data: Message<T>) => void {
  return fn<Message<T>, Message<T>, G>(
    msg => msg.tag === tag ? msg : null,
    act
  );
}

/**
 * Create a transformer that changes the tag of messages
 * Useful for re-routing messages to different semantic channels
 */
export function retag<T, G extends Gadget<Message<T>> = Gadget<Message<T>>>(
  newTag: string,
  act: Action<Message<T>, G>
): (this: G, data: Message<T>) => void {
  return fn<Message<T>, Message<T>, G>(
    msg => ({ ...msg, tag: newTag }),
    act
  );
}

/**
 * Transform the value inside a message while preserving the tag
 */
export function mapMessage<TIn, TOut, G extends Gadget<Message<TIn>> = Gadget<Message<TIn>>>(
  transform: (value: TIn) => TOut | null,
  act: Action<Message<TOut>, G>
): (this: G, data: Message<TIn>) => void {
  return fn<Message<TIn>, Message<TOut>, G>(
    msg => {
      const newValue = transform(msg.value);
      return newValue !== null 
        ? { ...msg, value: newValue }
        : null;
    },
    act
  );
}

/**
 * Split messages to multiple tags based on a condition
 * Useful for routing messages to different paths
 */
export function splitTag<T, G extends Gadget<Message<T>> = Gadget<Message<T>>>(
  condition: (value: T) => boolean,
  trueTag: string,
  falseTag: string,
  act: Action<Message<T>, G>
): (this: G, data: Message<T>) => void {
  return fn<Message<T>, Message<T>, G>(
    msg => ({
      ...msg,
      tag: condition(msg.value) ? trueTag : falseTag
    }),
    act
  );
}

/**
 * Action helper that emits a message to a target gadget
 */
export function emitMessage<T, G extends Gadget = Gadget>(
  target: Gadget<Message<T>>
): Action<Message<T>, G> {
  return (msg) => target.receive(msg);
}

/**
 * Action helper that emits multiple messages with different tags
 * Useful for broadcasting to multiple semantic channels
 */
export function broadcast<T, G extends Gadget = Gadget>(
  tags: string[],
  targets: Gadget<Message<T>>[]
): Action<T, G> {
  return (value) => {
    for (const tag of tags) {
      for (const target of targets) {
        target.receive({ tag, value });
      }
    }
  };
}

/**
 * Create a message with optional source tracking
 */
export function message<T>(tag: string, value: T, from?: string): Message<T> {
  return { tag, value, from };
}