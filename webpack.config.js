const path  = require('path');
const ReplaceInFileWebpackPlugin = require('replace-in-file-webpack-plugin');

const LIBRARY_NAME = 'rpc';
const OUTPUT_FILE = 'rage-rpc.min.js';

module.exports = mode => ({
    entry: './src/index.ts',
    mode,
    module: {
        rules: [
            {
                test: /\.ts$/,
                loader: 'babel-loader'
            }
        ]
    },
    resolve: {
        extensions: ['.ts']
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: OUTPUT_FILE,
        library: LIBRARY_NAME,
        libraryTarget: 'umd',
        globalObject: "typeof self !== 'undefined' ? self : this"
    },
    plugins: [
        new ReplaceInFileWebpackPlugin([{
            dir: 'dist',
            files: [OUTPUT_FILE],
            rules: [{
                search: `exports.${LIBRARY_NAME}`,
                replace: 'exports'
            }, {
                search: `exports["${LIBRARY_NAME}"]`,
                replace: 'exports'
            }]
        }])
    ]
});