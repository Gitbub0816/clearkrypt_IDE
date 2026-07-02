import * as path from 'node:path';
import { modulePath } from './naming';

/**
 * Computes the extensionless file path for a module, used only to derive
 * relative import specifiers. The shared support file is a pseudo-module
 * keyed `'clearkrypt'`, living at the target root as `clearkrypt.ts`.
 */
function moduleFilePath(moduleKey: string): string {
  return moduleKey === 'clearkrypt' ? 'clearkrypt' : modulePath(moduleKey);
}

/**
 * POSIX-relative import specifier from `fromModule`'s file to `toModuleKey`'s
 * file (docs/19-target-mappings.md, "Imports"): `app/api.ts` importing
 * `app/models.ts` uses `./models`; `app/main.ts` importing the root
 * `clearkrypt.ts` uses `../clearkrypt`.
 */
export function relativeImportSpecifier(fromModule: string, toModuleKey: string): string {
  const fromDir = path.posix.dirname(moduleFilePath(fromModule));
  const toPath = moduleFilePath(toModuleKey);
  let rel = path.posix.relative(fromDir, toPath);
  if (!rel.startsWith('.')) {
    rel = `./${rel}`;
  }
  return rel;
}
