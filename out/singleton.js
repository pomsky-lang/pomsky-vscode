"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.singleton = void 0;
/**
 * Create a singleton that is initialized on first use; after that, the previous,
 * cached instance is returned.
 */
function singleton(init) {
    let cached;
    return {
        getOrInit(...context) {
            if (!cached) {
                cached = init(...context);
            }
            return cached;
        },
        dispose() {
            cached = undefined;
        },
    };
}
exports.singleton = singleton;
//# sourceMappingURL=singleton.js.map