const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const HtmlInlineScriptPlugin = require('html-inline-script-webpack-plugin');

/** @type {import('webpack').Configuration} */
module.exports = {
    mode: 'production',
    entry: './ui/src/main.ts',
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: {
                    loader: 'ts-loader',
                    options: {
                        transpileOnly: true,
                        configFile: path.resolve(__dirname, 'ui/tsconfig.json'),
                    },
                },
                exclude: /node_modules/,
            },
        ],
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './ui/index.html',
            filename: 'ui.html',
            inject: 'body',
            scriptLoading: 'blocking',
            minify: false,
        }),
        // inline the bundle so ui.html is the only file NUI has to load
        new HtmlInlineScriptPlugin(),
        // the inlined bundle makes the extracted license sidecar dead weight
        {
            apply(compiler) {
                compiler.hooks.compilation.tap('DropLicenseFiles', (compilation) => {
                    compilation.hooks.processAssets.tap(
                        {
                            name: 'DropLicenseFiles',
                            stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT,
                        },
                        (assets) => {
                            for (const name of Object.keys(assets)) {
                                if (name.endsWith('.LICENSE.txt')) {
                                    compilation.deleteAsset(name);
                                }
                            }
                        },
                    );
                });
            },
        },
    ],
    resolve: {
        extensions: ['.ts', '.js'],
    },
    output: {
        filename: 'ui.js',
        path: path.resolve(__dirname, 'dist'),
    },
    target: ['web', 'es2020'],
    performance: {
        hints: false,
    },
    devtool: false,
};
