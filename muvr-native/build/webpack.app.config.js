const path = require("path");
const merge = require("webpack-merge");
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');
const base = require("./webpack.base.config");

module.exports = env => {
  return merge(base(env), {
    entry: {
      background: "./src/background.js",
      app: "./src/app.js"
    },
    optimization: {
      minimizer: [
        new UglifyJsPlugin()
      ]
    },
    output: {
      filename: "[name].js",
      path: path.resolve(__dirname, "../app")
    }
  });
};
