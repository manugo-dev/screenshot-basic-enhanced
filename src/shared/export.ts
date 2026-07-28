/**
 * `exports(name, fn)` is sugar over an event: the export system triggers
 * `__cfx_export_<resource>_<name>` with a setter, and whatever the handler passes
 * to that setter becomes the exported function. The client JS runtime on FiveM
 * Enhanced no longer provides the `exports` global, so register that event
 * directly — this is the same thing the runtime would have done for us.
 */
export function registerExport(name: string, fn: (...args: any[]) => void) {
    const cfxExports = globalThis.exports;
    cfxExports(name, fn);

    for (const resource of exportNames()) {
        on(`__cfx_export_${resource}_${name}`, (setCB: (value: typeof fn) => void) => {
            setCB(fn);
        });
    }
}

/**
 * Names this resource can be addressed by: its own, plus anything it `provide`s,
 * so both `exports['screenshot-basic-enhanced']` and `exports['screenshot-basic']`
 * resolve.
 */
function exportNames() {
    const self = GetCurrentResourceName();
    const names = [self];

    const provided = GetNumResourceMetadata(self, 'provide');

    for (let i = 0; i < provided; i++) {
        const name = GetResourceMetadata(self, 'provide', i);

        if (name && !names.includes(name)) {
            names.push(name);
        }
    }

    return names;
}
