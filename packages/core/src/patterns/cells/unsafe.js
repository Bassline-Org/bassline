const { gadgetProto } = bl();

export const unsafeProto = Object.create(gadgetProto);

export function Last(initial) {
    this.step = function (current, input) {
        if (input === current) {
            return;
        }
        this.update(input);
    };
    this.update(initial);
}
Last.prototype = unsafeProto;
