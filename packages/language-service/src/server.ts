import {
  CLEARKRYPT_VERSION,
  Diagnostic,
  lowerProject,
  TargetName,
} from '@clearkrypt/compiler-core';
import { emitSwift } from '@clearkrypt/emitter-swift';
import { emitKotlin } from '@clearkrypt/emitter-kotlin';
import { emitReact } from '@clearkrypt/emitter-react';
import { normalizeWhitespace } from '@clearkrypt/formatter';
import { completions, documentSymbols, hover, toRange } from './features';
import {
  LspDiagnostic,
  semanticTokenModifiers,
  semanticTokenTypes,
  toLspDiagnostic,
} from './protocol';
import { semanticTokensFull } from './semanticTokens';
import { uriToPath, Workspace } from './workspace';

/**
 * The ClearKrypt language server, transport-agnostic.
 *
 * `handleRequest`/`handleNotification` implement the LSP 3.17 subset and the
 * clearkrypt/* extension methods from docs/21-language-server.md. Pushed
 * diagnostics go through the `publish` callback the transport provides.
 */
export interface PublishParams {
  readonly uri: string;
  readonly diagnostics: readonly LspDiagnostic[];
}

export class ClearKryptLanguageServer {
  private workspace?: Workspace;
  private readonly openUris = new Set<string>();
  private readonly publishedUris = new Set<string>();
  private shutdownRequested = false;

  constructor(private readonly publish: (params: PublishParams) => void) {}

  get receivedShutdown(): boolean {
    return this.shutdownRequested;
  }

  // -- Requests ---------------------------------------------------------------

  handleRequest(method: string, params: unknown): unknown {
    switch (method) {
      case 'initialize':
        return this.initialize(params as { rootUri?: string; rootPath?: string });
      case 'shutdown':
        this.shutdownRequested = true;
        return null;
      case 'textDocument/documentSymbol':
        return this.withDocument(params, (relative, text) =>
          documentSymbols({ path: relative, text }),
        );
      case 'textDocument/hover': {
        const p = params as { textDocument: { uri: string }; position: { line: number; character: number } };
        const workspace = this.requireWorkspace();
        const relative = workspace.relativePath(p.textDocument.uri);
        const { checked } = workspace.check();
        return hover(checked, relative, p.position);
      }
      case 'textDocument/completion': {
        const workspace = this.requireWorkspace();
        const { checked } = workspace.check();
        return completions(checked.semanticModel);
      }
      case 'textDocument/formatting':
        return this.withDocument(params, (_relative, text) => {
          const result = normalizeWhitespace(text);
          if (!result.changed) return [];
          const lines = text.split('\n');
          return [
            {
              range: {
                start: { line: 0, character: 0 },
                end: { line: lines.length, character: 0 },
              },
              newText: result.text,
            },
          ];
        });
      case 'textDocument/semanticTokens/full':
        return this.withDocument(params, (relative, text) => {
          const { checked } = this.requireWorkspace().check();
          return { data: semanticTokensFull({ path: relative, text }, checked) };
        });
      case 'clearkrypt/projectInfo': {
        const workspace = this.requireWorkspace();
        const manifest = workspace.getManifest();
        return {
          name: manifest?.name ?? '',
          version: manifest?.version ?? '',
          targets: manifest?.targets ?? { swift: false, kotlin: false, react: false },
          outputDir: manifest?.outputDir ?? 'generated',
          sourceFiles: workspace.sources().map((s) => s.path),
        };
      }
      case 'clearkrypt/check': {
        const workspace = this.requireWorkspace();
        const { diagnostics } = workspace.check();
        return { diagnostics: groupByUri(workspace, diagnostics) };
      }
      case 'clearkrypt/generatedMap':
        return this.generatedMap();
      default:
        throw new MethodNotFound(method);
    }
  }

  // -- Notifications -----------------------------------------------------------

  handleNotification(method: string, params: unknown): void {
    switch (method) {
      case 'initialized':
        return;
      case 'textDocument/didOpen': {
        const p = params as { textDocument: { uri: string; text: string } };
        this.requireWorkspace().openDocument(p.textDocument.uri, p.textDocument.text);
        this.openUris.add(p.textDocument.uri);
        this.recheckAndPublish();
        return;
      }
      case 'textDocument/didChange': {
        const p = params as {
          textDocument: { uri: string };
          contentChanges: { text: string }[];
        };
        const change = p.contentChanges[p.contentChanges.length - 1];
        if (change) {
          this.requireWorkspace().changeDocument(p.textDocument.uri, change.text);
          this.recheckAndPublish();
        }
        return;
      }
      case 'textDocument/didClose': {
        const p = params as { textDocument: { uri: string } };
        this.requireWorkspace().closeDocument(p.textDocument.uri);
        this.openUris.delete(p.textDocument.uri);
        this.recheckAndPublish();
        return;
      }
      case 'textDocument/didSave':
        return;
      default:
        return; // Unknown notifications are ignored per LSP.
    }
  }

