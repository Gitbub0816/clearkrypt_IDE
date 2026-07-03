import { describe, expect, it } from 'vitest';
import { checkProject, Diagnostic } from '@clearkrypt/compiler-core';

function check(text: string, path = 'src/test.ck') {
  return checkProject([{ path, text }]);
}

function errors(diagnostics: readonly Diagnostic[]): Diagnostic[] {
  return diagnostics.filter((d) => d.severity === 'error');
}

function errorCodes(diagnostics: readonly Diagnostic[]): string[] {
  return errors(diagnostics).map((d) => d.code);
}

describe('assignability', () => {
  it('accepts String literals for ID, Email, and URL fields', () => {
    const result = check(`module m

model User {
  id: ID
  email: Email
}

fn make() -> User {
  return User(id: "u1", email: "a@b.c")
}
`);
    expect(errors(result.diagnostics)).toEqual([]);
  });

  it('accepts T where T? is expected, and null only for optionals', () => {
    const good = check(`module m

fn f(a: String?) -> String {
  return "x"
}

fn g() -> String {
  let r = f(a: null)
  return f(a: "value")
}
`);
    expect(errors(good.diagnostics)).toEqual([]);

    const bad = check(`module m

fn f(a: String) -> String {
  return a
}

fn g() -> String {
  return f(a: null)
}
`);
    expect(errorCodes(bad.diagnostics)).toEqual(['CK0003']);
  });

  it('rejects let bindings initialized from bare null without annotation', () => {
    const result = check(`module m

fn f() -> String {
  let x = null
  return "y"
}
`);
    expect(errorCodes(result.diagnostics)).toEqual(['CK0003']);
  });
});

describe('calls and construction', () => {
  it('rejects positional arguments after named arguments', () => {
    const result = check(`module m

fn add(a: Int, b: Int) -> Int {
  return a + b
}

fn use() -> Int {
  return add(a: 1, 2)
}
`);
    expect(errorCodes(result.diagnostics)).toContain('CK0011');
  });

  it('rejects unknown argument names with the parameter list in the message', () => {
    const result = check(`module m

fn add(a: Int, b: Int) -> Int {
  return a + b
}

fn use() -> Int {
  return add(a: 1, c: 2)
}
`);
    const diag = errors(result.diagnostics).find((d) => d.code === 'CK0011');
    expect(diag!.message).toContain("'a', 'b'");
  });

  it('requires named arguments for model construction', () => {
    const result = check(`module m

model P {
  x: Int
}

fn make() -> P {
  return P(1)
}
`);
    expect(errorCodes(result.diagnostics)).toContain('CK0011');
  });

  it('allows omitting fields with defaults, reports the rest', () => {
    const result = check(`module m

model P {
  x: Int
  y: Int
  flagged: Bool = true
}

fn make() -> P {
  return P(x: 1)
}
`);
    const diag = errors(result.diagnostics).find((d) => d.code === 'CK0009');
    expect(diag).toBeDefined();
    expect(diag!.message).toContain("'y'");
    expect(diag!.message).not.toContain("'flagged'");
  });

  it('resolves calls to functions declared later in the file', () => {
    const result = check(`module m

fn caller() -> Int {
  return callee()
}

fn callee() -> Int {
  return 1
}
`);
    expect(errors(result.diagnostics)).toEqual([]);
  });
});

describe('imports', () => {
  it('distinguishes unknown module from unknown symbol', () => {
    const models = { path: 'src/models.ck', text: 'module app.models\n\nmodel User {\n  id: ID\n}\n' };

    const badModule = checkProject([
      models,
      { path: 'src/a.ck', text: 'module app.a\n\nimport app.missing.User\n' },
    ]);
    const moduleDiag = errors(badModule.diagnostics).find((d) => d.code === 'CK0010');
    expect(moduleDiag!.message).toContain("module 'app.missing'");

    const badSymbol = checkProject([
      models,
      { path: 'src/b.ck', text: 'module app.b\n\nimport app.models.Account\n' },
    ]);
    const symbolDiag = errors(badSymbol.diagnostics).find((d) => d.code === 'CK0010');
    expect(symbolDiag!.message).toContain("no declaration named 'Account'");
  });

  it('suggests an import when a type exists in another module', () => {
    const result = checkProject([
      { path: 'src/models.ck', text: 'module app.models\n\nmodel User {\n  id: ID\n}\n' },
      { path: 'src/a.ck', text: 'module app.a\n\nmodel Holder {\n  user: User\n}\n' },
    ]);
    const diag = errors(result.diagnostics).find((d) => d.code === 'CK0008');
    expect(diag!.message).toContain("import app.models.User");
  });
});

describe('definite return analysis', () => {
  it('accepts if/else where both branches return', () => {
    const result = check(`module m

fn larger(a: Int, b: Int) -> Int {
  if a > b {
    return a
  } else {
    return b
  }
}
`);
    expect(errors(result.diagnostics)).toEqual([]);
  });

  it('reports CK0007 when only the then-branch returns', () => {
    const result = check(`module m

fn f(a: Int) -> Int {
  if a > 0 {
    return a
  }
}
`);
    expect(errorCodes(result.diagnostics)).toEqual(['CK0007']);
  });
});

describe('routes', () => {
  it('reports CK0006 for a path parameter without a binding', () => {
    const result = check(`module m

screen S(id: ID) {
  Text("hello")
}

route /items/:id -> S
`);
    expect(errorCodes(result.diagnostics)).toContain('CK0006');
  });

  it('reports CK0006 for a binding without a path parameter', () => {
    const result = check(`module m

screen S(id: ID) {
  Text("hello")
}

route /items -> S(id: ID)
`);
    expect(errorCodes(result.diagnostics)).toContain('CK0006');
  });
});

describe('modules and cascade suppression', () => {
  it('reports CK0013 for files with declarations but no module', () => {
    const result = check('model User {\n  id: ID\n}\n');
    expect(errorCodes(result.diagnostics)).toContain('CK0013');
  });

  it('reports CK0012 when two files declare the same module', () => {
    const result = checkProject([
      { path: 'src/a.ck', text: 'module app.m\n' },
      { path: 'src/b.ck', text: 'module app.m\n' },
    ]);
    expect(errorCodes(result.diagnostics)).toContain('CK0012');
  });

  it('produces exactly one diagnostic for one bad subexpression', () => {
    const result = check(`module m

fn f() -> Int {
  return unknownName + 1
}
`);
    expect(errorCodes(result.diagnostics)).toEqual(['CK0001']);
  });
});
