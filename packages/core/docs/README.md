# What is Bassline? 🤨

## It's a protocol
When used standalone, Bassline refers to the protocol we are working on.

Example: *Have you seen Bassline? It&rsquo;s so sick!*


## It's an organization

Bassline is also the name of our organization that helps develop the Bassline Protocol.

Example: *&ldquo;I work for Bassline, the coolest company on the planet!&rdquo;*

## It's a resource

> **Reminder**: A resource is an addressable &ldquo;thing&rdquo;, it has two operations:
> - get (to ask a question)
> - put (to give some information).

When discussing **a Bassline**, we are referring to:

**A resource that describes the set of resources available**

It's a description of what we can do and how we can do it, kind of like a road map or atlas. 

---

### What does a Bassline look like?

A bassline is kind of like a directory or package.

When we `get` a bassline resource, we will receive information that describes what that bassline offers.


---

### Bassline of ?
A bassline can reference other basslines. Meaning in `bassline A`, we can refer to `bassline B`, since a bassline is a resource.

When we are referring to a &ldquo;nested&rdquo; Bassline, it&rsquo;s common to refer to it as a &ldquo;Bassline of xyz&rdquo;.

This helps convey that this is the *Bassline of some part of* a larger system.

For example, `Bassline A` might reference `Bassline of Friends`, which tells us that Friends is a bassline itself, that is used to define a part of `Bassline A`.

> Whenever we are interacting with other resources from our &ldquo;root&rdquo;, every `Bassline` is a `Bassline of xyz`. 
>
> Whether it&rsquo;s a local bassline or a remote bassline. They all make up the total Bassline of our system


## How do we build a Bassline?

A Bassline is a resource that describes other resource behaviors and tells us how we can use them.

If you can `get` from a resource, and it matches the [schema](./Bassline-Schema.md), it's a Bassline!

>A Bassline simply answers "what?" and "how?" for our system

## Learn more
Check out the [schema](./Bassline-Schema.md) document to read specifics and examples
