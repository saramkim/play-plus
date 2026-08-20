import { z } from 'zod';

import { languageSchema, subtitleCueSchema } from '@storage/v2/schema';
import { COUPANG_PLAY_SELECTORS, LANGUAGES, type Language } from '@utils/constants';
import { parseVTT } from '@utils/parse';

import type { NativeSubtitleTrack } from '@/content/features/subtitle/subtitle-store';
import { arrayToHeadersObject } from '@/content/features/subtitle/subtitle-utils';

export interface NativePlaybackAcquisition {
  subtitles: NativeSubtitleTrack[];
  watchNextFenceSeconds: number | null;
}


class CoupangPlayStrategy {
  /**
   * 쿠팡플레이는 "가짜/이전 비디오 → 실제 영상 비디오"로 교체되는 경우가 있음.
   *
   * 현재 구조상(`initializeVideo()`가 detectVideo를 1회 await)에서 리로드/최초진입을 모두 커버하려면:
   * - 우선 현재 존재하는 비디오를 후보로 잡아두고
   * - 짧은 시간(기본 1초) 동안 교체 비디오를 감시해서 발견되면 그걸 확정
   * - 1초 내 교체가 없으면 기존 후보가 "그럴듯"할 때만 확정(주로 리로드 케이스)
   */
  async detectVideo({ swapWindowMs = 1000, timeoutMs = 30000 } = {}): Promise<HTMLVideoElement | null> {

    const findVideoInNodes = (nodes: Node[]): HTMLVideoElement | null => {
      for (const node of nodes) {
        if (node instanceof HTMLVideoElement) return node;
        if (node instanceof Element && node.children.length > 0) {
          const video = findVideoInNodes(Array.from(node.children));
          if (video) return video;
        }
      }
      return null;
    };

    const isPlausibleVideo = (video: HTMLVideoElement) => {
      const playerWrapper = this.getVideoPlayer();
      if (playerWrapper && !playerWrapper.contains(video)) return false;

      if (video.currentSrc || video.src) return true;
      if (video.readyState >= 2) return true;
      return false;
    };

    const isLikelyAdvertisement = (video: HTMLVideoElement) => {
      const source = video.currentSrc || video.src;
      return (
        !source.startsWith('blob:') && Number.isFinite(video.duration) && video.duration > 0 && video.duration <= 60
      );
    };

    const isContentVideo = (video: HTMLVideoElement) => isPlausibleVideo(video) && !isLikelyAdvertisement(video);

    const initialCandidate = findVideoInNodes([document.body]);

    return new Promise((resolve) => {
      let settled = false;

      const cleanup = () => {
        observer.disconnect();
        window.clearTimeout(swapTimer);
        window.clearTimeout(timeoutTimer);
      };

      const settle = (video: HTMLVideoElement | null) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(video);
      };

      const trySettleOnWindowEnd = () => {
        // 1초 교체 윈도우 종료 시점:
        // - 교체 비디오를 못 찾았으면 initial 후보를 "그럴듯"할 때만 확정

        if (initialCandidate && isContentVideo(initialCandidate)) {
          settle(initialCandidate);
          return;
        }
        // initial이 없거나(혹은 placeholder 같으면) 계속 기다리되, 최대 시간 이후엔 실패 처리
      };

      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type !== 'childList' || mutation.addedNodes.length === 0) continue;
          const video = findVideoInNodes(Array.from(mutation.addedNodes));
          if (!video) continue;

          // 1) initial과 동일하면 의미 없으니 무시
          if (initialCandidate && video === initialCandidate) continue;

          // 2) 교체 윈도우 내에 새 비디오가 들어오면 우선 확정
          if (isContentVideo(video)) {
            settle(video);
            return;
          }
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });

      // 1초 뒤에 교체 윈도우 종료 판단
      const swapTimer = window.setTimeout(() => {
        if (settled) return;
        trySettleOnWindowEnd();
        // 1초 내 교체 비디오가 없었다면, initial이 그럴듯할 때만 성공. 아니면 실패.
      }, swapWindowMs);
      const timeoutTimer = window.setTimeout(() => settle(null), timeoutMs);
    });
  }

  getVideoPlayer() {
    return document.querySelector(COUPANG_PLAY_SELECTORS.player);
  }

  getProgressBarContainer() {
    return document.querySelector(COUPANG_PLAY_SELECTORS.progressBar);
  }

  async fetchSubtitles(url: string, headers: chrome.webRequest.HttpHeader[]): Promise<NativeSubtitleTrack[]> {
    return (await this.fetchPlaybackData(url, headers, Number.NaN)).subtitles;
  }

  async fetchPlaybackData(
    url: string,
    headers: chrome.webRequest.HttpHeader[],
    mediaDurationSeconds: number
  ): Promise<NativePlaybackAcquisition> {
    const { candidates, playbackResponse } = await this.fetchVideoMetadata(url, headers);
    const settlements = await Promise.allSettled(
      candidates.map(async ({ category, language, physicalIdentity, url }) => {
        const cues = subtitleCueSchema.array().parse(await this.fetchSubtitle(url));
        return cues.length === 0 ? null : { category, cues, language, physicalIdentity };
      })
    );
    const usableTracks = settlements.flatMap((settlement) =>
      settlement.status === 'fulfilled' && settlement.value !== null ? [settlement.value] : []
    );

    const subtitles = (Object.keys(LANGUAGES) as Language[]).flatMap((language) => {
      const languageTracks = usableTracks.filter((track) => track.language === language);
      const regularTracks = languageTracks.filter((track) => track.category === 'regular');
      if (regularTracks.length === 1) return regularTracks;
      if (regularTracks.length > 1) return [];
      const sdhTracks = languageTracks.filter((track) => track.category === 'sdh');
      return sdhTracks.length === 1 ? sdhTracks : [];
    });
    return {
      subtitles,
      watchNextFenceSeconds: extractWatchNextFenceSeconds(
        playbackResponse,
        mediaDurationSeconds
      ),
    };
  }

  private async fetchVideoMetadata(url: string, headerList: chrome.webRequest.HttpHeader[]) {
    const headers = {
      ...arrayToHeadersObject(headerList),
      'X-Extension-Request': 'true', // 무한 루프 방지용 커스텀 헤더
    };
    const response = await fetch(url, { headers });
    return this.extractPlaybackDataFromResponse(await response.json());
  }

  private async fetchSubtitle(url: string) {
    const response = await fetch(url);
    return parseVTT(await response.text());
  }

  private extractPlaybackDataFromResponse(response: unknown) {
    const result = playbackResponseSchema.safeParse(response);
    if (!result.success) {
      throw new Error('Invalid Coupang Play playback response');
    }

    const candidates = result.data.data.raw.text_tracks.flatMap((value) => {
      const descriptor = playbackTextTrackSchema.safeParse(value);
      if (!descriptor.success || descriptor.data.kind !== 'subtitles') return [];
      const classification = classifyNativeSubtitleLanguage(descriptor.data.srclang);
      if (!classification) return [];
      const url = resolveSubtitleUrl(descriptor.data.src, descriptor.data.sources);
      return url ? [{ ...classification, physicalIdentity: url, url }] : [];
    });
    return { candidates, playbackResponse: response };
  }
}

