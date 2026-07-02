import { describe, expect, it } from 'vitest';
import { EmitResult, irSamples } from '@clearkrypt/compiler-core';
import { emitSwift } from '@clearkrypt/emitter-swift';

function format(result: EmitResult): string {
  return result.files
    .map((f) => `==== ${f.path} (module: ${f.sourceModule}) ====\n${f.contents}`)
    .join('\n');
}

describe('emitSwift snapshots', () => {
  it('hello world module', () => {
    const result = emitSwift(irSamples.sampleHelloWorldModule(), { compilerVersion: '0.1.0' });
    expect(result.diagnostics).toEqual([]);
    expect(format(result)).toMatchSnapshot();
  });

  it('types project (kitchen sink model, enums, error)', () => {
    const result = emitSwift(irSamples.sampleTypesProject(), { compilerVersion: '0.1.0' });
    expect(result.diagnostics).toEqual([]);
    expect(format(result)).toMatchSnapshot();
  });

  it('functions module (expressions, if/else, let)', () => {
    const result = emitSwift(irSamples.sampleFunctionsModule(), { compilerVersion: '0.1.0' });
    expect(result.diagnostics).toEqual([]);
    expect(format(result)).toMatchSnapshot();
  });

  it('async module (async throws function)', () => {
    const result = emitSwift(irSamples.sampleAsyncModule(), { compilerVersion: '0.1.0' });
    expect(result.diagnostics).toEqual([]);
    expect(format(result)).toMatchSnapshot();
  });

  it('cross module project', () => {
    const result = emitSwift(irSamples.sampleCrossModuleProject(), { compilerVersion: '0.1.0' });
    expect(result.diagnostics).toEqual([]);
    expect(format(result)).toMatchSnapshot();
  });
});
