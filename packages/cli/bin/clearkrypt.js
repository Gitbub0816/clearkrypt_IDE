#!/usr/bin/env node
require('../dist/index.js').main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err) => {
    console.error(err && err.stack ? err.stack : String(err));
    process.exit(70);
  }
);
