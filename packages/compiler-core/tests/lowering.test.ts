import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkProject, lowerProject, printIr } from '@clearkrypt/compiler-core';

const fixturesRoot = path.resolve(__dirname, '../../../tests/fixtures');

function readFixture(relative: string) {
  return {
    path: relative,
    text: fs.readFileSync(path.join(fixturesRoot, relative), 'utf8'),
  };
}

function lowerFixtures(relatives: string[]) {
  const checked = checkProject(relatives.map(readFixture));
  expect(checked.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return lowerProject(checked);
}

describe('lowerProject - IR snapshots', () => {
  it('lowers hello-world', () => {
    const result = lowerFixtures(['projects/hello-world/src/main.ck']);
    expect(printIr(result.project)).toMatchSnapshot();
  });

  it('lowers the two-modules project with cross-module references', () => {
    const result = lowerFixtures([
      'projects/two-modules/src/models.ck',
      'projects/two-modules/src/api.ck',
    ]);
    expect(printIr(result.project)).toMatchSnapshot();
  });

  it('lowers functions with expressions and control flow', () => {
    const result = lowerFixtures(['syntax/simple-function.ck']);
    expect(printIr(result.project)).toMatchSnapshot();
  });

  it('lowers async throws functions and error declarations', () => {
    const result = lowerFixtures(['syntax/async-throws.ck']);
    expect(printIr(result.project)).toMatchSnapshot();
  });

  it('lowers the power pack: match, optionals, interpolation, throw, try', () => {
    const result = lowerFixtures(['syntax/power-pack.ck']);
    expect(printIr(result.project)).toMatchSnapshot();
  });

  it('lowers nested (local) functions, including self-recursion and capture', () => {
    const result = lowerFixtures(['syntax/nested-functions.ck']);
    expect(printIr(result.project)).toMatchSnapshot();
  });

  it('lowers enums and computes isSimple', () => {
    const result = lowerFixtures(['syntax/enum-only.ck', 'syntax/enum-associated.ck']);
    const modules = result.project.modules;
    const simple = modules
      .flatMap((m) => m.declarations)
      .find((d) => d.kind === 'enum' && d.name === 'OrderStatus');
    const associated = modules
      .flatMap((m) => m.declarations)
      .find((d) => d.kind === 'enum' && d.name === 'BookingStatus');
    expect(simple && simple.kind === 'enum' && simple.isSimple).toBe(true);
    expect(associated && associated.kind === 'enum' && associated.isSimple).toBe(false);
  });
});

describe('lowerProject - structure guarantees', () => {
  it('resolves construction arguments to field names in declaration order', () => {
    const result = lowerFixtures(['projects/hello-world/src/main.ck']);
    const fn = result.project.modules[0]!.declarations.find(
      (d) => d.kind === 'function' && d.name === 'friendlyGreeting',
    );
    expect(fn?.kind).toBe('function');
    if (fn?.kind !== 'function') return;
    const ret = fn.body[0]!;
    expect(ret.kind).toBe('return');
    if (ret.kind !== 'return' || ret.value?.kind !== 'construct') {
      throw new Error('expected return of a construct expression');
    }
    expect(ret.value.args.map((a) => a.name)).toEqual(['id', 'message']);
    expect(ret.value.model).toEqual({ name: 'Greeting', module: 'app.main' });
  });

  it('marks parameter references distinctly from locals', () => {
    const result = lowerFixtures(['syntax/simple-function.ck']);
    const printed = printIr(result.project);
    expect(printed).toContain('param(count)');
    expect(printed).toContain('local(label)');
  });
});

describe('lowerProject - honest degradation', () => {
  it('reports CK0004 warnings for screens, components, and routes', () => {
    const checked = checkProject([readFixture('syntax/screen-component.ck')]);
    const result = lowerProject(checked);
    const warnings = result.diagnostics.filter((d) => d.code === 'CK0004');
    expect(warnings.length).toBe(3); // component, screen, route
    expect(warnings.every((d) => d.severity === 'warning')).toBe(true);
    // The model in the same file still lowers.
    const model = result.project.modules[0]!.declarations.find((d) => d.kind === 'model');
    expect(model?.name).toBe('User');
  });

  it('reports CK0005 for missing native implementations of selected targets', () => {
    const source = {
      path: 'src/device.ck',
      text: `module app.device

native swift fn deviceName() -> String {
  UIDevice.current.name
}
`,
    };
    const checked = checkProject([source]);
    expect(checked.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);

    const swiftOnly = lowerProject(checked, { targets: ['swift'] });
    expect(swiftOnly.diagnostics.filter((d) => d.code === 'CK0005')).toEqual([]);

    const both = lowerProject(checked, { targets: ['swift', 'kotlin'] });
    const missing = both.diagnostics.filter((d) => d.code === 'CK0005');
    expect(missing.length).toBe(1);
    expect(missing[0]!.target).toBe('kotlin');
    expect(missing[0]!.message).toContain('kotlin');
  });

  it('covers all three targets in the native fixture without CK0005', () => {
    const checked = checkProject([readFixture('syntax/native-binding.ck')]);
    const result = lowerProject(checked);
    expect(result.diagnostics.filter((d) => d.code === 'CK0005')).toEqual([]);
  });

  it('refuses to lower projects with errors', () => {
    const checked = checkProject([readFixture('semantic/invalid/type-mismatch.ck')]);
    const result = lowerProject(checked);
    expect(result.project.modules).toEqual([]);
  });
});
