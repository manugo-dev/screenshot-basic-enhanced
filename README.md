# screenshot-basic for FiveM

## Description

screenshot-basic is a basic resource for making screenshots of clients' game render targets using FiveM. It uses the same backing
WebGL/OpenGL ES calls as used by the `application/x-cfx-game-view` plugin (see the code in [citizenfx/fivem](https://github.com/citizenfx/fivem/blob/b0a7cda1007dc53d2ba0f638c035c0a5d1402796/data/client/bin/d3d_rendering.cc#L248)),
and wraps these calls using Three.js to 'simplify' WebGL initialization and copying to a buffer from asynchronous NUI.

## Usage

1. Make sure your [cfx-server-data](https://github.com/citizenfx/cfx-server-data) is updated. You can easily
   update it by running `git pull` in your local clone directory.
2. Install `screenshot-basic-enhanced`:
   ```
   mkdir -p 'resources/[local]/'
   cd 'resources/[local]'
   git clone https://github.com/manugo-dev/screenshot-basic-enhanced.git screenshot-basic
   ```
3. Build the resource before starting your FiveM server:

```bash
cd resources/[local]/screenshot-basic
npm install
npm run build
```

This generates `dist/client.js`, `dist/server.js` and `dist/ui.html` which are required at runtime.
`dist/` is git-ignored, so run the build again after every `git pull` and before starting the server.

4. Make/use a resource that uses it. Currently, there are no directly-usable commands, it is only usable through exports.

## Development

Requires Node.js 20 or newer to build (the emitted bundles themselves target ES2020 so they run
on any current FiveM runtime).

| Script                                     | What it does                                                           |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| `npm run build`                            | Cleans `dist/` and builds client, server and UI bundles.               |
| `npm run build:client` / `:server` / `:ui` | Builds a single target.                                                |
| `npm run watch:client` / `:server` / `:ui` | Rebuilds a single target on change.                                    |
| `npm run typecheck`                        | Type-checks all three targets (the build itself uses `transpileOnly`). |
| `npm run lint` / `lint:fix`                | ESLint (type-aware) over the whole repo.                               |
| `npm run format` / `format:check`          | Prettier write / check.                                                |
| `npm run verify`                           | Typecheck + lint + format check — what CI should run.                  |

Each target has its own `tsconfig.json` (`src/client`, `src/server`, `ui`) because they use
different globals and libs — client natives, server natives + Node, and DOM respectively.
Ambient natives are pulled in by `globals.d.ts` in each target rather than `compilerOptions.types`,
so the packages resolve the same way in the editor and on the command line.

### How the client registers its exports

The client JS runtime on FiveM Enhanced no longer provides the `exports` global, so `client.ts`
registers exports the way the runtime itself would. `exports(name, fn)` is only sugar over an
event: the export system triggers `__cfx_export_<resource>_<name>` with a setter callback, and
whatever the handler hands to that setter becomes the exported function. So this is equivalent:

```ts
on(`__cfx_export_${GetCurrentResourceName()}_${name}`, (setCB) => setCB(fn));
```

Two details worth knowing:

- If a runtime _does_ expose `exports`, that is used instead — the fallback only kicks in when the
  global is missing.
- Registration happens under the resource's own name **and** every name it `provide`s (read via
  `GetResourceMetadata`), so both `exports['screenshot-basic']` and
  `exports['screenshot-basic-enhanced']` resolve even though the folder is named the latter.

### Commit conventions

Husky installs two hooks on `npm install`:

- **pre-commit** runs `lint-staged`, which auto-fixes and formats staged files (and aborts the
  commit if ESLint reports something it cannot fix).
- **commit-msg** runs `commitlint` against
  [Conventional Commits](https://www.conventionalcommits.org/), with scopes restricted to
  `client`, `server`, `ui`, `build`, `deps`, `docs`, `ci` and `repo`.

```
feat(server): return a data URI when no fileName is given
fix(ui): handle failed uploads instead of dropping the promise
chore(deps): bump webpack to 5.109
```

## API

### Client

#### requestScreenshot(options?: any, cb: (result: string) => void)

Takes a screenshot and passes the data URI to a callback. Please don't send this through _any_ server events.

Arguments:

- **options**: An optional object containing options.
  - **encoding**: 'png' | 'jpg' | 'webp' - The target image encoding. Defaults to 'jpg'.
  - **quality**: number - The quality for a lossy image encoder, in a range for 0.0-1.0. Defaults to 0.92.
- **cb**: A callback upon result.
  - **result**: A `base64` data URI for the image.

Example:

```lua
exports['screenshot-basic']:requestScreenshot(function(data)
    TriggerEvent('chat:addMessage', { template = '<img src="{0}" style="max-width: 300px;" />', args = { data } })
end)
```

#### requestScreenshotUpload(url: string, field: string, options?: any, cb: (result: string) => void)

Takes a screenshot and uploads it as a file (`multipart/form-data`) to a remote HTTP URL.

Arguments:

- **url**: The URL to a file upload handler.
- **field**: The name for the form field to add the file to.
- **options**: An optional object containing options.
  - **encoding**: 'png' | 'jpg' | 'webp' - The target image encoding. Defaults to 'jpg'.
  - **quality**: number - The quality for a lossy image encoder, in a range for 0.0-1.0. Defaults to 0.92.
- **cb**: A callback upon result.
  - **result**: The response data for the remote URL.

Example:

```lua
exports['screenshot-basic']:requestScreenshotUpload('https://wew.wtf/upload.php', 'files[]', function(data)
    local resp = json.decode(data)
    TriggerEvent('chat:addMessage', { template = '<img src="{0}" style="max-width: 300px;" />', args = { resp.files[1].url } })
end)
```

#### Client events

The same two calls are also reachable as local client events, for resources that would rather not
go through exports:

| Event                                             | Arguments                    |
| ------------------------------------------------- | ---------------------------- |
| `screenshot_basic:client:requestScreenshot`       | `options, reply`             |
| `screenshot_basic:client:requestScreenshotUpload` | `url, field, options, reply` |

`reply` is either a callback function or **the name of an event** to trigger with the result — the
latter avoids passing function references between resources entirely:

```lua
-- with a callback
TriggerEvent('screenshot_basic:client:requestScreenshot', { encoding = 'png' }, function(data)
    print(data)
end)

-- with a reply event
AddEventHandler('my-resource:gotScreenshot', function(data)
    print(data)
end)

TriggerEvent('screenshot_basic:client:requestScreenshot', { encoding = 'png' }, 'my-resource:gotScreenshot')
```

### Server

The server can also request a client to take a screenshot and upload it to a built-in HTTP handler on the server.

Using this API on the server requires at least FiveM client version 1129160, and server pipeline 1011 or higher.

#### requestClientScreenshot(player: string | number, options: any, cb: (err: string | boolean, data: string) => void)

Requests the specified client to take a screenshot.

Arguments:

- **player**: The target player's player index.
- **options**: An object containing options.
  - **fileName**: string? - The file name on the server to save the image to. If not passed, the callback will get a data URI for the image data.
  - **encoding**: 'png' | 'jpg' | 'webp' - The target image encoding. Defaults to 'jpg'.
  - **quality**: number - The quality for a lossy image encoder, in a range for 0.0-1.0. Defaults to 0.92.
- **cb**: A callback upon result.
  - **err**: `false`, or an error string.
  - **data**: The local file name the upload was saved to, or the data URI for the image.

Example:

```lua
exports['screenshot-basic']:requestClientScreenshot(GetPlayers()[1], {
    fileName = 'cache/screenshot.jpg'
}, function(err, data)
    print('err', err)
    print('data', data)
end)
```
