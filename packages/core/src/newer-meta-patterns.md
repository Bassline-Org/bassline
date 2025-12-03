# Meta Patterns / Reified things?

Our system is built from individual quads.

A quad is of the form: `entity attribute value context`

It represents a edge in a logical subgraph (the context). Or another way of
thinking about it, is is an edge from the perspective of the context.

It's important to not think about these as isolated subgraphs. As they are not.
They are simply a way of representing the source of some information. Where the
context is just another node in the graph.

This enables us to not only perform pattern matching on subgraphs but how that
subgraph relates to other nodes in the larger graph.

For example, in our system, we reify rules as graphs containing the following
relations:

```
in some-context {
    meta {
        type rule!
        nac false
    }
    rule {
        where "?p age ?age ?c"
        produce "?p has-age true ?c"
    }
}
```

1. A `meta` entity with

   a. A `type` relation to `rule!`

   b. A `nac` relation to either `true` or `false`, denoting if the rule has a
   nac constraint

2. A `rule` entity with

   a. A `where` relation to a string representing the where clause.

   b. A `produce` relation to a string representing the production clause.

   c. A `not` relation, only if the `nac` relation of meta is `true`

And then once we match that, we setup the runtime objects to reflect that data
into the runtime, and install a secondary rule into the system where when a quad
is added of the form: `meta disable rule <theContext>`, we unregister the rule.

Meaning at a later point, we can dissolve the rule simply by inserting:

```
meta disable rule some-context
```

# Relation to lattices / orders

If we build these rules out carefully, they can build orders.

For example, if we wanted to have something like "modules" in our system, we
have 2 steps we have to do.

First, we must setup the relation between the contexts, to say:
`context A imports context B`

And then to prevent time from creeping in, we would also then just route any
entry in context B, to be replicated into context A.

We can represent this as such:

```
;; STEP ONE
;;===============
;; Sets up the relation between contexts
;; Fills enough information for step 2
;;===============
rule core.meta.uses
    where {
        meta uses ?source ?target
    }
    produce {
        ?source forward ?target system.routing
    }

;; STEP TWO
;;================
;; Takes routing information, and makes new quads in the appropriate context
;; ===============
rule core.routing.forward
    where {
        ?e ?a ?v ?source
        in system.routing {
            ?source forward ?target
        }
    }
    not {
        meta ?a ?v ?source
    }
    produce {
        ?e ?a ?v ?target
    }
```

# Representing Operations using Contexts

Operations install themselves by setting up listeners for contexts with:

- A meta entity with a type of `call!`

- A entity with the name of the operation, with edges for each argument

- An output entity, with information about where to store the results of the
  computation

```
in some-call {
    meta type call!
    add {
        x 123
        y 100
    }
    output {
        context some-result
        entity some-entity
        attribute some-label
    }
}
```
