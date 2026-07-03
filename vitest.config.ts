import * as path from 'node:path';
import { defineConfig } from 'vitest/config';

const pkg = (name: string) => path.resolve(__dirname, 'packages', name, 'src', 'index.ts');

export default defineConfig({
  resolve: {
    alias: {
      '@clearkrypt/compiler-core': pkg('compiler-core'),
      '@clearkrypt/emitter-swift': pkg('emitter-swift'),
      '@clearkrypt/emitter-kotlin': pkg('emitter-kotlin'),
      '@clearkrypt/emitter-react': pkg('emitter-react'),
      '@clearkrypt/formatter': pkg('formatter'),
      clearkrypt: pkg('cli'),
      '@clearkrypt/language-service': pkg('language-service'),
    },
  },
  test: {
    include: ['packages/*/tests/**/*.test.ts'],
    watch: false,
  },
});
