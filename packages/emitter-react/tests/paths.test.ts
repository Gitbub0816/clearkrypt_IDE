import { describe, expect, it } from 'vitest';
import { relativeImportSpecifier } from '../src/paths';

describe('relativeImportSpecifier', () => {
  it('computes a sibling-module import as ./name', () => {
    expect(relativeImportSpecifier('app.api', 'app.models')).toBe('./models');
  });

  it('computes the support file import from a nested module as ../clearkrypt', () => {
    expect(relativeImportSpecifier('app.main', 'clearkrypt')).toBe('../clearkrypt');
  });

  it('computes an import across sibling nested modules', () => {
    expect(relativeImportSpecifier('app.sub.feature', 'app.sub.other')).toBe('./other');
  });

  it('computes an import up and across module trees', () => {
    expect(relativeImportSpecifier('app.sub.feature', 'app.models')).toBe('../models');
  });
});
