import { execSync } from 'child_process';
import fs from 'fs';

console.log('--- Cloudflare Pages Build Script ---');
console.log('1. Installing dependencies in site directory...');
execSync('npm --prefix site install', { stdio: 'inherit' });

console.log('2. Running Astro build...');
execSync('npm --prefix site run build', { stdio: 'inherit' });

console.log('3. Syncing build artifacts to ./dist...');
if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true, force: true });
}
fs.cpSync('site/dist', 'dist', { recursive: true });

console.log('Build completed successfully! ./dist ready for Cloudflare Pages deployment.');
