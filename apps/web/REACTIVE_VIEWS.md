# Reactive Views in Bassline REPL

## What We Built

We've added **reactive event handlers** to the Bassline view dialect! Now buttons and inputs can execute Bassline code and update the UI interactively.

## Features

### 1. Event Handler Syntax

The view dialect now supports `on-<event>` handlers:

```bassline
; Button with on-click handler
button "Click Me" on-click [print "Button clicked!"]

; Input with on-change handler
input "Type here..." on-change [set name value]
```

### 2. Automatic Re-rendering

When a button click or input change modifies Bassline state, the view automatically re-renders to reflect the new state.

### 3. Supported Events

- **`on-click`** - Button clicks
- **`on-change`** - Input text changes (the new value is available as `value`)

## How It Works

### Architecture

```
User clicks button
  ↓
React ViewComponent fires onClick
  ↓
Executes Bassline block via repl.eval()
  ↓
Updates Bassline context state
  ↓
Triggers onViewAction callback
  ↓
React re-renders view with new state
```

### Data Flow

1. **View description** - Bassline creates view with handlers
2. **React renders** - ViewComponent renders button/input
3. **User interaction** - Click/type triggers event
4. **Bassline execution** - Handler block executes
5. **State update** - Context variables change
6. **Re-render** - View updates automatically

## Testing

### 1. Basic Counter

Try this in the REPL:

```bassline
counter: 0

view [
    text "Count: " (to-string counter)
    button "+" on-click [set counter counter + 1]
    button "-" on-click [set counter counter - 1]
]
```

Click the buttons - the count should update!

### 2. Input Echo

```bassline
name: ""

view [
    input "Your name..." on-change [set name value]
    text "Hello, " name "!"
]
```

Type in the input - your name should appear below!

### 3. Load Examples

The full demo is in:
```
packages/lang/examples/reactive-ui-demo.bl
```

You can load it with:
```bassline
load %packages/lang/examples/reactive-ui-demo.bl
```

## Implementation Details

### Prelude Changes ([prelude.js:857-930](packages/lang/src/prelude.js#L857-L930))

The view dialect parser now:
1. Detects `on-<event>` keywords (e.g., `on-click`, `on-change`)
2. Captures the following block as the handler
3. Stores handlers in component metadata

**Key code:**
```javascript
// Check for event handler keywords
if (isa(arg, Word) && arg.spelling.description.toLowerCase().startsWith("on-")) {
    const eventName = arg.spelling.description.toLowerCase();
    const actionBlock = viewStream.next();
    if (isa(actionBlock, Block)) {
        handlers[eventName] = actionBlock;
    }
    continue;
}
```

### React Changes ([ReplOutput.tsx](apps/web/app/routes/bassline-repl/components/ReplOutput.tsx))

#### Button Component (lines 360-389)
```typescript
const action = handlers["on-click"] || args[1]?.value;

const handleClick = async () => {
    if (action && repl) {
        await repl.eval(action);  // Execute action block
        if (onViewAction) {
            onViewAction();  // Trigger re-render
        }
    }
};
```

#### Input Component (lines 391-423)
```typescript
const onChange = handlers["on-change"];

const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);

    if (onChange && repl) {
        // Set 'value' variable before executing handler
        await repl.eval(`value: "${newValue}"`);
        await repl.eval(onChange);
        if (onViewAction) {
            onViewAction();
        }
    }
};
```

## Current Limitations

1. **Manual re-render trigger** - We force a re-render by updating history state
2. **No automatic dependency tracking** - Views don't auto-update when referenced values change
3. **Input state is local** - Input value is managed by React, not Bassline

## Next Steps

### Phase 2: Proper Reactive State Tracking

To make views truly reactive (auto-update when dependencies change):

1. **Track dependencies** - Record which values a view reads
2. **Observable contexts** - Emit events when values change
3. **Automatic re-evaluation** - Re-render views when dependencies update

```bassline
; Future: This would auto-update when counter changes
counter: reactive [value: 0]

view [
    text "Count: " counter/value  ; Tracked dependency
    button "+" on-click [set counter/value counter/value + 1]
]
```

### Phase 3: Layout Components

Add structural components:
- `row` - Horizontal layout
- `column` - Vertical layout
- `panel` - Titled container
- `tabs` - Tabbed interface

### Phase 4: Self-Hosted REPL UI

Define the entire REPL interface in Bass line:

```bassline
; repl-ui.bl - The REPL UI built with Bassline!
repl-layout: view [
    column [
        status-bar
        row [
            column [output-area input-area]
            column [async-panel remote-panel]
        ]
    ]
]
```

## Why This Is Powerful

1. **Immediate feedback** - Edit `.bl` files, see results instantly
2. **Dogfooding** - The system validates itself
3. **User customization** - Anyone can modify the REPL UI
4. **Meta-circular** - The tool builds its own interface
5. **No build step** - Just edit Bassline code

## Troubleshooting

### Views don't update after clicking

Check the browser console for errors. The action might be failing silently.

### Button does nothing

Make sure you're using `on-click` (with hyphen), not `onclick`.

### Input value doesn't show in text

The input creates a `value` variable. Reference it like:
```bassline
text "You typed: " value
```

Not like:
```bassline
text "You typed: " name  ; Wrong - 'name' is the variable you set
```

## Success! 🎉

We now have **reactive, interactive UIs in Bassline!** This is the foundation for building self-hosted, customizable interfaces.

Try the examples and see it in action!
