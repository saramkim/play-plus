const path = require('path');
const { DefinePlugin } = require('webpack');
const { getFeedbackConfig } = require('./scripts/feedback-build-config.cjs');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

const shouldAnalyze = process.env.ANALYZE === 'true';

module.exports = (_env, argv = {}) => {
  const isProd = argv.mode !== 'development';
  const feedback = getFeedbackConfig(process.env, isProd);
  return {
  mode: argv.mode || 'production',
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
    new DefinePlugin({ __FEEDBACK_CONFIG__: JSON.stringify(feedback) }),
    new HtmlWebpackPlugin({
      template: 'src/ui/index.html',
      filename: 'index.html',
      chunks: ['index'],
    }),
    new CopyWebpackPlugin({
      patterns: [{ from: 'public', to: '.', transform: (content, filename) => {
        if (!filename.endsWith('manifest.json') || !feedback.origin) return content;
        const manifest = JSON.parse(content.toString());
        manifest.optional_host_permissions = [`${feedback.origin}/*`];
        return JSON.stringify(manifest, null, 2);
      } }],
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
};
