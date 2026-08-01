import { addRegisteredSubtitle } from '@storage/registered-subtitle';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  isSupportedSubtitleFileName,
  registerSubtitleText,
  SubtitleRegistrationError,
  subtitleTitleFromFileName,
} from './subtitle-registration';

vi.mock('@storage/registered-subtitle', () => ({
  addRegisteredSubtitle: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('subtitle registration', () => {
  it('parses a supported filename and stores a non-empty subtitle', async () => {
    vi.mocked(addRegisteredSubtitle).mockResolvedValue({
      id: 'subtitle-00000000-0000-4000-8000-000000000001',
      title: 'The Matrix',
      language: 'en',
      savedAt: '2026-08-01T00:00:00.000Z',
    });

    await registerSubtitleText({
      fileName: 'matrix.release.SRT',
      title: ' The Matrix ',
      language: 'en',
      text: '1\n00:00:01,000 --> 00:00:02,000\nHello\n',
    });

    expect(addRegisteredSubtitle).toHaveBeenCalledWith({
      title: 'The Matrix',
      language: 'en',
      body: [{ start: 1, end: 2, text: 'Hello' }],
    });
  });

  it('rejects an unsupported filename before storage', async () => {
    await expect(
      registerSubtitleText({ fileName: 'subtitle.txt', title: 'Subtitle', language: 'en', text: 'Hello' })
    ).rejects.toMatchObject({ code: 'unsupported-file-type' } satisfies Partial<SubtitleRegistrationError>);

    expect(addRegisteredSubtitle).not.toHaveBeenCalled();
  });

  it('rejects a supported file without usable cues before storage', async () => {
    await expect(
      registerSubtitleText({ fileName: 'empty.vtt', title: 'Empty', language: 'en', text: 'WEBVTT\n\n' })
    ).rejects.toMatchObject({ code: 'empty-subtitle' } satisfies Partial<SubtitleRegistrationError>);

    expect(addRegisteredSubtitle).not.toHaveBeenCalled();
  });

  it('recognizes supported filenames and derives their titles case-insensitively', () => {
    expect(isSupportedSubtitleFileName('Movie.SMI')).toBe(true);
    expect(isSupportedSubtitleFileName('Movie.ass')).toBe(false);
    expect(subtitleTitleFromFileName('Movie.Release.VTT')).toBe('Movie.Release');
  });
});
