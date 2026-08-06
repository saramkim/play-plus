import { createElement } from 'react';

import { OpenSubtitlesCandidate } from '@utils/opensubtitles/type';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OpenSubtitlesResultCard } from './open-subtitles-result-card';

const renderCard = (candidate: OpenSubtitlesCandidate) => {
  document.body.innerHTML = renderToStaticMarkup(
    createElement(OpenSubtitlesResultCard, {
      candidate,
      disabled: false,
      adding: false,
      onAdd: vi.fn(),
    })
  );
  return document.querySelector('[data-online-subtitle-result]') as HTMLElement;
};

beforeEach(() => {
  vi.mocked(chrome.i18n.getMessage).mockImplementation((key, substitutions) => {
    const values = Array.isArray(substitutions) ? substitutions : substitutions ? [substitutions] : [];
    return values.length > 0 ? `${key}:${values.join('|')}` : key;
  });
});

describe('OpenSubtitlesResultCard', () => {
  it('prioritizes compatibility, conditional traits, and provider signals', () => {
    const card = renderCard({
      fileId: 11,
      fileName: 'original-file-name.srt',
      language: 'en',
      featureTitle: 'Example Episode',
      featureYear: 2026,
      seasonNumber: 2,
      episodeNumber: 3,
      release: 'Example.S02E03.1080p.WEB-DL',
      fps: 23.976,
      discNumber: 1,
      discCount: 2,
      autoTranslated: true,
      hearingImpaired: true,
      foreignPartsOnly: true,
      fromTrusted: true,
      rating: 4.5,
      votes: 12,
      downloadCount: 1234,
      uploaderRank: 'Trusted member',
      uploadDate: '2026-07-31T12:34:56Z',
    });

    expect(card.querySelector('h3')?.textContent).toBe('Example.S02E03.1080p.WEB-DL');
    expect(card.textContent).toContain('Example Episode · 2026 · S02 · E03');
    expect(card.textContent).toContain('23.976 FPS · result_disc:1|2');
    expect(card.textContent).toContain('result_auto_translated');
    expect(card.textContent).toContain('result_hearing_impaired');
    expect(card.textContent).toContain('result_foreign_parts_only');
    expect(card.textContent).toContain('result_rating:4.5|12');
    expect(card.textContent).toContain('result_downloads:1,234');
    expect(card.textContent).toContain('Trusted member');
    expect(card.textContent).toContain('2026-07-31');

    const trustedSource = card.querySelector('[aria-label^="result_trusted_source."]');
    expect(trustedSource?.getAttribute('aria-label')).toContain('result_trusted_source_description');
    expect(card.querySelector('details')?.hasAttribute('open')).toBe(false);
  });

  it('falls back to the file name and omits absent or zero-value signals', () => {
    const card = renderCard({
      fileId: 12,
      fileName: 'fallback.srt',
      language: 'ko',
      featureTitle: '',
      fps: 0,
      rating: 0,
      votes: 0,
      downloadCount: 0,
    });

    expect(card.querySelector('h3')?.textContent).toBe('fallback.srt');
    expect(card.textContent).not.toContain('result_characteristics');
    expect(card.textContent).not.toContain('result_trusted_source');
    expect(card.textContent).not.toContain('result_rating');
    expect(card.textContent).not.toContain('result_downloads');
    expect(card.textContent).toContain('result_file_namefallback.srt');
  });
});
