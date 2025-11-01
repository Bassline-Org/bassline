/**
 * Bassline core data types
 *
 * These are the atomic data types that makeup the bassline language
 */
import { createHash, randomUUID } from "crypto";

export const TYPES = {
    number: "NUMBER!",
    string: "STRING!",
    word: "WORD!",
    getWord: "GET-WORD!",
    setWord: "SET-WORD!",
    litWord: "LIT-WORD!",
    block: "BLOCK!",
    paren: "PAREN!",
    uri: "URI!",
};

export const normalize = (name) => name.trim().toUpperCase();
export const hash = (value) =>
    `0x${createHash("sha256").update(value).digest("hex")}`;

/**
 * Create a number cell
 * @param {Number} value
 * @returns
 */
const number = (value) => ({
    type: TYPES.number,
    value: Number(value),
    insert: (tx) => {
        const id = value;
        tx.relate(id, "TYPE?", TYPES.number);
        return id;
    },
});

const string = (value) => ({
    type: TYPES.string,
    value: String(value),
    insert: (tx) => {
        const id = hash(value);
        tx.relate(id, "TYPE?", TYPES.string);
        return id;
    },
});

const word = (value) => ({
    type: TYPES.word,
    value: normalize(value),
    insert: (tx) => {
        const id = randomUUID();
        tx.relate(id, "SPELLING?", normalize(value));
        tx.relate(id, "TYPE?", TYPES.word);
        return id;
    },
});

const getWord = (value) => ({
    type: TYPES.getWord,
    value: normalize(value),
    insert: (tx) => {
        const id = randomUUID();
        tx.relate(id, "SPELLING?", normalize(value));
        tx.relate(id, "TYPE?", TYPES.getWord);
        return id;
    },
});

const setWord = (value) => ({
    type: TYPES.setWord,
    value: normalize(value),
    insert: (tx) => {
        const id = randomUUID();
        tx.relate(id, "SPELLING?", normalize(value));
        tx.relate(id, "TYPE?", TYPES.setWord);
        return id;
    },
});

const litWord = (value) => ({
    type: TYPES.litWord,
    value: normalize(value),
    insert: (tx) => {
        const id = randomUUID();
        tx.relate(id, "SPELLING?", normalize(value));
        tx.relate(id, "TYPE?", TYPES.litWord);
        return id;
    },
});

const block = (value) => ({
    type: TYPES.block,
    value: Array.from(value),
    insert: (tx) => {
        const id = randomUUID();
        value.forEach((item, index) => {
            const itemId = item.insert(tx);
            tx.relate(itemId, "PARENT?", id);
            tx.relate(itemId, "POSITION?", index);
            tx.relate(id, index, itemId);
        });
        tx.relate(id, "TYPE?", TYPES.block);
        return id;
    },
});
const paren = (value) => ({
    type: TYPES.paren,
    value: Array.from(value),
    insert: (tx) => {
        const id = randomUUID();
        value.forEach((item, index) => {
            const itemId = item.insert(tx);
            tx.relate(itemId, "PARENT?", id);
            tx.relate(itemId, "POSITION?", index);
            tx.relate(id, index, itemId);
        });
        tx.relate(id, "TYPE?", TYPES.paren);
        return id;
    },
});
const uri = (value) => ({
    type: TYPES.uri,
    value,
    insert: (tx) => {
        const id = randomUUID();
        Object.entries(value).forEach(([key, value]) => {
            if (value === null) {
                return;
            }
            const valueId = value.insert(tx);
            tx.relate(id, normalize(key), valueId);
            tx.relate(valueId, "PARENT?", id);
        });
        tx.relate(id, "TYPE?", TYPES.uri);
        return id;
    },
});

export const CELLS = {
    number,
    string,
    word,
    getWord,
    setWord,
    litWord,
    block,
    paren,
    uri,
};
