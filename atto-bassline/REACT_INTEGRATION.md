# React Integration Guide for Atto-Bassline

This guide explains the ideal patterns for integrating propagation networks with React UIs.

## Core Concepts

### Propagation Networks as State
- **The network IS the state** - don't duplicate state in React
- **React is a thin shim** - it observes and writes to the network
- **Strength-based precedence** - stronger signals override weaker ones
- **Monotonic strength** - UI writes must use incrementing strength values

### useState-like API
The `useContact` hook provides a familiar React pattern:

```typescript
const [frequency, setFrequency] = useContact<number>(oscillator, 'frequency')

// Read: frequency contains current value from the network
// Write: setFrequency(440) propagates to the network with auto-incrementing strength
```

## Hook Architecture

### useGadget(id: string)
Finds gadgets by ID in the network context.

```typescript
const oscillator = useGadget('oscillator')
const mixer = useGadget('mixer')
```

### useContact<T>(gadget, contactName)
Creates a bidirectional binding to a gadget contact.

```typescript
const [frequency, setFrequency] = useContact<number>(oscillator, 'frequency')
const [volume, setVolume] = useContact<number>(mixer, 'master')
```

**Implementation details:**
- **Subscription**: Polls contact at 60fps for value/strength changes
- **Strength management**: Auto-increments strength for each write
- **Change detection**: Compares actual values, not object references
- **Cleanup**: Automatically stops polling on unmount

## Strength Management Best Practices

### Initial Values
Set initial network values with **low strength** so UI can override:

```typescript
// ❌ Bad: High initial strength blocks UI updates
propagate(contact, signal(440, 2.0))  // 20000 units

// ✅ Good: Low initial strength allows UI override  
propagate(contact, signal(440, 0.1))  // 1000 units
```

### UI Write Strength
The `useContact` hook automatically manages monotonic strength:

```typescript
// Each write gets incrementing strength: 10001, 10002, 10003...
setFrequency(440)
setFrequency(880) 
setFrequency(1760)
```

### Strength Conflicts
If UI updates stop working, check for strength conflicts:

```typescript
// Debug: Check if writes are being rejected
console.log('After write:', contact.signal.value, contact.signal.strength)
```

## Network Setup Patterns

### NetworkProvider Context
Wrap your app with the network context:

```typescript
function App() {
  const [network, setNetwork] = useState<{gadgets: Map<string, Gadget>} | null>(null)
  
  useEffect(() => {
    // Initialize network
    const net = bootNetwork(config)
    const osc = createOscillator('oscillator') 
    net.gadgets.set('oscillator', osc)
    
    // Set low-strength initial values
    propagate(osc.contacts.get('frequency')!, signal(440, 0.1))
    
    setNetwork({ gadgets: net.gadgets })
  }, [])
  
  if (!network) return <div>Loading...</div>
  
  return (
    <NetworkProvider network={network}>
      <AudioControls />
    </NetworkProvider>
  )
}
```

### Component Structure
Separate network setup from UI components:

```typescript
// ✅ Good: Clean separation
function AudioControls() {
  const oscillator = useGadget('oscillator')
  const [frequency, setFrequency] = useContact<number>(oscillator, 'frequency')
  
  return (
    <Slider 
      value={[frequency || 440]}
      onValueChange={([v]) => setFrequency(v)}
    />
  )
}
```

## Advanced Patterns

### Batching Updates
For multiple rapid updates, use transactions:

```typescript
import { useTransaction } from 'atto-bassline'

function MultiSliderControl() {
  const { withTx } = useTransaction()
  
  const handleBatchUpdate = (values) => {
    withTx(() => {
      setFrequency(values.freq)
      setAmplitude(values.amp) 
      setWaveform(values.wave)
    })
  }
}
```

### Debounced Updates
For high-frequency changes like dragging:

```typescript
import { useDebouncedTransaction } from 'atto-bassline'

function DragSlider() {
  const { debouncedCommit } = useDebouncedTransaction(50) // 50ms debounce
  
  const handleDrag = (value) => {
    setFrequency(value)
    debouncedCommit() // Batches rapid updates
  }
}
```

### Trigger-Based Updates
For expensive operations, use triggers:

```typescript
// Only regenerate waveform when explicitly triggered
const [, triggerWaveform] = useContact<boolean>(oscillator, 'trigger')

const handlePlay = () => {
  triggerWaveform(true)  // Generate new waveform
  setTimeout(() => triggerWaveform(false), 100) // Reset trigger
}
```

## Debugging Guide

### Common Issues

**1. UI not updating despite writes**
```typescript
// Check: Are writes being rejected by stronger signals?
console.log('After write:', contact.signal.value, contact.signal.strength)

// Solution: Reduce initial signal strength
propagate(contact, signal(initialValue, 0.1)) // Lower strength
```

**2. No change detection logs**
```typescript
// Check: Is subscription polling working?
console.log('Starting subscription with value:', contact.signal.value)

// Solution: Verify gadget and contact exist
if (!gadget || !gadget.contacts.get(contactName)) {
  console.error('Gadget or contact not found')
}
```

**3. Audio not updating**
```typescript
// Check: Is the audio chain wired correctly?
// oscillator -> envelope -> mixer -> audio-output

// Solution: Verify all gadgets are trigger-based or use averaged strength
```

### Performance Considerations

**1. Polling Frequency**
The default 60fps polling is usually fine, but can be adjusted:

```typescript
// In useContact implementation:
const interval = setInterval(checkForChanges, 32) // 30fps instead of 60fps
```

**2. Subscription Cleanup**
Hooks automatically clean up, but verify in dev tools:

```typescript
// Should see these logs on component unmount:
console.log('Cleaning up subscription for', gadgetId, contactName)
```

## Migration from Other State Systems

### From useState
```typescript
// Before
const [frequency, setFrequency] = useState(440)

// After  
const [frequency, setFrequency] = useContact<number>(oscillator, 'frequency')
```

### From Redux/Zustand
```typescript
// Before: Actions and reducers
dispatch(setFrequency(440))

// After: Direct propagation
setFrequency(440) // Automatically propagates through network
```

## Best Practices Summary

1. **Use low initial strengths** (0.1) for UI-controllable values
2. **Let useContact manage strength** - don't manually set it
3. **Keep React components thin** - network holds the real state
4. **Use transactions for batching** rapid or related updates
5. **Debug with console logs** to trace propagation flow
6. **Separate network setup from UI** components
7. **Trust the propagation system** - stronger signals win

This approach gives you the power of constraint propagation with the familiarity of React hooks!