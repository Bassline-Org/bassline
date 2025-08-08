# Kernel Architecture Migration Plan

## Architecture Overview
We're implementing a kernel/userspace model where:
- **UserspaceRuntime**: Combines scheduling + propagation execution (start simple, split later)
- **Kernel**: Routes changes between userspace and drivers, manages all I/O
- **Drivers**: Handle side effects (storage, networking, CLI, UI)

## Bidirectional Communication Flow
```
External Input → Bridge Driver → Kernel → UserspaceRuntime.scheduleUpdate()
                                    ↓
UserspaceRuntime.propagate() → Kernel.handleChange() → Storage/Bridge Drivers
```

## Core Principles
1. **Userspace stays pure** - Only propagation math, no I/O concerns
2. **Kernel handles all side effects** - Storage, networking, external communication
3. **Asynchronous boundaries** - No blocking between userspace and kernel
4. **Loud failures** - All errors explicit through kernel's driver system
5. **Future extensibility** - Clean path to split scheduling from runtime later

## Implementation Steps

### Step 1: Create UserspaceRuntime (20 min)
- Create new `UserspaceRuntime` class combining current scheduler + propagation logic
- Constructor takes `Kernel` reference for emitting changes
- Add `receiveExternalInput(change)` method for kernel → userspace flow
- Modify propagation to emit `ContactChange` to kernel after updating contacts
- Keep propagation synchronous, make kernel emissions async (fire-and-forget)

### Step 2: Update Kernel Integration (10 min)
- Ensure kernel's `setUserspaceHandler()` calls `UserspaceRuntime.receiveExternalInput()`
- Verify kernel's async `handleChange()` doesn't block userspace propagation
- Add kernel's `hasPendingWork()` and `waitForCompletion()` methods for testing

### Step 3: Test Kernel + Memory Storage (15 min)
- Create basic test: UserspaceRuntime + Kernel + MemoryStorageDriver
- Test: external input → propagation → storage
- Test: propagation → kernel emission → storage persistence
- Verify no silent failures, all errors are loud

### Step 4: Create PostgreSQL Storage Driver (15 min)
- Create driver in `packages/storage-postgres/src/driver.ts`
- Implement `StorageDriver` interface wrapping existing PostgreSQL storage
- Move `ensureGroupExists` logic to `checkPreconditions()`
- Add transaction support via optional batch methods

### Step 5: Replace CLI Architecture (20 min)
- Replace `StorageBackedRuntime` with `UserspaceRuntime + Kernel + Drivers`
- Create simple CLI bridge driver for external commands
- Update existing CLI tests to work with new architecture
- Verify elimination of silent storage failures

## Future Extensibility Notes
- **Sophisticated Scheduling**: When needed, split `UserspaceRuntime` into `Scheduler + Runtime`
- **Multiple Drivers**: Kernel already supports multiple storage/bridge drivers
- **Performance**: Async kernel operations don't block propagation
- **Testing**: Kernel provides clean boundaries for mocking and testing

## Success Criteria
1. **Silent failures eliminated** - All storage errors are explicit and loud
2. **Clean separation** - Userspace pure, kernel handles all I/O
3. **Existing functionality preserved** - CLI tests pass with new architecture
4. **Performance maintained** - Propagation not blocked by storage operations
5. **Architecture validated** - Clear path for future scheduling sophistication

---

## Implementation Status
- [x] Kernel types and interfaces defined
- [x] Memory storage driver created
- [ ] UserspaceRuntime implementation
- [ ] Kernel integration testing
- [ ] PostgreSQL storage driver
- [ ] CLI architecture replacement