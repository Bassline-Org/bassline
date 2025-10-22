import { normalize } from "@bassline/lang/utils";
import * as p from "@bassline/lang/prelude";
import { useRuntime } from "./RuntimeProvider";
import { Button as ShadButton } from "~/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import React from "react";

export function Header({ rest }: { rest: [p.Num, p.Value] }) {
    const [level, content] = rest;
    const headingLevel = Math.min(6, Math.max(1, level?.value || 1));

    const headingClasses = {
        1: "text-3xl font-bold mb-4",
        2: "text-2xl font-semibold mb-3",
        3: "text-xl font-semibold mb-2",
        4: "text-lg font-medium mb-2",
        5: "text-base font-medium mb-1",
        6: "text-sm font-medium mb-1"
    }[headingLevel];

    return React.createElement(
        `h${headingLevel}`,
        { className: headingClasses },
        React.createElement(DisplayValue, { value: content })
    );
}

export function List({ rest }: { rest: [p.Block] }) {
    const [items] = rest;
    return (
        <ul className="space-y-2 pl-4">
            {items.items.map((item: p.Value, index: number) => (
                <li key={index} className="list-disc">
                    <DisplayValue value={item} />
                </li>
            ))}
        </ul>
    );
}

export function Group({ rest }: { rest: [p.Str, p.Block] }) {
    const [title, content] = rest;
    return (
        <Card className="mb-4">
            <CardHeader>
                <CardTitle>{title.value}</CardTitle>
            </CardHeader>
            <CardContent>
                <DisplayValue value={content} />
            </CardContent>
        </Card>
    );
}

export function Button({ rest }: { rest: [p.Str, p.Block] }) {
    const [label, action] = rest;
    const runtime = useRuntime();
    return (
        <ShadButton onClick={() => runtime.evaluate(action)}>
            {label.value}
        </ShadButton>
    );
}

export function DisplayValue({ value }: { value: p.Value }) {
    if (value && value.is && value.is(p.Block)) {
        const block = value as p.Block;
        const [first, ...rest] = block.items;
        if (first && first.is && first.is(p.WordLike)) {
            const Component = displayComponents[first.spelling];
            if (Component) {
                return <Component rest={rest as any} />;
            }
            return <span className="text-muted-foreground">{first.spelling}</span>;
        }
        return (
            <div className="space-y-2">
                {block.items.map((item: p.Value, index: number) => (
                    <DisplayValue key={index} value={item} />
                ))}
            </div>
        );
    }
    return <span>{value?.form ? value.form().value : String(value)}</span>;
}

export const displayComponents = {
    [normalize("header")]: Header,
    [normalize("list")]: List,
    [normalize("group")]: Group,
    [normalize("button")]: Button,
};

export default displayComponents;
