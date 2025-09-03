# Stage-Parametric Reactive System

## Goals

Transform our reactive propagator system from simple mode polymorphism to a powerful **stage-parametric system** inspired by the "Collapsing Towers of Interpreters" approach from Pink.

### **Core Vision**
- **Meta-Environments**: Each strategy defines its own versions of functions in a meta-environment
- **Stack-Based Fallback**: Strategies are layered in a stack, with fallback to previous environments
- **Dynamic Binding**: Strategies are threaded through the call stack using dynamic binding
- **Composable Strategies**: Multiple strategies can be composed and layered arbitrarily

### **Key Benefits**
1. **Flexible Evaluation**: Mix compilation, debugging, wiring, and execution in the same program
2. **Composable Strategies**: Layer strategies without modifying existing code
3. **Clean Separation**: Each strategy only defines what it needs to override
4. **Performance**: Can optimize different parts of the system differently
5. **Distributed Ready**: Strategies can handle serialization, network protocols, etc.

## Architecture

### **Meta-Environment System**
```typescript
type MetaEnv = Record<string, Function>;
let metaEnvStack: MetaEnv[] = [{}]; // Empty default environment
```

### **Strategy Definition**
Each strategy is a meta-environment that defines overrides for specific functions:
- **Compile Strategy**: Overrides functions to compile them to code
- **Debug Strategy**: Overrides functions to add logging/debugging
- **Wiring Strategy**: Overrides functions to handle reactive wiring
- **Serialize Strategy**: Overrides functions to handle network serialization

### **Fallback Mechanism**
When a function isn't defined in the current meta-environment, the system automatically falls back to the previous environment in the stack, creating a **chain of responsibility** pattern.

### **Dynamic Binding**
Strategies are applied using `withMetaEnv()` which pushes environments onto the stack and restores them when done, similar to dynamic binding in Lisp.

## Implementation Plan

### **Phase 1: Core Meta-Environment System**
- [ ] Implement `metaEnvStack` and `withMetaEnv()`
- [ ] Create `metaCall()` function with environment lookup
- [ ] Add fallback mechanism to previous environments
- [ ] Test basic environment switching

### **Phase 2: Strategy Environments**
- [ ] Define compile strategy meta-environment
- [ ] Define debug strategy meta-environment  
- [ ] Define wiring strategy meta-environment
- [ ] Test individual strategies

### **Phase 3: Reactive Integration**
- [ ] Integrate meta-environment system with existing `createReactive()`
- [ ] Update `Cell` and `Gadget` to use `metaCall()`
- [ ] Ensure backward compatibility with existing code
- [ ] Test reactive components with strategies

### **Phase 4: Strategy Composition**
- [ ] Test layered strategy composition
- [ ] Implement strategy-specific optimizations
- [ ] Add serialization strategy for distributed systems
- [ ] Performance testing and optimization

### **Phase 5: Documentation and Examples**
- [ ] Update main documentation
- [ ] Create examples showing strategy composition
- [ ] Document best practices for strategy design
- [ ] Create migration guide from mode polymorphism

## Success Criteria

1. **Backward Compatibility**: Existing reactive code continues to work unchanged
2. **Strategy Composition**: Can layer multiple strategies (debug + compile + wiring)
3. **Performance**: No significant overhead when not using strategies
4. **Flexibility**: Easy to add new strategies without modifying existing code
5. **Type Safety**: Full TypeScript support maintained

## Example Usage

```typescript
// Layer multiple strategies
withMetaEnv(debugMetaEnv, () => {
    withMetaEnv(compileMetaEnv, () => {
        withMetaEnv(wiringMetaEnv, () => {
            const gadget = Gadget(() => a() + b());
            // This will be debugged, compiled, and wired
        });
    });
});

// Individual strategies
withMetaEnv(compileMetaEnv, () => {
    const compiledCell = Cell(mergeFn, 0);
    // Cell gets compiled to optimized code
});
```

This approach will transform our reactive system into a powerful, flexible platform for staged computation while maintaining the clean, minimal API we've already built.
