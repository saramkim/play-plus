import { describe, expect, it } from 'vitest';

import { DEFAULT_CONFIG } from './default';
import { shortcutSchema, subtitleConfigSchema } from './schema';

describe('subtitleConfigSchema', () => {
  it.each([1, 10])('accepts font size %s', (fontSize) => {
    expect(subtitleConfigSchema.safeParse({ ...DEFAULT_CONFIG.primarySubtitle, fontSize }).success).toBe(true);
  });

  it.each([0, 11])('rejects font size %s', (fontSize) => {
    expect(subtitleConfigSchema.safeParse({ ...DEFAULT_CONFIG.primarySubtitle, fontSize }).success).toBe(false);
  });

  it.each([0, 100])('accepts background opacity %s', (backgroundOpacity) => {
    expect(subtitleConfigSchema.safeParse({ ...DEFAULT_CONFIG.primarySubtitle, backgroundOpacity }).success).toBe(
      true
    );
  });
});

describe('shortcutSchema', () => {
  it.each(['ArrowUp', 'ArrowDown', 'Enter', 'Space', 'Escape', 'KeyF', 'KeyM'])(
    'rejects reserved shortcut %s',
    (shortcut) => {
      expect(shortcutSchema.safeParse(shortcut).success).toBe(false);
    }
  );
});
