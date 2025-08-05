# Worker UI Integration Architecture

## Philosophy

Keep it simple: React Router handles initial data loading, React hooks handle real-time subscriptions. No complex invalidation schemes needed.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Component     │    │  clientLoader   │    │  NetworkClient  │
│  + useWorker    │◄───│  (Initial Data) │◄───│   (Singleton)   │
│   Subscription  │    └─────────────────┘    └─────────────────┘
└─────────────────┘                                    │
         ▲                                             ▼
         └─────────────────────────────────────────────┐
                                                       │
                                               ┌─────────────────┐
                                               │  Worker Thread  │
                                               └─────────────────┘
```

## Key Patterns

### 1. Initial Data Loading
```typescript
// Route loader gets initial state
export async function clientLoader({ params }) {
  const client = getNetworkClient()
  const groupState = await client.getState(params.groupId)
  
  return {
    groupId: params.groupId,
    initialGroupState: groupState
  }
}
```

### 2. Component Subscriptions
```typescript
// Components subscribe to real-time updates
function ContactNode({ contactId, initialContact }) {
  const { contact, loading } = useContact(contactId, initialContact)
  
  // Component automatically updates when worker changes
  return <ContactView contact={contact} />
}
```

### 3. Form-Based Actions
```typescript
// All mutations go through standard form actions
export async function clientAction({ request }) {
  const client = getNetworkClient()
  const formData = await request.formData()
  
  await client.scheduleUpdate(
    formData.get('contactId'),
    formData.get('content')
  )
  
  return { success: true }
}
```

### 4. Custom Hooks for Subscriptions
```typescript
export function useContact(contactId: string, initialContact?: Contact) {
  const [contact, setContact] = useState(initialContact)
  
  useEffect(() => {
    const client = getNetworkClient()
    
    const unsubscribe = client.subscribe((changes) => {
      const contactChange = changes.find(change => 
        change.type === 'contact-updated' && 
        change.data.contactId === contactId
      )
      
      if (contactChange) {
        setContact(contactChange.data.contact)
      }
    })
    
    return unsubscribe
  }, [contactId])
  
  return { contact, loading: !contact }
}
```

## Data Flow

### Initial Load
1. Route loads → clientLoader gets initial data → Component renders
2. Component hook subscribes to worker updates

### Real-time Updates
1. Worker change → NetworkClient notifies subscribers
2. Hook filters for relevant changes → Updates component state
3. Component re-renders with new data

### User Actions
1. Component submits form → Action runs → Worker processes
2. Worker change → Hook receives update → Component reflects change

## Benefits

1. **Simple**: Just React hooks + React Router patterns
2. **Fast Initial Load**: clientLoader provides immediate data
3. **Real-time**: Worker changes flow directly to components
4. **No Route Invalidation**: Components update themselves
5. **Granular**: Each component subscribes to only what it needs
6. **Standard**: Uses familiar React and React Router patterns

## Demo Implementation

See `app/routes/demo.tsx` for a working example that demonstrates:
- Initial data loading from worker
- Real-time updates in React Flow
- Form-based mutations
- Component-level subscriptions

This architecture eliminates the tight coupling between network implementation and UI while maintaining excellent real-time performance.