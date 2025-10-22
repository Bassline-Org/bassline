import * as p from "@bassline/lang/prelude";
import { normalize } from "@bassline/lang/utils";
import { useEffect, useState } from "react";
import { Outlet } from "react-router";
import {
    RuntimeProvider,
    useEvaluate,
    useRuntime,
} from "~/lib/RuntimeProvider";

const displayComponents = {
    [normalize("header")]: Header,
    [normalize("list")]: List,
    [normalize("group")]: Group,
};

function Header({ rest }: { rest: p.Value[] }) {
    const [level, content] = rest;
    return (
        <div>
            <h1>Header {level.value}</h1>
            <DisplayValue value={content} />
        </div>
    );
}

function List({ rest }: { rest: p.Value[] }) {
    const [items] = rest;
    return (
        <div>
            <h1>List</h1>
            <ul>
                {items.items.map((item, index) => (
                    <li key={index}>
                        <DisplayValue value={item} />
                    </li>
                ))}
            </ul>
        </div>
    );
}

function Group({ rest }: { rest: p.Value[] }) {
    const [title, content] = rest;
    return (
        <div>
            <h1>Group: {title.value}</h1>
            <DisplayValue value={content} />
        </div>
    );
}

export function DisplayValue({ value }: { value: p.Value }) {
    console.log("DisplayValue", value);
    if (value.is(p.Block)) {
        const [first, ...rest] = value.items;
        if (first.is(p.WordLike)) {
            const Component = displayComponents[first.spelling];
            if (Component) {
                return <Component rest={rest} />;
            } else {
                return <div>{first.spelling}</div>;
            }
        } else {
            return value.items.map((item) => (
                <DisplayValue key={item.form().value} value={item} />
            ));
        }
    }
    return <div>{value.form().value}</div>;
}

function ReplInner() {
    const [code, setCode] = useState("example-view");
    const [results, setResults] = useState<any[]>([]);
    const evaluate = useEvaluate();

    return (
        <div>
            <h1>Repl</h1>
            <div>
                {results.map((result, index) => (
                    <DisplayValue key={index} value={result} />
                ))}
            </div>
            <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        const result = evaluate(code);
                        console.log("Result", result);
                        setResults([...results, result]);
                    }
                }}
            />
        </div>
    );
}

export default function ReplRoute() {
    return (
        <RuntimeProvider>
            <ReplInner />
        </RuntimeProvider>
    );
}
