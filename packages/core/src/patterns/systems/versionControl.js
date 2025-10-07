import { bl } from "../../index.js";
bl();

import { FirstWithCells } from "../cells/tables.js";
import { Ordinal } from "../cells/versioned.js";
import { Max } from "../cells/numeric.js";
import { Last } from "../cells/unsafe.js";
import { Partial } from "../functions/index.js";

import { installRelations } from "../relations/index.js";
installRelations();

export function VersionControl(initial) {
    // Define a master version cell (monotonically increasing)
    const version = new Max(1);
    // Define a latest cell to store working values
    const latest = new Last(initial);
    // Define a function to combine version and latest into an output
    const fn = new Partial({
        fn: ({ version, latest }) => [version, latest],
        requiredKeys: ["version", "latest"],
    });
    // Define an ordinal cell to store the output
    const output = new Ordinal(initial);

    // Store all of the cells in a table
    const table = new FirstWithCells({
        version,
        latest,
        fn,
        output,
    });
    // Assemble the system
    // when version changes, pass { version: newVersion } to fn
    version.asArgument("version", fn);
    // when latest changes, pass { latest: newLatest } to fn
    latest.asArgument("latest", fn);
    // when fn computes, pass the result to output
    fn.fanOut([output]);
    // When output changes, update version and latest so it stays in sync
    output.tapOn("changed", ([height, value]) => {
        version.receive(height);
        latest.receive(value);
    });
    // Initialize the function with the current version and latest values
    fn.receive({ version: version.current(), latest: latest.current() });
    return table;
}

function exampleUsage() {
    const test = VersionControl("hello");

    const { output, version, latest } = test.current();

    latest.receive("world");

    version.receive(1);
    // [1, "world"]

    latest.receive("world2");
    // output [1, "world"]
    latest.receive("world3");
    // output [1, "world"]

    version.receive(2);
    // output [2, "world3"]

    output.receive([3, "world4"]);

    console.log("should be world4: ", latest.current());
    console.log("should be 3: ", version.current());
}
