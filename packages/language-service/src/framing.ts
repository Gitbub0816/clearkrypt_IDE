/**
 * LSP base-protocol framing: JSON-RPC messages prefixed with
 * `Content-Length: N\r\n\r\n`. The parser is a stateful buffer that
 * tolerates partial chunks and multiple messages per chunk — both happen
 * routinely on process pipes.
 */

export function frameMessage(json: string): string {
  const body = Buffer.from(json, 'utf8');
  return `Content-Length: ${body.length}\r\n\r\n${json}`;
}

export class FramingParser {
  private buffer = Buffer.alloc(0);

  /** Feeds raw bytes; returns every complete JSON payload now available. */
  push(chunk: Buffer): string[] {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const messages: string[] = [];
    for (;;) {
      const headerEnd = this.buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) break;
      const header = this.buffer.subarray(0, headerEnd).toString('utf8');
      const match = /content-length:\s*(\d+)/i.exec(header);
      if (!match) {
        // Unrecoverable garbage before the header; drop through it.
        this.buffer = this.buffer.subarray(headerEnd + 4);
        continue;
      }
      const length = Number(match[1]);
      const bodyStart = headerEnd + 4;
      if (this.buffer.length < bodyStart + length) break;
      messages.push(this.buffer.subarray(bodyStart, bodyStart + length).toString('utf8'));
      this.buffer = this.buffer.subarray(bodyStart + length);
    }
    return messages;
  }
}