export const coupangStrategy = new CoupangPlayStrategy();

const playbackResponseSchema = z.object({
  data: z.object({
    raw: z.object({
      text_tracks: z.array(z.unknown()),
    }),
  }),
});

const playbackTextTrackSchema = z
  .object({
    kind: z.unknown().optional(),
    sources: z.unknown().optional(),
    src: z.unknown().optional(),
    srclang: z.unknown().optional(),
  })
  .passthrough();

const classifyNativeSubtitleLanguage = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const regular = languageSchema.safeParse(value);
  if (regular.success) return { category: 'regular' as const, language: regular.data };
  if (!value.endsWith(' sdh')) return null;
  const sdh = languageSchema.safeParse(value.slice(0, -4));
  return sdh.success ? { category: 'sdh' as const, language: sdh.data } : null;
};

const resolveSubtitleUrl = (src: unknown, sources: unknown) => {
  const firstSource = Array.isArray(sources) ? sources[0] : undefined;
  const fallback =
    typeof firstSource === 'object' &&
    firstSource !== null &&
    'src' in firstSource
      ? firstSource.src
      : undefined;
  const url = src ?? fallback;
  return typeof url === 'string' && url.length > 0 ? url : null;
};

const MARKER_FIELDS = ['force_stop', 'id', 'metadata', 'name', 'time', 'type'] as const;
const INTRO_MARKER_NAMES = ['skip_intro_start', 'skip_intro_end'] as const;
type IntroMarkerName = (typeof INTRO_MARKER_NAMES)[number];

