import { bl } from "../../index.js";
const { gadgetProto } = bl();

export const refProto = Object.create(gadgetProto);
Object.assign(refProto, {
    step(state, input) {
        if (this.shouldResolve(input)) {
            this.resolve(input);
        }
    },
    error(error, input) {
        console.error("Error in ref", error, input);
        this.emit({ error: { input, error } });
    },
    toSpec() {
        return {
            pkg: this.pkg,
            name: this.name,
            state: this.minState(),
        };
    },
});
