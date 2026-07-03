import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ClearKryptLanguageServer,
  PublishParams,
  semanticTokenTypes,
} from '@clearkrypt/language-service';

const fixturesRoot = path.resolve(__dirname, '../../../tests/fixtures');

let projectRoot: string;
let published: PublishParams[];
let server: ClearKryptLanguageServer;

beforeEach(() => {
  projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'clearkrypt-ls-'));
  fs.cpSync(path.join(fixturesRoot, 'projects', 'hello-world'), projectRoot, { recursive: true });
  published = [];
  server = new ClearKryptLanguageServer((params) => published.push(params));
});

afterEach(() => {
  fs.rmSync(projectRoot, { recursive: true, force: true });
});

function initialize(): unknown {
  return server.handleRequest('initialize', { rootPath: projectRoot });
}

function mainUri(): string {
  return 'file://' + path.join(projectRoot, 'src', 'main.ck').split(path.sep).join('/');
}

function mainText(): string {
  return fs.readFileSync(path.join(projectRoot, 'src', 'main.ck'), 'utf8');
}

describe('lifecycle', () => {
  it('reports capabilities and server info on initialize', () => {
    const result = initialize() as {
      capabilities: {
        textDocumentSync: number;
        semanticTokensProvider: { legend: { tokenTypes: string[] } };
      };
      serverInfo: { name: string; version: string };
    };
    expect(result.serverInfo.name).toBe('clearkrypt-language-server');
    expect(result.capabilities.textDocumentSync).toBe(1);
    expect(result.capabilities.semanticTokensProvider.legend.tokenTypes).toEqual([
      ...semanticTokenTypes,
    ]);
  });
});

describe('diagnostics', () => {
  it('publishes diagnostics on open and clears them when fixed', () => {
    initialize();
    const broken = 'module app.main\n\nfn f() -> String {\n  return 42\n}\n';
    server.handleNotification('textDocument/didOpen', {
      textDocument: { uri: mainUri(), text: broken },
    });
    const withError = published.find(
      (p) => p.uri === mainUri() && p.diagnostics.some((d) => d.code === 'CK0003'),
    );
    expect(withError).toBeDefined();
    expect(withError!.diagnostics[0]!.source).toBe('clearkrypt');
    expect(withError!.diagnostics[0]!.range.start.line).toBe(3); // zero-based

    published.length = 0;
    server.handleNotification('textDocument/didChange', {
      textDocument: { uri: mainUri() },
      contentChanges: [{ text: mainText() }],
    });
    const cleared = published.find((p) => p.uri === mainUri());
    expect(cleared).toBeDefined();
    expect(cleared!.diagnostics).toEqual([]);
  });
});

describe('language features', () => {
  it('returns a hierarchical document outline', () => {
    initialize();
    const symbols = server.handleRequest('textDocument/documentSymbol', {
      textDocument: { uri: mainUri() },
    }) as { name: string; detail?: string; children?: { name: string }[] }[];
    const names = symbols.map((s) => s.name);
    expect(names).toContain('app.main');
    expect(names).toContain('Greeting');
    const greeting = symbols.find((s) => s.name === 'Greeting');
    expect(greeting!.children!.map((c) => c.name)).toEqual(['id', 'message', 'isFriendly']);
  });

  it('hovers a declaration name with its signature', () => {
    initialize();
    // 'Greeting' on line 3 (zero-based 2), 'model Greeting {'.
    const result = server.handleRequest('textDocument/hover', {
      textDocument: { uri: mainUri() },
      position: { line: 2, character: 7 },
    }) as { contents: { value: string } } | null;
    expect(result).not.toBeNull();
    expect(result!.contents.value).toContain('model Greeting');
  });

  it('hovers an expression with its resolved type', () => {
    initialize();
    // 'greeting.message' inside greetingText (line 10 one-based -> 9).
    const result = server.handleRequest('textDocument/hover', {
      textDocument: { uri: mainUri() },
      position: { line: 9, character: 20 },
    }) as { contents: { value: string } } | null;
    expect(result).not.toBeNull();
    expect(result!.contents.value).toContain('String');
  });

  it('completes keywords, primitives, and project symbols', () => {
    initialize();
    const items = server.handleRequest('textDocument/completion', {
      textDocument: { uri: mainUri() },
      position: { line: 0, character: 0 },
    }) as { label: string }[];
    const labels = items.map((i) => i.label);
    expect(labels).toContain('model');
    expect(labels).toContain('String');
    expect(labels).toContain('Greeting');
    expect(labels).toContain('greetingText');
  });

  it('produces non-empty semantic tokens with the documented legend stride', () => {
    initialize();
    const result = server.handleRequest('textDocument/semanticTokens/full', {
      textDocument: { uri: mainUri() },
    }) as { data: number[] };
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data.length % 5).toBe(0);
    // The first token is 'module' at 0:0 — a keyword.
    expect(result.data.slice(0, 5)).toEqual([
      0,
      0,
      6,
      semanticTokenTypes.indexOf('keyword'),
      0,
    ]);
  });

  it('formats a document via whitespace normalization', () => {
    initialize();
    server.handleNotification('textDocument/didOpen', {
      textDocument: { uri: mainUri(), text: 'module app.main   \n' },
    });
    const edits = server.handleRequest('textDocument/formatting', {
      textDocument: { uri: mainUri() },
    }) as { newText: string }[];
    expect(edits.length).toBe(1);
    expect(edits[0]!.newText).toBe('module app.main\n');
  });
});

describe('clearkrypt extensions', () => {
  it('reports project info per docs/21', () => {
    initialize();
    const info = server.handleRequest('clearkrypt/projectInfo', {}) as {
      name: string;
      targets: { swift: boolean };
      sourceFiles: string[];
    };
    expect(info.name).toBe('hello-world');
    expect(info.targets.swift).toBe(true);
    expect(info.sourceFiles).toEqual(['src/main.ck']);
  });

  it('maps modules to generated files per target', () => {
    initialize();
    const map = server.handleRequest('clearkrypt/generatedMap', {}) as {
      modules: { module: string; sourceFile: string; targets: Record<string, string[]> }[];
    };
    const main = map.modules.find((m) => m.module === 'app.main');
    expect(main).toBeDefined();
    expect(main!.sourceFile).toBe('src/main.ck');
    expect(main!.targets['swift']).toContain('generated/swift/app/main/Greeting.swift');
    expect(main!.targets['react']).toContain('generated/react/app/main.ts');
  });

  it('runs a full project check on request', () => {
    initialize();
    const result = server.handleRequest('clearkrypt/check', {}) as {
      diagnostics: { uri: string; diagnostics: unknown[] }[];
    };
    expect(result.diagnostics).toEqual([]);
  });
});
