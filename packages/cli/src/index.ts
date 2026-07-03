import * as fs from 'node:fs';
import * as path from 'node:path';
import { CLEARKRYPT_VERSION, TargetName } from '@clearkrypt/compiler-core';
import { normalizeWhitespace } from '@clearkrypt/formatter';
import { loadProject } from './project';
import { enabledTargets, runPipeline } from './pipeline';
import { renderHuman, renderJson, renderSummary } from './output';

/**
 * The clearkrypt CLI.
 *
 * Exit codes (docs/21-language-server.md): 0 success, 1 diagnostics with
 * errors, 64 usage error, 70 internal error.
 */

export interface CliResult {
  readonly code: number;
  readonly stdout: string;
  readonly stderr: string;
}

const usage = `ClearKrypt ${CLEARKRYPT_VERSION}

Usage: clearkrypt <command> [options]

Commands:
  new <name>            Create a new ClearKrypt project
  check [dir]           Parse and type-check the project
  build [dir]           Check and emit all targets enabled in clearkrypt.toml
  emit [dir] --target <swift|kotlin|react>
                        Check and emit specific targets (repeatable)
  format [dir]          Normalize source whitespace (--check to verify only)
  language-server       Run the language server over stdio

Options:
  --json                Machine-readable output (check/build/emit)
  --version             Print the compiler version
  --help                Show this help
`;

export async function runCli(args: readonly string[], cwd: string): Promise<CliResult> {
  const out: string[] = [];
  const err: string[] = [];
  const code = await dispatch(args, cwd, out, err);
  return {
    code,
    stdout: out.join('\n') + (out.length ? '\n' : ''),
    stderr: err.join('\n') + (err.length ? '\n' : ''),
  };
}

/** Entry point used by bin/clearkrypt.js. */
export async function main(args: string[]): Promise<number> {
  const result = await runCli(args, process.cwd());
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result.code;
}

async function dispatch(
  args: readonly string[],
  cwd: string,
  out: string[],
  err: string[],
): Promise<number> {
  const [command, ...rest] = args;
  if (!command || command === '--help' || command === 'help') {
    out.push(usage);
    return command ? 0 : 64;
  }
  if (command === '--version' || command === 'version') {
    out.push(CLEARKRYPT_VERSION);
    return 0;
  }

  switch (command) {
    case 'new':
      return commandNew(rest, cwd, out, err);
    case 'check':
      return commandCheckOrBuild(rest, cwd, out, err, 'check');
    case 'build':
      return commandCheckOrBuild(rest, cwd, out, err, 'build');
    case 'emit':
      return commandCheckOrBuild(rest, cwd, out, err, 'emit');
    case 'format':
      return commandFormat(rest, cwd, out, err);
    case 'language-server': {
      // Runs over stdio until the client sends exit (docs/21).
      const { runStdioServer } = await import('@clearkrypt/language-service');
      return runStdioServer();
    }
    default:
      err.push(`Unknown command '${command}'.`);
      err.push(usage);
      return 64;
  }
}

// ---------------------------------------------------------------------------
// clearkrypt new
// ---------------------------------------------------------------------------

function commandNew(args: readonly string[], cwd: string, out: string[], err: string[]): number {
  const name = args.find((a) => !a.startsWith('--'));
  if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) {
    err.push(`Usage: clearkrypt new <name>   (lowercase letters, digits, dashes)`);
    return 64;
  }
  const root = path.join(cwd, name);
  if (fs.existsSync(root)) {
    err.push(`Cannot create project: '${root}' already exists.`);
    return 64;
  }
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'clearkrypt.toml'),
    `[project]
name = "${name}"
version = "0.1.0"

[targets]
swift = true
kotlin = true
react = true

[output]
dir = "generated"
`,
  );
  fs.writeFileSync(
    path.join(root, 'src', 'main.ck'),
    `module app.main

model Greeting {
  id: ID
  message: String
}

fn greetingText(greeting: Greeting) -> String {
  return greeting.message
}
`,
  );
  fs.writeFileSync(path.join(root, '.gitignore'), 'generated/\n');
  out.push(`Created ${name}/`);
  out.push('  clearkrypt.toml');
  out.push('  src/main.ck');
  out.push('');
  out.push(`Next: cd ${name} && clearkrypt check`);
  return 0;
}

