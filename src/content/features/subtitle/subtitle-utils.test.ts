import { DEFAULT_CONFIG } from '@storage/default';
import { describe, expect, it } from 'vitest';

import { applySubtitleStyles } from './subtitle-utils';

describe('subtitle shadow styling', () => {
  it.each(['primarySubtitle', 'secondarySubtitle'] as const)('preserves the existing %s shadow by default', (key) => {
    const subtitle = document.createElement('p');
    applySubtitleStyles(subtitle, DEFAULT_CONFIG[key]);
    expect(subtitle.style.textShadow).toBe('black 2px 2px 2px');
  });

  it('can disable, strengthen, and restore shadow on the same subtitle', () => {
    const subtitle = document.createElement('p');
    const config = DEFAULT_CONFIG.primarySubtitle;
    applySubtitleStyles(subtitle, { ...config, shadowStrength: 0 });
    expect(subtitle.style.textShadow).toBe('none');
    applySubtitleStyles(subtitle, { ...config, shadowStrength: 1 });
    expect(subtitle.style.textShadow).toBe('rgba(0, 0, 0, 0.5) 2px 2px 2px');
    applySubtitleStyles(subtitle, { ...config, shadowStrength: 10 });
    expect(subtitle.style.textShadow).toContain('rgba(0, 0, 0, 1) -1px -1px 1px');
    applySubtitleStyles(subtitle, config);
    expect(subtitle.style.textShadow).toBe('black 2px 2px 2px');
  });

  it('darkens a compact outline in all eight directions without increasing blur', () => {
    const subtitle = document.createElement('p');
    let previousOpacity = 0;
    for (let strength = 3; strength <= 10; strength++) {
      applySubtitleStyles(subtitle, { ...DEFAULT_CONFIG.primarySubtitle, shadowStrength: strength });
      expect(subtitle.style.textShadow.startsWith('black 2px 2px 2px, ')).toBe(true);
      const layers = [...subtitle.style.textShadow.matchAll(/rgba\(0, 0, 0, ([\d.]+)\) (-?\d+)px (-?\d+)px (\d+)px/g)];
      expect(layers).toHaveLength(8);
      expect(layers.map((layer) => `${layer[2]},${layer[3]}`).sort()).toEqual([
        '-1,-1', '-1,0', '-1,1', '0,-1', '0,1', '1,-1', '1,0', '1,1',
      ]);
      const opacity = Number(layers[0][1]);
      for (const layer of layers) {
        expect(Number(layer[1])).toBe(opacity);
        expect(Number(layer[4])).toBe(1);
      }
      expect(opacity).toBeGreaterThan(previousOpacity);
      expect(opacity).toBeLessThanOrEqual(1);
      previousOpacity = opacity;
    }
    expect(previousOpacity).toBe(1);
  });
});
