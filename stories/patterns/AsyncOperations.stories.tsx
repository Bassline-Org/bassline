import type { Meta, StoryObj } from '@storybook/react';
import { useGadget, GadgetContext, Tap } from 'port-graphs-react';
import { lastCell, withTaps, tapValue, tapTransform } from 'port-graphs';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Async state gadgets - cells that track loading/error/data
const searchQueryGadget = withTaps(lastCell(''));
const loadingGadget = withTaps(lastCell(false));
const errorGadget = withTaps(lastCell(null));
const resultsGadget = withTaps(lastCell([]));

// Simulated API call
async function searchAPI(query: string): Promise<Array<{ id: string; title: string; description: string }>> {
  await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network delay

  if (query.toLowerCase() === 'error') {
    throw new Error('Search failed: Invalid query');
  }

  if (query === '') {
    return [];
  }

  // Generate mock results
  return Array.from({ length: 5 }, (_, i) => ({
    id: `${query}-${i}`,
    title: `${query} Result ${i + 1}`,
    description: `This is a search result for "${query}" - item ${i + 1}`
  }));
}

// Search component that demonstrates async operations
function AsyncSearch() {
  const [query, setQuery] = useGadget(searchQueryGadget);
  const [loading, setLoading] = useGadget(loadingGadget);
  const [error, setError] = useGadget(errorGadget);
  const [results, setResults] = useGadget(resultsGadget);
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;

    // Update query (triggers the search)
    setQuery(searchTerm);

    // Set loading state
    setLoading(true);
    setError(null);

    try {
      const data = await searchAPI(searchTerm);
      setResults(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Wire up gadgets for reactive updates */}
      <GadgetContext gadget={searchQueryGadget}>
        <Tap handler={(effect) => {
          console.log('Search query changed:', effect?.changed);
        }} />
      </GadgetContext>

      <div className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Async Operations with Gadgets</CardTitle>
            <CardDescription>
              Demonstrating loading states, error handling, and async data fetching.
              Try searching for "error" to trigger an error state.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Search input */}
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="flex gap-2">
                <Input
                  id="search"
                  type="text"
                  placeholder="Enter search term..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch();
                    }
                  }}
                />
                <Button
                  onClick={handleSearch}
                  disabled={loading || !searchTerm.trim()}
                >
                  {loading ? 'Searching...' : 'Search'}
                </Button>
              </div>
            </div>

            {/* Current state indicators */}
            <div className="flex gap-2">
              {query && (
                <Badge variant="secondary">
                  Query: {query}
                </Badge>
              )}
              {loading && (
                <Badge variant="default">
                  Loading...
                </Badge>
              )}
              {error && (
                <Badge variant="destructive">
                  Error
                </Badge>
              )}
              {!loading && !error && results.length > 0 && (
                <Badge variant="outline">
                  {results.length} results
                </Badge>
              )}
            </div>

            {/* Error display */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Loading skeleton */}
            {loading && (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="pt-6">
                      <Skeleton className="h-4 w-3/4 mb-2" />
                      <Skeleton className="h-3 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Results display */}
            {!loading && !error && results.length > 0 && (
              <div className="space-y-3">
                {results.map((result) => (
                  <Card key={result.id}>
                    <CardContent className="pt-6">
                      <h3 className="font-semibold mb-1">{result.title}</h3>
                      <p className="text-sm text-muted-foreground">{result.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* No results message */}
            {!loading && !error && results.length === 0 && query && (
              <Card className="bg-muted">
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No results found for "{query}"
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// Cancellable operations example
function CancellableOperations() {
  const [operationId, setOperationId] = useState(0);
  const [activeOperation, setActiveOperation] = useState<number | null>(null);
  const [result, setResult] = useState<string>('');
  const [cancelled, setCancelled] = useState(false);

  const startLongOperation = () => {
    const id = operationId + 1;
    setOperationId(id);
    setActiveOperation(id);
    setCancelled(false);
    setResult('');

    // Simulate long-running operation
    const timeoutId = setTimeout(() => {
      if (activeOperation === id) {
        setResult(`Operation ${id} completed successfully!`);
        setActiveOperation(null);
      }
    }, 3000);

    // Store timeout ID for cancellation
    (window as any)[`operation_${id}`] = timeoutId;
  };

  const cancelOperation = () => {
    if (activeOperation !== null) {
      clearTimeout((window as any)[`operation_${activeOperation}`]);
      setCancelled(true);
      setResult(`Operation ${activeOperation} was cancelled`);
      setActiveOperation(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cancellable Operations</CardTitle>
        <CardDescription>
          Start a long-running operation and cancel it before completion.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            onClick={startLongOperation}
            disabled={activeOperation !== null}
          >
            Start Operation
          </Button>
          <Button
            onClick={cancelOperation}
            variant="destructive"
            disabled={activeOperation === null}
          >
            Cancel
          </Button>
        </div>

        {activeOperation !== null && (
          <div className="space-y-2">
            <div className="text-sm">Operation {activeOperation} is running...</div>
            <div className="w-full bg-secondary rounded-full h-2">
              <div className="bg-primary h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        )}

        {result && (
          <Alert variant={cancelled ? "destructive" : "default"}>
            <AlertDescription>{result}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

// Combined demo
function AsyncOperationsDemo() {
  return (
    <div className="space-y-6">
      <AsyncSearch />
      <CancellableOperations />
    </div>
  );
}

const meta = {
  title: 'Patterns/Async Operations',
  component: AsyncOperationsDemo,
  parameters: {
    docs: {
      description: {
        component: `
# Async Operations Pattern

Gadgets can easily handle async operations, loading states, and error handling.

## Key Patterns

1. **Loading State Gadget** - Track async operation status
2. **Error Gadget** - Centralized error handling
3. **Result Gadget** - Store async operation results
4. **Cancellation** - Handle operation cancellation

## Examples

\`\`\`typescript
// Loading state management
const loadingGadget = lastCell(false);
const errorGadget = lastCell<Error | null>(null);
const dataGadget = lastCell<Data | null>(null);

// Async operation
async function fetchData() {
  setLoading(true);
  setError(null);

  try {
    const data = await api.fetch();
    setData(data);
  } catch (err) {
    setError(err);
  } finally {
    setLoading(false);
  }
}
\`\`\`

## Benefits

- **Separation of Concerns** - Loading, error, and data are separate
- **Reactive Updates** - UI automatically updates with state changes
- **Cancellation Support** - Easy to implement with gadget state
- **Error Recovery** - Centralized error handling and recovery
        `
      }
    }
  }
} satisfies Meta<typeof AsyncOperationsDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <AsyncOperationsDemo />
};