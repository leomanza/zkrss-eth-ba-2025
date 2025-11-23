const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');

module.exports = {
    entry: './app/src/main.ts',
    output: {
        path: path.resolve(__dirname, 'app/dist'),
        filename: 'bundle.js',
        clean: true,
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            {
                test: /\.css$/i,
                use: ['style-loader', 'css-loader'],
            },
        ],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
        fallback: {
            "crypto": require.resolve("crypto-browserify"),
            "stream": require.resolve("stream-browserify"),
            "buffer": require.resolve("buffer/"),
            "util": require.resolve("util/"),
            "assert": require.resolve("assert/"),
            "process": require.resolve("process/browser"),
            "fs": false,
            "path": false,
            "os": false,
            "events": false
        }
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './app/src/index.html',
        }),
        new CopyWebpackPlugin({
            patterns: [
                { from: 'app/src/style.css', to: 'style.css' },
            ],
        }),
        new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer'],
            process: 'process/browser',
        }),
    ],
    devServer: {
        static: {
            directory: path.join(__dirname, 'app/dist'),
        },
        compress: true,
        port: 8081,
        hot: true,
    },
};
