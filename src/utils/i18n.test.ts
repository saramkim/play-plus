/* eslint-disable @typescript-eslint/no-restricted-imports */
import { describe, expect, it } from 'vitest';

import messagesEn from '../../public/_locales/en/messages.json';
import messagesKo from '../../public/_locales/ko/messages.json';

type LocaleMessages = Record<
  string,
  { message: string; placeholders?: Record<string, { content: string }> }
>;

const en = messagesEn as LocaleMessages;
const ko = messagesKo as LocaleMessages;
const overviewKeys = [
  'v2_subtitle_overview_title',
  'v2_subtitle_overview_role_label',
  'v2_subtitle_overview_together',
  'v2_subtitle_overview_learning',
  'v2_subtitle_overview_support',
  'v2_subtitle_overview_source_coupang_play',
  'v2_subtitle_overview_change_source',
  'v2_subtitle_overview_change_source_label',
  'v2_subtitle_overview_search_label',
  'v2_subtitle_overview_count',
  'v2_subtitle_overview_time_range',
  'v2_subtitle_overview_current',
  'v2_subtitle_overview_following',
  'v2_subtitle_overview_resume_follow',
  'v2_subtitle_overview_refresh',
  'v2_subtitle_overview_loading',
  'v2_subtitle_overview_disconnected',
  'v2_subtitle_overview_no_video',
  'v2_subtitle_overview_empty_learning',
  'v2_subtitle_overview_empty_support',
  'v2_subtitle_overview_no_results',
  'v2_subtitle_overview_error',
  'v2_subtitle_overview_stale',
  'v2_subtitle_overview_seek_error',
  'v2_subtitle_overview_save_row',
  'v2_subtitle_overview_saved_row',
  'v2_subtitle_overview_saved_with_support',
  'v2_subtitle_overview_saved_learning_only',
  'v2_subtitle_overview_save_busy',
  'v2_subtitle_overview_save_stale',
  'v2_subtitle_overview_save_unavailable',
  'v2_subtitle_overview_save_error',
] as const;
const registeredPreviewKeys = [
  'v2_registered_subtitle_preview_title',
  'v2_registered_subtitle_preview_back',
  'v2_registered_subtitle_preview_search_label',
  'v2_registered_subtitle_preview_loading',
  'v2_registered_subtitle_preview_error',
  'v2_registered_subtitle_preview_unavailable',
  'v2_registered_subtitle_preview_empty',
] as const;

describe('current subtitle overview locale contract', () => {
  it('keeps the two subview labels aligned with the approved information architecture', () => {
    expect({
      en: [en.v2_subtitles_add_tab.message, en.v2_subtitles_overview_tab.message],
      ko: [ko.v2_subtitles_add_tab.message, ko.v2_subtitles_overview_tab.message],
    }).toEqual({
      en: ['Add subtitles', 'Full subtitles'],
      ko: ['자막 추가', '전체 자막'],
    });
  });

  it('provides the same complete overview key set in Korean and English', () => {
    const expected = [...overviewKeys].sort();
    expect(findOverviewKeys(en)).toEqual(expected);
    expect(findOverviewKeys(ko)).toEqual(expected);

    for (const key of overviewKeys) {
      expect(en[key]?.message.trim()).not.toBe('');
      expect(ko[key]?.message.trim()).not.toBe('');
    }
  });

  it('keeps count and time-range substitution order identical across locales', () => {
    const placeholders = {
      result: { content: '$1' },
      total: { content: '$2' },
    };
    const rangePlaceholders = {
      start: { content: '$1' },
      end: { content: '$2' },
    };

    expect(en.v2_subtitle_overview_count.placeholders).toEqual(placeholders);
    expect(ko.v2_subtitle_overview_count.placeholders).toEqual(placeholders);
    expect(en.v2_subtitle_overview_time_range.placeholders).toEqual(rangePlaceholders);
    expect(ko.v2_subtitle_overview_time_range.placeholders).toEqual(rangePlaceholders);
  });

  it('uses plain subtitle and sentence language rather than analysis or statistics terms', () => {
    const englishCopy = overviewKeys.map((key) => en[key].message).join(' ');
    const koreanCopy = overviewKeys.map((key) => ko[key].message).join(' ');

    expect(englishCopy).not.toMatch(/\b(?:analysis|analytics|statistics?|cues?)\b/i);
    expect(koreanCopy).not.toMatch(/분석|통계/);
  });

  it('keeps registered preview copy distinct from the active subtitle overview', () => {
    for (const key of registeredPreviewKeys) {
      expect(en[key]?.message.trim()).not.toBe('');
      expect(ko[key]?.message.trim()).not.toBe('');
    }

    expect(en.v2_registered_subtitle_preview_search_label.message).toBe(
      'Search this registered subtitle'
    );
    expect(ko.v2_registered_subtitle_preview_search_label.message).toBe(
      '이 등록 자막 검색'
    );
  });
});

const findOverviewKeys = (messages: LocaleMessages) =>
  Object.keys(messages)
    .filter((key) => key.startsWith('v2_subtitle_overview_'))
    .sort();
