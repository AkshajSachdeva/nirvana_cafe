import { cpSync, copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = resolve(projectRoot, 'client', 'dist');
const publicAssets = resolve(projectRoot, 'assets');

if (!existsSync(resolve(buildDir, 'index.html')) || !existsSync(resolve(buildDir, 'assets'))) {
  throw new Error('Vite output is missing. Build the client before publishing the Pages files.');
}

copyFileSync(resolve(buildDir, 'index.html'), resolve(projectRoot, 'index.html'));
if (existsSync(resolve(buildDir, 'favicon.svg'))) {
  copyFileSync(resolve(buildDir, 'favicon.svg'), resolve(projectRoot, 'favicon.svg'));
}
rmSync(publicAssets, { recursive: true, force: true });
mkdirSync(publicAssets, { recursive: true });
cpSync(resolve(buildDir, 'assets'), publicAssets, { recursive: true });

console.log('GitHub Pages files copied to the repository root.');
