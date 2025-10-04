import { useGadget } from "@bassline/react";
import { useParams, useSearchParams } from "react-router";
import { systemTable } from "./playground";
import { useEffect, useState } from "react";
import type { Implements, SweetTable, Table } from "@bassline/core";
import { resolvePath } from "./canvas";

export default function Inspect() {
    const [params] = useSearchParams();
    const id = params.get("id");

    const [tableState] = useGadget(resolvePath(id!))
    const [metadata] = useGadget(tableState?.metadata ?? null);
    if (!tableState) {
        return <div>Table not found</div>
    }

    return (
        <div className="w-screen h-screen">

        </div>
    )
}