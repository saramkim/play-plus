import { COUPANG_PLAY_SELECTORS } from '@utils/constants';
import { parseVTT, SubtitleData } from '@utils/parse';
import { z } from 'zod';

import { arrayToHeadersObject } from '@/content/features/subtitle/subtitle-utils';


class CoupangPlayStrategy {
  /**
   * 쿠팡플레이는 "가짜/이전 비디오 → 실제 영상 비디오"로 교체되는 경우가 있음.
   *
   * 현재 구조상(`initializeVideo()`가 detectVideo를 1회 await)에서 리로드/최초진입을 모두 커버하려면:
   * - 우선 현재 존재하는 비디오를 후보로 잡아두고
   * - 짧은 시간(기본 1초) 동안 교체 비디오를 감시해서 발견되면 그걸 확정
   * - 1초 내 교체가 없으면 기존 후보가 "그럴듯"할 때만 확정(주로 리로드 케이스)
   */
  async detectVideo({ swapWindowMs = 1000, timeoutMs = 10000 } = {}): Promise<HTMLVideoElement | null> {

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

        if (initialCandidate && isPlausibleVideo(initialCandidate)) {
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
          if (isPlausibleVideo(video)) {
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

  async fetchSubtitles(url: string, headers: chrome.webRequest.HttpHeader[]) {
    const subtitleApiInfoList = await this.fetchVideoMetadata(url, headers);
    return Promise.all(
      subtitleApiInfoList.map(async ({ lang, url }) => ({ lang, subtitleData: await this.fetchSubtitle(url) }))
    );
  }

  private async fetchVideoMetadata(url: string, headerList: chrome.webRequest.HttpHeader[]) {
    const headers = {
      ...arrayToHeadersObject(headerList),
      'X-Extension-Request': 'true', // 무한 루프 방지용 커스텀 헤더
    };
    const response = await fetch(url, { headers });
    return this.extractSubtitleApiInfoFromResponse(await response.json());
  }

  private async fetchSubtitle(url: string): Promise<SubtitleData[]> {
    const response = await fetch(url);
    return parseVTT(await response.text());
  }

  private extractSubtitleApiInfoFromResponse(response: unknown) {
    const result = playbackResponseSchema.safeParse(response);
    if (!result.success) {
      throw new Error('Invalid Coupang Play playback response');
    }

    return result.data.data.raw.text_tracks
      .filter(({ kind }) => kind === 'subtitles')
      .map(({ srclang, src }) => ({ lang: srclang, url: src }));
  }
}

export const coupangStrategy = new CoupangPlayStrategy();

const playbackResponseSchema = z.object({
  data: z.object({
    raw: z.object({
      text_tracks: z.array(
        z.object({
          kind: z.string(),
          srclang: z.string(),
          src: z.string(),
        })
      ),
    }),
  }),
});
