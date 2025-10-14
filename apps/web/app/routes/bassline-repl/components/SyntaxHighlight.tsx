interface SyntaxHighlightProps {
    code: string;
}

interface Token {
    type: "comment" | "string" | "number" | "set-word" | "lit-word" | "word" | "bracket" | "whitespace";
    value: string;
}

function tokenize(code: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;

    while (i < code.length) {
        const char = code[i];

        // Comments
        if (char === ";") {
            let comment = ";";
            i++;
            while (i < code.length && code[i] !== "\n") {
                comment += code[i];
                i++;
            }
            tokens.push({ type: "comment", value: comment });
            continue;
        }

        // Strings
        if (char === '"') {
            let str = '"';
            i++;
            while (i < code.length) {
                if (code[i] === "\\") {
                    str += code[i] + (code[i + 1] || "");
                    i += 2;
                } else if (code[i] === '"') {
                    str += '"';
                    i++;
                    break;
                } else {
                    str += code[i];
                    i++;
                }
            }
            tokens.push({ type: "string", value: str });
            continue;
        }

        // Whitespace
        if (/\s/.test(char)) {
            let ws = "";
            while (i < code.length && /\s/.test(code[i])) {
                ws += code[i];
                i++;
            }
            tokens.push({ type: "whitespace", value: ws });
            continue;
        }

        // Brackets and parens
        if (char === "[" || char === "]" || char === "(" || char === ")") {
            tokens.push({ type: "bracket", value: char });
            i++;
            continue;
        }

        // Numbers
        if (/[0-9]/.test(char) || (char === "-" && i + 1 < code.length && /[0-9]/.test(code[i + 1]))) {
            let num = "";
            if (char === "-") {
                num += char;
                i++;
            }
            while (i < code.length && /[0-9.]/.test(code[i])) {
                num += code[i];
                i++;
            }
            tokens.push({ type: "number", value: num });
            continue;
        }

        // Literal words ('word)
        if (char === "'") {
            let word = "'";
            i++;
            while (i < code.length && /[^\s\[\]()]/.test(code[i])) {
                word += code[i];
                i++;
            }
            tokens.push({ type: "lit-word", value: word });
            continue;
        }

        // Words (including set-words)
        if (/[^\s\[\]()]/.test(char)) {
            let word = "";
            while (i < code.length && /[^\s\[\]()]/.test(code[i])) {
                word += code[i];
                i++;
            }
            // Check if it's a set-word (ends with :)
            if (word.endsWith(":")) {
                tokens.push({ type: "set-word", value: word });
            } else {
                tokens.push({ type: "word", value: word });
            }
            continue;
        }

        // Fallback - just add the character
        tokens.push({ type: "word", value: char });
        i++;
    }

    return tokens;
}

export function SyntaxHighlight({ code }: SyntaxHighlightProps) {
    const tokens = tokenize(code);

    return (
        <span>
            {tokens.map((token, i) => {
                switch (token.type) {
                    case "comment":
                        return (
                            <span key={i} className="text-slate-400 italic">
                                {token.value}
                            </span>
                        );
                    case "string":
                        return (
                            <span key={i} className="text-green-600">
                                {token.value}
                            </span>
                        );
                    case "number":
                        return (
                            <span key={i} className="text-blue-600">
                                {token.value}
                            </span>
                        );
                    case "set-word":
                        return (
                            <span key={i} className="text-purple-600 font-semibold">
                                {token.value}
                            </span>
                        );
                    case "lit-word":
                        return (
                            <span key={i} className="text-orange-600">
                                {token.value}
                            </span>
                        );
                    case "bracket":
                        return (
                            <span key={i} className="text-slate-500 font-bold">
                                {token.value}
                            </span>
                        );
                    case "word":
                        return (
                            <span key={i} className="text-violet-700">
                                {token.value}
                            </span>
                        );
                    case "whitespace":
                        return <span key={i}>{token.value}</span>;
                    default:
                        return <span key={i}>{token.value}</span>;
                }
            })}
        </span>
    );
}
