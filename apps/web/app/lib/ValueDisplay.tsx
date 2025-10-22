import * as p from "@bassline/lang/prelude";
import { normalizeString } from "@bassline/lang/utils";
import { evaluate } from "@bassline/lang";

export class DisplayContext extends p.ContextChain {
    static type = normalizeString("display-context!");
    constructor(parent: any) {
        super(parent);
        this.set(
            "group",
            new p.NativeFn(
                ["title", "content"],
                ([title, content], stream, context) => {
                    console.log("group", title, content);
                    return this.group(title, content);
                },
            ),
        );

        this.set(
            "list",
            new p.NativeFn(
                ["items"],
                ([items], s, c) => {
                    console.log("list", items);
                    return this.list(items);
                },
            ),
        );

        this.set(
            "header",
            new p.NativeFn(
                ["level", "content"],
                ([level, content], s, c) => {
                    console.log("header", level, content);
                    return this.header(level, content);
                },
            ),
        );
    }

    list(block: p.Block) {
        return (
            <ul>
                {block.items.map((item: any) => {
                    if (item instanceof p.Block) {
                        return <li>{evaluate(item, this)}</li>;
                    } else {
                        return <li>{item.form().value}</li>;
                    }
                })}
            </ul>
        );
    }

    header(level: p.Num, content: p.Value) {
        switch (level.value) {
            case 1:
                return <h1>{content.form().value}</h1>;
            case 2:
                return <h2>{content.form().value}</h2>;
            case 3:
                return <h3>{content.form().value}</h3>;
            case 4:
                return <h4>{content.form().value}</h4>;
            case 5:
                return <h5>{content.form().value}</h5>;
            case 6:
                return <h6>{content.form().value}</h6>;
            default:
                return <p>{content.form().value}</p>;
        }
    }

    group(title: p.Str, content: p.Block) {
        return (
            <div>
                <h2>{title.value}</h2>
                {evaluate(content, this)}
            </div>
        );
    }
}
