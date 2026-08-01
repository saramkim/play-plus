const path = require('path');
const dotenv = require('dotenv');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
const webpack = require('webpack');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

dotenv.config({ path: path.resolve(__dirname, '.env'), quiet: true });
dotenv.config({ path: path.resolve(__dirname, '.env.local'), override: true, quiet: true });

const packageJson = require('./package.json');

const isProd = process.argv.at(-1) === 'production';
const shouldAnalyze = process.env.ANALYZE === 'true';

module.exports = {
  mode: 'production',
  devtool: isProd ? false : 'source-map',
  entry: {
    index: path.resolve(__dirname, 'src/ui/index.tsx'),
    background: path.resolve(__dirname, 'src/background/index.ts'),
    content: path.resolve(__dirname, 'src/content/index.ts'),
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        include: path.resolve(__dirname, 'src'),
        oneOf: [
          {
            test: /\.tsx$/,
            use: {
              loader: 'babel-loader',
              options: {
                presets: [
                  '@babel/preset-env',
                  ['@babel/preset-react', { runtime: 'automatic' }],
                  '@babel/preset-typescript',
                ],
              },
            },
          },
          {
            test: /\.ts$/,
            use: 'ts-loader',
          },
        ],
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    plugins: [new TsconfigPathsPlugin({ configFile: './tsconfig.json' })],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: 'src/ui/index.html',
      filename: 'index.html',
      chunks: ['index'],
    }),
    new CopyWebpackPlugin({
      patterns: [{ from: 'public', to: '.' }],
    }),
    new webpack.DefinePlugin({
      __OPENSUBTITLES_API_KEY__: JSON.stringify(process.env.OPENSUBTITLES_API_KEY ?? ''),
      __OPENSUBTITLES_USER_AGENT__: JSON.stringify(
        process.env.OPENSUBTITLES_USER_AGENT?.trim() || `Play Plus v${packageJson.version}`
      ),
    }),
    ...(shouldAnalyze ? [new BundleAnalyzerPlugin()] : []),
  ],
  optimization: {
    splitChunks: {
      chunks: 'async',
    },
    runtimeChunk: false,
  },
};
