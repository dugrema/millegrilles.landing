const webpack = require('webpack');

module.exports = function override(config, env) {
    const fallback = config.resolve.fallback || {};
    Object.assign(fallback, {
        buffer: 'buffer/', //require.resolve('buffer/'),
        crypto: 'crypto-browserify/',  // require.resolve('crypto-browserify/'),
        path: 'path-browserify/',   // require.resolve('os-browserify/'),
        stream: 'stream-browserify/',  // require.resolve('stream-browserify/'),
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