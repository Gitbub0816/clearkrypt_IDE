import {
  checkProject,
  Diagnostic,
  EmitResult,
  GeneratedFile,
  lowerProject,
  TargetName,
  CLEARKRYPT_VERSION,
} from '@clearkrypt/compiler-core';
import { emitSwift } from '@clearkrypt/emitter-swift';
import { emitKotlin } from '@clearkrypt/emitter-kotlin';
import { emitReact } from '@clearkrypt/emitter-react';
import { LoadedProject } from './project';

/** The compile pipeline shared by check, build, and emit. */
export interface PipelineResult {
  readonly diagnostics: readonly Diagnostic[];
  /** Files per target, paths relative to the project root (outputDir included). */
  readonly generatedFiles: readonly { readonly path: string; readonly contents: string }[];
  readonly hasErrors: boolean;
}

const emitters: Record<TargetName, (typeof emitSwift)> = {
  swift: emitSwift,
  kotlin: emitKotlin,
  react: emitReact,
};

/** Runs check + lowering (+ emit when targets request output). */
export function runPipeline(
  project: LoadedProject,
  options: { emitTargets: readonly TargetName[] },
): PipelineResult {
  const diagnostics: Diagnostic[] = [];
  const generatedFiles: { path: string; contents: string }[] = [];

  const checked = checkProject(project.sources);
  diagnostics.push(...checked.diagnostics);

  const selectedTargets = enabledTargets(project);
  const lowered = lowerProject(checked, { targets: selectedTargets });
  diagnostics.push(...lowered.diagnostics);

  const hasErrorsSoFar = diagnostics.some((d) => d.severity === 'error');
  if (!hasErrorsSoFar) {
    for (const target of options.emitTargets) {
      const emit = emitters[target];
      const result: EmitResult = emit(lowered.project, { compilerVersion: CLEARKRYPT_VERSION });
      diagnostics.push(...result.diagnostics);
      for (const file of result.files) {
        generatedFiles.push({
          path: `${project.manifest.outputDir}/${target}/${file.path}`,
          contents: file.contents,
        });
      }
    }
  }

  return {
    diagnostics,
    generatedFiles,
    hasErrors: diagnostics.some((d) => d.severity === 'error'),
  };
}

export function enabledTargets(project: LoadedProject): TargetName[] {
  const targets: TargetName[] = [];
  if (project.manifest.targets.swift) targets.push('swift');
  if (project.manifest.targets.kotlin) targets.push('kotlin');
  if (project.manifest.targets.react) targets.push('react');
  return targets;
}
