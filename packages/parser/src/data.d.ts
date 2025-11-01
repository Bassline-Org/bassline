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

export type Number = {
    type: TYPES['number'],
    value: number;
}

export type String = {
    type: TYPES['string'];
    value: string;
}

export type Word = {
    type: TYPES['word'];
    value: string;
}

export type GetWord = {
    type: TYPES['getWord'];
    value: string;
}

export type SetWord = {
    type: TYPES['setWord'];
    value: string;
}

export type LitWord = {
    type: TYPES['litWord'];
    value: string;
}

export type Block = {
    type: TYPES['block'];
    value: Cell[];
}

export type Paren = {
    type: TYPES['paren'];
    value: Cell[]
}

export type Uri = {
    type: TYPES['uri'];
    value: {
        scheme: Word;
        userinfo: String | null;
        host: Word | null;
        port: Number | null;
        path: String | null;
        query: String | null;
        fragment: String | null;
    }
}

export type Cell = Number | String | Word | GetWord | SetWord | LitWord | Block | Paren | Uri;