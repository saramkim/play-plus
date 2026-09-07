/* eslint-disable @typescript-eslint/no-restricted-imports */
import { describe, expect, it } from 'vitest';

import messagesEn from '../../../../public/_locales/en/messages.json';
import messagesKo from '../../../../public/_locales/ko/messages.json';

describe('One-line listening locale contract', () => {
  it('has matching nonempty English and Korean listening messages and placeholders', () => {
    const en = messagesEn as Record<string, { message: string; placeholders?: unknown }>;
    const ko = messagesKo as Record<string, { message: string; placeholders?: unknown }>;
    const keys = Object.keys(en).filter((key) => key.startsWith('v2_listening_')).sort();
    expect(keys).toEqual(Object.keys(ko).filter((key) => key.startsWith('v2_listening_')).sort());
    for (const key of keys) {
      expect(en[key].message.trim()).not.toBe('');
      expect(ko[key].message.trim()).not.toBe('');
      expect(en[key].placeholders).toEqual(ko[key].placeholders);
    }
  });
  it('distinguishes historical records, subtitle comparison and hidden playback from mastery', () => {
    expect(messagesEn.v2_listening_previous_records_description.message).toContain('does not add scores');
    expect(messagesKo.v2_listening_previous_records_description.message).toContain('이전 점수형');
    expect(messagesEn.v2_listening_compare_description.message).toContain('not a skill assessment');
    expect(messagesKo.v2_listening_blind_completed.message).toBe('가리고 한 번 더 들었어요.');
    expect(messagesEn.v2_listening_landing_spoken_language_description.message).toContain('cannot automatically confirm');
  });
});
