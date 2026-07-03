import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkProject, Diagnostic } from '@clearkrypt/compiler-core';

const fixturesRoot = path.resolve(__dirname, '../../../tests/fixtures');

function readFixture(relative: string) {
  return {
    path: relative,
    text: fs.readFileSync(path.join(fixturesRoot, relative), 'utf8'),
  };
}

function errors(diagnostics: readonly Diagnostic[]): Diagnostic[] {
  return diagnostics.filter((d) => d.severity === 'error');
}

describe('checkProject - valid fixtures', () => {
  const standalone = fs
    .readdirSync(path.join(fixturesRoot, 'syntax'))
    .filter((f) => f.endsWith('.ck'))
    .map((f) => `syntax/${f}`);

  for (const fixture of standalone) {
    it(`checks ${fixture} with zero errors`, () => {
      const result = checkProject([readFixture(fixture)]);
      expect(errors(result.diagnostics)).toEqual([]);
    });
  }

  it('checks the hello-world project with zero errors', () => {
    const result = checkProject([readFixture('projects/hello-world/src/main.ck')]);
    expect(errors(result.diagnostics)).toEqual([]);
  });

  it('checks the two-modules project together with zero errors', () => {
    const result = checkProject([
      readFixture('projects/two-modules/src/models.ck'),
      readFixture('projects/two-modules/src/api.ck'),
    ]);
    expect(errors(result.diagnostics)).toEqual([]);
  });

  it('builds a semantic model with signatures', () => {
    const result = checkProject([readFixture('projects/hello-world/src/main.ck')]);
    const module = result.semanticModel.modules.find((m) => m.name === 'app.main');
    expect(module).toBeDefined();
    const signatures = module!.symbols.map((s) => s.signature).sort();
    expect(signatures).toEqual([
      'fn friendlyGreeting(message: String) -> Greeting',
      'fn greetingText(greeting: Greeting) -> String',
      'model Greeting',
    ]);
  });
});

describe('checkProject - invalid fixtures', () => {
  const cases: { fixture: string; code: string; line: number }[] = [
    { fixture: 'semantic/invalid/unknown-symbol.ck', code: 'CK0001', line: 4 },
    { fixture: 'semantic/invalid/invalid-type.ck', code: 'CK0008', line: 4 },
    { fixture: 'semantic/invalid/duplicate-declaration.ck', code: 'CK0002', line: 7 },
    { fixture: 'semantic/invalid/missing-return.ck', code: 'CK0007', line: 3 },
    { fixture: 'semantic/invalid/wrong-argument-count.ck', code: 'CK0009', line: 8 },
    { fixture: 'semantic/invalid/type-mismatch.ck', code: 'CK0003', line: 4 },
    { fixture: 'semantic/invalid/non-exhaustive-match.ck', code: 'CK0014', line: 10 },
    { fixture: 'semantic/invalid/coalesce-non-optional.ck', code: 'CK0003', line: 4 },
    { fixture: 'semantic/invalid/missing-try.ck', code: 'CK0017', line: 12 },
    { fixture: 'semantic/invalid/throw-outside-throws.ck', code: 'CK0016', line: 8 },
  ];

  for (const c of cases) {
    it(`${c.fixture} reports ${c.code} on line ${c.line}`, () => {
      const result = checkProject([readFixture(c.fixture)]);
      const found = errors(result.diagnostics);
      expect(found.length).toBeGreaterThan(0);
      const match = found.find((d) => d.code === c.code && d.span.startLine === c.line);
      expect(
        match,
        `expected ${c.code} at line ${c.line}, got: ` +
          found.map((d) => `${d.code}@${d.span.startLine}: ${d.message}`).join(' | '),
      ).toBeDefined();
    });
  }

  it('type mismatch messages name both types', () => {
    const result = checkProject([readFixture('semantic/invalid/type-mismatch.ck')]);
    const mismatch = errors(result.diagnostics).find((d) => d.code === 'CK0003');
    expect(mismatch!.message).toContain("'Int'");
    expect(mismatch!.message).toContain("'String'");
  });
});
