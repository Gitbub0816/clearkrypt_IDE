import { Span } from './span';

/** A single ClearKrypt source file presented to the compiler. */
export interface SourceFileInput {
  /** Project-relative path, e.g. `src/main.ck`. Used in spans and diagnostics. */
  readonly path: string;
  readonly text: string;
}

/**
 * Precomputed line-start offsets for a source text, used to convert offsets
 * into one-based line/column positions cheaply.
 */
export class LineMap {
  private readonly lineStarts: number[];

  constructor(text: string) {
    const starts = [0];
    for (let i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) === 10 /* \n */) {
        starts.push(i + 1);
      }
    }
    this.lineStarts = starts;
  }

  /** Returns the one-based line and column for a zero-based offset. */
  position(offset: number): { line: number; column: number } {
    let low = 0;
    let high = this.lineStarts.length - 1;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if ((this.lineStarts[mid] ?? 0) <= offset) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }
    return { line: low + 1, column: offset - (this.lineStarts[low] ?? 0) + 1 };
  }

  /** Builds a full span from a file path and offset range. */
  span(file: string, start: number, end: number): Span {
    const s = this.position(start);
    const e = this.position(end);
    return {
      file,
      start,
      end,
      startLine: s.line,
      startColumn: s.column,
      endLine: e.line,
      endColumn: e.column,
    };
  }
}
