import { normalize } from "@bassline/lang/utils";
import * as p from "@bassline/lang/prelude";
import { useRuntime } from "./RuntimeProvider";

export function Header({ rest }: { rest: [p.Num, p.Value] }) {
    const [level, content] = rest;
    return (
        <div>
            <h1>Header {level.value}</h1>
            <DisplayValue value={content} />
        </div>
    );
}

export function List({ rest }: { rest: [p.Block] }) {
    const [items] = rest;
    return (
        <div>
            <h1>List</h1>
            <ul>
                {items.items.map((item: p.Value, index: number) => (
                    <li key={index}>
                        <DisplayValue value={item} />
                    </li>
                ))}
            </ul>
        </div>
    );
}

export function Group({ rest }: { rest: [p.Str, p.Block] }) {
    const [title, content] = rest;
    return (
        <div>
            <h1>Group: {title.value}</h1>
            <DisplayValue value={content} />
        </div>
    );
}

export function Button({ rest }: { rest: [p.Str, p.Block] }) {
    const [label, action] = rest;
    const runtime = useRuntime();
    return (
        <div>
            <h1>Button: {label.value}</h1>
            <button onClick={() => runtime.evaluate(action)}>
                {label.value}
            </button>
        </div>
    );
}

export function DisplayValue({ value }: { value: p.Block }) {
    if (value.is(p.Block)) {
        const [first, ...rest] = value.items;
        if (first.is(p.WordLike)) {
            const Component = displayComponents[first.spelling];
            if (Component) {
                return <Component rest={rest as any} />;
            } else {
                return <div>{first.spelling}</div>;
            }
        } else {
            return value.items.map((item: p.Value, index: number) => (
                <DisplayValue key={index} value={item} />
            ));
        }
    }
    return <div>{value.form().value}</div>;
}

export const displayComponents = {
    [normalize("header")]: Header,
    [normalize("list")]: List,
    [normalize("group")]: Group,
    [normalize("button")]: Button,
};

export default displayComponents;
