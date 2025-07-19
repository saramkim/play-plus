import { parseVTT, SubtitleData } from '@utils/parse';

import { arrayToHeadersObject } from '@/content/features/subtitle/subtitle-utils';

import { PlatformStrategy } from './strategy';

export class CoupangPlayStrategy implements PlatformStrategy {
  async detectVideo(): Promise<HTMLVideoElement> {
    return new Promise((resolve) => {
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === 'childList') {
            const addedNodes = Array.from(mutation.addedNodes);
            const video = addedNodes.find((node) => node instanceof HTMLVideoElement);

            if (video) {
              observer.disconnect();
              resolve(video);
              return;
            }
          }
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  getVideoPlayer() {
    return document.querySelector('#playerWrapper');
  }

  getProgressBarContainer() {
    return document.querySelector('div.slider');
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

  private extractSubtitleApiInfoFromResponse(response: ApiResponse) {
    return response.data.raw.text_tracks
      .filter(({ kind }) => kind === 'subtitles')
      .map(({ srclang, src }) => ({ lang: srclang!, url: src }));
  }
}

type ApiResponse = {
  success: boolean;
  data: {
    raw: {
      account_id: string;
      created_at: string;
      cue_points: {
        force_stop: boolean;
        id: string;
        metadata: string;
        name: string;
        time: number;
        type: string;
      }[];
      duration: number;
      id: string;
      published_at: string;
      sources: {
        key_systems: {
          'com.apple.fps.1_0'?: {
            certificate_url?: string;
            key_request_url: string;
            license_url?: string;
          };
          'com.widevine.alpha'?: {
            certificate_url?: string;
            key_request_url: string;
            license_url?: string;
          };
        };
        src: string;
        type: string;
      }[];
      text_tracks: {
        account_id: string | null;
        asset_id: string | null;
        bandwidth: number | null;
        default: boolean | null;
        height: number | null;
        id: string | null;
        kind: string;
        label: string;
        mime_type: string;
        sources: { src: string }[];
        src: string;
        srclang: 'en' | 'ko';
        width: number | null;
      }[];
      updated_at: string;
    };
    preferredDrm: string | null;
    streamId: string;
  };
  meta: {
    now: number;
    requestId: string;
  };
  'x-payload-signature': string;
  'body-signature': string;
  'client-ip': string;
};
