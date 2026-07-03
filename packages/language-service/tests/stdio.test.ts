import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FramingParser, frameMessage } from '@clearkrypt/language-service';

/**
 * True end-to-end test: spawns the real CLI binary, speaks framed JSON-RPC
 * over stdio exactly as the Windows and macOS IDEs do, and asserts the
 * initialize handshake and pushed diagnostics.
 */

const repoRoot = path.resolve(__dirname, '../../..');
const cliBin = path.join(repoRoot, 'packages/cli/bin/clearkrypt.js');
const fixturesRoot = path.join(repoRoot, 'tests/fixtures');

let projectRoot: string;

beforeEach(() => {
  projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'clearkrypt-stdio-'));
  fs.cpSync(path.join(fixturesRoot, 'projects', 'hello-world'), projectRoot, { recursive: true });
});

afterEach(() => {
  fs.rmSync(projectRoot, { recursive: true, force: true });
});

describe('clearkrypt language-server --stdio', () => {
  it('handshakes, pushes diagnostics, and exits cleanly', async () => {
    const child = spawn('node', [cliBin, 'language-server', '--stdio'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const parser = new FramingParser();
    const messages: { id?: number; method?: string; params?: unknown; result?: unknown }[] = [];
    const waiters: (() => void)[] = [];

    child.stdout.on('data', (chunk: Buffer) => {
      for (const json of parser.push(chunk)) {
        messages.push(JSON.parse(json));
      }
      for (const wake of waiters.splice(0)) wake();
    });

    function send(message: unknown): void {
      child.stdin.write(frameMessage(JSON.stringify(message)));
    }

    async function waitFor<T>(predicate: () => T | undefined, what: string): Promise<T> {
      const deadline = Date.now() + 10_000;
      for (;;) {
        const found = predicate();
        if (found !== undefined) return found;
        if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
        await new Promise<void>((resolve) => {
          waiters.push(resolve);
          setTimeout(resolve, 100);
        });
      }
    }

    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { rootPath: projectRoot } });
    const init = await waitFor(
      () => messages.find((m) => m.id === 1),
      'initialize response',
    );
    const initResult = init.result as { serverInfo: { name: string } };
    expect(initResult.serverInfo.name).toBe('clearkrypt-language-server');

    send({ jsonrpc: '2.0', method: 'initialized', params: {} });
    const uri = 'file://' + path.join(projectRoot, 'src/main.ck').split(path.sep).join('/');
    send({
      jsonrpc: '2.0',
      method: 'textDocument/didOpen',
      params: {
        textDocument: {
          uri,
          languageId: 'clearkrypt',
          version: 1,
          text: 'module app.main\n\nfn f() -> String {\n  return 42\n}\n',
        },
      },
    });
    const publish = await waitFor(
      () =>
        messages.find(
          (m) =>
            m.method === 'textDocument/publishDiagnostics' &&
            (m.params as { diagnostics: { code: string }[] }).diagnostics.some(
              (d) => d.code === 'CK0003',
            ),
        ),
      'publishDiagnostics with CK0003',
    );
    expect(publish).toBeDefined();

    send({ jsonrpc: '2.0', id: 2, method: 'shutdown' });
    await waitFor(() => messages.find((m) => m.id === 2), 'shutdown response');
    send({ jsonrpc: '2.0', method: 'exit' });

    const exitCode = await new Promise<number | null>((resolve) => {
      child.on('exit', (code) => resolve(code));
      setTimeout(() => {
        child.kill();
        resolve(null);
      }, 5_000);
    });
    expect(exitCode).toBe(0);
  }, 20_000);
});
