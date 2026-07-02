import { Diagnostic } from '../diagnostics/diagnostic';
import { IrProject } from '../ir/nodes';

/**
 * The contract every target emitter implements.
 *
 * Constitution (Document 6): emitters own file layout, imports, naming
 * adaptation, and target syntax. They never define language semantics, and
 * they must report unsupported features as diagnostics (CK0004) instead of
 * generating broken output.
 */

export interface GeneratedFile {
  /** Path relative to the target output root, e.g. `app/main/Greeting.swift`. */
  readonly path: string;
  readonly contents: string;
  /** The ClearKrypt module this file was generated from, or `clearkrypt` for shared support files. */
  readonly sourceModule: string;
}

export interface EmitResult {
  readonly files: readonly GeneratedFile[];
  readonly diagnostics: readonly Diagnostic[];
}

export interface EmitOptions {
  /** Compiler version string included in generated headers. */
  readonly compilerVersion: string;
}

export type EmitFunction = (project: IrProject, options: EmitOptions) => EmitResult;
