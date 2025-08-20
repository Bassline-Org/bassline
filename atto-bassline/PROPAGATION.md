# Propagation Semantics

## Core Rules

The atto-bassline propagation system uses **strict argmax with contradiction detection**:

### 1. Stronger Signals Win (>)
- A signal only propagates if it has **strictly greater** strength than the current signal
- This ensures the system always halts (no infinite propagation loops)
- Weaker or equal-strength signals with the same value don't cause updates

### 2. Equal Strength Conflicts = Contradiction
- When two signals with **equal strength but different values** meet, a contradiction is detected
- The contact's value becomes: `{ tag: 'contradiction', value: 'Conflict: ...' }`
- The contradiction maintains the same strength as the conflicting signals
- Contradictions propagate like any other signal

### 3. Resolution Through Strength
- A stronger signal (>) can resolve a contradiction
- The stronger signal simply overwrites the contradiction
- This provides a natural conflict resolution mechanism

## Examples

```typescript
// Initial state
contact.signal = { value: 'A', strength: 5000 }

// Weaker signal - ignored
propagate(contact, { value: 'B', strength: 3000 })
// Result: still 'A' with strength 5000

// Equal strength, same value - no change
propagate(contact, { value: 'A', strength: 5000 })
// Result: still 'A' with strength 5000

// Equal strength, different value - contradiction!
propagate(contact, { value: 'B', strength: 5000 })
// Result: { tag: 'contradiction', value: 'Conflict: A vs B' } with strength 5000

// Stronger signal - resolves contradiction
propagate(contact, { value: 'C', strength: 7000 })
// Result: 'C' with strength 7000
```

## Why These Semantics?

### Halting Guarantee
By requiring strictly stronger signals (>), we ensure that:
- Signal strength must monotonically increase for propagation
- Since strength is bounded (max 100,000 units), propagation must eventually stop
- No infinite loops from equal-strength ping-ponging

### Explicit Conflict Detection
Rather than arbitrary tie-breaking (last-write-wins), we:
- Make conflicts visible as first-class values
- Allow the network to detect and handle contradictions
- Enable debugging of conflicting constraints

### Natural Resolution
Contradictions are resolved by stronger signals, providing:
- A clear priority mechanism
- No special-case handling needed
- Contradictions flow through the network like any signal

## Comparison to Alternatives

### vs. >= Semantics
Using >= would allow equal-strength updates, but:
- Could cause infinite loops in cycles
- Makes halting analysis difficult
- Obscures genuine conflicts

### vs. Hysteresis
Adding hysteresis (requiring signal to be stronger by some threshold):
- Adds complexity
- Can block legitimate updates
- Better implemented in userspace if needed

### vs. Last-Write-Wins
Arbitrary tie-breaking by update order:
- Non-deterministic in concurrent settings
- Hides conflicts that may indicate bugs
- Makes debugging harder

## Implementation

The propagation function in `src/propagation.ts`:

```typescript
export function propagate(contact: Contact, signal: Signal): void {
  if (signal.strength > contact.signal.strength) {
    // Stronger signal wins
    contact.signal = signal
  } else if (signal.strength === contact.signal.strength) {
    // Equal strength - check for contradiction
    if (signal.value !== contact.signal.value) {
      // Different values = contradiction
      contact.signal = {
        value: { 
          tag: 'contradiction', 
          value: `Conflict: ${contact.signal.value} vs ${signal.value}` 
        },
        strength: signal.strength
      }
    }
    // Same value = no change
    return
  }
  // Weaker signal - ignore
  
  // ... rest of propagation logic
}
```

## Userspace Extensions

Users can implement additional semantics through gadgets:

### Hysteresis
Create a gadget that only forwards signals exceeding a threshold:
```typescript
if (input.strength > lastOutput.strength + THRESHOLD) {
  return { output: input }
}
```

### Tie-Breaking
Create a gadget that adds small random strength to break ties:
```typescript
return { 
  output: {
    value: input.value,
    strength: input.strength + Math.random() * 10
  }
}
```

### Voting
Create a gadget that resolves contradictions through voting:
```typescript
// Collect all inputs, output majority value with combined strength
```

The core system provides a clean, predictable foundation that users can extend as needed.