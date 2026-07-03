/**
 * @clearkrypt/emitter-react — lowers ClearKrypt IR into readable TypeScript.
 *
 * Layout (docs/19-target-mappings.md): one file per module (`app/main.ts`)
 * containing every declaration in source order, and a single shared
 * `clearkrypt.ts` support file at the target root.
 */
import { Diagnostic, EmitOptions, EmitResult, GeneratedFile, IrOrigin, IrProject } from '@clearkrypt/compiler-core';
import { normalizeWhitespace } from '@clearkrypt/formatter';
import { createContext, TsCtx } from './context';
import { renderEnum, renderErrorType, renderFunction, renderModel } from './declarations';
import { unsupportedFeature } from './diagnostics';
import { moduleHeader } from './header';
import { buildEnumIndex, buildModelIndex } from './modelIndex';
import { modulePath } from './naming';
import { relativeImportSpecifier } from './paths';
import { buildSupportFile } from './support';

function buildImportLines(currentModule: string, ctx: TsCtx): string[] {
  const lines: string[] = [];
  for (const [moduleKey, names] of ctx.typeImports) {
    if (names.size === 0) {
      continue;
    }
    const spec = relativeImportSpecifier(currentModule, moduleKey);
    lines.push(`import type { ${[...names].sort().join(', ')} } from '${spec}';`);
  }
  for (const [moduleKey, names] of ctx.valueImports) {
    if (names.size === 0) {
      continue;
    }
    const spec = relativeImportSpecifier(currentModule, moduleKey);
    lines.push(`import { ${[...names].sort().join(', ')} } from '${spec}';`);
  }
  return lines.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export function emitReact(project: IrProject, options: EmitOptions): EmitResult {
  const diagnostics: Diagnostic[] = [];
  const files: GeneratedFile[] = [];
  const modelIndex = buildModelIndex(project);
  const enumIndex = buildEnumIndex(project);

  for (const module of project.modules) {
    // "The TS module file exists if the module has any declarations."
    if (module.declarations.length === 0) {
      continue;
    }

    const ctx = createContext(module.name, modelIndex, enumIndex, diagnostics);
    const header = moduleHeader(options.compilerVersion, module.file, module.name);
    const groups: (readonly string[])[] = [];

    for (const decl of module.declarations) {
      switch (decl.kind) {
        case 'model':
          groups.push(renderModel(decl, ctx).lines);
          break;
        case 'enum':
          groups.push(renderEnum(decl, ctx).lines);
          break;
        case 'error':
          groups.push(renderErrorType(decl, ctx).lines);
          break;
        case 'function':
          groups.push(renderFunction(decl, ctx).lines);
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

    const body: string[] = [];
    groups.forEach((group, index) => {
      if (index > 0) {
        body.push('');
      }
      body.push(...group);
    });

    const importLines = buildImportLines(module.name, ctx);
    const lines: string[] = [...header, ''];
    if (importLines.length > 0) {
      lines.push(...importLines, '');
    }
    lines.push(...body);

    files.push({
      path: `${modulePath(module.name)}.ts`,
      contents: normalizeWhitespace(lines.join('\n')).text,
      sourceModule: module.name,
    });
  }

  files.push(buildSupportFile(options));
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  return { files, diagnostics };
}
