import * as p from "@bassline/lang/prelude";

function StringDisplay({ value }: { value: p.Str }) {
    return <span className="text-blue-500">{value.value}</span>;
}

function NumberDisplay({ value }: { value: p.Num }) {
    return <span className="text-green-500">{value.value}</span>;
}

function BooleanDisplay({ value }: { value: p.Bool }) {
    return (
        <span className="text-purple-500">
            {value.value}
        </span>
    );
}

function BlockDisplay({ value }: { value: p.Block }) {
    return (
        <ul>
            {value.items.map((item) => (
                <li key={item.value}>
                    <ValueDisplay value={item} />
                </li>
            ))}
        </ul>
    );
}

function UnsetDisplay({ value }: { value: p.Unset }) {
    return <span className="text-gray-500">unset</span>;
}

export function ValueDisplay({ value }: { value: any }) {
    if (value.is(p.Str)) {
        return <StringDisplay value={value} />;
    }
    if (value.is(p.Num)) {
        return <NumberDisplay value={value} />;
    }
    if (value.is(p.Bool)) {
        return <BooleanDisplay value={value} />;
    }
    if (value.is(p.Unset)) {
        return <UnsetDisplay value={value} />;
    }
    if (value.is(p.Block)) {
        return <BlockDisplay value={value} />;
    }
    console.log("Unknown value", value);
    return <span className="text-red-500">Unknown value</span>;
}
