import { describe, expect, it } from 'vitest';
import { FramingParser, frameMessage } from '@clearkrypt/language-service';

describe('FramingParser', () => {
  it('parses a complete framed message', () => {
    const parser = new FramingParser();
    const messages = parser.push(Buffer.from(frameMessage('{"a":1}')));
    expect(messages).toEqual(['{"a":1}']);
  });

  it('handles messages split across chunks', () => {
    const parser = new FramingParser();
    const framed = frameMessage('{"hello":"world"}');
    const first = parser.push(Buffer.from(framed.slice(0, 10)));
    expect(first).toEqual([]);
    const second = parser.push(Buffer.from(framed.slice(10)));
    expect(second).toEqual(['{"hello":"world"}']);
  });

  it('handles multiple messages in one chunk', () => {
    const parser = new FramingParser();
    const messages = parser.push(Buffer.from(frameMessage('{"a":1}') + frameMessage('{"b":2}')));
    expect(messages).toEqual(['{"a":1}', '{"b":2}']);
  });

  it('is case-insensitive about the header name', () => {
    const parser = new FramingParser();
    const body = '{"x":1}';
    const messages = parser.push(Buffer.from(`content-length: ${body.length}\r\n\r\n${body}`));
    expect(messages).toEqual([body]);
  });

  it('measures length in bytes, not characters', () => {
    const parser = new FramingParser();
    const body = '{"s":"héllo"}';
    const messages = parser.push(Buffer.from(frameMessage(body)));
    expect(messages).toEqual([body]);
  });
});
