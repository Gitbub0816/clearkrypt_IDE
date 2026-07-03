#!/usr/bin/env node
/**
 * Packages the ClearKrypt SDK: the CLI, language server, compiler, and
 * emitters as one relocatable directory tree with launcher shims.
 *
 * Usage: node scripts/package-sdk.mjs [outDir]
 *
 * Layout (relocatable; requires only Node.js >= 20 on PATH):
 *   clearkrypt-sdk-<version>/
 *     bin/clearkrypt          POSIX shim
 *     bin/clearkrypt.cmd      Windows shim
 *     lib/node_modules/@clearkrypt/<package>/{package.json,dist,bin}
 *     README.md
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packages = [
  'compiler-core',
  'emitter-swift',
  'emitter-kotlin',
  'emitter-react',
  'formatter',
  'language-service',
  'cli',
];

const rootPkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
const version = rootPkg.version;
const outBase = path.resolve(process.argv[2] ?? path.join(repoRoot, 'dist-sdk'));
const sdkRoot = path.join(outBase, `clearkrypt-sdk-${version}`);

console.log(`Building packages...`);
execSync('npm run build', { cwd: repoRoot, stdio: 'inherit' });

fs.rmSync(sdkRoot, { recursive: true, force: true });
const modulesRoot = path.join(sdkRoot, 'lib', 'node_modules', '@clearkrypt');
fs.mkdirSync(modulesRoot, { recursive: true });
fs.mkdirSync(path.join(sdkRoot, 'bin'), { recursive: true });

for (const name of packages) {
  const source = path.join(repoRoot, 'packages', name);
  const target = path.join(modulesRoot, name);
  fs.mkdirSync(target, { recursive: true });
  fs.copyFileSync(path.join(source, 'package.json'), path.join(target, 'package.json'));
  fs.cpSync(path.join(source, 'dist'), path.join(target, 'dist'), { recursive: true });
  const binDir = path.join(source, 'bin');
  if (fs.existsSync(binDir)) {
    fs.cpSync(binDir, path.join(target, 'bin'), { recursive: true });
  }
}

const cliEntry = 'lib/node_modules/@clearkrypt/cli/bin/clearkrypt.js';

fs.writeFileSync(
  path.join(sdkRoot, 'bin', 'clearkrypt'),
  `#!/bin/sh
SDK_DIR="$(cd "$(dirname "$0")/.." && pwd)"
exec node "$SDK_DIR/${cliEntry}" "$@"
`,
  { mode: 0o755 },
);

fs.writeFileSync(
  path.join(sdkRoot, 'bin', 'clearkrypt.cmd'),
  `@echo off\r
setlocal\r
set SDK_DIR=%~dp0..\r
node "%SDK_DIR%\\${cliEntry.replace(/\//g, '\\')}" %*\r
`,
);

fs.writeFileSync(
  path.join(sdkRoot, 'README.md'),
  `# ClearKrypt SDK ${version}

The ClearKrypt compiler, CLI, and language server in one relocatable
directory. Requires Node.js 20 or newer on PATH.

## Install

Put \`bin/\` on your PATH, or set \`CLEARKRYPT_SDK\` to this directory so the
ClearKrypt IDEs can find it:

- macOS/Linux: \`export PATH="$PATH:/path/to/clearkrypt-sdk-${version}/bin"\`
- Windows: add \`...\\clearkrypt-sdk-${version}\\bin\` to PATH.

## Verify

\`\`\`sh
clearkrypt --version
clearkrypt new hello && cd hello && clearkrypt build
\`\`\`

The language server used by the IDEs: \`clearkrypt language-server --stdio\`.
`,
);

console.log(`SDK packaged at ${sdkRoot}`);
