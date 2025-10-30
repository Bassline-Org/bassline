/**
 * Dialects define the semantic rules for evaluating the langage.
 *
 * Because of the extreme syntactic flexibility of the language, it is trivial
 * to define dialects that alter the semantic meaning of the language.
 *
 * The conceptual model is similar to how contexts work.
 * A context determines the meaning of words during evaluation,
 * And a dialect determines the meaning of datatypes and expressions. They are kinda like a meta-context
 *
 * In addition to changing the meaning of datatypes, dialects can also introduce new domain specific datatypes.
 * IE our data language doesn't have a datatype for functions, but the default dialect introduces the fn! datatype.
 */
