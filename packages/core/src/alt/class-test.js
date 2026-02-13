@isTestable(true)
export class MyClass {
    name = 'foo'

    @bound
    foo() {
        return this.name
    }

    unboundFoo() {
        return this?.name ?? "i'm not bound!"
    }
}

// class decorator
function isTestable(value) {
    return function decorator(target) {
        target.isTestable = value;
    };
}

// method decorator
function bound(value, { name, addInitializer }) {
    addInitializer(function () {
        this[name] = this[name].bind(this);
    });
}