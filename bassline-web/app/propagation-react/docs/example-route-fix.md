# Example Route Fix

## Issue
When loading examples through the `editor.$bassline.tsx` route (e.g., `/editor/valence-test`), the application was throwing:
```
useContextFrame is not defined
```

## Root Cause
The `editor.$bassline.tsx` route had its own provider setup but was missing several context providers that the components now require:
- UIStackProvider
- ContextFrameProvider  
- PropertyPanelStackProvider
- ValenceModeProvider

ContactNode and GroupNode components use these hooks, causing the error when the providers weren't available.

## Solution
Added all missing providers to the `editor.$bassline.tsx` route in the correct order:

```tsx
<NetworkProvider initialNetwork={network} key={basslineName} skipDefaultContent={true}>
  <UIStackProvider>
    <PropertyPanelStackProvider>
      <ReactFlowProvider>
        <ContextFrameProvider>
          <ClientOnly fallback={<div>Loading...</div>}>
            <SoundSystemProvider>
              <ValenceModeProvider>
                <Flow basslineName={basslineName || 'untitled'} />
              </ValenceModeProvider>
            </SoundSystemProvider>
          </ClientOnly>
        </ContextFrameProvider>
      </ReactFlowProvider>
    </PropertyPanelStackProvider>
  </UIStackProvider>
</NetworkProvider>
```

## Key Points
1. The provider order matters - some providers depend on others
2. Both main editor routes (`editor.tsx` and `editor.$bassline.tsx`) need the same provider setup
3. This is a temporary fix - eventually both routes should share the same provider configuration

## Testing
All example routes should now work:
- `/editor/valence-test`
- `/editor/mixed-valence-test`
- `/editor/contacts-valence-test`
- `/editor/valence-mode-demo`
- `/editor/simple`
- `/editor/complex`
- etc.