import { partial, transform } from "./functions.js";

const pkg = "@bassline/fn/http";

const httpGet = Object.create(transform);
Object.assign(httpGet, {
    pkg,
    name: "get",
    async fn({ url, headers }) {
        const res = await fetch(url, { headers });
        return await res.json();
    },
    inputs: "object",
    outputs: {
        computed: { type: "any", description: "Response JSON" }
    },
});

const httpPost = Object.create(partial);
Object.assign(httpPost, {
    pkg,
    name: "post",
    requiredKeys: ["url", "body"],
    async fn({ url, body, headers }) {
        const res = await fetch(url, {
            method: "POST",
            body: JSON.stringify(body),
            headers,
        });
        return await res.json();
    },
    inputs: {
        url: { type: "string", description: "URL to POST to" },
        body: { type: "any", description: "Request body" },
        headers: { type: "object", description: "Request headers (optional)" }
    },
    outputs: {
        computed: { type: "any", description: "Response JSON" }
    },
});

export default {
    gadgets: {
        httpGet,
        httpPost,
    },
};
