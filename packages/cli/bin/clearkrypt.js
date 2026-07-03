#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// The published package ships dist/bundle.cjs (produced by scripts/bundle.mjs
// at `prepack` time), a single self-contained file with no runtime dependency
// on the @clearkrypt/* workspace. In local monorepo development, before the
// bundle has been built, fall back to the plain tsc output plus the
// workspace's own node_modules symlinks.
const bundlePath = path.join(__dirname, '..', 'dist', 'bundle.cjs');
const entryPath = fs.existsSync(bundlePath) ? bundlePath : '../dist/index.js';

require(entryPath).main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err) => {
    console.error(err && err.stack ? err.stack : String(err));
    process.exit(70);
  }
);
