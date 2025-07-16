import { Language } from '@utils/constants';
import { SubtitleData } from '@utils/parse';
import { PLATFORM_MAP } from '@utils/platform';

import { arrayToHeadersObject } from '@/content/features/subtitle/subtitle-utils';

import { PlatformStrategy } from './strategy';

export class YoutubeStrategy implements PlatformStrategy {
  detectVideo() {
    const video = document.querySelector('video');
    if (!video) return null;

    const player = document.querySelector('.html5-video-player');
    if (player?.classList.contains('ad-showing')) {
      return new Promise<HTMLVideoElement>((resolve) => {
        const observer = new MutationObserver(() => {
          if (!player.classList.contains('ad-showing')) {
            observer.disconnect();
            resolve(video);
            return;
          }
        });
        observer.observe(player, { attributes: true, attributeFilter: ['class'] });
      });
    }

    return video;
  }

  getVideoPlayer() {
    return document.querySelector('#movie_player');
  }

  getProgressBarContainer() {
    return document.querySelector('.ytp-progress-bar-container');
  }

  afterVideoDetected() {
    // 정확한 타이밍으로 개선 필요
    setTimeout(() => {
      const captionButton = document.querySelector('button.ytp-subtitles-button.ytp-button');
      if (!(captionButton instanceof HTMLElement)) {
        console.warn('[YouTube] Caption button not found');
        return;
      }
      this.toggleCaptionButton(captionButton);
    }, 1500);
  }

  async fetchSubtitles(
    url: string,
    headerList: chrome.webRequest.HttpHeader[]
  ): Promise<{ lang: Language; subtitleData: SubtitleData[] }[] | null> {
    if (!window.location.href.startsWith(PLATFORM_MAP.youtube.videoUrl)) return null;

    try {
      const headers = {
        ...arrayToHeadersObject(headerList),
        'X-Extension-Request': 'true',
      };
      const videoId = new URLSearchParams(window.location.search).get('v');

      if (!videoId) {
        console.error('[YouTube] Video ID not found');
        return null;
      }

      const tracks = await this.getCaptionTracks(videoId);
      if (!tracks || tracks.length === 0) {
        console.warn('[YouTube] No caption tracks found');
        return null;
      }

      return await this.fetchAllSubtitles(tracks, url, headers);
    } catch (error) {
      console.error('[YouTube] Error fetching subtitles:', error);
      return null;
    }
  }

  private toggleCaptionButton(captionButton: HTMLElement): void {
    const isPressed = captionButton.getAttribute('aria-pressed') === 'true';

    if (isPressed) {
      // 자막이 이미 활성화되어 있으면 비활성화
      captionButton.click();
    } else {
      // 자막이 비활성화되어 있으면 API 호출 후 다시 비활성화
      captionButton.click();
      captionButton.click();
    }
  }

  private async getCaptionTracks(videoId: string): Promise<CaptionTrack[] | null> {
    const tracksFromCurrentPage = this.extractTracksFromScripts();

    if (tracksFromCurrentPage?.playerResponse?.videoDetails?.videoId === videoId) {
      return tracksFromCurrentPage.tracks;
    }

    return await this.fetchTracksFromRefresh(videoId);
  }

  private extractTracksFromScripts(): { playerResponse: any; tracks: CaptionTrack[] } | null {
    const scripts = Array.from(document.getElementsByTagName('script'));

    for (const script of scripts) {
      const content = script.textContent ?? '';
      const result = this.parsePlayerResponse(content);
      if (result) {
        return result;
      }
    }

    return null;
  }

  private parsePlayerResponse(content: string): { playerResponse: any; tracks: CaptionTrack[] } | null {
    try {
      const match = content.match(/(?:var |let |const )?ytInitialPlayerResponse\s*=\s*(\{.+?\});/s);
      if (!match) return null;

      const playerResponse = JSON.parse(match[1]);
      const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks as CaptionTrack[];

      if (!tracks || !Array.isArray(tracks)) {
        return null;
      }

      return { playerResponse, tracks };
    } catch (error) {
      console.error('[YouTube] Error parsing player response:', error);
      return null;
    }
  }

  private async fetchTracksFromRefresh(videoId: string): Promise<CaptionTrack[] | null> {
    try {
      const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
      const body = await response.text();
      const result = this.parsePlayerResponse(body);

      return result?.tracks || null;
    } catch (error) {
      console.error('[YouTube] Error fetching tracks from refresh:', error);
      return null;
    }
  }

  private async fetchAllSubtitles(
    tracks: CaptionTrack[],
    baseUrl: string,
    headers: HeadersInit
  ): Promise<{ lang: Language; subtitleData: SubtitleData[] }[]> {
    const subtitlePromises = tracks.map(async ({ languageCode }) => {
      try {
        const subtitleUrl = this.transformUrl(baseUrl, languageCode);
        const subtitleData = await this.fetchTranscript(subtitleUrl, headers);
        return { lang: languageCode, subtitleData };
      } catch (error) {
        console.error(`[YouTube] Error fetching subtitle for ${languageCode}:`, error);
        return { lang: languageCode, subtitleData: [] };
      }
    });

    return await Promise.all(subtitlePromises);
  }

  private async fetchTranscript(url: string, headers: HeadersInit): Promise<SubtitleData[]> {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const transcript = (await response.json()) as TimedTextResponse;

    return transcript.events
      .filter(({ segs }) => segs && segs.length > 0 && segs.some((seg) => seg.utf8.trim() !== ''))
      .map(({ tStartMs, dDurationMs, segs }) => ({
        start: tStartMs / 1000,
        end: (tStartMs + dDurationMs) / 1000,
        text: segs.map((seg) => seg.utf8).join(' '),
      }));
  }

  private transformUrl(url: string, langCode: string): string {
    return url.replace(/([&?]lang=)[^&]*/, `$1${langCode}`);
  }
}

interface CaptionTrack {
  baseUrl: string;
  languageCode: Language;
  name: { simpleText: string };
  vssId: string;
  kind: string;
  isTranslatable: boolean;
}

interface TimedTextEvent {
  tStartMs: number;
  dDurationMs: number;
  segs: { utf8: string }[];
}

interface TimedTextResponse {
  events: TimedTextEvent[];
  pens: object[];
  wireMagic: string;
  wpWinPositions: object[];
  wsWinStyles: object[];
}
