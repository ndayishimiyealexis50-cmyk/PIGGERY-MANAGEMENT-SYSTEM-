/**
 * FarmIQ — Pre-compile JSX build script
 *
 * What it does:
 *   1. Reads index.html
 *   2. Extracts the <script type="text/babel"> block
 *   3. Compiles JSX → plain JS using @babel/core (server-side, once)
 *   4. Writes dist/index.html with:
 *        - Babel standalone <script> tag REMOVED  (~1.5MB saved)
 *        - Babel preload <link> REMOVED
 *        - Compiled plain <script> in place of text/babel block
 *   5. Copies companion files (manifest.json, sw.js, icons, js/)
 *
 * Result: browser downloads no Babel, compiles nothing — loads ~3s faster.
 */

const fs   = require('fs');
const path = require('path');
const babel = require('@babel/core');

// ── 1. Read source ──────────────────────────────────────────────
const src = fs.readFileSync('index.html', 'utf8');
console.log(`📄 Read index.html (${(src.length/1024).toFixed(0)} KB)`);

// ── 2. Locate the <script type="text/babel"…> block ─────────────
const BABEL_OPEN_MARKER = '<script type="text/babel"';
const SCRIPT_CLOSE      = '</script>';

const babelTagStart = src.indexOf(BABEL_OPEN_MARKER);
if (babelTagStart === -1) {
  console.error('❌ Could not find <script type="text/babel"> in index.html');
  process.exit(1);
}

// Find the > that closes the opening tag
const babelContentStart = src.indexOf('>', babelTagStart) + 1;

// The babel script is the LAST </script> in the file
const babelContentEnd = src.lastIndexOf(SCRIPT_CLOSE);
if (babelContentEnd === -1 || babelContentEnd < babelContentStart) {
  console.error('❌ Could not find closing </script> for babel block');
  process.exit(1);
}

const jsxContent = src.slice(babelContentStart, babelContentEnd);
console.log(`🔍 Extracted JSX block (${(jsxContent.length/1024).toFixed(0)} KB)`);

// ── 3. Compile JSX ───────────────────────────────────────────────
console.log('⚙️  Compiling JSX with Babel…');
let compiled;
try {
  const result = babel.transformSync(jsxContent, {
    presets: [
      ['@babel/preset-react', { runtime: 'classic' }]
    ],
    plugins: [
      '@babel/plugin-transform-class-properties'
    ],
    sourceMaps: false,
    compact: false,
    retainLines: false,
  });
  compiled = result.code;
  console.log(`✅ Compiled (${(compiled.length/1024).toFixed(0)} KB output)`);
} catch (err) {
  console.error('❌ Babel compile error:\n', err.message);
  process.exit(1);
}

// ── 4. Build output HTML ─────────────────────────────────────────
let out = src;

// Remove Babel standalone preload <link>
out = out.replace(
  /\s*<link rel="preload" href="https:\/\/unpkg\.com\/@babel\/standalone[^"]*"[^>]*\/>\s*/g,
  '\n'
);

// Remove Babel standalone <script src=…>
out = out.replace(
  /\s*<script src="https:\/\/unpkg\.com\/@babel\/standalone[^"]*"[^>]*><\/script>\s*/g,
  '\n<!-- ✅ Babel compiled at build time — standalone removed -->\n'
);

// Replace the full <script type="text/babel"…>…</script> block with compiled plain JS
const fullBabelBlock = src.slice(babelTagStart, babelContentEnd + SCRIPT_CLOSE.length);
const compiledScript = `<script>\n${compiled}\n</script>`;
out = out.replace(fullBabelBlock, compiledScript);

// ── 5. Write dist/ ───────────────────────────────────────────────
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/index.html', out, 'utf8');
console.log(`📦 dist/index.html written (${(out.length/1024).toFixed(0)} KB)`);

// ── 6. Copy companion files ──────────────────────────────────────
const filesToCopy = [
  'manifest.json',
  'sw.js',
  'icon-192.png',
  'icon-512.png',
];

filesToCopy.forEach(f => {
  if (fs.existsSync(f)) {
    fs.copyFileSync(f, path.join('dist', f));
    console.log(`📋 Copied: ${f}`);
  }
});

// Copy js/ folder if it exists
if (fs.existsSync('js')) {
  fs.mkdirSync('dist/js', { recursive: true });
  fs.readdirSync('js').forEach(f => {
    fs.copyFileSync(path.join('js', f), path.join('dist/js', f));
    console.log(`📋 Copied: js/${f}`);
  });
}

console.log('\n🚀 Build complete → dist/');
const saved = src.length - out.length;
console.log(`💾 Babel standalone removed — ~1.5 MB saved from browser download`);
