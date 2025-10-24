import { createRuntime } from "@bassline/lang/runtime";
import * as prelude from "@bassline/lang/prelude";
import { parse } from "@bassline/lang";
import { createContext, useCallback, useContext, useRef } from "react";
const { nativeFn } = prelude;

export const rc = `
use: make pure-fn! [module] [ copy module parent ]

import: make pure-fn! [module words] [ copy (project module words) parent ]
context: make pure-fn! [block] [
    ctx: make context-chain! self
    (in ctx block)
    ctx
]

functions: context [
    doc self "A module that adds some sugar over the creation of functions, and using functional patterns"
    fn: make pure-fn! [args body] [ make pure-fn! args body ]
    |>: :fn
    head: fn [series] [pick series 0]
    tail: fn [series] [slice series 1 length series]
    does: fn [block] [ fn [] block ]
    times: fn [n f] [
        map (iota n) :f
    ]
    thread: fn [arg fns] [
        f: fn [a :func] [ func a ]
        fold reduce fns :f arg
    ]
    map: fn [series f] [
        fold
            tail series
            (fn [acc curr] [ append acc (f curr) ])
            append [] (f head series)
    ]
    filter: fn [series f] [
        fold
            tail series
            (fn [acc curr] [
                if (f curr)
                    [ append acc curr ]
                    [ acc ]
             ])
             append [] head series
    ]
    not: |> [x] [ eq? x false ]
    even?: fn [x] [
        eq? (// x 2) 0
    ]
    odd?: fn [x] [
        eq? (even? x) false
    ]
    foreach: fn [series block] [
        map series (fn [it] block)
    ]
]

sockets: context [
   use functions [ 'fn ]
   send: (fn [context data] [
    in context (compose [ send (data) ])
   ])
   open: (fn [context] [
    in context [ open ]
   ])
   close: (fn [context] [
    in context [ close ]
   ])
]
`;

export const views = `
use functions
views: context [

view-context: context [
    header: (fn [level content] [
        context compose [
            type: 'header
            level: (level)
            content: (content)
        ]
    ])

    list: (fn [items] [
        context compose [
            type: 'list
            items: (items)
        ]
    ])

    item: (fn [content] [
        context compose [
            type: 'item
            content: (content)
        ]
    ])

    table: (fn [columns rows] [
        context compose [
            type: 'table
            columns: (columns)
            rows: (rows)
        ]
    ])

    group: (fn [title content] [
        context compose [
            type: 'group
            title: (title)
            content: (compose content)
        ]
    ])

    button: (fn [label action] [
        context compose [
            type: 'button
            label: (label)
            action: does (action)
        ]
    ])

    input: (fn [value action] [
        context compose [
            type: 'input
            value: (value)
            on-change: does (action)
        ]
    ])

    inspector: (fn [target] [
        context compose [
            type: 'inspector
            target: (target)
        ]
    ])
]

view: fn [block] [
    use view-context
    context compose [
        type: 'view
        children: (compose block)
    ]
]
]

use views

; Sample data
users: [
    "John Doe"
    "Jane Doe"
    "John Smith"
    "Jane Smith"
]

posts: [
    "Post 1"
    "Post 2"
    "Post 3"
]

; State for the input demo
user-input: ""
saved-items: load-local "demo-items"

; Example view showcasing all features
example-view: view [
    (header 1 "Bassline View System Demo")

    (group "Interactive Input" [
        (header 3 "Type something and see it update:")
        (input user-input [
            in parent (compose [user-input: (value)])
            print (append "value: " value)
        ])
        (header 4 append "You typed: " user-input)
    ])

    ;(group "Local Storage Persistence" [
    ;    (header 3 "Items saved across sessions:")
    ;    (list foreach saved-items [ item it ])
    ;    (button "Add Current Input" [
    ;        if (gt? length user-input 0) [
    ;            append saved-items user-input
    ;            save-local "demo-items" saved-items
    ;            set 'user-input ""
    ;        ]
    ;    ])
    ;    (button "Clear All" [
    ;        set 'saved-items []
    ;        save-local "demo-items" []
    ;    ])
    ;])

    ;(group "Context Inspector" [
    ;    (header 3 "Explore the system context:")
    ;    (inspector system)
    ;])

    (group "Users & Posts" [
        (table ["Type" "Name"] [
            ["User" "John Doe"]
            ["User" "Jane Doe"]
            ["Post" "Post 1"]
            ["Post" "Post 2"]
        ])
    ])

    (group "Actions" [
        (button "Show Alert" [
            print "Button clicked! Check the console."
        ])
        ;(button "Load Last Input" [
        ;    set 'user-input (load-local "last-input" || "")
        ;])
    ])
]
`;

export const RuntimeContext = createContext<any>(null);

export const RuntimeProvider = (
    { children }: { children: React.ReactNode },
) => {
    const runtime = useRef(createRuntime());
    runtime.current.context.set("system", runtime.current.context);

    // Add localStorage persistence functions
    runtime.current.context.set(
        "save-local",
        new NativeFn(
            ["key", "value"],
            ([key, value], stream, context) => {
                if (typeof window !== "undefined" && window.localStorage) {
                    localStorage.setItem(key.value, value.mold().value);
                    return value;
                }
                return prelude.unset;
            },
        ),
    );

    runtime.current.context.set(
        "load-local",
        new NativeFn(
            ["key"],
            ([key], stream, context) => {
                if (typeof window !== "undefined" && window.localStorage) {
                    const data = localStorage.getItem(key.value);
                    if (data) {
                        return runtime.current.evaluate(parse(data));
                    }
                }
                return prelude.unset;
            },
        ),
    );

    runtime.current.context.set(
        "list-local",
        new NativeFn(
            [],
            () => {
                if (typeof window !== "undefined" && window.localStorage) {
                    const keys = [];
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (key) {
                            keys.push(new prelude.Str(key));
                        }
                    }
                    return new prelude.Block(keys);
                }
                return new prelude.Block([]);
            },
        ),
    );

    runtime.current.evaluate(parse(rc));
    runtime.current.evaluate(parse(views));
    return (
        <RuntimeContext.Provider value={runtime.current}>
            {children}
        </RuntimeContext.Provider>
    );
};

export const useRuntime = () => {
    return useContext(RuntimeContext);
};

export const useEvaluate = () => {
    const runtime = useRuntime();
    return useCallback((code: string) => {
        const parsed = parse(code);
        return runtime.evaluate(parsed);
    }, [runtime]);
};
