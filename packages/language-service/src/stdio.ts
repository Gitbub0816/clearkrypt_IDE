import { FramingParser, frameMessage } from './framing';
import { ClearKryptLanguageServer, MethodNotFound } from './server';

/**
 * Runs the language server over stdin/stdout (the transport both first-party
 * IDEs use, per docs/21). Resolves with the process exit code when the
 * client sends `exit`.
 */
export function runStdioServer(
  input: NodeJS.ReadableStream = process.stdin,
  output: NodeJS.WritableStream = process.stdout,
): Promise<number> {
  return new Promise((resolve) => {
    const server = new ClearKryptLanguageServer((params) => {
      send({ jsonrpc: '2.0', method: 'textDocument/publishDiagnostics', params });
    });
    const parser = new FramingParser();

    function send(message: unknown): void {
      output.write(frameMessage(JSON.stringify(message)));
    }

    input.on('data', (chunk: Buffer) => {
      for (const json of parser.push(chunk)) {
        let message: { id?: number | string; method?: string; params?: unknown };
        try {
          message = JSON.parse(json) as typeof message;
        } catch {
          continue; // Malformed JSON: nothing useful to answer.
        }
        if (message.method === 'exit') {
          resolve(server.receivedShutdown ? 0 : 1);
          return;
        }
        if (message.method === undefined) continue;

        if (message.id === undefined) {
          try {
            server.handleNotification(message.method, message.params);
          } catch {
            // Notifications have no reply channel; swallow and keep serving.
          }
          continue;
        }
        try {
          const result = server.handleRequest(message.method, message.params);
          send({ jsonrpc: '2.0', id: message.id, result: result ?? null });
        } catch (error) {
          const notFound = error instanceof MethodNotFound;
          send({
            jsonrpc: '2.0',
            id: message.id,
            error: {
              code: notFound ? -32601 : -32603,
              message: error instanceof Error ? error.message : String(error),
            },
          });
        }
      }
    });
    input.on('end', () => resolve(server.receivedShutdown ? 0 : 1));
  });
}
