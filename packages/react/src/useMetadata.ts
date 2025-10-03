import { Implements, Valued } from "@bassline/core";
import { useGadget } from "./useGadget";


export function useMetadata<T>(gadget: Implements<Valued<T>>): null | any {
    if (!gadget.metadata) {
        return null;
    }

    const [meta] = useGadget(gadget.metadata);
    return meta;
}