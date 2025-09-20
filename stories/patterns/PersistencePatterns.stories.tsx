import type { Meta, StoryObj } from '@storybook/react';
import { useGadget, GadgetContext, Tap } from 'port-graphs-react';
import { lastCell, maxCell, unionCell, withTaps, tapValue, createGadget, changed, noop } from 'port-graphs';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

// Simulated localStorage wrapper
const storage = {
  get: (key: string) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  },
  set: (key: string, value: any) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove: (key: string) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }
};

// Create a persisted gadget that auto-saves to localStorage
function createPersistedGadget<T>(key: string, initial: T) {
  const gadget = withTaps(lastCell(initial));

  // Load from storage on creation
  const stored = storage.get(key);
  if (stored !== null) {
    gadget.receive(stored);
  }

  // Add tap to save on changes
  const originalReceive = gadget.receive.bind(gadget);
  gadget.receive = (data: T) => {
    const effect = originalReceive(data);
    if (effect?.changed !== undefined) {
      storage.set(key, effect.changed);
    }
    return effect;
  };

  return gadget;
}

// User preferences example
interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  fontSize: number;
  notifications: boolean;
}

const defaultPrefs: UserPreferences = {
  theme: 'system',
  fontSize: 14,
  notifications: true
};

// Create persisted preference gadgets
const themeGadget = createPersistedGadget('user-theme', defaultPrefs.theme);
const fontSizeGadget = createPersistedGadget('user-fontSize', defaultPrefs.fontSize);
const notificationsGadget = createPersistedGadget('user-notifications', defaultPrefs.notifications);

