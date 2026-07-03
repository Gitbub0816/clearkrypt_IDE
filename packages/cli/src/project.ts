import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  Diagnostic,
  parseManifest,
  ProjectManifest,
  SourceFileInput,
} from '@clearkrypt/compiler-core';

/** A loaded ClearKrypt project: manifest plus all source files. */
export interface LoadedProject {
  readonly root: string;
  readonly manifest: ProjectManifest;
  readonly sources: readonly SourceFileInput[];
}

export interface LoadProjectResult {
  readonly project?: LoadedProject;
  readonly diagnostics: readonly Diagnostic[];
  /** Human-readable failure when the directory is not a project at all. */
  readonly failure?: string;
}

export function loadProject(root: string): LoadProjectResult {
  const manifestPath = path.join(root, 'clearkrypt.toml');
  if (!fs.existsSync(manifestPath)) {
    return {
      diagnostics: [],
      failure:
        `No clearkrypt.toml found in ${root}. ` +
        `Run 'clearkrypt new <name>' to create a project, or run from a project root.`,
    };
  }
  const parsed = parseManifest(fs.readFileSync(manifestPath, 'utf8'));
  if (!parsed.manifest) {
    return { diagnostics: parsed.diagnostics };
  }

  const sources: SourceFileInput[] = [];
  const srcDir = path.join(root, 'src');
  if (fs.existsSync(srcDir)) {
    for (const file of walk(srcDir)) {
      if (file.endsWith('.ck')) {
        sources.push({
          path: path.relative(root, file).split(path.sep).join('/'),
          text: fs.readFileSync(file, 'utf8'),
        });
      }
    }
  }
  sources.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  return {
    project: { root, manifest: parsed.manifest, sources },
    diagnostics: parsed.diagnostics,
  };
}

function walk(dir: string): string[] {
  const result: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : 1,
  )) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...walk(full));
    } else {
      result.push(full);
    }
  }
  return result;
}
