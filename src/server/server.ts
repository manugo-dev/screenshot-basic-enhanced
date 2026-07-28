import { setHttpCallback } from '@citizenfx/http-wrapper';

import { promises as fs } from 'fs';
import Koa from 'koa';
import Router from '@koa/router';
import { koaBody } from 'koa-body';
import type { File } from 'formidable';
import { v4 } from 'uuid';
import { registerExport } from '../shared/export';

const app = new Koa();
const router = new Router();

type UploadCallback = (err: string | boolean, data: string | null) => void;

interface UploadData {
    fileName?: string;
    cb: UploadCallback;
}

const uploads: { [token: string]: UploadData } = {};

/**
 * fs.rename fails with EXDEV when the target lives on another volume, which is
 * common when a server points `fileName` at a different drive than the temp dir.
 */
async function moveFile(source: string, target: string) {
    try {
        await fs.rename(source, target);
    } catch (err: any) {
        if (err?.code !== 'EXDEV') {
            throw err;
        }

        await fs.copyFile(source, target);
        await fs.unlink(source);
    }
}

router.post('/upload/:token', async (ctx) => {
    const tkn: string = ctx.params['token'];

    ctx.response.append('Access-Control-Allow-Origin', '*');
    ctx.response.append('Access-Control-Allow-Methods', 'GET, POST');

    const upload = uploads[tkn];

    if (upload === undefined) {
        ctx.body = { success: false };
        return;
    }

    delete uploads[tkn];

    const finish = (err: string | null, data: string | null) => {
        setImmediate(() => {
            upload.cb(err || false, data);
        });
    };

    // formidable v3 always hands back arrays for repeated fields
    const uploaded = ctx.request.files?.['file'];
    const f: File | undefined = Array.isArray(uploaded) ? uploaded[0] : uploaded;

    if (f) {
        try {
            if (upload.fileName) {
                await moveFile(f.filepath, upload.fileName);
                finish(null, upload.fileName);
            } else {
                const data = await fs.readFile(f.filepath);
                await fs.unlink(f.filepath).catch(() => {});

                finish(null, `data:${f.mimetype};base64,${data.toString('base64')}`);
            }
        } catch (err: any) {
            finish(err?.message ?? String(err), null);
        }
    } else {
        finish('no file was uploaded', null);
    }

    ctx.body = { success: true };
});

app.use(
    koaBody({
        patchKoa: true,
        multipart: true,
    }),
)
    .use(router.routes())
    .use(router.allowedMethods());

setHttpCallback(app.callback());

registerExport(
    'requestClientScreenshot',
    (player: string | number, options: any, cb: UploadCallback) => {
        const tkn = v4();

        const fileName = options.fileName;
        delete options['fileName']; // so the client won't get to know this

        uploads[tkn] = {
            fileName,
            cb,
        };

        emitNet(
            'screenshot_basic:requestScreenshot',
            player,
            options,
            `/${GetCurrentResourceName()}/upload/${tkn}`,
        );
    },
);
