import { numeric } from "@bassline/core/cells";

const max = new numeric.Max(0);
export default function SimpleTest() {
    const [count, update] = max.useState();
    const computed = max.useComputed((count) => count * 2);

    return (
        <div>
            <h1>Simple Test</h1>
            <p>Count: {count}</p>
            <button onClick={() => update(count + 1)}>Increment</button>
            <button onClick={() => update(count - 1)}>Decrement</button>
            <div> Computed: {computed} </div>
        </div>
    )
}