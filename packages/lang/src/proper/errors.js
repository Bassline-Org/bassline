export class InvalidBind extends Error {
    constructor(cell) {
        super(
            `Invalid bind for cell: ${cell} with type: ${cell.type}! You can only bind word cells!`,
        );
    }
}
export class InvalidLookup extends Error {
    constructor(cell) {
        super(
            `Invalid lookup for cell: ${cell} with type: ${cell.type}! You can only lookup the binding for word cells!`,
        );
    }
}
