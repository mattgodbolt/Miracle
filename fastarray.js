// Workarounds for older browsers without faster arrays.
if (typeof(Uint32Array) === 'undefined') {
    function Uint32Array(size) {
        return [];
    }
    function Uint8Array(size) {
        return [];
    }
}
