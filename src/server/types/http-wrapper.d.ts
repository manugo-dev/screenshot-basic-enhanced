declare module '@citizenfx/http-wrapper' {
    import type { IncomingMessage, ServerResponse } from 'http';

    export function setHttpCallback(
        requestHandler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>,
    ): void;
}