interface StrictMarker {
  index: number;
  name: IntroMarkerName | 'watch_next';
  timeSeconds: number;
}

export const extractWatchNextFenceSeconds = (
  response: unknown,
  mediaDurationSeconds: number
): number | null => {
  const raw = asRecord(asRecord(asRecord(response)?.data)?.raw);
  const cuePoints = raw?.cue_points;
  const rawDuration = raw?.duration;
  if (
    !Array.isArray(cuePoints) ||
    typeof rawDuration !== 'number' ||
    !Number.isFinite(rawDuration) ||
    rawDuration < 0 ||
    !Number.isFinite(mediaDurationSeconds) ||
    mediaDurationSeconds < 0
  ) {
    return null;
  }

  const normalizedRawDurationSeconds = rawDuration * 0.001;
  if (!Number.isFinite(normalizedRawDurationSeconds)) return null;

  const rawWatchNextEntries = cuePoints.filter(
    (value) => asRecord(value)?.name === 'watch_next'
  );
  if (rawWatchNextEntries.length !== 1) return null;

  const watchNextIndex = cuePoints.indexOf(rawWatchNextEntries[0]);
  const watchNext = parseStrictMarker(
    rawWatchNextEntries[0],
    watchNextIndex,
    normalizedRawDurationSeconds,
    mediaDurationSeconds
  );
  if (!watchNext || watchNext.name !== 'watch_next') return null;

  const strictIntroMarkers = cuePoints.flatMap((value, index) => {
    const name = asRecord(value)?.name;
    if (!isIntroMarkerName(name)) return [];
    const marker = parseStrictMarker(
      value,
      index,
      normalizedRawDurationSeconds,
      mediaDurationSeconds
    );
    return marker && marker.name !== 'watch_next' ? [marker] : [];
  });
  for (const name of INTRO_MARKER_NAMES) {
    if (strictIntroMarkers.filter((marker) => marker.name === name).length > 1) return null;
  }

  const orderedMarkers = [...strictIntroMarkers, watchNext].sort(
    (left, right) => left.index - right.index
  );
  if (
    orderedMarkers.some(
      (marker, index) =>
        index > 0 && marker.timeSeconds < orderedMarkers[index - 1].timeSeconds
    ) ||
    strictIntroMarkers.some((marker) => marker.timeSeconds >= watchNext.timeSeconds)
  ) {
    return null;
  }

  const introStart = strictIntroMarkers.find(({ name }) => name === 'skip_intro_start');
  const introEnd = strictIntroMarkers.find(({ name }) => name === 'skip_intro_end');
  if (
    introStart &&
    introEnd &&
    !(introStart.timeSeconds < introEnd.timeSeconds &&
      introEnd.timeSeconds < watchNext.timeSeconds)
  ) {
    return null;
  }

  return watchNext.timeSeconds;
};

const parseStrictMarker = (
  value: unknown,
  index: number,
  rawDurationSeconds: number,
  mediaDurationSeconds: number
): StrictMarker | null => {
  const marker = asRecord(value);
  if (
    !marker ||
    Object.keys(marker).length !== MARKER_FIELDS.length ||
    !MARKER_FIELDS.every((field) => field in marker) ||
    marker.force_stop !== false ||
    typeof marker.id !== 'string' ||
    marker.id.length === 0 ||
    typeof marker.metadata !== 'string' ||
    (marker.name !== 'watch_next' && !isIntroMarkerName(marker.name)) ||
    marker.type !== 'CODE' ||
    typeof marker.time !== 'number' ||
    !Number.isFinite(marker.time) ||
    marker.time < 0 ||
    marker.time > rawDurationSeconds ||
    marker.time > mediaDurationSeconds
  ) {
    return null;
  }
  return { index, name: marker.name, timeSeconds: marker.time };
};

const isIntroMarkerName = (value: unknown): value is IntroMarkerName =>
  typeof value === 'string' && INTRO_MARKER_NAMES.includes(value as IntroMarkerName);

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
