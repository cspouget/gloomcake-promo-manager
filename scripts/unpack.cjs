const fs = require('fs');
const cp = require('child_process');
const path = require('path');

const root = process.cwd();
const b64Path = path.join(root, 'source.tar.gz.b64');
const tgzPath = path.join(root, '.gloomcake-source.tar.gz');

if (!fs.existsSync(b64Path)) {
  console.error('Missing source.tar.gz.b64');
  process.exit(1);
}

const buf = Buffer.from(fs.readFileSync(b64Path, 'utf8').replace(/\s+/g, ''), 'base64');
fs.writeFileSync(tgzPath, buf);
cp.execFileSync('tar', ['-xzf', tgzPath, '-C', root], { stdio: 'inherit' });
fs.rmSync(tgzPath, { force: true });

// The ChatGPT Sites export references an internal vendor stylesheet that is not
// part of the portable source bundle. Remove only that one import for Vercel.
const cssPath = path.join(root, 'app', 'globals.css');
if (fs.existsSync(cssPath)) {
  const css = fs.readFileSync(cssPath, 'utf8').replace('@import "../vendor/shadcn-tailwind-4.13.0.css";\n', '');
  fs.writeFileSync(cssPath, css);
}

console.log('GloomCake visualizer source unpacked for build.');
