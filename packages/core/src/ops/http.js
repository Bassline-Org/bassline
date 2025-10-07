import { ops } from "../extensions/ops.js";

const { def } = ops();
const { unary, named, varargs } = def;

export function installHttpOps() {
    unary({
        name: "httpGet",
        fn: (url) => fetch(url).then((res) => res.json()),
    });

    named({
        name: "httpPost",
        fn: ({ url, body }) =>
            fetch(url, { method: "POST", body: JSON.stringify(body) }).then(
                (res) => res.json(),
            ),
        requiredKeys: ["url", "body"],
    });

    named({
        name: "httpPut",
        fn: ({ url, body }) =>
            fetch(url, { method: "PUT", body: JSON.stringify(body) }).then(
                (res) => res.json(),
            ),
        requiredKeys: ["url", "body"],
    });

    named({
        name: "httpDelete",
        fn: ({ url }) =>
            fetch(url, { method: "DELETE" }).then((res) => res.json()),
        requiredKeys: ["url"],
    });
}

export default {
    async httpGet(url) {
        const res = await fetch(url);
        return await res.json();
    },
    async httpDelete(url) {
        const res = await fetch(url, { method: "DELETE" });
        return await res.json();
    },
    async httpPost({ url, body }) {
        const res = await fetch(url, {
            method: "POST",
            body: JSON.stringify(body),
        });
        return await res.json();
    },
    async httpPut({ url, body }) {
        const res = await fetch(url, {
            method: "PUT",
            body: JSON.stringify(body),
        });
        return await res.json();
    },
};
