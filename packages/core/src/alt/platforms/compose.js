export function compose(base, ...extensions) {
    return extensions.reduce((acc, curr) => curr(acc), base)
}