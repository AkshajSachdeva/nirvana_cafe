import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(projectRoot, 'client', 'dist');
let html = await readFile(path.join(dist, 'index.html'), 'utf8');
const scriptSrc = html.match(/<script[^>]+src="([^"]+)"[^>]*><\/script>/i)?.[1];
const scriptTag = html.match(/<script[^>]+src="[^"]+"[^>]*><\/script>/i)?.[0];
const cssHref = html.match(/<link[^>]+href="([^"]+\.css)"[^>]*>/i)?.[1];
const cssTag = html.match(/<link[^>]+href="[^"]+\.css"[^>]*>/i)?.[0];
if (!scriptSrc || !scriptTag || !cssHref || !cssTag) throw new Error('Expected built CSS and JavaScript bundle references in client/dist/index.html');

const jsPath = path.join(dist, scriptSrc.replace(/^\//, '').replaceAll('/', path.sep));
const cssPath = path.join(dist, cssHref.replace(/^\//, '').replaceAll('/', path.sep));
const [js, css, favicon] = await Promise.all([
  readFile(jsPath, 'utf8'),
  readFile(cssPath, 'utf8'),
  readFile(path.join(projectRoot, 'client', 'public', 'favicon.svg'), 'utf8'),
]);
const safeJs = js.replace(/<\/script/gi, '<\\/script');
html = html.replace(cssTag, () => `<style>${css}</style>`);
html = html.replace(scriptTag, () => `<script type="module">${safeJs}</script>`);
html = html.replace(/<link[^>]+rel="icon"[^>]*>/i, () => `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(favicon)}">`);

const output = path.join(projectRoot, 'Nirvana_Cafe.html');
await writeFile(output, html, 'utf8');
console.log(`Created ${output}`);
