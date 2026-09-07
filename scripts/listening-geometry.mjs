import { readFile, mkdtemp } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import HtmlWebpackPlugin from 'html-webpack-plugin';
import webpack from 'webpack';

// Development-only geometry fixture. Never overwrites the installed dist/ build.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = await mkdtemp(path.join(tmpdir(), 'play-plus-listening-geometry-'));
await new Promise((resolve, reject) => webpack({
  mode: 'development', devtool: false, context: root,
  entry: path.join(root, 'src/ui/features/listening-mission/listening-mission.geometry.tsx'),
  output: { path: output, filename: 'fixture.js' },
  resolve: { extensions: ['.tsx', '.ts', '.js'], alias: {
    '@': path.join(root, 'src'), '@storage': path.join(root, 'src/storage'), '@utils': path.join(root, 'src/utils'),
  } },
  module: { rules: [
    { test: /\.tsx?$/, include: path.join(root, 'src'), use: { loader: 'babel-loader', options: { presets: [
      '@babel/preset-env', ['@babel/preset-react', { runtime: 'automatic' }], '@babel/preset-typescript',
    ] } } },
    { test: /\.css$/, use: ['style-loader', { loader: 'css-loader', options: { url: { filter: (url) => !url.startsWith('/') } } }, 'postcss-loader'] },
  ] },
  plugins: [new HtmlWebpackPlugin({ template: path.join(root, 'src/ui/index.html') })],
}, (error, stats) => {
  if (error || stats?.hasErrors()) reject(error ?? new Error(stats?.toString('errors-only')));
  else resolve();
}));

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
  const publicAsset = /^\/(?:assets\/fonts\/[\w.-]+\.woff2|_locales\/(?:en|ko)\/messages\.json)$/.test(pathname);
  const generated = pathname === '/' || pathname === '/fixture.js';
  if (!publicAsset && !generated) { response.writeHead(404).end(); return; }
  try {
    const file = publicAsset ? path.join(root, pathname.startsWith('/assets/') ? 'src' : 'public', pathname.slice(1)) : path.join(output, pathname === '/' ? 'index.html' : 'fixture.js');
    const mime = pathname.endsWith('.js') ? 'text/javascript' : pathname.endsWith('.json') ? 'application/json' : pathname.endsWith('.woff2') ? 'font/woff2' : 'text/html';
    const body = await readFile(file);
    response.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' }).end(body);
  } catch { response.writeHead(404).end(); }
});
server.listen(0, '127.0.0.1', () => {
  const address = server.address();
  if (address && typeof address !== 'string') console.log(`Geometry fixture: http://127.0.0.1:${address.port}/?width=320&sample=english&locale=en&theme=light`);
});
