#!/usr/bin/env node
'use strict';

/**
 * Minimal canned LSP server used by ClearKryptIDE.Core.Tests to exercise the
 * real LanguageServerClient over a real child process and real stdio pipes
 * (Content-Length framed JSON-RPC 2.0), per docs/21-language-server.md.
 *
 * Speaks just enough protocol to answer:
 *  - initialize (returns serverInfo)
 *  - initialized (notification, ignored)
 *  - textDocument/didOpen (acks with one publishDiagnostics notification)
 *  - textDocument/documentSymbol (canned hierarchical symbols)
 *  - clearkrypt/projectInfo (canned project info matching tests/fixtures/projects/hello-world)
 *  - shutdown / exit (lifecycle)
 *
 * This is a test double, not a real ClearKrypt language server.
 */

let buffer = Buffer.alloc(0);

function send(message) {
  const json = JSON.stringify(message);
  const header = `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n`;
  process.stdout.write(header + json);
}

function handleMessage(message) {
  const { id, method, params } = message;

  switch (method) {
    case 'initialize': {
      send({
        jsonrpc: '2.0',
        id,
        result: {
          capabilities: {
            textDocumentSync: 1,
            documentSymbolProvider: true,
            hoverProvider: true,
            completionProvider: {},
            documentFormattingProvider: true,
            semanticTokensProvider: {
              legend: {
                tokenTypes: [
                  'namespace', 'type', 'enum', 'enumMember', 'struct', 'parameter', 'variable', 'property',
                  'function', 'keyword', 'string', 'number', 'comment', 'operator',
                  'model', 'screen', 'component', 'route', 'capability', 'errorType', 'nativeTarget',
                ],
                tokenModifiers: ['declaration', 'defaultLibrary', 'generated', 'inferred', 'targetSpecific'],
              },
              full: true,
            },
          },
          serverInfo: { name: 'clearkrypt-fake-server', version: '0.0.0-fake' },
        },
      });
      return;
    }

    case 'initialized':
      return; // notification, no response expected

    case 'textDocument/didOpen': {
      const uri = params && params.textDocument && params.textDocument.uri;
      send({
        jsonrpc: '2.0',
        method: 'textDocument/publishDiagnostics',
        params: {
          uri,
          version: 1,
          diagnostics: [
            {
              range: { start: { line: 3, character: 2 }, end: { line: 3, character: 8 } },
              severity: 1,
              code: 'CK0003',
              source: 'clearkrypt',
              message: 'fake diagnostic from fake-server.js',
            },
          ],
        },
      });
      return;
    }

    case 'textDocument/didChange':
    case 'textDocument/didClose':
    case 'textDocument/didSave':
      return; // notifications, no response expected

    case 'textDocument/documentSymbol': {
      send({
        jsonrpc: '2.0',
        id,
        result: [
          {
            name: 'app.main',
            detail: 'module',
            kind: 2,
            range: { start: { line: 0, character: 0 }, end: { line: 15, character: 0 } },
            selectionRange: { start: { line: 0, character: 7 }, end: { line: 0, character: 15 } },
            children: [
              {
                name: 'Greeting',
                detail: 'model',
                kind: 23,
                range: { start: { line: 2, character: 0 }, end: { line: 6, character: 1 } },
                selectionRange: { start: { line: 2, character: 6 }, end: { line: 2, character: 14 } },
                children: [],
              },
            ],
          },
        ],
      });
      return;
    }

    case 'textDocument/hover': {
      send({
        jsonrpc: '2.0',
        id,
        result: {
          contents: { kind: 'markdown', value: '```clearkrypt\nmodel Greeting\n```' },
        },
      });
      return;
    }

    case 'textDocument/completion': {
      send({
        jsonrpc: '2.0',
        id,
        result: [
          { label: 'model', kind: 14, detail: 'keyword', insertText: 'model' },
          { label: 'Greeting', kind: 7, detail: 'model Greeting', insertText: 'Greeting' },
        ],
      });
      return;
    }

    case 'textDocument/formatting': {
      send({ jsonrpc: '2.0', id, result: [] });
      return;
    }

    case 'textDocument/semanticTokens/full': {
      // One token: "module" keyword at line 0, char 0, length 6, type=keyword(9), no modifiers.
      send({ jsonrpc: '2.0', id, result: { resultId: '1', data: [0, 0, 6, 9, 0] } });
      return;
    }

    case 'clearkrypt/projectInfo': {
      send({
        jsonrpc: '2.0',
        id,
        result: {
          name: 'hello-world',
          version: '0.1.0',
          targets: { swift: true, kotlin: true, react: true },
          outputDir: 'generated',
          sourceFiles: ['src/main.ck'],
        },
      });
      return;
    }

    case 'clearkrypt/check': {
      send({
        jsonrpc: '2.0',
        id,
        result: {
          diagnostics: [
            {
              uri: 'file:///src/main.ck',
              range: { start: { line: 3, character: 2 }, end: { line: 3, character: 8 } },
              severity: 1,
              code: 'CK0003',
              source: 'clearkrypt',
              message: 'fake diagnostic from clearkrypt/check',
            },
          ],
        },
      });
      return;
    }

    case 'clearkrypt/generatedMap': {
      send({
        jsonrpc: '2.0',
        id,
        result: {
          modules: [
            {
              module: 'app.main',
              sourceFile: 'src/main.ck',
              targets: {
                swift: ['generated/swift/app/main/Greeting.swift'],
                kotlin: ['generated/kotlin/app/main/Greeting.kt'],
                react: ['generated/react/app/main.ts'],
              },
            },
          ],
        },
      });
      return;
    }

    case 'shutdown': {
      send({ jsonrpc: '2.0', id, result: null });
      return;
    }

    case 'exit':
      process.exit(0);
      return;

    default:
      if (id !== undefined && id !== null) {
        send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
      }
  }
}

process.stdin.on('data', (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);

  for (;;) {
    const headerEnd = buffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) {
      return;
    }

    const header = buffer.slice(0, headerEnd).toString('ascii');
    const match = /Content-Length:\s*(\d+)/i.exec(header);
    if (!match) {
      buffer = buffer.slice(headerEnd + 4);
      continue;
    }

    const length = parseInt(match[1], 10);
    const bodyStart = headerEnd + 4;
    if (buffer.length < bodyStart + length) {
      return; // wait for the rest of the body
    }

    const body = buffer.slice(bodyStart, bodyStart + length).toString('utf8');
    buffer = buffer.slice(bodyStart + length);

    try {
      handleMessage(JSON.parse(body));
    } catch (err) {
      process.stderr.write(`fake-server: failed to handle message: ${err}\n`);
    }
  }
});

process.stdin.on('end', () => {
  process.exit(0);
});
