const webpack = require("webpack");
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
const path = require('path');

module.exports = {
    entry: "./src/main.ts",
    devtool: 'inline-source-map',
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            {
				test: /\.css$/,
				use: ['style-loader', 'css-loader']
			},
			{
				test: /\.ttf$/,
				type: 'asset/resource'
			}
        ],
    },
    plugins: [
        new MonacoWebpackPlugin(),
        new webpack.ProvidePlugin({
            "process": "process"
        })
    ],
    mode: "production",
    resolve: {
        extensions: [ '.ts', '.js' ],
        fallback: {
            assert: require.resolve("assert"),
            process: require.resolve("process")
        }
    },
    output: {
        filename: "main.js",
        path: path.resolve(__dirname, 'dist'),
    },
};