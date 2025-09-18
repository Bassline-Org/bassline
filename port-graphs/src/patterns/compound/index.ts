import { Gadget } from "../../core";
import { createFn } from "../functions";

type PipelineArgs = {
    stages: Gadget[];
    incoming: any;
}
export const pipeline = createFn(({ stages, incoming }: PipelineArgs) => {
    return stages.reduce((acc, stage) => {
        return stage.receive(acc);
    }, incoming);
}, ['stages', 'incoming']);