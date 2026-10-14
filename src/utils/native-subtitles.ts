import { SubtitleData } from './parse';

export type NativeSubtitleResult =
  | { status: 'success'; subtitleData: SubtitleData[] }
  | { status: 'failed' }
  | { status: 'absent' };

export type NativeSubtitleBatch = {
  videoId: string;
  requestId: number;
  en: NativeSubtitleResult;
  ko: NativeSubtitleResult;
};

export const resolveNativeSubtitle = (result: NativeSubtitleResult, previous?: SubtitleData[] | null) =>
  result.status === 'success' ? result.subtitleData : result.status === 'failed' ? previous ?? null : null;

export const hasNativeSubtitleFailure = ({ en, ko }: NativeSubtitleBatch) =>
  en.status !== 'success' && ko.status !== 'success' && (en.status === 'failed' || ko.status === 'failed');
