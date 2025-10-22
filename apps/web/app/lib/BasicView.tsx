import { normalize } from "@bassline/lang/utils";
import * as p from "@bassline/lang/prelude";
import { evaluate, parse } from "@bassline/lang";
import { useRuntime } from "./RuntimeProvider";
import { Button as ShadButton } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import React from "react";

export function Header({ context }: { context: p.ContextBase }) {
    const level = context.get("level");
    const content = context.get("content");
    const headingLevel = Math.min(6, Math.max(1, level?.value || 1));

    const headingClasses = {
        1: "text-3xl font-bold mb-4",
        2: "text-2xl font-semibold mb-3",
        3: "text-xl font-semibold mb-2",
        4: "text-lg font-medium mb-2",
        5: "text-base font-medium mb-1",
        6: "text-sm font-medium mb-1",
    }[headingLevel];

    return React.createElement(
        `h${headingLevel}`,
        { className: headingClasses },
        React.createElement(DisplayValue, { value: content }),
    );
}

export function List({ context }: { context: p.ContextBase }) {
    const items = context.get("items");
    return (
        <ul className="space-y-2 pl-4">
            {items?.items?.map((item: p.Value, index: number) => (
                <li key={index} className="list-disc">
                    <DisplayValue value={item} />
                </li>
            ))}
        </ul>
    );
}

export function Group({ context }: { context: p.ContextBase }) {
    const title = context.get("title");
    const content = context.get("content");
    return (
        <Card className="mb-4">
            <CardHeader>
                <CardTitle>
                    {title?.value || title?.form?.().value || ""}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <DisplayValue value={content} />
            </CardContent>
        </Card>
    );
}

export function Button({ context }: { context: p.ContextBase }) {
    const label = context.get("label");
    console.log("context", context);
    return (
        <ShadButton onClick={() => evaluate(parse("action"), context)}>
            <DisplayValue value={label} />
        </ShadButton>
    );
}

export function Item({ context }: { context: p.ContextBase }) {
    const content = context.get("content");
    return (
        <div className="px-2 py-1">
            <DisplayValue value={content} />
        </div>
    );
}

export function View({ context }: { context: p.ContextBase }) {
    // Get the children field which contains the composed block
    const children = context.get("children");

    if (children && children.is && children.is(p.Block)) {
        const block = children as p.Block;
        if (block.items && block.items.length > 0) {
            return (
                <div className="space-y-4">
                    {block.items.map((item: p.Value, index: number) => (
                        <DisplayValue key={index} value={item} />
                    ))}
                </div>
            );
        }
    }
    return <span className="text-muted-foreground">Empty view</span>;
}

export function Table({ context }: { context: p.ContextBase }) {
    const columns = context.get("columns");
    const rows = context.get("rows");

    return (
        <div className="overflow-auto">
            <table className="min-w-full divide-y divide-border">
                <thead>
                    <tr className="border-b">
                        {columns?.items?.map((col: p.Value, i: number) => (
                            <th
                                key={i}
                                className="px-4 py-2 text-left font-medium text-muted-foreground"
                            >
                                <DisplayValue value={col} />
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {rows?.items?.map((row: p.Block, i: number) => (
                        <tr
                            key={i}
                            className="border-b hover:bg-accent/50 transition-colors"
                        >
                            {row.items?.map((cell: p.Value, j: number) => (
                                <td key={j} className="px-4 py-2">
                                    <DisplayValue value={cell} />
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export function DisplayValue({ value }: { value: p.Value }) {
    // Check if value is a context with a 'type' binding
    if (value && value.is && value.is(p.ContextBase)) {
        const context = value as p.ContextBase;
        const type = context.get("type");

        if (type && type.is && type.is(p.WordLike)) {
            const Component = displayComponents[type.spelling];
            if (Component) {
                return <Component context={context} />;
            }
            return (
                <span className="text-muted-foreground">
                    Unknown component: {type.spelling}
                </span>
            );
        }
        // Fallback for contexts without type
        return (
            <span className="text-muted-foreground">
                {context.form().value}
            </span>
        );
    }

    // Handle blocks (for backward compatibility or lists of items)
    if (value && value.is && value.is(p.Block)) {
        const block = value as p.Block;
        return (
            <div className="space-y-2">
                {block.items.map((item: p.Value, index: number) => (
                    <DisplayValue key={index} value={item} />
                ))}
            </div>
        );
    }

    // Handle primitive values
    return <span>{value?.form ? value.form().value : String(value)}</span>;
}

export const displayComponents = {
    [normalize("view")]: View,
    [normalize("header")]: Header,
    [normalize("list")]: List,
    [normalize("group")]: Group,
    [normalize("button")]: Button,
    [normalize("item")]: Item,
    [normalize("table")]: Table,
};

export default displayComponents;
