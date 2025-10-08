import { createRefType } from "./refs.js";
import fs from "fs/promises";

const pkg = "@bassline/refs";

export const file = createRefType({
    name: "file",
    pkg,
    keyFields: ["path"],
    resolver: async (path) => await fs.readFile(path, "utf-8"),
});
