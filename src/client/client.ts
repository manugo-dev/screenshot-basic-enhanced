import { registerExport } from '../shared/export';

RegisterNuiCallbackType('screenshot_created');
RegisterNuiCallbackType('screenshot_error');

type ResultCallback = (result: string) => void;

const results: { [id: string]: ResultCallback } = {};
let correlationId = 0;

function registerCorrelation(cb: ResultCallback) {
    const id = correlationId.toString();

    results[id] = cb;

    correlationId++;

    return id;
}

/**
 * A capture that failed inside the page.
 *
 * The pending callback is settled with an `error:` string rather than left hanging: a caller that
 * waits forever cannot tell a slow capture from a broken one, and every entry point then looks
 * equally dead regardless of which part actually failed.
 */
on('__cfx_nui:screenshot_error', (body: any, cb: (arg: any) => void) => {
    cb(true);

    console.log(
        `screenshot-basic: capture failed — ${body?.error ?? 'unknown error'} (target: ${body?.targetURL ?? 'n/a'})`,
    );

    if (body?.id !== undefined && results[body.id]) {
        const resultCb = results[body.id];
        delete results[body.id];

        resultCb(`error: ${body.error ?? 'capture failed'}`);
    }
});

on('__cfx_nui:screenshot_created', (body: any, cb: (arg: any) => void) => {
    cb(true);

    if (body.id !== undefined && results[body.id]) {
        const resultCb = results[body.id];
        delete results[body.id];

        resultCb(body.data);
    }
});

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

/**
 * The URL a NUI page uses to reach this resource's own client script.
 *
 * `https`, not `http`: the CEF page is served over https, so an http target is a mixed-content
 * request and the browser blocks it before it leaves the page. The screenshot is taken and then
 * posted into the void, which from the outside is indistinguishable from a capture that never
 * happened — every entry point simply never calls back.
 */
function nuiCallbackUrl(callbackName: string) {
    return `//${GetCurrentResourceName()}/${callbackName}`;
}

function requestScreenshot(options: any, cb: ResultCallback) {
    const [realOptions, realCb] = normalize(options, cb);
    const request = toRequest(realOptions);

    request.resultURL = null;
    request.targetField = null;
    request.targetURL = nuiCallbackUrl('screenshot_created');

    sendRequest(request, realCb);
}

function requestScreenshotUpload(url: string, field: string, options: any, cb: ResultCallback) {
    const [realOptions, realCb] = normalize(options, cb);
    const request = toRequest(realOptions);

    request.targetURL = url;
    request.targetField = field;
    request.resultURL = nuiCallbackUrl('screenshot_created');

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

    request.targetURL = `//${GetCurrentServerEndpoint()}${url}`;
    request.targetField = 'file';
    request.resultURL = null;

    sendRequest(request, () => {});
});
