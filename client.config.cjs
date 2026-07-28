const path = require('path');

/** @type {import('webpack').Configuration} */
module.exports = {
    mode: 'production',
    entry: './src/client/client.ts',
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: {
                    loader: 'ts-loader',
                    options: {
                        transpileOnly: true,
                        configFile: path.resolve(__dirname, 'src/client/tsconfig.json'),
                    },
                },
                exclude: /node_modules/,
            },
        ],
    },
    optimization: {
        minimize: false,
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
        // the client runtime has no Node core modules
        fallback: {
            fs: false,
            path: false,
        },
    },
    output: {
        filename: 'client.js',
        path: path.resolve(__dirname, 'dist'),
        iife: false,
    },
    target: ['web', 'es2020'],
    performance: {
        hints: false,
    },
    devtool: false,
};
