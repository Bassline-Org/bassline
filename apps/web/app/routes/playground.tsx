import { cells, fn, table, withMetadata, type Implements, type SweetCell, type Valued } from "@bassline/core"
import { useGadget, useMetadata } from "@bassline/react";
import { Inspector } from "~/components/inspector";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import * as _ from "lodash";

export function meta() {
    return [
        { title: "Playground" },
        { name: "description", content: "Playground" },
    ]
}

type Cell<T> = Implements<Valued<T>> & SweetCell<T>
const systemMeta: Record<string, Cell<string>> = {
    'type': cells.last('core/table'),
    'category': cells.last('table'),
    'description': cells.last('The root table of my playground! This is basically the entry point for the entire system.'),
    'author': cells.last('@goose :)'),
    'views/inspector/type': cells.last('table'),
};

const groupsMeta: Record<string, Cell<string>> = {
    'type': cells.last('core/table'),
    'category': cells.last('table'),
    'description': cells.last('The groups table for the system'),
    'author': cells.last('@goose :)'),
    'views/inspector/type': cells.last('table'),
};

const packagesMeta: Record<string, Cell<string>> = {
    'type': cells.last('core/table'),
    'category': cells.last('table'),
    'description': cells.last('The packages table for the system'),
    'author': cells.last('@goose :)'),
    'views/inspector/type': cells.last('table'),
};

const groups = table.first({
    'default': table.first({}),
});

const packages = table.first({
    'cells': table.first({
        'max': () => cells.max(0),
        'min': () => cells.min(100),
        'last': () => cells.last('Bassline!'),
        'union': () => cells.union([]),
        'intersection': () => cells.intersection([]),
        'ordinal': () => cells.ordinal(0),
        'inspector': () => cells.inspector({ target: null }),
    }),
    'tables': table.first({
        'first': () => table.first({}),
        'last': () => table.last({}),
    }),
    'functions': table.first({
        'map': () => fn.map((x: number) => x + 1),
        'partial': () => fn.partial((x, y) => x + y, ['x']),
    }),
});

export const systemTable = withMetadata(table.first({
    'groups': withMetadata(groups, groupsMeta as Record<string, Cell<unknown>>),
    'packages': withMetadata(packages, packagesMeta as Record<string, Cell<unknown>>),
}), systemMeta as Record<string, Cell<unknown>>);

window.systemTable = systemTable;
window.lodash = _;

// Add this to your app initialization
window.devtoolsFormatters = window.devtoolsFormatters || [];
window.devtoolsFormatters.push({
    // Detect if this is a gadget
    header(obj) {
        // Check if it looks like a gadget
        if (!obj || typeof obj !== 'object') return null;
        if (!obj.receive || !obj.current || !obj.tap) return null;

        // Get gadget info
        const state = obj.current();
        const type = obj.metadata?.get?.('ui/type')?.current?.() ||
            obj.metadata?.get?.('meta/type')?.current?.() ||
            'gadget';
        const icon = obj.metadata?.get?.('ui/icon')?.current?.() || '◆';

        // Format the current value (truncate if long)
        let valueStr = '';
        try {
            if (state instanceof Set) {
                valueStr = `Set(${state.size})`;
            } else if (Array.isArray(state)) {
                valueStr = `[${state.length} items]`;
            } else if (typeof state === 'object' && state !== null) {
                valueStr = `{${Object.keys(state).length} keys}`;
            } else {
                valueStr = String(state);
            }
            if (valueStr.length > 30) {
                valueStr = valueStr.slice(0, 30) + '…';
            }
        } catch (e) {
            valueStr = '?';
        }

        // Return JSONML format
        return [
            'div',
            { style: 'display: flex; align-items: center; gap: 6px;' },
            ['span', { style: 'font-size: 14px;' }, icon],
            ['span', { style: 'color: #881391; font-weight: bold;' }, type],
            ['span', { style: 'color: #444;' }, '→'],
            ['span', { style: 'color: #1a1aa6; font-family: monospace;' }, valueStr]
        ];
    },

    // Can we expand it?
    hasBody(obj) {
        return !!(obj?.receive && obj?.current);
    },

    // Expanded view
    body(obj) {
        const state = obj.current();
        const metadata = obj.metadata?.query?.().table || {};

        const sections = ['div', { style: 'padding-left: 16px;' }];

        // Current state section
        sections.push(
            ['div', { style: 'margin: 4px 0;' },
                ['span', { style: 'color: #666; font-weight: bold;' }, 'State: '],
                ['object', { object: state }]  // Let DevTools format the value
            ]
        );

        // Metadata section (if exists)
        if (Object.keys(metadata).length > 0) {
            sections.push(
                ['div', { style: 'color: #666; font-weight: bold; margin-top: 8px;' },
                    `Metadata (${Object.keys(metadata).length}):`
                ]
            );

            for (const [key, cell] of Object.entries(metadata).slice(0, 10)) {
                const value = cell.current?.();
                sections.push(
                    ['div',
                        { style: 'margin-left: 12px; margin: 2px 0; display: flex; gap: 8px;' },
                        ['span', { style: 'color: #0d7da5; font-family: monospace; min-width: 200px;' }, key + ':'],
                        ['object', { object: value }]
                    ]
                );
            }
        }

        // Actions you can take (clickable!)
        sections.push(
            ['div', { style: 'margin-top: 8px; padding-top: 8px; border-top: 1px solid #ccc;' },
                ['span', { style: 'color: #666; font-size: 11px;' },
                    'Tip: Store as global with right-click → "Store as global variable"'
                ]
            ]
        );

        return sections;
    }
});


export function CellTableEntry({ gadget, field }: { gadget: Implements<Valued<Record<string, Cell<any>>>>, field: string }) {
    const [state] = useGadget(gadget);
    return (
        <TableRow>
            <TableCell className="font-mono font-bold text-slate-600">{field}</TableCell>
            <TableCell className="font-mono">{JSON.stringify(state)}</TableCell>
        </TableRow >
    )
}

function NamespaceInspector({ name, g }: { name: string, g: Implements<Valued<Record<string, Cell<unknown>>>> }) {
    const [state] = useGadget(g);
    return (
        <div className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-900">Namespace: {name}</h2>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="font-semibold">Key</TableHead>
                        <TableHead className="font-semibold">Value</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {Object.entries(state).map(([key, gadget]) => (
                        <CellTableEntry key={key} gadget={gadget} field={key} />
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}

export default function Playground() {
    const [system] = useGadget(systemTable);
    return (
        <div>
            {
                Object.entries(system).map(([key, gadget]) => (
                    <NamespaceInspector key={key} name={key} g={gadget} />
                ))
            }
        </div>
    )
}