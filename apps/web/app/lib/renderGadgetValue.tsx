import type { ReactNode } from 'react';
import { Badge } from '~/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table';

// Type detection helpers
function isGadget(value: any): boolean {
  return value && typeof value === 'object' && typeof value.current === 'function';
}

function isTable(value: any): boolean {
  return value && typeof value === 'object' && !Array.isArray(value) && value.constructor === Object;
}

// Formatting helpers
function formatNumber(num: number, format?: string): string {
  if (format === 'currency') return `$${num.toFixed(2)}`;
  if (format === 'percentage') return `${(num * 100).toFixed(1)}%`;
  return String(num);
}

function truncate(str: string, maxLength: number = 50): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

// Get metadata value helper
function getMeta(metadata: any, key: string): any {
  if (!metadata || typeof metadata.get !== 'function') return undefined;
  const cell = metadata.get(key);
  return cell && typeof cell.current === 'function' ? cell.current() : undefined;
}

export interface RenderOptions {
  maxDepth?: number;
  currentDepth?: number;
  truncateLength?: number;
  inline?: boolean;
}

/**
 * Smart rendering of any gadget value with type detection and metadata support
 */
export function renderGadgetValue(
  value: any,
  metadata?: any,
  options: RenderOptions = {}
): ReactNode {
  const {
    maxDepth = 3,
    currentDepth = 0,
    truncateLength = 50,
    inline = false
  } = options;

  // Check if we've exceeded max depth
  if (currentDepth >= maxDepth) {
    return <span className="text-gray-400 italic">...</span>;
  }

  // Check for custom display hint in metadata
  const displayAs = getMeta(metadata, 'ui/display-as');
  const format = getMeta(metadata, 'ui/format');
  const color = getMeta(metadata, 'ui/color');
  const icon = getMeta(metadata, 'ui/icon');

  // Handle null/undefined
  if (value === null) {
    return <Badge variant="outline" className="text-gray-400">null</Badge>;
  }
  if (value === undefined) {
    return <Badge variant="outline" className="text-gray-400">undefined</Badge>;
  }

  // Custom display mode override
  if (displayAs === 'json') {
    return (
      <pre className="text-xs font-mono bg-gray-50 p-2 rounded overflow-x-auto">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }

  if (displayAs === 'badge') {
    return (
      <Badge style={{ backgroundColor: color }}>
        {icon && <span className="mr-1">{icon}</span>}
        {String(value)}
      </Badge>
    );
  }

  // Primitive types
  if (typeof value === 'number') {
    const formatted = formatNumber(value, format);
    return (
      <Badge variant="secondary" className="font-mono">
        {icon && <span className="mr-1">{icon}</span>}
        {formatted}
      </Badge>
    );
  }

  if (typeof value === 'string') {
    const display = inline ? truncate(value, truncateLength) : value;
    return (
      <span className="font-mono text-sm" title={value}>
        {icon && <span className="mr-1">{icon}</span>}
        {display}
      </span>
    );
  }

  if (typeof value === 'boolean') {
    return (
      <Badge variant={value ? 'default' : 'outline'}>
        {value ? '✓ true' : '✗ false'}
      </Badge>
    );
  }

  // Special object types
  if (value instanceof Set) {
    if (displayAs === 'table' && !inline) {
      const items = Array.from(value);
      return (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, i) => (
                <TableRow key={i}>
                  <TableCell>
                    {renderGadgetValue(item, undefined, { ...options, currentDepth: currentDepth + 1, inline: true })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1">
        <Badge variant="outline">Set({value.size})</Badge>
        {!inline && value.size > 0 && (
          <div className="flex flex-wrap gap-1 ml-2">
            {Array.from(value).slice(0, 5).map((item, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {String(item)}
              </Badge>
            ))}
            {value.size > 5 && (
              <Badge variant="outline" className="text-xs">+{value.size - 5} more</Badge>
            )}
          </div>
        )}
      </div>
    );
  }

  if (value instanceof Map) {
    return (
      <Badge variant="outline">Map({value.size})</Badge>
    );
  }

  if (value instanceof Date) {
    return (
      <span className="font-mono text-sm">
        {value.toLocaleString()}
      </span>
    );
  }

  // Arrays
  if (Array.isArray(value)) {
    if (inline || value.length === 0) {
      return <Badge variant="outline">Array({value.length})</Badge>;
    }

    if (displayAs === 'table') {
      return (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">#</TableHead>
                <TableHead>Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {value.map((item, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs text-gray-500">{i}</TableCell>
                  <TableCell>
                    {renderGadgetValue(item, undefined, { ...options, currentDepth: currentDepth + 1, inline: true })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      );
    }

    // Default list rendering
    return (
      <div className="space-y-1">
        {value.slice(0, 10).map((item, i) => (
          <div key={i} className="flex items-start gap-2 text-sm">
            <span className="text-gray-400 font-mono text-xs">{i}:</span>
            {renderGadgetValue(item, undefined, { ...options, currentDepth: currentDepth + 1, inline: true })}
          </div>
        ))}
        {value.length > 10 && (
          <Badge variant="outline" className="text-xs">+{value.length - 10} more items</Badge>
        )}
      </div>
    );
  }

  // Gadgets - render their current value recursively
  if (isGadget(value)) {
    try {
      const gadgetValue = value.current();
      const gadgetMeta = value.metadata;
      return (
        <div className="border-l-2 border-blue-300 pl-2">
          <div className="text-xs text-blue-600 mb-1">Gadget</div>
          {renderGadgetValue(gadgetValue, gadgetMeta, { ...options, currentDepth: currentDepth + 1 })}
        </div>
      );
    } catch (e) {
      return <Badge variant="destructive">Error reading gadget</Badge>;
    }
  }

  // Plain objects / Tables
  if (isTable(value)) {
    const entries = Object.entries(value);

    if (entries.length === 0) {
      return <Badge variant="outline">{'{}'}</Badge>;
    }

    if (inline) {
      return <Badge variant="outline">Object({entries.length})</Badge>;
    }

    if (displayAs === 'table' || entries.length > 3) {
      return (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map(([key, val]) => (
                <TableRow key={key}>
                  <TableCell className="font-mono text-sm">{key}</TableCell>
                  <TableCell>
                    {renderGadgetValue(val, undefined, { ...options, currentDepth: currentDepth + 1, inline: true })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      );
    }

    // Small objects as key-value list
    return (
      <div className="space-y-1">
        {entries.map(([key, val]) => (
          <div key={key} className="flex items-start gap-2 text-sm">
            <span className="font-mono text-gray-600">{key}:</span>
            {renderGadgetValue(val, undefined, { ...options, currentDepth: currentDepth + 1, inline: true })}
          </div>
        ))}
      </div>
    );
  }

  // Functions
  if (typeof value === 'function') {
    const name = value.name || 'anonymous';
    return (
      <Badge variant="outline" className="font-mono text-xs">
        ƒ {name}
      </Badge>
    );
  }

  // Fallback
  const str = String(value);
  return (
    <span className="font-mono text-sm text-gray-500" title={str}>
      {truncate(str, truncateLength)}
    </span>
  );
}

/**
 * Render a key-value pair with smart value rendering
 */
export function renderKeyValue(
  key: string,
  value: any,
  metadata?: any,
  options?: RenderOptions
): ReactNode {
  return (
    <div className="flex items-start gap-2 py-1">
      <span className="font-mono text-sm text-gray-600 min-w-[100px]">{key}</span>
      <div className="flex-1">
        {renderGadgetValue(value, metadata, options)}
      </div>
    </div>
  );
}