// ---------------------------------------------------------------------------
// clearkrypt check / build / emit
// ---------------------------------------------------------------------------

function commandCheckOrBuild(
  args: readonly string[],
  cwd: string,
  out: string[],
  err: string[],
  mode: 'check' | 'build' | 'emit',
): number {
  const json = args.includes('--json');
  const dirArg = args.find((a) => !a.startsWith('--') && a !== 'swift' && a !== 'kotlin' && a !== 'react');

  const requestedTargets: TargetName[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--target') {
      const value = args[i + 1];
      if (value === 'swift' || value === 'kotlin' || value === 'react') {
        requestedTargets.push(value);
        i++;
      } else {
        err.push(`--target must be swift, kotlin, or react; found '${value ?? ''}'.`);
        return 64;
      }
    }
  }
  if (mode === 'emit' && requestedTargets.length === 0) {
    err.push('emit requires at least one --target <swift|kotlin|react>.');
    return 64;
  }

  const root = path.resolve(cwd, dirArg ?? '.');
  const loaded = loadProject(root);
  if (loaded.failure) {
    err.push(loaded.failure);
    return 64;
  }
  if (!loaded.project) {
    for (const line of renderHuman(loaded.diagnostics)) err.push(line);
    return 1;
  }

  const emitTargets: readonly TargetName[] =
    mode === 'check' ? [] : mode === 'emit' ? requestedTargets : enabledTargets(loaded.project);

  const result = runPipeline(loaded.project, { emitTargets });
  const allDiagnostics = [...loaded.diagnostics, ...result.diagnostics];

  const written: string[] = [];
  if (!result.hasErrors && emitTargets.length > 0) {
    // Each emitted target directory is replaced wholesale so output stays
    // deterministic; generated code is never merged with stale files.
    for (const target of emitTargets) {
      const targetDir = path.join(root, loaded.project.manifest.outputDir, target);
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    for (const file of result.generatedFiles) {
      const fullPath = path.join(root, file.path);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, file.contents);
      written.push(file.path);
    }
  }

  if (json) {
    out.push(renderJson(allDiagnostics, written));
  } else {
    for (const line of renderHuman(allDiagnostics)) out.push(line);
    out.push(renderSummary(allDiagnostics));
    if (written.length > 0) {
      out.push(
        `Generated ${written.length} file${written.length === 1 ? '' : 's'} for ` +
          `${emitTargets.join(', ')}.`,
      );
    }
  }
  return result.hasErrors ? 1 : 0;
}

// ---------------------------------------------------------------------------
// clearkrypt format
// ---------------------------------------------------------------------------

function commandFormat(args: readonly string[], cwd: string, out: string[], err: string[]): number {
  const checkOnly = args.includes('--check');
  const dirArg = args.find((a) => !a.startsWith('--'));
  const root = path.resolve(cwd, dirArg ?? '.');
  const loaded = loadProject(root);
  if (loaded.failure) {
    err.push(loaded.failure);
    return 64;
  }
  if (!loaded.project) {
    for (const line of renderHuman(loaded.diagnostics)) err.push(line);
    return 1;
  }

  let changed = 0;
  for (const source of loaded.project.sources) {
    const result = normalizeWhitespace(source.text);
    if (!result.changed) continue;
    changed++;
    if (checkOnly) {
      out.push(`would format ${source.path}`);
    } else {
      fs.writeFileSync(path.join(root, source.path), result.text);
      out.push(`formatted ${source.path}`);
    }
  }
  out.push(
    changed === 0
      ? 'All files already normalized.'
      : `${changed} file${changed === 1 ? '' : 's'} ${checkOnly ? 'need formatting' : 'formatted'}.`,
  );
  out.push(
    'Note: this version normalizes whitespace only; full formatting lands with a later milestone.',
  );
  return checkOnly && changed > 0 ? 1 : 0;
}
