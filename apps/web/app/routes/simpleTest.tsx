import { useLocalGadget } from "@bassline/react";
import { installDevtools } from "@bassline/core/devtools";
import { bl, installPackage } from "@bassline/core";
import cells from "@bassline/core/cells";

bl();

installPackage(cells);

installDevtools();

const max = cells.gadgets.max.spawn(0);
export default function SimpleTest() {
    const [count, update] = max.useState();
    const [local, localUpdate] = useLocalGadget(() => cells.gadgets.max.spawn(0));
    const computed = max.useComputed((count) => count * 2);
    //const metadata = max.useMetadata();
    max.useTap(() => {
        console.log("max tapped", max);
    });

    return (
        <div>
            <h1>Simple Test</h1>
            <p>Count: {count}</p>
            <p>Local Count: {local}</p>
            <button onClick={() => update(count + 1)}>Increment</button>
            <button onClick={() => update(count - 1)}>Decrement</button>
            <button onClick={() => localUpdate(local + 1)}>Increment Local</button>
            <button onClick={() => localUpdate(local - 1)}>Decrement Local</button>
            <div> Computed: {computed} </div>
            {/* <div> Metadata: {metadata} </div> */}
        </div>
    )
}