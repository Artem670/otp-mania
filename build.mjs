// Сборка в один HTML-файл: node build.mjs
import { build } from '/opt/npm-tools/node_modules/esbuild/lib/main.js';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

// Подключение к базе: supabase.config.json (url и anonKey публичные) или переменные окружения
let cfg = { url: '', anonKey: '' };
if (existsSync('supabase.config.json')) cfg = { ...cfg, ...JSON.parse(readFileSync('supabase.config.json', 'utf8')) };
if (process.env.SUPABASE_URL) cfg.url = process.env.SUPABASE_URL;
if (process.env.SUPABASE_ANON_KEY) cfg.anonKey = process.env.SUPABASE_ANON_KEY;
const OUT = process.env.OUT || 'dist/otp-mania.html';

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
  define: { 'process.env.NODE_ENV': '"production"', __SUPABASE_URL__: JSON.stringify(cfg.url), __SUPABASE_ANON_KEY__: JSON.stringify(cfg.anonKey) },
  loader: { '.css': 'css', '.png': 'dataurl', '.jpg': 'dataurl' },
  logLevel: 'warning',
});
const js = res.outputFiles.find((f) => f.path.endsWith('.js')).text;
const favicon = 'data:image/png;base64,' + readFileSync('src/assets/otp-logo.png').toString('base64');
const fontUrl = 'data:font/woff;base64,' + readFileSync('src/assets/fonts/onest.woff').toString('base64');
const fontFace = `@font-face{font-family:'Onest';src:url(${fontUrl}) format('woff');font-weight:100 900;font-style:normal;font-display:swap}`;
const css = res.outputFiles.find((f) => f.path.endsWith('.css'))?.text ?? '';
mkdirSync('dist', { recursive: true });
const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ОТП Мания</title>
<link rel="icon" type="image/png" href="${favicon}">
<script>try{var t=localStorage.getItem('otp-mania-theme');document.documentElement.dataset.theme=t==='dark'||t==='light'?t:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}catch(e){}</script>
<style>${fontFace}${css}</style>
</head>
<body>
<div id="root"></div>
<script>${js.replace(/<\/script/g, '<\\/script')}</script>
</body>
</html>`;
writeFileSync(OUT, html);
if (!process.env.OUT) writeFileSync('index.html', html);
console.log(OUT, cfg.url ? 'база: ' + cfg.url : 'без базы (демо)', (html.length / 1024).toFixed(0) + ' KB');
