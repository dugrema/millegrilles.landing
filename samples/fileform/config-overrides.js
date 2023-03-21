const webpack = require('webpack');

module.exports = function override(config, env) {
    const fallback = config.resolve.fallback || {};
    Object.assign(fallback, {
        buffer: 'buffer/',
        crypto: 'crypto-browserify/',
        path: 'path-browserify/',
        stream: 'stream-browserify/',
    })
    config.resolve.fallback = fallback;
    
    let plugins = config.plugins || [];
    plugins.push(
        new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer'],
        })
    );
    config.plugins = plugins

    return config;
}