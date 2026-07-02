import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSource } from '@clearkrypt/compiler-core';

const fixturesRoot = path.resolve(__dirname, '../../../tests/fixtures');
const invalidDir = path.join(fixturesRoot, 'syntax', 'invalid');

function read(name: string): string {
  return fs.readFileSync(path.join(invalidDir, name), 'utf8');
}

describe('parseSource - invalid fixtures', () => {
  it('missing-colon.ck: reports CK1001 on line 4 (`id ID`)', () => {
    const result = parseSource({ path: 'missing-colon.ck', text: read('missing-colon.ck') });
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.code).toBe('CK1001');
    expect(result.diagnostics[0]?.span.startLine).toBe(4);

    // Recovery still produces a usable model with a field named `id`.
    const model = result.file.declarations.find((d) => d.kind === 'ModelDecl');
    expect(model).toBeDefined();
    if (model?.kind === 'ModelDecl') {
      expect(model.fields).toHaveLength(1);
      expect(model.fields[0]?.name.text).toBe('id');
    }
  });

  it('bad-declaration.ck: reports CK1004 on line 3', () => {
    const result = parseSource({ path: 'bad-declaration.ck', text: read('bad-declaration.ck') });
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.code).toBe('CK1004');
    expect(result.diagnostics[0]?.span.startLine).toBe(3);
  });

  it('unterminated-string.ck: reports CK1002', () => {
    const result = parseSource({ path: 'unterminated-string.ck', text: read('unterminated-string.ck') });
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.code).toBe('CK1002');
  });
});

describe('parseSource - error recovery', () => {
  it('recovers from one bad top-level declaration and still parses a valid model that follows', () => {
    const text = [
      'module app.bad',
      '',
      'banana Oops {',
      '}',
      '',
      'model User {',
      '  id: ID',
      '  name: String',
      '}',
      '',
    ].join('\n');
    const result = parseSource({ path: 't.ck', text });

    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.code).toBe('CK1004');

    expect(result.file.declarations).toHaveLength(1);
    const model = result.file.declarations[0];
    expect(model?.kind).toBe('ModelDecl');
    if (model?.kind === 'ModelDecl') {
      expect(model.name.text).toBe('User');
      expect(model.fields.map((f) => f.name.text)).toEqual(['id', 'name']);
    }
  });

  it('reports a reserved future keyword with CK1001 and recovers', () => {
    const text = ['for x in y {', '}', '', 'model User {', '}', ''].join('\n');
    const result = parseSource({ path: 't.ck', text });
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.code).toBe('CK1001');
    expect(result.diagnostics[0]?.message).toContain('reserved');

    const model = result.file.declarations.find((d) => d.kind === 'ModelDecl');
    expect(model).toBeDefined();
  });
});

describe('parseSource - duplicate module (CK0012)', () => {
  it('keeps the first module declaration and flags the second', () => {
    const text = ['module app.one', '', 'module app.two', '', 'model User {', '}', ''].join('\n');
    const result = parseSource({ path: 't.ck', text });

    const duplicateDiagnostics = result.diagnostics.filter((d) => d.code === 'CK0012');
    expect(duplicateDiagnostics).toHaveLength(1);
    expect(duplicateDiagnostics[0]?.span.startLine).toBe(3);
    expect(result.file.module?.name).toBe('app.one');
  });
});

describe('parseSource - bare return rule', () => {
  it('treats `return` as bare when the next token is on a later line', () => {
    const text = ['fn f() {', '  return', '  1', '}', ''].join('\n');
    const result = parseSource({ path: 't.ck', text });
    expect(result.diagnostics).toEqual([]);

    const fn = result.file.declarations[0];
    expect(fn?.kind).toBe('FunctionDecl');
    if (fn?.kind === 'FunctionDecl') {
      const [returnStmt, exprStmt] = fn.body.statements;
      expect(returnStmt?.kind).toBe('ReturnStatement');
      if (returnStmt?.kind === 'ReturnStatement') {
        expect(returnStmt.value).toBeUndefined();
      }
      expect(exprStmt?.kind).toBe('ExpressionStatement');
    }
  });

  it('parses the expression when it is on the same line as `return`', () => {
    const text = ['fn f() -> Int {', '  return 1 + 2', '}', ''].join('\n');
    const result = parseSource({ path: 't.ck', text });
    expect(result.diagnostics).toEqual([]);

    const fn = result.file.declarations[0];
    expect(fn?.kind).toBe('FunctionDecl');
    if (fn?.kind === 'FunctionDecl') {
      const [returnStmt] = fn.body.statements;
      expect(returnStmt?.kind).toBe('ReturnStatement');
      if (returnStmt?.kind === 'ReturnStatement') {
        expect(returnStmt.value?.kind).toBe('Binary');
      }
    }
  });

  it('treats a bare `return` at the end of a block as having no value', () => {
    const text = ['fn f() {', '  return', '}', ''].join('\n');
    const result = parseSource({ path: 't.ck', text });
    expect(result.diagnostics).toEqual([]);
    const fn = result.file.declarations[0];
    if (fn?.kind === 'FunctionDecl') {
      const [returnStmt] = fn.body.statements;
      if (returnStmt?.kind === 'ReturnStatement') {
        expect(returnStmt.value).toBeUndefined();
      }
    }
  });
});
