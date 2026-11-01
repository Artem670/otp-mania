// Сборка в один HTML-файл: node build.mjs
import { build } from '/opt/npm-tools/node_modules/esbuild/lib/main.js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const NM = '/opt/npm-tools/node_modules';
const res = await build({
  entryPoints: ['src/main.tsx'],
  bundle: true,
  minify: true,
  write: false,
  outdir: 'dist',
  format: 'iife',
  target: ['es2020'],
  jsx: 'automatic',
  nodePaths: [NM],
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.css': 'css', '.png': 'dataurl' },
  logLevel: 'warning',
});
const js = res.outputFiles.find((f) => f.path.endsWith('.js')).text;
import('node:fs');
const favicon = 'data:image/png;base64,' + readFileSync('src/assets/otp-logo.png').toString('base64');
const css = res.outputFiles.find((f) => f.path.endsWith('.css'))?.text ?? '';
mkdirSync('dist', { recursive: true });
const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ОТП Мания</title>
<link rel="icon" type="image/png" href="${favicon}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script>${js.replace(/<\/script/g, '<\\/script')}</script>
</body>
</html>`;
writeFileSync('dist/otp-mania.html', html);
console.log('dist/otp-mania.html', (html.length / 1024).toFixed(0) + ' KB');