function UserPreferencesDemo() {
  const [theme, setTheme] = useGadget(themeGadget);
  const [fontSize, setFontSize] = useGadget(fontSizeGadget);
  const [notifications, setNotifications] = useGadget(notificationsGadget);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setTheme(defaultPrefs.theme);
    setFontSize(defaultPrefs.fontSize);
    setNotifications(defaultPrefs.notifications);
    handleSave();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Persisted User Preferences</CardTitle>
        <CardDescription>
          These preferences are automatically saved to localStorage whenever they change.
          Refresh the page to see them persist!
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {/* Theme selector */}
          <div className="space-y-2">
            <Label htmlFor="theme-select">Theme</Label>
            <Tabs value={theme} onValueChange={(v) => setTheme(v as any)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="light">Light</TabsTrigger>
                <TabsTrigger value="dark">Dark</TabsTrigger>
                <TabsTrigger value="system">System</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Font size */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="fontSize">Font Size</Label>
              <span className="text-sm text-muted-foreground font-mono">{fontSize}px</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setFontSize(Math.max(10, fontSize - 1))}
              >
                <span className="text-lg">−</span>
              </Button>
              <Slider
                id="fontSize"
                min={10}
                max={24}
                step={1}
                value={[fontSize]}
                onValueChange={([value]) => setFontSize(value)}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setFontSize(Math.min(24, fontSize + 1))}
              >
                <span className="text-lg">+</span>
              </Button>
            </div>
          </div>

          {/* Notifications toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="space-y-0.5">
              <Label htmlFor="notifications">Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive notifications about important updates
              </p>
            </div>
            <Switch
              id="notifications"
              checked={notifications}
              onCheckedChange={setNotifications}
            />
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-lg border bg-card p-6">
          <h4 className="text-sm font-medium mb-4">Preview</h4>
          <div className="space-y-2" style={{ fontSize: `${fontSize}px` }}>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Theme:</span>
              <Badge variant="outline">{theme}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Font Size:</span>
              <Badge variant="outline">{fontSize}px</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Notifications:</span>
              <Badge variant={notifications ? "default" : "secondary"}>
                {notifications ? "Enabled" : "Disabled"}
              </Badge>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button onClick={handleSave} variant="default">
            Save Preferences
          </Button>
          <Button onClick={handleReset} variant="outline">
            Reset to Defaults
          </Button>
        </div>

        {saved && (
          <Alert>
            <AlertDescription>Preferences saved successfully!</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

// Session storage for temporary data
const sessionCountGadget = withTaps(lastCell(0));

// Initialize from session storage
if (typeof window !== 'undefined' && window.sessionStorage) {
  const stored = sessionStorage.getItem('session-count');
  if (stored) {
    sessionCountGadget.receive(Number(stored));
  }
}

function SessionStorageDemo() {
  const [count, setCount] = useGadget(sessionCountGadget);

  // Save to session storage on changes
  useEffect(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.setItem('session-count', String(count));
    }
  }, [count]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Session Storage</CardTitle>
        <CardDescription>
          This counter persists for the browser session only.
          Close the tab and it resets!
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10"
            onClick={() => setCount(Math.max(0, count - 1))}
          >
            <span className="text-xl">−</span>
          </Button>
          <div className="text-3xl font-mono font-bold min-w-[4ch] text-center">
            {count}
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10"
            onClick={() => setCount(count + 1)}
          >
            <span className="text-xl">+</span>
          </Button>
        </div>
        <Alert>
          <AlertDescription>
            This value is stored in sessionStorage and will persist until you close the browser tab.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

// CRDT-style sync example using maxCell for conflict resolution
const syncedMaxGadget = withTaps(maxCell(0));

function CRDTSyncDemo() {
  const [value, setValue] = useGadget(syncedMaxGadget);
  const [simulatedRemoteValue, setSimulatedRemoteValue] = useState(0);

  const handleLocalUpdate = (newValue: number) => {
    setValue(newValue);
  };

  const handleRemoteSync = () => {
    // Simulate receiving remote value
    // maxCell automatically resolves conflicts by keeping the max
    setValue(simulatedRemoteValue);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>CRDT-Style Sync with maxCell</CardTitle>
        <CardDescription>
          Using maxCell for automatic conflict resolution.
          The gadget always keeps the maximum value seen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Local updates */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Local Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={value}
                  onChange={(e) => handleLocalUpdate(Number(e.target.value))}
                  className="font-mono"
                />
                <Button
                  variant="outline"
                  onClick={() => handleLocalUpdate(value + 10)}
                >
                  +10
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Simulated remote */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Simulated Remote</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={simulatedRemoteValue}
                  onChange={(e) => setSimulatedRemoteValue(Number(e.target.value))}
                  className="font-mono"
                />
                <Button
                  variant="default"
                  onClick={handleRemoteSync}
                >
                  Sync
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Alert className="border-primary/50">
          <AlertDescription className="space-y-2">
            <div className="flex items-center gap-2">
              <span>Current synced value:</span>
              <Badge variant="default" className="font-mono text-lg px-3">{value}</Badge>
            </div>
            <p className="text-sm">
              Try setting different values locally and remotely. When you sync,
              the maxCell will automatically keep the higher value!
            </p>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

// Combined demo
function PersistencePatternsDemo() {
  return (
    <div className="space-y-6">
      <UserPreferencesDemo />
      <SessionStorageDemo />
      <CRDTSyncDemo />
    </div>
  );
}

const meta = {
  title: 'Patterns/Persistence',
  component: PersistencePatternsDemo,
  parameters: {
    docs: {
      description: {
        component: `
# Persistence Patterns

Gadgets can easily integrate with various persistence mechanisms.

## Patterns

### 1. LocalStorage Persistence
Auto-save gadget state to localStorage for long-term persistence.

\`\`\`typescript
function createPersistedGadget<T>(key: string, initial: T) {
  const gadget = lastCell(initial);

  // Load from storage
  const stored = localStorage.getItem(key);
  if (stored) gadget.receive(JSON.parse(stored));

  // Save on changes
  gadget.tap(effect => {
    if (effect?.changed !== undefined) {
      localStorage.setItem(key, JSON.stringify(effect.changed));
    }
  });

  return gadget;
}
\`\`\`

### 2. SessionStorage
Temporary persistence for the browser session.

### 3. CRDT-Style Sync
Use ACI gadgets (like maxCell) for automatic conflict resolution:

\`\`\`typescript
const syncedMax = maxCell(0);
// Receives values from multiple sources
// Always keeps the maximum - no conflicts!
\`\`\`

## Benefits

- **Automatic Persistence** - Gadgets handle saving automatically
- **Conflict Resolution** - ACI gadgets resolve conflicts naturally
- **Flexible Storage** - Works with any storage backend
- **Reactive Loading** - UI updates when data loads
        `
      }
    }
  }
} satisfies Meta<typeof PersistencePatternsDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <PersistencePatternsDemo />
};