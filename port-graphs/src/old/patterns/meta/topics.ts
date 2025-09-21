import { Gadget } from "../../core";

/**
 * Type-safe topic management utilities
 */

// Branded type for topics to ensure type safety
export type Topic = string & { __brand: 'Topic' };

/**
 * Topic builder for type-safe topic construction
 */
export class TopicBuilder {
  private namespace: string | undefined;

  constructor(namespace?: string) {
    this.namespace = namespace;
  }

  /**
   * Create a scoped builder with a namespace prefix
   */
  scope(namespace: string): TopicBuilder {
    return new TopicBuilder(
      this.namespace ? `${this.namespace}:${namespace}` : namespace
    );
  }

  /**
   * Build a topic string with optional segments
   */
  build(...segments: (string | number)[]): Topic {
    const parts = this.namespace ? [this.namespace, ...segments] : segments;
    return parts.join(':') as Topic;
  }

  // Common topic patterns
  node(id: string | number) { return this.build('node', id); }
  edge(id: string | number) { return this.build('edge', id); }
  cell(id: string | number) { return this.build('cell', id); }
  changes(type: string) { return this.build(type, 'changes'); }
  event(name: string) { return this.build('event', name); }
  action(name: string) { return this.build('action', name); }
}

// Default builder instance
export const topic = new TopicBuilder();

/**
 * Topic pattern matcher for wildcard subscriptions
 */
export class TopicPattern {
  private pattern: RegExp;

  constructor(pattern: string) {
    // Convert wildcard pattern to regex
    // * matches any single segment
    // ** matches any number of segments
    const regexStr = pattern
      .split(':')
      .map(segment => {
        if (segment === '**') return '.*';
        if (segment === '*') return '[^:]+';
        return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      })
      .join(':');
    this.pattern = new RegExp(`^${regexStr}$`);
  }

  matches(topic: Topic | string): boolean {
    return this.pattern.test(topic);
  }
}

/**
 * Topic registry for managing subscriptions with cleanup
 */
export class TopicRegistry {
  private subscriptions = new Map<string, Set<Gadget>>();
  private patterns = new Map<TopicPattern, Set<Gadget>>();

  /**
   * Subscribe a gadget to topics with pattern support
   */
  subscribe(topics: (Topic | string)[], gadget: Gadget): () => void {
    const cleanups: (() => void)[] = [];

    for (const topic of topics) {
      if (topic.includes('*')) {
        // Pattern subscription
        const pattern = new TopicPattern(topic);
        if (!this.patterns.has(pattern)) {
          this.patterns.set(pattern, new Set());
        }
        this.patterns.get(pattern)!.add(gadget);

        cleanups.push(() => {
          const set = this.patterns.get(pattern);
          if (set) {
            set.delete(gadget);
            if (set.size === 0) {
              this.patterns.delete(pattern);
            }
          }
        });
      } else {
        // Exact subscription
        if (!this.subscriptions.has(topic)) {
          this.subscriptions.set(topic, new Set());
        }
        this.subscriptions.get(topic)!.add(gadget);

        cleanups.push(() => {
          const set = this.subscriptions.get(topic);
          if (set) {
            set.delete(gadget);
            if (set.size === 0) {
              this.subscriptions.delete(topic);
            }
          }
        });
      }
    }

    // Return cleanup function
    return () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
    };
  }

  /**
   * Get all gadgets subscribed to a topic (including pattern matches)
   */
  getSubscribers(topic: Topic | string): Gadget[] {
    const gadgets = new Set<Gadget>();

    // Exact matches
    const exact = this.subscriptions.get(topic);
    if (exact) {
      for (const gadget of exact) {
        gadgets.add(gadget);
      }
    }

    // Pattern matches
    for (const [pattern, subscribers] of this.patterns.entries()) {
      if (pattern.matches(topic)) {
        for (const gadget of subscribers) {
          gadgets.add(gadget);
        }
      }
    }

    return Array.from(gadgets);
  }

  /**
   * Publish data to all subscribers of given topics
   */
  publish(topics: (Topic | string)[], data: any): void {
    const gadgets = new Set<Gadget>();

    for (const topic of topics) {
      for (const gadget of this.getSubscribers(topic)) {
        gadgets.add(gadget);
      }
    }

    for (const gadget of gadgets) {
      gadget.receive(data);
    }
  }

  /**
   * Clear all subscriptions
   */
  clear(): void {
    this.subscriptions.clear();
    this.patterns.clear();
  }

  /**
   * Get statistics about current subscriptions
   */
  stats() {
    return {
      topics: this.subscriptions.size,
      patterns: this.patterns.size,
      totalSubscriptions: Array.from(this.subscriptions.values()).reduce((sum, set) => sum + set.size, 0) +
        Array.from(this.patterns.values()).reduce((sum, set) => sum + set.size, 0)
    };
  }
}