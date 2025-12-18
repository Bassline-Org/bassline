# Everything in Bassline is a resource.

A resource is an addressable thing that can support two kinds of interaction, `get` and `put`.

- `get` is for when a resource can provide us information to use.

- `put` is for when a resource can use information we provide it.

These are the axioms for Bassline. If you find yourself confused, consult the flowchart:

<img src="./images/is-resource.png" alt="drawing" width="400"/>

# Why resources?

The dictionary defines a resource as:

> a source of supply or support : an available means — usually used in plural

We chose this name for our core abstraction because it feels general purpose and yet is easily specialized based on usage.

This word doesn't imply a particular implementation or location, which was important to us, because our system is naturally distributed and we needed a term that supported this.


# Resource kinds

Resource is a general term, as such we can't really think in abstract resources.

Instead we describe things based on their properties and intended uses.

The goal of describing the broad kinds of resources, is to provide you, dear reader, with a way of thinking about your systems. We keep the descriptions broad as these kinds are just the tip of the iceberg.

There exists a whole world waiting to be discovered!

## Cell

A cell is a kind of resource used for storing information about a single thing, similar to a variable in traditional systems.

However unlike a variable, we never fully define what it "is". Instead a cell treats all information as partial, and merges this partial-information in to better understand what the single thing actually is. So a cell tells us the best guess at what something is, based on what it has seen. 

The merge function used by the cell is Associative, Commutative, and Idempotent (ACI):

*We will use the 🤝 to denote merge. So merge(a, b) is (a  🤝  b)*

- Associative

    Meaning that the grouping of `merge` doesn't change the result.
    
    `(a 🤝 b) 🤝 c = a 🤝 (b 🤝 c)`
    
- Commutative

    Meaning the order we apply `merge` in doesn't change the result.
    
    `a 🤝 b = b 🤝 a`
    
- Idempotent

    Meaning that merge can be applied redundantly, without changing the result.
    
    `a 🤝 a = a`
    
Similar to CRDTs, these properties mean we can avoid the normal issues that arise when doing distributed state. As an explicit sequence of operations isn't required, and writers don't need to coordinate when writing.

This is also useful for reactive programming, as we only need to run dependent computations whenever the cell learns something new, not just when we write to it. Since we don't need to recompute if the cell didn't learn something new. In short, cells give us a controlled way to ignore information!

Beyond distributed state
---

Cells are useful not just useful for distributed state, because another way to view a cell, is maintaining a constraint on the system. The merge function allows a cell to gradually learn and enforce constraints on the possible states it can exist in.

<details>
<summary>Note on "learning"</summary>
<br />
When I use the term learning, I simply am trying to highlight we don't hardcode the constraints when the cell is created, because all cells start off knowing nothing.

But as a cell merges information in and learns more about what it is, it can infer what it cannot be, as certain information excludes other information as being valid.
</details>

And when those constraints are not met, the cell is in a state of contradiction. Meaning that two sources of information, cannot coexist, which itself is more information than we started with, meaning that we can spread this information to other resources, to attempt to resolve the contradiction, using some hueristic.

This is extremely useful in a distributed adversarial environment. This feature allows us to maintain a consistent view of a network, because we can explicitly discover when a peer is providing us bad information. 
We could then share this contradiction with peers, as the two contradictory claims are all we need to describe the issue to another peer, without replaying all history or interactions.
Neat!

## Propagator

Propagates information to other things (generally used with cells) to model how information is related between "things" in the system.

All propagators have some activation condition, which allows them to gate when they active, giving them the ability to ignore information.

## Oracle

Answers questions

## Scout

Discovers information

## FAQ