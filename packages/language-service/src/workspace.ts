import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  checkProject,
  CheckedProject,
  Diagnostic,
  parseManifest,
  ProjectManifest,
  SourceFileInput,
} from '@clearkrypt/compiler-core';

/**
 * The server's view of one ClearKrypt project: manifest and sources from
 * disk, with open editor documents overlaid, rechecked on every change.
 */
export class Workspace {
  private readonly overlays = new Map<string, string>(); // project-relative path -> text
  private manifest?: ProjectManifest;
  private manifestDiagnostics: readonly Diagnostic[] = [];

  constructor(readonly root: string) {
    this.reloadManifest();
  }

  reloadManifest(): void {
    const manifestPath = path.join(this.root, 'clearkrypt.toml');
    if (!fs.existsSync(manifestPath)) {
      this.manifest = undefined;
      this.manifestDiagnostics = [];
      return;
    }
    const parsed = parseManifest(fs.readFileSync(manifestPath, 'utf8'));
    this.manifest = parsed.manifest;
    this.manifestDiagnostics = parsed.diagnostics;
  }

  getManifest(): ProjectManifest | undefined {
    return this.manifest;
  }

  /** Converts a file:// URI into a project-relative path (POSIX separators). */
  relativePath(uri: string): string {
    const filePath = uriToPath(uri);
    return path.relative(this.root, filePath).split(path.sep).join('/');
  }

  uriFor(relative: string): string {
    return pathToUri(path.join(this.root, relative));
  }

  openDocument(uri: string, text: string): void {
    this.overlays.set(this.relativePath(uri), text);
  }

  changeDocument(uri: string, text: string): void {
    this.overlays.set(this.relativePath(uri), text);
  }

  closeDocument(uri: string): void {
    this.overlays.delete(this.relativePath(uri));
  }

  getDocumentText(uri: string): string | undefined {
    return this.overlays.get(this.relativePath(uri));
  }

  /** All project sources, with open-document overlays taking precedence. */
  sources(): SourceFileInput[] {
    const result = new Map<string, SourceFileInput>();
    const srcDir = path.join(this.root, 'src');
    if (fs.existsSync(srcDir)) {
      for (const file of walk(srcDir)) {
        if (!file.endsWith('.ck')) continue;
        const relative = path.relative(this.root, file).split(path.sep).join('/');
        result.set(relative, { path: relative, text: fs.readFileSync(file, 'utf8') });
      }
    }
    for (const [relative, text] of this.overlays) {
      result.set(relative, { path: relative, text });
    }
    return [...result.values()].sort((a, b) => (a.path < b.path ? -1 : 1));
  }

  /** Rechecks the whole project. */
  check(): { checked: CheckedProject; diagnostics: readonly Diagnostic[] } {
    const checked = checkProject(this.sources());
    return { checked, diagnostics: [...this.manifestDiagnostics, ...checked.diagnostics] };
  }
}

export function uriToPath(uri: string): string {
  if (!uri.startsWith('file://')) return uri;
  return decodeURIComponent(uri.replace(/^file:\/\//, ''));
}

export function pathToUri(filePath: string): string {
  const normalized = filePath.split(path.sep).join('/');
  return 'file://' + normalized.split('/').map(encodeURIComponent).join('/').replace(/%2F/g, '/');
}

function walk(dir: string): string[] {
  const result: string[] = [];
  for (const entry of fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...walk(full));
    } else {
      result.push(full);
    }
  }
  return result;
}
