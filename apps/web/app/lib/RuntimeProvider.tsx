import { createRuntime } from "@bassline/lang/runtime";
import * as prelude from "@bassline/lang/prelude";
import { parse } from "@bassline/lang";
import { createContext, useCallback, useContext, useRef } from "react";
const { setMany, NativeMethod, NativeFn } = prelude;

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
        context [
            type: 'header
            level: (level)
            content: (content)
        ]
    ])

    list: (fn [items] [
        context [
            type: 'list
            items: (items)
        ]
    ])

    item: (fn [content] [
        context [
            type: 'item
            content: (content)
        ]
    ])

    table: (fn [columns rows] [
        context [
            type: 'table
            columns: (columns)
            rows: (rows)
        ]
    ])

    group: (fn [title content] [
        context [
            type: 'group
            title: (title)
            content: (content)
        ]
    ])

    button: (fn [label action] [
        context [
            type: 'button
            label: (label)
            action: (does (action))
        ]
    ])
]

view: fn [block] [
    use view-context
    context block
]
]

use views

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

example-view: view [
    users: group "Users" [
        list ( foreach users [ header 1 it ])
    ]

    posts: group "Posts" [
        list ( foreach posts [ header 1 it ])
    ]

    click-me: button "Click me" [
        print "Button clicked!"
    ]
]
`;

export const RuntimeContext = createContext<any>(null);

export const RuntimeProvider = (
    { children }: { children: React.ReactNode },
) => {
    const runtime = useRef(createRuntime());
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
