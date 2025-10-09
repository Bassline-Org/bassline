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
});

const httpPost = Object.create(partial);
Object.assign(httpPost, {
    pkg,
    name: "post",
    async fn({ url, body, headers }) {
        const res = await fetch(url, {
            method: "POST",
            body: JSON.stringify(body),
            headers,
        });
        return await res.json();
    },
});

export default {
    gadgets: {
        httpGet,
        httpPost,
    },
};
