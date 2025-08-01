
# Table of Contents

1.  [What](#orga575239)
    1.  [What are propagation networks](#orge89df97)
    2.  [Why is this interesting](#orgbe10e2a)
2.  [Our flavor of propagators](#orgc82f25b)



<a id="orga575239"></a>

# What

This is a project to experiment with novel interfaces for propagation networks. The most recent work on this was done by Gerald Sussman and Alexey Radul, for Radul&rsquo;s 2009 PhD thesis, where he made the important contribution that cells refine partial information, rather than handle complete values.

Our implementation is a bit different than the paper describes, however the general ideas still stand.


<a id="orge89df97"></a>

## What are propagation networks

Propagation networks are a model of computation that have 2 conceptual parts.

1.  Cells

These are locations that accumulate information ABOUT a thing. Similar to variables in traditional languages. However the thing that makes them much different, is that cells conceptually operate on partial information, which is refined against the partial information it has accumulated thus far.
This merge function forms a semi-lattice structure, meaning that there are states that cannot be merged or reconsiled, which we call a contradiction. When we have two data values being merged into a single cell that are mutually exclusive, we simply &ldquo;chuckle&rdquo;, which is to express that we have a contradition.
When a cell merges in information, if it didn&rsquo;t learn anything new nothing happens. However when it merges in information that results in a &ldquo;higher state&rdquo; in the semi-lattice, it will notify it&rsquo;s connected propagators that it&rsquo;s contents have changed.

For example, if a cell holds the value 5, but it receives a interval (1 to: 10), it didn&rsquo;t gain any information, since the value 5 is more refined and non-contradictory for the cells incoming content.

1.  Propagators

Propagators are pure functions that run whenever their connected input cells gain new information. These functions can operate on partial information structures, and will output new partial information to other cells, based on the information they have received for their inputs.

Propagators can have something called an &ldquo;activation policy&rdquo;, which is some internal logic that determines whether or not the propagator should fire. The simple propagator will just fire any time it&rsquo;s inputs change, but you can imagine smarter activation policies.

Propagators are also allowed to execute in a (effectively) random order, because the rules for the cell merge ensures that all regions of the network will eventually quiesce, as no new information will propagate further, until some external data is injected into the network.


<a id="orgbe10e2a"></a>

## Why is this interesting

This approach to computation allows for some really unique properties, for example we can do bi-directional propagation, by composing simple propagators to create a compound propagator, that can deduce information, in more richer ways than traditional &ldquo;expression&rdquo; based languages allow. Think like how prolog is different than javascript. But we aren&rsquo;t only doing logic programming, it&rsquo;s just that we can do logic programming using propagation.

Additionally, the fact that all networks quiesce and naturally converge to a single state is useful for building correct distributed systems such as blockchains or databases, or even just interesting applications that talk with other machines.

And because all propagators and cells are conceptually isolated, it allows for insane amounts of parallelism, because each piece of the network is truly isolated from the rest, and order does not matter.


<a id="orgc82f25b"></a>

# Our flavor of propagators

So we took this work, and expanded upon it some, drawing inspiration from a number of sources.

The conceptual model that we have consists of three things.

1.  Contacts
    Which are connection points that hold values (think like cells).
    They come in two flavors, internal (which only allow connections from the same group), or boundary, which are basically the parameters of groups.
    Connections between contacts are valid so long as it&rsquo;s:
    internal->internal (valid if same group)
    internal->boundary (valid if the boundary contact is in the same group, or if the boundary contact is in a direct subgroup)
    boundary->boundary (valid if the boundary contact is in the same group, or if the boundary contact is in a direct subgroup)

2.  Groups (Gadgets)
    Which are collections of boundary contacts, internal contacts, wires, and other subgroups.
    
    These allow us to build reusable sub-networks, where the internal connection structure and composition of other groups inside defines the semantics of how it operates.
    
    All boundary contacts defined inside of a group are exposed to the parent group as connection points.
    
    Note: The &ldquo;primitive&rdquo; propagators in our system, such as basic arithmetic propagators are implemented as groups that cannot be opened. However all groups can be opened and modified internal, however doing so changes the identity of the group, and is therefore not the same as the other group.
    
    The reason for this is really just to have an extreme amount of regularity in how things are implemented in the system. Because conceptually we could build addition for integers out of groups of bitwise operations or whatever.

A lot of these metaphors are inspired by the interactions that dreams (the media molecule game) offers, because I think it&rsquo;s a good basis for what it means to interact with lively diagram systems.

So our system allows building compound data using &ldquo;splitter&rdquo; and &ldquo;joiner&rdquo; gadgets, where we can take multiple wires, connect as inputs, and output a single value, which wraps all of these together as one value in a &ldquo;fat wire&rdquo;. Then we can do the inverse to extract elements from a fat wire.

