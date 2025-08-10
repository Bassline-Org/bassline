# React Router v7 Learnings & Guidelines

## Key Concepts Learned

### 1. File-Based Routing with `@react-router/fs-routes`

#### Setup
```bash
pnpm i @react-router/fs-routes
```

```typescript
// app/routes.ts
import { type RouteConfig } from "@react-router/dev/routes";
import { flatRoutes } from "@react-router/fs-routes";

export default flatRoutes() satisfies RouteConfig;
```

#### File Naming Conventions
- **Dot notation** creates URL segments: `flow.session.$sessionId.tsx` → `/flow/session/:sessionId`
- **Dynamic segments** use `$`: `$sessionId` becomes `:sessionId` param
- **Index routes** use `_index`: `flow.session.$sessionId._index.tsx`
- **Folder organization**: Use folders with `route.tsx` for complex routes

### 2. Client-Side Rendering (SSR Disabled)

When SSR is disabled in `react-router.config.ts`:
```typescript
export default {
  ssr: false,
} satisfies Config;
```

**Important**: Use `clientLoader` instead of `loader`:
```typescript
// ✅ Correct for client-side only
export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  return { data: 'value' }
}

// ❌ Wrong - this expects SSR
export async function loader() { }
```

### 3. Route Architecture for Stable State

#### Parent-Child Pattern
**Problem**: State/connections getting recreated on navigation

**Solution**: Parent route owns stable resources
```typescript
// Parent route (loads once)
export async function clientLoader({ params }) {
  // Create expensive resources here (network clients, connections)
  const client = await createExpensiveResource(params.sessionId)
  return { client }
}

// Child routes access via context
const context = useOutletContext<{ client: NetworkClient }>()
```

### 4. Navigation Protection

#### `useBeforeUnload` - Browser Refresh/Close
```typescript
import { useBeforeUnload } from 'react-router'

useBeforeUnload(
  useCallback((e: BeforeUnloadEvent) => {
    if (hasUnsavedChanges) {
      e.preventDefault()
      e.returnValue = '' // Legacy support
    }
  }, [hasUnsavedChanges])
)
```

#### `useBlocker` - SPA Navigation
```typescript
import { useBlocker } from 'react-router'

const blocker = useBlocker(
  ({ currentLocation, nextLocation }) => 
    hasUnsavedChanges && 
    currentLocation.pathname !== nextLocation.pathname
)

// Show dialog when blocked
if (blocker.state === "blocked") {
  // Show confirmation UI
  // blocker.proceed() to continue
  // blocker.reset() to cancel
}
```

### 5. Session Management Pattern

**Key Insight**: Sessions can persist across entire app, not just within routes

```typescript
// Singleton session manager
const sessions = new Map<string, Session>()

export async function getOrCreateSession(sessionId: string) {
  const existing = sessions.get(sessionId)
  if (existing) return existing
  
  // Create once, reuse everywhere
  const session = await createSession(sessionId)
  sessions.set(sessionId, session)
  return session
}
```

### 6. Data Flow Best Practices

#### Avoid React State for Server Data
```typescript
// ❌ Bad - causes re-render storms
const [data, setData] = useState()
useEffect(() => {
  fetchData().then(setData)
}, [])

// ✅ Good - let React Router handle it
export async function clientLoader() {
  return await fetchData()
}
const data = useLoaderData()
```

#### Revalidation Control
```typescript
// Control when loader reruns
export function shouldRevalidate({ 
  currentParams, 
  nextParams 
}) {
  // Only reload if params change
  return currentParams.id !== nextParams.id
}
```

## Architecture Patterns

### 1. Resource Lifecycle Management
- Create expensive resources (network clients, WebSocket connections) in parent route loaders
- Child routes share via `useOutletContext`
- Clean up in session manager, not component unmount

### 2. Navigation Hierarchy
```
/flow-experiment                 # Landing page
/session-manager                 # Manage all sessions
/flow/session/:sessionId         # Parent (owns network client)
  ├─ /editor                    # Child (uses client)
  ├─ /properties               # Child (uses client)
  └─ /debug                    # Child (uses client)
```

### 3. Protection Scope
- Root-level protection for app-wide resources
- Route-level protection for route-specific resources
- Use `useBeforeUnload` at root for browser refresh
- Use `useBlocker` selectively for SPA navigation

## Common Pitfalls to Avoid

1. **Don't export `loader` when SSR is disabled** - use `clientLoader`
2. **Don't create resources in components** - use route loaders
3. **Don't use `useState` for server data** - use `useLoaderData`
4. **Don't rely on component lifecycle** - routes control resource lifecycle
5. **Don't block all navigation** - be selective with `useBlocker`

## Debugging Tips

1. **Check loader execution**: Add console.logs to verify when loaders run
2. **Inspect session state**: `window.__BASSLINE_SESSIONS__` in console
3. **Monitor revalidation**: Log in `shouldRevalidate` to see why routes reload
4. **Test protection**: Try refresh/navigation with active sessions

## Benefits of This Architecture

✅ **Stable Connections**: Network clients survive navigation  
✅ **No Re-renders**: Data flows through loaders, not state  
✅ **Session Persistence**: Work continues across route changes  
✅ **User Protection**: Prevents accidental data loss  
✅ **Clean Code**: Separation of concerns between routes  
✅ **Scalable**: Easy to add new routes without affecting others