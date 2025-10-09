import { createRefType } from "./refs.js";

/**
 * Web Ref - Resolves DOM elements from web pages via Chrome extension
 *
 * Requires the Bassline Chrome extension to be installed.
 * The extension acts as a resolver service that can access any webpage.
 *
 * Usage:
 *   const priceRef = webRef.spawn({
 *     url: "https://example.com/product",
 *     selector: ".price"
 *   });
 *
 * State accumulates:
 *   - url: Target webpage URL
 *   - selector: CSS selector for element
 *   - extract: What to extract (default: "textContent")
 *
 * Once both url and selector are present, the extension is called
 * to resolve the element and extract its value.
 */

// Global extension ID (set by connectExtension)
let extensionId = null;

/**
 * Set the extension ID for communication
 */
export function setExtensionId(id) {
    extensionId = id;
}

/**
 * Resolver function that talks to Chrome extension
 */
async function resolveWebElement(state) {
    if (!extensionId) {
        throw new Error(
            "Bassline Chrome extension not connected. Call connectExtension() first.",
        );
    }

    const { url, selector, extract = "textContent" } = state;

    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
            extensionId,
            {
                type: "RESOLVE_WEB_REF",
                payload: { url, selector, extract },
            },
            (response) => {
                if (chrome.runtime.lastError) {
                    reject(
                        new Error(
                            `Extension error: ${chrome.runtime.lastError.message}`,
                        ),
                    );
                    return;
                }

                if (!response.success) {
                    reject(new Error(response.error));
                    return;
                }

                resolve(response.data);
            },
        );
    });
}

/**
 * Web ref type
 */
export const webRef = createRefType({
    name: "webRef",
    pkg: "@bassline/refs/web",
    keyFields: ["url", "selector"],
    resolver: resolveWebElement,
});

/**
 * Web list ref - for multiple elements
 */
export const webListRef = createRefType({
    name: "webListRef",
    pkg: "@bassline/refs/web",
    keyFields: ["url", "selector"],
    resolver: async (state) => {
        if (!extensionId) {
            throw new Error(
                "Bassline Chrome extension not connected. Call connectExtension() first.",
            );
        }

        const { url, selector, extract = "textContent", limit = null } = state;

        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(
                extensionId,
                {
                    type: "RESOLVE_WEB_REF",
                    payload: { url, selector, extract, multiple: true, limit },
                },
                (response) => {
                    if (chrome.runtime.lastError) {
                        reject(
                            new Error(
                                `Extension error: ${chrome.runtime.lastError.message}`,
                            ),
                        );
                        return;
                    }

                    if (!response.success) {
                        reject(new Error(response.error));
                        return;
                    }

                    resolve(response.data);
                },
            );
        });
    },
});

export default {
    gadgets: {
        webRef,
        webListRef,
    },
};
