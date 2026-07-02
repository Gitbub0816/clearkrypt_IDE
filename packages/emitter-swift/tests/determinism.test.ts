import { describe, expect, it } from 'vitest';
import { irSamples } from '@clearkrypt/compiler-core';
import { emitSwift } from '@clearkrypt/emitter-swift';

describe('emitSwift determinism', () => {
  it('produces byte-identical output across repeated emits of the same project', () => {
    const project = irSamples.sampleTypesProject();
    const first = emitSwift(project, { compilerVersion: '0.1.0' });
    const second = emitSwift(project, { compilerVersion: '0.1.0' });
    expect(second.files).toEqual(first.files);
    expect(second.diagnostics).toEqual(first.diagnostics);
  });

  it('never emits trailing whitespace and always ends with exactly one newline', () => {
    const project = irSamples.sampleHelloWorldModule();
    const result = emitSwift(project, { compilerVersion: '0.1.0' });
    for (const file of result.files) {
      expect(file.contents.endsWith('\n')).toBe(true);
      expect(file.contents.endsWith('\n\n')).toBe(false);
      for (const line of file.contents.split('\n')) {
        expect(line).toBe(line.replace(/[ \t]+$/u, ''));
      }
    }
  });

  it('sorts generated files by path', () => {
    const project = irSamples.sampleCrossModuleProject();
    const result = emitSwift(project, { compilerVersion: '0.1.0' });
    const paths = result.files.map((f) => f.path);
    const sorted = [...paths].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    expect(paths).toEqual(sorted);
  });
});
