const path = require('path');

/** @type {import('webpack').Configuration} */
module.exports = {
    mode: 'production',
    entry: './src/server/server.ts',
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: {
                    loader: 'ts-loader',
                    options: {
                        transpileOnly: true,
                        configFile: path.resolve(__dirname, 'src/server/tsconfig.json'),
                    },
                },
                exclude: /node_modules/,
            },
        ],
    },
    optimization: {
        // the FiveM server runtime reports errors against this file, so keep it readable
        minimize: false,
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    output: {
        filename: 'server.js',
        path: path.resolve(__dirname, 'dist'),
    },
    // the server scripting runtime is Node-based; targeting node16 keeps the
    // emitted bundle compatible with both current and older FiveM builds
    target: 'node16',
    performance: {
        hints: false,
    },
    devtool: false,
};
