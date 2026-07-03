import * as path from 'node:path';
import {
  CLEARKRYPT_VERSION,
  checkProject,
  lex,
  lowerProject,
  parseSource,
  printAst,
  printIr,
  printTokens,
  TargetName,
} from '@clearkrypt/compiler-core';
import { emitSwift } from '@clearkrypt/emitter-swift';
import { emitKotlin } from '@clearkrypt/emitter-kotlin';
import { emitReact } from '@clearkrypt/emitter-react';
import { loadProject } from './project';
import { enabledTargets } from './pipeline';
import { renderHuman } from './output';

/**
 * `clearkrypt explain <file> [dir] [--stage <name>]`
 *
 * Shows the compiler's own view of one source file, stage by stage: the
 * tokens the lexer produced, the AST the parser built, the checked IR the
 * emitters consume, and — per target — the exact generated code that file's
 * module becomes. Nothing here is a separate code path from the real
 * compiler: every stage calls the same `lex`/`parseSource`/`checkProject`/
 * `lowerProject`/`emit*` functions `check` and `build` use.
 */
const STAGE_NAMES = ['tokens', 'ast', 'ir', 'swift', 'kotlin', 'react'] as const;
type StageName = (typeof STAGE_NAMES)[number];

function isStageName(value: string): value is StageName {
  return (STAGE_NAMES as readonly string[]).includes(value);
}

export function commandExplain(
  args: readonly string[],
  cwd: string,
  out: string[],
  err: string[],
): number {
  let stage: StageName | undefined;
  const positionals: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--stage') {
      const value = args[i + 1];
      if (!value || !isStageName(value)) {
        err.push(
          `--stage must be one of ${STAGE_NAMES.join(', ')}; found '${value ?? ''}'.`,
        );
        return 64;
      }
      stage = value;
      i++;
      continue;
    }
    if (!args[i]!.startsWith('--')) positionals.push(args[i]!);
  }

  const [fileArg, dirArg] = positionals;
  if (!fileArg) {
    err.push('Usage: clearkrypt explain <file> [dir] [--stage tokens|ast|ir|swift|kotlin|react]');
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

  const relPath = path
    .relative(root, path.resolve(root, fileArg))
    .split(path.sep)
    .join('/');
  const source = loaded.project.sources.find((s) => s.path === relPath);
  if (!source) {
    err.push(
      `'${relPath}' is not a .ck file under this project's src/ directory. ` +
        `Files: ${loaded.project.sources.map((s) => s.path).join(', ') || '(none)'}.`,
    );
    return 64;
  }

  const wants = (name: StageName): boolean => !stage || stage === name;
  const section = (title: string): void => {
    out.push(`== ${title} ==`);
  };

  if (wants('tokens')) {
    section(`Tokens: ${relPath}`);
    const { tokens } = lex(source, { includeTrivia: true });
    out.push(printTokens(tokens));
  }

  if (wants('ast')) {
    section(`AST: ${relPath}`);
    const { file, diagnostics } = parseSource(source);
    out.push(printAst(file));
    if (diagnostics.length > 0) {
      out.push('');
      out.push('Parse diagnostics:');
      for (const line of renderHuman(diagnostics)) out.push(line);
    }
  }

  const needsCheckedProject = wants('ir') || wants('swift') || wants('kotlin') || wants('react');
  if (!needsCheckedProject) {
    return 0;
  }

  const checked = checkProject(loaded.project.sources);
  const errors = checked.diagnostics.filter((d) => d.severity === 'error');
  if (errors.length > 0) {
    section('Checked IR / generated code: skipped');
    out.push(
      `This project has ${errors.length} type error${errors.length === 1 ? '' : 's'}; ` +
        `fix them first (run 'clearkrypt check' for the full list):`,
    );
    for (const line of renderHuman(checked.diagnostics)) out.push(line);
    return 1;
  }

  const moduleName = checked.modules.find((m) => m.file === relPath)?.name;
  const modulePath = moduleName?.replace(/\./g, '/');
  const selectedTargets = enabledTargets(loaded.project);
  const lowered = lowerProject(checked, { targets: selectedTargets });

  if (wants('ir')) {
    const irModule = lowered.project.modules.find((m) => m.file === relPath);
    section(`Checked IR: ${relPath}${moduleName ? ` (module ${moduleName})` : ''}`);
    if (irModule) {
      out.push(printIr({ modules: [irModule] }));
    } else {
      out.push(
        '(nothing lowered for this file — it may declare no module, or every ' +
          'declaration in it is not-yet-emitted; see the diagnostics from `clearkrypt build`.)',
      );
    }
  }

  const emitters: Record<TargetName, typeof emitSwift> = {
    swift: emitSwift,
    kotlin: emitKotlin,
    react: emitReact,
  };
  for (const target of ['swift', 'kotlin', 'react'] as const) {
    if (!wants(target)) continue;
    section(`Generated ${target}: ${relPath}`);
    if (!selectedTargets.includes(target)) {
      out.push(`(${target} is disabled for this project in clearkrypt.toml)`);
      continue;
    }
    if (!modulePath) {
      out.push('(this file declares no module, so nothing was generated from it)');
      continue;
    }
    const result = emitters[target](lowered.project, { compilerVersion: CLEARKRYPT_VERSION });
    const filesForModule = result.files.filter(
      (f) => f.path === `${modulePath}.ts` || f.path.startsWith(`${modulePath}/`),
    );
    if (filesForModule.length === 0) {
      out.push(
        '(no output for this module on this target — see "Not yet emitted" in ' +
          'docs/19-target-mappings.md)',
      );
    }
    for (const f of filesForModule) {
      out.push(`--- ${f.path} ---`);
      out.push(f.contents);
    }
  }

  return 0;
}