  // -- Internals ----------------------------------------------------------------

  private initialize(params: { rootUri?: string; rootPath?: string }): unknown {
    const root = params.rootUri ? uriToPath(params.rootUri) : params.rootPath;
    if (root) {
      this.workspace = new Workspace(root);
    }
    return {
      capabilities: {
        textDocumentSync: 1, // Full
        documentSymbolProvider: true,
        hoverProvider: true,
        completionProvider: { triggerCharacters: [':', '.', '<'] },
        documentFormattingProvider: true,
        semanticTokensProvider: {
          legend: {
            tokenTypes: [...semanticTokenTypes],
            tokenModifiers: [...semanticTokenModifiers],
          },
          full: true,
        },
      },
      serverInfo: { name: 'clearkrypt-language-server', version: CLEARKRYPT_VERSION },
    };
  }

  private requireWorkspace(): Workspace {
    if (!this.workspace) {
      throw new Error('Server not initialized: initialize must include rootUri or rootPath.');
    }
    return this.workspace;
  }

  private withDocument<T>(params: unknown, action: (relative: string, text: string) => T): T {
    const p = params as { textDocument: { uri: string } };
    const workspace = this.requireWorkspace();
    const relative = workspace.relativePath(p.textDocument.uri);
    const text =
      workspace.getDocumentText(p.textDocument.uri) ??
      workspace.sources().find((s) => s.path === relative)?.text ??
      '';
    return action(relative, text);
  }

  private recheckAndPublish(): void {
    const workspace = this.requireWorkspace();
    const { diagnostics } = workspace.check();
    const byUri = new Map<string, LspDiagnostic[]>();
    for (const diagnostic of diagnostics) {
      const uri = workspace.uriFor(diagnostic.span.file);
      const list = byUri.get(uri) ?? [];
      list.push(toLspDiagnostic(diagnostic));
      byUri.set(uri, list);
    }
    // Publish current state for every open or previously-published file so
    // fixed files get their diagnostics cleared.
    const urisToPublish = new Set([...this.openUris, ...this.publishedUris, ...byUri.keys()]);
    for (const uri of urisToPublish) {
      this.publish({ uri, diagnostics: byUri.get(uri) ?? [] });
    }
    this.publishedUris.clear();
    for (const uri of byUri.keys()) this.publishedUris.add(uri);
  }

  private generatedMap(): unknown {
    const workspace = this.requireWorkspace();
    const manifest = workspace.getManifest();
    const { checked } = workspace.check();
    if (!manifest || checked.diagnostics.some((d) => d.severity === 'error')) {
      return { modules: [] };
    }
    const targets: TargetName[] = [];
    if (manifest.targets.swift) targets.push('swift');
    if (manifest.targets.kotlin) targets.push('kotlin');
    if (manifest.targets.react) targets.push('react');

    const lowered = lowerProject(checked, { targets });
    const emitters = { swift: emitSwift, kotlin: emitKotlin, react: emitReact } as const;

    const byModule = new Map<string, { sourceFile: string; targets: Record<string, string[]> }>();
    for (const module of lowered.project.modules) {
      byModule.set(module.name, { sourceFile: module.file, targets: {} });
    }
    for (const target of targets) {
      const result = emitters[target](lowered.project, { compilerVersion: CLEARKRYPT_VERSION });
      for (const file of result.files) {
        const entry = byModule.get(file.sourceModule);
        if (!entry) continue; // Shared support files belong to no module.
        const list = entry.targets[target] ?? [];
        list.push(`${manifest.outputDir}/${target}/${file.path}`);
        entry.targets[target] = list;
      }
    }
    return {
      modules: [...byModule.entries()].map(([name, entry]) => ({
        module: name,
        sourceFile: entry.sourceFile,
        targets: entry.targets,
      })),
    };
  }
}

export class MethodNotFound extends Error {
  constructor(readonly method: string) {
    super(`Method not found: ${method}`);
  }
}

function groupByUri(
  workspace: Workspace,
  diagnostics: readonly Diagnostic[],
): { uri: string; diagnostics: LspDiagnostic[] }[] {
  const byUri = new Map<string, LspDiagnostic[]>();
  for (const diagnostic of diagnostics) {
    const uri = workspace.uriFor(diagnostic.span.file);
    const list = byUri.get(uri) ?? [];
    list.push(toLspDiagnostic(diagnostic));
    byUri.set(uri, list);
  }
  return [...byUri.entries()].map(([uri, list]) => ({ uri, diagnostics: list }));
}

export { toRange };
