/* eslint-disable @typescript-eslint/no-restricted-imports */
import { describe, expect, it } from 'vitest';

import messagesEn from '../../../../public/_locales/en/messages.json';
import messagesKo from '../../../../public/_locales/ko/messages.json';

type LocaleMessage = {
  message: string;
  placeholders?: Record<string, { content: string }>;
};

type LocaleMessages = Record<string, LocaleMessage>;

const en = messagesEn as LocaleMessages;
const ko = messagesKo as LocaleMessages;
const PREFIX = 'v2_listening_mission_';

describe('Listening Mission locale contract', () => {
  it('ships the same complete, non-empty contract in English and Korean', () => {
    const englishKeys = missionKeys(en);
    const koreanKeys = missionKeys(ko);

    expect(englishKeys).toEqual(koreanKeys);
    expect(englishKeys.length).toBeGreaterThanOrEqual(70);

    for (const key of englishKeys) {
      expect(en[key].message.trim()).not.toBe('');
      expect(ko[key].message.trim()).not.toBe('');
      expect(en[key].placeholders).toEqual(ko[key].placeholders);
    }
  });

  it('keeps the progress-discard warning truthful in both authored locales', () => {
    expect(en.v2_listening_mission_unsaved_lost.message).toContain(
      'Progress saved before this session will remain.'
    );
    expect(ko.v2_listening_mission_unsaved_lost.message).toContain(
      '이전에 저장한 진행 상황은 그대로 남습니다.'
    );
  });

  it('describes progress facts, count-neutral labels, and every difficult-save outcome precisely', () => {
    expect(en.v2_listening_mission_exit_dialog_description.message).toContain(
      'Progress facts for completed lines'
    );
    expect(ko.v2_listening_mission_exit_dialog_description.message).toContain('진행 정보');
    expect(en.v2_listening_mission_summary_retry.message).toBe(
      'Lines available to retry: $1'
    );
    expect(en.v2_listening_mission_retry_lines.message).toBe('Retry lines ($1)');
    expect(en.v2_listening_mission_stars.message).toBe('Stars: $1');
    expect(ko.v2_listening_mission_results_hint_free.message).toBe(
      '힌트 없이 맞힌 문장: $1개'
    );
    expect(en.v2_listening_mission_difficult_saved.message).toBe(
      'Saved lines are marked below.'
    );
    expect(ko.v2_listening_mission_difficult_saved.message).toBe(
      '저장된 문장은 아래에 표시했습니다.'
    );

    for (const suffix of [
      'difficult_busy',
      'difficult_error',
      'difficult_terminal_failed',
      'difficult_unattempted',
    ]) {
      expect(en[`${PREFIX}${suffix}`]?.message.trim()).not.toBe('');
      expect(ko[`${PREFIX}${suffix}`]?.message.trim()).not.toBe('');
    }
  });

  it('does not introduce deferred statistics, ranking, or sharing language', () => {
    const englishCopy = missionKeys(en).map((key) => en[key].message).join(' ');
    const koreanCopy = missionKeys(ko).map((key) => ko[key].message).join(' ');

    expect(englishCopy).not.toMatch(/\b(?:accuracy|analytics?|daily|history|ranking|share|streak)\b/i);
    expect(koreanCopy).not.toMatch(/분석|정확도|기록|랭킹|순위|공유|연속 학습|일일/);
  });
});

const missionKeys = (messages: LocaleMessages) =>
  Object.keys(messages)
    .filter((key) => key.startsWith(PREFIX))
    .sort();
