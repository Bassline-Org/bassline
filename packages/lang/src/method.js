/**
 * Creates a method object that can be used to define methods for a given type.
 * The first function is used to define the method for a given type.
 * The second function is used to dispatch the method for a given type.
 * @returns [Function, Function]
 * @example
 * const [defMethod, callMethod] = method();
 * defMethod(types.context, (context, word) => {
 *     return context.get(word);
 * });
 * callMethod(types.context, "foo");
 */
export const method = () => {
    const cases = {};
    return [
        (type, impl) => {
            cases[type] = impl;
        },
        (first, ...rest) => {
            const { type } = first;
            const impl = cases[type];
            if (impl) {
                return impl(first, ...rest);
            }
            throw new Error(
                `No implementation found for type: ${JSON.stringify(first)}`,
            );
        },
    ];
};
