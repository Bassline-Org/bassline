# React Integration Implementation Notes

## What We Built

A clean React integration for Atto-Bassline propagation networks that provides a useState-like API:

```typescript
const [frequency, setFrequency] = useContact<number>(oscillator, 'frequency')
```

## Key Architecture Decisions

### 1. React as a Thin Shim
- **Network holds the real state**, not React
- **React observes and writes** to the network
- **No state duplication** between React and the network
- **Propagation system handles consistency** and constraint satisfaction

### 2. Strength-Based Precedence
- **Stronger signals override weaker ones** (argmax resolution)
- **UI writes use monotonic strength** (auto-incrementing)
- **Initial values use low strength** (0.1) so UI can override them
- **Debug strength conflicts** by checking signal.strength values

### 3. Direct Contact Monitoring
Simplified from complex BiStream taps to direct contact polling:

```typescript
// Before: Complex BiStream with circular wiring
tap.output -> gadget.contact -> tap.input -> React

// After: Direct contact monitoring  
React polls gadget.contact directly
```

## Implementation Details

### useContact Hook
```typescript
export function useContact<T>(gadget: Gadget | null, contactName: string): [T | null, (value: T) => void] {
  // 1. Auto-incrementing strength for writes
  const strengthRef = useRef(10000)
  
  // 2. Polling-based subscription (60fps)
  const subscribe = (callback) => {
    const interval = setInterval(() => {
      if (contact.signal.value !== lastValue || contact.signal.strength !== lastStrength) {
        callback() // Trigger React re-render
      }
    }, 16)
    return () => clearInterval(interval)
  }
  
  // 3. Direct contact value reading
  const getSnapshot = () => gadget.contacts.get(contactName)?.signal.value
  
  // 4. Monotonic strength writes
  const setValue = (newValue) => {
    strengthRef.current += 1
    propagate(contact, createSignal(newValue, strengthRef.current))
  }
}
```

### Primitive Gadget Strength Fix
Changed from MIN to AVERAGE strength for better propagation:

```typescript
// Before: Output strength = Math.min(inputStrengths) 
// Problem: Weaker inputs prevent propagation

// After: Output strength = average(inputStrengths)
// Solution: Any input change affects average, ensuring propagation
const outputStrength = Math.floor(
  inputStrengths.reduce((sum, s) => sum + s, 0) / inputStrengths.length
)
```

## Debugging Insights

### Strength Conflict Detection
The key debugging breakthrough was realizing writes were being rejected:

```typescript
console.log('Writing:', newValue, 'strength:', writeStrength)
console.log('After write:', contact.signal.value, contact.signal.strength)
// Revealed: writing 1560 with strength 10k, but contact still had 440 with strength 20k
```

### Polling vs Events
Chose polling over event-based for simplicity:
- **Polling**: Simple, works immediately, ~60fps is fast enough for UI
- **Events**: Would require hooking into propagation engine, more complex

### Object Reference vs Content
Fixed change detection by comparing values, not object references:

```typescript
// Before: currentSignal !== lastSignal (object equality)
// After: currentSignal.value !== lastValue (content equality)
```

## Performance Characteristics

### Polling Overhead
- **60fps polling** per useContact hook
- **Negligible CPU usage** for typical UIs (5-10 sliders)
- **Could be optimized** with propagation events if needed

### Strength Management
- **Auto-incrementing strength** ensures UI updates always propagate
- **No strength conflicts** between multiple UI components
- **Strength normalization** could be added later for long-running apps

### Memory Usage
- **No additional state storage** in React
- **Single source of truth** in the propagation network
- **Automatic cleanup** when components unmount

## Future Improvements

### Event-Based Subscriptions
Replace polling with propagation events:

```typescript
// Instead of setInterval, hook into propagation:
propagationEngine.on('contactChanged', (contact) => {
  if (subscribedContacts.has(contact)) callback()
})
```

### Batch Optimization
Implement smart batching for rapid updates:

```typescript
// Automatically batch rapid slider drags
const { debouncedCommit } = useDebouncedTransaction(50)
```

### Strength Normalization
Add automatic strength cleanup:

```typescript
// Periodically normalize all strengths back to reasonable ranges
network.normalizeStrengths()
```

## Success Metrics

✅ **Clean API**: useState-like interface for network contacts  
✅ **No React State**: Network is the single source of truth  
✅ **Live Updates**: Real-time UI reactivity with audio feedback  
✅ **Constraint Handling**: Strength-based precedence works correctly  
✅ **Performance**: 60fps polling with negligible overhead  
✅ **Debugging**: Clear patterns for diagnosing strength conflicts  

This implementation proves that propagation networks can provide excellent React integration while maintaining their constraint-solving capabilities.