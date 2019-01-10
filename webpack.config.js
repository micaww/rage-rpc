const path  = require('path');

module.exports = {
    entry: './src/index.ts',
    mode: 'production',
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
        filename: 'rage-rpc.min.js',
        library: 'rpc',
        libraryTarget: 'umd',
        globalObject: "typeof self !== 'undefined' ? self : this"
    }
};