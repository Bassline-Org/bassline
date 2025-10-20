# Bassline Language

A homoiconic language / data interchange format, inspired by rebol.

The language was designed for easy serialization & transport of running systems,
as well as being highly portable in the core implementation.

## Syntax

```
123 ; numbers
"hello" ; strings
self ; word
foo: 123 ; set-word
:print ; get-word
'print ; literal-word
aBlock: [ print foo ] ; Blocks
print (+ 1 2) ; parens
;; That's it!
```

## Showcase

```
;; Whitespace delimits words, other than [] () or :
;; Meaning these are all valid words
foo-bar: 123
foo->bar: 123

;; Words are not case sensitive
print eq? fOo FOO
print eq? FOO foo

;; Functions consume arguments from the token stream
;; And when referred to by their word, they are immediately invoked
;; In this case eq? evaluates the next 2 arguments
eq? (type? :print) "NATIVE-METHOD!"
;; Print evaluates one
print "Hello"

;; Contexts are first class in the language
;; The current context can be accessed with self
print self

;; To get all words in a context, use words
;; This returns a list of all words bound in the context
print words self

;; Contexts can be use to make other contexts
;; To make a context, with only some words bound from another, we can use project
fooContext: project self [ print + words ]

;; To evaluate a block in a context, we can use in
in fooContext [ print words self ]

;; We can use do to evaluate any block in the current context
do [ print "hello world!" ]
```
