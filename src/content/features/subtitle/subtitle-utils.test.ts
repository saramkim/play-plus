import { DEFAULT_V2_SYNC_STORAGE } from '@storage/v2/default';
import { describe, expect, it } from 'vitest';

import { applySubtitleStyles, createSubtitleElement } from './subtitle-utils';

describe('canonical subtitle element styles', () => {
  it('creates a passive element identified by its learning role', () => {
    const element = createSubtitleElement('learning');

    expect(element.tagName).toBe('P');
    expect(element.dataset.subtitleRole).toBe('learning');
    expect(element.style.pointerEvents).toBe('none');
    expect(element.style.display).toBe('none');
  });

  it('applies canonical role visibility and appearance', () => {
    const element = createSubtitleElement('support');
    const display = structuredClone(DEFAULT_V2_SYNC_STORAGE.subtitleDisplay.support);
    display.visibility = 'visible';
    display.appearance.positionReference = 'top';
    display.appearance.positionOffset = 12;
    display.appearance.lineBreak = true;

    applySubtitleStyles(element, display);

    expect(element.style.display).toBe('block');
    expect(element.style.top).toBe('calc(1.5em + 12px)');
    expect(element.style.bottom).toBe('auto');
    expect(element.style.whiteSpace).toBe('pre-line');
    expect(element.style.fontWeight).toBe('400');

    applySubtitleStyles(element, { ...display, visibility: 'hidden' });
    expect(element.style.display).toBe('none');
  });
});
