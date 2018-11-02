const path  = require('path');

module.exports = {
    entry: './src/index.js',
    mode: 'production',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'rage-rpc.min.js',
        library: 'rpc',
        libraryTarget: 'umd',
        globalObject: "typeof self !== 'undefined' ? self : this"
    }
};