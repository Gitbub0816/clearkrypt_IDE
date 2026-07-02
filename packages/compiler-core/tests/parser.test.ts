import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSource, printAst } from '@clearkrypt/compiler-core';

// tests/fixtures lives at the repo root; this file lives at
// packages/compiler-core/tests, so it takes three '..' hops to get back to
// the repo root.
const fixturesRoot = path.resolve(__dirname, '../../../tests/fixtures');

function ckFilesIn(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ck'))
    .map((entry) => path.join(dir, entry.name))
    .sort();
}

const syntaxFixtures = ckFilesIn(path.join(fixturesRoot, 'syntax'));

const projectsDir = path.join(fixturesRoot, 'projects');
const projectFixtures = fs.existsSync(projectsDir)
  ? fs
      .readdirSync(projectsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((entry) => ckFilesIn(path.join(projectsDir, entry.name, 'src')))
  : [];

const validFixtures = [...syntaxFixtures, ...projectFixtures];

describe('parseSource - valid fixtures', () => {
  it('found at least one fixture in each location (sanity check for the path resolution)', () => {
    expect(syntaxFixtures.length).toBeGreaterThan(0);
    expect(projectFixtures.length).toBeGreaterThan(0);
  });

  for (const filePath of validFixtures) {
    const relPath = path.relative(fixturesRoot, filePath).split(path.sep).join('/');
    it(`parses ${relPath} with zero diagnostics`, () => {
      const text = fs.readFileSync(filePath, 'utf8');
      const result = parseSource({ path: relPath, text });
      expect(result.diagnostics).toEqual([]);
      expect(printAst(result.file)).toMatchSnapshot();
    });
  }
});

describe('parseSource - robustness', () => {
  it('never throws on truncated prefixes of every valid fixture', () => {
    for (const filePath of validFixtures) {
      const text = fs.readFileSync(filePath, 'utf8');
      for (let end = 0; end <= text.length; end += 10) {
        expect(() => parseSource({ path: filePath, text: text.slice(0, end) })).not.toThrow();
      }
      // Also check the exact full length in case it isn't a multiple of 10.
      expect(() => parseSource({ path: filePath, text })).not.toThrow();
    }
  });

  it('never throws on empty or whitespace-only input', () => {
    expect(() => parseSource({ path: 't.ck', text: '' })).not.toThrow();
    expect(() => parseSource({ path: 't.ck', text: '   \n\n\t ' })).not.toThrow();
  });

  it('never throws on a file made only of garbage tokens', () => {
    expect(() => parseSource({ path: 't.ck', text: '@@@ &&& ||| ??? {{{ )))' })).not.toThrow();
  });
});
