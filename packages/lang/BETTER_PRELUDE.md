# What

We should improve the prelude.

I'll suggest some improvements.

## 1. Creation of contexts

We should create a basic `context` function, which should just return a new
context object.

We can then have some functions that will allow us to operate on that.

### Functions to define:

#### `in <context> <block>`

Evaluates the block (using ex), inside of the context. Can be used to set values
inside of blocks

#### `get <context> [<word>]`

Gets the value at the word, in the context

## 2. Better block manipulation functions

Some of the most powerful parts of rebol, are it's ability to do some serious
metaprogramming. This revolves around rich interactions with blocks as data.

### Functions to implement

#### 1. `reduce <block>`

Simply evaluates EACH entry of the block. Useful for building up blocks
programmatically.

#### 2. `compose <block>`

Evaluates a block of expressions, only evaluating parens, and returns a block.
