RegisterNuiCallbackType('screenshot_created');

type ResultCallback = (result: string) => void;

const results: { [id: string]: ResultCallback } = {};
let correlationId = 0;

function registerCorrelation(cb: ResultCallback) {
    const id = correlationId.toString();

    results[id] = cb;

    correlationId++;

    return id;
}

on('__cfx_nui:screenshot_created', (body: any, cb: (arg: any) => void) => {
    cb(true);

    if (body.id !== undefined && results[body.id]) {
        const resultCb = results[body.id];
        delete results[body.id];

        resultCb(body.data);
    }
});

// -------------------------------------------------------------------- exports

/**
 * `exports(name, fn)` is sugar over an event: the export system triggers
 * `__cfx_export_<resource>_<name>` with a setter, and whatever the handler passes
 * to that setter becomes the exported function. The client JS runtime on FiveM
 * Enhanced no longer provides the `exports` global, so register that event
 * directly — this is the same thing the runtime would have done for us.
 */
function registerExport(name: string, fn: (...args: any[]) => void) {
    const cfxExports = (globalThis as any).exports;
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

// ---------------------------------------------------------------- screenshots

/**
 * An options table coming from Lua may arrive as an array (an empty Lua table
 * serializes as one), so start from a fresh object.
 */
function toRequest(options: any) {
    const request: any = { ...(options ?? {}) };

    request.encoding = request.encoding || 'jpg';

    return request;
}

function sendRequest(request: any, cb: ResultCallback) {
    if (typeof cb !== 'function') {
        console.log(
            'screenshot-basic: request made without a callback, the result will be dropped',
        );
        cb = () => {};
    }

    request.correlation = registerCorrelation(cb);

    SendNuiMessage(
        JSON.stringify({
            request,
        }),
    );
}

/** Both entry points historically accepted the callback in place of `options`. */
function normalize(options: any, cb: ResultCallback): [any, ResultCallback] {
    if (cb === undefined && typeof options === 'function') {
        return [{}, options as ResultCallback];
    }

    return [options, cb];
}

function requestScreenshot(options: any, cb: ResultCallback) {
    const [realOptions, realCb] = normalize(options, cb);
    const request = toRequest(realOptions);

    request.resultURL = null;
    request.targetField = null;
    request.targetURL = `http://${GetCurrentResourceName()}/screenshot_created`;

    sendRequest(request, realCb);
}

function requestScreenshotUpload(url: string, field: string, options: any, cb: ResultCallback) {
    const [realOptions, realCb] = normalize(options, cb);
    const request = toRequest(realOptions);

    request.targetURL = url;
    request.targetField = field;
    request.resultURL = `http://${GetCurrentResourceName()}/screenshot_created`;

    sendRequest(request, realCb);
}

registerExport('requestScreenshot', requestScreenshot);
registerExport('requestScreenshotUpload', requestScreenshotUpload);

// --------------------------------------------------------------- event API
// A callback-free way in for other resources, in case exports are unavailable to
// them. `reply` is either a function or the name of an event to trigger with the
// result.

function toCallback(reply: any): ResultCallback {
    if (typeof reply === 'function') {
        return reply as ResultCallback;
    }

    if (typeof reply === 'string') {
        return (result: string) => {
            emit(reply, result);
        };
    }

    return () => {};
}

on('screenshot_basic:client:requestScreenshot', (options: any, reply: any) => {
    requestScreenshot(options, toCallback(reply));
});

on(
    'screenshot_basic:client:requestScreenshotUpload',
    (url: string, field: string, options: any, reply: any) => {
        requestScreenshotUpload(url, field, options, toCallback(reply));
    },
);

// ------------------------------------------------- server-initiated screenshot

onNet('screenshot_basic:requestScreenshot', (options: any, url: string) => {
    const request = toRequest(options);

    request.targetURL = `http://${GetCurrentServerEndpoint()}${url}`;
    request.targetField = 'file';
    request.resultURL = null;

    sendRequest(request, () => {});
});
