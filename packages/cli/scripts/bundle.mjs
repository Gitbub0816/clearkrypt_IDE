#!/usr/bin/env node
// Bundles the CLI's own compiled output (dist/index.js, produced by `tsc
// --build`) plus every sibling @clearkrypt/* workspace package it imports
// into one self-contained CommonJS file. The published npm package has no
// runtime dependency on the workspace: `npm install -g clearkrypt` (or
// `npx clearkrypt`) works standalone on a machine that has never seen this
// monorepo, because there is nothing left to resolve at install time except
// Node's own built-ins.
import { build } from 'esbuild';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, '..');
const entry = path.join(packageRoot, 'dist', 'index.js');

if (!existsSync(entry)) {
  console.error(
    `bundle.mjs: ${entry} does not exist yet. Run "npm run build" (tsc --build) from the ` +
      'repository root first, so every @clearkrypt/* package has compiled JS to bundle.',
  );
  process.exit(1);
}

await build({
  entryPoints: [entry],
  outfile: path.join(packageRoot, 'dist', 'bundle.cjs'),
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  legalComments: 'none',
  logLevel: 'info',
});
