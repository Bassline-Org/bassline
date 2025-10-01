// ================================================
// Protocol Usage Examples
// ================================================
//
// This file demonstrates how to use protocols to write
// behavioral polymorphic code - functions that work with
// ANY gadget implementing a particular protocol.

import { Implements, Protocol, And, Emits } from './context';
import * as Protocols from './protocols';

// ================================================
// Example 1: Simple Protocol Constraint
// ================================================

/**
 * Mirror values from one valued gadget to another.
 * Works with ANY gadget that implements Valued<T> - cells, sliders, etc.
 */
function mirror<T>(
    source: Implements<Protocols.Valued<T>>,
    target: Implements<Protocols.Valued<T>>
) {
    source.tap(({ changed }) => {
        if (changed !== undefined) {
            target.receive(changed);
        }
    });
}

// ================================================
// Example 2: Protocol Composition
// ================================================

/**
 * A gadget that's both valued AND clearable.
 * This composes two protocols using And.
 */
type ClearableValue<T> = And<Protocols.Valued<T>, Protocols.Clearable>;

/**
 * Reset a gadget to initial value when trigger fires.
 */
function resetOnChange<T>(
    trigger: Emits<{ changed: any }>,
    target: Implements<ClearableValue<T>>
) {
    trigger.tap(() => {
        target.receive({ clear: {} });
    });
}

// ================================================
// Example 3: Working with Validators
// ================================================

/**
 * Only forward validated values to target.
 * Invalid values are ignored.
 */
function onlyValid<T>(
    validator: Implements<Protocols.Validator<T>>,
    target: Implements<Protocols.Valued<T>>
) {
    validator.tap((effects) => {
        // TypeScript correctly requires checking field existence
        // because effects are Partial<Union>
        if ('validated' in effects && effects.validated !== undefined) {
            target.receive(effects.validated);
        }
    });
}

/**
 * Log validation errors.
 */
function logValidationErrors<T>(
    validator: Implements<Protocols.Validator<T>>
) {
    validator.tap((effects) => {
        if ('invalid' in effects && effects.invalid !== undefined) {
            console.error(`Validation failed: ${effects.invalid.reason}`, effects.invalid.value);
        }
    });
}

// ================================================
// Example 4: Collections
// ================================================

/**
 * Add multiple items to a collection.
 */
function addAll<T>(
    collection: Implements<Protocols.Collection<T>>,
    items: T[]
) {
    items.forEach(item => {
        collection.receive({ add: item });
    });
}

/**
 * Sync two collections - when items are added to source, add to target.
 */
function syncCollections<T>(
    source: Implements<Protocols.Collection<T>>,
    target: Implements<Protocols.Collection<T>>
) {
    source.tap((effects) => {
        if ('added' in effects && effects.added !== undefined) {
            target.receive({ add: effects.added });
        }
        if ('removed' in effects && effects.removed !== undefined) {
            target.receive({ remove: effects.removed });
        }
    });
}

// ================================================
// Example 5: Generic Aggregation
// ================================================

/**
 * Aggregate values from multiple sources.
 * Works with ANY valued gadgets - they all emit { changed: T }.
 */
function sumValues(
    sources: Implements<Protocols.Valued<number>>[],
    aggregator: Implements<Protocols.Aggregator<number, number>>
) {
    sources.forEach(source => {
        source.tap(() => {
            const values = sources.map(s => s.current());
            aggregator.receive(values);
        });
    });
}

// ================================================
// Example 6: Protocol-Based Type Constraints
// ================================================

/**
 * A function that only accepts gadgets implementing specific behavior.
 * The type signature DOCUMENTS what behavioral contract is required.
 */
function processValuedGadget<T>(
    gadget: Implements<Protocols.Valued<T>>
): void {
    // We know this gadget:
    // 1. Accepts T as input
    // 2. Emits { changed: T } effects
    // 3. Can be tapped

    gadget.receive({} as T);  // ✓ Type-safe
    gadget.tap(({ changed }) => {
        if (changed !== undefined) {
            console.log('Value changed:', changed);
        }
    });
}

// ================================================
// Key Insights
// ================================================

/*
1. Protocols define BEHAVIORAL contracts, not implementation details
   - You don't care HOW a gadget stores state
   - You care WHAT it accepts and WHAT it emits

2. Protocol constraints make function signatures self-documenting
   - `Implements<Valued<T>>` tells you exactly what the gadget does
   - No need to read implementation to understand requirements

3. Protocols enable behavioral polymorphism
   - Write once, works with ANY gadget implementing the protocol
   - Cells, sliders, counters all implement Valued<T>

4. Protocols compose algebraically
   - `And<P1, P2>` combines two protocols
   - Build complex contracts from simple pieces

5. Protocols are the PUBLIC API
   - Internal actions can change (refactoring)
   - Effect protocols should be stable (external contract)
*/
