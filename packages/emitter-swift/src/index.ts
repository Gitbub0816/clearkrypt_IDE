/**
 * @clearkrypt/emitter-swift — lowers ClearKrypt IR into readable Swift.
 *
 * Layout (docs/19-target-mappings.md): one file per declared type
 * (`app/main/Greeting.swift`), one `Functions.swift` per module with
 * functions, and a single shared `ClearKrypt.swift` support file at the
 * target root.
 */
import {
  Diagnostic,
  EmitOptions,
  EmitResult,
  GeneratedFile,
  IrOrigin,
  IrProject,
} from '@clearkrypt/compiler-core';
import { normalizeWhitespace } from '@clearkrypt/formatter';
import { renderEnum, renderErrorType, renderFunction, renderModel, RenderedDecl } from './declarations';
import { unsupportedFeature } from './diagnostics';
import { moduleHeader } from './header';
import { modulePath } from './naming';
import { buildSupportFile } from './support';

function assemble(headerLines: readonly string[], needsFoundation: boolean, bodyLines: readonly string[]): string {
  const lines: string[] = [...headerLines, ''];
  if (needsFoundation) {
    lines.push('import Foundation', '');
  }
  lines.push(...bodyLines);
  return normalizeWhitespace(lines.join('\n')).text;
}

function typeFile(
  moduleName: string,
  header: readonly string[],
  path: string,
  rendered: RenderedDecl,
): GeneratedFile {
  return {
    path,
    contents: assemble(header, rendered.needsFoundation, rendered.lines),
    sourceModule: moduleName,
  };
}

export function emitSwift(project: IrProject, options: EmitOptions): EmitResult {
  const diagnostics: Diagnostic[] = [];
  const files: GeneratedFile[] = [];

  for (const module of project.modules) {
    const header = moduleHeader(options.compilerVersion, module.file, module.name);
    const dirPath = modulePath(module.name);
    const functionGroups: RenderedDecl[] = [];

    for (const decl of module.declarations) {
      switch (decl.kind) {
        case 'model':
          files.push(typeFile(module.name, header, `${dirPath}/${decl.name}.swift`, renderModel(decl, diagnostics)));
          break;
        case 'enum':
          files.push(typeFile(module.name, header, `${dirPath}/${decl.name}.swift`, renderEnum(decl, diagnostics)));
          break;
        case 'error':
          files.push(
            typeFile(module.name, header, `${dirPath}/${decl.name}.swift`, renderErrorType(decl, diagnostics)),
          );
          break;
        case 'function':
          functionGroups.push(renderFunction(decl, diagnostics));
          break;
        default: {
          // Defensive: IrDeclaration is currently closed to
          // model | enum | error | function (see diagnostics.ts). If the IR
          // grows a new declaration kind before this emitter is updated,
          // fail loudly instead of silently dropping it.
          const unknown = decl as { kind: string; origin?: IrOrigin };
          if (unknown.origin !== undefined) {
            diagnostics.push(unsupportedFeature(unknown.origin, `Unrecognized declaration kind '${unknown.kind}'`));
          }
          break;
        }
      }
    }

    if (functionGroups.length > 0) {
      const needsFoundation = functionGroups.some((g) => g.needsFoundation);
      const body: string[] = [];
      functionGroups.forEach((group, index) => {
        if (index > 0) {
          body.push('');
        }
        body.push(...group.lines);
      });
      files.push({
        path: `${dirPath}/Functions.swift`,
        contents: assemble(header, needsFoundation, body),
        sourceModule: module.name,
      });
    }
  }

  files.push(buildSupportFile(options));
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  return { files, diagnostics };
}
