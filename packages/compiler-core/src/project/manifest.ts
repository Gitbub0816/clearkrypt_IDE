import { Diagnostic } from '../diagnostics/diagnostic';
import { DiagnosticCodes } from '../diagnostics/codes';
import { LineMap } from '../text/sourceFile';

/**
 * The `clearkrypt.toml` project manifest.
 *
 * Parsed with a deliberate TOML subset — `[section]` headers, string,
 * boolean, and comment lines — so the toolchain has zero runtime
 * dependencies. The full TOML spec can be adopted later without changing
 * this interface.
 */
export interface ProjectManifest {
  readonly name: string;
  readonly version: string;
  readonly targets: { readonly swift: boolean; readonly kotlin: boolean; readonly react: boolean };
  readonly outputDir: string;
}

export interface ManifestParseResult {
  readonly manifest?: ProjectManifest;
  readonly diagnostics: readonly Diagnostic[];
}

export function parseManifest(text: string, filePath = 'clearkrypt.toml'): ManifestParseResult {
  const diagnostics: Diagnostic[] = [];
  const lineMap = new LineMap(text);
  const values = new Map<string, string | boolean>();

  let section = '';
  let offset = 0;
  for (const rawLine of text.split('\n')) {
    const lineStart = offset;
    offset += rawLine.length + 1;
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;

    const report = (message: string) => {
      diagnostics.push({
        code: DiagnosticCodes.UnexpectedToken,
        severity: 'error',
        message,
        span: lineMap.span(filePath, lineStart, lineStart + rawLine.length),
      });
    };

    if (line.startsWith('[') && line.endsWith(']')) {
      section = line.slice(1, -1).trim();
      continue;
    }
    const eq = line.indexOf('=');
    if (eq === -1) {
      report(`Expected 'key = value' or '[section]' in ${filePath}.`);
      continue;
    }
    const key = line.slice(0, eq).trim();
    const raw = line.slice(eq + 1).trim();
    let value: string | boolean;
    if (raw === 'true' || raw === 'false') {
      value = raw === 'true';
    } else if (raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2) {
      value = raw.slice(1, -1);
    } else {
      report(
        `Unsupported value '${raw}' in ${filePath}. This version supports quoted strings and true/false.`,
      );
      continue;
    }
    values.set(section === '' ? key : `${section}.${key}`, value);
  }

  const str = (key: string): string | undefined => {
    const v = values.get(key);
    return typeof v === 'string' ? v : undefined;
  };
  const bool = (key: string, fallback: boolean): boolean => {
    const v = values.get(key);
    return typeof v === 'boolean' ? v : fallback;
  };

  const name = str('project.name');
  if (!name) {
    diagnostics.push({
      code: DiagnosticCodes.UnexpectedToken,
      severity: 'error',
      message: `${filePath} must declare a project name:\n[project]\nname = "my-app"`,
      span: lineMap.span(filePath, 0, 0),
    });
    return { diagnostics };
  }

  return {
    manifest: {
      name,
      version: str('project.version') ?? '0.1.0',
      targets: {
        swift: bool('targets.swift', true),
        kotlin: bool('targets.kotlin', true),
        react: bool('targets.react', true),
      },
      outputDir: str('output.dir') ?? 'generated',
    },
    diagnostics,
  };
}
