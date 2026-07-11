import { readFile } from 'node:fs/promises';

// @ts-expect-error Tailwind's PostCSS plugin does not expose TypeScript declarations for direct imports.
import tailwindcss from '@tailwindcss/postcss';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

describe('content stylesheet isolation', () => {
  it('does not emit the global static positioning utility', async () => {
    const source = await readFile('src/content/content.css', 'utf8');
    const result = await postcss([tailwindcss()]).process(source, { from: 'src/content/content.css' });

    expect(result.css).not.toMatch(/\.static\s*{[^}]*position:\s*static\s*!important;/s);
  });
});
