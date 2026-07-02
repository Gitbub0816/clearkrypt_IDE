/**
 * @clearkrypt/emitter-kotlin — lowers ClearKrypt IR into readable Kotlin.
 *
 * Layout (docs/19-target-mappings.md): one file per declared type
 * (`app/main/Greeting.kt`), one `Functions.kt` per module with functions,
 * and a single shared `clearkrypt/ClearKrypt.kt` support file (package
 * `clearkrypt`) at the target root.
 */
import { Diagnostic, EmitOptions, EmitResult, GeneratedFile, IrOrigin, IrProject } from '@clearkrypt/compiler-core';
import { normalizeWhitespace } from '@clearkrypt/formatter';
import { createContext, KotlinCtx } from './context';
import { renderEnum, renderErrorType, renderFunction, renderModel } from './declarations';
import { unsupportedFeature } from './diagnostics';
import { moduleHeader } from './header';
import { modulePath } from './naming';
import { buildSupportFile } from './support';

function assemble(headerLines: readonly string[], packageName: string, ctx: KotlinCtx, bodyLines: readonly string[]): string {
  const lines: string[] = [...headerLines, '', `package ${packageName}`];
  if (ctx.imports.size > 0) {
    lines.push('', ...[...ctx.imports].sort().map((i) => `import ${i}`));
  }
  lines.push('', ...bodyLines);
  return normalizeWhitespace(lines.join('\n')).text;
}

export function emitKotlin(project: IrProject, options: EmitOptions): EmitResult {
  const diagnostics: Diagnostic[] = [];
  const files: GeneratedFile[] = [];

  for (const module of project.modules) {
    const header = moduleHeader(options.compilerVersion, module.file, module.name);
    const dirPath = modulePath(module.name);
    const functionGroups: (readonly string[])[] = [];
    let functionsCtx: KotlinCtx | undefined;

    for (const decl of module.declarations) {
      switch (decl.kind) {
        case 'model': {
          const ctx = createContext(module.name, diagnostics);
          const rendered = renderModel(decl, ctx);
          files.push({
            path: `${dirPath}/${decl.name}.kt`,
            contents: assemble(header, module.name, ctx, rendered.lines),
            sourceModule: module.name,
          });
          break;
        }
        case 'enum': {
          const ctx = createContext(module.name, diagnostics);
          const rendered = renderEnum(decl, ctx);
          files.push({
            path: `${dirPath}/${decl.name}.kt`,
            contents: assemble(header, module.name, ctx, rendered.lines),
            sourceModule: module.name,
          });
          break;
        }
        case 'error': {
          const ctx = createContext(module.name, diagnostics);
          const rendered = renderErrorType(decl, ctx);
          files.push({
            path: `${dirPath}/${decl.name}.kt`,
            contents: assemble(header, module.name, ctx, rendered.lines),
            sourceModule: module.name,
          });
          break;
        }
        case 'function': {
          functionsCtx ??= createContext(module.name, diagnostics);
          functionGroups.push(renderFunction(decl, functionsCtx).lines);
          break;
        }
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

    if (functionGroups.length > 0 && functionsCtx !== undefined) {
      const body: string[] = [];
      functionGroups.forEach((group, index) => {
        if (index > 0) {
          body.push('');
        }
        body.push(...group);
      });
      files.push({
        path: `${dirPath}/Functions.kt`,
        contents: assemble(header, module.name, functionsCtx, body),
        sourceModule: module.name,
      });
    }
  }

  files.push(buildSupportFile(options));
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  return { files, diagnostics };
}
